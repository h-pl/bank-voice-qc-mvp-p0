import type { Entity, State } from './workflow.ts';

// Stage deadlines share the recorded parent clock; unknown historical clocks stay unknown.
export function taskDeadlineLimit(state: State, item: Entity): string | undefined {
  if ('executor' in item) {
    const parent = [...state.reviews, ...state.appeals, ...state.remedies, ...state.findings].find(x => x.id === item.target);
    return parent ? taskDeadlineLimit(state, parent) : undefined;
  }
  const findings = 'conclusions' in item ? [item] : 'findingIds' in item && item.type !== 'appeal' ? state.findings.filter(f => item.findingIds.includes(f.id)) : [];
  const limits = findings.filter(f => f.source === 'auto' && f.alertTiming && !['closed', 'delivered'].includes(f.status)).map(f => {
    const t = f.alertTiming!;
    const reserve = (Date.parse(t.resolutionDueAt) - Date.parse(t.triggeredAt)) * .2;
    return Date.parse(t.resolutionDueAt) - reserve;
  });
  if ('findingIds' in item && item.appealId) {
    const appeal = state.appeals.find(a => a.id === item.appealId);
    if (appeal) limits.push(Date.parse(appeal.dueAt));
  }
  const finite = limits.filter(Number.isFinite);
  return finite.length ? new Date(Math.min(...finite)).toISOString() : undefined;
}
export function defaultTaskDeadline(state: State, item: Entity, action: string, now = Date.now()): string {
  if (action === 'adjust_distribution' && 'conclusions' in item && item.distribution) return item.distribution.dueAt;
  if (['reassign', 'extend'].includes(action) && 'dueAt' in item) return item.dueAt;
  if (['assign_appeal'].includes(action) && 'dueAt' in item) return new Date(Math.min(now+86400000,Date.parse(item.dueAt))).toISOString();
  const limit = taskDeadlineLimit(state, item);
  return new Date(Math.floor(Math.min(now + 86400000, limit ? Date.parse(limit) : Infinity) / 60000) * 60000).toISOString();
}
