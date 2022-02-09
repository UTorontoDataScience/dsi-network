import { Theme } from '@mui/material';
import { easeCubicIn, easeLinear, easeQuadIn } from 'd3-ease';
import {
    forceCenter,
    forceManyBody,
    forceSimulation,
    SimulationLinkDatum,
} from 'd3-force';
import { BaseType, select, Selection } from 'd3-selection';
import { transition } from 'd3-transition';
import { getEntityId, makeTree } from '../../util';
import {
    buildForceLinks,
    colorScale,
    DSISimulation,
    makeLinkKey,
} from './ForceGraph';
import { LocalDSINode } from './ForceGraphLocalComponent';

const lineExitTransition = <T>(
    selection: Selection<SVGLineElement, T, any, any>
) =>
    selection
        .transition()
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

export default class D3ForceGraphLocal {
    private strokeColor: string;
    private h: number;
    private resetViewNode: (node: LocalDSINode) => void;
    selectedNode: LocalDSINode | null = null;
    private simulation: DSISimulation;
    private svg: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    private w: number;
    constructor(
        selector: string,
        theme: Theme,
        resetViewNode: (node: LocalDSINode) => void
    ) {
        this.resetViewNode = resetViewNode;
        this.strokeColor = theme.palette.text.primary;
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

    appendNodes = (tree: LocalDSINode, nodeR: number) => {
        return this.svg
            .selectAll<SVGGElement, LocalDSINode>('g.circle-node')
            .data(tree.descendants(), (d, i) => (d ? getEntityId(d.data) : i))
            .join(
                enter => {
                    const enterNodeSelection = enter
                        .append('g')
                        .attr('class', 'circle-node')
                        .style('cursor', d =>
                            d.hasChildren ? 'pointer' : null
                        );

                    enterNodeSelection
                        .append('circle')
                        .attr('opacity', 0)
                        .attr('r', nodeR)
                        .attr('fill', d => colorScale(d.data.type))
                        .attr('stroke', d =>
                            d.hasChildren ? this.strokeColor : null
                        )
                        .transition()
                        .duration(500)
                        .attr('opacity', 1);

                    enterNodeSelection
                        .append('text')
                        .attr('fill', this.strokeColor)
                        .attr('opacity', 0)
                        .text(d => d.data.name)
                        .attr('text-anchor', 'middle')
                        .style('user-select', 'none')
                        .transition()
                        .duration(500)
                        .style('opacity', 0.75);

                    return enterNodeSelection;
                },
                update => update,
                exit => {
                    exit.remove();
                }
            )
            .on('click', (_, d) => {
                if (d.id !== this.selectedNode?.id && d.hasChildren) {
                    this.resetViewNode(d);
                } else if (d.id === this.selectedNode?.id && d.parent) {
                    this.resetViewNode(d.parent);
                }
            });
    };

    appendSelectedNode = () => {
        /* strip selected node of parents/children b/c d3 will internally transform object into array of descendants via iterator */
        const node = makeTree(
            [this.selectedNode!.copy().data],
            this.selectedNode!.copy().data
        ) as LocalDSINode;

        if (this.selectedNode?.parent) {
            node.hasParent = true;
        }

        if (this.selectedNode?.children) {
            node.hasChildren = true;
        }

        const t = transition().duration(500).ease(easeLinear).end();

        this.svg
            .selectAll<SVGGElement, LocalDSINode>('g.circle-node')
            .data(node, d => getEntityId(d.data))
            .join(
                enter => {
                    const enterSelection = enter
                        .append('g')
                        .attr('class', 'circle-node')
                        .style('cursor', d =>
                            d.hasChildren ? 'pointer' : null
                        );

                    enterSelection
                        .append('circle')
                        .attr('r', () => 50)
                        .attr('fill', d => colorScale(d.data.type))
                        .attr('stroke', d =>
                            d.hasChildren ? this.strokeColor : null
                        )
                        /* typing here is unclear */
                        .transition(t as any)
                        .duration(500)
                        .attr('opacity', 1);

                    enterSelection
                        .append('text')
                        .attr('fill', this.strokeColor)
                        .attr('opacity', 0)
                        .text(d => d.data.name)
                        .attr('text-anchor', 'middle')
                        .style('user-select', 'none')
                        .transition('text')
                        .duration(500)
                        .ease(easeQuadIn)
                        .style('opacity', 0.75);

                    enterSelection
                        .append('g')
                        .attr('class', 'go-back')
                        .append('polyline')
                        .attr('points', '-10,20 0,10, 10,20')
                        .attr('stroke', this.strokeColor)
                        .attr('fill', 'none')
                        .style('opacity', d => (d.hasParent ? 0.75 : 0))
                        .style('stroke-width', 2);

                    return enterSelection;
                },

                update => {
                    update
                        .selectAll('circle')
                        .transition()
                        .duration(500)
                        .attr('r', 50);

                    update
                        .transition()
                        .duration(500)
                        .attr('transform', 'translate(0,0)');

                    update
                        .append('g')
                        .attr('class', 'go-back')
                        .append('polyline')
                        .attr('points', '-10,20 0,10, 10,20')
                        .attr('stroke', this.strokeColor)
                        .attr('fill', 'none')
                        .style('opacity', d => (d.hasParent ? 0.75 : 0))
                        .style('stroke-width', 2);
                    return update;
                },
                exit => exit.remove()
            );

        this.svg
            .selectAll<SVGLineElement, any>('line')
            .data([])
            .join(
                enter => enter,
                update => update,
                exit => exit.call(lineExitTransition)
            );

        return t;
    };

    buildChart = async (tree: LocalDSINode) => {
        //stop sim to prevent tick callback from firing on exited nodes
        this.simulation.stop();
        await this.appendSelectedNode();
        this.appendAllNodesAndLinks(tree);
        this.simulation.alpha(1);
        this.simulation.restart();
    };

    appendAllNodesAndLinks = (tree: LocalDSINode) => {
        const forceLinks = buildForceLinks(tree.links());

        const maxDistance = this.w / 4;

        const circumference = 2 * (Math.PI * maxDistance);

        const nodeR = Math.min(
            circumference / tree.descendants().length / 4,
            50
        );

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
                        .attr('stroke', this.strokeColor);

                    enterSelection
                        .transition()
                        .duration(1000)
                        .attr('opacity', 1);
                    return enterSelection;
                },
                update => update,
                exit => exit.call(lineExitTransition)
            );

        const nodeSelection = this.appendNodes(tree, nodeR);

        this.simulation
            .nodes(tree.descendants())
            .force('charge', forceManyBody().strength(-25))
            .force(
                'links',
                forceLinks.distance(maxDistance - nodeR).strength(1)
            )
            //center force will override charge when leaf node selected
            .force(
                'center',
                tree.descendants().length > 2 ? forceCenter() : null
            )
            .velocityDecay(0.1);

        /* fix selected node to prevent wobblying as sim fires */
        nodeSelection
            .filter(n => getEntityId(n.data) === this.selectedNode?.id)
            .each(n => {
                n.fx = 0;
                n.fy = 0;
            });

        /* ensure circles in front of lines; selection could be line or circle (or something else), but we're only checking for circles */
        this.svg
            .selectChildren<BaseType, LocalDSINode>()
            .sort((a: LocalDSINode) => (a.data ? 1 : -1));

        this.simulation.on('tick', () => {
            nodeSelection.attr('transform', d => `translate(${d.x}, ${d.y})`);

            nodeSelection
                .selectAll<SVGTextElement, LocalDSINode>('text')
                .attr('text-anchor', d =>
                    getEntityId(d.data) === this.selectedNode?.id
                        ? 'middle'
                        : d.x! < 0
                        ? 'end'
                        : 'start'
                );

            linkSelection
                .attr('x1', d => (d.source as LocalDSINode).x!)
                .attr('y1', d => (d.source as LocalDSINode).y!)
                .attr('x2', d => (d.target as LocalDSINode).x!)
                .attr('y2', d => (d.target as LocalDSINode).y!);
        });
    };

    render = (tree: LocalDSINode, selectedNodeId: string) => {
        this.selectedNode = tree.find(n => selectedNodeId === n.id)!;
        this.buildChart(tree);
    };
}
