import React, { useEffect, useLayoutEffect, useState } from 'react';
import { select, Selection } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { pack, hierarchy, HierarchyCircularNode } from 'd3-hierarchy';
import { interpolateHcl, interpolateZoom } from 'd3-interpolate';
import getModel, {
    Campus,
    EntityType,
    getKeys,
    HierarchicalLeafNode,
    HierarchicalNode,
    HierarchicalNodeChild,
    HydratedLink,
    hydrateLinks,
    Model,
    ModelEntity,
    Relationship,
} from '../../data/model';

const PackChart: React.FC = () => {
    const [model, setModel] = useState<Model>();
    const [HierarchicalData, setHierarchicalData] =
        useState<HierarchicalNode>();

    useLayoutEffect(() => {
        if (HierarchicalData) {
            buildPackChart('test', HierarchicalData, 600, 1000);
        }
    }, [HierarchicalData]);

    useEffect(() => {
        const _getModel = async () => {
            const model = await getModel();
            setModel(model);
        };
        _getModel();
    }, []);

    useEffect(() => {
        if (model) {
            setHierarchicalData(makeHierarchicalDataWithAggregateLeafs(model));
        }
    }, [model]);

    console.log(HierarchicalData);

    return <span id="test" />;
};

const getLeafs = (links: HydratedLink[], leafType: EntityType) => {
    const counts = links
        .filter(cl => cl.childType === leafType)
        .reduce(
            (acc, curr) => ({
                ...acc,
                [curr.relationship]: acc[curr.relationship]
                    ? acc[curr.relationship] + 1
                    : 1,
            }),
            {} as { [K in Relationship]: number }
        );

    return getKeys(counts).map(k => ({
        relationship: k,
        value: counts[k],
    })) as HierarchicalLeafNode[];
};

const makeNode = (
    root: ModelEntity,
    rootType: EntityType,
    leafType: EntityType,
    relationship: Relationship | 'root',
    links: HydratedLink[]
): HierarchicalNode => {
    const childLinks = links.filter(
        l => l.parentType === rootType && l.parent.id === root.id
    );

    const parents = childLinks.filter(cl => cl.childType !== leafType);

    const res: HierarchicalNode = {
        entity: root,
        relationToParent: relationship,
        type: rootType,
        children: [
            ...parents.map(c =>
                makeNode(c.child, c.childType, leafType, c.relationship, links)
            ),
            ...getLeafs(childLinks, leafType),
        ],
    };

    return res;
};

/* division, unit, program, person, relationship-type-count */
export const makeHierarchicalDataWithAggregateLeafs = (
    model: Model
): HierarchicalNode => {
    const hydratedLinks = hydrateLinks(model);

    //problem is that we need only nodes that have persons as leaves
    //can we use discovery to prune any links that don't have paths to persons?

    const stGeorge = model.campus.find(c => c.name.includes('eorge')) as Campus;

    return makeNode(stGeorge, 'campus', 'person', 'root', hydratedLinks);
};

const buildPackChart = (
    id: string,
    data: HierarchicalNode,
    width: number,
    height: number
) => {
    const root = pack<HierarchicalNode>().size([width, height]).padding(3)(
        hierarchy(data)
            .sum(d => (d as unknown as HierarchicalLeafNode).value)
            .sort((a, b) => b.value! - a.value!)
    );

    let focus = root;
    let view: [number, number, number];

    const svg = select(`#${id}`)
        .append('svg')
        .attr('viewBox', `-${width / 2} -${height / 2} ${width} ${height}`)
        .style('margin', '0 -14px')
        .style('display', 'block')
        .attr('height', height)
        .attr('width', width)
        .on('click', (event, d) => {
            if (focus !== d) {
                zoom(event, root);
            }
            focus = root;
        });

    const getLabel = (node: HierarchicalNodeChild) => {
        if (node.hasOwnProperty('relationship')) {
            return (node as HierarchicalLeafNode).relationship;
        } else if (node.hasOwnProperty('entity')) {
            return (node as HierarchicalNode).entity.name;
        }
    };

    const color = scaleLinear()
        .domain([0, 5])
        // @ts-ignore
        .range(['hsl(152,80%,80%)', 'hsl(228,30%,40%)'])
        // @ts-ignore
        .interpolate(interpolateHcl);

    const node = svg
        .append('g')
        .selectAll('circle')
        .data(root.descendants().slice(1))
        .join('circle')
        .attr('fill', d => (d.children ? color(1) : 'white'))
        .attr('pointer-events', d => (!d.children ? 'none' : null))
        .attr('r', d => d.r)
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
        .on(
            'click',
            (event, d) =>
                focus !== d && (zoom(event, d), event.stopPropagation())
        )
        .on('mouseover', function () {
            select(this).attr('stroke', '#000');
        })
        .on('mouseout', function () {
            select(this).attr('stroke', null);
        });

    const label = svg
        .append('g')
        .style('font', '10px sans-serif')
        .attr('pointer-events', 'none')
        .attr('text-anchor', 'middle')
        .selectAll('text')
        .data(root.descendants())
        .join('text')
        .style('fill-opacity', d => (d.parent === focus ? 1 : 0))
        .style('display', d => {
            return d.parent === focus ? 'inline' : 'none';
        })
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
        .text(d =>
            d.value ? `${getLabel(d.data)}: ${d.value}` : ''
        ) as Selection<
        SVGTextElement,
        HierarchyCircularNode<HierarchicalNode>,
        any,
        any
    >;

    const zoomTo = (v: [number, number, number]) => {
        const k = width / v[2];

        view = v;

        label.attr('transform', d => {
            return `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`;
        });
        node.attr(
            'transform',
            d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`
        );
        node.attr('r', d => d.r * k);
    };

    const zoom = (
        event: MouseEvent,
        d: HierarchyCircularNode<HierarchicalNode>
    ) => {
        focus = d;

        const transition = svg
            .transition()
            .duration(500)
            .tween('zoom', d => {
                const i = interpolateZoom(view, [
                    focus.x,
                    focus.y,
                    focus.r * 2,
                ]);
                return t => zoomTo(i(t));
            });

        label
            .filter(function (d) {
                return d.parent === focus || this.style.display === 'inline';
            })
            .transition(transition as any) // hmmm
            .style('fill-opacity', d => (d.parent === focus ? 1 : 0))
            .on('start', function (d) {
                if (d.parent === focus) this.style.display = 'inline';
            })
            .on('end', function (d) {
                if (d.parent !== focus) this.style.display = 'none';
            });
    };

    zoomTo([root.x, root.y, root.r * 2]); // set view
};

export default PackChart;
