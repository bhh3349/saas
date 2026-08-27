import { useEffect, useRef, useState } from 'react';

/** 系列定义：value 来自数据行字段，axis 决定使用左/右刻度 */
export interface TrendSeriesDef<T> {
  key: keyof T & string;
  name: string;
  color: string;
  axis: 'left' | 'right';
  format: (v: number) => string;
}

interface TrendChartProps<T> {
  data: T[];
  /** X 轴标签，如日期 'MM-DD' */
  xLabel: (d: T) => string;
  series: TrendSeriesDef<T>[];
  height?: number;
}

const PAD = { top: 22, right: 12, bottom: 34, left: 52 };
const TICK_COUNT = 4;

function tickFormat(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 10000) return `${(v / 10000).toFixed(1)}w`;
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export default function TrendChart<T extends Record<string, string | number>>({
  data,
  xLabel,
  series,
  height = 280,
}: TrendChartProps<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(-1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  if (n === 0 || width === 0) {
    return (
      <div
        ref={wrapRef}
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-2)',
          fontSize: 13,
        }}
      />
    );
  }

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const baseY = PAD.top + plotH;
  const xAt = (i: number) => (n === 1 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / (n - 1));

  const leftSeries = series.filter((s) => s.axis === 'left');
  const rightSeries = series.filter((s) => s.axis === 'right');
  const maxOf = (list: TrendSeriesDef<T>[]) =>
    Math.max(
      1,
      ...data.map((d) => list.reduce((acc, s) => Math.max(acc, Number(d[s.key]) || 0), 0)),
    );
  const leftMax = maxOf(leftSeries);
  const rightMax = maxOf(rightSeries);
  const yAt = (v: number, max: number) => PAD.top + plotH - (v / max) * plotH;

  const linePath = (s: TrendSeriesDef<T>) => {
    const max = s.axis === 'left' ? leftMax : rightMax;
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(Number(d[s.key]) || 0, max).toFixed(1)}`)
      .join(' ');
  };
  const areaPath = (s: TrendSeriesDef<T>) => {
    if (n === 1) return '';
    const max = s.axis === 'left' ? leftMax : rightMax;
    const pts = data
      .map((d, i) => `${xAt(i).toFixed(1)},${yAt(Number(d[s.key]) || 0, max).toFixed(1)}`)
      .join(' ');
    return `M${pts} L${xAt(n - 1).toFixed(1)},${baseY} L${xAt(0).toFixed(1)},${baseY} Z`;
  };

  const gridLines = Array.from({ length: TICK_COUNT + 1 }, (_, i) => ({
    v: (leftMax * i) / TICK_COUNT,
    y: PAD.top + plotH - (plotH * i) / TICK_COUNT,
  }));
  const rightTicks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => ({
    v: (rightMax * i) / TICK_COUNT,
    y: PAD.top + plotH - (plotH * i) / TICK_COUNT,
  }));

  const xSkip = n > 12 ? Math.ceil(n / 8) : 1;

  const handleMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const idx = n === 1 ? 0 : Math.round((px - PAD.left) / (plotW / (n - 1)));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };

  const tip = hover >= 0 ? data[hover] : null;
  const tipLeft = Math.max(96, Math.min(width - 96, xAt(hover)));

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', height }}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(-1)}
    >
      {/* 图例 */}
      <div style={{ position: 'absolute', top: 0, right: 4, display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-2)' }}>
        {series.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
            {s.name}
          </span>
        ))}
      </div>

      <svg width={width} height={height}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`tg-area-${String(s.key)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.16 }} />
              <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0.02 }} />
            </linearGradient>
          ))}
        </defs>

        {/* 网格 + 左轴刻度 */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={width - PAD.right} y1={g.y} y2={g.y} stroke="var(--color-surface3)" strokeWidth={1} />
            <text x={PAD.left - 8} y={g.y + 4} textAnchor="end" fontSize={11} fill="var(--color-text-2)">
              {i === 0 ? 0 : tickFormat(g.v)}
            </text>
          </g>
        ))}
        {/* 右轴刻度 */}
        {rightTicks.map((g, i) => (
          <text key={`r${i}`} x={width - PAD.right + 6} y={g.y + 4} textAnchor="start" fontSize={11} fill="var(--color-text-2)">
            {i === 0 ? 0 : tickFormat(g.v)}
          </text>
        ))}

        {/* X 轴标签 */}
        {data.map((d, i) =>
          i % xSkip === 0 || i === n - 1 ? (
            <text key={i} x={xAt(i)} y={height - 10} textAnchor="middle" fontSize={11} fill="var(--color-text-2)">
              {xLabel(d)}
            </text>
          ) : null,
        )}

        {/* 面积 + 折线 + 点 */}
        {series.map((s) => (
          <g key={s.key}>
            <path d={areaPath(s)} fill={`url(#tg-area-${String(s.key)})`} />
            <path d={linePath(s)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d, i) => {
              const max = s.axis === 'left' ? leftMax : rightMax;
              const active = i === hover;
              return (
                <circle
                  key={i}
                  cx={xAt(i)}
                  cy={yAt(Number(d[s.key]) || 0, max)}
                  r={active ? 4.5 : 3}
                  fill="#fff"
                  stroke={s.color}
                  strokeWidth={2}
                />
              );
            })}
          </g>
        ))}

        {/* 悬停竖线 */}
        {hover >= 0 && (
          <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={baseY} stroke="var(--color-text-2)" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
        )}
      </svg>

      {/* Tooltip */}
      {tip && (
        <div
          style={{
            position: 'absolute',
            top: PAD.top,
            left: tipLeft,
            transform: 'translateX(-50%)',
            background: 'rgba(47,41,34,0.94)',
            color: '#fff',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            boxShadow: '0 4px 14px rgba(0,0,0,0.16)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <div style={{ marginBottom: 4, fontWeight: 600 }}>{xLabel(tip)}</div>
          {series.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
              <span style={{ opacity: 0.85 }}>{s.name}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600, paddingLeft: 10 }}>{s.format(Number(tip[s.key]) || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
