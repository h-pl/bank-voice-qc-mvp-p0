"use client";
import { useRef, useState } from 'react';
import type { Metric } from '../lib/reports';
import type { TrendPoint, VisualGroup } from '../lib/report-visuals';

export const chartColors = { orange: '#ef7927', green: '#277347', red: '#b8323a', slate: '#70869c', gray: '#b8bec6', light: '#e6e9ed' };
export const formatNumber = (n: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(n);
export function TrendChart({ points, stride, metric, onInspect }: { points: TrendPoint[]; stride: number; metric: Metric; onInspect: (p: TrendPoint) => void }) {
  const [cursor, setCursor] = useState<number>();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const last = points.findLastIndex(p => p.value !== null), active = Math.min(cursor ?? Math.max(0, last), points.length - 1), point = points[active];
  const ratio = metric.key === 'coverage' || metric.key === 'fp', unit = ratio ? '%' : metric.key === 'calls' ? '通' : '项';
  const width = 720, height = 258, left = 42, right = 18, top = 20, bottom = 38;
  const maxValue = Math.max(1, ...points.map(p => p.value ?? 0));
  const ceiling = ratio ? 100 : Math.max(4, Math.ceil(maxValue / 4) * 4);
  const x = (i: number) => left + i / Math.max(1, points.length - 1) * (width - left - right);
  const y = (value: number) => top + (1 - value / ceiling) * (height - top - bottom);
  const segments: { x: number; y: number }[][] = [];
  points.forEach((p, i) => { if (p.value === null) return; if (i === 0 || points[i - 1].value === null) segments.push([]); segments.at(-1)!.push({ x: x(i), y: y(p.value) }); });
  const valueText = (p: TrendPoint) => p.value === null ? '无可比样本' : `${formatNumber(p.value)} ${unit}`;
  return <section className="qa-trend" aria-label={`${metric.label}趋势`}>
    <div className="qa-chart-heading"><div><h2>{stride === 1 ? '每日' : '分段'}{metric.label}</h2><p><span className="qa-dot" style={{ background: chartColors.orange }}/>{unit === '%' ? stride === 1 ? '按日内样本计算占比' : '按段内样本计算占比' : `按通话结束日期 · ${unit}`} {stride > 1 && `· 每段 ${stride} 天`}</p></div><span className="qa-window">{points[0]?.label} — {points.at(-1)?.end.slice(5).replace('-', '/')}</span></div>
    <div className="qa-chart-scroll"><div className="qa-trend-canvas">
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1={left} y1={y(i * ceiling / 4)} x2={width - right} y2={y(i * ceiling / 4)} className="qa-gridline"/><text x={left - 10} y={y(i * ceiling / 4) + 5} textAnchor="end">{formatNumber(i * ceiling / 4)}</text></g>)}
        {segments.map((segment, i) => { const path = segment.map((p, n) => `${n ? 'L' : 'M'}${p.x},${p.y}`).join(' ');return <g key={i}><path d={`${path} L${segment.at(-1)!.x},${y(0)} L${segment[0].x},${y(0)} Z`} fill="#fff0e5" opacity=".6"/><path d={path} fill="none" stroke={chartColors.orange} strokeWidth="2.5" strokeLinejoin="round"/>{segment.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r="3" fill="white" stroke={chartColors.orange} strokeWidth="2"/>)}</g>;})}
        {point?.value !== null && point && <line x1={x(active)} x2={x(active)} y1={top} y2={height - bottom} stroke="#d6ab8b" strokeDasharray="3 5"/>}
        {points.map((p, i) => i === 0 || i === points.length - 1 || i % Math.max(1, Math.ceil(points.length / 8)) === 0 ? <text key={p.start} x={x(i)} y={height - 10} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{p.label}</text> : null)}
      </svg>
      {points.map((p, i) => <button key={p.start} ref={el => { buttons.current[i] = el; }} className={`qa-point ${active === i ? 'selected' : ''}`} style={{ left: `${x(i) / width * 100}%`, top: `${y(p.value ?? 0) / height * 100}%` }} tabIndex={active === i ? 0 : -1} aria-label={`${p.start}${stride > 1 ? `至${p.end}` : ''}，${valueText(p)}，查看明细`} onMouseEnter={() => setCursor(i)} onFocus={() => setCursor(i)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1))); buttons.current[next]?.focus(); } }} onClick={() => onInspect(p)}><span className={p.value === null ? 'missing' : ''}/></button>)}
    </div></div>
    <div className="qa-chart-readout" aria-live="polite"><span>{point?.start}{stride > 1 && ` — ${point?.end}`}{ratio && point?.denominator !== undefined && <small>样本 {point.count} / {point.denominator}</small>}</span><strong>{point ? valueText(point) : '暂无数据'}</strong><button type="button" className="text-button" onClick={() => point && onInspect(point)}>查看该{stride > 1 ? '段' : '日'}明细</button></div>
    <p className="qa-chart-hint sr-only">方向键切换日期，Enter 查看明细。{ratio ? '无分母日期留空，不连接为 0%。' : '数量为当前样例记录汇总。'}</p>
  </section>;
}

export function RingChart({ title, note, groups, center, centerLabel, onSelect }: { title: string; note: string; groups: { key: string; label: string; count: number; color: string }[]; center?: string; centerLabel?: string; onSelect: (key: string) => void }) {
  const total = groups.reduce((n, g) => n + g.count, 0); let offset = 0;
  return <section className="qa-ring-section"><div className="qa-chart-heading"><div><h2>{title}</h2><p>{note}</p></div></div><div className="qa-ring" role="img" aria-label={groups.map(g => `${g.label}${g.count}`).join('，')}><svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="65" fill="none" stroke="#eef0f2" strokeWidth="15"/>{total > 0 && groups.map(g => { const start = offset;offset += g.count / total * 100;return <circle key={g.key} cx="80" cy="80" r="65" fill="none" stroke={g.color} strokeWidth="15" pathLength="100" strokeDasharray={`${g.count / total * 100} ${100 - g.count / total * 100}`} strokeDashoffset={-start} transform="rotate(-90 80 80)"/>;})}</svg><div><strong>{center ?? formatNumber(total)}</strong><small>{centerLabel ?? '问题合计'}</small></div></div><div className="qa-legend">{groups.map(g => <button key={g.key} onClick={() => onSelect(g.key)} aria-label={`${g.label} ${g.count}，查看明细`}><span className="qa-dot" style={{ background: g.color }}/><span>{g.label}</span><b>{formatNumber(g.count)}</b><small>{total ? `${(g.count / total * 100).toFixed(0)}%` : '—'}</small></button>)}</div></section>;
}

export function HorizontalBars({ groups, total, onSelect, unit = '项', color = chartColors.orange }: { groups: VisualGroup[]; total: number; onSelect: (key: string) => void; unit?: string; color?: string }) {
  const max = Math.max(1, ...groups.map(g => g.rows.length));
  return <div className="qa-bars">{groups.map(g => <button key={g.key} className="qa-bar-row" onClick={() => onSelect(g.key)} aria-label={`${g.label}，${g.rows.length}${unit}，查看明细`}><span className="qa-bar-label">{g.label}</span><span className="qa-bar-track"><i style={{ width: `${g.rows.length / max * 100}%`, background: color }}/></span><b>{g.rows.length}<small>{unit}</small></b><span className="qa-share">{total ? `${(g.rows.length / total * 100).toFixed(0)}%` : '—'}</span></button>)}</div>;
}
