import { capitalize } from '@mui/material';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { BaseType, Selection } from 'd3-selection';
import { EntityType } from '../types';

const entityTypes: EntityType[] = [
    'division',
    'institution',
    'person',
    'program',
    'unit',
];

export const colorScale = scaleOrdinal(
    // remove red, b/c it's close to highlight color
    // remove gray, b/c it's close to dark font
    schemeCategory10.filter((_, i) => ![3, 7].includes(i))
).domain(entityTypes);

export const drawLegend = (
    parentEl: Selection<any, any, any, unknown>,
    fillColor: string,
    strokeColor: string,
    w: number,
    h: number
) => {
    const boxHeight = colorScale.domain().length * 18;

    const container = parentEl
        .append('g')
        .attr('transform', `translate(${w / 2 - 100}, ${h / 2 - boxHeight})`)
        .attr('class', 'control legend-container');

    container
        .append('rect')
        .attr('fill', fillColor)
        .attr('width', '100')
        .attr('height', '130');

    container
        .selectAll('g.legend')
        .data<string>(colorScale.domain())
        .join('g')
        .attr('transform', (_, i) => `translate(8, ${(i + 1) * 15})`)
        .attr('class', 'legend')
        .append('circle')
        .attr('r', 3)
        .attr('fill', d => colorScale(d));

    container
        .selectAll<BaseType, string>('g.legend')
        .append('text')
        .attr('fill', strokeColor)
        .text((d: string) => d && capitalize(d))
        .attr('transform', `translate(8, 5)`);
};
