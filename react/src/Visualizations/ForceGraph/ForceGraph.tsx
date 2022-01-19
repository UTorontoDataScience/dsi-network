import React, { useEffect, useLayoutEffect, useState } from 'react';
import { max } from 'd3-array';
import { schemeDark2 } from 'd3-scale-chromatic';
import { D3DragEvent, drag } from 'd3-drag';
import { HierarchyLink, HierarchyNode } from 'd3-hierarchy';
import { scaleOrdinal, scaleLinear } from 'd3-scale';
import { Selection, BaseType, select, selectAll } from 'd3-selection';
import { Transition } from 'd3-transition';
import { D3ZoomEvent, zoom, zoomIdentity } from 'd3-zoom';
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
import { EntityType, ModelEntity } from '../../data/model';
import { capitalize, getEntityId, groupBy } from '../../util';

// for debugging
(window as any).d3Select = select;
(window as any).d3SelectAll = selectAll;

type DSISimulation = Simulation<DSINode, SimulationLinkDatum<DSINode>>;

type DSIForceLinks = ForceLink<DSINode, SimulationLinkDatum<DSINode>>;

type DSINodeSelection = Selection<SVGCircleElement, DSINode, BaseType, unknown>;

export interface SelectedModel {
    type: EntityType;
    id: number;
}
interface ForceGraphProps {
    tree: HierarchyNode<ModelEntity>;
}

const ForceGraph: React.FC<ForceGraphProps> = ({ tree }) => {
    const [chartRendered, setChartRendered] = useState(false);
    // we need to manually stop the simulation to prevent memory leaks from the tick event
    const [simulation, setSimulation] = useState<DSISimulation>();

    useEffect(() => {
        if (tree && chartRendered) {
            // crude check for now, soon we'll want a proper transition
            simulation!.stop();
            if (tree.descendants().length === simulation?.nodes().length) {
                setSimulation(updateForceGraph(tree));
            } else {
                selectAll('svg').remove();
                setSimulation(buildForceGraph(tree, 'test', 1000, 700));
            }
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps  */
    }, [tree]);

    useLayoutEffect(() => {
        if (tree && !chartRendered) {
            setSimulation(buildForceGraph(tree, 'test', 1000, 700));
            setChartRendered(true);
        }
    }, [chartRendered, tree]);

    return <span id="test" />;
};

const entityTypes: EntityType[] = [
    'campus',
    'division',
    'institution',
    'person',
    'program',
    'unit',
];

const colorScale = scaleOrdinal(
    schemeDark2.filter((_, i) => ![3, 4].includes(i)) //remove red, since that's our highlight color
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

/* rough scales for now */
const decayScale = scaleLinear().domain([0, 1000]).range([0.01, 0.9]);
const distanceScale = scaleLinear().domain([0, 1000]).range([30, 10]);

// todo: add pixel count
const buildSimulation = (nodes: DSINode[], forceLinks: DSIForceLinks) =>
    forceSimulation<DSINode>(nodes)
        .force(
            'd',
            forceLinks.distance(distanceScale(nodes.length)).strength(1)
        )
        .force('charge', forceManyBody().strength(-9))
        .force('collision', forceCollide().radius(6))
        .force('center', forceCenter())
        .velocityDecay(decayScale(nodes.length));

const buildForceLinks = (links: HierarchyLink<ModelEntity>[]) =>
    forceLink<DSINode, SimulationLinkDatum<DSINode>>(links).id(model =>
        makeNodeKey(model)
    );

/**
 *  Update nodes and return enter selection data for use by caller
 */
const updateNodeSelection = (
    nodeSelection: DSINodeSelection,
    nodes: DSINode[]
) => {
    const bound = nodeSelection.data(nodes, d => makeNodeKey(d));

    bound
        .join(
            enter => {
                const enterSelection = enter
                    .append('circle')
                    .attr('fill', d => colorScale(d.data.type))
                    .attr('stroke', d => (d.children ? null : '#fff'))
                    .call(registerToolTip);

                enterSelection
                    .transition()
                    .attr('r', d => (d.selected ? 7 : 5))
                    .attr('fill', function (d) {
                        return d.selected
                            ? '#e7298a'
                            : select(this).attr('fill');
                    })
                    .duration(1500);

                return enterSelection;
            },
            update => update,
            exit => {
                exit.transition().attr('r', 0).duration(1500).remove();
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
    links: SimulationLinkDatum<DSINode>[]
) => {
    return linkSelection
        .data(links, makeLinkKey)
        .join('line', enter => {
            enter.transition().duration(1000);
            return enter.selection();
        })
        .attr('stroke', 'black');
};

const registerTickHandler = (
    simulation: DSISimulation,
    linkSelection: Selection<
        SVGLineElement,
        SimulationLinkDatum<DSINode>,
        BaseType,
        unknown
    >,
    nodeSelection: Selection<SVGCircleElement, DSINode, BaseType, unknown>
) => {
    // simulation mutates data bound to nodes by reference
    simulation.on('tick', () => {
        nodeSelection.attr('cx', d => d.x!).attr('cy', d => d.y!);

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

    const handler = drag<SVGCircleElement, DSINode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);

    return handler(selection);
};

const registerClickZoom = (
    selection: DSINodeSelection,
    svg: Selection<SVGSVGElement, unknown, any, any>,
    w: number
) => {
    const zoomHandler = ({ transform }: D3ZoomEvent<SVGSVGElement, unknown>) =>
        svg.selectAll('.container').attr('transform', transform.toString());

    const nodeZoom = zoom<SVGSVGElement, DSINode>()
        .scaleExtent([0.5, 40])
        .on('zoom', zoomHandler);

    const clickZoom = (event: MouseEvent, node: DSINode) => {
        event.stopPropagation();

        let zoomNode = node;
        while (zoomNode.descendants().length <= 5 && zoomNode.parent) {
            zoomNode = zoomNode.parent;
        }

        (
            svg.transition().duration(750) as Transition<
                SVGSVGElement,
                DSINode,
                any,
                unknown
            >
        ).call(
            nodeZoom.transform,
            zoomIdentity
                .translate(0, 0)
                .scale(getScale(zoomNode, w))
                .translate(-zoomNode.x!, -zoomNode.y!)
        );
    };

    const getScale = (node: DSINode, w: number) => {
        const radius = max(node.descendants(), n =>
            Math.sqrt((node.x! - n.x!) ** 2 + (node.y! - n.y!) ** 2)
        )!;

        return w / (radius * 3);
    };

    selection.on('click', clickZoom);
};

const updateForceGraph = (tree: DSINode) => {
    const nodeSelection = select('g.circle-container').selectAll<
        SVGCircleElement,
        DSINode
    >('circle');

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
    updateNodeSelection(nodeSelection, tree.descendants());

    //initialize simulation (mutate forceLinks)
    const simulation = buildSimulation(tree.descendants(), forceLinks);

    registerDragHandler(
        selectAll<SVGCircleElement, DSINode>('circle'),
        simulation
    );

    // ensure that link selection has recalculated coordinates bound before registering tick callback
    updateLinkSelection(linkSelection, forceLinks.links());

    registerTickHandler(
        simulation,
        selectAll<SVGLineElement, SimulationLinkDatum<DSINode>>('line'),
        selectAll('circle')
    );

    return simulation;
};

const buildForceGraph = (
    tree: DSINode,
    selector: string,
    width: number,
    height: number
) => {
    const forceLinks = buildForceLinks(tree.links());

    const simulation = buildSimulation(tree.descendants(), forceLinks);

    const legendWidth = 120;

    /* main svg */

    const mainWidth = width - legendWidth;

    const svg = select(`#${selector}`)
        .append('svg')
        .attr('class', 'main')
        .attr('width', width - legendWidth)
        .attr('height', height)
        .attr('viewBox', [-mainWidth / 2, -height / 2, mainWidth, height]);

    /* legend */
    select(`#${selector}`)
        .append('svg')
        .attr('class', 'legend-container')
        .attr('width', 80)
        .attr('height', height)
        .attr('viewBox', [-40, -height / 2, 80, height]);

    const linkSelection = svg
        .append('g')
        .attr('stroke-opacity', 0.6)
        .attr('class', 'container line-container')
        .selectAll<SVGLineElement, never>('line')
        .data(forceLinks.links())
        .attr('class', 'chart')
        .join('line')
        .attr('stroke', 'black');

    const globalZoomHandler = ({
        transform,
    }: D3ZoomEvent<SVGSVGElement, unknown>) =>
        svg.selectAll('.container').attr('transform', transform.toString());

    /* 'global' zoom behavior, will listen on SVG and enlarge container on mouse wheel */
    const globalZoom = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 40])
        .on('zoom', globalZoomHandler);

    svg.call(globalZoom);

    const nodeSelection = svg
        .append('g')
        .attr('class', 'container circle-container')
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5)
        .selectAll<SVGCircleElement, never>('circle')
        .data(simulation.nodes(), (d, i) => (d ? makeNodeKey(d) : i))
        .join('circle')
        .attr('class', 'chart')
        .attr('fill', d => colorScale(d.data.type))
        .attr('stroke', d => (d.children ? null : '#fff'))
        .attr('r', 5)
        .call(registerToolTip)
        .call(registerDragHandler, simulation)
        .call(registerClickZoom, svg, mainWidth);

    registerTickHandler(simulation, linkSelection, nodeSelection);

    drawLegend('.legend-container', legendWidth);

    appendToolTip();

    return simulation;
};

const drawLegend = (selector: string, w: number) => {
    const svg = select(selector);

    svg.selectAll('g.legend')
        .data(colorScale.domain())
        .join('g')
        .attr('transform', (_, i) => `translate(-${w / 2 - 25}, ${i * 20})`)
        .attr('class', 'legend')
        .append('circle')
        .attr('r', 3)
        .attr('fill', d => colorScale(d));

    svg.selectAll<BaseType, string>('g.legend')
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
