"use client";
import { useId, type ReactNode } from "react";
import { canSee, type Finding, type Review, type State } from "../lib/workflow";
import { Review2FindingDetail } from "./review2-detail";

export function Review2Findings({ state, review, title, renderEvidence }: {
  state: State;
  review: Review;
  title: string;
  renderEvidence: (finding: Finding) => ReactNode;
}) {
  const instanceId = useId();
  return <section className="review2-findings review2-findings-inline" aria-label="问题、复核意见与证据">
    {review.findingIds.map((id, index) => {
      const finding = state.findings.find(item => item.id === id);
      if (!finding || !canSee(state, id)) return <article className="review2-inline-issue" key={id}><h3>问题 {index + 1}</h3><p>关联问题暂不可查看。</p></article>;
      const showTitle = review.findingIds.length > 1 || finding.title !== title;
      return <article className="review2-inline-issue" key={id} aria-labelledby={showTitle ? `${instanceId}-issue-${id}` : undefined} aria-label={showTitle ? undefined : finding.title}>
        {showTitle && <h3 className="review2-inline-issue-title" id={`${instanceId}-issue-${id}`}><span>{String(index + 1).padStart(2, "0")}</span>{finding.title}</h3>}
        <Review2FindingDetail state={state} finding={finding} review={review} inline showIdentity={false}>
          {renderEvidence(finding)}
        </Review2FindingDetail>
      </article>;
    })}
  </section>;
}
