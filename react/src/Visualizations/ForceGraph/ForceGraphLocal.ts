import { Theme } from '@mui/material';
import { easeCubicIn } from 'd3-ease';
import {
    forceCenter,
    forceManyBody,
    forceSimulation,
    SimulationLinkDatum,
} from 'd3-force';
import { select, Selection } from 'd3-selection';
import { DSINode } from '../../types';
import { getEntityId, makeTree } from '../../util';
import {
    buildForceLinks,
    colorScale,
    DSISimulation,
    makeLinkKey,
    makeNodeKey,
} from './ForceGraph';

export default class D3ForceGraphLocal {
    h: number;
    svg: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    theme: Theme;
    tree: DSINode;
    w: number;
    constructor(
        selector: string,
        theme: Theme,
        tree: DSINode,
        onNodeClick: (node: DSINode) => void
    ) {
        this.theme = theme;
        this.tree = tree;

        this.w = 1000;
        this.h = 1000;
        this.svg = select(`#${selector}`)
            .append('svg')
            .attr('class', 'main')
            .attr('viewBox', [-this.w / 2, -this.h / 2, this.w, this.h])
            .append('g')
            .attr('class', 'chart-container');

        const forceLinks = buildForceLinks(this.tree.links());

        const simulation: DSISimulation = forceSimulation();

        const maxDistance = this.w / 4;

        const circumference = 2 * (Math.PI * maxDistance);

        const nodeR = Math.min(
            circumference / this.tree.descendants().length / 4,
            50
        );

        simulation
            .nodes(this.tree.descendants())
            .force('charge', forceManyBody().strength(-100))
            .force(
                'links',
                forceLinks.distance(maxDistance - nodeR).strength(1)
            )
            .force('center', forceCenter())
            .velocityDecay(0.1);

        const linkSelection = this.svg
            .selectAll<SVGLineElement, SimulationLinkDatum<DSINode>>('line')
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

        const nodeSelection = this.svg
            .selectAll<SVGGElement, DSINode>('g.circle-node')
            .data(this.tree.descendants(), (d, i) => (d ? makeNodeKey(d) : i))
            .join(
                enter => {
                    const enterNodeSelection = enter
                        .append('g')
                        .attr('class', 'circle-node');

                    enterNodeSelection
                        .append('circle')
                        .attr('opacity', 0)
                        .attr('r', d => (!d.parent ? nodeR * 2 : nodeR))
                        .attr('fill', d => colorScale(d.data.type))
                        .attr('stroke', d => {
                            return d.children
                                ? this.theme.palette.text.primary
                                : null;
                        })
                        .transition()
                        .duration(500)
                        .attr('opacity', 1);

                    enterNodeSelection
                        .append('text')
                        .attr('fill', this.theme.palette.text.primary)
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
                    exit.select('circle')
                        .transition()
                        .duration(500)
                        .attr('opacity', 0)
                        .remove();

                    exit.remove();
                }
            )
            .on('click', (e, d) => onNodeClick(d))
            //ensure selected nodes are in "front"
            .sort(a => (a.selected ? 1 : -1));

        simulation.on('tick', () => {
            nodeSelection.attr('transform', d => `translate(${d.x}, ${d.y})`);

            nodeSelection
                .selectAll<SVGTextElement, DSINode>('text')
                .attr('text-anchor', d =>
                    !d.parent ? 'middle' : d.x! < 0 ? 'end' : 'start'
                );

            linkSelection
                .attr('x1', d => (d.source as DSINode).x!)
                .attr('y1', d => (d.source as DSINode).y!)
                .attr('x2', d => (d.target as DSINode).x!)
                .attr('y2', d => (d.target as DSINode).y!);
        });
    }
}
