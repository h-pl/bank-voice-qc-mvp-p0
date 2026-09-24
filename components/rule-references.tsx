"use client";
import { Checkbox } from "./ui/checkbox";
import { indicatorName, indicatorRuleCategories, supportsWarning } from "../lib/strategy-schema";
import type { State } from "../lib/workflow";

export function TriggerRulePicker({state,value,mode,onChange}:{state:State;value:string[];mode:string;onChange:(ids:string[])=>void}){
 const rules=state.rules.filter(r=>supportsWarning(r.indicator)).sort((a,b)=>indicatorRuleCategories.findIndex(([id])=>id===a.indicator)-indicatorRuleCategories.findIndex(([id])=>id===b.indicator));
 return <fieldset className="policy-trigger-picker"><legend>触发指标／规则 <span className="subtle">（可多选）</span></legend><div className="trigger-rule-options">{rules.map(r=>{
  const incompatible=mode==="持续时长" && !["6.2.5","6.3.6"].includes(r.indicator);
  return <label key={r.id}><Checkbox checked={value.includes(r.id)} disabled={incompatible && !value.includes(r.id)} onCheckedChange={checked=>onChange(checked?[...value,r.id]:value.filter(id=>id!==r.id))}/><span>{indicatorName(r.indicator)}{rules.filter(item=>item.indicator===r.indicator).length>1 && <small>{r.name}</small>}{incompatible && <small>不支持持续时长</small>}</span></label>;
 })}</div><small>按每个指标分别累计命中事件，任一指标满足下方条件即执行处置。语音识别、文本纠错不需要预警。</small></fieldset>;
}
