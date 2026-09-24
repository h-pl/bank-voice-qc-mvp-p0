"use client";
import { useState } from "react";
import { bindingFeatures, editableBindings } from "../lib/indicator-bindings";
import { indicatorName, policyCompatibility, supportsWarning } from "../lib/strategy-schema";
import type { State } from "../lib/workflow";
import { Badge, Button, Empty, SearchField } from "./ui";
import { Checkbox } from "./ui/checkbox";
import { SelectField } from "./select-field";

export function PolicyAssociationFields({state,config,selected,onChange,creating=false}:{state:State;config:Record<string,string>;selected:Record<string,string[]>;onChange:(selection:Record<string,string[]>)=>void;creating?:boolean}){
  const [indicator,setIndicator]=useState("all");
  const [search,setSearch]=useState("");
  const [selectedOnly,setSelectedOnly]=useState(false);
  const rules=state.rules.filter(rule=>supportsWarning(rule.indicator) && (!rule.retired || selected[rule.id]?.length));
  const indicators=[...new Set(rules.map(rule=>rule.indicator))];
  const visible=rules.filter(rule=>(!selectedOnly || selected[rule.id]?.length) && (indicator==="all" || rule.indicator===indicator) && `${rule.name} ${rule.id} ${bindingFeatures(rule,state).join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selections=Object.entries(selected).filter(([,features])=>features.length);
  return <div className="policy-scope-fields">
    <div className="policy-scope-filters"><label>关联指标<SelectField aria-label="选择关联指标" value={indicator} onValueChange={setIndicator}><option value="all">全部指标</option>{indicators.map(id=><option key={id} value={id}>{indicatorName(id)}</option>)}</SelectField></label><SearchField label="搜索关联规则" name="policy-association-search" placeholder="搜索规则或检测结果…" value={search} onValueChange={setSearch}/></div>
    <div className="association-selection-summary"><span role="status">已选 {selections.length} 条规则 · {selections.reduce((n,[,features])=>n+features.length,0)} 项检测结果</span><label className="association-selected-filter"><Checkbox checked={selectedOnly} onCheckedChange={value=>setSelectedOnly(value===true)} aria-label="仅看已选"/>仅看已选</label></div>
    <div className="association-rule-groups">{visible.map(rule=>{
      const supported=bindingFeatures(rule,state),features=[...new Set([...supported,...(selected[rule.id] ?? [])])],bindings=editableBindings(rule,state);
      const blocked=rule.retired?"规则已归档":!rule.versions.length?"规则尚未完成配置":creating && rule.draft?"规则有未完成修改，请先处理或取消本次关联":"";
      return <section className="association-rule-choice" key={rule.id} aria-label={rule.name}>
        <div className="association-rule-title"><h4>{rule.name}</h4><span>{indicatorName(rule.indicator)}</span>{rule.draft && <Badge tone="warning">有未完成修改</Badge>}{blocked && <p className="scope-rule-warning">{blocked}</p>}</div>
        <div className="association-feature-options" role="group" aria-label={`${rule.name}检测结果`}>{features.map(feature=>{
          const checked=selected[rule.id]?.includes(feature) ?? false;
          const issue=blocked || (!supported.includes(feature)?"检测结果已失效":policyCompatibility(rule,feature,config,state));
          const speeds=[...new Set(bindings.filter(b=>b.feature===feature && b.conditions.speed).map(b=>b.conditions.speed))];
          const id=`associate-${rule.id}-${feature}`;
          return <div className={`association-feature ${issue?"is-unavailable":""}`} key={feature}><Checkbox id={id} checked={checked} disabled={!!issue && !checked} onCheckedChange={value=>onChange({...selected,[rule.id]:value?[...(selected[rule.id] ?? []),feature]:(selected[rule.id] ?? []).filter(f=>f!==feature)})}/><label htmlFor={id}><span>{feature}</span>{speeds.length>0 && <small>{feature==="语速过快"?"高于":"低于"} {speeds.join(" / ")} 字/分钟</small>}{issue && !blocked && <small>{issue}{checked?"，请取消关联或调整策略条件":""}</small>}</label></div>;
        })}</div>
      </section>;
    })}</div>
    {!visible.length && <Empty text={selectedOnly && !selections.length?"尚未选择检测结果":"未找到符合条件的规则"} hint="筛选不会清除已选结果，可重置筛选继续选择。" action={<Button onClick={()=>{setIndicator("all");setSearch("");setSelectedOnly(false);}}>重置筛选</Button>}/>}
  </div>;
}
