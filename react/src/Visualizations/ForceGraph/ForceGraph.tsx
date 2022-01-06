import { hierarchy, HierarchyLink, HierarchyNode } from 'd3-hierarchy';
import { BaseType, select, selectAll, Selection } from 'd3-selection';
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
    schemeDark2.filter((_, i) => ![3, 4].includes(i)) //remove red, since that's our highlight color
).domain(entityTypes);

interface ForceNode extends HierarchicalNode {
    selected?: boolean;
}

/* for correct tying for data to be annotated with coordinates by forceLink/simulation, we need to extend these interfaces */
interface ForceNodeSimulationWrapper<T>
    extends HierarchyNode<T>,
        SimulationNodeDatum {}
interface ForceLinkSimulationWrapper<T> extends SimulationLinkDatum<T> {}

/**
 *  Unique key used to identify nodes for d3.join process and mapping simulation links to source/target
 */
const makeNodeKey = (datum: ForceNodeSimulationWrapper<ForceNode>) =>
    `${datum.data.entity.id}-${datum.data.type}-${datum.parent?.data.entity.id}-${datum.data.relationToParent}-${datum.data.selected}`;

/* For when we want to identify a node but don't care about selection state   */
const makeNodeKeyIgnoreSelected = (
    datum: ForceNodeSimulationWrapper<ForceNode>
) =>
    `${datum.data.entity.id}-${datum.data.type}-${datum.parent?.data.entity.id}-${datum.data.relationToParent}`;

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
        .force('charge', forceManyBody().strength(-50))
        .force('x', forceX())
        .force('y', forceY())
        //higher is slower, default is .4
        .velocityDecay(0.4);

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
            .force('charge', forceManyBody().strength(-50))
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
        .distance(12)
        .strength(1);

/**
 *  Update nodes and return enter selection for use by caller
 */
const updateNodeSelection = <T extends ForceNode>(
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
            .attr('r', 5)
            .call(registerToolTip);

        enterSelection
            .transition()
            .attr('r', d => (d.data.selected ? 10 : 5))
            .attr('fill', function (d) {
                return d.data.selected ? 'red' : select(this).attr('fill');
            })
            .duration(1500);

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
        BaseType,
        unknown
    >,
    nodeSelection: Selection<
        SVGCircleElement,
        ForceNodeSimulationWrapper<T>,
        BaseType,
        unknown
    >
) => {
    // simulation mutates data bound to nodes by reference
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

/*  mutate the tree so it has the coorodinates from the previous simulation*/
const mapNodeSelectionData = (
    selectionRoot: ForceNodeSimulationWrapper<ForceNode>,
    tree: ForceNodeSimulationWrapper<ForceNode>
): ForceNodeSimulationWrapper<ForceNode> => {
    tree.x = selectionRoot.x;
    tree.y = selectionRoot.y;
    if (tree.children && selectionRoot.children) {
        for (let i = 0; i < tree.children.length; i++) {
            mapNodeSelectionData(selectionRoot.children[i], tree.children[i]);
        }
    }
    return tree;
};

const registerToolTip = <T extends ForceNode>(
    selection: Selection<
        SVGCircleElement,
        ForceNodeSimulationWrapper<T>,
        SVGGElement,
        unknown
    >
) => {
    selection
        .on('mouseover', (d: MouseEvent) => showToolTip(d))
        .on('mouseout', (d: MouseEvent) => hideToolTip(d));
};

const showToolTip = (e: MouseEvent) => {
    select('.tooltip')
        .text((e!.target as any).__data__.data.entity.name)
        .style('visibility', 'visible')
        .style('left', `${e.pageX}px`)
        .style('top', `${e.pageY - 25}px`);
};

const hideToolTip = (e: MouseEvent) => {
    select('.tooltip').style('visibility', 'hidden');
};

const updateForceGraph = (tree: ForceNode) => {
    const nodes = hierarchy(tree);

    const nodeSelection = select('g.circle-container').selectAll<
        SVGCircleElement,
        ForceNodeSimulationWrapper<ForceNode>
    >('circle');

    const selectionRootNode = nodeSelection.data().find(n => !n.parent)!;

    //map coordinates from previous simulations to new data
    const newRoot = mapNodeSelectionData(selectionRootNode, nodes);

    const linkSelection = select('g.line-container').selectAll<
        SVGLineElement,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<ForceNode>>
    >('line');

    //fix positions of all but new nodes
    const nodeMap = nodeSelection
        .data()
        .reduce<Record<string, ForceNodeSimulationWrapper<ForceNode>>>(
            (acc, curr) => ({
                ...acc,
                [makeNodeKeyIgnoreSelected(curr)]: curr,
            }),
            {}
        );

    const simulationNodes = newRoot.descendants();

    // bind new data to dom selection so tickHandler can read it
    // todo: set all children of any selected parent as selected (can do this in parent )
    const enterNodes = updateNodeSelection(nodeSelection, simulationNodes);

    const enterNodeKeys = enterNodes.map(n => makeNodeKeyIgnoreSelected(n));

    const enterNodeParentKeys = enterNodes
        .filter(en => en.parent)
        .map(en => makeNodeKeyIgnoreSelected(en.parent!));

    // need a recursive solution here...
    const enterNodeChildKeys = enterNodes
        .filter(en => !!en.children)
        .flatMap(en => en.children!.map(makeNodeKeyIgnoreSelected));

    // for enter parent nodes, add its leaves to the simulation but not the node itself
    // for enter leaf nodes, add siblings to the the simulation
    // add enter leaf nodes to the simulation
    simulationNodes.forEach(nn => {
        const key = makeNodeKeyIgnoreSelected(nn);
        if (
            nodeMap[key]?.children ||
            (!enterNodeChildKeys.includes(key) &&
                !enterNodeKeys.includes(key) &&
                !(
                    nodeMap[key]?.parent &&
                    enterNodeParentKeys.includes(
                        makeNodeKeyIgnoreSelected(nodeMap[key].parent!)
                    )
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
        selectAll<
            SVGLineElement,
            ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<ForceNode>>
        >('line'),
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
        .attr('fill', d => colorScale(d.data.entity.type))
        .attr('stroke', d => (d.children ? null : '#fff'))
        .attr('r', 5)
        .call(registerToolTip);

    registerTickHandler(simulation, linkSelection, nodeSelection);

    drawLegend(height, width);

    buildToolTip();

    return simulation;
};

const drawLegend = (h: number, w: number) => {
    const svg = select('svg');

    svg.selectAll('g.legend')
        .data(colorScale.domain())
        .join('g')
        .attr('transform', (_, i) => `translate(${w / 2 - 75}, ${i * 20})`)
        .attr('class', 'legend')
        .append('circle')
        .attr('r', 5)
        .attr('fill', d => colorScale(d));

    svg.selectAll<BaseType, string>('g.legend')
        .append('text')
        .text((d: string) =>
            d
                .split('')
                .map((l, i) => (i === 0 ? l.toUpperCase() : l))
                .join('')
        )
        .attr('transform', `translate(12, 5)`);
};

const buildToolTip = () => {
    select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('background-color', 'black')
        .style('padding', '5px')
        .style('border-radius', '2px')
        .style('font-size', '10px')
        .style('visibility', 'hidden')
        .style('color', 'white');
};

export default ForceGraph;
