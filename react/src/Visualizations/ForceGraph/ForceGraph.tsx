import React, { useEffect, useState } from 'react';
import { Box, capitalize, Theme, useTheme } from '@mui/material';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { D3DragEvent, drag } from 'd3-drag';
import { easeCubicIn } from 'd3-ease';
import { HierarchyLink, HierarchyNode } from 'd3-hierarchy';
import { scaleLinear, scaleOrdinal } from 'd3-scale';
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
import { getEntityId, mapTree } from '../../util';

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
    tree: HierarchyNode<ModelEntity>;
    selectedCallback: (node: DSINode) => void;
}

const ForceGraph: React.FC<ForceGraphProps> = ({
    containerWidth,
    tree,
    selectedCallback,
}) => {
    const [Graph, setGraph] = useState<D3ForceGraph>();

    const theme = useTheme();

    const targetId = 'target';

    /* initialize */
    useEffect(() => {
        if (tree && !Graph && containerWidth) {
            const Graph = new D3ForceGraph(
                targetId,
                theme,
                tree,
                selectedCallback
            );
            Graph.render();
            setGraph(Graph);
        }
    }, [Graph, containerWidth, tree, selectedCallback, theme]);

    /* toggle dark mode */
    useEffect(() => {
        if (Graph) {
            Graph.toggleTheme(theme);
        }
    }, [theme, Graph]);

    /* replace graphic entirely when root changes */
    useEffect(() => {
        if (Graph && getEntityId(Graph.tree.data) !== getEntityId(tree.data)) {
            selectAll('svg').remove();

            const Graph = new D3ForceGraph(
                targetId,
                theme,
                tree,
                selectedCallback
            );
            Graph.render();
            setGraph(Graph);
        } else {
            Graph?.update(tree);
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [tree]);

    return containerWidth ? (
        <Box
            width={`${containerWidth}px`}
            border={`solid thin ${theme.palette.text.secondary}`}
            id={targetId}
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
    // remove red, since that's our highlight color
    // and removed gray, since it's close to dark font
    schemeCategory10.filter((_, i) => ![3, 7].includes(i))
).domain(entityTypes);

const nodeSizeScale = scaleLinear().domain([0, 250]).range([5, 10]);

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
        simulation.alphaTarget(0.01).restart();
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

const drawLegend = (selector: string, theme: Theme) => {
    const container = select(selector).attr('fill', theme.palette.text.primary);

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
    simulation: DSISimulation;
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

        this.simulation = forceSimulation();

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
            .attr('fill', theme.palette.background.default);

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

        this.svg
            .append('g')
            .attr(
                'transform',
                `translate(${this.w / 2 - 100}, ${this.h / 2 - 130})`
            )
            .attr('class', 'control legend-container')
            .append('rect')
            .attr('fill', theme.palette.background.default)
            .attr('width', '100')
            .attr('height', '130');

        drawLegend('.legend-container', theme);

        appendToolTip();
    }

    appendLinks = (forceLinks: DSIForceLinks) => {
        const selection = this.svg
            .select<SVGGElement>('g.line-container')
            .selectAll<SVGLineElement, SimulationLinkDatum<DSINode>>('line')
            .data(forceLinks.links(), makeLinkKey)
            .join(
                enter => {
                    const enterSelection = enter
                        .append('line')
                        .attr('class', 'chart')
                        .attr('opacity', d =>
                            (d.target as DSINode).data.type === 'person' ? 0 : 1
                        )
                        .attr('stroke', this.theme.palette.text.primary);

                    enterSelection
                        .transition()
                        .duration(1000)
                        .attr('opacity', function (d) {
                            return (d.target as DSINode).data.type ===
                                'person' && (d.target as DSINode).selected
                                ? 1
                                : select(this).attr('opacity');
                        });
                    return enterSelection;
                },
                update => update,
                function (exit) {
                    exit.transition()
                        .duration(250)
                        .ease(easeCubicIn)
                        .attr('opacity', 0)
                        .attr('x2', function () {
                            return select(this).attr('x1');
                        })
                        .attr('y2', function () {
                            return select(this).attr('y1');
                        })
                        .remove();
                }
            );

        return selection;
    };

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
                        .attr('opacity', d =>
                            d.data.type === 'person' ? 0 : 1
                        )
                        .attr('r', d => nodeSizeScale(d.descendants().length))
                        .attr('fill', d => colorScale(d.data.type))
                        .attr('stroke', d => {
                            return d.children
                                ? this.theme.palette.text.primary
                                : null;
                        })
                        .transition()
                        .duration(500)
                        .attr('opacity', function (d) {
                            return d.data.type === 'person' && d.selected
                                ? 1
                                : select(this).attr('opacity');
                        });

                    enterSelection
                        .append('path')
                        .attr('d', 'M -8 0 A 8 8, 0, 1, 0, 0 8 L 0 0 Z')
                        .attr('fill', 'red')
                        .attr('stroke', 'black')
                        .attr('stroke-width', 0)
                        .attr('fill-opacity', 0)
                        .transition()
                        .duration(500)
                        .attr('fill-opacity', d => (d.selected ? 1 : 0))
                        .attr('stroke-width', d => (d.selected ? 2 : 0));

                    enterSelection
                        .filter(
                            n =>
                                ['campus', 'network'].includes(n.data.type) ||
                                (n.descendants().length /
                                    this.tree.descendants().length >
                                    0.05 &&
                                    ['division', 'institution'].includes(
                                        n.data.type
                                    ))
                        )
                        .append('text')
                        .attr('fill', this.theme.palette.text.primary)
                        .attr('opacity', 0)
                        .text(d => d.data.name)
                        .attr('text-anchor', 'middle')
                        .style('user-select', 'none')
                        .transition()
                        .duration(500)
                        .style('opacity', 0.5);

                    return enterSelection;
                },
                update => update,
                exit => {
                    exit.select('circle')
                        .transition()
                        .duration(500)
                        .attr('opacity', 0)
                        .remove();

                    exit.remove();
                }
            )
            //ensure selected are in "front"
            .sort(a => (a.selected ? 1 : -1));

        nodeSelection
            .call(registerToolTip)
            .call(registerDragHandler, simulation)
            .call(this.registerClickZoom, this.svg);

        return nodeSelection;
    };

    buildSimulation = (
        nodes: DSINode[],
        w: number,
        forceLinks: DSIForceLinks
    ) =>
        this.simulation
            .nodes(nodes)
            .force(
                'charge',
                forceManyBody()
                    .strength(-50)
                    .distanceMax(w / 3)
            )
            .force('links', forceLinks.distance(w / 50).strength(1))
            .force('collision', forceCollide().radius(6))
            .force('center', forceCenter())
            .velocityDecay(0.4);

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
                    .scale(3)
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

            this.buildSimulation(this.tree.descendants(), this.w, forceLinks);

            const nodeSelection = this.appendNodes(
                this.simulation.nodes(),
                this.simulation
            );

            const linkSelection = this.appendLinks(forceLinks);

            registerTickHandler(this.simulation, linkSelection, nodeSelection);
        }
    };

    toggleTheme = (theme: Theme) => {
        this.theme = theme;
        this.svg.selectAll('line').attr('stroke', theme.palette.text.primary);
        this.svg.selectAll('circle').attr('stroke', function () {
            return select(this).attr('stroke')
                ? theme.palette.text.primary
                : null;
        });
        this.svg.selectAll('text').attr('fill', theme.palette.text.primary);

        this.svg
            .selectAll('rect')
            .attr('fill', theme.palette.background.default);
    };

    update = (_tree: DSINode) => {
        // map previous locations to new nodes
        const simNodeLocationMap = this.simulation!.nodes().reduce<
            Record<string, SimulationNodeDatum>
        >(
            (acc, curr) => ({
                ...acc,
                [curr.id!]: {
                    x: curr.x,
                    vx: curr.vx,
                    y: curr.y,
                    vy: curr.vy,
                },
            }),
            {}
        );

        const tree: DSINode = mapTree(_tree, n => ({
            ...n,
            ...(simNodeLocationMap[getEntityId(n.data)]
                ? simNodeLocationMap[getEntityId(n.data)]
                : // b/c we are inserting/removing only leaf nodes,
                  // we can confidently set the starting position to the parent's for a smooter entry
                  simNodeLocationMap[getEntityId(n.parent!.data)]),
        }));

        const forceLinks = buildForceLinks(tree.links());

        //fix coordinates of unselected nodes
        tree.each(n => {
            if (!n.selected) {
                n.fx = n.x;
                n.fy = n.y;
            }
        });

        // stop sim to prevent timing issues
        this.simulation.stop();

        this.simulation.nodes(tree.descendants());
        this.simulation.force('links', forceLinks);

        const linkSelection = this.appendLinks(forceLinks);
        const nodeSelection = this.appendNodes(
            this.simulation!.nodes(),
            this.simulation!
        );

        //since references have been broken w/ previous data, we need to reregister handler w/ new selections
        registerTickHandler(this.simulation!, linkSelection, nodeSelection);

        this.simulation.force('center', null);
        this.simulation.alpha(0.3);
        //this.simulation.alphaTarget(0);
        this.simulation.restart();
    };
}
