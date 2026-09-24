import { detectionFields, fieldDefaults, indicatorFeatureField, policyCapabilities, policyFieldKeys, policyCompatibility, supportsWarning, visibleFields, type ConfigField } from "./strategy-schema.ts";
import type { Rule, RuleVersion, State } from "./workflow.ts";
export type IndicatorBinding={id:string;feature:string;policyId:string;conditions:Record<string,string>};
export const bindingFeatures=(rule:Rule,state:State)=>supportsWarning(rule.indicator)?indicatorFeatureField(rule.indicator,state)?.options ?? [rule.indicator==="6.3.5"?"规范缺失":"指标命中"]:[];
export function legacyBindingFields(rule:Rule,feature:string,state:State):ConfigField[]{
 const caps=policyCapabilities(state,[rule.id]);
 const fields=detectionFields["6.3.4"].filter(f=>!policyFieldKeys.includes(f.key)).map(f=>({...f}));
 for(const f of fields){if(f.key==="role")f.options=caps.roles;if(f.key==="stage")f.options=caps.stages;if(f.key==="mode")f.options=feature==="抢话"?caps.modes.filter(x=>x!=="持续时长"):caps.modes;}
 if(["语速过快","语速过慢"].includes(feature))fields.unshift({key:"speed",label:feature==="语速过快"?"语速高于":"语速低于",value:feature==="语速过快"?"300":"100",min:30,max:600,unit:"字/分钟"});
 return fields;
}
export function bindingFields(_rule:Rule,feature:string,_state:State):ConfigField[]{
 void _rule;void _state;
 return ["语速过快","语速过慢"].includes(feature)?[{key:"speed",label:feature==="语速过快"?"语速高于":"语速低于",value:feature==="语速过快"?"300":"100",min:30,max:600,unit:"字/分钟"}]:[];
}
export const specificConditions=(b:IndicatorBinding)=>Object.fromEntries(Object.entries(b.conditions).filter(([key])=>key==="speed" && ["语速过快","语速过慢"].includes(b.feature)));
export function newBinding(rule:Rule,feature:string,state:State,id=crypto.randomUUID()):IndicatorBinding{
 const fields=bindingFields(rule,feature,state),conditions=fieldDefaults(fields);

 return {id,feature,policyId:"",conditions};
}
export function editableBindings(rule:Rule,state:State,snapshot=rule.draft ?? rule.versions.at(-1)):IndicatorBinding[]{
 const rows=structuredClone(snapshot?.bindings ?? rule.versions.at(-1)?.bindings ?? []).map(b=>({...b,conditions:{...fieldDefaults(bindingFields(rule,b.feature,state)),...specificConditions(b)}}));
 for(const feature of bindingFeatures(rule,state))if(!rows.some(b=>b.feature===feature))rows.push(newBinding(rule,feature,state,`${rule.id}:${feature}`));
 return rows;
}
export function validateBindings(rule:Rule,rows:IndicatorBinding[],state:State,complete=true){
 if(!supportsWarning(rule.indicator))throw new Error("该指标无需配置预警");
 const features=bindingFeatures(rule,state);
 if(new Set(rows.map(b=>b.id)).size!==rows.length)throw new Error("触发配置编号重复");
 if(complete && features.some(f=>!rows.some(b=>b.feature===f)))throw new Error("请配置全部特征；无需预警的特征请明确选择不预警");
 for(const b of rows){
  const fields=bindingFields(rule,b.feature,state);
  if(Object.keys(b.conditions).some(key=>!fields.some(f=>f.key===key)))throw new Error("通用触发条件请在预警策略中配置，请重新编辑指标关联");
  if(!features.includes(b.feature))throw new Error(`特征“${b.feature}”已失效，请移除后保存`);
  if(!b.policyId){if(complete)throw new Error(`请为“${b.feature}”选择预警策略或不预警`);continue;}
  if(b.policyId==="none"){
   if(rows.some(other=>other.id!==b.id && other.feature===b.feature))throw new Error(`“${b.feature}”选择不预警时请移除其他档位`);
   continue;
  }
  if(rows.some(other=>other.id!==b.id && other.feature===b.feature && other.policyId===b.policyId && JSON.stringify(other.conditions)===JSON.stringify(b.conditions)))throw new Error(`“${b.feature}”存在重复的触发配置`);
  const policy=state.rules.find(r=>r.id===b.policyId && r.indicator==="6.3.4" && !r.retired && r.versions.length);
  if(!policy)throw new Error("只能关联已发布的预警策略");
  const issue=policyCompatibility(rule,b.feature,policy.versions.at(-1)?.config ?? {},state);if(issue)throw new Error(`${b.feature}：${issue}，请选择适用策略`);
  for(const f of visibleFields(bindingFields(rule,b.feature,state),b.conditions)){
   const value=b.conditions[f.key];
   if(f.options?!f.options.includes(value):!/^\d+$/.test(value ?? "") || Number(value)<f.min! || Number(value)>f.max!)throw new Error(`请正确填写${b.feature}的${f.label}${f.unit?`（${f.min}–${f.max} ${f.unit}）`:""}`);
  }
 }
}
export const bindingPolicyVersions=(rows:IndicatorBinding[],state:State)=>Object.fromEntries(rows.filter(b=>b.policyId && b.policyId!=="none").map(b=>[b.policyId,state.rules.find(r=>r.id===b.policyId)?.versions.at(-1)?.version ?? 0]));
export const policyUsers=(policy:Rule,state:State)=>state.rules.filter(r=>r.indicator!=="6.3.4" && r.versions.at(-1)?.bindings?.some(b=>b.policyId===policy.id));
export function refreshPolicyReferences(state:State,policy:Rule,at:string){
 for(const r of state.rules){
  const draftUsesPolicy=r.draft?.bindings?.some(b=>b.policyId===policy.id);
  if(draftUsesPolicy)r.checked=false;
  const current=r.versions.at(-1);if(!current?.bindings?.some(b=>b.policyId===policy.id)){if(draftUsesPolicy)r.rev++;continue;}
  r.versions.push({...structuredClone(current),version:current.version+1,at,policyVersions:{...current.policyVersions,[policy.id]:policy.versions.at(-1)!.version}});r.rev++;if(r.draft)r.checked=false;
 }
}
export function conditionSummary(b:IndicatorBinding){
 if(!b.policyId)return "待配置";if(b.policyId==="none")return "不预警";
 const c=b.conditions,range=[c.role,c.stage==="全程"?"全程":["开场","结束"].includes(c.stage)?`${c.stage} ${c.stageSeconds} 秒`:c.stage==="服务中"?`开始后 ${c.middleStartSeconds} 秒至结束前 ${c.middleEndSeconds} 秒`:c.stage].filter(Boolean).join(" · ");
 const condition=c.mode==="持续时长"?`持续 ≥ ${c.duration} 秒`:c.mode==="累计次数"?`${c.window==="自定义时长"?`最近 ${c.windowSeconds} 秒`:c.window}累计 ≥ ${c.count} 次`:"单次命中";
 return [range,c.speed?`语速${b.feature==="语速过快"?">":"<"} ${c.speed} 字/分钟`:"",condition].filter(Boolean).join(" · ");
}
export function bindingSummary(b:IndicatorBinding,state:State,snapshot?:RuleVersion){
 const policy=state.rules.find(r=>r.id===b.policyId);const version=snapshot?.policyVersions?.[b.policyId];
 const selected=version?policy?.versions.find(v=>v.version===version):policy?.versions.at(-1);
 const conditions=snapshot?.configurationModel==="indicator-bindings"?b.conditions:{...selected?.config,...b.conditions};
 return `${b.feature}：${conditionSummary({...b,conditions})}${b.policyId && b.policyId!=="none"?` → ${policy?.name ?? "策略已失效"}${version?` V${version}`:""}`:""}`;
}
export function bindingsDiff(rule:Rule,state:State):Array<[string,string,string]>{
 const old=rule.versions.at(-1)?.bindings ?? [],next=rule.draft?.bindings ?? [];
 return [...new Set([...old,...next].map(b=>b.id))].map(id=>{const a=old.find(b=>b.id===id),b=next.find(b=>b.id===id);return [b?.feature ?? a!.feature,a?bindingSummary(a,state,rule.versions.at(-1)):"—",b?bindingSummary(b,state,rule.draft):"已移除"];});
}

/** Both editors update rule bindings; a policy never keeps a second association list. */
export const policyBindingSelection=(rule:Rule,policyId:string)=>[...new Set((rule.draft?.bindings ?? rule.versions.at(-1)?.bindings ?? []).filter(b=>b.policyId===policyId).map(b=>b.feature))];
export function withPolicyBindingFeatures(rule:Rule,policyId:string,selected:string[],state:State):IndicatorBinding[]{
 const allowed=bindingFeatures(rule,state);
 if(new Set(selected).size!==selected.length || selected.some(f=>!allowed.includes(f)))throw new Error("关联特征无效，请重新选择");
 let rows=structuredClone(rule.draft?.bindings ?? rule.versions.at(-1)?.bindings ?? []);
 const removed=rows.filter(b=>b.policyId===policyId && !selected.includes(b.feature));
 rows=rows.filter(b=>b.policyId!==policyId || selected.includes(b.feature));
 for(const b of removed)if(!rows.some(other=>other.feature===b.feature) && allowed.includes(b.feature))rows.push({...b,policyId:"none"});
 for(const feature of selected){
  if(rows.some(b=>b.feature===feature && b.policyId===policyId))continue;
  const source=editableBindings(rule,state).filter(b=>b.feature===feature);
  const variants=[...new Map(source.map(b=>[JSON.stringify(b.conditions),b.conditions])).values()];
  rows=rows.filter(b=>b.feature!==feature || (b.policyId && b.policyId!=="none"));
  for(const conditions of variants.length?variants:[newBinding(rule,feature,state).conditions]){
   const placeholder=source.find(b=>(!b.policyId || b.policyId==="none") && JSON.stringify(b.conditions)===JSON.stringify(conditions));
   rows.push({...newBinding(rule,feature,state,placeholder?.id),policyId,conditions:{...conditions}});
  }
 }
 validateBindings(rule,rows,state,false);
 return rows;
}
