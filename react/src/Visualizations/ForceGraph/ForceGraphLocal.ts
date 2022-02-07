import { Theme } from '@mui/material';
import { easeCubicIn } from 'd3-ease';
import {
    forceCenter,
    forceManyBody,
    forceSimulation,
    SimulationLinkDatum,
} from 'd3-force';
import { select, Selection } from 'd3-selection';
import { getEntityId, makeTree } from '../../util';
import {
    buildForceLinks,
    colorScale,
    DSISimulation,
    makeLinkKey,
    makeNodeKey,
} from './ForceGraph';
import { LocalDSINode } from './ForceGraphLocalComponent';

export default class D3ForceGraphLocal {
    h: number;
    resetViewNode: (node: LocalDSINode) => void;
    simulation: DSISimulation;
    svg: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    theme: Theme;
    w: number;
    constructor(
        selector: string,
        theme: Theme,
        resetViewNode: (node: LocalDSINode) => void
    ) {
        this.resetViewNode = resetViewNode;
        this.theme = theme;
        this.w = 1000;
        this.h = 1000;
        this.svg = select(`#${selector}`)
            .append('svg')
            .attr('class', 'main')
            .attr('viewBox', [-this.w / 2, -this.h / 2, this.w, this.h])
            .append('g')
            .attr('class', 'chart-container');

        this.simulation = forceSimulation();
    }

    appendNodes = (
        tree: LocalDSINode,
        selectedNode: LocalDSINode,
        nodeR: number
    ) => {
        return this.svg
            .selectAll<SVGGElement, LocalDSINode>('g.circle-node')
            .data(tree.descendants(), (d, i) => (d ? makeNodeKey(d) : i))
            .join(
                enter => {
                    const enterNodeSelection = enter
                        .append('g')
                        .attr('class', 'circle-node');

                    enterNodeSelection
                        .append('circle')
                        .attr('opacity', 0)
                        .attr('r', () => nodeR)
                        .attr('fill', d => colorScale(d.data.type))
                        .attr('stroke', d =>
                            d.children ? this.theme.palette.text.primary : null
                        )
                        .transition('main')
                        .duration(1500)
                        .attr('opacity', 1);

                    enterNodeSelection
                        .append('text')
                        .attr('fill', this.theme.palette.text.primary)
                        .attr('opacity', 0)
                        .text(d => d.data.name)
                        .attr('text-anchor', 'middle')
                        .style('user-select', 'none')
                        .transition('text')
                        .duration(500)
                        .style('opacity', 0.75);

                    return enterNodeSelection;
                },
                update => {
                    const selected = update.filter(
                        d => d.id === selectedNode.id
                    );

                    selected
                        .select('circle')
                        .transition()
                        .duration(1500)
                        .attr('r', () => nodeR);

                    return update;
                },
                exit => {
                    exit.select('circle')
                        .transition('exiting')
                        .duration(500)
                        .attr('opacity', 0)
                        .remove();

                    exit.remove();
                }
            )
            .on('click', (_, d) => {
                if (d.id !== selectedNode.id && d.hasChildren)
                    this.resetViewNode(d);
            });
    };

    appendSelectedNode = (
        selectedNode: LocalDSINode,
        onTransitionEnd: () => void
    ) => {
        /* strip selected node of parents/children, as d3 will internally transform object into array of descendants via iterator */
        const node = makeTree(
            [selectedNode.copy().data],
            selectedNode.copy().data
        ) as LocalDSINode;

        //node.selected = true; // this will put it in the exit selection b/c it won't have this attribute with appended w/ rest of tree

        this.svg
            .selectAll<SVGGElement, LocalDSINode>('g.circle-node')
            .data(node, d => getEntityId(d.data))
            .join('g')
            .attr('class', 'circle-node')
            .append('circle')
            .attr('r', () => 50)
            .attr('fill', d => colorScale(d.data.type))
            .attr('stroke', d =>
                d.children ? this.theme.palette.text.primary : null
            )
            .transition()
            .duration(1500)
            .attr('opacity', 1)
            .end()
            .then(() => onTransitionEnd());
    };

    buildChart = (selectedNode: LocalDSINode, tree: LocalDSINode) => {
        this.appendSelectedNode(
            selectedNode,
            this.buildGraph.bind(this, selectedNode, tree)
        );
    };

    buildGraph = (selectedNode: LocalDSINode, tree: LocalDSINode) => {
        const forceLinks = buildForceLinks(tree.links());

        const simulation: DSISimulation = forceSimulation();

        const maxDistance = this.w / 4;

        const circumference = 2 * (Math.PI * maxDistance);

        const nodeR = Math.min(
            circumference / tree.descendants().length / 4,
            50
        );

        simulation
            .nodes(tree.descendants())
            .force('charge', forceManyBody().strength(-100))
            .force(
                'links',
                forceLinks.distance(maxDistance - nodeR).strength(1)
            )
            .force('center', forceCenter())
            .velocityDecay(0.1);

        const linkSelection = this.svg
            .selectAll<SVGLineElement, SimulationLinkDatum<LocalDSINode>>(
                'line'
            )
            .data(forceLinks.links(), makeLinkKey)
            .join(
                enter => {
                    const enterSelection = enter
                        .append('line')
                        .attr('class', 'edge')
                        .attr('stroke', this.theme.palette.text.primary);

                    enterSelection
                        .transition()
                        .duration(1000)
                        .attr('opacity', 1);
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

        const nodeSelection = this.appendNodes(tree, selectedNode, nodeR);

        simulation.on('tick', () => {
            nodeSelection.attr('transform', d => {
                if (!d.x) {
                    console.log(d);
                }
                return `translate(${d.x}, ${d.y})`;
            });

            nodeSelection
                .selectAll<SVGTextElement, LocalDSINode>('text')
                .attr('text-anchor', d =>
                    !d.parent ? 'middle' : d.x! < 0 ? 'end' : 'start'
                );

            linkSelection
                .attr('x1', d => (d.source as LocalDSINode).x!)
                .attr('y1', d => (d.source as LocalDSINode).y!)
                .attr('x2', d => (d.target as LocalDSINode).x!)
                .attr('y2', d => (d.target as LocalDSINode).y!);
        });
    };

    render = (tree: LocalDSINode, selectedNodeId: string) => {
        const selectedNode = tree.find(n => selectedNodeId === n.id)!;

        this.buildChart(selectedNode, tree);
    };
}
