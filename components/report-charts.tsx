"use client";
import { useRef, useState } from 'react';
import type { Metric } from '../lib/reports';
import type { TrendPoint, VisualGroup } from '../lib/report-visuals';

export const chartColors = { orange: 'var(--orange)', green: 'var(--green)', red: 'var(--red)', slate: 'var(--chart-slate)', gray: 'var(--chart-gray)', light: 'var(--line)' };
export const formatNumber = (n: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(n);
export function TrendChart({ points, stride, metric, onInspect }: { points: TrendPoint[]; stride: number; metric: Metric; onInspect: (p: TrendPoint) => void }) {
  const [cursor, setCursor] = useState<number>();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const last = points.findLastIndex(p => p.value !== null), active = Math.min(cursor ?? Math.max(0, last), points.length - 1), point = points[active];
  const ratio = metric.key === 'coverage' || metric.key === 'fp', unit = ratio ? '%' : metric.key === 'calls' ? '通' : '项';
  const width = Math.max(720, points.length * 76), height = 280, left = 42, right = 42, top = 44, bottom = 38;
  const maxValue = Math.max(1, ...points.map(p => p.value ?? 0));
  const ceiling = ratio ? 100 : Math.max(4, Math.ceil(maxValue / 4) * 4);
  const x = (i: number) => left + i / Math.max(1, points.length - 1) * (width - left - right);
  const y = (value: number) => top + (1 - value / ceiling) * (height - top - bottom);
  const segments: { x: number; y: number }[][] = [];
  points.forEach((p, i) => { if (p.value === null) return; if (i === 0 || points[i - 1].value === null) segments.push([]); segments.at(-1)!.push({ x: x(i), y: y(p.value) }); });
  const valueText = (p: TrendPoint) => p.value === null ? '无可比样本' : `${formatNumber(p.value)} ${unit}`;
  return <section className="qa-trend" aria-label={`${metric.label}趋势`}>
    <div className="qa-chart-heading"><div><h2>{stride === 1 ? '每日' : '分段'}{metric.label}</h2><p><span className="qa-dot" style={{ background: chartColors.orange }}/>{unit === '%' ? stride === 1 ? '按日内样本计算占比' : '按段内样本计算占比' : `按通话结束日期 · ${unit}`} {stride > 1 && `· 每段 ${stride} 天`}</p></div><span className="qa-window">{points[0]?.label} — {points.at(-1)?.end.slice(5).replace('-', '/')}</span></div>
    <div className="qa-chart-scroll"><div className="qa-trend-canvas" style={{minWidth:Math.max(520,points.length * 64),aspectRatio:`${width}/${height}`}}>
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1={left} y1={y(i * ceiling / 4)} x2={width - right} y2={y(i * ceiling / 4)} className="qa-gridline"/><text x={left - 10} y={y(i * ceiling / 4) + 5} textAnchor="end">{formatNumber(i * ceiling / 4)}</text></g>)}
        {segments.map((segment, i) => { const path = segment.map((p, n) => `${n ? 'L' : 'M'}${p.x},${p.y}`).join(' ');return <g key={i}><path d={`${path} L${segment.at(-1)!.x},${y(0)} L${segment[0].x},${y(0)} Z`} fill="#fff0e5" opacity=".6"/><path d={path} fill="none" stroke={chartColors.orange} strokeWidth="2.5" strokeLinejoin="round"/>{segment.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r="3" fill="white" stroke={chartColors.orange} strokeWidth="2"/>)}</g>;})}
        {point?.value !== null && point && <line x1={x(active)} x2={x(active)} y1={top} y2={height - bottom} stroke="#d6ab8b" strokeDasharray="3 5"/>}
        {points.map((p, i) => <g key={p.start}><text x={x(i)} y={height - 10} textAnchor="middle">{p.label}</text><g className="qa-trend-callout"><path d={`M${x(i)},${y(p.value ?? 0)-7} V${y(p.value ?? 0)-17}`} /><rect x={x(i)-30} y={y(p.value ?? 0)-39} width="60" height="24" rx="5"/><text x={x(i)} y={y(p.value ?? 0)-22} textAnchor="middle">{p.value === null ? "—" : `${formatNumber(p.value)}${ratio ? "%" : ""}`}</text></g></g>)}
      </svg>
      {points.map((p, i) => <button key={p.start} ref={el => { buttons.current[i] = el; }} className={`qa-point ${active === i ? 'selected' : ''}`} style={{ left: `${x(i) / width * 100}%`, top: `${y(p.value ?? 0) / height * 100}%` }} tabIndex={active === i ? 0 : -1} aria-label={`${p.start}${stride > 1 ? `至${p.end}` : ''}，${valueText(p)}，查看明细`} onMouseEnter={() => setCursor(i)} onFocus={() => setCursor(i)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1))); buttons.current[next]?.focus(); } }} onClick={() => onInspect(p)}><span className={p.value === null ? 'missing' : ''}/></button>)}

    </div></div>
    <div className="qa-chart-readout" aria-live="polite"><span>{point?.start}{stride > 1 && ` — ${point?.end}`}{ratio && point?.denominator !== undefined && <small>样本 {point.count} / {point.denominator}</small>}</span><strong>{point ? valueText(point) : '暂无数据'}</strong><button type="button" className="text-button" onClick={() => point && onInspect(point)}>查看该{stride > 1 ? '段' : '日'}明细</button></div>
    <p className="qa-chart-hint sr-only">方向键切换日期，Enter 查看明细。{ratio ? '无分母日期留空，不连接为 0%。' : '数量为当前样例记录汇总。'}</p>
  </section>;
}

type RingGroup = {key:string;label:string;count:number;color:string};
// Separate labels on each side without changing their angular attachment to the data.
function ringAnnotations(groups:RingGroup[],total:number) {
  let offset=0;
  const labels=groups.filter(g=>g.count>0).map(group=>{
    const fraction=group.count/total,angle=(offset+fraction/2)*Math.PI*2-Math.PI/2;
    offset+=fraction;
    return {...group,angle,right:Math.cos(angle)>=0,y:120+Math.sin(angle)*82};
  });
  for(const right of [false,true]) {
    const side=labels.filter(x=>x.right===right).sort((a,b)=>a.y-b.y);
    const gap=40;
    side.forEach((x,i)=>{x.y=Math.max(24,Math.min(214,x.y),i ? side[i-1].y+gap : 24);});
    if(side.length && side.at(-1)!.y>214) {
      side[side.length-1].y=214;
      for(let i=side.length-2;i>=0;i--) side[i].y=Math.min(side[i].y,side[i+1].y-gap);
    }
  }
  return labels;
}
export function RingChart({ title, note, groups, center, centerLabel, onSelect }: { title: string; note: string; groups: RingGroup[]; center?: string; centerLabel?: string; onSelect: (key: string) => void }) {
  const [highlight,setHighlight]=useState<string>();
  const total=groups.reduce((n,g)=>n+g.count,0),annotations=ringAnnotations(groups,total);
  const percent=(count:number)=>total ? `${(count/total*100).toFixed(1)}%` : "—";
  let offset=0;
  return <section className="qa-ring-section"><div className="qa-chart-heading"><div><h2>{title}</h2><p>{note}</p></div></div>
    <div className="qa-ring-with-labels">
      <svg viewBox="0 0 360 240" role="img" aria-label={groups.map(g=>`${g.label} ${g.count}，占比 ${percent(g.count)}`).join('；')}>
        <circle cx="180" cy="120" r="62" fill="none" stroke="var(--line)" strokeWidth="14"/>
        {total>0 && groups.map(g=>{const start=offset;offset+=g.count/total*100;return g.count>0 && <circle key={g.key} cx="180" cy="120" r="62" fill="none" stroke={g.color} strokeWidth={highlight===g.key ? 18 : 14} pathLength="100" strokeDasharray={`${g.count/total*100} ${100-g.count/total*100}`} strokeDashoffset={-start} transform="rotate(-90 180 120)" onMouseEnter={()=>setHighlight(g.key)} onMouseLeave={()=>setHighlight(undefined)}/>;})}
        <text x="180" y="118" className="qa-ring-total" textAnchor="middle">{center ?? formatNumber(total)}</text>
        <text x="180" y="138" className="qa-ring-center-label" textAnchor="middle">{centerLabel ?? '问题合计'}</text>
        {annotations.map(g=><g key={g.key} className={`qa-ring-annotation ${highlight===g.key ? 'highlighted' : ''}`}><polyline points={`${180+Math.cos(g.angle)*72},${120+Math.sin(g.angle)*72} ${g.right ? 264 : 96},${g.y} ${g.right ? 350 : 10},${g.y}`} stroke={g.color}/><circle cx={180+Math.cos(g.angle)*72} cy={120+Math.sin(g.angle)*72} r="2" fill={g.color}/><text x={g.right ? 350 : 10} y={g.y-7} textAnchor={g.right ? 'end' : 'start'}>{g.label}</text><text className="qa-ring-annotation-value" x={g.right ? 350 : 10} y={g.y+16} textAnchor={g.right ? 'end' : 'start'}>{g.count} · {percent(g.count)}</text></g>)}
        {!total && <text x="180" y="218" textAnchor="middle" className="qa-ring-center-label">暂无样本，占比不计算</text>}
      </svg>
    </div>
    <div className="qa-legend">{groups.map(g=><button key={g.key} onMouseEnter={()=>setHighlight(g.key)} onMouseLeave={()=>setHighlight(undefined)} onFocus={()=>setHighlight(g.key)} onBlur={()=>setHighlight(undefined)} onClick={()=>onSelect(g.key)} aria-label={`${g.label} ${g.count}，占比 ${percent(g.count)}，查看明细`}><span className="qa-dot" style={{background:g.color}}/><span>{g.label}</span><b>{formatNumber(g.count)}</b><small>{percent(g.count)}</small></button>)}</div>
  </section>;
}

export function HorizontalBars({ groups, total, onSelect, unit = '项', color = chartColors.orange }: { groups: VisualGroup[]; total: number; onSelect: (key: string) => void; unit?: string; color?: string }) {
  const max = Math.max(1, ...groups.map(g => g.rows.length));
  return <div className="qa-bars">{groups.map(g => <button key={g.key} className="qa-bar-row" onClick={() => onSelect(g.key)} aria-label={`${g.label}，${g.rows.length}${unit}，查看明细`}><span className="qa-bar-label">{g.label}</span><span className="qa-bar-track"><i style={{ width: `${g.rows.length / max * 100}%`, background: color }}/></span><b>{g.rows.length}<small>{unit}</small></b><span className="qa-share">{total ? `${(g.rows.length / total * 100).toFixed(0)}%` : '—'}</span><span className="qa-bar-callout">{g.label} · {g.rows.length} / {total} {unit} · 点击查看明细</span></button>)}</div>;
}
