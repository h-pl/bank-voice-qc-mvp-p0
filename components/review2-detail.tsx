"use client";
import { businessRecordText } from "../lib/timeline-presentation";
import { CallReference, CopyRecordId } from "./record-id";
import { reviewResultLabel } from "../lib/lifecycle-labels";
import type { PrdState } from "../lib/prd-seed-catalog";
import type { ReactNode } from 'react';
import { Badge } from './ui';
import { Button } from './ui/button';
import { ConfigurationRead } from './indicator-config';
import { ResourceContent } from './policy-content';
import { indicatorName } from '../lib/strategy-schema';
import { findingContext } from '../lib/finding-context';
import { latest, person, type Finding, type Review, type State } from '../lib/workflow';
const date = (value?: string) => value ? new Intl.DateTimeFormat('zh-CN', { timeZone:'Asia/Shanghai', month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false }).format(new Date(value)) : '未记录';

export function Review2FindingDetail({ state, finding, review, onRule, onCall, children, showIdentity = true, inline = false }: { state: State; finding: Finding; review?: Review; children:ReactNode; showIdentity?:boolean } & ({ inline:true; onRule?:never; onCall?:never } | { inline?:false; onRule:()=>void; onCall:()=>void })) {
  const { rule, basis, summary } = findingContext(state, finding);
  const opinion = review?.opinions[finding.id];
  const warning = (state as PrdState).warningDecisions?.find(item=>item.findingId===finding.id);
  const detection = (state as PrdState).detectionResults?.find(item=>item.id===warning?.detectionId);
  const policy = state.rules.find(item=>item.id===warning?.policyId);
  const submission = state.logs.filter(log=>review && log.target===review.id && log.action==='提交复核意见').at(-1);
  const draft = !!review && (!['supervisor','done'].includes(review.status) || inline && (!!review.evidenceRequest || state.supplements.some(sp => (sp.target === review.id || sp.target === review.appealId) && ['pending','submitted'].includes(sp.status))));
  const warningDetails = warning && <dl className="review2-summary-fields"><div><dt>触发策略</dt><dd>{policy?.name ?? <CopyRecordId id={warning.policyId}/>}</dd></div><div><dt>预警判断</dt><dd>满足策略条件</dd></div><div><dt>检查范围</dt><dd>{detection?.role==='customer'?'客户':'坐席'} · {warning.conditions.stage} · {detection?.range[0]}–{detection?.range[1]} 秒</dd></div><div><dt>触发条件</dt><dd>{warning.reason}</dd></div></dl>;
  const checkDetails = basis && <div className="finding-checks">{basis.checks.map(check=><div key={check.requirement}><div><b>{check.requirement}</b><Badge tone="warning">{check.result}</Badge></div>{businessRecordText(check.observation)!==businessRecordText(summary) && <p>{businessRecordText(check.observation)}</p>}</div>)}</div>;
  const conclusion = latest(finding);
  const reviewSection = (review || !!finding.conclusions.length) && <section className="finding-detail-section" aria-label="人工复核">{review && <h3>{draft?'复核草稿':'人工复核'}</h3>}{opinion ? <><div className="finding-review-result"><Badge tone={opinion.value==='risk'?'danger':opinion.value==='false_positive'?'success':'warning'}>{reviewResultLabel(opinion.value,review?.type ?? 'candidate')}</Badge><span>{draft?'尚未提交':finding.conclusions.length?'历史复核建议':'复核建议，待主管确认'}</span></div><p>{businessRecordText(opinion.note || '尚未填写详细理由')}</p><div className="finding-detail-meta"><span>{submission?'提交人':'当前复核人'}：{person(submission?.actor ?? review?.owner ?? '')?.name ?? '未记录'}</span><span>{submission?'提交时间':'复核记录时间'}：{date(submission?.at ?? review?.history.at(-1)?.at)}</span></div></> : review ? <p className="subtle">尚未填写复核意见。</p> : null}
      {!!finding.conclusions.length && <div className="finding-conclusions"><h3>正式结论</h3>{[...finding.conclusions].reverse().map(c=><div key={c.version}><b>{reviewResultLabel(c.value,finding.source==='manual'?'spotcheck':'candidate')}</b><p>{businessRecordText(c.note)}</p><small>{person(c.by)?.name ?? '未记录'} · {date(c.at)}</small></div>)}</div>}
    </section>;
  return <div className="finding-detail">
    {showIdentity && <div className="finding-detail-meta"><CopyRecordId id={finding.id}/><span>问题来源：{finding.source==='auto'?'系统检出':'人工发现'}</span>{!inline && <span>来源通话 <CallReference id={finding.callId} onOpen={onCall!}/></span>}</div>}
    <section className="finding-detail-section" aria-label="问题与触发依据">
      {!inline && <dl className="review2-summary-fields"><div><dt>关联指标</dt><dd><Button variant="link" className="review2-inline-link" onClick={onRule}>{indicatorName(finding.indicator)}</Button></dd></div><div><dt>命中规则</dt><dd>{rule ? <Button variant="link" className="review2-inline-link" onClick={onRule}>{rule.name}</Button> : <><CopyRecordId id={finding.ruleId}/> <Button variant="link" onClick={onRule}>查看规则</Button></>}</dd></div></dl>}

      {!inline && warningDetails}
      <h3>{inline ? "触发原因" : "为什么标记为问题"}</h3><p>{businessRecordText(summary)}</p>
      {!inline && checkDetails}

    </section>
    {inline && review && <div className="review2-summary-verdict"><span>{conclusion ? "正式结论" : draft ? "意见草稿" : "复核建议"}</span>{conclusion || opinion ? <Badge tone={(conclusion ?? opinion)!.value === "risk" ? "danger" : (conclusion ?? opinion)!.value === "false_positive" ? "success" : "warning"}>{reviewResultLabel((conclusion ?? opinion)!.value, conclusion ? (finding.source === "manual" ? "spotcheck" : "candidate") : review.type)}</Badge> : <span>待填写</span>}{!conclusion && !draft && <small>待主管确认</small>}</div>}
    <section className={`finding-detail-section finding-audio${inline ? " inline-evidence-surface" : ""}`} aria-label="完整录音与证据">{children}</section>
    {inline && (warning || basis?.checks.length) ? <section className="finding-detail-section" aria-label="补充判断信息"><h3>补充判断信息</h3>{warningDetails}{checkDetails}</section> : null}
    {reviewSection}
  </div>;
}

export function Review2RuleDetail({ state, finding }: { state:State; finding:Finding }) {
  const { rule, version } = findingContext(state, finding);
  return <div className="finding-detail">
    {!rule || !version ? <p role="status">命中时的规则依据暂不可用，请补充原始材料。</p> : <>
      <section className="finding-detail-section"><h3>{rule.name}</h3><dl className="review2-summary-fields"><div><dt>适用业务</dt><dd>{version.scope}</dd></div></dl>{version.config ? <ConfigurationRead rule={rule} snapshot={version} state={state} context="evidence"/> : rule.editable==='threshold' ? <p>触发阈值：{version.threshold} 秒</p> : <p>{finding.ruleId==='R-SOP-TIME' ? version.trigger : '具体判断条件以检测时引用的业务依据为准。'}</p>}</section>
      <section className="finding-detail-section"><h3>业务依据</h3>{Object.entries(version.resources).map(([id,number])=>{const resource=state.resources.find(r=>r.id===id);const snapshot=resource?.versions.find(v=>v.version===number);return <article className="finding-resource" key={id}><h4>{resource?.name ?? <CopyRecordId id={id}/>}</h4>{resource && snapshot ? <><ResourceContent resource={resource} snapshot={snapshot} evidence/><dl>{snapshot.role && <div><dt>适用角色</dt><dd>{snapshot.role}</dd></div>}{snapshot.exception && <div><dt>例外条件</dt><dd>{snapshot.exception}</dd></div>}</dl></> : <p>检测时引用的资源内容暂不可用，请补充材料。</p>}</article>;})}{!Object.keys(version.resources).length && <p className="subtle">本次检测未关联业务依据，需补充核对。</p>}</section>
    </>}
  </div>;
}
