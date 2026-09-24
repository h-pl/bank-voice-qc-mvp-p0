"use client";
import { reviewResultLabel } from "../lib/lifecycle-labels";
import type { PrdState } from "../lib/prd-seed-catalog";
import type { ReactNode } from 'react';
import { Badge } from './ui';
import { Button } from './ui/button';
import { ConfigurationRead } from './indicator-config';
import { ResourceContent } from './policy-content';
import { indicatorName } from '../lib/strategy-schema';
import { findingContext } from '../lib/finding-context';
import { person, type Finding, type Review, type State } from '../lib/workflow';
const date = (value?: string) => value ? new Intl.DateTimeFormat('zh-CN', { timeZone:'Asia/Shanghai', month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false }).format(new Date(value)) : '未记录';

export function Review2FindingDetail({ state, finding, review, onRule, onCall, children }: { state: State; finding: Finding; review: Review; onRule:()=>void; onCall:()=>void; children:ReactNode }) {
  const { rule, basis, summary } = findingContext(state, finding);
  const opinion = review.opinions[finding.id];
  const warning = (state as PrdState).warningDecisions?.find(item=>item.findingId===finding.id);
  const detection = (state as PrdState).detectionResults?.find(item=>item.id===warning?.detectionId);
  const policy = state.rules.find(item=>item.id===warning?.policyId);
  const submission = state.logs.filter(log=>log.target===review.id && log.action==='提交复核意见').at(-1);
  const draft = !['supervisor','done'].includes(review.status);
  return <div className="finding-detail">
    <div className="finding-detail-meta"><span>{finding.id}</span><span>问题来源：{finding.source==='auto'?'规则检测':'人工发现'}</span><Button variant="link" className="review2-inline-link" onClick={onCall}>来源通话 {finding.callId}</Button></div>
    <section className="finding-detail-section" aria-label="问题与触发依据">
      <dl className="review2-summary-fields"><div><dt>关联指标</dt><dd><Button variant="link" className="review2-inline-link" onClick={onRule}>{indicatorName(finding.indicator)} · {finding.indicator}</Button></dd></div><div><dt>命中规则</dt><dd><Button variant="link" className="review2-inline-link" onClick={onRule}>{rule?.name ?? finding.ruleId} · V{finding.ruleVersion}</Button></dd></div></dl>
      {warning && <dl className="review2-summary-fields"><div><dt>触发策略</dt><dd>{policy?.name ?? warning.policyId} · V{warning.policyVersion}</dd></div><div><dt>预警判断</dt><dd>满足策略条件</dd></div><div><dt>检查范围</dt><dd>{detection?.role==='customer'?'客户':'坐席'} · {warning.conditions.stage} · {detection?.range[0]}–{detection?.range[1]} 秒</dd></div><div><dt>触发条件</dt><dd>{warning.reason}</dd></div></dl>}
      <h3>为什么标记为问题</h3><p>{summary}</p>
      {basis && <div className="finding-checks">{basis.checks.map(check=><div key={check.requirement}><div><b>{check.requirement}</b><Badge tone="warning">{check.result}</Badge></div><p>{check.observation}</p></div>)}</div>}
    </section>
    <section className="finding-detail-section finding-audio" aria-label="完整录音与证据">{children}</section>
    <section className="finding-detail-section" aria-label="人工复核"><h3>{draft?'复核草稿':'人工复核'}</h3>{opinion ? <><div className="finding-review-result"><Badge tone={opinion.value==='risk'?'danger':opinion.value==='false_positive'?'success':'warning'}>{reviewResultLabel(opinion.value,review.type)}</Badge><span>{draft?'尚未提交':finding.conclusions.length?'历史复核建议':'复核建议，待主管确认'}</span></div><p>{opinion.note || '尚未填写详细理由'}</p><div className="finding-detail-meta"><span>{submission?'提交人':'当前复核人'}：{person(submission?.actor ?? review.owner)?.name ?? '未记录'}</span><span>{submission?'提交时间':'复核记录时间'}：{date(submission?.at ?? review.history.at(-1)?.at)}</span></div></> : <p className="subtle">尚未填写复核意见。</p>}
      {!!finding.conclusions.length && <div className="finding-conclusions"><h3>正式结论</h3>{[...finding.conclusions].reverse().map(c=><div key={c.version}><b>{reviewResultLabel(c.value,finding.source==='manual'?'spotcheck':'candidate')} · V{c.version}</b><p>{c.note}</p><small>{person(c.by)?.name ?? '未记录'} · {date(c.at)}</small></div>)}</div>}
    </section>
  </div>;
}

export function Review2RuleDetail({ state, finding }: { state:State; finding:Finding }) {
  const { rule, version } = findingContext(state, finding);
  return <div className="finding-detail">
    <div className="finding-detail-meta"><span>{indicatorName(finding.indicator)} · {finding.indicator}</span><span>{finding.ruleId}</span><Badge>命中版本 V{finding.ruleVersion}</Badge></div>
    {!rule || !version ? <p role="status">命中时的规则版本暂不可用，请补充原始依据。当前不会以最新版本替代。</p> : <>
      <section className="finding-detail-section"><h3>{rule.name}</h3><p className="subtle">以下按本次命中的 V{version.version} 展示配置与业务依据。</p><dl className="review2-summary-fields"><div><dt>适用业务</dt><dd>{version.scope}</dd></div><div><dt>版本时间</dt><dd>{date(version.at)}</dd></div></dl>{version.config ? <ConfigurationRead rule={rule} snapshot={version} state={state}/> : rule.editable==='threshold' ? <p>触发阈值：{version.threshold} 秒</p> : <p>{finding.ruleId==='R-SOP-TIME' ? version.trigger : '具体判断条件以命中版本引用的业务依据为准。'}</p>}</section>
      <section className="finding-detail-section"><h3>业务依据与例外</h3>{Object.entries(version.resources).map(([id,number])=>{const resource=state.resources.find(r=>r.id===id);const snapshot=resource?.versions.find(v=>v.version===number);return <article className="finding-resource" key={id}><h4>{resource?.name ?? id} · V{number}</h4>{resource && snapshot ? <><ResourceContent resource={resource} snapshot={snapshot}/><dl><div><dt>适用角色</dt><dd>{snapshot.role || '未记录'}</dd></div><div><dt>例外条件</dt><dd>{snapshot.exception || '该版本未记录例外条件'}</dd></div></dl></> : <p>引用的历史资源版本暂不可用，请补充材料。</p>}</article>;})}{!Object.keys(version.resources).length && <p className="subtle">该版本未关联业务依据，需补充核对。</p>}</section>
      <p className="subtle">问题 {finding.id} · 检测批次 {finding.batchId}</p>
    </>}
  </div>;
}
