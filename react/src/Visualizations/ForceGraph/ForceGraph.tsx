import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { hierarchy, HierarchyLink, HierarchyNode } from 'd3-hierarchy';
import { Selection, BaseType, select, selectAll } from 'd3-selection';
import { scaleOrdinal } from 'd3-scale';
import { schemeDark2 } from 'd3-scale-chromatic';
import { D3DragEvent, drag } from 'd3-drag';
import 'd3-transition'; // must be imported so selection.transition will resolve
import {
    forceSimulation,
    forceLink,
    forceManyBody,
    SimulationLinkDatum,
    SimulationNodeDatum,
    ForceLink,
    Simulation,
    forceCenter,
    forceCollide,
} from 'd3-force';
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

type DSISimulation<T> = Simulation<
    ForceNodeSimulationWrapper<T>,
    SimulationLinkDatum<ForceNodeSimulationWrapper<T>>
>;

type DSIForceLinks<T> = ForceLink<
    ForceNodeSimulationWrapper<T>,
    SimulationLinkDatum<ForceNodeSimulationWrapper<T>>
>;

type DSINodeSelection<T> = Selection<
    SVGCircleElement,
    ForceNodeSimulationWrapper<T>,
    BaseType,
    unknown
>;

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
    const [simulation, setSimulation] = useState<DSISimulation<ForceNode>>();

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
        /* eslint-disable-next-line react-hooks/exhaustive-deps  */
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

/* for any data to be annotated with coordinates by forceLink/simulation, we need to extend these interfaces */
interface ForceNodeSimulationWrapper<T>
    extends HierarchyNode<T>,
        SimulationNodeDatum {}

/**
 *  Unique key used to identify nodes for d3.join process and mapping simulation links to source/target
 */
const makeNodeKey = (datum: ForceNodeSimulationWrapper<ForceNode>) =>
    `${datum.data.entity.id}-${datum.data.type}-${datum.parent?.data.entity.id}-${datum.data.relationToParent}-${datum.data.selected}`;

/**
 *  Unique key used to identify links for d3.join process
 */
const makeLinkKey = <T extends ForceNode>(
    link: SimulationLinkDatum<ForceNodeSimulationWrapper<T>>
) => {
    const source = link.source as ForceNodeSimulationWrapper<T>;
    const target = link.target as ForceNodeSimulationWrapper<T>;
    return `${source.data.entity.id}-${source.parent?.id}-${target.data.selected}-${target.data.entity.id}`;
};

// todo: compute based on node count
const buildSimulation = <T,>(
    nodes: HierarchyNode<T>[],
    forceLinks: DSIForceLinks<T>
) =>
    forceSimulation<ForceNodeSimulationWrapper<T>>(nodes)
        .force('d', forceLinks)
        //decreasing strength while increasing decay will create larger graphic (possibly overflowing)
        .force('charge', forceManyBody().strength(-20))
        .force('collision', forceCollide().radius(5))
        .force('center', forceCenter())
        //higher is slower, default is .4
        .velocityDecay(0.4);

const buildUpdateSimulation = <T,>(
    nodes: HierarchyNode<T>[],
    forceLinks: DSIForceLinks<T>
) => {
    return forceSimulation<ForceNodeSimulationWrapper<T>>(nodes)
        .force('d', forceLinks)
        .force('charge', forceManyBody().strength(-21))
        .force('collision', forceCollide().radius(7.5))
        .force('center', forceCenter().strength(0.05))
        .velocityDecay(0.9)
        .alpha(0.1);
};

const buildForceLinks = <T extends ForceNode>(links: HierarchyLink<T>[]) =>
    forceLink<
        ForceNodeSimulationWrapper<T>,
        SimulationLinkDatum<ForceNodeSimulationWrapper<T>>
    >(links)
        .id(model => makeNodeKey(model))
        .distance(12)
        .strength(1);

/**
 *  Update nodes and return enter selection data for use by caller
 */
const updateNodeSelection = <T extends ForceNode>(
    nodeSelection: DSINodeSelection<T>,
    nodes: ForceNodeSimulationWrapper<T>[]
) => {
    const bound = nodeSelection.data(nodes, d => makeNodeKey(d));

    bound.join(
        enter => {
            const enterSelection = enter
                .append('circle')
                .attr('fill', d => colorScale(d.data.entity.type))
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

const updateLinkData = <T extends ForceNode>(
    linkSelection: Selection<
        SVGLineElement,
        SimulationLinkDatum<ForceNodeSimulationWrapper<T>>,
        any,
        unknown
    >,
    links: SimulationLinkDatum<ForceNodeSimulationWrapper<T>>[]
) => {
    return linkSelection
        .data(links, makeLinkKey)
        .join('line', enter => {
            enter.transition().duration(1000);
            return enter.selection();
        })
        .attr('stroke', 'black');
};

const registerTickHandler = <T extends ForceNode>(
    simulation: DSISimulation<T>,
    linkSelection: Selection<
        SVGLineElement,
        SimulationLinkDatum<ForceNodeSimulationWrapper<ForceNode>>,
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
    selection: DSINodeSelection<T>
) => {
    selection
        .on('mouseover', (d: MouseEvent) => showToolTip(d))
        .on('mouseout', () => hideToolTip());
};

const showToolTip = (e: MouseEvent) => {
    select('.tooltip')
        .text((e!.target as any).__data__.data.entity.name)
        .style('visibility', 'visible')
        .style('left', `${e.pageX + 15}px`)
        .style('top', `${e.pageY - 25}px`);
};

const hideToolTip = () => {
    select('.tooltip').style('visibility', 'hidden');
};

const registerDragHandler = <T extends ForceNode>(
    selection: DSINodeSelection<T>,
    simulation: DSISimulation<T>
) => {
    const dragstarted = (
        e: D3DragEvent<SVGCircleElement, T, unknown>,
        d: ForceNodeSimulationWrapper<T>
    ) => {
        simulation.alphaTarget(0.1).restart();
        d.fx = d.x;
        d.fy = d.y;
    };

    const dragged = (
        e: D3DragEvent<SVGCircleElement, T, unknown>,
        d: ForceNodeSimulationWrapper<T>
    ) => {
        d.fx = e.x;
        d.fy = e.y;
    };

    const dragended = (
        e: D3DragEvent<SVGCircleElement, T, unknown>,
        d: ForceNodeSimulationWrapper<T>
    ) => {
        if (!e.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    };

    const handler = drag<SVGCircleElement, ForceNodeSimulationWrapper<T>>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);

    return handler(selection);
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
        SimulationLinkDatum<ForceNodeSimulationWrapper<ForceNode>>
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
        selectAll<SVGCircleElement, ForceNodeSimulationWrapper<ForceNode>>(
            'circle'
        ),
        simulation
    );

    // ensure that link selection has recalculated coordinates bound before registering tick callback
    updateLinkData(linkSelection, forceLinks.links());

    registerTickHandler(
        simulation,
        selectAll<
            SVGLineElement,
            SimulationLinkDatum<ForceNodeSimulationWrapper<ForceNode>>
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
        .attr('transform', (_, i) => `translate(${-(w / 2) + 75}, ${i * 20})`)
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
