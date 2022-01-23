import React, { useEffect, useLayoutEffect, useState } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { pack, HierarchyCircularNode, HierarchyNode } from 'd3-hierarchy';
import { interpolateHcl, interpolateZoom } from 'd3-interpolate';
import { DSINode, ModelEntity, Relationship } from '../../types';
import { groupBy, makeTreeStratify, mapTree } from '../../util';

const PackChart: React.FC<{ entities: ModelEntity[] }> = ({ entities }) => {
    const [HierarchicalData, setHierarchicalData] = useState<DSINode>();

    useLayoutEffect(() => {
        if (HierarchicalData) {
            buildPackChart('test', HierarchicalData, 1000, 1000);
        }
    }, [HierarchicalData]);

    useEffect(() => {
        if (entities) {
            setHierarchicalData(makeTree(entities));
        }
    }, [entities]);

    return <span id="test" />;
};

const makeTree = (model: ModelEntity[]) =>
    makeTreeStratify(
        model,
        model.find(e => e.type === 'campus' && e.id === 1)!
    );

interface DSIPackNode extends DSINode {
    personMap?: Record<keyof Relationship, number>;
}

/* we probably want to map nodes in order to calculate value for each node --> basically it just means groupby/count for child types */
const buildPackChart = (
    id: string,
    data: DSINode,
    width: number,
    height: number
) => {
    const mapped = mapTree<ModelEntity, DSIPackNode>(data, node => {
        const personChildren = (node.children || []).filter(
            n => n.data.type === 'person'
        );

        const nonPersonChildren = (node.children || []).filter(
            n => n.data.type !== 'person'
        );

        if (personChildren) {
            const personMap = Object.fromEntries(
                Object.entries(
                    groupBy(
                        personChildren,
                        (d: HierarchyNode<ModelEntity>) => d.data.relationship!
                    )
                ).map(([k, v]) => [k, v.length])
            );
            (node as DSIPackNode).personMap = personMap as Record<
                keyof Relationship,
                number
            >;
        }

        if (nonPersonChildren.length) {
            node.children = nonPersonChildren;
        }
        return node as DSIPackNode;
    });

    // set `value` to total children count
    const root = mapped.count().sort((a, b) => b.value! - a.value!);

    const packFn = pack<ModelEntity>().size([width, height]).padding(3);

    let focus = root;
    let view: [number, number, number];
    const nodes = packFn(root).descendants();

    const svg = select(`#${id}`)
        .append('svg')
        .attr('viewBox', `-${width / 2} -${height / 2} ${width} ${height}`)
        .style('margin', '0 -14px')
        .style('display', 'block')
        .attr('height', height)
        .attr('width', width)
        .on('click', (_, d) => {
            if (focus !== d) {
                zoom((d as HierarchyCircularNode<ModelEntity>) ?? root);
            }
            focus = root;
        });

    const getLabel = (node: DSIPackNode) => {
        /* const labelVal =
            node.personMap && Object.values(node.personMap).length 
                ? Object.entries(node.personMap).reduce(
                      (acc, [k, v], i) => `${acc}${i && '\n'}${k}:${v}`,
                      ''
                  )
                : `${node.value && node.value > 1 ? `: ${node.value}` : ''}`; */

        return `${node.data.name.split(/" "/g).join('\n')}`;
    };

    const color = scaleLinear()
        .domain([0, 5])
        .range(['hsl(152,80%,80%)', 'hsl(228,30%,40%)'] as any[])
        .interpolate(interpolateHcl as any);

    const node = svg
        .append('g')
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('fill', d => (d.children ? color(1) : 'white'))
        .attr('pointer-events', d => (!d.children ? 'none' : null))
        .attr('r', d => d.r)
        .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
        .on('click', (event, d) => {
            if (focus !== d) {
                zoom(d);
                event.stopPropagation();
            }
        })
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
        .selectAll<SVGTextElement, never>('text')
        .data(root.descendants())
        .join('text')
        .style('fill-opacity', d => (d.parent === focus ? 1 : 0))
        .style('display', d => (d.parent === focus ? 'inline' : 'none'))
        .attr('transform', d => {
            return 'translate(' + d.x + ',' + d.y + ')';
        })
        .style('font-size', '12px')
        .text(d => getLabel(d));

    const zoomTo = (v: [number, number, number]) => {
        const k = width / v[2];

        //global
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

    const zoom = (f: HierarchyCircularNode<ModelEntity>) => {
        focus = f; //global
        const transition = svg
            .transition()
            .duration(500)
            .tween('zoom', () => {
                const i = interpolateZoom(view, [f.x, f.y, f.r * 2]);
                return (t: number) => zoomTo(i(t));
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
