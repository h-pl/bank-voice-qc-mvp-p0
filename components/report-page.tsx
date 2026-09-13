"use client";
import { useRef, useState } from 'react';
import { useDemoClock } from '../lib/store';
import { report, reportCsv, localDate, type Metric, type ReportFilter } from '../lib/reports';
import { reportTrend, reportVisuals, periodMetric, visualMetric, type TrendPoint } from '../lib/report-visuals';
import { people, type State } from '../lib/workflow';
import { Button, Empty } from './ui';
import { download, stamp, Pagination } from './workspace';
import { TrendChart, RingChart, HorizontalBars, chartColors, formatNumber } from './report-charts';
import './report-page.css';

const tabs = [['overview', '质检概览'], ['issues', '问题分布'], ['teams', '坐席 / 班组'], ['improvement', '申诉与整改']] as const;
type Tab = typeof tabs[number][0];
type Selection = { kind: 'metric' | 'indicator' | 'verdict' | 'team'; key: string; agent?: string; period?: Pick<TrendPoint, 'start' | 'end'> };
const summaries: Record<Tab, string[]> = { overview: ['calls', 'coverage', 'risk', 'fp'], issues: ['candidates', 'risk', 'manual', 'fp'], teams: ['calls', 'completed', 'riskcalls', 'risk'], improvement: ['review-backlog', 'appeal-backlog', 'remedy-backlog'] };
const detectionGroups = [ ['completed', '已完成', chartColors.green], ['partial', '部分失败', chartColors.orange], ['failed', '失败', chartColors.red], ['running', '处理中', chartColors.slate], ['pending', '待处理', chartColors.gray] ];
const stages = [['pending', '待接收'], ['executing', '执行中'], ['verification', '待验收'], ['supervisor', '待主管处理'], ['done', '已结案'], ['terminated', '已终止']];
const verdictColors = [chartColors.red, chartColors.green, chartColors.orange, chartColors.gray];
const initialMetric = (tab: Tab) => tab === 'improvement' ? 'review-backlog' : tab === 'issues' ? 'risk' : 'calls';

function Summary({ metrics, selected, onSelect, trend = false }: { metrics: Metric[]; selected: string; onSelect: (key: string) => void; trend?: boolean }) {
  return <div className="qa-summary" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>{metrics.map(m => <button key={m.key} className={`qa-summary-item ${selected === m.key ? 'selected' : ''}`} aria-pressed={selected === m.key} onClick={() => onSelect(m.key)}><span><i className="qa-dot"/>{m.label}</span><strong>{m.value.includes('%') || m.value === '—' ? m.value : formatNumber(Number(m.value))}<small>{m.value.includes('%') || m.value === '—' ? '' : ['calls', 'completed'].includes(m.key) ? '通' : '项'}</small></strong><small>{m.note.split('；')[0]}</small><em>{selected === m.key ? trend ? '图表展示中' : '明细已选中' : trend ? '查看趋势' : '查看明细'}</em></button>)}</div>;
}

export function ReportPage({ state, onOpen }: { state: State; onOpen: (id: string) => void }) {
  const clock = useDemoClock(), today = localDate(new Date(clock).toISOString());
  const [filter, setFilter] = useState<ReportFilter>(() => ({ business: '', group: '', agent: '', start: localDate(new Date(Date.now() - 6 * 86400000).toISOString()), end: localDate(new Date().toISOString()) }));
  const [tab, setTab] = useState<Tab>('overview'), [selection, setSelection] = useState<Selection>({ kind: 'metric', key: 'calls' }), [trendKey, setTrendKey] = useState('calls');
  const [page, setPage] = useState(1), [size, setSize] = useState(5);
  const detail = useRef<HTMLElement>(null);
  const asOf = new Date(clock).toISOString();
  const invalid = !!filter.start && !!filter.end && filter.start > filter.end;
  const metrics = report(state, filter, new Date(asOf)), byKey = new Map(metrics.map(m => [m.key, m]));
  const visuals = reportVisuals(state, metrics, filter);
  const m = (key: string) => byKey.get(key)!;
  const num = (key: string) => Number(byKey.get(key)?.value ?? 0);
  const matrixPeak = Math.max(1, ...visuals.teams.flatMap(t => t.indicators.map(x => x.rows.length)));
  const stageTotal = stages.reduce((sum, [key]) => sum + num(`remedy-state-${key}`), 0);
  let selected: Metric | undefined = byKey.get(selection.key);
  if (selection.kind === 'indicator') {
    const i = visuals.indicators.find(i => i.key === selection.key), agent = visuals.teams.find(a => a.id === selection.agent);
    if (i) selected = visualMetric(`indicator-${i.key}${agent ? `-${agent.id}` : ''}`, `${agent ? agent.name + ' · ' : ''}${i.label}`, agent ? agent.indicators.find(x => x.key === i.key)!.rows : i.rows, '当前有效成立问题；按所选通话结束日期与主指标去重统计');
  } else if (selection.kind === 'verdict') {
    const v = visuals.verdicts.find(v => v.key === selection.key);
    if (v) selected = visualMetric(`verdict-${v.key}`, v.label, v.rows, '按所选通话结束日期；自动候选与人工发现的当前判定构成');
  } else if (selection.kind === 'team') {
    const a = visuals.teams.find(a => a.id === selection.key);
    if (a) selected = visualMetric(`agent-${a.id}`, `${a.name} · 通话明细`, a.calls, '按所选通话结束日期；通话量用于工作量核对，不代表绩效排名');
  }
  selected ??= byKey.get(initialMetric(tab));
  if (selection.period) selected = periodMetric(state, metrics, selection.key, selection.period);
  const current = Math.min(page, Math.max(1, Math.ceil((selected?.rows.length ?? 0) / size)));
  const select = (next: Selection, inspect = false) => { setSelection(next);setPage(1);if (inspect) detail.current?.focus({ preventScroll: false }); };
  const selectMetric = (key: string, inspect = false) => select({ kind: 'metric', key }, inspect);
  const changeTab = (next: Tab) => { setTab(next);selectMetric(initialMetric(next));if (next === 'overview') setTrendKey('calls'); };
  const set = (key: keyof ReportFilter, value: string) => { setFilter(f => ({ ...f, [key]: value }));selectMetric(tab === 'overview' ? trendKey : initialMetric(tab)); };
  const range = (days: number) => ({ start: localDate(new Date(Date.parse(today + 'T12:00:00+08:00') - (days - 1) * 86400000).toISOString()), end: today });
  const rangeLabel = `${filter.start || '不限开始'} — ${filter.end || '不限结束'}`;
  const trend = reportTrend(state, metrics, trendKey, filter, today);
  const detailKeys = tab === 'overview' ? ['riskcalls', 'candidates', 'manual'] : tab === 'issues' ? ['riskappealing'] : tab === 'improvement' ? ['review-overdue', 'appeal-overdue', 'remedy-overdue', 'paused', 'materialpending', 'extended', 'everoverdue', 'sourcechanged', 'review-due', 'appeal-due', 'remedy-due', 'terminated'] : [];
  if (!metrics.length) return <Empty text="当前角色无质量报表权限"/>;
  return <div className="qa-analytics">
    <div className="qa-tabs" role="tablist" aria-label="质量报表视图">{tabs.map(([key, label], i) => <button type="button" role="tab" id={`report-tab-${key}`} aria-controls="report-view-panel" aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} key={key} onClick={() => changeTab(key)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault();const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;changeTab(tabs[n][0]);(e.currentTarget.parentElement?.children[n] as HTMLButtonElement)?.focus(); } }}>{label}</button>)}</div>
    <section className="qa-filter-panel" aria-label="报表筛选"><div className="qa-filter-fields">
      <label>开始日期<input name="report-start" aria-label="报表开始日期" type="date" value={filter.start} aria-invalid={invalid} aria-describedby={invalid ? 'report-date-error' : undefined} onChange={e => set('start', e.target.value)}/></label>
      <label>结束日期<input name="report-end" aria-label="报表结束日期" type="date" value={filter.end} aria-invalid={invalid} aria-describedby={invalid ? 'report-date-error' : undefined} onChange={e => set('end', e.target.value)}/></label>
      <label>业务<select name="report-business" aria-label="报表业务" value={filter.business} onChange={e => set('business', e.target.value)}><option value="">全部业务</option>{['账户查询', '信用卡', '转账汇款'].map(x => <option key={x}>{x}</option>)}</select></label>
      <label>班组<select name="report-group" aria-label="报表班组" value={filter.group} onChange={e => { setFilter(f => ({ ...f, group: e.target.value, agent: '' }));selectMetric(tab === 'overview' ? trendKey : initialMetric(tab)); }}><option value="">全部班组</option><option>客服一组</option><option>客服二组</option></select></label>
      <label>坐席<select name="report-agent" aria-label="报表坐席" value={filter.agent} onChange={e => set('agent', e.target.value)}><option value="">全部坐席</option>{people.filter(p => p.role === 'agent' && (!filter.group || state.calls.some(c => c.agentId === p.id && c.group === filter.group))).map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    </div><div className="qa-filter-footer"><span>{rangeLabel}<small>北京时间</small></span><div className="qa-date-shortcuts">{[7, 14, 30].map(days => <button type="button" key={days} aria-pressed={filter.start === range(days).start && filter.end === today} onClick={() => { setFilter(f => ({ ...f, ...range(days) }));selectMetric(tab === 'overview' ? trendKey : initialMetric(tab)); }}>近 {days} 天</button>)}<button type="button" onClick={() => { setFilter({ business: '', group: '', agent: '', ...range(7) });selectMetric(tab === 'overview' ? trendKey : initialMetric(tab)); }}>重置筛选</button></div></div>
      {invalid && <p className="qa-date-error" id="report-date-error" role="alert">开始日期不能晚于结束日期。<button type="button" onClick={() => { setFilter(f => ({ ...f, start: f.end, end: f.start }));setPage(1); }}>交换日期</button></p>}
    </section>
    {!invalid && <div role="tabpanel" id="report-view-panel" aria-labelledby={`report-tab-${tab}`}>
      <div className="qa-context"><span>{tab === 'improvement' ? '当前管理范围快照；期间结果单独按日期统计' : '按通话结束日期；问题使用当前有效结论'}</span><span>截至 {stamp(asOf)} · 示例数据</span></div>
      <section className="qa-analysis-panel">
        {tab === 'improvement' && <div className="qa-section-title"><h2>当前待处理</h2><span>截至当前时刻，不受日期范围限制</span></div>}
        <Summary metrics={summaries[tab].map(key => m(key))} selected={tab === 'overview' ? trendKey : selection.key} trend={tab === 'overview'} onSelect={key => { selectMetric(key);if (tab === 'overview') setTrendKey(key); }}/>
        {tab === 'overview' && <div className="qa-charts-grid"><div>{num('calls') ? <TrendChart key={`${trendKey}-${rangeLabel}-${filter.business}-${filter.group}-${filter.agent}`} points={trend.points} stride={trend.stride} metric={m(trendKey)} onInspect={period => select({ kind: 'metric', key: trendKey, period }, true)}/> : <Empty text="所选期间暂无通话记录" hint="调整日期或业务范围后查看趋势。"/>}</div><RingChart title="检测状态" note="范围内已结束通话 · 通" center={m('coverage').value} centerLabel="自动处理成功占比" groups={detectionGroups.map(([key, label, color]) => ({ key, label, color, count: num(key) }))} onSelect={key => selectMetric(key, true)}/></div>}
        {tab === 'issues' && <div className="qa-charts-grid"><section className="qa-chart-region"><div className="qa-chart-heading"><div><h2>成立问题 · 主指标分布</h2><p>同一问题按主指标计一次，点击分类查看依据</p></div><span className="qa-window">{num('risk')} 项</span></div><HorizontalBars groups={visuals.indicators.toSorted((a, b) => b.rows.length - a.rows.length)} total={num('risk')} onSelect={key => select({ kind: 'indicator', key }, true)}/></section><RingChart title="问题判定构成" note="自动候选与人工发现 · 当前结论" groups={visuals.verdicts.map((v, i) => ({ key: v.key, label: v.label, count: v.rows.length, color: verdictColors[i] }))} onSelect={key => select({ kind: 'verdict', key }, true)}/></div>}
        {tab === 'teams' && <div className="qa-team-charts"><section className="qa-chart-region"><div className="qa-chart-heading"><div><h2>坐席通话量</h2><p>反映工作量，不作为绩效排名</p></div><span className="qa-window">{num('calls')} 通</span></div><HorizontalBars groups={visuals.teams.map(a => ({ key: a.id, label: a.name, rows: a.calls }))} total={num('calls')} unit="通" onSelect={key => select({ kind: 'team', key }, true)} color={chartColors.slate}/></section><section className="qa-matrix-region"><div className="qa-chart-heading"><div><h2>坐席问题分布</h2><p>当前成立问题，按主指标聚合；点击格子核对事项</p></div><div className="qa-heat-legend"><span>少</span>{[0, 1, 2, 3].map(i => <i key={i} className={`level-${i}`}/>)}<span>多</span></div></div><div className="qa-matrix-scroll"><table className="qa-matrix"><thead><tr><th>坐席</th>{visuals.indicators.map(i => <th key={i.key}>{i.label}</th>)}</tr></thead><tbody>{visuals.teams.map(a => <tr key={a.id}><th>{a.name}<small>{a.group}</small></th>{a.indicators.map(i => { const level = i.rows.length ? Math.max(1, Math.ceil(i.rows.length / matrixPeak * 3)) : 0;return <td key={i.key}><button className={`level-${level}`} aria-label={`${a.name}，${i.label}，${i.rows.length}项，查看明细`} onClick={() => select({ kind: 'indicator', key: i.key, agent: a.id }, true)}>{i.rows.length}</button></td>;})}</tr>)}</tbody></table></div></section></div>}
        {tab === 'improvement' && <div className="qa-charts-grid"><section className="qa-chart-region"><div className="qa-chart-heading"><div><h2>整改当前状态</h2><p>互斥基础状态，暂停与补件作为附加标记</p></div><span className="qa-window">{stageTotal} 项</span></div><div className="qa-stage-list">{stages.map(([key, label], i) => { const value = num(`remedy-state-${key}`), total = stageTotal;return <button key={key} onClick={() => selectMetric(`remedy-state-${key}`, true)}><span className="qa-dot" style={{ background: [chartColors.gray, chartColors.orange, chartColors.slate, '#9b8a75', chartColors.green, chartColors.red][i] }}/><span>{label}</span><div className="qa-bar-track"><i style={{ width: `${value / Math.max(1, total) * 100}%`, background: [chartColors.gray, chartColors.orange, chartColors.slate, '#9b8a75', chartColors.green, chartColors.red][i] }}/></div><b>{value}</b><small>项</small></button>;})}</div></section><section className="qa-period-results"><div className="qa-chart-heading"><div><h2>所选期间结果</h2><p>裁定按裁定日，按时办结按有效到期日</p></div></div>{['appealchange', 'review-ontime', 'appeal-ontime', 'ontime'].map(key => <button key={key} onClick={() => selectMetric(key, true)}><span>{m(key).label}</span><strong>{m(key).value}<small>{key === 'appealchange' ? '' : '项'}</small></strong><small>{key === 'appealchange' ? m(key).note : '曾逾期记录不计入；仅显示数量'}</small></button>)}</section></div>}
      </section>
      {detailKeys.length > 0 && <section className="qa-secondary-panel" aria-label={tab === 'improvement' ? '跟进与期限指标' : '相关指标'}><div className="qa-section-title"><h2>{tab === 'improvement' ? '跟进与期限' : '相关指标'}</h2><span>选择指标查看明细</span></div><div className="qa-secondary-metrics">{detailKeys.map(key => <button key={key} aria-pressed={selection.key === key} onClick={() => selectMetric(key, true)}><span>{m(key).label}</span><b>{m(key).value}</b></button>)}</div></section>}
      {tab === 'teams' && <section className="qa-data-panel"><div className="qa-section-title"><h2>坐席 / 班组明细</h2><span>已判定、确认问题按问题数统计</span></div><div className="qa-table-scroll"><table><thead><tr><th>坐席 / 班组</th><th className="qa-numeric">通话量</th><th className="qa-numeric">已判定</th><th className="qa-numeric">确认问题</th><th className="qa-numeric">误报</th><th className="qa-numeric">证据不足</th><th className="qa-numeric">整改未完成</th></tr></thead><tbody>{visuals.teams.map(a => <tr key={a.id}><td><button className="text-button" onClick={() => select({ kind: 'team', key: a.id }, true)}>{a.name}</button><small>{a.group}</small></td>{[a.calls.length, a.known.length, a.risk.length, a.fp.length, a.insufficient.length, a.activeRemedies].map((n, i) => <td key={i} className="qa-numeric">{n}</td>)}</tr>)}</tbody></table></div></section>}
      {selected && <section className="qa-data-panel qa-detail" ref={detail} tabIndex={-1} aria-label="报表明细"><div className="qa-detail-heading"><div><h2>{selected.label}<span>{selected.rows.length} 条</span></h2><p>{selected.note}</p></div><div>{selection.period && <button className="text-button" onClick={() => selectMetric(selection.key)}>查看全期间</button>}<Button icon="download" onClick={() => download(reportCsv(selected!, state, asOf, filter), `${selected!.key}-P0-1.1.csv`)}>导出当前明细</Button></div></div><div className="qa-table-scroll"><table><thead><tr><th>对象编号</th><th>关联通话</th><th>事项</th><th>状态 / 结果</th><th>归属时间</th><th>操作</th></tr></thead><tbody>{selected.rows.slice((current - 1) * size, current * size).map(r => <tr key={r.id}><td className="qa-object-id">{r.id}</td><td>{r.callId}</td><td>{r.title}</td><td><span className={`qa-result ${r.status.includes('失败') || r.status.includes('风险成立') ? 'risk' : r.status.includes('完成') || r.status.includes('误报') ? 'good' : ''}`}>{r.status}</span></td><td>{stamp(r.date)}</td><td><button className="text-button" onClick={() => onOpen(r.id)}>查看事项</button></td></tr>)}</tbody></table>{!selected.rows.length && <Empty text="当前口径下没有记录" hint="可切换图表分类或调整筛选；比例分母为零时显示 —。"/>}</div><Pagination page={current} size={size} total={selected.rows.length} onPage={setPage} onSize={n => { setSize(n);setPage(1); }}/></section>}
    </div>}
    <p className="qa-footnote">口径 P0-1.1 · 统计与明细使用同一组事项。人工确认误报占比不是模型 FPR；按时结案仅展示数量。</p>
  </div>;
}
