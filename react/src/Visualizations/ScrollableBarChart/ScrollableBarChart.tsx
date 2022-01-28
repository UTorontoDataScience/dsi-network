import React, { useEffect } from 'react';
import { Box, capitalize, Theme, useTheme } from '@mui/material';
import { extent } from 'd3-array';
import { Axis, axisBottom, axisLeft } from 'd3-axis';
import { ScaleBand, scaleBand, ScaleLinear, scaleLinear } from 'd3-scale';
import { select, Selection } from 'd3-selection';
import { D3ZoomEvent, zoom, ZoomBehavior } from 'd3-zoom';

interface ChartData {
    label: string;
    value: number;
}

interface ScrollableBarChartProps {
    data: ChartData[];
}

const ScrollableBarChart: React.FC<ScrollableBarChartProps> = ({ data }) => {
    const id = 'scrollable';

    const theme = useTheme();

    useEffect(() => {
        if (data) {
            new ScrollableBar(`#${id}`, data, theme);
        }
    }, [data, theme]);

    return <Box width="500px" height="500px" id={id} />;
};

class ScrollableBar {
    currentExtent: [number, number] = [0, 10];
    data: ChartData[];
    selector: string;
    svg: Selection<SVGGElement, unknown, HTMLElement, any>;
    h: number;
    theme: Theme;
    w: number;
    xScale: ScaleLinear<number, number, never>;
    yAxis: Axis<string>;
    yMargin: number;
    yScale: ScaleBand<string>;
    zoomBehavior: ZoomBehavior<any, any>;

    constructor(selector: string, data: ChartData[], theme: Theme) {
        this.data = data.sort((a, b) => (a.value < b.value ? 1 : -1));
        this.selector = selector;
        this.theme = theme;
        this.w = 100;
        this.h = 100;
        this.svg = select(this.selector)
            .append('svg')
            .attr('viewBox', [0, 0, this.w, this.h])
            .append('g')
            .attr('stroke-width', 0.1);
        this.yMargin = 25;

        this.xScale = scaleLinear()
            .domain(extent(this.data.map(d => d.value)) as [number, number])
            .range([this.yMargin, this.w]);

        this.svg
            .append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${this.h - 5})`)
            .call(
                axisBottom(this.xScale)
                    .tickSizeInner(2)
                    .tickSizeOuter(0)
                    .tickPadding(1)
            )
            .selectAll('text')
            .style('font-size', 2);

        this.yScale = scaleBand()
            .domain(this.data.slice(...this.currentExtent).map(d => d.label))
            .padding(0.25)
            .range([0, this.h - 5]);

        this.yAxis = axisLeft(this.yScale)
            .tickSizeInner(2)
            .tickPadding(1)
            .offset(-20)
            .tickFormat(v => capitalize(v))
            .offset(-1);

        this.svg
            .append('g')
            .attr('class', 'y-axis')
            .attr('transform', `translate(${this.yMargin},0)`)
            .call(this.yAxis)
            .selectAll('text')
            .style('font-size', 2);

        this.zoomBehavior = zoom().on(
            'zoom',
            (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
                e.sourceEvent.deltaY > 0
                    ? this.incrementChart()
                    : this.decrementChart();
            }
        );
        select<any, any>('svg').call(this.zoomBehavior);

        this.drawRect();
    }

    drawRect = () => {
        this.svg
            .selectAll<SVGRectElement, ChartData>('rect')
            .data(this.data.slice(...this.currentExtent), d => d.label)
            .join('rect')
            .attr('x', this.xScale(0))
            .attr('y', d => this.yScale(d.label)!)
            .attr('height', this.yScale.bandwidth())
            .attr('width', d => this.xScale(d.value) - this.yMargin + 1)
            .attr('fill', this.theme.palette.primary.light)
            .on('click', () => this.incrementChart());
    };

    decrementChart = () => {
        if (this.currentExtent[0] > 0) {
            this.decrementExtent();
            this.redraw();
        }
    };

    decrementExtent = () =>
        (this.currentExtent = this.currentExtent.map(d => d - 1) as [
            number,
            number
        ]);

    incrementChart = () => {
        if (this.currentExtent[1] < this.data.length) {
            this.incrementExtent();
            this.redraw(true);
        }
    };

    incrementExtent = () =>
        (this.currentExtent = this.currentExtent.map(d => d + 1) as [
            number,
            number
        ]);

    redraw = (asc?: boolean) => {
        this.yScale.domain(
            this.data.slice(...this.currentExtent).map(d => d.label)
        );

        this.drawRect();

        this.svg
            .select<any>('.y-axis')
            .selectAll<SVGTextElement, number>('text')
            .data(this.yScale.domain())
            .join('text')
            .text(d => d)
            .attr('y', asc ? -20 : 20)
            .attr('opacity', 0)
            .transition()
            .duration(100)
            .attr('y', 0)
            .attr('opacity', 1)
            .style('font-size', 2);
    };
}

export default ScrollableBarChart;
