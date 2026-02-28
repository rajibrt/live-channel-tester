"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

function formatShortCount(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function toNiceMax(value) {
  const v = Math.max(1, Number(value || 0));
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  if (v <= 20) return 20;
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / magnitude) * magnitude;
}

function buildSmoothLineModel(values, width = 760, height = 280) {
  const safeValues = Array.isArray(values) ? values.map((n) => Math.max(0, Number(n || 0))) : [];
  const pad = { top: 18, right: 16, bottom: 36, left: 44 };
  const plotW = Math.max(1, width - pad.left - pad.right);
  const plotH = Math.max(1, height - pad.top - pad.bottom);
  if (!safeValues.length) {
    return { width, height, pad, path: "", area: "", points: [], yMax: 10, peakIndex: 0 };
  }

  const maxRaw = Math.max(...safeValues, 0);
  const yMax = toNiceMax(maxRaw);
  const stepX = safeValues.length > 1 ? plotW / (safeValues.length - 1) : 0;
  const points = safeValues.map((value, idx) => {
    const ratio = yMax > 0 ? value / yMax : 0;
    const x = pad.left + idx * stepX;
    const y = pad.top + (1 - ratio) * plotH;
    return { x, y, value };
  });

  let path = "";
  if (points.length === 1) {
    path = `M${points[0].x},${points[0].y}`;
  } else {
    path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }
  }

  const baseY = pad.top + plotH;
  const area = `${path} L${(pad.left + plotW).toFixed(2)},${baseY.toFixed(2)} L${pad.left.toFixed(2)},${baseY.toFixed(2)} Z`;
  const peakIndex = points.reduce((best, p, idx) => (p.value > points[best].value ? idx : best), 0);
  return { width, height, pad, path, area, points, yMax, peakIndex };
}

function TrendPanel({ panel }) {
  const values = panel.data.map((row) => Number(row?.value || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  const chart = useMemo(() => buildSmoothLineModel(values, 760, 280), [values]);
  const [activeIndex, setActiveIndex] = useState(null);

  const effectiveIndex = activeIndex == null ? -1 : activeIndex;
  const activePoint = effectiveIndex >= 0 ? chart.points[effectiveIndex] : null;
  const head = panel.data[0];
  const tail = panel.data[panel.data.length - 1];
  const midIdx = panel.data.length > 1 ? Math.floor(panel.data.length / 2) : 0;
  const tipW = 110;
  const tipH = 62;
  const tipX = activePoint ? Math.max(chart.pad.left + 8, Math.min(activePoint.x + 12, chart.width - tipW - 6)) : chart.pad.left + 12;
  const tipY = activePoint ? Math.max(chart.pad.top + 6, activePoint.y - tipH - 10) : chart.pad.top + 10;

  const pickIndexFromClientX = (clientX, svgRect) => {
    if (!chart.points.length) return -1;
    const plotW = Math.max(1, chart.width - chart.pad.left - chart.pad.right);
    const relativeX = ((clientX - svgRect.left) / Math.max(1, svgRect.width)) * plotW;
    const stepX = chart.points.length > 1 ? plotW / (chart.points.length - 1) : plotW;
    const idx = Math.round(relativeX / Math.max(1, stepX));
    return Math.max(0, Math.min(chart.points.length - 1, idx));
  };

  return (
    <div className={styles.trendPanel}>
      <div className={styles.trendPanelHead}>
        <p>{panel.title}</p>
        <strong>{formatShortCount(total)}</strong>
      </div>
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className={styles.trendSvg}
        aria-hidden="true"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setActiveIndex(pickIndexFromClientX(event.clientX, rect));
        }}
        onMouseLeave={() => setActiveIndex(null)}
        onTouchStart={(event) => {
          const touch = event.touches?.[0];
          if (!touch) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setActiveIndex(pickIndexFromClientX(touch.clientX, rect));
        }}
        onTouchMove={(event) => {
          const touch = event.touches?.[0];
          if (!touch) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setActiveIndex(pickIndexFromClientX(touch.clientX, rect));
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const y = chart.pad.top + ((chart.height - chart.pad.top - chart.pad.bottom) * i) / 5;
          const val = Math.round(chart.yMax - (chart.yMax * i) / 5);
          return (
            <g key={`gy-${i}`}>
              <line x1={chart.pad.left} y1={y} x2={chart.width - chart.pad.right} y2={y} className={styles.trendGridLine} />
              <text x={chart.pad.left - 8} y={y + 4} className={styles.trendAxisLabel} textAnchor="end">{val}</text>
            </g>
          );
        })}
        <line x1={chart.pad.left} y1={chart.pad.top} x2={chart.pad.left} y2={chart.height - chart.pad.bottom} className={styles.trendAxisLine} />
        <line x1={chart.pad.left} y1={chart.height - chart.pad.bottom} x2={chart.width - chart.pad.right} y2={chart.height - chart.pad.bottom} className={styles.trendAxisLine} />
        {activePoint ? (
          <line
            x1={activePoint.x}
            y1={chart.pad.top}
            x2={activePoint.x}
            y2={chart.height - chart.pad.bottom}
            className={styles.trendActiveGuide}
          />
        ) : null}
        <path d={chart.area} className={styles.trendArea} />
        <path d={chart.path} className={styles.trendLine} />
        {chart.points.map((p, idx) => (
          <circle
            key={`pt-${idx}`}
            cx={p.x}
            cy={p.y}
            r={idx === effectiveIndex ? 5.5 : 4}
            className={idx === effectiveIndex ? styles.trendPointActive : styles.trendPoint}
          />
        ))}
        <g className={`${styles.trendTooltipGroup} ${activePoint ? styles.trendTooltipVisible : ""}`}>
          <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={8} className={styles.trendTooltipBox} />
          <text x={tipX + 10} y={tipY + 20} className={styles.trendTooltipLabel}>
            {activePoint ? panel.data[effectiveIndex]?.label || `#${effectiveIndex + 1}` : ""}
          </text>
          <line x1={tipX} y1={tipY + 30} x2={tipX + tipW} y2={tipY + 30} className={styles.trendTooltipDivider} />
          <text x={tipX + 10} y={tipY + 50} className={styles.trendTooltipValue}>{activePoint ? activePoint.value : ""}</text>
        </g>
        <text x={chart.pad.left} y={chart.height - 10} className={styles.trendAxisLabel}>{head?.label || "-"}</text>
        <text x={(chart.pad.left + chart.width - chart.pad.right) / 2} y={chart.height - 10} className={styles.trendAxisLabel} textAnchor="middle">
          {panel.data[midIdx]?.label || "-"}
        </text>
        <text x={chart.width - chart.pad.right} y={chart.height - 10} className={styles.trendAxisLabel} textAnchor="end">{tail?.label || "-"}</text>
      </svg>
      <div className={styles.trendPanelFoot}>
        <span>{head?.label || "-"}</span>
        <span>Peak: {chart.points[chart.peakIndex]?.value || 0}</span>
        <span>{tail?.label || "-"}</span>
      </div>
    </div>
  );
}

export default function UserArrivalTrendCharts({ trendPanels = [] }) {
  return (
    <div className={styles.trendGrid}>
      {trendPanels.map((panel) => (
        <TrendPanel key={panel.key} panel={panel} />
      ))}
    </div>
  );
}

