"use client";
import { useRef, useState } from "react";
import { indicatorName, supportsWarning } from "../lib/strategy-schema";
import type { Command, Rule, State } from "../lib/workflow";
import { Button } from "./ui";
import { PolicyAssociationEditor } from "./policy-association-editor";
export function PolicyRuleReferences({policy,state,manager,historical,onSubmit,onEdit}:{policy:Rule;state:State;manager:boolean;historical:boolean;onSubmit:(cmd:Command)=>void;onEdit:()=>void}) {
 const [editing,setEditing]=useState(false),section=useRef<HTMLElement>(null);
 const references=state.rules.filter(r=>!r.retired && supportsWarning(r.indicator)).map(rule=>({rule,bindings:rule.versions.at(-1)?.bindings?.filter(b=>b.policyId===policy.id) ?? []})).filter(row=>row.bindings.length);
 const canManage=manager && !historical && !policy.retired;
 const close=()=>{setEditing(false);requestAnimationFrame(()=>section.current?.querySelector<HTMLButtonElement>(".policy-section-title button")?.focus({preventScroll:true}));};
 return <section ref={section} className="policy-section policy-rule-references" aria-label="关联指标规则"><div className="policy-section-title"><h3>关联指标规则 <span className="policy-reference-count">{references.length} 条</span></h3><div className="rule-section-actions">{!canManage && <span className="subtle">{policy.retired?"已归档，仅供查看":"仅质检主管可配置"}</span>}<Button disabled={!canManage} onClick={()=>policy.versions.length?setEditing(true):onEdit()}>管理关联</Button></div></div>
 {references.length?<div className="shared-policy-reference-table" role="table" aria-label="已关联的指标规则">
  <div className="shared-policy-reference-row shared-policy-reference-head" role="row"><span role="columnheader">规则名称</span><span role="columnheader">关联指标</span><span role="columnheader">检测结果</span></div>
  {references.map(({rule,bindings})=><div className="shared-policy-reference-row" role="row" key={rule.id}><strong role="cell" data-label="规则名称">{rule.name}</strong><span role="cell" data-label="关联指标">{indicatorName(rule.indicator)}</span><span role="cell" data-label="检测结果">{[...new Set(bindings.map(b=>b.conditions.speed?`${b.feature}（${b.feature==="语速过快"?"高于":"低于"} ${b.conditions.speed} 字/分钟）`:b.feature))].join("、")}</span></div>)}
 </div>:<p className="subtle">尚未关联指标规则，可通过“管理关联”选择规则及检测结果。</p>}
 {policy.draft && <p className="subtle">有此前未完成的修改，可在配置策略中继续编辑并保存。</p>}
 {editing && <PolicyAssociationEditor policy={policy} state={state} onSubmit={onSubmit} onDone={close}/>}
 </section>;
}
