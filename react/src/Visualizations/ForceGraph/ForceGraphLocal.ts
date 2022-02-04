import { Theme } from '@mui/material';
import { easeCubicIn } from 'd3-ease';
import {
    forceCenter,
    forceCollide,
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
    registerTickHandler,
} from './ForceGraph';

export default class D3ForceGraphLocal {
    nodeId: string;
    h: number;
    svg: Selection<SVGGElement, unknown, HTMLElement, unknown>;
    theme: Theme;
    tree: DSINode;
    w: number;
    constructor(selector: string, theme: Theme, tree: DSINode, nodeId: string) {
        this.nodeId = nodeId;
        this.theme = theme;

        const selectedNode = tree.find(n => getEntityId(n.data) === nodeId)!;

        this.tree = selectedNode.height
            ? makeTree(
                  selectedNode
                      .children!.map(d => d.data)
                      .concat(selectedNode.data),
                  selectedNode.data
              )
            : makeTree(
                  selectedNode
                      .parent!.children!.map(d => d.data)
                      .concat(selectedNode.parent!.data),
                  selectedNode.parent!.data!
              );

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

        simulation
            .nodes(this.tree.descendants())
            .force(
                'charge',
                forceManyBody()
                    .strength(-50)
                    .distanceMax(this.w / 2)
            )
            .force('links', forceLinks.distance(this.w / 10).strength(1))
            .force('collision', forceCollide().radius(30))
            .force('center', forceCenter())
            .velocityDecay(0.4);

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
                    const outerContainer = enter
                        .append('g')
                        .attr('class', 'circle-node');

                    outerContainer
                        .append('text')
                        .attr('fill', this.theme.palette.text.primary)
                        .attr('opacity', 0)
                        .text(d => d.data.name)
                        .attr('text-anchor', 'middle')
                        .style('user-select', 'none')
                        .transition()
                        .duration(500)
                        .style('opacity', 0.5);

                    const enterNodeSelection = outerContainer
                        .append('g')
                        .attr('class', 'interactive-area');

                    enterNodeSelection
                        .append('circle')
                        .attr('opacity', 0)
                        .attr('r', 15)
                        .attr('fill', d => colorScale(d.data.type))
                        .attr('stroke', d => {
                            return d.children
                                ? this.theme.palette.text.primary
                                : null;
                        })
                        .transition()
                        .duration(500)
                        .attr('opacity', 1);

                    return outerContainer;
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
            //ensure selected nodes are in "front"
            .sort(a => (a.selected ? 1 : -1));

        registerTickHandler(simulation, linkSelection, nodeSelection);
    }
}
