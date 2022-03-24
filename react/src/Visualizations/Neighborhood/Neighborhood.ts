import { Theme } from '@mui/material';
import { easeLinear, easeQuadIn } from 'd3-ease';
import { select, Selection } from 'd3-selection';
import { transition } from 'd3-transition';
import { ModelEntity } from '../../types';
import { getEntityId, makeTree } from '../../util';
import { colorScale, drawLegend } from '../shared';
import { LocalDSINode } from './NeighborhoodComponent';

const yFromPolar = (radius: number, theta: number) =>
    -(radius * Math.cos(theta * (Math.PI / 180)));

const xFromPolar = (radius: number, theta: number) =>
    radius * Math.sin(theta * (Math.PI / 180));

export default class D3ForceGraphLocal {
    private circleContainer: Selection<
        SVGGElement,
        unknown,
        HTMLElement,
        unknown
    >;
    private fillColor: string;
    private h: number;
    private lineContainer: Selection<
        SVGGElement,
        unknown,
        HTMLElement,
        unknown
    >;
    private resetViewNode: (node: LocalDSINode) => void;
    selectedNode: LocalDSINode | null = null;
    private setSelected: (models: ModelEntity[]) => void;
    private strokeColor: string;
    private svg: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    private w: number;
    constructor(
        resetViewNode: (node: LocalDSINode) => void,
        selector: string,
        setSelected: (models: ModelEntity[]) => void,
        theme: Theme
    ) {
        this.resetViewNode = resetViewNode;
        this.setSelected = setSelected;
        this.strokeColor = theme.palette.text.primary;
        this.fillColor = theme.palette.background.paper;
        this.w = 1500;
        this.h = 1000;
        this.svg = select(`#${selector}`)
            .append('svg')
            .attr('class', 'main')
            .attr('viewBox', [-this.w / 2, -this.h / 2, this.w, this.h])
            .append('g')
            .attr('class', 'neighborhood-chart-container');

        this.lineContainer = this.svg
            .append('g')
            .attr('class', 'neighborhood-line-container')
            .attr('stroke-width', 2);

        this.circleContainer = this.svg
            .append('g')
            .attr('class', 'neighborhood-circle-container');

        drawLegend(this.svg, this.fillColor, this.strokeColor, this.w, this.h);
    }

    appendLines = (tree: LocalDSINode) =>
        this.lineContainer
            .selectAll<SVGGElement, LocalDSINode>('g.line')
            .data(tree.descendants(), Math.random)
            .join('g')
            .attr('class', 'line')
            .append('line')
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', d => {
                const isParent = d.id === this?.selectedNode?.parent?.id;
                return isParent
                    ? colorScale(this.selectedNode!.parent!.data.type)
                    : this.strokeColor;
            });

    appendNodes = (tree: LocalDSINode, nodeR: number) => {
        return this.circleContainer
            .selectAll<SVGGElement, LocalDSINode>('g.circle-node')
            .data(
                tree.descendants().sort((a, b) => (a.type > b.type ? -1 : 1)),
                (d, i) => (d ? getEntityId(d.data) : i)
            )
            .join(
                enter => {
                    const enterNodeSelection = enter
                        .append('g')
                        .attr('class', 'circle-node')
                        .style('cursor', d =>
                            d.hasChildren ? 'pointer' : null
                        );

                    enterNodeSelection
                        .transition()
                        .duration(500)
                        .attr('transform', d => `translate(${d.x}, ${d.y})`);

                    const that = this;

                    enterNodeSelection.each(function (c) {
                        if (c.hasChildren && c.id !== that.selectedNode!.id!) {
                            [1, 2, 3, 4].forEach(i => {
                                select<SVGGElement, LocalDSINode>(this)
                                    .append('circle')
                                    .attr('class', 'lump')
                                    .attr('cy', yFromPolar(nodeR, i * 90))
                                    .attr('cx', xFromPolar(nodeR, i * 90))
                                    .attr('fill', d => colorScale(d.data.type))
                                    .attr('stroke', that.strokeColor)
                                    .attr('r', 5);
                            });
                        }
                    });

                    const circleSelection = enterNodeSelection
                        .append('circle')
                        .attr('opacity', 0)
                        .attr('r', nodeR)
                        .attr('fill', d => colorScale(d.data.type))
                        .attr('stroke', d =>
                            d.hasChildren ? this.strokeColor : null
                        );

                    circleSelection
                        .transition()
                        .duration(500)
                        .attr('opacity', 1);

                    enterNodeSelection
                        .selectAll<SVGTextElement, LocalDSINode>('text.label')
                        .data(d => [d])
                        .join('text')
                        .attr('class', 'label')
                        .attr('fill', this.strokeColor)
                        .attr('stroke', d => colorScale(d.data.type))
                        .attr('stroke-width', 0.5)
                        .attr('font-size', 18)
                        .call(this.offsetLabels)
                        .selectAll<SVGTSpanElement, LocalDSINode>('tspan')
                        .data(d =>
                            d.data.name.split(' ').reduce<string[][]>(
                                (acc, curr) => {
                                    if (acc[0].length < 4) {
                                        acc[0].push(curr);
                                        return acc;
                                    } else {
                                        if (acc.length === 1) {
                                            acc.push([]);
                                        }
                                        acc[1].push(curr);
                                        return acc;
                                    }
                                },
                                [[]]
                            )
                        )
                        .join('tspan')
                        .attr('opacity', 0)
                        .text(d => d.join(' '))
                        .attr('dy', 16)
                        .attr('x', 10)
                        .style('user-select', 'none')
                        .transition()
                        .duration(500)
                        .style('opacity', 1);

                    return enterNodeSelection;
                },
                /* our new central node */
                update => {
                    update
                        .selectAll<SVGTextElement, LocalDSINode>('text')
                        .call(this.offsetLabels);

                    return update;
                },
                exit => {
                    exit.remove();
                }
            )
            .on('click', (_, d) => {
                // set clicked node as selected node if possible
                if (d.id !== this.selectedNode?.id && d.hasChildren) {
                    this.resetViewNode(d);
                    // make parent selected node
                } else if (d.id === this.selectedNode?.id && d.parent) {
                    this.resetViewNode(d.parent);
                }
            });
    };

    appendBackIcon = (
        selection: Selection<SVGGElement, LocalDSINode, any, any>
    ) =>
        selection
            .append('g')
            .attr('class', 'go-back')
            .append('polyline')
            .attr('points', '-10,35 0,25, 10,35')
            .attr('stroke', this.strokeColor)
            .attr('fill', 'none')
            .style('opacity', d => (d.hasParent ? 0.75 : 0))
            .style('stroke-width', 2);

    appendSelectedNode = () => {
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

        this.circleContainer
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

                    this.appendBackIcon(enterSelection);

                    return enterSelection;
                },

                update => {
                    /* the only node in the update selection will be the new selection (if selected node was designated by user action) */
                    update
                        .selectAll('circle')
                        .transition()
                        .duration(500)
                        .attr('r', 50);

                    update.selectAll('.lump').remove();

                    update
                        .transition()
                        .duration(500)
                        .attr('transform', 'translate(0,0)');

                    this.appendBackIcon(update);

                    return update;
                },
                exit => exit.remove()
            );

        return t;
    };

    buildChart = async (tree: LocalDSINode) => {
        const angle = 360 / Math.max(tree.descendants().length - 1, 2);
        const treeWithCoordinates = this.calculateLayout(tree, angle);
        const lines = this.appendLines(treeWithCoordinates);
        await this.appendSelectedNode();
        lines
            .transition()
            .duration(500)
            .attr('x2', d => d.x!)
            .attr('y2', d => d.y!);

        this.appendNodes(treeWithCoordinates, Math.min(angle * 2, 50));
    };

    /* 360 degrees is (0, -radius) here, so root node should always be directly above selected node  */
    calculateLayout = (tree: LocalDSINode, angle: number) => {
        const radius = this.h / 2.5;
        const rootType = tree.data.type;

        let c = 0;
        return tree
            .sort((a, b) =>
                a.data.type === rootType || a.data.type > b.data.type ? -1 : 1
            )
            .each(n => {
                const t = 360 - angle * c;

                if (getEntityId(n.data) === this?.selectedNode?.id) {
                    n.x = 0;
                    n.y = 0;
                } else {
                    n.y = yFromPolar(radius, t);
                    n.x = xFromPolar(radius, t);
                    c++;
                }
            });
    };

    offsetLabels = (
        selection: Selection<SVGTSpanElement, LocalDSINode, any, any>
    ) =>
        selection
            .attr('text-anchor', d =>
                // center labels close to (0,) or anchor away from origin
                d.id === this.selectedNode?.id || (-25 < d.x! && d.x! < 25)
                    ? 'middle'
                    : d.x! < 0
                    ? 'end'
                    : 'start'
            )
            .attr('y', d => {
                // offset labels at top and bottom for non-selected nodes
                return -50 < d.x! && d.x! < 50 ? (d.y! > 0 ? 20 : -20) : -10;
            });

    render = (tree: LocalDSINode, selectedNodeId: string) => {
        this.selectedNode = tree.find(n => selectedNodeId === n.id)!;
        this.setSelected(tree.descendants().map(d => d.data));
        this.buildChart(tree);
    };
}
