import React, { useEffect, useState } from 'react';
import { Theme, useTheme } from '@mui/material';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { D3DragEvent, drag } from 'd3-drag';
import { HierarchyLink, HierarchyNode } from 'd3-hierarchy';
import { scaleOrdinal } from 'd3-scale';
import { Selection, BaseType, select, selectAll } from 'd3-selection';
import { D3ZoomEvent, zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import 'd3-transition'; // must be imported so selection.transition will resolve
import {
    forceCenter,
    forceCollide,
    forceLink,
    ForceLink,
    forceManyBody,
    forceSimulation,
    Simulation,
    SimulationLinkDatum,
    SimulationNodeDatum,
} from 'd3-force';
import { EntityType, ModelEntity } from '../../types';
import { capitalize, getEntityId, mapTree } from '../../util';

// for debugging
(window as any).d3Select = select;
(window as any).d3SelectAll = selectAll;

type DSISimulation = Simulation<DSINode, SimulationLinkDatum<DSINode>>;

type DSIForceLinks = ForceLink<DSINode, SimulationLinkDatum<DSINode>>;

type DSINodeSelection = Selection<SVGGElement, DSINode, BaseType, unknown>;

export interface SelectedModel {
    type: EntityType;
    id: number;
}
interface ForceGraphProps {
    containerWidth: number;
    selectedModels: SelectedModel[];
    tree: HierarchyNode<ModelEntity>;
    selectedCallback: (node: DSINode) => void;
}

const ForceGraph: React.FC<ForceGraphProps> = ({
    containerWidth,
    selectedModels,
    tree,
    selectedCallback,
}) => {
    const [Graph, setGraph] = useState<D3ForceGraph>();

    const theme = useTheme();

    /* initialize */
    useEffect(() => {
        if (tree && !Graph && containerWidth) {
            const Graph = new D3ForceGraph(
                'test',
                theme,
                tree,
                selectedCallback
            );
            Graph.render();
            setGraph(Graph);
        }
    }, [Graph, containerWidth, tree, selectedCallback, theme]);

    /* replace */
    useEffect(() => {
        if (Graph && tree !== Graph.tree) {
            selectAll('svg').remove();
            const Graph = new D3ForceGraph(
                'test',
                theme,
                tree,
                selectedCallback
            );
            Graph.render();
            setGraph(Graph);
        }
    }, [tree, Graph, theme, selectedCallback]);

    /* highlight selected models */
    useEffect(() => {
        if (Graph) {
            const selectedMap = selectedModels.reduce<Record<string, boolean>>(
                (acc, curr) => ({
                    ...acc,
                    [`${curr.type}-${curr.id}`]: true,
                }),
                {}
            );

            // clone tree to prevent mutating bound data,
            // causing d3 to not register enter selection
            const mapped = mapTree(tree, t => ({
                ...t,
                selected: selectedMap[getEntityId(t.data)],
            }));

            Graph.update(mapped);
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps  */
    }, [selectedModels, tree]);

    return containerWidth ? (
        <div
            style={{
                width: `${containerWidth}px`,
                border: `solid thin ${theme.palette.text.secondary}`,
            }}
            id="test"
        />
    ) : null;
};

const entityTypes: EntityType[] = [
    'campus',
    'division',
    'institution',
    'person',
    'program',
    'resource',
    'unit',
];

const colorScale = scaleOrdinal(
    schemeCategory10.filter((_, i) => i !== 3) //remove red, since that's our highlight color
).domain(entityTypes);

interface DSINode
    extends Record<string, any>,
        HierarchyNode<ModelEntity>,
        SimulationNodeDatum {
    selected?: boolean;
}

/**
 *  Unique key used to identify nodes for d3.join process and mapping simulation links to source/target
 */
const makeNodeKey = (datum: DSINode) => {
    return `${datum.data.id}-${datum.data.type}-${datum.parent?.data.id}-${datum.data.relationship}-${datum.selected}`;
};

/**
 *  Unique key used to identify links for d3.join process
 */
const makeLinkKey = <T extends DSINode>(link: SimulationLinkDatum<T>) => {
    const source = link.source as DSINode;
    const target = link.target as DSINode;
    return `${source.data.id}-${source.parent?.id}-${target.selected}-${target.data.id}`;
};

const buildSimulation = (
    nodes: DSINode[],
    w: number,
    forceLinks: DSIForceLinks
) =>
    forceSimulation<DSINode>(nodes)
        .force(
            'charge',
            forceManyBody()
                .strength(-25)
                .distanceMax(w / 4)
        )
        .force('links', forceLinks.distance(w / 50).strength(1))
        .force('collision', forceCollide().radius(6))
        .force('center', forceCenter())
        .velocityDecay(0.4);

const buildForceLinks = (links: HierarchyLink<ModelEntity>[]) =>
    forceLink<DSINode, SimulationLinkDatum<DSINode>>(links).id(model =>
        makeNodeKey(model)
    );

const registerTickHandler = (
    simulation: DSISimulation,
    linkSelection: Selection<
        SVGLineElement,
        SimulationLinkDatum<DSINode>,
        BaseType,
        unknown
    >,
    nodeSelection: DSINodeSelection
) => {
    // simulation mutates data bound to nodes by reference
    simulation.on('tick', () => {
        nodeSelection.attr('transform', d => `translate(${d.x}, ${d.y})`);

        linkSelection
            .attr('x1', d => (d.source as DSINode).x!)
            .attr('y1', d => (d.source as DSINode).y!)
            .attr('x2', d => (d.target as DSINode).x!)
            .attr('y2', d => (d.target as DSINode).y!);
    });
};

const registerToolTip = (selection: DSINodeSelection) => {
    selection
        .on('mouseover', (d: MouseEvent) => showToolTip(d))
        .on('mouseout', () => hideToolTip());
};

const showToolTip = (e: MouseEvent) => {
    select('.tooltip')
        .text((e!.target as any).__data__.data.name)
        .style('visibility', 'visible')
        .style('left', `${e.pageX + 15}px`)
        .style('top', `${e.pageY - 25}px`);
};

const hideToolTip = () => {
    select('.tooltip').style('visibility', 'hidden');
};

const registerDragHandler = (
    selection: DSINodeSelection,
    simulation: DSISimulation
) => {
    const dragstarted = (
        e: D3DragEvent<SVGCircleElement, DSINode, unknown>,
        d: DSINode
    ) => {
        simulation.nodes().forEach(n => {
            n.fx = null;
            n.fy = null;
        });
        simulation.alphaTarget(0.05).restart();
        d.fx = d.x;
        d.fy = d.y;
    };

    const dragged = (
        e: D3DragEvent<SVGCircleElement, DSINode, unknown>,
        d: DSINode
    ) => {
        d.fx = e.x;
        d.fy = e.y;
    };

    const dragended = (
        e: D3DragEvent<SVGCircleElement, DSINode, unknown>,
        d: DSINode
    ) => {
        if (!e.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    };

    const handler = drag<SVGGElement, DSINode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);

    return handler(selection);
};

const drawLegend = (selector: string) => {
    const container = select(selector);

    container
        .selectAll('g.legend')
        .data(colorScale.domain())
        .join('g')
        .attr('transform', (_, i) => `translate(8, ${(i + 1) * 15})`)
        .attr('class', 'legend')
        .append('circle')
        .attr('r', 3)
        .attr('fill', d => colorScale(d));

    container
        .selectAll<BaseType, string>('g.legend')
        .append('text')
        .text((d: string) => d && capitalize(d))
        .attr('transform', `translate(8, 5)`);
};

const appendToolTip = () => {
    select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('background-color', 'black')
        .style('padding', '5px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('max-width', '120px')
        .style('visibility', 'hidden')
        .style('color', 'white');
};

export default ForceGraph;

class D3ForceGraph {
    globalZoomHandler: ({
        transform,
    }: D3ZoomEvent<SVGSVGElement, unknown>) => void;
    h: number;
    selector: string;
    svg: Selection<SVGSVGElement, unknown, HTMLElement, unknown>;
    simulation?: DSISimulation;
    theme: Theme;
    tree: DSINode;
    updateCallback: (node: DSINode) => void;
    w: number;
    constructor(
        selector: string,
        theme: Theme,
        tree: DSINode,
        updateCallback: (node: DSINode) => void
    ) {
        this.selector = selector;
        this.theme = theme;
        this.tree = tree;
        this.w = 1000;
        this.h = 1000;
        this.svg = select(`#${this.selector}`)
            .append('svg')
            .attr('class', 'main')
            .attr('viewBox', [-this.w / 2, -this.h / 2, this.w, this.h]);
        this.updateCallback = updateCallback;

        this.svg
            .append('g')
            .attr('stroke-opacity', 0.6)
            .attr('class', 'container line-container');

        this.svg
            .append('g')
            .attr('class', 'container circle-container')
            .attr('stroke-width', 1.5);

        this.globalZoomHandler = ({
            transform,
        }: D3ZoomEvent<SVGSVGElement, unknown>) => {
            this.svg
                .selectAll('.container')
                .attr('transform', transform.toString());
            this.svg
                .select('g.zoom-indicator')
                .selectAll<SVGTextElement, number>('text')
                .data([transform.k || 1])
                .join('text')
                .text(d => `Zoom: ${Math.floor(d * 100).toString()}%`)
                .attr('transform', `translate(2,15)`);
        };
        /* 'global' zoom behavior, will listen on SVG and adjust scale on mouse wheel */
        const globalZoom = zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 40])
            .on('zoom', this.globalZoomHandler);

        this.svg.call(globalZoom);

        const zoomIndicator = this.svg
            .append('g')
            .attr('class', 'control zoom-indicator')
            .attr(
                'transform',
                `translate(${this.w / 2 - 100}, ${-this.h / 2})`
            );

        zoomIndicator
            .append('rect')
            .attr('width', 100)
            .attr('height', 17)
            .attr('fill', 'white');

        zoomIndicator
            .append('text')
            .text('Zoom: 100%')
            .attr('transform', `translate(2, 15)`);

        /*eslint-disable-next-line @typescript-eslint/no-this-alias */
        const that = this;

        this.svg.on('click', function () {
            const currentZoom = zoomTransform(select(this).node()!).k;
            if (currentZoom > 1) {
                that.svg
                    .transition()
                    .duration(1000)
                    .call(
                        globalZoom.transform,
                        zoomIdentity.translate(0, 0).scale(1)
                    );
            }
        });

        drawLegend('.legend-container');

        appendToolTip();
    }

    appendLinks = (forceLinks: DSIForceLinks) =>
        this.svg
            .select<SVGGElement>('g.line-container')
            .selectAll<SVGLineElement, SimulationLinkDatum<DSINode>>('line')
            .data(forceLinks.links(), makeLinkKey)
            .attr('class', 'chart')
            .join('line')
            .attr('stroke', this.theme.palette.text.primary);

    appendNodes = (nodes: DSINode[], simulation: DSISimulation) => {
        const nodeSelection = this.svg
            .select('g.circle-container')
            .selectAll<SVGGElement, DSINode>('g.circle-node')
            .data(nodes, (d, i) => (d ? makeNodeKey(d) : i))
            .join(
                enter => {
                    const enterSelection = enter
                        .append('g')
                        .attr('class', 'circle-node');

                    enterSelection
                        .append('circle')
                        .attr('fill', d => colorScale(d.data.type))
                        .attr('stroke', d =>
                            d.children ? this.theme.palette.text.primary : null
                        )
                        .transition()
                        .duration(700)
                        .attr('r', d => (d.selected ? 8 : 5))
                        .attr('fill', function (d) {
                            return d.selected
                                ? '#e7298a'
                                : select(this).attr('fill');
                        });

                    enterSelection
                        .append('path')
                        .attr('d', 'M -15 0 A 15 15, 0, 1, 0, 0 15 L 0 0 Z')
                        .attr('fill', 'red')
                        .attr('stroke', 'black')
                        .attr('opacity', 0)
                        .transition()
                        .duration(700)
                        .style('opacity', d => (d.selected ? 1 : 0));

                    return enterSelection;
                },
                update => update,
                exit => exit.remove()
            )
            //ensure selected are in "front"
            .sort(a => (a.selected ? 1 : -1));

        nodeSelection
            .call(registerToolTip)
            .call(registerDragHandler, simulation)
            .call(this.registerClickZoom, this.svg);

        return nodeSelection;
    };

    registerClickZoom = (selection: DSINodeSelection) => {
        const nodeZoom = zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 40])
            .on('zoom', this.globalZoomHandler);

        const clickZoom = (event: MouseEvent, node: DSINode) => {
            event.stopPropagation();

            nodeZoom.transform(
                this.svg.transition().duration(750),
                zoomIdentity
                    .translate(0, 0)
                    .scale(7)
                    .translate(-node.x!, -node.y!)
            );
        };

        selection.on('click', (e, node) => {
            clickZoom(e, node);
            this.updateCallback(node);
        });
    };

    render = () => {
        if (this.tree) {
            const forceLinks = buildForceLinks(this.tree.links());

            this.simulation = buildSimulation(
                this.tree.descendants(),
                this.w,
                forceLinks
            );

            const nodeSelection = this.appendNodes(
                this.simulation.nodes(),
                this.simulation
            );

            const linkSelection = this.appendLinks(forceLinks);

            registerTickHandler(this.simulation, linkSelection, nodeSelection);
        }
    };

    update = (tree: DSINode) => {
        // uncomment only if adding new nodes/links
        const forceLinks = buildForceLinks(tree.links()); /* .links(
            tree.links().map(l => ({
                source: makeNodeKey(l.source),
                target: makeNodeKey(l.target),
            }))
        ); */

        //fix coordinates of unselected nodes
        tree.eachAfter(n => {
            if (n.children && n.children.find(n => n.selected)) {
                n.children.forEach(n => {
                    n.fx = null;
                    n.fy = null;
                });
            } else {
                n.fx = n.x;
                n.fy = n.y;
            }
        });

        // stop sim to prevent timing issues
        this.simulation?.stop();

        this.simulation?.nodes(tree.descendants());
        this.simulation?.force('links', forceLinks);

        const linkSelection = this.appendLinks(forceLinks);
        const nodSelection = this.appendNodes(
            this.simulation!.nodes(),
            this.simulation!
        );

        //since references have been broken w/ previous data, we need to reregister handler w/ new selections
        registerTickHandler(this.simulation!, linkSelection, nodSelection);

        this.simulation?.alpha(0.01);
        this.simulation?.restart();
    };
}
