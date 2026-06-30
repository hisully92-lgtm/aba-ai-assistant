'use client';

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

type ChartTab =
  | 'daily'
  | 'weekly_min'
  | 'weekly_wk'
  | 'monthly'
  | 'yearly'
  | 'per_opportunity'
  | 'timings';

interface DataPoint {
  day: number;
  correct?: number;
  error?: number;
  noOpp?: number;
}

interface TimingEntry {
  trial: number;
  cpm: number;
}

interface PhaseChange {
  day: number;
  label: string;
}

interface AimStar {
  day: number;
  value: number;
  label?: string;
}

export interface SCCProps {
  dataPoints?: DataPoint[];
  timingEntries?: TimingEntry[];
  phaseChanges?: PhaseChange[];
  aimStars?: AimStar[];
  showBounce?: boolean;
  showCeleration?: boolean;
  showFan?: boolean;
  fanInteractive?: boolean;
  performer?: string;
  supervisor?: string;
  advisor?: string;
  manager?: string;
  timer?: string;
  counter?: string;
  charter?: string;
  counted?: string;
  organization?: string;
  division?: string;
  room?: string;
  label?: string;
  countingFloors?: number[];
  initialTab?: ChartTab;
  readOnly?: boolean;
}

const Y_MIN = 0.001;
const Y_MAX = 1000;
const secToCpm = (s: number) => 60 / s;

const TABS: { id: ChartTab; label: string; shortLabel: string; code: string }[] = [
  { id: 'daily',           label: 'Daily per Minute',        shortLabel: 'Daily/min',   code: 'Dpmin-12EC' },
  { id: 'weekly_min',      label: 'Weekly per Minute',       shortLabel: 'Weekly/min',  code: 'Wpmin-4EC' },
  { id: 'weekly_wk',       label: 'Weekly per Week',         shortLabel: 'Weekly/wk',   code: 'Wpwk-3EC' },
  { id: 'monthly',         label: 'Monthly Behavior Chart',  shortLabel: 'Monthly',     code: 'MO-11' },
  { id: 'yearly',          label: 'Yearly Behavior Chart',   shortLabel: 'Yearly',      code: 'YO-12' },
  { id: 'per_opportunity', label: 'Per Opportunity (%)',     shortLabel: 'Per Opp',     code: '' },
  { id: 'timings',         label: 'Timings Chart',           shortLabel: 'Timings',     code: 'Tpmin-3EC' },
];

const FAN_RAYS = [18, 4, 2, 1.4, 1.2];

function computeCeleration(points: { x: number; y: number }[], xPerWeekUnit: number) {
  if (points.length < 2) return null;
  const n = points.length;
  const xs = points.map(p => p.x);
  const ys = points.map(p => Math.log10(p.y));
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  const intercept = my - slope * mx;
  const celPerWeek = Math.pow(10, slope * xPerWeekUnit);
  return { slope, intercept, celPerWeek };
}

function nearestFanRay(celPerWeek: number): number {
  const allRays = [...FAN_RAYS, ...FAN_RAYS.map(r => 1 / r)];
  let nearest = 1;
  let minDist = Infinity;
  allRays.forEach(r => {
    const dist = Math.abs(Math.log10(r) - Math.log10(celPerWeek));
    if (dist < minDist) { minDist = dist; nearest = r; }
  });
  return nearest;
}

function rescaleToUnit(dataPoints: DataPoint[], unit: 'day' | 'week' | 'month' | 'year') {
  if (unit === 'day') return dataPoints.map(d => ({ x: d.day, y: d.correct, e: d.error }));
  const bucketSize = unit === 'week' ? 7 : unit === 'month' ? 30 : 365;
  const buckets = new Map<number, { sum: number; esum: number; count: number }>();
  dataPoints.forEach(d => {
    if (d.correct == null && d.error == null) return;
    const bucketIdx = Math.floor((d.day - 1) / bucketSize);
    const b = buckets.get(bucketIdx) ?? { sum: 0, esum: 0, count: 0 };
    b.sum += d.correct ?? 0;
    b.esum += d.error ?? 0;
    b.count += 1;
    buckets.set(bucketIdx, b);
  });
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([idx, b]) => ({ x: idx + 1, y: b.sum > 0 ? b.sum : undefined, e: b.esum > 0 ? b.esum : undefined }));
}

interface ChartSVGProps {
  tab: ChartTab;
  dataPoints: DataPoint[];
  phaseChanges: PhaseChange[];
  aimStars: AimStar[];
  showBounce: boolean;
  showCeleration: boolean;
  showFan: boolean;
  fanInteractive: boolean;
  countingFloors: number[];
  showCorrect: boolean;
  showError: boolean;
  showNoOpp: boolean;
}

const CYAN = '#1bb8d8';
const CYAN_DARK = '#0e8aa8';
const DOT_COLOR = '#1545c4';
const X_COLOR = '#d62828';

function ChartSVG({
  tab, dataPoints, phaseChanges, aimStars, showBounce, showCeleration,
  showFan, fanInteractive, countingFloors, showCorrect, showError, showNoOpp,
}: ChartSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isPerOpp = tab === 'per_opportunity';

  const config = (() => {
    switch (tab) {
      case 'daily':
        return { unit: 'day' as const, xMax: 140, xUnit: 'days', topMax: 20, topUnit: 'weeks',
          yLabel: 'COUNT PER MINUTE', xLabel: 'SUCCESSIVE CALENDAR DAYS', topLabel: 'SUCCESSIVE CALENDAR WEEKS',
          xPerWeek: 7, fanSide: 'left' as const, showCountingTimes: true, code: 'Dpmin-12EC' };
      case 'weekly_min':
        return { unit: 'week' as const, xMax: 100, xUnit: 'weeks', topMax: 20, topUnit: 'months',
          yLabel: 'COUNT PER MINUTE\n(Middle Frequency of Week)', xLabel: 'CALENDAR WEEKS', topLabel: 'CALENDAR MONTHS',
          xPerWeek: 1, fanSide: 'right' as const, showCountingTimes: false, code: 'Wpmin-4EC' };
      case 'weekly_wk':
        return { unit: 'week' as const, xMax: 100, xUnit: 'weeks', topMax: 20, topUnit: 'months',
          yLabel: 'COUNT PER WEEK', xLabel: 'CALENDAR WEEKS', topLabel: 'CALENDAR MONTHS',
          xPerWeek: 1, fanSide: 'right' as const, showCountingTimes: false, code: 'Wpwk-3EC' };
      case 'monthly':
        return { unit: 'month' as const, xMax: 120, xUnit: 'months', topMax: 10, topUnit: 'years',
          yLabel: 'COUNT PER MONTH', xLabel: 'SUCCESSIVE CALENDAR MONTHS', topLabel: 'CALENDAR YEARS',
          xPerWeek: 1 / 4.345, fanSide: 'right' as const, showCountingTimes: false, code: 'MO-11' };
      case 'yearly':
        return { unit: 'year' as const, xMax: 100, xUnit: 'years', topMax: 10, topUnit: 'decades',
          yLabel: 'COUNT PER YEAR', xLabel: 'SUCCESSIVE CALENDAR YEARS', topLabel: 'CALENDAR DECADES',
          xPerWeek: 1 / 52, fanSide: 'right' as const, showCountingTimes: false, code: 'YO-12' };
      default:
        return { unit: 'day' as const, xMax: 140, xUnit: 'days', topMax: 20, topUnit: 'weeks',
          yLabel: 'PERCENT CORRECT', xLabel: 'SUCCESSIVE CALENDAR DAYS', topLabel: 'SUCCESSIVE CALENDAR WEEKS',
          xPerWeek: 7, fanSide: 'none' as const, showCountingTimes: false, code: '' };
    }
  })();

  const isHighRange = tab === 'monthly' || tab === 'yearly';

  useEffect(() => {
    if (!svgRef.current) return;
    const container = svgRef.current.parentElement;
    const totalW = container ? container.clientWidth : 1100;

    const margin = { top: 110, right: config.fanSide === 'right' ? 130 : (config.showCountingTimes ? 110 : 50),
                      bottom: 70, left: config.fanSide === 'left' ? 110 : 78 };
    const W = Math.max(totalW - 4, 950);
    const H = 740;
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H).style('background', '#fff');

    svg.append('rect').attr('x', 4).attr('y', 4).attr('width', W - 8).attr('height', H - 8)
      .attr('fill', 'none').attr('stroke', '#222').attr('stroke-width', 1.5);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([0, config.xMax]).range([0, innerW]);
    const yDomain = isPerOpp ? [0.1, 100] : isHighRange ? [1, 1000000] : [Y_MIN, Y_MAX];
    const yScale = d3.scaleLog().domain(yDomain).range([innerH, 0]).clamp(true);

    const headerY1 = -92, headerY2 = -64, headerY3 = -38;
    const headerFields = [
      { x0: 0, x1: 0.16, label: 'PERFORMER' },
      { x0: 0.19, x1: 0.27, label: 'AGE' },
      { x0: 0.30, x1: 0.50, label: 'LABEL' },
      { x0: 0.55, x1: 1.0, label: 'COUNTED' },
    ];
    headerFields.forEach(f => {
      const x0 = f.x0 * innerW, x1 = f.x1 * innerW;
      g.append('line').attr('x1', x0).attr('x2', x1).attr('y1', headerY1).attr('y2', headerY1)
        .attr('stroke', CYAN_DARK).attr('stroke-width', 1);
      g.append('text').attr('x', (x0 + x1) / 2).attr('y', headerY1 - 5).attr('text-anchor', 'middle')
        .attr('font-size', 9).attr('font-weight', 600).attr('fill', CYAN_DARK).attr('letter-spacing', '0.5px').text(f.label);
    });

    const topTicks = d3.range(0, config.topMax + 1, Math.max(1, Math.round(config.topMax / 5)));
    topTicks.forEach(t => {
      const x = xScale((t / config.topMax) * config.xMax);
      g.append('text').attr('x', x).attr('y', headerY3).attr('text-anchor', 'middle')
        .attr('font-size', 13).attr('font-weight', 700).attr('fill', CYAN_DARK).text(t.toString());
    });
    const topWords = config.topLabel.split(' ');
    topWords.forEach((word, i) => {
      const pos = (i + 0.5) / topWords.length;
      g.append('text').attr('x', pos * innerW).attr('y', headerY2).attr('text-anchor', 'middle')
        .attr('font-size', 11).attr('font-weight', 700).attr('fill', CYAN_DARK).attr('letter-spacing', '0.5px').text(word);
    });

    g.append('rect').attr('x', 0).attr('y', 0).attr('width', innerW).attr('height', innerH)
      .attr('fill', '#fff').attr('stroke', CYAN_DARK).attr('stroke-width', 1.5);

    const decades = isPerOpp ? [0.1, 1, 10, 100] : isHighRange ? [1, 10, 100, 1000, 10000, 100000, 1000000] : [0.001, 0.01, 0.1, 1, 10, 100, 1000];
    const [yLo, yHi] = yDomain;
    decades.forEach(decade => {
      if (decade > yHi) return;
      for (let m = 1; m <= 9; m++) {
        const val = decade * m;
        if (val < yLo || val > yHi) continue;
        const y = yScale(val);
        const isMajor = m === 1, isMid = m === 5;
        g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', y).attr('y2', y)
          .attr('stroke', CYAN).attr('stroke-width', isMajor ? 1.3 : isMid ? 0.8 : 0.5)
          .attr('opacity', isMajor ? 1 : isMid ? 0.85 : 0.6);
      }
    });

    const yLabelVals = isPerOpp
      ? [0.1, 1, 10, 100]
      : isHighRange
        ? [1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
        : [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000];
    yLabelVals.forEach(val => {
      const y = yScale(val);
      const isMajorLabel = decades.includes(val);
      let txt = val >= 1000 ? val.toLocaleString() : val >= 1 ? val.toString() : val.toString().replace('0.', '.');
      g.append('text').attr('x', -8).attr('y', y + 4).attr('text-anchor', 'end')
        .attr('font-size', isMajorLabel ? 12 : 9).attr('font-weight', isMajorLabel ? 700 : 400)
        .attr('fill', CYAN_DARK).text(txt);
    });
    g.append('text').attr('x', -8).attr('y', innerH + 4).attr('text-anchor', 'end')
      .attr('font-size', 11).attr('font-weight', 700).attr('fill', CYAN_DARK).text('0');

    g.append('text').attr('transform', 'rotate(-90)').attr('x', -innerH / 2).attr('y', -56)
      .attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', 700)
      .attr('fill', CYAN_DARK).attr('letter-spacing', '0.5px').text(config.yLabel.split('\n')[0]);
    if (config.yLabel.includes('\n')) {
      g.append('text').attr('transform', 'rotate(-90)').attr('x', -innerH / 2).attr('y', -42)
        .attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', CYAN_DARK).text(config.yLabel.split('\n')[1]);
    }

    const majorEvery = tab === 'daily' ? 14 : Math.max(1, Math.round(config.xMax / 10));
    const minorStep = tab === 'daily' ? 1 : Math.max(1, Math.round(config.xMax / 100));
    for (let v = 0; v <= config.xMax; v += minorStep) {
      const x = xScale(v);
      const isMajor = v % majorEvery === 0;
      g.append('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH)
        .attr('stroke', CYAN).attr('stroke-width', isMajor ? 1.3 : 0.45).attr('opacity', isMajor ? 1 : 0.55);
    }
    for (let v = 0; v <= config.xMax; v += majorEvery) {
      const x = xScale(v);
      g.append('text').attr('x', x).attr('y', innerH + 16).attr('text-anchor', 'middle')
        .attr('font-size', 10).attr('fill', CYAN_DARK).text(v.toString());
    }
    g.append('text').attr('x', innerW / 2).attr('y', innerH + 38).attr('text-anchor', 'middle')
      .attr('font-size', 12).attr('font-weight', 700).attr('fill', CYAN_DARK).attr('letter-spacing', '0.5px').text(config.xLabel);

    if (config.showCountingTimes) {
      g.append('text').attr('transform', 'rotate(-90)').attr('x', -innerH / 2).attr('y', -innerW - 78)
        .attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 700)
        .attr('fill', CYAN_DARK).attr('letter-spacing', '0.5px').text('COUNTING TIMES');

      const ctLabels = [
        { cpm: 60 / 10, label: "10\" sec" }, { cpm: 60 / 15, label: "15\"" },
        { cpm: 60 / 20, label: "20\"" }, { cpm: 60 / 30, label: "30\"" },
        { cpm: 1, label: "1' min" }, { cpm: 0.5, label: "2'" },
        { cpm: 0.2, label: "5'" }, { cpm: 0.1, label: "10'" }, { cpm: 0.05, label: "20'" },
      ];
      ctLabels.forEach(ct => {
        if (ct.cpm < Y_MIN || ct.cpm > Y_MAX) return;
        const y = yScale(ct.cpm);
        g.append('line').attr('x1', innerW).attr('x2', innerW + 6).attr('y1', y).attr('y2', y)
          .attr('stroke', CYAN_DARK).attr('stroke-width', 1);
        g.append('text').attr('x', innerW + 10).attr('y', y + 3).attr('font-size', 9).attr('fill', CYAN_DARK).text(ct.label);
      });

      const hrsLabels = [
        { cpm: 0.02, label: "50'", hrs: "1\u00b0" }, { cpm: 0.01, label: "100'", hrs: "2\u00b0" },
        { cpm: 0.005, label: "200'", hrs: "4\u00b0" }, { cpm: 0.002, label: "500'", hrs: "8\u00b0" },
        { cpm: 0.001, label: "1000'", hrs: "16\u00b0" },
      ];
      g.append('text').attr('x', innerW + 32).attr('y', yScale(0.025)).attr('font-size', 9)
        .attr('font-weight', 700).attr('fill', CYAN_DARK).text('hrs');
      hrsLabels.forEach(hl => {
        if (hl.cpm < Y_MIN) return;
        const y = yScale(hl.cpm);
        g.append('line').attr('x1', innerW).attr('x2', innerW + 6).attr('y1', y).attr('y2', y)
          .attr('stroke', CYAN_DARK).attr('stroke-width', 1);
        g.append('text').attr('x', innerW + 10).attr('y', y + 3).attr('font-size', 9).attr('fill', CYAN_DARK).text(hl.label);
        g.append('text').attr('x', innerW + 36).attr('y', y + 3).attr('font-size', 8.5).attr('fill', CYAN_DARK).text(`\u2014 ${hl.hrs}`);
      });
    }

    if (config.showCountingTimes && countingFloors.length > 0) {
      countingFloors.forEach(sec => {
        const cpm = secToCpm(sec);
        if (cpm < Y_MIN || cpm > Y_MAX) return;
        const yf = yScale(cpm);
        g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', yf).attr('y2', yf)
          .attr('stroke', '#e8862a').attr('stroke-width', 1.1).attr('stroke-dasharray', '7,4').attr('opacity', 0.85);
      });
    }

    const rescaled = rescaleToUnit(dataPoints, config.unit)
      .filter(d => d.y != null && d.y! > 0) as { x: number; y: number; e?: number }[];

    let celResult: { slope: number; intercept: number; celPerWeek: number } | null = null;
    if (rescaled.length >= 2) {
      celResult = computeCeleration(rescaled.map(d => ({ x: d.x, y: d.y })), config.xPerWeek);
    }

    if (showFan && config.fanSide !== 'none') {
      const fanOriginX = config.fanSide === 'left' ? 0 : innerW;
      const fanOriginY = yScale(1);
      const fanLength = 70;
      const direction = config.fanSide === 'left' ? -1 : 1;

      const nearestRay = celResult ? nearestFanRay(celResult.celPerWeek) : null;

      FAN_RAYS.forEach(mult => {
        [mult, 1 / mult].forEach(rayMult => {
          const angle = Math.atan2(Math.log10(rayMult), 1) * 0.55;
          const dx = direction * fanLength * Math.cos(angle);
          const dy = -fanLength * Math.sin(angle) * 2.2;
          const isNearest = fanInteractive && nearestRay != null &&
            Math.abs(Math.log10(nearestRay) - Math.log10(rayMult)) < 0.001;

          g.append('line')
            .attr('x1', fanOriginX).attr('y1', fanOriginY)
            .attr('x2', fanOriginX + dx).attr('y2', fanOriginY + dy)
            .attr('stroke', isNearest ? '#e8862a' : CYAN_DARK)
            .attr('stroke-width', isNearest ? 2.6 : 0.9)
            .attr('opacity', isNearest ? 1 : 0.65);

          g.append('text')
            .attr('x', fanOriginX + dx + direction * 4)
            .attr('y', fanOriginY + dy)
            .attr('font-size', isNearest ? 9.5 : 7.5)
            .attr('font-weight', isNearest ? 700 : 400)
            .attr('fill', isNearest ? '#e8862a' : CYAN_DARK)
            .attr('text-anchor', config.fanSide === 'left' ? 'end' : 'start')
            .text(rayMult >= 1 ? `\u00d7${rayMult}` : `/${(1 / rayMult).toFixed(1)}`);
        });
      });

      g.append('text')
        .attr('x', fanOriginX + direction * (fanLength + 14))
        .attr('y', fanOriginY - fanLength * 1.3)
        .attr('font-size', 8).attr('font-weight', 700).attr('fill', CYAN_DARK)
        .attr('text-anchor', config.fanSide === 'left' ? 'end' : 'start')
        .text('Standard');
      g.append('text')
        .attr('x', fanOriginX + direction * (fanLength + 14))
        .attr('y', fanOriginY - fanLength * 1.3 + 10)
        .attr('font-size', 8).attr('font-weight', 700).attr('fill', CYAN_DARK)
        .attr('text-anchor', config.fanSide === 'left' ? 'end' : 'start')
        .text('celeration');
    }

    phaseChanges.forEach(pc => {
      const x = xScale(pc.day);
      g.append('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH)
        .attr('stroke', '#222').attr('stroke-width', 1.8);
      g.append('text').attr('x', x + 3).attr('y', 14).attr('font-size', 10)
        .attr('fill', '#222').attr('font-weight', 600).text(pc.label);
    });

    aimStars.forEach(as => {
      const x = xScale(as.day);
      const y = yScale(as.value);
      g.append('text').attr('x', x).attr('y', y + 6).attr('text-anchor', 'middle')
        .attr('font-size', 18).attr('fill', '#e8a020').text('\u2605');
      if (as.label) {
        g.append('text').attr('x', x).attr('y', y - 10).attr('text-anchor', 'middle')
          .attr('font-size', 10).attr('fill', '#b87000').attr('font-weight', 600).text(as.label);
      }
    });

    if (showCeleration && celResult && rescaled.length >= 2) {
      const xStart = rescaled[0].x, xEnd = rescaled[rescaled.length - 1].x;
      const yStart = Math.pow(10, celResult.intercept + celResult.slope * xStart);
      const yEnd = Math.pow(10, celResult.intercept + celResult.slope * xEnd);
      g.append('line')
        .attr('x1', xScale(xStart)).attr('x2', xScale(xEnd))
        .attr('y1', yScale(Math.max(yStart, yLo))).attr('y2', yScale(Math.max(yEnd, yLo)))
        .attr('stroke', '#1545c4').attr('stroke-width', 2.5);
      const celLabel = celResult.celPerWeek >= 1
        ? `\u00d7${celResult.celPerWeek.toFixed(2)}/wk` : `\u00f7${(1 / celResult.celPerWeek).toFixed(2)}/wk`;
      g.append('text')
        .attr('x', xScale((xStart + xEnd) / 2))
        .attr('y', yScale(Math.pow(10, celResult.intercept + celResult.slope * (xStart + xEnd) / 2)) - 10)
        .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#1545c4').attr('font-weight', 700).text(celLabel);
    }

    if (showBounce && celResult && rescaled.length >= 3) {
      const residuals = rescaled.map(p => Math.log10(p.y) - Math.log10(Math.pow(10, celResult!.intercept + celResult!.slope * p.x)));
      const maxRes = Math.max(...residuals), minRes = Math.min(...residuals);
      const xStart = rescaled[0].x, xEnd = rescaled[rescaled.length - 1].x;
      [maxRes, minRes].forEach(offset => {
        const y1b = Math.pow(10, celResult!.intercept + celResult!.slope * xStart + offset);
        const y2b = Math.pow(10, celResult!.intercept + celResult!.slope * xEnd + offset);
        g.append('line')
          .attr('x1', xScale(xStart)).attr('x2', xScale(xEnd))
          .attr('y1', yScale(Math.max(y1b, yLo))).attr('y2', yScale(Math.max(y2b, yLo)))
          .attr('stroke', '#1545c4').attr('stroke-width', 1).attr('stroke-dasharray', '5,4').attr('opacity', 0.6);
      });
    }

    if (tab === 'daily') {
      dataPoints.forEach(dp => {
        const x = xScale(dp.day);
        if (showCorrect && dp.correct != null && dp.correct > 0) {
          g.append('circle').attr('cx', x).attr('cy', yScale(dp.correct)).attr('r', 4.5).attr('fill', DOT_COLOR);
        }
        if (showError && dp.error != null && dp.error > 0) {
          const yE = yScale(dp.error), r = 5.5;
          g.append('line').attr('x1', x - r).attr('x2', x + r).attr('y1', yE - r).attr('y2', yE + r).attr('stroke', X_COLOR).attr('stroke-width', 2.2);
          g.append('line').attr('x1', x + r).attr('x2', x - r).attr('y1', yE - r).attr('y2', yE + r).attr('stroke', X_COLOR).attr('stroke-width', 2.2);
        }
        if (showNoOpp && dp.noOpp != null && dp.noOpp > 0) {
          g.append('circle').attr('cx', x).attr('cy', yScale(dp.noOpp)).attr('r', 4.5).attr('fill', 'none').attr('stroke', DOT_COLOR).attr('stroke-width', 1.8);
        }
      });
    } else if (isPerOpp) {
      dataPoints.forEach(dp => {
        if (showCorrect && dp.correct != null) {
          const pct = Math.max(dp.correct, 0.1);
          g.append('circle').attr('cx', xScale(dp.day)).attr('cy', yScale(pct)).attr('r', 4.5).attr('fill', DOT_COLOR);
        }
      });
    } else {
      rescaled.forEach(d => {
        if (showCorrect) {
          g.append('circle').attr('cx', xScale(d.x)).attr('cy', yScale(d.y)).attr('r', 4.5).attr('fill', DOT_COLOR);
        }
        if (showError && d.e) {
          const yE = yScale(d.e), x = xScale(d.x), r = 5.5;
          g.append('line').attr('x1', x - r).attr('x2', x + r).attr('y1', yE - r).attr('y2', yE + r).attr('stroke', X_COLOR).attr('stroke-width', 2.2);
          g.append('line').attr('x1', x + r).attr('x2', x - r).attr('y1', yE - r).attr('y2', yE + r).attr('stroke', X_COLOR).attr('stroke-width', 2.2);
        }
      });
    }

  }, [tab, dataPoints, phaseChanges, aimStars, showBounce, showCeleration, showFan, fanInteractive, countingFloors, showCorrect, showError, showNoOpp]);

  return (
    <div className="w-full overflow-x-auto bg-white">
      <svg ref={svgRef} className="block" />
    </div>
  );
}

function TimingsChartSVG({ entries, countingFloors }: { entries: TimingEntry[]; countingFloors: number[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const container = svgRef.current.parentElement;
    const totalW = container ? container.clientWidth : 1100;
    const margin = { top: 90, right: 110, bottom: 60, left: 78 };
    const W = Math.max(totalW - 4, 900);
    const H = 600;
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H).style('background', '#fff');
    svg.append('rect').attr('x', 4).attr('y', 4).attr('width', W - 8).attr('height', H - 8).attr('fill', 'none').attr('stroke', '#222').attr('stroke-width', 1.5);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xMax = Math.max(10, entries.length + 2);
    const xScale = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);
    const yScale = d3.scaleLog().domain([2, 500]).range([innerH, 0]).clamp(true);

    g.append('text').attr('x', innerW / 2).attr('y', -40).attr('text-anchor', 'middle')
      .attr('font-size', 14).attr('font-weight', 700).attr('fill', CYAN_DARK).text('TIMINGS CHART');

    g.append('rect').attr('x', 0).attr('y', 0).attr('width', innerW).attr('height', innerH).attr('fill', '#fff').attr('stroke', CYAN_DARK).attr('stroke-width', 1.5);

    const decades = [1, 10, 100];
    decades.forEach(decade => {
      for (let m = 1; m <= 9; m++) {
        const val = decade * m;
        if (val < 2 || val > 500) continue;
        const y = yScale(val);
        g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', y).attr('y2', y)
          .attr('stroke', CYAN).attr('stroke-width', m === 1 ? 1.3 : m === 5 ? 0.8 : 0.5).attr('opacity', m === 1 ? 1 : 0.7);
      }
    });
    [2, 5, 10, 50, 100, 500].forEach(val => {
      g.append('text').attr('x', -8).attr('y', yScale(val) + 4).attr('text-anchor', 'end')
        .attr('font-size', 11).attr('font-weight', 700).attr('fill', CYAN_DARK).text(val.toString());
    });
    g.append('text').attr('transform', 'rotate(-90)').attr('x', -innerH / 2).attr('y', -52)
      .attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', 700).attr('fill', CYAN_DARK).text('COUNT PER MINUTE');

    for (let v = 0; v <= xMax; v++) {
      const x = xScale(v);
      g.append('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH)
        .attr('stroke', CYAN).attr('stroke-width', v % 10 === 0 ? 1.3 : 0.45).attr('opacity', v % 10 === 0 ? 1 : 0.55);
    }
    g.append('text').attr('x', innerW / 2).attr('y', innerH + 36).attr('text-anchor', 'middle')
      .attr('font-size', 12).attr('font-weight', 700).attr('fill', CYAN_DARK).text('SUCCESSIVE TIMINGS');

    const ctLabels = [
      { cpm: 60 / 10, label: '10 sec' }, { cpm: 60 / 15, label: '15 sec' },
      { cpm: 60 / 20, label: '20 sec' }, { cpm: 60 / 30, label: '30 sec' },
      { cpm: 1, label: '1 min' }, { cpm: 0.5, label: '2 min' },
      { cpm: 1 / 3, label: '3 min' }, { cpm: 0.2, label: '5 min' },
    ];
    g.append('text').attr('transform', 'rotate(-90)').attr('x', -innerH / 2).attr('y', -innerW - 70)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', 700).attr('fill', CYAN_DARK).text('COUNTING FLOORS');
    ctLabels.forEach(ct => {
      if (ct.cpm < 2 || ct.cpm > 500) return;
      const y = yScale(ct.cpm);
      g.append('line').attr('x1', innerW).attr('x2', innerW + 6).attr('y1', y).attr('y2', y).attr('stroke', CYAN_DARK).attr('stroke-width', 1);
      g.append('text').attr('x', innerW + 10).attr('y', y + 3).attr('font-size', 9).attr('fill', CYAN_DARK).text(ct.label);
    });

    countingFloors.forEach(sec => {
      const cpm = secToCpm(sec);
      if (cpm < 2 || cpm > 500) return;
      const yf = yScale(cpm);
      g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', yf).attr('y2', yf)
        .attr('stroke', '#e8862a').attr('stroke-width', 1.1).attr('stroke-dasharray', '7,4').attr('opacity', 0.85);
    });

    entries.forEach(e => {
      const x = xScale(e.trial);
      const y = yScale(Math.max(e.cpm, 2));
      g.append('circle').attr('cx', x).attr('cy', y).attr('r', 4.5).attr('fill', DOT_COLOR);
    });

  }, [entries, countingFloors]);

  return (
    <div className="w-full overflow-x-auto bg-white">
      <svg ref={svgRef} className="block" />
    </div>
  );
}

function CountingFloorPanel() {
  const floors = [
    { sec: 1, label: '1 second', note: '60/min' }, { sec: 2, label: '2 seconds', note: '30/min' },
    { sec: 3, label: '3 seconds', note: '20/min' }, { sec: 5, label: '5 seconds', note: '12/min' },
    { sec: 10, label: '10 seconds', note: '6/min' }, { sec: 15, label: '15 seconds', note: '4/min' },
    { sec: 20, label: '20 seconds', note: '3/min' }, { sec: 30, label: '30 seconds', note: '2/min' },
    { sec: 60, label: '1 minute', note: '1/min (baseline)' }, { sec: 120, label: '2 minutes', note: '0.5/min' },
    { sec: 300, label: '5 minutes', note: '0.2/min' }, { sec: 600, label: '10 minutes', note: '0.1/min' },
    { sec: 1440, label: 'Full day', note: '~0.001/min' },
  ];
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-3 text-sm">Counting Floor Reference</h3>
      <p className="text-xs text-blue-700 mb-3">
        Formula: <strong>Floor (cpm) = 60 \u00f7 timing period (seconds)</strong>. The longer you observe, the lower your timing floor drops on the chart.
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {floors.map(f => (
          <div key={f.sec} className="flex items-center gap-2 text-xs">
            <span className="w-20 text-blue-800 font-medium">{f.label}</span>
            <span className="text-blue-600">\u2192</span>
            <span className="font-mono text-blue-900">{f.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const INFO_FIELDS = [
  ['supervisor', 'Supervisor'], ['advisor', 'Advisor'], ['manager', 'Manager'], ['timer', 'Timer'],
  ['counter', 'Counter'], ['charter', 'Charter'], ['performer', 'Performer'], ['counted', 'Counted'],
  ['organization', 'Organization'], ['division', 'Division'], ['room', 'Room'], ['label', 'Label / Behavior'],
];

function InfoFields({ values, onChange, readOnly }: { values: Record<string, string>; onChange: (k: string, v: string) => void; readOnly: boolean }) {
  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-800 mb-2">Chart Information</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
        {INFO_FIELDS.map(([key, label]) => (
          <div key={key} className="flex flex-col gap-0.5">
            <label className="text-xs text-amber-700">{label}</label>
            {readOnly ? (
              <span className="text-xs font-medium text-amber-900 border-b border-amber-300 pb-0.5 min-h-[20px]">{values[key] || ''}</span>
            ) : (
              <input type="text" value={values[key] || ''} onChange={e => onChange(key, e.target.value)}
                className="text-xs border border-amber-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:border-amber-500" placeholder={label} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DataEntry({ tab, dataPoints, onAdd, onRemove }: { tab: ChartTab; dataPoints: DataPoint[]; onAdd: (p: DataPoint) => void; onRemove: (d: number) => void }) {
  const [day, setDay] = useState('');
  const [correct, setCorrect] = useState('');
  const [error, setError] = useState('');
  const [noOpp, setNoOpp] = useState('');
  const isPerOpp = tab === 'per_opportunity';

  const handleAdd = () => {
    const d = parseInt(day);
    if (!d || d < 1) return;
    const pt: DataPoint = { day: d };
    if (isPerOpp) {
      pt.correct = parseFloat(correct) || undefined;
    } else {
      pt.correct = parseFloat(correct) || undefined;
      pt.error = parseFloat(error) || undefined;
      pt.noOpp = parseFloat(noOpp) || undefined;
    }
    onAdd(pt);
    setDay(''); setCorrect(''); setError(''); setNoOpp('');
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">Add Data Point (Day, count per minute)</p>
      <p className="text-xs text-gray-400 mb-2">Entered on the daily scale \u2014 automatically aggregated for weekly/monthly/yearly charts.</p>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-gray-500">Day</label>
          <input type="number" value={day} onChange={e => setDay(e.target.value)} className="w-16 text-xs border rounded px-1 py-1" placeholder="1" />
        </div>
        {isPerOpp ? (
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-gray-500">% Correct</label>
            <input type="number" value={correct} onChange={e => setCorrect(e.target.value)} className="w-20 text-xs border rounded px-1 py-1" placeholder="0-100" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500">Correct</label>
              <input type="number" value={correct} onChange={e => setCorrect(e.target.value)} className="w-20 text-xs border rounded px-1 py-1" placeholder="cpm" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500">Error</label>
              <input type="number" value={error} onChange={e => setError(e.target.value)} className="w-20 text-xs border rounded px-1 py-1" placeholder="cpm" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500">No Opp</label>
              <input type="number" value={noOpp} onChange={e => setNoOpp(e.target.value)} className="w-20 text-xs border rounded px-1 py-1" placeholder="cpm" />
            </div>
          </>
        )}
        <button onClick={handleAdd} className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 self-end">+ Add</button>
      </div>
      {dataPoints.length > 0 && (
        <div className="mt-3 max-h-32 overflow-y-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-gray-500 text-left border-b"><th className="pr-3">Day</th>{isPerOpp ? <th>% Correct</th> : <><th>Correct</th><th>Error</th><th>NoOpp</th></>}<th></th></tr></thead>
            <tbody>
              {[...dataPoints].sort((a, b) => a.day - b.day).map(dp => (
                <tr key={dp.day} className="border-b border-gray-100">
                  <td className="pr-3 py-0.5">{dp.day}</td>
                  {isPerOpp ? <td>{dp.correct ?? '-'}</td> : <><td>{dp.correct ?? '-'}</td><td>{dp.error ?? '-'}</td><td>{dp.noOpp ?? '-'}</td></>}
                  <td><button onClick={() => onRemove(dp.day)} className="text-red-400 hover:text-red-600 text-xs">x</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TimingsDataEntry({ entries, onAdd, onRemove }: { entries: TimingEntry[]; onAdd: (e: TimingEntry) => void; onRemove: (t: number) => void }) {
  const [cpm, setCpm] = useState('');

  const handleAdd = () => {
    const val = parseFloat(cpm);
    if (!val || val <= 0) return;
    const nextTrial = entries.length > 0 ? Math.max(...entries.map(e => e.trial)) + 1 : 1;
    onAdd({ trial: nextTrial, cpm: val });
    setCpm('');
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">Add Timing (successive trial)</p>
      <div className="flex gap-2 items-end">
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-gray-500">Count per minute</label>
          <input type="number" value={cpm} onChange={e => setCpm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="w-24 text-xs border rounded px-1 py-1" placeholder="e.g. 45" />
        </div>
        <button onClick={handleAdd} className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 self-end">+ Add Next Timing</button>
      </div>
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {entries.map(e => (
            <span key={e.trial} className="flex items-center gap-1 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">
              #{e.trial}: {e.cpm} cpm
              <button onClick={() => onRemove(e.trial)} className="text-red-400 hover:text-red-600">x</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseChangeEditor({ phaseChanges, onAdd, onRemove }: { phaseChanges: PhaseChange[]; onAdd: (p: PhaseChange) => void; onRemove: (d: number) => void }) {
  const [day, setDay] = useState('');
  const [label, setLabel] = useState('');
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">Phase Changes</p>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex flex-col gap-0.5"><label className="text-xs text-gray-500">Day</label>
          <input type="number" value={day} onChange={e => setDay(e.target.value)} className="w-16 text-xs border rounded px-1 py-1" placeholder="1" /></div>
        <div className="flex flex-col gap-0.5"><label className="text-xs text-gray-500">Label</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} className="w-32 text-xs border rounded px-1 py-1" placeholder="e.g. Intervention A" /></div>
        <button onClick={() => { if (day && label) { onAdd({ day: parseInt(day), label }); setDay(''); setLabel(''); } }}
          className="bg-gray-600 text-white text-xs px-3 py-1 rounded hover:bg-gray-700 self-end">+ Add</button>
      </div>
      {phaseChanges.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {phaseChanges.map(pc => (
            <span key={pc.day} className="flex items-center gap-1 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">
              Day {pc.day}: {pc.label}<button onClick={() => onRemove(pc.day)} className="text-red-400 hover:text-red-600">x</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AimStarEditor({ aimStars, onAdd, onRemove }: { aimStars: AimStar[]; onAdd: (a: AimStar) => void; onRemove: (d: number) => void }) {
  const [day, setDay] = useState('');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-yellow-800 mb-2">Aim Stars</p>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex flex-col gap-0.5"><label className="text-xs text-yellow-700">Day</label>
          <input type="number" value={day} onChange={e => setDay(e.target.value)} className="w-16 text-xs border rounded px-1 py-1" placeholder="1" /></div>
        <div className="flex flex-col gap-0.5"><label className="text-xs text-yellow-700">Target (cpm)</label>
          <input type="number" value={value} onChange={e => setValue(e.target.value)} className="w-20 text-xs border rounded px-1 py-1" placeholder="e.g. 50" /></div>
        <div className="flex flex-col gap-0.5"><label className="text-xs text-yellow-700">Label</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} className="w-24 text-xs border rounded px-1 py-1" placeholder="Aim" /></div>
        <button onClick={() => { if (day && value) { onAdd({ day: parseInt(day), value: parseFloat(value), label }); setDay(''); setValue(''); setLabel(''); } }}
          className="bg-yellow-600 text-white text-xs px-3 py-1 rounded hover:bg-yellow-700 self-end">+ Add</button>
      </div>
      {aimStars.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {aimStars.map(as => (
            <span key={as.day} className="flex items-center gap-1 bg-yellow-200 text-yellow-800 text-xs px-2 py-0.5 rounded">
              Day {as.day} @ {as.value} {as.label && `(${as.label})`}
              <button onClick={() => onRemove(as.day)} className="text-red-400 hover:text-red-600">x</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const TAB_DESCRIPTIONS: Record<ChartTab, string> = {
  daily: 'Daily per Minute Chart (Dpmin-12EC) - the standard SCC. Plots count per minute over 140 successive calendar days, 6-cycle log scale. Includes the celeration fan (left) and counting times scale (right).',
  weekly_min: 'Weekly per Minute Chart (Wpmin-4EC) - middle frequency of the week, plotted across 100 calendar weeks / 20 months. Includes the celeration fan (right).',
  weekly_wk: 'Weekly per Week Chart (Wpwk-3EC) - total count for the week, plotted across 100 calendar weeks / 20 months. Includes the celeration fan (right).',
  monthly: 'Monthly Behavior Chart (MO-11) - count per month, plotted across 120 successive calendar months / 10 years.',
  yearly: 'Yearly Behavior Chart (YO-12) - count per year, plotted across 100 successive calendar years / 10 decades.',
  per_opportunity: 'Per Opportunity (%) chart - percentage correct across discrete trials.',
  timings: 'Timings Chart (Tpmin-3EC) - plots count per minute across successive individual timings/trials rather than calendar days.',
};

export default function StandardCelerationChart({
  dataPoints: initialDataPoints = [],
  timingEntries: initialTimingEntries = [],
  phaseChanges: initialPhaseChanges = [],
  aimStars: initialAimStars = [],
  showBounce: initialBounce = false,
  showCeleration: initialCeleration = true,
  showFan: initialFan = true,
  fanInteractive: initialFanInteractive = false,
  countingFloors: initialFloors = [15, 30, 60],
  initialTab = 'daily',
  readOnly = false,
  performer = '', supervisor = '', advisor = '', manager = '', timer = '', counter = '',
  charter = '', counted = '', organization = '', division = '', room = '', label = '',
}: SCCProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>(initialTab);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>(initialDataPoints);
  const [timingEntries, setTimingEntries] = useState<TimingEntry[]>(initialTimingEntries);
  const [phaseChanges, setPhaseChanges] = useState<PhaseChange[]>(initialPhaseChanges);
  const [aimStars, setAimStars] = useState<AimStar[]>(initialAimStars);
  const [showBounce, setShowBounce] = useState(initialBounce);
  const [showCeleration, setShowCeleration] = useState(initialCeleration);
  const [showFan, setShowFan] = useState(initialFan);
  const [fanInteractive, setFanInteractive] = useState(initialFanInteractive);
  const [showCorrect, setShowCorrect] = useState(true);
  const [showError, setShowError] = useState(true);
  const [showNoOpp, setShowNoOpp] = useState(true);
  const [showFloorPanel, setShowFloorPanel] = useState(false);
  const [showInfoFields, setShowInfoFields] = useState(false);
  const [showDataEntry, setShowDataEntry] = useState(false);
  const [showPhaseEditor, setShowPhaseEditor] = useState(false);
  const [showAimEditor, setShowAimEditor] = useState(false);
  const [activeFloors, setActiveFloors] = useState<number[]>(initialFloors);
  const [floorInput, setFloorInput] = useState('');
  const [infoValues, setInfoValues] = useState<Record<string, string>>({
    supervisor, advisor, manager, timer, counter, charter, performer, counted, organization, division, room, label,
  });

  const handleInfoChange = (key: string, val: string) => setInfoValues(prev => ({ ...prev, [key]: val }));
  const addFloor = () => {
    const sec = parseInt(floorInput);
    if (sec > 0 && !activeFloors.includes(sec)) setActiveFloors(prev => [...prev, sec].sort((a, b) => a - b));
    setFloorInput('');
  };
  const removeFloor = (sec: number) => setActiveFloors(prev => prev.filter(f => f !== sec));

  const isPerOpp = activeTab === 'per_opportunity';
  const isTimings = activeTab === 'timings';
  const currentTabInfo = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="flex flex-col gap-4 font-sans">
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border border-b-0 transition-colors ${
              activeTab === t.id ? 'bg-white border-gray-300 text-blue-700 font-semibold -mb-px relative z-10' : 'bg-gray-100 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            }`}>
            {t.shortLabel}
          </button>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-800">
        {currentTabInfo.code && <span className="font-mono font-semibold mr-2">[{currentTabInfo.code}]</span>}
        {TAB_DESCRIPTIONS[activeTab]}
      </div>

      <div className="border border-gray-300 rounded-lg bg-white p-2">
        {isTimings ? (
          <TimingsChartSVG entries={timingEntries} countingFloors={activeFloors} />
        ) : (
          <ChartSVG
            tab={activeTab} dataPoints={dataPoints} phaseChanges={phaseChanges} aimStars={aimStars}
            showBounce={showBounce} showCeleration={showCeleration} showFan={showFan} fanInteractive={fanInteractive}
            countingFloors={activeFloors} showCorrect={showCorrect} showError={showError} showNoOpp={showNoOpp}
          />
        )}
      </div>

      {!isTimings && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-2 items-center text-xs">
            <span className="text-gray-500 font-medium">Show:</span>
            {!isPerOpp && activeTab === 'daily' && (
              <>
                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showCorrect} onChange={e => setShowCorrect(e.target.checked)} /><span className="text-blue-700">Correct</span></label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showError} onChange={e => setShowError(e.target.checked)} /><span className="text-red-600">Error</span></label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showNoOpp} onChange={e => setShowNoOpp(e.target.checked)} /><span className="text-gray-500">No Opp</span></label>
              </>
            )}
            <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showCeleration} onChange={e => setShowCeleration(e.target.checked)} /><span className="text-green-700">Celeration line</span></label>
            <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showBounce} onChange={e => setShowBounce(e.target.checked)} /><span className="text-green-600">Bounce lines</span></label>
            {!isPerOpp && (
              <>
                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showFan} onChange={e => setShowFan(e.target.checked)} /><span className="text-cyan-700">Celeration fan</span></label>
                {showFan && (
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={fanInteractive} onChange={e => setFanInteractive(e.target.checked)} /><span className="text-orange-600">Highlight nearest ray</span></label>
                )}
              </>
            )}
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            {activeTab === 'daily' && (
              <button onClick={() => setShowFloorPanel(p => !p)} className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Timing Floors {activeFloors.length > 0 ? `(${activeFloors.length})` : ''}</button>
            )}
            <button onClick={() => setShowDataEntry(p => !p)} className="text-xs px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Data</button>
            <button onClick={() => setShowPhaseEditor(p => !p)} className="text-xs px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Phase Changes</button>
            <button onClick={() => setShowAimEditor(p => !p)} className="text-xs px-3 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Aim Stars</button>
            <button onClick={() => setShowInfoFields(p => !p)} className="text-xs px-3 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200">Info Fields</button>
          </div>
        </div>
      )}

      {isTimings && (
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => setShowFloorPanel(p => !p)} className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 ml-auto">Counting Floors {activeFloors.length > 0 ? `(${activeFloors.length})` : ''}</button>
          <button onClick={() => setShowDataEntry(p => !p)} className="text-xs px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Data</button>
        </div>
      )}

      {showFloorPanel && (
        <div className="flex flex-col gap-3">
          <CountingFloorPanel />
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-800 mb-2">Active Timing Floors on Chart</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {activeFloors.map(sec => (
                <span key={sec} className="flex items-center gap-1 bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded">
                  {sec}s ({(60 / sec).toFixed(sec < 10 ? 1 : 0)}/min)<button onClick={() => removeFloor(sec)} className="text-red-400 hover:text-red-600">x</button>
                </span>
              ))}
              {activeFloors.length === 0 && <span className="text-xs text-blue-500">No floors displayed</span>}
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-blue-700">Add floor (seconds)</label>
                <input type="number" value={floorInput} onChange={e => setFloorInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFloor()}
                  className="w-24 text-xs border border-blue-300 rounded px-1 py-1" placeholder="e.g. 20" />
              </div>
              <button onClick={addFloor} className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 self-end">+ Add</button>
              <div className="flex flex-wrap gap-1 self-end">
                {[10, 15, 20, 30, 60, 120].map(s => !activeFloors.includes(s) && (
                  <button key={s} onClick={() => setActiveFloors(prev => [...prev, s].sort((a, b) => a - b))}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200">{s}s</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDataEntry && !isTimings && (
        <DataEntry tab={activeTab} dataPoints={dataPoints}
          onAdd={pt => setDataPoints(prev => [...prev.filter(p => p.day !== pt.day), pt].sort((a, b) => a.day - b.day))}
          onRemove={d => setDataPoints(prev => prev.filter(p => p.day !== d))} />
      )}

      {showDataEntry && isTimings && (
        <TimingsDataEntry entries={timingEntries}
          onAdd={e => setTimingEntries(prev => [...prev, e])}
          onRemove={t => setTimingEntries(prev => prev.filter(e => e.trial !== t))} />
      )}

      {showPhaseEditor && !isTimings && (
        <PhaseChangeEditor phaseChanges={phaseChanges}
          onAdd={pc => setPhaseChanges(prev => [...prev.filter(p => p.day !== pc.day), pc].sort((a, b) => a.day - b.day))}
          onRemove={d => setPhaseChanges(prev => prev.filter(p => p.day !== d))} />
      )}

      {showAimEditor && !isTimings && (
        <AimStarEditor aimStars={aimStars}
          onAdd={as => setAimStars(prev => [...prev.filter(a => a.day !== as.day), as].sort((a, b) => a.day - b.day))}
          onRemove={d => setAimStars(prev => prev.filter(a => a.day !== d))} />
      )}

      {showInfoFields && (
        <InfoFields values={infoValues} onChange={handleInfoChange} readOnly={readOnly} />
      )}
    </div>
  );
}
