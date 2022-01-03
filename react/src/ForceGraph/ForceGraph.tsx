import { hierarchy, HierarchyLink, HierarchyNode } from 'd3-hierarchy';
import { BaseType, select, Selection } from 'd3-selection';
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
    //d3 doesn't export the constructor to its hierarchical constructor so we need to clone
    const clonedNode = { ...node };
    const newNode = fn(clonedNode);
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

const buildForceLinks = <T extends ForceNode>(links: HierarchyLink<T>[]) =>
    forceLink<
        ForceNodeSimulationWrapper<T>,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<T>>
    >(links)
        .id(model => makeNodeKey(model))
        .distance(0)
        .strength(1);

const updateNodeData = <T extends ForceNode>(
    nodeSelection: Selection<
        SVGCircleElement | BaseType,
        ForceNodeSimulationWrapper<T>,
        any,
        any
    >,
    nodes: ForceNodeSimulationWrapper<T>[]
) => {
    nodeSelection
        .data(nodes, d => makeNodeKey(d))
        .join(enter => {
            const enterSelection = enter
                .append('circle')
                .attr('fill', d => (d.children ? null : 'black'))
                .attr('stroke', d => (d.children ? null : '#fff'))
                .attr('r', 3.5);

            enterSelection
                .transition()
                .duration(1000)
                .attr('r', d => (d.data.selected ? 10 : 3.5))
                .attr('fill', function (d) {
                    return d.data.selected ? 'red' : select(this).attr('fill');
                });
            //append separately so it doesn't get returned
            enterSelection.append('title').text(d => d.data.entity.name);

            return enterSelection;
        });
};

const updateLinkData = <T extends ForceNode>(
    linkSelection: Selection<
        SVGLineElement | BaseType,
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
        BaseType | SVGLineElement,
        ForceLinkSimulationWrapper<ForceNodeSimulationWrapper<ForceNode>>,
        SVGGElement,
        unknown
    >,
    nodeSelection: Selection<
        SVGCircleElement | BaseType,
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
                (d, i) => (d.source as ForceNodeSimulationWrapper<ForceNode>).x!
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
        .selectAll('line')
        .data(forceLinks.links())
        .join('line')
        .attr('stroke', 'black');

    const nodeSelection = svg
        .append('g')
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
        .attr('r', 3.5);
    //.call(drag(simulation));

    registerTickHandler(simulation, linkSelection, nodeSelection);

    const scheduleRefresh = () =>
        setTimeout(() => {
            simulation.stop();

            // don't mutate bound data, instead return new tree, preserving simulation coordinates
            const newRoot = mapHierarchyNode(root, node => ({
                ...node,
                data: {
                    ...node.data,
                    selected: node.data.entity.name.startsWith('Gary')
                        ? true
                        : node.data.selected,
                },
            }));

            // bind new data to dom selection so tickhandler can read it
            updateNodeData(nodeSelection, newRoot.descendants());

            //fix positions of all but new nodes
            const simMap = simulation
                .nodes()
                .reduce(
                    (acc, curr) => ({ ...acc, [makeNodeKey(curr)]: curr }),
                    {} as { [key: string]: any }
                );

            // problem here is that the key will not be found if the node was just selected, and thus it will be "new" and lose its place in the old sim
            const newNodes =
                newRoot.descendants() as ForceNodeSimulationWrapper<ForceNode>[];

            newNodes.forEach(nn => {
                const key = makeNodeKey(nn);
                if (simMap[key]) {
                    nn.fx = simMap[key].x;
                    nn.fy = simMap[key].y;
                }
            });

            // build new force links (can't reuse old)
            // map to ensure that newNodes and their latest locations are looked up at initialization time
            // (init time is when data is updated/mutated)
            const forceLinks2 = buildForceLinks(newRoot.links()).links(
                newRoot.links().map(l => ({
                    source: makeNodeKey(l.source),
                    target: makeNodeKey(l.target),
                }))
            );

            // todo: this simulation should only affect nodes within 4r of selected node(s)
            // and it should set selected node(s) as center with repulsive force
            // all other nodes should have their fx and fy properties set, so they don't get changed
            const newSim = buildSimulation(newNodes, forceLinks2);
            // ensure that link selection has recalculated coordinates bound before passing to tick callback

            updateLinkData(linkSelection, forceLinks2.links());

            registerTickHandler(
                newSim,
                svg.selectAll('line'),
                svg.selectAll('circle')
            );
        }, 3000);

    scheduleRefresh();

    nodeSelection.append('title').text(d => d.data.entity.name);

    simulation.on('tick', () => {
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

        nodeSelection.attr('cx', d => d.x!).attr('cy', d => d.y!);
    });

    return svg.node();
};

export default ForceGraph;
