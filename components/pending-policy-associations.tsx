import { pendingPoliciesForRule } from "../lib/policy-associations";
import type { State } from "../lib/workflow";
import { Badge } from "./ui";
export function PendingPolicyAssociations({state,ruleId}:{state:State;ruleId:string}){
 const pending=pendingPoliciesForRule(state,ruleId);
 if(!pending.length)return null;
 return <section className="pending-policy-associations" aria-label="待发布策略关联"><h4>待发布策略关联</h4>{pending.map(({policy,features,conflict})=><div key={policy.id}><div><strong>{policy.name}</strong><Badge tone="warning">{conflict?"需重新核对":"待随策略发布"}</Badge></div><p>特征：{features.join("、")}</p></div>)}<p className="subtle">以上关联随新策略发布后生效。修改本规则后，策略草稿需重新核对关联范围。</p></section>;
}
