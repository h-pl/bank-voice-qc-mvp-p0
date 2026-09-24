"use client";
import { reviewResultLabel } from "../lib/lifecycle-labels";
import { Badge, Button } from "./ui";
import { Button as Control } from "./ui/button";
import { Icon } from "./icon";
import { indicatorName } from "../lib/strategy-schema";
import { findingContext } from "../lib/finding-context";
import { latest, type Call, type Review, type State } from "../lib/workflow";
const time = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export function Review2Findings({ state, review, call, onEvidence, onRule }: {
  state: State; review: Review; call?: Call;
  onEvidence: (findingId: string, segment?: number) => void;
  onRule: (findingId: string) => void;
}) {
  const submitted = !review.evidenceRequest && !state.supplements.some(sp=>(sp.target===review.id || sp.target===review.appealId) && ["pending","submitted"].includes(sp.status)) && (review.status === "supervisor" || review.status === "done");
  return <section className="review2-findings" aria-label="问题、复核意见与证据">
    {review.findingIds.map((id, index) => {
      const finding = state.findings.find(item => item.id === id);
      if (!finding) return <article className="review2-issue" key={id}><h3>问题 {index + 1}</h3><p>原始问题记录暂不可用，请补充材料后核对。</p></article>;
      const opinion = review.opinions[id];
      const position = (opinion?.evidence ?? finding.evidence).find(position => call?.transcript[position]);
      const segment = position === undefined ? undefined : call?.transcript[position];
      const { rule, summary } = findingContext(state, finding);
      const conclusion = latest(finding);
      return <article className="review2-issue" key={id} aria-labelledby={`issue-${id}`}>
        <header className="review2-issue-heading"><span className="review2-issue-number">{String(index + 1).padStart(2, "0")}</span><h3 id={`issue-${id}`}>{finding.title}</h3><Button onClick={()=>onEvidence(id)}>查看详情</Button></header>
        <div className="review2-issue-meta"><span>{finding.id}</span><span>问题来源：{finding.source === "auto" ? "规则检测" : "人工发现"}</span></div>
        <dl className="review2-summary-fields">
          <div><dt>关联指标</dt><dd><Control variant="link" className="review2-inline-link" onClick={()=>onRule(id)} aria-label={`查看${indicatorName(finding.indicator)}的命中规则`}>{indicatorName(finding.indicator)}</Control></dd></div>
          <div><dt>命中规则</dt><dd><Control variant="link" className="review2-inline-link" onClick={()=>onRule(id)}>{rule?.name ?? finding.ruleId} · V{finding.ruleVersion}</Control></dd></div>
          <div className="review2-wide-field"><dt>触发原因</dt><dd>{summary}</dd></div>
        </dl>
        <div className="review2-summary-quote">{segment ? <><Control variant="ghost" size="sm" className="review2-time" aria-label={`查看 ${time(segment.at)} 的证据上下文`} onClick={()=>onEvidence(id, position)}><Icon name="headset" size={13}/>{time(segment.at)}</Control><span className="review2-speaker">{segment.speaker === "agent" ? "坐席" : "客户"}</span><p>{segment.text}</p></> : <p className="subtle">尚未关联证据，需补充材料。</p>}</div>
        <div className="review2-summary-verdict"><span>{conclusion ? "正式结论" : submitted ? "复核建议" : "意见草稿"}</span>{conclusion || opinion ? <Badge tone={(conclusion ?? opinion)!.value === "risk" ? "danger" : (conclusion ?? opinion)!.value === "false_positive" ? "success" : "warning"}>{reviewResultLabel((conclusion ?? opinion)!.value, conclusion ? (finding.source === "manual" ? "spotcheck" : "candidate") : review.type)}</Badge> : <span>待填写</span>}{!conclusion && submitted && <small>待主管确认</small>}</div>
      </article>;
    })}
  </section>;
}
