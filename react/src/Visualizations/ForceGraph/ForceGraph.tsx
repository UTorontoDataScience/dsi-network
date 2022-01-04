import { hierarchy, HierarchyLink, HierarchyNode } from 'd3-hierarchy';
import { select, selectAll, Selection } from 'd3-selection';
import { scaleOrdinal } from 'd3-scale';
import { schemeDark2 } from 'd3-scale-chromatic';
import 'd3-transition'; // must be imported so selection.transition will resolve

import {
    forceSimulation,
    forceLink,
    forceManyBody,
    forceX,
    forceY,
    SimulationLinkDatum,
    SimulationNodeDatum,
    ForceLink,
    Simulation,
} from 'd3-force';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
    EntityType,
    HierarchicalNode,
    HydratedLink,
    ModelEntity,
    Relationship,
} from '../../data/model';

// for debugging
(window as any).d3Select = select;
(window as any).d3SelectAll = selectAll;

export interface SelectedModel {
    type: EntityType;
    id: number;
}

interface ForceGraphProps {
    links: HydratedLink[];
    rootModel: ModelEntity;
    rootModelType: EntityType;
    selectedModels?: SelectedModel[];
}

const ForceGraph: React.FC<ForceGraphProps> = ({
    links,
    rootModel,
    rootModelType,
    selectedModels,
}) => {
    const [chartRendered, setChartRendered] = useState(false);
    // we need to manually stop the simulation to prevent memory leaks from the tick event
    const [simulation, setSimulation] = useState<Simulation<any, any>>();

    const tree = useMemo(() => {
        return buildTree(
            rootModel,
            rootModelType,
            'root',
            links,
            selectedModels
        );
    }, [links, rootModel, rootModelType, selectedModels]);

    useEffect(() => {
        if (tree && chartRendered && selectedModels) {
            simulation!.stop();
            setSimulation(updateForceGraph(tree));
        }
    }, [selectedModels]);

    useLayoutEffect(() => {
        if (tree && !chartRendered) {
            setSimulation(buildForceGraph(tree, 'test', 1000, 700));
            setChartRendered(true);
        }
    }, [chartRendered, tree]);

    return <span id="test" />;
};

const buildTree = (
    root: ModelEntity,
    rootType: EntityType,
    relationship: Relationship | 'root',
    links: HydratedLink[],
    selected = [] as SelectedModel[]
): ForceNode => {
    const childLinks = links.filter(
        l => l.parentType === rootType && l.parent.id === root.id
    );

    return {
        entity: root,
        relationToParent: relationship,
        selected: !!selected.find(s => s.id === root.id && s.type === rootType),
        type: rootType,
        children: [
            ...childLinks.map(c =>
                buildTree(c.child, c.childType, c.relationship, links, selected)
            ),
        ],
    };
};

const entityTypes: EntityType[] = [
    'campus',
    'division',
    'person',
    'program',
    'unit',
];

const colorScale = scaleOrdinal(
    schemeDark2.filter((_, i) => i !== 3) //remove red, since that's our highlight color
).domain(entityTypes);

interface ForceNode extends HierarchicalNode {
    selected?: boolean;
}

/* for correct tying for data annotated with coordinates by forceLink/simulation, we need to extend these interfaces */
interface ForceNodeSimulationWrapper<T>
    extends HierarchyNode<T>,
        SimulationNodeDatum {}
interface ForceLinkSimulationWrapper<T> extends SimulationLinkDatum<T> {}

/**
 *  Unique key used to identify nodes for d3.join process and mapping simulation links to source/target
 */
const makeNodeKey = (datum: ForceNodeSimulationWrapper<ForceNode>) =>
    `${datum.data.entity.id}-${datum.data.type}-${datum.parent?.data.entity.id}-${datum.data.relationToParent}-${datum.data.selected}`;

/**
 *  Unique key used to identify links for d3.join process
 */
const makeLinkKey = <T extends ForceNode>(
    link: ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<T>>
) => {
    const source = link.source as ForceNodeSimulationWrapper<T>;
    const target = link.target as ForceNodeSimulationWrapper<T>;
    return `${source.data.entity.id}-${source.parent?.id}-${target.data.selected}-${target.data.entity.id}`;
};

const buildSimulation = <T,>(
    nodes: HierarchyNode<T>[],
    forceLinks: ForceLink<
        ForceNodeSimulationWrapper<T>,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<T>>
    >
) =>
    forceSimulation<ForceNodeSimulationWrapper<T>>(nodes)
        .force('d', forceLinks)
        //decreasing strength while increasing decay will create larger graphic (possibly overflowing)
        .force('charge', forceManyBody().strength(-20))
        .force('x', forceX())
        .force('y', forceY())
        //higher is slower, default is .4
        .velocityDecay(0.5);

const buildUpdateSimulation = <T,>(
    nodes: HierarchyNode<T>[],
    forceLinks: ForceLink<
        ForceNodeSimulationWrapper<T>,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<T>>
    >
) => {
    return (
        forceSimulation<ForceNodeSimulationWrapper<T>>(nodes)
            .force('d', forceLinks.strength(1))
            //decreasing strength while increasing decay will create larger graphic (possibly overflowing)
            .force('charge', forceManyBody().strength(-20))
            //note that we ought to pass in array of nodes and function
            //higher is faster, default is .4
            .velocityDecay(0.7)
    );
};

const buildForceLinks = <T extends ForceNode>(links: HierarchyLink<T>[]) =>
    forceLink<
        ForceNodeSimulationWrapper<T>,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<T>>
    >(links)
        .id(model => makeNodeKey(model))
        .distance(5)
        .strength(1);

/**
 *  Update nodes and return enter selection for use by caller
 */
const updateNodeData = <T extends ForceNode>(
    nodeSelection: Selection<
        SVGCircleElement,
        ForceNodeSimulationWrapper<T>,
        any,
        any
    >,
    nodes: ForceNodeSimulationWrapper<T>[]
) => {
    const bound = nodeSelection.data(nodes, d => makeNodeKey(d));

    bound.join(enter => {
        const enterSelection = enter
            .append('circle')
            .attr('fill', d => colorScale(d.data.entity.type))
            .attr('stroke', d => (d.children ? null : '#fff'))
            .attr('r', 3.5);

        enterSelection
            .transition()
            .attr('r', d => (d.data.selected ? 5 : 3.5))
            .attr('fill', function (d) {
                return d.data.selected ? 'red' : select(this).attr('fill');
            })
            .duration(500);
        //append separately so it doesn't get returned
        enterSelection.append('title').text(d => d.data.entity.name);

        return enterSelection;
    });

    return bound.enter().data();
};

const updateLinkData = <T extends ForceNode>(
    linkSelection: Selection<
        SVGLineElement,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<T>>,
        any,
        any
    >,
    links: ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<T>>[]
) => {
    return linkSelection
        .data(links, makeLinkKey)
        .join('line', enter => {
            enter.transition().duration(1000);
            return enter.selection();
        })
        .attr('stroke', 'black');
};

const registerTickHandler = <
    T extends ForceNode,
    L extends ForceNodeSimulationWrapper<T>
>(
    simulation: Simulation<
        ForceNodeSimulationWrapper<T>,
        ForceLinkSimulationWrapper<L>
    >,
    linkSelection: Selection<
        SVGLineElement,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<ForceNode>>,
        SVGGElement,
        unknown
    >,
    nodeSelection: Selection<
        SVGCircleElement,
        ForceNodeSimulationWrapper<T>,
        any,
        any
    >
) => {
    // simulation mutates data bound to nodes by reference
    // at each tick, update the element with the new value
    simulation.on('tick', () => {
        nodeSelection.attr('cx', d => d.x!).attr('cy', d => d.y!);

        linkSelection
            .attr(
                'x1',
                d => (d.source as ForceNodeSimulationWrapper<ForceNode>).x!
            )
            .attr(
                'y1',
                d => (d.source as ForceNodeSimulationWrapper<ForceNode>).y!
            )
            .attr(
                'x2',
                d => (d.target as ForceNodeSimulationWrapper<ForceNode>).x!
            )
            .attr(
                'y2',
                d => (d.target as ForceNodeSimulationWrapper<ForceNode>).y!
            );
    });
};

/* we're going to mutate the tree so it has the coorodinates from the previous simulation*/
const mapNodeSelectionData = (
    selectionRoot: ForceNodeSimulationWrapper<ForceNode>,
    tree: ForceNodeSimulationWrapper<ForceNode>
): ForceNodeSimulationWrapper<ForceNode> => {
    //probably don't need these first two
    tree.x = selectionRoot.x;
    tree.y = selectionRoot.y;
    if (tree.children && selectionRoot.children) {
        for (let i = 0; i < tree.children.length; i++) {
            mapNodeSelectionData(selectionRoot.children[i], tree.children[i]);
        }
    }
    return tree;
};

const updateForceGraph = (tree: ForceNode) => {
    const nodes = hierarchy(tree);

    const nodeSelection = select('g.circle-container').selectAll(
        'circle'
    ) as Selection<
        SVGCircleElement,
        ForceNodeSimulationWrapper<ForceNode>,
        any,
        any
    >;

    const selectionRootNode = nodeSelection.data().find(n => !n.parent)!;

    //map coordinates from previous simulations to new data
    const newRoot = mapNodeSelectionData(selectionRootNode, nodes);

    const linkSelection = select('g.line-container').selectAll(
        'line'
    ) as Selection<
        SVGLineElement,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<ForceNode>>,
        any,
        any
    >;

    //fix positions of all but new nodes -- we don't need sim for this, can just get it from enter nodes
    const nodeMap = nodeSelection
        .data()
        .reduce(
            (acc, curr) => ({ ...acc, [makeNodeKey(curr)]: curr }),
            {} as { [key: string]: any }
        );

    const simulationNodes =
        newRoot.descendants() as ForceNodeSimulationWrapper<ForceNode>[];

    // bind new data to dom selection so tickHandler can read it
    const enterNodes = updateNodeData(nodeSelection, simulationNodes);

    // for selected parent nodes, add its children to the simulation but not the node itself
    // for selected child nodes, add siblings to the the simulation

    const enterNodeParentKeys = enterNodes
        .filter(en => en.parent)
        .map(en => makeNodeKey(en.parent!));

    simulationNodes.forEach(nn => {
        const key = makeNodeKey(nn);

        if (
            (!!nodeMap[key] && nodeMap[key]?.children) ||
            (!!nodeMap[key] &&
                !enterNodeParentKeys.includes(
                    makeNodeKey(nodeMap[key]?.parent)
                ))
        ) {
            nn.fx = nodeMap[key].x;
            nn.fy = nodeMap[key].y;
        }
    });

    // build new force links (can't reuse old)
    // map to ensure that simulationNodes and their latest locations are looked up at initialization time
    // (init time is when data is updated/mutated)
    const forceLinks = buildForceLinks(newRoot.links()).links(
        newRoot.links().map(l => ({
            source: makeNodeKey(l.source),
            target: makeNodeKey(l.target),
        }))
    );

    //initialize simulation (mutate forceLinks)
    const simulation = buildUpdateSimulation(simulationNodes, forceLinks);

    // ensure that link selection has recalculated coordinates bound before registering tick callback
    updateLinkData(linkSelection, forceLinks.links());

    registerTickHandler(
        simulation,
        selectAll('line') as any,
        selectAll('circle')
    );

    return simulation;
};

const buildForceGraph = (
    tree: ForceNode,
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
        .selectAll('line')
        .data(forceLinks.links())
        .join('line')
        .attr('stroke', 'black') as Selection<
        SVGLineElement,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<ForceNode>>,
        any,
        any
    >;

    const nodeSelection = svg
        .append('g')
        .attr('class', 'circle-container')
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5)
        .selectAll('circle')
        .data(
            simulation.nodes(),
            (d: ForceNodeSimulationWrapper<ForceNode> | unknown, i) =>
                d ? makeNodeKey(d as ForceNodeSimulationWrapper<ForceNode>) : i
        )
        .join('circle')
        .attr('fill', d => colorScale(d.data.entity.type))
        .attr('stroke', d => (d.children ? null : '#fff'))
        .attr('r', 3.5) as Selection<
        SVGCircleElement,
        ForceNodeSimulationWrapper<ForceNode>,
        SVGGElement,
        unknown
    >;

    nodeSelection.append('title').text(d => d.data.entity.name);

    registerTickHandler(simulation, linkSelection, nodeSelection);

    return simulation;
};

export default ForceGraph;
