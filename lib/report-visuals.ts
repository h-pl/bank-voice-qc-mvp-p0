import { localDate, type Metric, type ReportFilter, type Row } from './reports.ts';
import { latest, people, type State } from './workflow.ts';
import { officialIndicators } from './official-indicators.ts';

export type TrendPoint = { start: string; end: string; label: string; value: number | null; count: number; denominator?: number };
export type VisualGroup = { key: string; label: string; rows: Row[] };
const dayMs = 86400000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const isoDay = (stamp: number) => new Date(stamp).toISOString().slice(0, 10);
export function periodRows(rows: Row[], start: string, end: string) {
  return rows.filter(r => r.date && localDate(r.date) >= start && localDate(r.date) <= end);
}
export function periodMetric(s: State, metrics: Metric[], key: string, period: Pick<TrendPoint, 'start' | 'end'>): Metric | undefined {
  const metric = metrics.find(m => m.key === key);
  if (!metric) return;
  const rows = periodRows(metric.rows, period.start, period.end);
  const completed = new Set(metrics.find(m => m.key === 'completed')?.rows.map(r => r.id));
  const findings = new Map(s.findings.map(f => [f.id, f]));
  const n = key === 'coverage' ? rows.filter(r => completed.has(r.id)).length : key === 'fp' ? rows.filter(r => {const f = findings.get(r.id);return f && latest(f)?.value === 'false_positive';}).length : rows.length;
  const ratio = key === 'coverage' || key === 'fp';
  const scope = `${period.start}${period.end === period.start ? '' : ` 至 ${period.end}`}`;
  const basis = key === 'coverage' ? `已完成 ${n} / 已结束通话 ${rows.length}` : key === 'fp' ? `自动候选中误报 ${n} /（误报 + 成立）${rows.length}；不是模型 FPR` : key === 'risk' ? '按通话结束日期；当前有效成立结论' : '按通话结束日期；不含通话中记录';
  return {...metric, key:`${key}-${period.start}`, label:`${metric.label} · ${scope}`, rows, value:ratio ? rows.length ? `${(n / rows.length * 100).toFixed(1)}%` : '—' : String(n), note:`所选日期 ${scope}；${basis}`} ;
}
export function reportTrend(s: State, metrics: Metric[], key: string, filter: ReportFilter, today: string) {
  const byKey = new Map(metrics.map(m => [m.key, m]));
  const source = byKey.get(key)?.rows ?? [];
  const days = (byKey.get('calls')?.rows ?? []).map(r => localDate(r.date)).sort();
  const start = filter.start || days[0] || today, end = filter.end || days.at(-1) || today;
  const count = Math.floor((utc(end) - utc(start)) / dayMs) + 1;
  if (!Number.isFinite(count) || count < 1) return { points: [] as TrendPoint[], stride: 1 };
  const stride = Math.max(1, Math.ceil(count / 31));
  const completed = new Set(byKey.get('completed')?.rows.map(r => r.id));
  const findings = new Map(s.findings.map(f => [f.id, f]));
  const points: TrendPoint[] = [];
  for (let i = 0; i < count; i += stride) {
    const a = isoDay(utc(start) + i * dayMs), b = isoDay(utc(start) + Math.min(count - 1, i + stride - 1) * dayMs);
    const rows = periodRows(source, a, b), denominator = rows.length;
    const numerator = key === 'coverage' ? rows.filter(r => completed.has(r.id)).length
      : key === 'fp' ? rows.filter(r => { const f = findings.get(r.id); return f && latest(f)?.value === 'false_positive'; }).length : rows.length;
    const ratio = key === 'coverage' || key === 'fp';
    points.push({ start: a, end: b, label: a.slice(5).replace('-', '/'), count: numerator,
      ...(ratio ? { denominator } : {}), value: a > today ? null : ratio ? denominator ? numerator / denominator * 100 : null : numerator });
  }
  return { points, stride };
}
export function reportVisuals(s: State, metrics: Metric[], filter: ReportFilter) {
  const byKey = new Map(metrics.map(m => [m.key, m]));
  const callRows = byKey.get('calls')?.rows ?? [], callIds = new Set(callRows.map(r => r.id));
  const callById = new Map(s.calls.map(c => [c.id, c]));
  const findingById = new Map(s.findings.map(f => [f.id, f]));
  const risk = byKey.get('risk')?.rows ?? [];
  const indicators: VisualGroup[] = officialIndicators.filter(i => s.rules.some(r => r.indicator === i.id)).map(i => ({ key: i.id, label: i.name, rows: risk.filter(r => findingById.get(r.id)?.indicator === i.id) }));
  const verdictNames = { risk: '风险成立', false_positive: '误报', insufficient: '证据不足', pending: '尚未判定' };
  const allFindings: Row[] = s.findings.filter(f => callIds.has(f.callId)).map(f => ({ id: f.id, callId: f.callId, title: f.title, status: verdictNames[latest(f)?.value ?? 'pending'], date: callById.get(f.callId)!.endedAt! }));
  const verdicts: VisualGroup[] = Object.entries(verdictNames).map(([key, label]) => ({ key, label, rows: allFindings.filter(r => (latest(findingById.get(r.id)!)?.value ?? 'pending') === key) }));
  const teams = people.filter(p => p.role === 'agent' && (!filter.agent || p.id === filter.agent) && (!filter.group || s.calls.some(c => c.agentId === p.id && c.group === filter.group))).map(p => {
    const calls = callRows.filter(r => callById.get(r.id)?.agentId === p.id), ids = new Set(calls.map(r => r.id));
    const findings = allFindings.filter(r => ids.has(r.callId));
    return { id: p.id, name: p.name, group: s.calls.find(c => c.agentId === p.id)?.group ?? '', calls,
      known: findings.filter(r => !!latest(findingById.get(r.id)!)), risk: risk.filter(r => ids.has(r.callId)),
      fp: findings.filter(r => latest(findingById.get(r.id)!)?.value === 'false_positive'),
      insufficient: findings.filter(r => latest(findingById.get(r.id)!)?.value === 'insufficient'),
      activeRemedies: s.remedies.filter(r => ids.has(findingById.get(r.findingId)?.callId ?? '') && !['done', 'terminated'].includes(r.status)).length,
      indicators: indicators.map(i => ({ ...i, rows: i.rows.filter(r => ids.has(r.callId)) })) };
  });
  return { indicators, verdicts, teams, allFindings, callById };
}
export function visualMetric(key: string, label: string, rows: Row[], note: string): Metric {
  return { key, label, rows, note, value: String(rows.length) };
}
