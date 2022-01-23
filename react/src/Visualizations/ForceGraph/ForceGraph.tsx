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
import { capitalize, getEntityId, groupBy } from '../../util';

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
    tree: HierarchyNode<ModelEntity>;
    containerWidth: number;
}

const ForceGraph: React.FC<ForceGraphProps> = ({ containerWidth, tree }) => {
    const [chartRendered, setChartRendered] = useState(false);
    // we need to manually stop the simulation to prevent memory leaks from the tick event (for now)
    const [simulation, setSimulation] = useState<DSISimulation>();

    const theme = useTheme();

    useEffect(() => {
        if (tree && chartRendered) {
            // crude check for now, soon we'll want a proper transition
            simulation!.stop();
            if (tree.descendants().length === simulation?.nodes().length) {
                setSimulation(updateForceGraph(tree, theme));
            } else {
                selectAll('svg').remove();
                setSimulation(buildForceGraph(tree, 'test', theme));
            }
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps  */
    }, [tree]);

    useEffect(() => {
        if (tree && !chartRendered && containerWidth) {
            setSimulation(buildForceGraph(tree, 'test', theme));
            setChartRendered(true);
        }
    }, [chartRendered, containerWidth, tree, theme]);

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
const makeNodeKey = (datum: DSINode) =>
    `${datum.data.id}-${datum.data.type}-${datum.parent?.data.id}-${datum.data.relationship}-${datum.selected}`;

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
    forceLinks: DSIForceLinks,
    w: number
) =>
    forceSimulation<DSINode>(nodes)
        .force('d', forceLinks.distance(w / 50).strength(1))
        .force(
            'charge',
            forceManyBody()
                .strength(-25)
                .distanceMax(w / 4)
        )
        .force('collision', forceCollide().radius(6))
        .force('center', forceCenter())
        .velocityDecay(0.4);

const buildForceLinks = (links: HierarchyLink<ModelEntity>[]) =>
    forceLink<DSINode, SimulationLinkDatum<DSINode>>(links).id(model =>
        makeNodeKey(model)
    );

/**
 *  Update nodes and return enter selection data for use by caller
 */
const updateNodeSelection = (
    nodeSelection: DSINodeSelection,
    nodes: DSINode[],
    theme: Theme
) => {
    const bound = nodeSelection.data(nodes, d => makeNodeKey(d));

    bound
        .join(
            enter => {
                const enterSelection = enter
                    .append('g')
                    .attr('class', 'circle-node');

                enterSelection
                    .append('circle')
                    .attr('fill', d => colorScale(d.data.type))
                    .attr('stroke', d =>
                        d.children ? theme.palette.text.primary : null
                    )
                    .transition()
                    .attr('r', d => (d.selected ? 7 : 5))
                    .attr('fill', function (d) {
                        return d.selected
                            ? '#e7298a'
                            : select(this).attr('fill');
                    })
                    .duration(1500);

                enterSelection.call(registerToolTip);

                enterSelection
                    .append('path')
                    .attr('d', 'M -15 0 A 15 15, 0, 1, 0, 0 15 L 0 0 Z')
                    .attr('fill', 'red')
                    .attr('stroke', 'black')
                    .transition()
                    .duration(700)
                    .style('opacity', d => (d.selected ? 1 : 0));

                return enterSelection;
            },
            update => update,
            exit => {
                exit.remove();
            }
        )
        //ensure selected are in "front"
        .sort(a => (a.selected ? 1 : -1));

    return bound.enter().data();
};

const updateLinkSelection = (
    linkSelection: Selection<
        SVGLineElement,
        SimulationLinkDatum<DSINode>,
        any,
        unknown
    >,
    links: SimulationLinkDatum<DSINode>[],
    theme: Theme
) => {
    return linkSelection
        .data(links, makeLinkKey)
        .join('line')
        .attr('stroke', theme.palette.text.primary);
};

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

/*  mutate the tree so it has the coorodinates from the previous simulation*/
const mapNodeSelectionData = (oldTree: DSINode, newTree: DSINode) => {
    const oldTreeMap = groupBy(
        oldTree.descendants().map(n => ({ ...n, id: getEntityId(n.data) })),
        'id'
    );

    /* these don't have ids yet */
    newTree.each(d => {
        const entry = oldTreeMap[getEntityId(d.data)][0];
        d.x = entry.x;
        d.y = entry.y;
    });

    return newTree;
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

const registerClickZoom = (
    selection: DSINodeSelection,
    svg: Selection<SVGSVGElement, unknown, any, any>
) => {
    const zoomHandler = makeDefaultZoomHandler(svg);

    const nodeZoom = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 40])
        .on('zoom', zoomHandler);

    const clickZoom = (event: MouseEvent, node: DSINode) => {
        event.stopPropagation();

        svg.transition()
            .duration(750)
            .call(
                nodeZoom.transform,
                zoomIdentity
                    .translate(0, 0)
                    .scale(7)
                    .translate(-node.x!, -node.y!)
            );
    };

    selection.on('click', clickZoom);
};

const makeDefaultZoomHandler =
    (svg: Selection<SVGSVGElement, unknown, HTMLElement, any>) =>
    ({ transform }: D3ZoomEvent<SVGSVGElement, unknown>) => {
        svg.selectAll('.container').attr('transform', transform.toString());
        svg.select('g.zoom-indicator')
            .selectAll<SVGTextElement, number>('text')
            .data([transform.k || 1])
            .join('text')
            .text(d => `Zoom: ${Math.floor(d * 100).toString()}%`)
            .attr('transform', `translate(2,15)`);
    };

const updateForceGraph = (tree: DSINode, theme: Theme) => {
    const nodeSelection = select('g.circle-container').selectAll<
        SVGGElement,
        DSINode
    >('g.circle-node');

    const selectionRootNode = nodeSelection
        .data()
        .find(n => getEntityId(n.data) === tree.id)!;

    // map coordinates from previous simulations to new data
    // mutates tree
    mapNodeSelectionData(selectionRootNode, tree);

    const linkSelection = select('g.line-container').selectAll<
        SVGLineElement,
        SimulationLinkDatum<DSINode>
    >('line');

    // build new force links (can't reuse old)
    // map to ensure that simulationNodes and their latest locations are recomputed at initialization time
    const forceLinks = buildForceLinks(tree.links()).links(
        tree.links().map(l => ({
            source: makeNodeKey(l.source),
            target: makeNodeKey(l.target),
        }))
    );

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

    // join new data to dom selection so tickHandler can read it
    updateNodeSelection(nodeSelection, tree.descendants(), theme);

    //initialize simulation (mutate forceLinks)
    const simulation = buildSimulation(tree.descendants(), forceLinks, 1000);

    registerDragHandler(
        selectAll<SVGGElement, DSINode>('g.circle-node'),
        simulation
    );

    // ensure that link selection has recalculated coordinates bound before registering tick callback
    updateLinkSelection(linkSelection, forceLinks.links(), theme);

    registerTickHandler(
        simulation,
        selectAll<SVGLineElement, SimulationLinkDatum<DSINode>>('line'),
        selectAll('g.circle-node')
    );

    return simulation;
};

const buildForceGraph = (tree: DSINode, selector: string, theme: Theme) => {
    const w = 1000;
    const h = 1000;

    const forceLinks = buildForceLinks(tree.links());

    const simulation = buildSimulation(tree.descendants(), forceLinks, w);

    const svg = select(`#${selector}`)
        .append('svg')
        .attr('class', 'main')
        .attr('viewBox', [-w / 2, -h / 2, w, h]);

    const linkSelection = svg
        .append('g')
        .attr('stroke-opacity', 0.6)
        .attr('class', 'container line-container')
        .selectAll<SVGLineElement, never>('line')
        .data(forceLinks.links())
        .attr('class', 'chart')
        .join('line')
        .attr('stroke', theme.palette.text.primary);

    const globalZoomHandler = makeDefaultZoomHandler(svg);

    /* 'global' zoom behavior, will listen on SVG and adjust scale on mouse wheel */
    const globalZoom = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 40])
        .on('zoom', globalZoomHandler);

    svg.call(globalZoom);

    svg.on('click', function () {
        const currentZoom = zoomTransform(select(this).node()!).k;
        if (currentZoom > 1) {
            svg.transition()
                .duration(1000)
                .call(
                    globalZoom.transform,
                    zoomIdentity.translate(0, 0).scale(1)
                );
        }
    });

    const nodeSelection = svg
        .append('g')
        .attr('class', 'container circle-container')
        .attr('stroke-width', 1.5)
        .selectAll<SVGGElement, DSINode>('g')
        .data(simulation.nodes(), (d, i) => (d ? makeNodeKey(d) : i))
        .join('g')
        .attr('class', 'circle-node');

    nodeSelection
        .append('circle')
        .attr('fill', d => colorScale(d.data.type))
        .attr('stroke', d => (d.children ? theme.palette.text.primary : null))
        .attr('r', 5);

    nodeSelection
        .call(registerToolTip)
        .call(registerDragHandler, simulation)
        .call(registerClickZoom, svg);

    registerTickHandler(simulation, linkSelection, nodeSelection);

    const zoomIndicator = svg
        .append('g')
        .attr('class', 'control zoom-indicator')
        .attr('transform', `translate(${w / 2 - 100}, ${-h / 2})`);

    zoomIndicator
        .append('rect')
        .attr('width', 100)
        .attr('height', 17)
        .attr('fill', 'white');

    zoomIndicator
        .append('text')
        .text('Zoom: 100%')
        .attr('transform', `translate(2, 15)`);

    svg.append('g')
        .attr('transform', `translate(${w / 2 - 100}, ${h / 2 - 130})`)
        .attr('class', 'control legend-container')
        .append('rect')
        .attr('width', '100')
        .attr('height', '130')
        .attr('fill', 'white');

    drawLegend('.legend-container');

    appendToolTip();

    return simulation;
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
