import React, { useEffect, useLayoutEffect, useState } from 'react';
import { hierarchy, HierarchyLink, HierarchyNode } from 'd3-hierarchy';
import { Selection, BaseType, select, selectAll } from 'd3-selection';
import { scaleOrdinal, scaleLinear } from 'd3-scale';
import { schemeDark2 } from 'd3-scale-chromatic';
import { D3DragEvent, drag } from 'd3-drag';
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
import { capitalize } from '../../util';

// for debugging
(window as any).d3Select = select;
(window as any).d3SelectAll = selectAll;

type DSISimulation<T> = Simulation<
    SimulationWrapper<T>,
    SimulationLinkDatum<SimulationWrapper<T>>
>;

type DSIForceLinks<T> = ForceLink<
    SimulationWrapper<T>,
    SimulationLinkDatum<SimulationWrapper<T>>
>;

type DSINodeSelection<T> = Selection<
    SVGCircleElement,
    SimulationWrapper<T>,
    BaseType,
    unknown
>;

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
    const [simulation, setSimulation] = useState<DSISimulation<DSINode>>();

    useEffect(() => {
        if (tree && chartRendered) {
            // crude check for now, soon we'll want a proper transition
            simulation!.stop();
            if (tree.descendants().length === simulation?.nodes().length) {
                setSimulation(updateForceGraph(tree));
            } else {
                select('svg').remove();
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
    'person',
    'program',
    'unit',
];

const colorScale = scaleOrdinal(
    schemeDark2.filter((_, i) => ![3, 4].includes(i)) //remove red, since that's our highlight color
).domain(entityTypes);

interface DSINode extends Record<string, any>, HierarchyNode<ModelEntity> {
    selected?: boolean;
}

/* for any data to be annotated with coordinates by forceLink/simulation, we need to extend these interfaces */
interface SimulationWrapper<T> extends HierarchyNode<T>, SimulationNodeDatum {}

/**
 *  Unique key used to identify nodes for d3.join process and mapping simulation links to source/target
 */
const makeNodeKey = (datum: SimulationWrapper<DSINode>) =>
    `${datum.data.id}-${datum.data.data.type}-${datum.parent?.data.data.id}-${datum.data.data.relationship}-${datum.data.selected}`;

/**
 *  Unique key used to identify links for d3.join process
 */
const makeLinkKey = <T extends DSINode>(
    link: SimulationLinkDatum<SimulationWrapper<T>>
) => {
    const source = link.source as SimulationWrapper<T>;
    const target = link.target as SimulationWrapper<T>;
    return `${source.data.id}-${source.parent?.id}-${target.data.selected}-${target.data.data.id}`;
};

/* rough scales for now */
const decayScale = scaleLinear().domain([0, 400]).range([0.01, 0.7]);
const distanceScale = scaleLinear().domain([0, 400]).range([30, 5]);

// todo: add pixel count
const buildSimulation = <T,>(
    nodes: HierarchyNode<T>[],
    forceLinks: DSIForceLinks<T>
) =>
    forceSimulation<SimulationWrapper<T>>(nodes)
        .force(
            'd',
            forceLinks.distance(distanceScale(nodes.length)).strength(1)
        )
        .force('charge', forceManyBody().strength(-10))
        .force('collision', forceCollide().radius(5))
        .force('center', forceCenter())
        .velocityDecay(decayScale(nodes.length));

const buildUpdateSimulation = <T,>(
    nodes: HierarchyNode<T>[],
    forceLinks: DSIForceLinks<T>
) => {
    return forceSimulation<SimulationWrapper<T>>(nodes)
        .force('d', forceLinks)
        .force('charge', forceManyBody().strength(-21))
        .force('collision', forceCollide().radius(7.5))
        .force('center', forceCenter().strength(0.05))
        .velocityDecay(0.9);
};

const buildForceLinks = <T extends DSINode>(links: HierarchyLink<T>[]) =>
    forceLink<SimulationWrapper<T>, SimulationLinkDatum<SimulationWrapper<T>>>(
        links
    )
        .id(model => makeNodeKey(model))
        .distance(12)
        .strength(1);

/**
 *  Update nodes and return enter selection data for use by caller
 */
const updateNodeSelection = <T extends DSINode>(
    nodeSelection: DSINodeSelection<T>,
    nodes: SimulationWrapper<T>[]
) => {
    const bound = nodeSelection.data(nodes, d => makeNodeKey(d));

    bound.join(
        enter => {
            const enterSelection = enter
                .append('circle')
                .attr('fill', d => colorScale(d.data.data.type))
                .attr('stroke', d => (d.children ? null : '#fff'))
                .call(registerToolTip);

            enterSelection
                .transition()
                .attr('r', d => (d.data.selected ? 10 : 5))
                .attr('fill', function (d) {
                    return d.data.selected ? 'red' : select(this).attr('fill');
                })
                .duration(1500);

            return enterSelection;
        },
        update => update,
        exit => {
            exit.transition().attr('r', 0).duration(1500).remove();
        }
    );

    return bound.enter().data();
};

const updateLinkData = <T extends DSINode>(
    linkSelection: Selection<
        SVGLineElement,
        SimulationLinkDatum<SimulationWrapper<T>>,
        any,
        unknown
    >,
    links: SimulationLinkDatum<SimulationWrapper<T>>[]
) => {
    return linkSelection
        .data(links, makeLinkKey)
        .join('line', enter => {
            enter.transition().duration(1000);
            return enter.selection();
        })
        .attr('stroke', 'black');
};

const registerTickHandler = <T extends DSINode>(
    simulation: DSISimulation<T>,
    linkSelection: Selection<
        SVGLineElement,
        SimulationLinkDatum<SimulationWrapper<DSINode>>,
        BaseType,
        unknown
    >,
    nodeSelection: Selection<
        SVGCircleElement,
        SimulationWrapper<T>,
        BaseType,
        unknown
    >
) => {
    // simulation mutates data bound to nodes by reference
    simulation.on('tick', () => {
        nodeSelection.attr('cx', d => d.x!).attr('cy', d => d.y!);

        linkSelection
            .attr('x1', d => (d.source as SimulationWrapper<DSINode>).x!)
            .attr('y1', d => (d.source as SimulationWrapper<DSINode>).y!)
            .attr('x2', d => (d.target as SimulationWrapper<DSINode>).x!)
            .attr('y2', d => (d.target as SimulationWrapper<DSINode>).y!);
    });
};

/*  mutate the tree so it has the coorodinates from the previous simulation*/
const mapNodeSelectionData = (
    selectionRoot: SimulationWrapper<DSINode>,
    tree: SimulationWrapper<DSINode>
): SimulationWrapper<DSINode> => {
    tree.x = selectionRoot.x;
    tree.y = selectionRoot.y;
    if (tree.children && selectionRoot.children) {
        for (let i = 0; i < tree.children.length; i++) {
            mapNodeSelectionData(selectionRoot.children[i], tree.children[i]);
        }
    }
    return tree;
};

const registerToolTip = <T extends DSINode>(selection: DSINodeSelection<T>) => {
    selection
        .on('mouseover', (d: MouseEvent) => showToolTip(d))
        .on('mouseout', () => hideToolTip());
};

const showToolTip = (e: MouseEvent) => {
    select('.tooltip')
        .text((e!.target as any).__data__.data.data.name)
        .style('visibility', 'visible')
        .style('left', `${e.pageX + 15}px`)
        .style('top', `${e.pageY - 25}px`);
};

const hideToolTip = () => {
    select('.tooltip').style('visibility', 'hidden');
};

const registerDragHandler = <T extends DSINode>(
    selection: DSINodeSelection<T>,
    simulation: DSISimulation<T>
) => {
    const dragstarted = (
        e: D3DragEvent<SVGCircleElement, T, unknown>,
        d: SimulationWrapper<T>
    ) => {
        simulation.alphaTarget(0.1).restart();
        d.fx = d.x;
        d.fy = d.y;
    };

    const dragged = (
        e: D3DragEvent<SVGCircleElement, T, unknown>,
        d: SimulationWrapper<T>
    ) => {
        d.fx = e.x;
        d.fy = e.y;
    };

    const dragended = (
        e: D3DragEvent<SVGCircleElement, T, unknown>,
        d: SimulationWrapper<T>
    ) => {
        if (!e.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    };

    const handler = drag<SVGCircleElement, SimulationWrapper<T>>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);

    return handler(selection);
};

const updateForceGraph = (tree: DSINode) => {
    const nodes = hierarchy(tree);

    const nodeSelection = select('g.circle-container').selectAll<
        SVGCircleElement,
        SimulationWrapper<DSINode>
    >('circle');

    const selectionRootNode = nodeSelection.data().find(n => !n.parent)!;

    //map coordinates from previous simulations to new data
    const newRoot = mapNodeSelectionData(selectionRootNode, nodes);

    const linkSelection = select('g.line-container').selectAll<
        SVGLineElement,
        SimulationLinkDatum<SimulationWrapper<DSINode>>
    >('line');

    const simulationNodes = newRoot.descendants();

    // build new force links (can't reuse old)
    // map to ensure that simulationNodes and their latest locations are recomputed at initialization time
    const forceLinks = buildForceLinks(newRoot.links()).links(
        newRoot.links().map(l => ({
            source: makeNodeKey(l.source),
            target: makeNodeKey(l.target),
        }))
    );

    // bind new data to dom selection so tickHandler can read it
    updateNodeSelection(nodeSelection, simulationNodes);

    //initialize simulation (mutate forceLinks)
    const simulation = buildUpdateSimulation(simulationNodes, forceLinks);

    registerDragHandler(
        selectAll<SVGCircleElement, SimulationWrapper<DSINode>>('circle'),
        simulation
    );

    // ensure that link selection has recalculated coordinates bound before registering tick callback
    updateLinkData(linkSelection, forceLinks.links());

    registerTickHandler(
        simulation,
        selectAll<
            SVGLineElement,
            SimulationLinkDatum<SimulationWrapper<DSINode>>
        >('line'),
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
    const root = hierarchy(tree);
    const links = root.links();
    const nodes = root.descendants();

    const forceLinks = buildForceLinks(links);

    const simulation = buildSimulation(nodes, forceLinks);

    const svg = select(`#${selector}`)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [-width / 2, -height / 2, width, height]);

    const linkSelection = svg
        .append('g')
        .attr('stroke-opacity', 0.6)
        .attr('class', 'line-container')
        .selectAll<SVGLineElement, never>('line')
        .data(forceLinks.links())
        .join('line')
        .attr('stroke', 'black');

    const nodeSelection = svg
        .append('g')
        .attr('class', 'circle-container')
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5)
        .selectAll<SVGCircleElement, never>('circle')
        .data(simulation.nodes(), (d, i) => (d ? makeNodeKey(d) : i))
        .join('circle')
        .attr('fill', d => colorScale(d.data.data.type))
        .attr('stroke', d => (d.children ? null : '#fff'))
        .attr('r', 5)
        .call(registerToolTip)
        .call(registerDragHandler, simulation);

    registerTickHandler(simulation, linkSelection, nodeSelection);

    drawLegend(height, width);

    appendToolTip();

    return simulation;
};

const drawLegend = (h: number, w: number) => {
    const svg = select('svg');

    svg.selectAll('g.legend')
        .data(colorScale.domain())
        .join('g')
        .attr('transform', (_, i) => `translate(${w / 2 - 80}, ${i * 20})`)
        .attr('class', 'legend')
        .append('circle')
        .attr('r', 5)
        .attr('fill', d => colorScale(d));

    svg.selectAll<BaseType, string>('g.legend')
        .append('text')
        .text((d: string) => capitalize(d))
        .attr('transform', `translate(12, 5)`);
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
