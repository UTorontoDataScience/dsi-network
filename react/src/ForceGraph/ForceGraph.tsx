import { hierarchy, HierarchyLink, HierarchyNode } from 'd3-hierarchy';
import { select, selectAll, Selection } from 'd3-selection';
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
import React, { useEffect, useLayoutEffect, useState } from 'react';
import getModel, {
    Campus,
    EntityType,
    HierarchicalNode,
    HydratedLink,
    hydrateLinks,
    Model,
    ModelEntity,
    Relationship,
} from '../data/model';

const ForceGraph: React.FC<{}> = () => {
    const [model, setModel] = useState<Model>();
    const [nodes, setNodes] = useState<HierarchicalNode>();

    useLayoutEffect(() => {
        if (nodes) {
            buildForceGraph(nodes, 'test', 1000, 700);
        }
    }, [nodes]);

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setModel(model);
        };
        _getModel();
    }, []);

    useEffect(() => {
        if (model) {
            const stGeorge = model.campus.find(c =>
                c.name.includes('eorge')
            ) as Campus;

            setNodes(
                buildTree(stGeorge, 'campus', 'root', hydrateLinks(model))
            );
        }
    }, [model]);

    return <span id="test" />;
};

const buildTree = (
    root: ModelEntity,
    rootType: EntityType,
    relationship: Relationship | 'root',
    links: HydratedLink[]
): HierarchicalNode => {
    const childLinks = links.filter(
        l => l.parentType === rootType && l.parent.id === root.id
    );

    const res: HierarchicalNode = {
        entity: root,
        relationToParent: relationship,
        type: rootType,
        children: [
            ...childLinks.map(c =>
                buildTree(c.child, c.childType, c.relationship, links)
            ),
        ],
    };

    return res;
};

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

//todo: this should be MapDATA
const mapHierarchyNode = <T,>(
    node: HierarchyNode<T>,
    fn: (data: HierarchyNode<T>) => HierarchyNode<T>
): HierarchyNode<T> => {
    //d3 doesn't export the constructor to its hierarchical node so we need to clone
    const newNode = fn(node);
    // @ts-ignore
    newNode.__proto__ = node.__proto__;
    newNode.children = [];
    if (node.children) {
        node.children.forEach(c =>
            newNode.children?.push(mapHierarchyNode(c, fn))
        );
    }
    return newNode;
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

const buildSimulation2 = <T,>(
    rootNode: ForceNodeSimulationWrapper<T>,
    nodes: HierarchyNode<T>[],
    forceLinks: ForceLink<
        ForceNodeSimulationWrapper<T>,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<T>>
    >
) => {
    return (
        forceSimulation<ForceNodeSimulationWrapper<T>>(nodes)
            .force('d', forceLinks.distance(5))
            //decreasing strength while increasing decay will create larger graphic (possibly overflowing)
            .force('charge', forceManyBody().strength(-10))
            //note that we ought to pass in array of nodes and function
            .force('x', forceX(rootNode.x! + 5).strength(-0.2))
            .force('y', forceY(rootNode.y! + 5).strength(-0.2))
            //higher is slower, default is .4
            .velocityDecay(0.2)
    );
};

const buildForceLinks = <T extends ForceNode>(links: HierarchyLink<T>[]) =>
    forceLink<
        ForceNodeSimulationWrapper<T>,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<T>>
    >(links)
        .id(model => makeNodeKey(model))
        .distance(0)
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
            .attr('fill', d => (d.children ? null : 'black'))
            .attr('stroke', d => (d.children ? null : '#fff'))
            .attr('r', 3.5);

        enterSelection
            .transition()
            //.attr('r', d => (d.data.selected ? 10 : 3.5))
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

const updateForceGraph = (
    nodes: ForceNodeSimulationWrapper<ForceNode>,
    simulation: Simulation<
        ForceNodeSimulationWrapper<ForceNode>,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<ForceNode>>
    >,
    nodeSelection: Selection<
        SVGCircleElement,
        ForceNodeSimulationWrapper<ForceNode>,
        any,
        any
    >,
    linkSelection: Selection<
        SVGLineElement,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<ForceNode>>,
        any,
        any
    >
) => {
    simulation.stop();

    //todo: this should be handled in react
    const newRoot = mapHierarchyNode(nodes, node => ({
        ...node,
        data: {
            ...node.data,
            selected: node.data.entity.name.startsWith('Gary')
                ? true
                : node.data.selected,
        },
    }));

    //fix positions of all but new nodes
    const simMap = simulation
        .nodes()
        .reduce(
            (acc, curr) => ({ ...acc, [makeNodeKey(curr)]: curr }),
            {} as { [key: string]: any }
        );

    const newNodes =
        newRoot.descendants() as ForceNodeSimulationWrapper<ForceNode>[];

    // bind new data to dom selection so tickHandler can read it
    const enterNodes = updateNodeData(nodeSelection, newNodes);
    const enterNodeParentKeys = enterNodes
        .filter(en => en.parent)
        .map(en => makeNodeKey(en.parent!));

    newNodes.forEach(nn => {
        const key = makeNodeKey(nn);

        if (
            (!!simMap[key] && !simMap[key]?.parent) ||
            (!!simMap[key] &&
                !enterNodeParentKeys.includes(makeNodeKey(simMap[key]?.parent)))
        ) {
            nn.fx = simMap[key].x;
            nn.fy = simMap[key].y;
        }
    });

    // build new force links (can't reuse old)
    // map to ensure that newNodes and their latest locations are looked up at initialization time
    // (init time is when data is updated/mutated)
    const forceLinks = buildForceLinks(newRoot.links()).links(
        newRoot.links().map(l => ({
            source: makeNodeKey(l.source),
            target: makeNodeKey(l.target),
        }))
    );

    //initialize simulation (mutate forceLinks)
    const newSim = buildSimulation2(enterNodes[0], newNodes, forceLinks);

    // ensure that link selection has recalculated coordinates bound before registering tick callback
    updateLinkData(linkSelection, forceLinks.links());

    registerTickHandler(newSim, selectAll('line') as any, selectAll('circle'));
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
        .attr('fill', '#fff')
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5)
        .selectAll('circle')
        .data(
            simulation.nodes(),
            (d: ForceNodeSimulationWrapper<ForceNode> | unknown, i) =>
                d ? makeNodeKey(d as ForceNodeSimulationWrapper<ForceNode>) : i
        )
        .join('circle')
        .attr('fill', d =>
            d.children ? null : d.data.selected ? 'red' : 'black'
        )
        .attr('stroke', d => (d.children ? null : '#fff'))
        .attr('r', 3.5) as Selection<
        SVGCircleElement,
        ForceNodeSimulationWrapper<ForceNode>,
        SVGGElement,
        unknown
    >;

    nodeSelection.append('title').text(d => d.data.entity.name);

    registerTickHandler(simulation, linkSelection, nodeSelection);

    const scheduleRefresh = () =>
        setTimeout(
            () =>
                updateForceGraph(
                    root,
                    simulation,
                    nodeSelection,
                    linkSelection
                ),
            3000
        );

    scheduleRefresh();

    return svg.node();
};

export default ForceGraph;
