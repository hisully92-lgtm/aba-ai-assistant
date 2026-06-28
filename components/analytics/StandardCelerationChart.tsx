"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

type DataPoint = {
  date: string; // ISO date string
  correct?: number; // count per minute — plotted as dots
  incorrect?: number; // count per minute — plotted as X marks
  phase?: string; // phase change label
};

type PhaseChange = {
  date: string;
  label: string;
  color?: string;
};

type Props = {
  data: DataPoint[];
  phaseChanges?: PhaseChange[];
  goalLine?: number; // count per minute
  title?: string;
  showCelerationLine?: boolean;
  startDate?: string; // ISO date — defaults to first data point
  weeks?: number; // number of weeks to show — default 20 (140 days)
};

export default function StandardCelerationChart({
  data,
  phaseChanges = [],
  goalLine,
  title = "Standard Celeration Chart",
  showCelerationLine = true,
  startDate,
  weeks = 20,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // ── Dimensions ──────────────────────────────────────────────
    const margin = { top: 50, right: 40, bottom: 60, left: 70 };
    const totalDays = weeks * 7;
    const width = Math.max(800, totalDays * 6);
    const height = 500;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("style", "background: white; font-family: Arial, sans-serif;");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // ── Scales ───────────────────────────────────────────────────
    const start = startDate
      ? new Date(startDate)
      : data.length > 0
      ? new Date(data[0].date)
      : new Date();

    // Align to nearest Sunday
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);

    const end = new Date(start);
    end.setDate(end.getDate() + totalDays);

    const xScale = d3.scaleTime()
      .domain([start, end])
      .range([0, innerWidth]);

    // 6-cycle log scale: 0.001 to 1000
    const yScale = d3.scaleLog()
      .domain([0.001, 1000])
      .range([innerHeight, 0])
      .clamp(true);

    // ── Background color ─────────────────────────────────────────
    g.append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "#e8f4f8");

    // ── Weekly vertical grid lines (every 7 days) ────────────────
    const weekDates: Date[] = [];
    let d = new Date(start);
    while (d <= end) {
      weekDates.push(new Date(d));
      d.setDate(d.getDate() + 7);
    }

    weekDates.forEach((wDate) => {
      const x = xScale(wDate);
      g.append("line")
        .attr("x1", x).attr("x2", x)
        .attr("y1", 0).attr("y2", innerHeight)
        .attr("stroke", "#5ba3c9")
        .attr("stroke-width", 1.5);
    });

    // ── Daily vertical grid lines (thinner) ─────────────────────
    const allDates: Date[] = [];
    let dd = new Date(start);
    while (dd <= end) {
      allDates.push(new Date(dd));
      dd.setDate(dd.getDate() + 1);
    }

    allDates.forEach((aDate) => {
      const dow = aDate.getDay();
      if (dow === 0) return; // already drawn as week line
      const x = xScale(aDate);
      g.append("line")
        .attr("x1", x).attr("x2", x)
        .attr("y1", 0).attr("y2", innerHeight)
        .attr("stroke", dow === 6 ? "#a0c8d8" : "#c8e4ee") // Saturday slightly darker
        .attr("stroke-width", dow === 6 ? 0.8 : 0.4);
    });

    // ── Horizontal log grid lines ────────────────────────────────
    const logTicks = [
      0.001, 0.002, 0.005,
      0.01, 0.02, 0.05,
      0.1, 0.2, 0.5,
      1, 2, 5,
      10, 20, 50,
      100, 200, 500,
      1000,
    ];

    const majorTicks = [0.001, 0.01, 0.1, 1, 10, 100, 1000];

    logTicks.forEach((tick) => {
      const y = yScale(tick);
      const isMajor = majorTicks.includes(tick);
      g.append("line")
        .attr("x1", 0).attr("x2", innerWidth)
        .attr("y1", y).attr("y2", y)
        .attr("stroke", isMajor ? "#5ba3c9" : "#a0c8d8")
        .attr("stroke-width", isMajor ? 1.2 : 0.5);
    });

    // ── Y Axis labels ────────────────────────────────────────────
    majorTicks.forEach((tick) => {
      const y = yScale(tick);
      const label = tick >= 1 ? tick.toString() : tick.toString();
      g.append("text")
        .attr("x", -8).attr("y", y)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-size", 10)
        .attr("fill", "#1a5276")
        .text(label);
    });

    // Y axis title
    g.append("text")
      .attr("transform", `rotate(-90)`)
      .attr("x", -innerHeight / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#1a5276")
      .attr("font-weight", "bold")
      .text("COUNT PER MINUTE");

    // ── X Axis — week numbers + month labels ─────────────────────
    weekDates.forEach((wDate, i) => {
      const x = xScale(wDate);
      // Week number
      g.append("text")
        .attr("x", x + (innerWidth / weekDates.length) / 2)
        .attr("y", innerHeight + 15)
        .attr("text-anchor", "middle")
        .attr("font-size", 9)
        .attr("fill", "#1a5276")
        .text(i + 1);
    });

    // Month labels
    const monthFormat = d3.timeFormat("%b %d");
    const months = d3.timeMonths(start, end);
    months.forEach((month) => {
      const x = xScale(month);
      g.append("text")
        .attr("x", x)
        .attr("y", innerHeight + 30)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", "#1a5276")
        .text(monthFormat(month));
    });

    // X axis label
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 50)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#1a5276")
      .attr("font-weight", "bold")
      .text("SUCCESSIVE CALENDAR DAYS");

    // ── Sunday labels at top ─────────────────────────────────────
    weekDates.forEach((wDate) => {
      const x = xScale(wDate);
      g.append("text")
        .attr("x", x)
        .attr("y", -8)
        .attr("text-anchor", "middle")
        .attr("font-size", 8)
        .attr("fill", "#5ba3c9")
        .text("S");
    });

    // ── Phase change lines ───────────────────────────────────────
    phaseChanges.forEach((phase) => {
      const x = xScale(new Date(phase.date));
      g.append("line")
        .attr("x1", x).attr("x2", x)
        .attr("y1", 0).attr("y2", innerHeight)
        .attr("stroke", phase.color ?? "#e74c3c")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "8,4");

      g.append("text")
        .attr("x", x + 4)
        .attr("y", 12)
        .attr("font-size", 9)
        .attr("fill", phase.color ?? "#e74c3c")
        .text(phase.label);
    });

    // ── Goal line ────────────────────────────────────────────────
    if (goalLine && goalLine > 0) {
      const y = yScale(goalLine);
      g.append("line")
        .attr("x1", 0).attr("x2", innerWidth)
        .attr("y1", y).attr("y2", y)
        .attr("stroke", "#27ae60")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "10,5");

      g.append("text")
        .attr("x", innerWidth - 4)
        .attr("y", y - 4)
        .attr("text-anchor", "end")
        .attr("font-size", 9)
        .attr("fill", "#27ae60")
        .text(`Goal: ${goalLine}/min`);
    }

    // ── Plot data points ─────────────────────────────────────────
    const validData = data.filter((d) => new Date(d.date) >= start && new Date(d.date) <= end);

    // Correct responses — filled dots (●)
    const correctData = validData.filter((d) => d.correct != null && d.correct! > 0);
    correctData.forEach((point) => {
      const x = xScale(new Date(point.date));
      const y = yScale(Math.max(point.correct!, 0.001));
      g.append("circle")
        .attr("cx", x).attr("cy", y)
        .attr("r", 4)
        .attr("fill", "#1a5276")
        .attr("stroke", "white")
        .attr("stroke-width", 1);
    });

    // Incorrect responses — X marks
    const incorrectData = validData.filter((d) => d.incorrect != null && d.incorrect! > 0);
    incorrectData.forEach((point) => {
      const x = xScale(new Date(point.date));
      const y = yScale(Math.max(point.incorrect!, 0.001));
      const size = 5;
      g.append("line")
        .attr("x1", x - size).attr("y1", y - size)
        .attr("x2", x + size).attr("y2", y + size)
        .attr("stroke", "#e74c3c").attr("stroke-width", 2);
      g.append("line")
        .attr("x1", x + size).attr("y1", y - size)
        .attr("x2", x - size).attr("y2", y + size)
        .attr("stroke", "#e74c3c").attr("stroke-width", 2);
    });

    // ── Celeration lines (linear regression on log scale) ────────
    if (showCelerationLine && correctData.length >= 2) {
      const logPoints = correctData.map((d) => ({
        x: xScale(new Date(d.date)),
        y: Math.log10(Math.max(d.correct!, 0.001)),
      }));

      const n = logPoints.length;
      const meanX = logPoints.reduce((a, b) => a + b.x, 0) / n;
      const meanY = logPoints.reduce((a, b) => a + b.y, 0) / n;
      const slope = logPoints.reduce((a, b) => a + (b.x - meanX) * (b.y - meanY), 0) /
        logPoints.reduce((a, b) => a + (b.x - meanX) ** 2, 0);
      const intercept = meanY - slope * meanX;

      const x1 = logPoints[0].x;
      const x2 = logPoints[logPoints.length - 1].x;
      const y1 = yScale(Math.pow(10, slope * x1 + intercept));
      const y2 = yScale(Math.pow(10, slope * x2 + intercept));

      g.append("line")
        .attr("x1", x1).attr("y1", y1)
        .attr("x2", x2).attr("y2", y2)
        .attr("stroke", "#1a5276")
        .attr("stroke-width", 2);

      // Celeration value
      const celerationPerWeek = Math.pow(10, slope * (innerWidth / weeks));
      const celerationLabel = celerationPerWeek >= 1
        ? `x${celerationPerWeek.toFixed(2)}`
        : `÷${(1 / celerationPerWeek).toFixed(2)}`;

      g.append("text")
        .attr("x", (x1 + x2) / 2)
        .attr("y", (y1 + y2) / 2 - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", "#1a5276")
        .attr("font-weight", "bold")
        .text(`c=${celerationLabel}`);
    }

    // ── Title ────────────────────────────────────────────────────
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 22)
      .attr("text-anchor", "middle")
      .attr("font-size", 14)
      .attr("font-weight", "bold")
      .attr("fill", "#1a5276")
      .text(title);

    // ── Legend ───────────────────────────────────────────────────
    const legendX = margin.left + 10;
    const legendY = margin.top + 10;

    g.append("circle").attr("cx", 10).attr("cy", 10).attr("r", 4).attr("fill", "#1a5276");
    g.append("text").attr("x", 20).attr("y", 14).attr("font-size", 10).attr("fill", "#1a5276").text("Correct (dots)");

    g.append("line").attr("x1", 100).attr("y1", 6).attr("x2", 108).attr("y2", 14).attr("stroke", "#e74c3c").attr("stroke-width", 2);
    g.append("line").attr("x1", 108).attr("y1", 6).attr("x2", 100).attr("y2", 14).attr("stroke", "#e74c3c").attr("stroke-width", 2);
    g.append("text").attr("x", 115).attr("y", 14).attr("font-size", 10).attr("fill", "#e74c3c").text("Incorrect (x)");

  }, [data, phaseChanges, goalLine, title, showCelerationLine, startDate, weeks]);

  return (
    <div className="w-full overflow-x-auto border border-gray-200 rounded-xl bg-white">
      <svg ref={svgRef} style={{ minWidth: 800 }} />
      <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
        Standard Celeration Chart · 6-cycle semi-logarithmic · Count per minute
      </div>
    </div>
  );
}
