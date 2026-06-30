'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ChartTab =
  | 'daily'
  | 'weekly'
  | 'per_opportunity'
;

interface DataPoint {
  day: number;         // successive calendar day (1–140) or week (1–20)
  correct?: number;    // count per minute (or % for per_opportunity)
  error?: number;
  noOpp?: number;      // open circle: no opportunity
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

interface BounceLines {
  upper: number[];
  lower: number[];
}

export interface SCCProps {
  // Data
  dataPoints?: DataPoint[];
  phaseChanges?: PhaseChange[];
  aimStars?: AimStar[];
  showBounce?: boolean;
  showCeleration?: boolean;

  // Chart metadata (bottom info fields)
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

  // Counting floors to display (timing periods in seconds, e.g. [10, 15, 20, 30, 60])
  countingFloors?: number[];

  // Initial tab
  initialTab?: ChartTab;

  // Read-only mode vs interactive
  readOnly?: boolean;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

// Standard SCC 6-cycle log scale: 0.001 → 1000
const Y_MIN = 0.001;
const Y_MAX = 1000;

// Counting floor values shown on right axis (seconds → cpm)
// cpm = 60 / seconds
const STANDARD_FLOORS_SEC = [1, 2, 3, 5, 10, 15, 20, 30, 60, 120, 300, 600, 1440];
// cpm equivalents
const secToCpm = (s: number) => 60 / s;

// Tab config
const TABS: { id: ChartTab; label: string; shortLabel: string }[] = [
  { id: 'daily',          label: 'Daily (per minute)',    shortLabel: 'Daily/min' },
  { id: 'weekly',         label: 'Weekly (per minute)',   shortLabel: 'Weekly/min' },
  { id: 'per_opportunity', label: 'Per Opportunity (%)',  shortLabel: 'Per Opp' },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function computeCeleration(points: { x: number; y: number }[]) {
  if (points.length < 2) return null;
  // linear regression on log(y) vs x
  const n = points.length;
  const xs = points.map(p => p.x);
  const ys = points.map(p => Math.log10(p.y));
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;          // log10 units per day
  const intercept = my - slope * mx;
  const celPerWeek = Math.pow(10, slope * 7); // x per week
  return { slope, intercept, celPerWeek };
}

// ─────────────────────────────────────────────
// The Chart SVG (D3-rendered)
// ─────────────────────────────────────────────
interface ChartSVGProps {
  tab: ChartTab;
  dataPoints: DataPoint[];
  phaseChanges: PhaseChange[];
  aimStars: AimStar[];
  showBounce: boolean;
  showCeleration: boolean;
  countingFloors: number[];
  showCorrect: boolean;
  showError: boolean;
  showNoOpp: boolean;
}

function ChartSVG({
  tab,
  dataPoints,
  phaseChanges,
  aimStars,
  showBounce,
  showCeleration,
  countingFloors,
  showCorrect,
  showError,
  showNoOpp,
}: ChartSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const isPerOpp   = tab === 'per_opportunity';
  const isWeekly   = tab === 'weekly';

  // X domain
  const xMax = isWeekly ? 20 : 140;
  const xLabel = isWeekly ? 'Successive Calendar Weeks' : 'Successive Calendar Days';

  // Y domain / scale
  const yMin = isPerOpp ? 0.1 : Y_MIN;
  const yMax = isPerOpp ? 100 : Y_MAX;

  useEffect(() => {
    if (!svgRef.current) return;

    const container = svgRef.current.parentElement;
    const totalW = container ? container.clientWidth : 900;

    const margin = { top: 48, right: 90, bottom: 48, left: 72 };
    const W = Math.max(totalW - 4, 600);
    const H = 520;
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', W)
      .attr('height', H);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // ── Scales ──
    const xScale = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);

    const yScale = isPerOpp
      ? d3.scaleLog().domain([yMin, yMax]).range([innerH, 0]).clamp(true)
      : d3.scaleLog().domain([Y_MIN, Y_MAX]).range([innerH, 0]).clamp(true);

    // ── Grid background ──
    g.append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', '#fafaf8')
      .attr('stroke', '#d1c9b8')
      .attr('stroke-width', 1);

    // ── Horizontal grid lines (log cycles) ──
    const logTicks = isPerOpp
      ? [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]
      : [0.001, 0.002, 0.005,
         0.01, 0.02, 0.05,
         0.1, 0.2, 0.5,
         1, 2, 5,
         10, 20, 50,
         100, 200, 500,
         1000];

    logTicks.forEach(tick => {
      const y = yScale(tick);
      const isMajor = [0.001, 0.01, 0.1, 1, 10, 100, 1000].includes(tick) ||
                      (isPerOpp && [0.1, 1, 10, 100].includes(tick));
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', isMajor ? '#b0a090' : '#ddd5c5')
        .attr('stroke-width', isMajor ? 1 : 0.5);

      if (isMajor) {
        g.append('text')
          .attr('x', -6).attr('y', y + 4)
          .attr('text-anchor', 'end')
          .attr('font-size', 10)
          .attr('fill', '#555')
          .text(tick < 1 ? tick.toString() : tick >= 1000 ? '1000' : tick.toString());
      }
    });

    // ── Vertical grid lines — Sun/Mon-Sat structure ──
    if (isWeekly) {
      for (let w = 0; w <= 20; w++) {
        const x = xScale(w);
        g.append('line')
          .attr('x1', x).attr('x2', x)
          .attr('y1', 0).attr('y2', innerH)
          .attr('stroke', '#9a8870')
          .attr('stroke-width', 1.2);
      }
      // Week number labels in cells
      d3.range(1, 21).forEach((w: number) => {
        const x = xScale(w - 0.5);
        g.append('text')
          .attr('x', x).attr('y', innerH + 14)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9)
          .attr('fill', '#555')
          .text(w.toString());
      });
    } else {
      // Daily chart: Sun–Sat columns
      const DOW_LABELS = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];
      const dayW = xScale(1) - xScale(0);

      for (let day = 0; day <= 140; day++) {
        const x = xScale(day);
        const dow = day % 7; // 0=Sun, 6=Sat
        const isSunday = dow === 0;

        // Shade Sunday column
        if (isSunday && day < 140) {
          g.append('rect')
            .attr('x', x).attr('y', 0)
            .attr('width', dayW).attr('height', innerH)
            .attr('fill', '#e0d8c8')
            .attr('opacity', 0.45);
        }

        g.append('line')
          .attr('x1', x).attr('x2', x)
          .attr('y1', 0).attr('y2', innerH)
          .attr('stroke', isSunday ? '#7a6a55' : '#ccc5b5')
          .attr('stroke-width', isSunday ? 1.2 : 0.35);
      }

      // Week number header row (above chart area)
      for (let w = 0; w < 20; w++) {
        const x = xScale(w * 7 + 3.5);
        g.append('text')
          .attr('x', x).attr('y', -8)
          .attr('text-anchor', 'middle')
          .attr('font-size', 7.5)
          .attr('fill', '#999')
          .text(`Wk ${w + 1}`);
      }

      // Day-of-week legend under first 2 weeks
      for (let day = 0; day < 14; day++) {
        const dow = day % 7;
        const x = xScale(day + 0.5);
        g.append('text')
          .attr('x', x).attr('y', innerH + 22)
          .attr('text-anchor', 'middle')
          .attr('font-size', 7)
          .attr('fill', dow === 0 ? '#7a6a55' : '#bbb')
          .text(DOW_LABELS[dow]);
      }

      // Day number ticks at each Sunday (every 7 days)
      d3.range(7, 141, 7).forEach((d: number) => {
        const x = xScale(d);
        g.append('line')
          .attr('x1', x).attr('x2', x)
          .attr('y1', innerH).attr('y2', innerH + 5)
          .attr('stroke', '#888');
        g.append('text')
          .attr('x', x).attr('y', innerH + 14)
          .attr('text-anchor', 'middle')
          .attr('font-size', 8)
          .attr('fill', '#666')
          .text(d.toString());
      });
    }

    // ── X Axis label ──
    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 36)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#444')
      .text(xLabel);

    // ── Y Axis label ──
    const yAxisLabel = isPerOpp ? 'Percent Correct (%)' : 'Count per Minute';

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -54)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#444')
      .text(yAxisLabel);

    // ── "1 per minute" reference line (key SCC boundary) ──
    if (!isPerOpp) {
      const y1 = yScale(1);
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', y1).attr('y2', y1)
        .attr('stroke', '#8b5e3c')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');
      g.append('text')
        .attr('x', innerW + 4).attr('y', y1 + 4)
        .attr('font-size', 8).attr('fill', '#8b5e3c')
        .text('1/min');
    }

    // ── Counting floor lines (right side, dashed) ──
    if (!isPerOpp && countingFloors.length > 0) {
      countingFloors.forEach(sec => {
        const cpm = secToCpm(sec);
        if (cpm < Y_MIN || cpm > Y_MAX) return;
        const yf = yScale(cpm);
        g.append('line')
          .attr('x1', 0).attr('x2', innerW)
          .attr('y1', yf).attr('y2', yf)
          .attr('stroke', '#3b7dd8')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '6,3')
          .attr('opacity', 0.7);

        // Right-side label showing seconds
        const label = sec >= 60
          ? `${sec / 60}min floor`
          : `${sec}s floor`;
        g.append('text')
          .attr('x', innerW + 4).attr('y', yf + 3)
          .attr('font-size', 8).attr('fill', '#3b7dd8')
          .text(label);
      });

      // Small legend
      g.append('text')
        .attr('x', innerW + 4).attr('y', -8)
        .attr('font-size', 8).attr('fill', '#3b7dd8')
        .text('── Timing floor');
    }

    // ── Phase change lines ──
    phaseChanges.forEach(pc => {
      const x = xScale(pc.day);
      g.append('line')
        .attr('x1', x).attr('x2', x)
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', '#555')
        .attr('stroke-width', 1.5);
      g.append('text')
        .attr('x', x + 2).attr('y', 10)
        .attr('font-size', 9).attr('fill', '#333')
        .text(pc.label);
    });

    // ── Aim stars ──
    aimStars.forEach(as => {
      const x = xScale(as.day);
      const y = yScale(as.value);
      // Star symbol
      g.append('text')
        .attr('x', x).attr('y', y + 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', 16)
        .attr('fill', '#e8a020')
        .text('★');
      if (as.label) {
        g.append('text')
          .attr('x', x).attr('y', y - 8)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9).attr('fill', '#b87000')
          .text(as.label);
      }
    });

    // ── Celeration line ──
    const correctPts = dataPoints
      .filter(d => d.correct != null && d.correct! > 0)
      .map(d => ({ x: d.day, y: d.correct! }));

    if (showCeleration && correctPts.length >= 2) {
      const cel = computeCeleration(correctPts);
      if (cel) {
        const xStart = correctPts[0].x;
        const xEnd   = correctPts[correctPts.length - 1].x;
        const yStart = Math.pow(10, cel.intercept + cel.slope * xStart);
        const yEnd   = Math.pow(10, cel.intercept + cel.slope * xEnd);

        g.append('line')
          .attr('x1', xScale(xStart)).attr('x2', xScale(xEnd))
          .attr('y1', yScale(Math.max(yStart, Y_MIN))).attr('y2', yScale(Math.max(yEnd, Y_MIN)))
          .attr('stroke', '#2d7a2d')
          .attr('stroke-width', 2);

        // Celeration label (×N per week)
        const celLabel = cel.celPerWeek >= 1
          ? `×${cel.celPerWeek.toFixed(2)}/wk`
          : `÷${(1 / cel.celPerWeek).toFixed(2)}/wk`;
        g.append('text')
          .attr('x', xScale((xStart + xEnd) / 2))
          .attr('y', yScale(Math.pow(10, cel.intercept + cel.slope * (xStart + xEnd) / 2)) - 8)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9).attr('fill', '#2d7a2d')
          .text(celLabel);
      }
    }

    // ── Bounce lines ──
    if (showBounce && correctPts.length >= 3) {
      const cel = computeCeleration(correctPts);
      if (cel) {
        const residuals = correctPts.map(p => {
          const predicted = Math.pow(10, cel.intercept + cel.slope * p.x);
          return Math.log10(p.y) - Math.log10(predicted);
        });
        const maxRes = Math.max(...residuals);
        const minRes = Math.min(...residuals);

        const xStart = correctPts[0].x;
        const xEnd   = correctPts[correctPts.length - 1].x;

        ['upper', 'lower'].forEach((side, i) => {
          const offset = i === 0 ? maxRes : minRes;
          const y1b = Math.pow(10, cel.intercept + cel.slope * xStart + offset);
          const y2b = Math.pow(10, cel.intercept + cel.slope * xEnd + offset);
          g.append('line')
            .attr('x1', xScale(xStart)).attr('x2', xScale(xEnd))
            .attr('y1', yScale(Math.max(y1b, Y_MIN))).attr('y2', yScale(Math.max(y2b, Y_MIN)))
            .attr('stroke', '#2d7a2d')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4,3')
            .attr('opacity', 0.6);
        });
      }
    }

    // ── Data points ──
    dataPoints.forEach(dp => {
      const x = xScale(dp.day);

      // Per opportunity: percentage
      if (isPerOpp) {
        if (showCorrect && dp.correct != null) {
          const pct = Math.max(dp.correct, 0.1);
          const yC = yScale(pct);
          g.append('circle')
            .attr('cx', x).attr('cy', yC)
            .attr('r', 4)
            .attr('fill', '#1a5ca8')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);
        }
        return;
      }

      // Standard: correct (dot), error (×), no-opportunity (open circle)
      if (showCorrect && dp.correct != null && dp.correct > 0) {
        const yC = yScale(dp.correct);
        g.append('circle')
          .attr('cx', x).attr('cy', yC)
          .attr('r', 4)
          .attr('fill', '#1a5ca8')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);
      }

      if (showError && dp.error != null && dp.error > 0) {
        const yE = yScale(dp.error);
        // X mark
        const r = 5;
        g.append('line')
          .attr('x1', x - r).attr('x2', x + r)
          .attr('y1', yE - r).attr('y2', yE + r)
          .attr('stroke', '#c0392b').attr('stroke-width', 2);
        g.append('line')
          .attr('x1', x + r).attr('x2', x - r)
          .attr('y1', yE - r).attr('y2', yE + r)
          .attr('stroke', '#c0392b').attr('stroke-width', 2);
      }

      if (showNoOpp && dp.noOpp != null && dp.noOpp > 0) {
        const yN = yScale(dp.noOpp);
        g.append('circle')
          .attr('cx', x).attr('cy', yN)
          .attr('r', 4)
          .attr('fill', 'none')
          .attr('stroke', '#888')
          .attr('stroke-width', 1.5);
      }
    });

    // ── "Below 1/min" annotation ──
    if (!isPerOpp) {
      const y1pos = yScale(1);
      if (y1pos < innerH - 20) {
        g.append('text')
          .attr('x', 4).attr('y', y1pos + 14)
          .attr('font-size', 8).attr('fill', '#9e7a5a').attr('opacity', 0.7)
          .text('▼ behavior occurs less often than 1×/min (>1 min apart)');
      }
      if (y1pos > 20) {
        g.append('text')
          .attr('x', 4).attr('y', y1pos - 4)
          .attr('font-size', 8).attr('fill', '#9e7a5a').attr('opacity', 0.7)
          .text('▲ behavior occurs more often than 1×/min');
      }
    }

  }, [tab, dataPoints, phaseChanges, aimStars, showBounce, showCeleration, countingFloors, showCorrect, showError, showNoOpp]);

  return (
    <div className="w-full overflow-x-auto">
      <svg ref={svgRef} className="block" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Counting Floor Reference Panel
// ─────────────────────────────────────────────
function CountingFloorPanel() {
  const floors = [
    { sec: 1,    label: '1 second',    cpm: 60,    note: '60/min' },
    { sec: 2,    label: '2 seconds',   cpm: 30,    note: '30/min' },
    { sec: 3,    label: '3 seconds',   cpm: 20,    note: '20/min' },
    { sec: 5,    label: '5 seconds',   cpm: 12,    note: '12/min' },
    { sec: 10,   label: '10 seconds',  cpm: 6,     note: '6/min' },
    { sec: 15,   label: '15 seconds',  cpm: 4,     note: '4/min' },
    { sec: 20,   label: '20 seconds',  cpm: 3,     note: '3/min' },
    { sec: 30,   label: '30 seconds',  cpm: 2,     note: '2/min' },
    { sec: 60,   label: '1 minute',    cpm: 1,     note: '1/min (baseline)' },
    { sec: 120,  label: '2 minutes',   cpm: 0.5,   note: '0.5/min' },
    { sec: 300,  label: '5 minutes',   cpm: 0.2,   note: '0.2/min' },
    { sec: 600,  label: '10 minutes',  cpm: 0.1,   note: '0.1/min' },
    { sec: 1440, label: 'Full day',    cpm: 0.0007, note: '~0.001/min' },
  ];

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-3 text-sm">
        📏 Counting Floor Reference
      </h3>
      <p className="text-xs text-blue-700 mb-3">
        Formula: <strong>Floor (cpm) = 60 ÷ timing period (seconds)</strong>.
        The longer you observe, the lower your timing floor drops on the chart.
        Floors appear as dashed horizontal lines (time bars).
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {floors.map(f => (
          <div key={f.sec} className="flex items-center gap-2 text-xs">
            <span className="w-20 text-blue-800 font-medium">{f.label}</span>
            <span className="text-blue-600">→</span>
            <span className="font-mono text-blue-900">{f.note}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
        <strong>Key rules:</strong> Below the 1/min line = behavior occurs less often than once per minute (inter-response time &gt;1 min).
        Above the 1/min line = behavior occurs more than once per minute. 30-second timing floor always sits on the 2/min line.
        15-second timing floor always sits on the 4/min line.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Info Fields Panel
// ─────────────────────────────────────────────
interface InfoFieldsProps {
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
  readOnly: boolean;
}

const INFO_FIELDS = [
  ['supervisor', 'Supervisor'],
  ['advisor',    'Advisor'],
  ['manager',    'Manager'],
  ['timer',      'Timer'],
  ['counter',    'Counter'],
  ['charter',    'Charter'],
  ['performer',  'Performer'],
  ['counted',    'Counted'],
  ['organization','Organization'],
  ['division',   'Division'],
  ['room',       'Room'],
  ['label',      'Label / Behavior'],
];

function InfoFields({ values, onChange, readOnly }: InfoFieldsProps) {
  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-800 mb-2">Chart Information</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
        {INFO_FIELDS.map(([key, label]) => (
          <div key={key} className="flex flex-col gap-0.5">
            <label className="text-xs text-amber-700">{label}</label>
            {readOnly ? (
              <span className="text-xs font-medium text-amber-900 border-b border-amber-300 pb-0.5 min-h-[20px]">
                {values[key] || ''}
              </span>
            ) : (
              <input
                type="text"
                value={values[key] || ''}
                onChange={e => onChange(key, e.target.value)}
                className="text-xs border border-amber-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:border-amber-500"
                placeholder={label}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Data Entry Panel
// ─────────────────────────────────────────────
interface DataEntryProps {
  tab: ChartTab;
  dataPoints: DataPoint[];
  onAdd: (pt: DataPoint) => void;
  onRemove: (day: number) => void;
}

function DataEntry({ tab, dataPoints, onAdd, onRemove }: DataEntryProps) {
  const [day, setDay] = useState('');
  const [correct, setCorrect] = useState('');
  const [error, setError] = useState('');
  const [noOpp, setNoOpp] = useState('');
  const [duration, setDuration] = useState('');

  const isDuration = tab === 'duration';
  const isPerOpp   = tab === 'per_opportunity';

  const handleAdd = () => {
    const d = parseInt(day);
    if (!d || d < 1) return;
    const pt: DataPoint = { day: d };
    if (isDuration) {
      pt.duration = parseFloat(duration) || undefined;
    } else if (isPerOpp) {
      pt.correct = parseFloat(correct) || undefined;
    } else {
      pt.correct  = parseFloat(correct)  || undefined;
      pt.error    = parseFloat(error)    || undefined;
      pt.noOpp    = parseFloat(noOpp)    || undefined;
    }
    onAdd(pt);
    setDay(''); setCorrect(''); setError(''); setNoOpp(''); setDuration('');
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">Add Data Point</p>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-gray-500">{tab === 'weekly' ? 'Week' : 'Day'}</label>
          <input
            type="number" value={day} onChange={e => setDay(e.target.value)}
            className="w-16 text-xs border rounded px-1 py-1"
            placeholder="1"
          />
        </div>
        {isDuration ? (
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-gray-500">Duration (sec)</label>
            <input
              type="number" value={duration} onChange={e => setDuration(e.target.value)}
              className="w-24 text-xs border rounded px-1 py-1"
              placeholder="0"
            />
          </div>
        ) : isPerOpp ? (
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-gray-500">% Correct</label>
            <input
              type="number" value={correct} onChange={e => setCorrect(e.target.value)}
              className="w-20 text-xs border rounded px-1 py-1"
              placeholder="0–100"
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500">Correct (●)</label>
              <input
                type="number" value={correct} onChange={e => setCorrect(e.target.value)}
                className="w-20 text-xs border rounded px-1 py-1"
                placeholder="cpm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500">Error (×)</label>
              <input
                type="number" value={error} onChange={e => setError(e.target.value)}
                className="w-20 text-xs border rounded px-1 py-1"
                placeholder="cpm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500">No Opp (○)</label>
              <input
                type="number" value={noOpp} onChange={e => setNoOpp(e.target.value)}
                className="w-20 text-xs border rounded px-1 py-1"
                placeholder="cpm"
              />
            </div>
          </>
        )}
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 self-end"
        >
          + Add
        </button>
      </div>

      {dataPoints.length > 0 && (
        <div className="mt-3 max-h-32 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 text-left border-b">
                <th className="pr-3">{tab === 'weekly' ? 'Wk' : 'Day'}</th>
                {isDuration
                  ? <th>Duration (s)</th>
                  : isPerOpp
                    ? <th>% Correct</th>
                    : <><th>Correct</th><th>Error</th><th>NoOpp</th></>
                }
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...dataPoints].sort((a, b) => a.day - b.day).map(dp => (
                <tr key={dp.day} className="border-b border-gray-100">
                  <td className="pr-3 py-0.5">{dp.day}</td>
                  {isDuration
                    ? <td>{dp.duration ?? '—'}</td>
                    : isPerOpp
                      ? <td>{dp.correct ?? '—'}</td>
                      : <>
                          <td>{dp.correct ?? '—'}</td>
                          <td>{dp.error ?? '—'}</td>
                          <td>{dp.noOpp ?? '—'}</td>
                        </>
                  }
                  <td>
                    <button
                      onClick={() => onRemove(dp.day)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Phase Change & Aim Star Editors
// ─────────────────────────────────────────────
function PhaseChangeEditor({
  phaseChanges,
  onAdd,
  onRemove,
  tab,
}: {
  phaseChanges: PhaseChange[];
  onAdd: (pc: PhaseChange) => void;
  onRemove: (day: number) => void;
  tab: ChartTab;
}) {
  const [day, setDay] = useState('');
  const [label, setLabel] = useState('');
  const isWeekly = tab === 'weekly';

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">Phase Changes</p>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-gray-500">{isWeekly ? 'Week' : 'Day'}</label>
          <input type="number" value={day} onChange={e => setDay(e.target.value)}
            className="w-16 text-xs border rounded px-1 py-1" placeholder="1" />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-gray-500">Label</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)}
            className="w-32 text-xs border rounded px-1 py-1" placeholder="e.g. Intervention A" />
        </div>
        <button
          onClick={() => { if (day && label) { onAdd({ day: parseInt(day), label }); setDay(''); setLabel(''); }}}
          className="bg-gray-600 text-white text-xs px-3 py-1 rounded hover:bg-gray-700 self-end"
        >+ Add</button>
      </div>
      {phaseChanges.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {phaseChanges.map(pc => (
            <span key={pc.day} className="flex items-center gap-1 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">
              {isWeekly ? 'Wk' : 'Day'} {pc.day}: {pc.label}
              <button onClick={() => onRemove(pc.day)} className="text-red-400 hover:text-red-600">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AimStarEditor({
  aimStars,
  onAdd,
  onRemove,
}: {
  aimStars: AimStar[];
  onAdd: (as: AimStar) => void;
  onRemove: (day: number) => void;
}) {
  const [day, setDay] = useState('');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-yellow-800 mb-2">⭐ Aim Stars</p>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-yellow-700">Day</label>
          <input type="number" value={day} onChange={e => setDay(e.target.value)}
            className="w-16 text-xs border rounded px-1 py-1" placeholder="1" />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-yellow-700">Target (cpm)</label>
          <input type="number" value={value} onChange={e => setValue(e.target.value)}
            className="w-20 text-xs border rounded px-1 py-1" placeholder="e.g. 50" />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-yellow-700">Label</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)}
            className="w-24 text-xs border rounded px-1 py-1" placeholder="Aim" />
        </div>
        <button
          onClick={() => {
            if (day && value) {
              onAdd({ day: parseInt(day), value: parseFloat(value), label });
              setDay(''); setValue(''); setLabel('');
            }
          }}
          className="bg-yellow-600 text-white text-xs px-3 py-1 rounded hover:bg-yellow-700 self-end"
        >+ Add</button>
      </div>
      {aimStars.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {aimStars.map(as => (
            <span key={as.day} className="flex items-center gap-1 bg-yellow-200 text-yellow-800 text-xs px-2 py-0.5 rounded">
              ★ Day {as.day} @ {as.value} {as.label && `(${as.label})`}
              <button onClick={() => onRemove(as.day)} className="text-red-400 hover:text-red-600">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab descriptions
// ─────────────────────────────────────────────
const TAB_DESCRIPTIONS: Record<ChartTab, string> = {
  daily: 'Standard Daily per Minute chart (DPmin) — the most common SCC. Plots count per minute over 140 successive calendar days on a 6-cycle log scale. Used for most ABA/PT data. Dots (●) = correct, × = errors, ○ = no opportunity.',
  weekly: 'Weekly per Minute chart — summarizes data by week (20 weeks on X-axis). Useful for longer-term trend analysis. Same 6-cycle log scale as the daily chart.',
  per_opportunity: 'Per Opportunity (%) chart — used when behavior is measured as percentage correct across discrete trials. X-axis is 140 days; Y-axis is percent (log scale, 0.1–100%). Common for discrete trial teaching (DTT).',
  duration: 'Duration chart — tracks how long a behavior lasts (in seconds) rather than how often it occurs. Useful for behaviors like on-task time, tantrum duration, or engagement. Plotted on a log scale.',
  safmeds: 'SAFMEDS (Say All Fast a Minute Every Day Shuffled) — flashcard fluency measurement. Plots correct card responses per minute. Same axes as daily chart. Used widely in Precision Teaching for academic skills.',
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function StandardCelerationChart({
  dataPoints: initialDataPoints = [],
  phaseChanges: initialPhaseChanges = [],
  aimStars: initialAimStars = [],
  showBounce: initialBounce = false,
  showCeleration: initialCeleration = true,
  countingFloors: initialFloors = [15, 30, 60],
  initialTab = 'daily',
  readOnly = false,
  performer = '',
  supervisor = '',
  advisor = '',
  manager = '',
  timer = '',
  counter = '',
  charter = '',
  counted = '',
  organization = '',
  division = '',
  room = '',
  label = '',
}: SCCProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>(initialTab);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>(initialDataPoints);
  const [phaseChanges, setPhaseChanges] = useState<PhaseChange[]>(initialPhaseChanges);
  const [aimStars, setAimStars] = useState<AimStar[]>(initialAimStars);
  const [showBounce, setShowBounce] = useState(initialBounce);
  const [showCeleration, setShowCeleration] = useState(initialCeleration);
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
    supervisor, advisor, manager, timer, counter, charter,
    performer, counted, organization, division, room, label,
  });

  const handleInfoChange = (key: string, val: string) => {
    setInfoValues(prev => ({ ...prev, [key]: val }));
  };

  const addFloor = () => {
    const sec = parseInt(floorInput);
    if (sec > 0 && !activeFloors.includes(sec)) {
      setActiveFloors(prev => [...prev, sec].sort((a, b) => a - b));
    }
    setFloorInput('');
  };

  const removeFloor = (sec: number) => {
    setActiveFloors(prev => prev.filter(f => f !== sec));
  };

  const isPerOpp   = activeTab === 'per_opportunity';

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border border-b-0 transition-colors ${
              activeTab === t.id
                ? 'bg-white border-gray-300 text-blue-700 font-semibold -mb-px relative z-10'
                : 'bg-gray-100 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.shortLabel}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-800">
        {TAB_DESCRIPTIONS[activeTab]}
      </div>

      {/* Chart */}
      <div className="border border-gray-300 rounded-lg bg-white p-2">
        <ChartSVG
          tab={activeTab}
          dataPoints={dataPoints}
          phaseChanges={phaseChanges}
          aimStars={aimStars}
          showBounce={showBounce}
          showCeleration={showCeleration}
          countingFloors={activeFloors}
          showCorrect={showCorrect}
          showError={showError}
          showNoOpp={showNoOpp}
        />
      </div>

      {/* Chart controls toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Display toggles */}
        <div className="flex gap-2 items-center text-xs">
          <span className="text-gray-500 font-medium">Show:</span>
          {!isPerOpp && (
            <>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={showCorrect} onChange={e => setShowCorrect(e.target.checked)} />
                <span className="text-blue-700">● Correct</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={showError} onChange={e => setShowError(e.target.checked)} />
                <span className="text-red-600">× Error</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={showNoOpp} onChange={e => setShowNoOpp(e.target.checked)} />
                <span className="text-gray-500">○ No Opp</span>
              </label>
            </>
          )}
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showCeleration} onChange={e => setShowCeleration(e.target.checked)} />
            <span className="text-green-700">Celeration line</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showBounce} onChange={e => setShowBounce(e.target.checked)} />
            <span className="text-green-600">Bounce lines</span>
          </label>
        </div>

        <div className="ml-auto flex gap-2">
          {/* Counting floor config */}
          {!isPerOpp && (
            <button
              onClick={() => setShowFloorPanel(p => !p)}
              className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              ⏱ Timing Floors {activeFloors.length > 0 ? `(${activeFloors.length})` : ''}
            </button>
          )}
          <button
            onClick={() => setShowDataEntry(p => !p)}
            className="text-xs px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
          >📊 Data</button>
          <button
            onClick={() => setShowPhaseEditor(p => !p)}
            className="text-xs px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
          >| Phase Changes</button>
          <button
            onClick={() => setShowAimEditor(p => !p)}
            className="text-xs px-3 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
          >★ Aim Stars</button>
          <button
            onClick={() => setShowInfoFields(p => !p)}
            className="text-xs px-3 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200"
          >ℹ Info Fields</button>
        </div>
      </div>

      {/* Timing floor panel */}
      {showFloorPanel && !isPerOpp && (
        <div className="flex flex-col gap-3">
          <CountingFloorPanel />
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-800 mb-2">Active Timing Floors on Chart</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {activeFloors.map(sec => (
                <span key={sec} className="flex items-center gap-1 bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded">
                  {sec}s ({(60 / sec).toFixed(sec < 10 ? 1 : 0)}/min)
                  <button onClick={() => removeFloor(sec)} className="text-red-400 hover:text-red-600">×</button>
                </span>
              ))}
              {activeFloors.length === 0 && <span className="text-xs text-blue-500">No floors displayed</span>}
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex flex-col gap-0.5">
                <label className="text-xs text-blue-700">Add floor (seconds)</label>
                <input
                  type="number"
                  value={floorInput}
                  onChange={e => setFloorInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addFloor()}
                  className="w-24 text-xs border border-blue-300 rounded px-1 py-1"
                  placeholder="e.g. 20"
                />
              </div>
              <button
                onClick={addFloor}
                className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 self-end"
              >+ Add</button>
              <div className="flex flex-wrap gap-1 self-end">
                {[10, 15, 20, 30, 60, 120].map(s => (
                  !activeFloors.includes(s) && (
                    <button
                      key={s}
                      onClick={() => setActiveFloors(prev => [...prev, s].sort((a, b) => a - b))}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200"
                    >{s}s</button>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data entry panel */}
      {showDataEntry && (
        <DataEntry
          tab={activeTab}
          dataPoints={dataPoints}
          onAdd={pt => {
            setDataPoints(prev => {
              const filtered = prev.filter(p => p.day !== pt.day);
              return [...filtered, pt].sort((a, b) => a.day - b.day);
            });
          }}
          onRemove={day => setDataPoints(prev => prev.filter(p => p.day !== day))}
        />
      )}

      {/* Phase change editor */}
      {showPhaseEditor && (
        <PhaseChangeEditor
          tab={activeTab}
          phaseChanges={phaseChanges}
          onAdd={pc => setPhaseChanges(prev => [...prev.filter(p => p.day !== pc.day), pc].sort((a, b) => a.day - b.day))}
          onRemove={day => setPhaseChanges(prev => prev.filter(p => p.day !== day))}
        />
      )}

      {/* Aim star editor */}
      {showAimEditor && (
        <AimStarEditor
          aimStars={aimStars}
          onAdd={as => setAimStars(prev => [...prev.filter(a => a.day !== as.day), as].sort((a, b) => a.day - b.day))}
          onRemove={day => setAimStars(prev => prev.filter(a => a.day !== day))}
        />
      )}

      {/* Info fields */}
      {showInfoFields && (
        <InfoFields values={infoValues} onChange={handleInfoChange} readOnly={readOnly} />
      )}
    </div>
  );
}
