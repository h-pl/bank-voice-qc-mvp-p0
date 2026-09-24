import { bindingPolicyVersions, validateBindings, withPolicyBindingFeatures } from "./indicator-bindings.ts";
import { supportsWarning, validateRuleResources } from "./strategy-schema.ts";
import type { Rule, RuleVersion, State } from "./workflow.ts";

/** New-policy selections are a publication proposal, never an active second binding list. */
export function prepareNewPolicyAssociations(policy:Rule,state:State,complete=true):Array<{ruleId:string;features:string[];snapshot:RuleVersion}>{
  const plan=policy.draft?.pendingPolicyBindings ?? [];
  if(!plan.length)return [];
  if(policy.indicator!=="6.3.4" || policy.versions.length || !policy.draft)throw new Error("仅新策略草稿可同时发布关联");
  if(new Set(plan.map(item=>item.ruleId)).size!==plan.length)throw new Error("关联规则不能重复");
  const published={...policy.draft,version:1};delete published.pendingPolicyBindings;
  const virtualPolicy={...policy,versions:[published]};
  const virtualState={...state,rules:[...state.rules.filter(r=>r.id!==policy.id),virtualPolicy]};
  return plan.map(item=>{
    const rule=state.rules.find(r=>r.id===item.ruleId);
    if(!rule || rule.retired || !supportsWarning(rule.indicator) || !rule.versions.length)throw new Error("关联规则不可用，请重新选择");
    if(rule.draft)throw new Error(`${rule.name}存在未发布草稿，请先处理或取消本次关联`);
    if(rule.rev!==item.rev)throw new Error(`${rule.name}已更新，请编辑策略草稿重新核对关联范围`);
    if(!item.features.length)throw new Error(`${rule.name}请至少选择一个特征`);
    const bindings=withPolicyBindingFeatures(rule,policy.id,item.features,virtualState);
    validateBindings(rule,bindings,virtualState,complete);
    const snapshot={...structuredClone(rule.versions.at(-1)!),bindings,policyVersions:bindingPolicyVersions(bindings,virtualState),configurationModel:"shared-policy" as const};
    if(complete)validateRuleResources(rule,snapshot.resources,virtualState);
    return {ruleId:rule.id,features:item.features,snapshot};
  });
}
export function pendingPoliciesForRule(state:State,ruleId:string){
  return state.rules.filter(policy=>policy.indicator==="6.3.4" && !policy.retired && !policy.versions.length).flatMap(policy=>(policy.draft?.pendingPolicyBindings ?? []).filter(item=>item.ruleId===ruleId).map(item=>({policy,features:item.features,conflict:!!state.rules.find(r=>r.id===ruleId)?.draft || state.rules.find(r=>r.id===ruleId)?.rev!==item.rev})));
}
