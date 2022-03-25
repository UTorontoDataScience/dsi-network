import { Theme } from '@mui/material';
import { D3DragEvent, drag } from 'd3-drag';
import { easeCubicIn } from 'd3-ease';
import { HierarchyLink } from 'd3-hierarchy';
import { ScaleLinear, scaleLinear } from 'd3-scale';
import { Selection, BaseType, select, ValueFn } from 'd3-selection';
import {
    D3ZoomEvent,
    zoom,
    ZoomBehavior,
    zoomIdentity,
    zoomTransform,
} from 'd3-zoom';
import 'd3-transition'; // must be imported so selection.transition will resolve
import {
    forceCenter,
    forceCollide,
    forceLink,
    ForceLink,
    forceManyBody,
    forceSimulation,
    Simulation,
    SimulationLinkDatum,
    SimulationNodeDatum,
} from 'd3-force';
import { DSINode, ModelEntity } from '../../types';
import { getEntityId, mapTree } from '../../util';
import { colorScale, drawLegend } from '../shared';

export type DSISimulation = Simulation<DSINode, SimulationLinkDatum<DSINode>>;

type DSIForceLinks = ForceLink<DSINode, SimulationLinkDatum<DSINode>>;

type DSINodeSelection = Selection<SVGGElement, DSINode, BaseType, unknown>;

const getNodeSizeScale = (maxNodes: number) =>
    scaleLinear().domain([0, maxNodes]).range([3.25, 12]);

const getLabelOffsetScale = (maxDistance: number) =>
    scaleLinear().domain([0, maxDistance]).range([0, 50]);

const getLabelXOffset = (x: number, y: number) => {
    const distance = Math.sqrt(x ** 2 + y ** 2);
    const distanceScaled = getLabelOffsetScale(500)(distance);
    return x > 0 ? -distanceScaled : distanceScaled;
};

const getLabelYOffset = (x: number, y: number) => {
    const distance = Math.sqrt(x ** 2 + y ** 2);
    const distanceScaled = getLabelOffsetScale(500)(distance);
    return y > 0 ? -distanceScaled : distanceScaled;
};

/**
 *  Unique key used to identify nodes for d3.join process and mapping simulation links to source/target
 */
export const makeNodeKey = (datum: DSINode) => {
    return `${datum.data.id}-${datum.data.type}-${datum.parent?.data.id}-${datum.data.relationship}-${datum.selected}`;
};

/**
 *  Unique key used to identify links for d3.join process
 */
export const makeLinkKey = <T extends DSINode>(
    link: SimulationLinkDatum<T>
) => {
    const source = link.source as DSINode;
    const target = link.target as DSINode;
    return `${source.data.id}-${source.parent?.id}-${target.selected}-${target.data.id}`;
};

export const buildForceLinks = (links: HierarchyLink<ModelEntity>[]) =>
    forceLink<DSINode, SimulationLinkDatum<DSINode>>(links).id(model =>
        makeNodeKey(model)
    );

const registerTickHandler = (
    simulation: DSISimulation,
    linkSelection: Selection<
        SVGLineElement,
        SimulationLinkDatum<DSINode>,
        BaseType,
        unknown
    >,
    nodeSelection: DSINodeSelection
) => {
    // simulation mutates data bound to nodes by reference
    simulation.on('tick', () => {
        nodeSelection.attr('transform', d => `translate(${d.x}, ${d.y})`);

        nodeSelection
            .selectAll<SVGTextElement, DSINode>('text')
            .attr('x', d => getLabelXOffset(d.x!, d.y!))
            .attr('y', d => getLabelYOffset(d.x!, d.y!));

        linkSelection
            .attr('x1', d => (d.source as DSINode).x!)
            .attr('y1', d => (d.source as DSINode).y!)
            .attr('x2', d => (d.target as DSINode).x!)
            .attr('y2', d => (d.target as DSINode).y!);
    });
};

const registerOnHover = (
    selection: DSINodeSelection,
    nodeSizeScale: ScaleLinear<number, number>
) => {
    selection
        .on('mouseover', function (e: MouseEvent) {
            showToolTip(
                `${e.pageX + 15}px`,
                `${e.pageY - 25}px`,
                (e!.target as any).__data__.data.name
            );
            select(this)
                .selectAll<SVGCircleElement, DSINode>('circle')
                .transition()
                .duration(100)
                .attr('r', d => nodeSizeScale(d.descendants().length) + 5);
        })
        .on('mouseout', function () {
            select(this)
                .selectAll<SVGCircleElement, DSINode>('circle')
                .transition()
                .duration(100)
                .attr('r', d => nodeSizeScale(d.descendants().length));

            hideToolTip();
        });
};

const showToolTip = (x: string, y: string, name: string) => {
    select('.tooltip')
        .style('opacity', 0)
        .text(name)
        .style('left', x)
        .style('top', y)
        .style('visibility', 'visible')
        .transition()
        .duration(300)
        .style('opacity', 1);
};

export const hideToolTip = () =>
    select('.tooltip').style('visibility', 'hidden').style('opacity', 0);

const registerDragHandler = (
    selection: DSINodeSelection,
    simulation: DSISimulation
) => {
    const dragstarted = (
        e: D3DragEvent<SVGGElement, DSINode, unknown>,
        d: DSINode
    ) => {
        simulation.nodes().forEach(n => {
            n.fx = null;
            n.fy = null;
        });
        simulation.alphaTarget(0.1).restart();
        d.fx = d.x;
        d.fy = d.y;
    };

    const dragged = (
        e: D3DragEvent<SVGGElement, DSINode, unknown>,
        d: DSINode
    ) => {
        d.fx = e.x;
        d.fy = e.y;
    };

    const dragended = (
        e: D3DragEvent<SVGGElement, DSINode, unknown>,
        d: DSINode
    ) => {
        if (!e.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    };

    const handler = drag<SVGGElement, DSINode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);

    return handler(selection);
};

const getShouldShowLabel = (n: DSINode, tree: DSINode) =>
    n.descendants().length / tree.descendants().length > 0.05 &&
    ['campus', 'division', 'institution'].includes(n.data.type);

export default class D3ForceGraph {
    private fillColor: string;
    private globalZoom: ZoomBehavior<SVGSVGElement, unknown>;
    private globalZoomHandler: ({
        transform,
    }: D3ZoomEvent<SVGSVGElement, unknown>) => void;
    private h: number;
    private onBackgroundClick: () => void;
    public onNodeClick: (node: DSINode) => void;
    private svg: Selection<SVGSVGElement, unknown, HTMLElement, unknown>;
    simulation: DSISimulation;
    private strokeColor: string;
    tree: DSINode;
    private w: number;
    constructor(
        selector: string,
        theme: Theme,
        tree: DSINode,
        onBackgroundClick: () => void,
        onNodeClick: (node: DSINode) => void
    ) {
        this.fillColor = theme.palette.background.default;
        this.strokeColor = theme.palette.text.primary;
        this.tree = tree;
        this.w = 1000;
        this.h = 725;
        this.svg = select(`#${selector}`)
            .append('svg')
            .attr('class', 'main')
            .attr('viewBox', [-this.w / 2, -this.h / 2, this.w, this.h])
            .style('border', `solid thin ${theme.palette.text.secondary}`);
        this.onNodeClick = onNodeClick;
        this.onBackgroundClick = onBackgroundClick;

        this.simulation = forceSimulation();

        this.svg
            .append('g')
            .attr('stroke-opacity', 0.6)
            .attr('class', 'container line-container');

        this.svg
            .append('g')
            .attr('class', 'container circle-container')
            .attr('stroke-width', 1.5);

        this.globalZoomHandler = ({
            transform,
        }: D3ZoomEvent<SVGSVGElement, unknown>) => {
            this.svg
                .selectAll('.container')
                .attr('transform', transform.toString());
            this.svg
                .select('g.zoom-indicator')
                .selectAll<SVGTextElement, number>('text')
                .data([transform.k || 1])
                .join('text')
                .text(d => `Zoom: ${Math.floor(d * 100).toString()}%`)
                .attr('transform', `translate(2,15)`);
        };
        /* 'global' zoom behavior, will listen on SVG and adjust scale on mouse wheel */
        this.globalZoom = zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 40])
            .on('zoom', this.globalZoomHandler);

        this.svg.call(this.globalZoom);

        const zoomIndicator = this.svg
            .append('g')
            .attr('class', 'control zoom-indicator')
            .attr(
                'transform',
                `translate(${this.w / 2 - 100}, ${-this.h / 2})`
            );

        zoomIndicator
            .append('rect')
            .attr('width', 100)
            .attr('height', 17)
            .attr('fill', this.fillColor);

        zoomIndicator
            .append('text')
            .text('Zoom: 100%')
            .attr('transform', `translate(2, 15)`);

        const that = this;

        this.svg.on('click', function () {
            const currentZoom = zoomTransform(select(this).node()!).k;

            if (currentZoom > 1) {
                that.resetZoom();
            }
            that.onBackgroundClick();
        });

        drawLegend(this.svg, this.fillColor, this.strokeColor, this.w, this.h);
    }

    private appendLinks = (forceLinks: DSIForceLinks) => {
        const selection = this.svg
            .select<SVGGElement>('g.line-container')
            .selectAll<SVGLineElement, SimulationLinkDatum<DSINode>>('line')
            .data(forceLinks.links(), makeLinkKey)
            .join(
                enter => {
                    const enterSelection = enter
                        .append('line')
                        .attr('class', 'chart')
                        .attr('stroke', this.strokeColor);

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

        return selection;
    };

    private appendNodes = (nodes: DSINode[]) => {
        const nodeSelection = this.svg
            .select('g.circle-container')
            .selectAll<SVGGElement, DSINode>('g.circle-node')
            .data(nodes, (d, i) => (d ? makeNodeKey(d) : i))
            .join(
                enter => {
                    const outerContainer = enter
                        .append('g')
                        .attr('class', 'circle-node');

                    outerContainer
                        .filter(n => getShouldShowLabel(n, this.tree))
                        .append('text')
                        .attr('fill', this.strokeColor)
                        .attr('opacity', 0)
                        .text(d => d.data.name)
                        .attr('text-anchor', 'middle')
                        .style('user-select', 'none')
                        .transition()
                        .duration(500)
                        .style('opacity', 0.5);

                    outerContainer.call(registerDragHandler, this.simulation);

                    const enterNodeSelection = outerContainer
                        .append('g')
                        .attr('class', 'interactive-area');

                    enterNodeSelection
                        .append('circle')
                        .attr('opacity', 0.8)
                        .attr('r', d =>
                            getNodeSizeScale(nodes.length)(
                                d.descendants().length
                            )
                        )
                        .attr('fill', d => colorScale(d.data.type))
                        .attr('stroke', d => {
                            return d.children ? this.strokeColor : null;
                        });

                    enterNodeSelection
                        .append('path')
                        .attr('d', 'M -8 0 A 8 8, 0, 1, 0, 0 8 L 0 0 Z')
                        .attr('fill', 'red')
                        .attr('stroke', 'black')
                        .attr('stroke-width', 0)
                        .attr('fill-opacity', 0)
                        .transition()
                        .duration(500)
                        .attr('fill-opacity', d => (d.selected ? 0.8 : 0))
                        .attr('stroke-width', d => (d.selected ? 2 : 0));

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

        nodeSelection
            .selectAll<SVGGElement, DSINode>('g.interactive-area')
            .call(registerOnHover, getNodeSizeScale(nodes.length))
            .call(this.registerNodeClickBehavior, this.svg);

        //ensure labeled groups are in "back" to prevent label text from capturing mouse events intended for nodes
        return nodeSelection.sort(a =>
            getShouldShowLabel(a, this.tree) ? -1 : 1
        );
    };

    private buildSimulation = (
        nodes: DSINode[],
        w: number,
        forceLinks: DSIForceLinks
    ) => {
        return (
            this.simulation
                .nodes(nodes)
                .force(
                    'charge',
                    forceManyBody()
                        .strength(-40)
                        .distanceMax(w / 3)
                )
                .force(
                    'links',
                    forceLinks
                        .distance(d =>
                            (d.target as DSINode)
                                .descendants()
                                .find(
                                    desc =>
                                        desc.depth > (d.target as DSINode).depth
                                )
                                ? w / 6
                                : w / 28
                        )
                        .strength(1)
                )
                .force('collision', forceCollide().radius(5))
                // keep the visualization centered on the page
                .force('center', forceCenter(0, 0))
                .velocityDecay(0.1)
        );
    };

    forceToolTip = (nodeId: string) => {
        const node = this.svg
            .selectAll<SVGGElement, DSINode>('g.circle-node')
            .filter(n => getEntityId(n.data) === nodeId)
            .node();

        if (node) {
            const { right: x, y } = node.getBoundingClientRect();
            const name = (node as any).__data__.data.name;
            showToolTip(`${x}px`, `${y}px`, name);
        }
    };

    private registerNodeClickBehavior = (selection: DSINodeSelection) =>
        selection.on('click', (e, node) => {
            e.stopPropagation();
            hideToolTip();
            this.onNodeClick(node);
        });

    remove = () => this.svg.selectAll('.container').selectAll('*').remove();

    render = () => {
        if (this.tree) {
            const forceLinks = buildForceLinks(this.tree.links());

            this.buildSimulation(this.tree.descendants(), this.w, forceLinks);

            const nodeSelection = this.appendNodes(this.simulation.nodes());

            const linkSelection = this.appendLinks(forceLinks);

            /* if this is a rerender, reheat sim */
            if (this.simulation.alpha() < 1) {
                this.simulation.alpha(1);
                this.simulation.restart();
            }

            registerTickHandler(this.simulation, linkSelection, nodeSelection);
        }
    };

    resetZoom = () =>
        this.svg
            .transition()
            .duration(1000)
            .call(
                this.globalZoom.transform,
                zoomIdentity.translate(0, 0).scale(1)
            );

    toggleTheme = (theme: Theme) => {
        const strokeColor = theme.palette.text.primary;
        this.strokeColor = strokeColor;
        this.fillColor = theme.palette.background.default;

        this.svg.selectAll('line').attr('stroke', this.strokeColor);
        this.svg.selectAll('circle').attr('stroke', function () {
            return select(this).attr('stroke') ? strokeColor : null;
        });
        this.svg.selectAll('text').attr('fill', this.strokeColor);

        this.svg.selectAll('rect').attr('fill', this.fillColor);
    };

    update = (_tree: DSINode) => {
        // map previous locations to new nodes
        const simNodeLocationMap = this.simulation!.nodes().reduce<
            Record<string, SimulationNodeDatum>
        >(
            (acc, curr) => ({
                ...acc,
                [curr.id!]: {
                    x: curr.x,
                    vx: curr.vx,
                    y: curr.y,
                    vy: curr.vy,
                },
            }),
            {}
        );

        const tree: DSINode = mapTree(_tree, n => ({
            ...n,
            ...(simNodeLocationMap[getEntityId(n.data)]
                ? simNodeLocationMap[getEntityId(n.data)]
                : /*  b/c we are inserting/removing only leaf nodes,
                   we can set the starting position to the parent's for a smoother entry transition */
                  simNodeLocationMap[getEntityId(n.parent!.data)]),
        }));

        const forceLinks = buildForceLinks(tree.links());

        // stop sim to prevent timing issues
        this.simulation.stop();

        this.simulation.nodes(tree.descendants());

        // add new links to force
        this.simulation.force(
            'links',
            forceLinks
                .distance(d =>
                    (d.target as DSINode)
                        .descendants()
                        // long links only for links targeting a node with non-person children
                        .filter(d => d.data.type !== 'person')
                        .find(desc => desc.depth > (d.target as DSINode).depth)
                        ? this.w / 6
                        : (d.target as DSINode).data.type == 'person'
                        ? this.w / 75
                        : this.w / 28
                )
                .strength(1)
        );

        const linkSelection = this.appendLinks(forceLinks);
        const nodeSelection = this.appendNodes(this.simulation!.nodes());

        // references have been broken w/ previous data, so we need to reregister handler
        registerTickHandler(this.simulation!, linkSelection, nodeSelection);

        this.simulation.alpha(0.5);
        this.simulation.restart();

        const selectedNodes = this.simulation.nodes().filter(n => n.selected);

        if (selectedNodes.length === 1) {
            this.zoomToNode(selectedNodes[0], 500);
        } else {
            this.resetZoom();
        }
    };

    zoomToNode = (
        node: DSINode,
        delay = 0,
        cb?: ValueFn<SVGSVGElement, unknown, unknown>
    ) => {
        const transition = this.svg.transition().delay(delay).duration(750);
        if (cb) {
            transition.on('end', cb);
        }
        this.globalZoom.transform(
            transition,
            zoomIdentity.translate(0, 0).scale(3).translate(-node.x!, -node.y!)
        );
    };
}
