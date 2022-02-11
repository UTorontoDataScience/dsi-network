import { Theme } from '@mui/material';
import { easeLinear, easeQuadIn } from 'd3-ease';
import { select, Selection } from 'd3-selection';
import { transition } from 'd3-transition';
import { ModelEntity } from '../../types';
import { getEntityId, makeTree } from '../../util';
import { colorScale, drawLegend } from '../shared';
import { LocalDSINode } from './NeighborhoodComponent';

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
            .attr('class', 'chart-container');

        this.lineContainer = this.svg
            .append('g')
            .attr('class', 'line-container');

        this.circleContainer = this.svg
            .append('g')
            .attr('class', 'circle-container');

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
            .attr('stroke', this.strokeColor);

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
                        .attr('text-anchor', d =>
                            getEntityId(d.data) ===
                            getEntityId(this.selectedNode!.data)
                                ? 'middle'
                                : d.x! < 0
                                ? 'end'
                                : 'start'
                        )
                        .style('user-select', 'none')
                        .transition()
                        .duration(500)
                        .style('opacity', 0.75);

                    return enterNodeSelection;
                },
                update => {
                    update
                        .selectAll<SVGTextElement, LocalDSINode>('text')
                        .attr('text-anchor', d =>
                            getEntityId(d.data) ===
                            getEntityId(this.selectedNode!.data)
                                ? 'middle'
                                : d.x! < 0
                                ? 'end'
                                : 'start'
                        );
                    return update;
                },
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

        return t;
    };

    buildChart = async (tree: LocalDSINode) => {
        const arcLength = 360 / Math.max(tree.descendants().length - 1, 2);
        const treeWithCoordinates = this.calculateLayout(tree, arcLength);
        const lines = this.appendLines(treeWithCoordinates);
        await this.appendSelectedNode();
        lines
            .transition()
            .duration(500)
            .attr('x2', d => d.x!)
            .attr('y2', d => d.y!);

        this.appendNodes(treeWithCoordinates, Math.min(arcLength * 2, 50));
    };

    calculateLayout = (tree: LocalDSINode, arcLength: number) => {
        const radius = this.h / 2.5;

        let c = 0;
        return tree
            .sort((a, b) => (a.data.type > b.data.type ? -1 : 1))
            .each(n => {
                const t = 360 - arcLength * c;

                if (getEntityId(n.data) === this?.selectedNode?.id) {
                    n.x = 0;
                    n.y = 0;
                } else {
                    n.y = -(radius * Math.cos(t * (Math.PI / 180)));
                    n.x = radius * Math.sin(t * (Math.PI / 180));
                    c++;
                }
            });
    };

    render = (tree: LocalDSINode, selectedNodeId: string) => {
        this.selectedNode = tree.find(n => selectedNodeId === n.id)!;
        this.setSelected(tree.descendants().map(d => d.data));
        this.buildChart(tree);
    };
}
