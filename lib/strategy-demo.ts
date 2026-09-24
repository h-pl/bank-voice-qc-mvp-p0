import { bindingFeatures, newBinding, bindingPolicyVersions, legacyBindingFields, specificConditions, type IndicatorBinding } from "./indicator-bindings.ts";
import { policyFieldKeys, detectionFields, visibleFields } from "./strategy-schema.ts";
import type { State } from "./workflow.ts";
import { fieldDefaults, resourceSchemas, fixedResourceReferences, legacyRuleFields as ruleFields, policyTriggers, supportsWarning, featureKey, policyCapabilities } from "./strategy-schema.ts";
import { serializeRows } from "./resource-import.ts";
/** Upgrade configuration only; retain historical snapshots, drafts and in-flight detection. */
function upgradeV5(input:State):State {
 if((input.strategyDemoVersion ?? 0)>=5)return input;
 const s=structuredClone(input),at=new Date().toISOString();
 const previousConfig=Object.fromEntries(s.rules.map(r=>[r.indicator,r.versions.at(-1)?.config ?? {}]));
 const legacyTriggers=Object.fromEntries(s.rules.filter(r=>r.indicator==="6.3.4").map(r=>[r.id,policyTriggers(r,s)]));
 for(const [kind,schema] of Object.entries(resourceSchemas)){
  const id=`RES-CFG-${kind.toUpperCase()}`;if(s.resources.some(r=>r.id===id))continue;
  s.resources.push({id,rev:0,name:`${schema.name} · 银行示例`,type:schema.group,kind,versions:[{version:1,at,content:serializeRows([schema.fields,...schema.rows]),scope:"全部业务",role:"双方",exception:"",...(schema.csv?{sourceFile:`${schema.name}_v2.csv`}:{})}]});
 }
 for(const [id,name,indicator] of [["R-VOICE-001","声纹识别","6.2.1"],["R-ASR-001","语音识别","6.2.2"],["R-CORR-001","文本纠错","6.2.4"]]){
  if(!s.rules.some(r=>r.id===id))s.rules.push({id,rev:0,name,indicator,description:`依据对应业务资源输出${name}结果。`,severity:"medium",versions:[{version:1,at,threshold:15,scope:"全部业务",trigger:"所有候选",config:{},resources:{}}]});
 }
 for(const [id,name,indicator,mode] of [["ALERT-EMOTION","情绪持续异常提醒","6.2.5","持续时长"],["ALERT-SERVICE","服务问题累计上报","6.3.5","累计次数"]]){
  if(!s.rules.some(r=>r.id===id))s.rules.push({id,rev:0,name,indicator:"6.3.4",description:"按指标结果、通用触发条件与风险等级执行处置。",severity:"medium",editable:"trigger",versions:[{version:1,at,threshold:15,scope:"全部业务",trigger:"所有候选",resources:{},triggerRules:s.rules.filter(r=>r.indicator===indicator).map(r=>r.id),config:{mode,role:indicator==="6.2.5"?"客户":"坐席",level:"中",action:"通知",recipient:"所属主管"}}]});
 }
 for(const r of s.rules){
  r.fixedResources=true;const v=r.versions.at(-1);if(!v)continue;
  if(r.indicator!=="6.3.4"){
   const resources=fixedResourceReferences(r,s);
   if(JSON.stringify(resources)!==JSON.stringify(v.resources) || JSON.stringify(v.config)!=="{}"){
    r.versions.push({...structuredClone(v),version:v.version+1,at,resources,config:{}});r.rev++;if(r.draft)r.checked=false;
   }
   continue;
  }
  const triggers=(v.triggerRules ?? legacyTriggers[r.id] ?? []).filter(id=>s.rules.some(x=>x.id===id && supportsWarning(x.indicator)));
  if(!triggers.length)triggers.push(...s.rules.filter(x=>["6.3.8","6.3.9"].includes(x.indicator)).map(x=>x.id));
  const fields=ruleFields(r,s,triggers),config=fieldDefaults(fields),old=v.config ?? {};
  for(const f of fields){
   if(old[f.key]!==undefined)config[f.key]=old[f.key];
   if(f.key.startsWith("feature:")){
    const indicator=f.key.slice(8),prior=previousConfig[indicator] ?? {};
    const key=indicator==="6.2.1"?"voiceIssue":indicator==="6.2.5"?"emotion":indicator==="6.2.6"?"intentTargets":"acoustic";
    const wanted=old[f.key] ?? old[key] ?? prior[key];
    const valid=wanted?.split(/[；＋]/).filter(x=>f.options?.includes(x));config[featureKey(indicator)]=valid?.length?valid.join("；"):f.options?.[0] ?? "";
   }
  }
  if(config.window==="本次通话")config.window="整通通话";if(config.repeat==="自定义")config.repeat="自定义时长";
  const caps=policyCapabilities(s,triggers);if(!caps.roles.includes(config.role))config.role=caps.roles[0];if(!caps.stages.includes(config.stage))config.stage=caps.stages[0];if(!caps.modes.includes(config.mode))config.mode="单次命中";
  if(JSON.stringify(config)!==JSON.stringify(v.config) || JSON.stringify(triggers)!==JSON.stringify(v.triggerRules)){
   r.versions.push({...structuredClone(v),version:v.version+1,at,config,triggerRules:triggers});r.rev++;if(r.draft)r.checked=false;
  }
 }
 s.strategyDemoVersion=5;return s;
}

/** V6: move trigger ownership to indicators without rewriting historical snapshots. */
function upgradeV6(input:State):State{
 if((input.strategyDemoVersion ?? 0)>=6)return input;
 const s=structuredClone(upgradeV5(input)),at=new Date().toISOString();
 const policies=s.rules.filter(r=>r.indicator==="6.3.4").map(r=>({rule:r,snapshot:structuredClone(r.versions.at(-1))}));
 for(const {rule,snapshot} of policies){
  if(!snapshot)continue;
  const config=Object.fromEntries(policyFieldKeys.map(key=>[key,snapshot.config?.[key] ?? detectionFields["6.3.4"].find(f=>f.key===key)!.value]));
  const next={...structuredClone(snapshot),version:snapshot.version+1,at,configurationModel:"indicator-bindings" as const,config};delete next.triggerRules;
  rule.versions.push(next);rule.rev++;if(rule.draft)rule.checked=false;
 }
 for(const rule of s.rules.filter(r=>r.indicator!=="6.3.4")){
  const v=rule.versions.at(-1);if(!v || !supportsWarning(rule.indicator))continue;
  const bindings:IndicatorBinding[]=[];
  for(const feature of bindingFeatures(rule,s)){
   for(const {rule:policy,snapshot} of policies){
    if(!snapshot?.triggerRules?.includes(rule.id))continue;
    const selected=snapshot.config?.[featureKey(rule.indicator)];
    if(selected && !selected.split(/[；＋]/).includes(feature))continue;
    const row=newBinding(rule,feature,s,`${rule.id}:${feature}:${policy.id}`);
    row.policyId=policy.id;row.conditions=fieldDefaults(legacyBindingFields(rule,feature,s));
    for(const key of Object.keys(row.conditions))if(snapshot.config?.[key]!==undefined)row.conditions[key]=snapshot.config[key];
    bindings.push(row);
   }
   if(!bindings.some(b=>b.feature===feature))bindings.push(newBinding(rule,feature,s,`${rule.id}:${feature}`));
  }
  rule.versions.push({...structuredClone(v),version:v.version+1,at,configurationModel:"indicator-bindings",bindings,policyVersions:bindingPolicyVersions(bindings,s)});rule.rev++;if(rule.draft)rule.checked=false;
 }
 s.strategyDemoVersion=6;return s;
}

/** V7 keeps existing effective behavior while consolidating common fields in reusable policies. */
export function withStrategyDemo(input:State):State{
 if((input.strategyDemoVersion ?? 0)>=7)return input;
 const s=structuredClone(upgradeV6(input)),at=new Date().toISOString();
 const common=detectionFields["6.3.4"].filter(f=>!policyFieldKeys.includes(f.key));
 const defaults=fieldDefaults(common);
 const signature=(config:Record<string,string>)=>JSON.stringify(Object.fromEntries(visibleFields(common,config).map(f=>[f.key,config[f.key]])));
 const bindingPolicies=new Map<string,string>();
 for(const policy of s.rules.filter(r=>r.indicator==="6.3.4")){
  const current=policy.versions.at(-1);if(!current)continue;
  const historical=[...policy.versions].reverse().find(v=>v.config?.mode)?.config ?? {};
  const fallback={...defaults,...Object.fromEntries(common.filter(f=>historical[f.key]!==undefined).map(f=>[f.key,historical[f.key]]))};
  const groups=new Map<string,{config:Record<string,string>;refs:string[]}>();
  for(const rule of s.rules.filter(r=>r.indicator!=="6.3.4"))for(const b of rule.versions.at(-1)?.bindings ?? []){
   if(b.policyId!==policy.id)continue;
   const config={...fallback,...Object.fromEntries(common.filter(f=>b.conditions[f.key]!==undefined).map(f=>[f.key,b.conditions[f.key]]))};
   const key=signature(config),group=groups.get(key) ?? {config,refs:[]};group.refs.push(`${rule.id}\u0000${b.id}`);groups.set(key,group);
  }
  if(!groups.size)groups.set(signature(fallback),{config:fallback,refs:[]});
  let index=0;
  for(const group of groups.values()){
   index++;let target=policy;
   if(index>1){let suffix=index;while(s.rules.some(r=>r.id===`${policy.id}-CONDITION-${suffix}`))suffix++;let name=`${policy.name} · 条件 ${suffix}`;while(s.rules.some(r=>r.name===name))name+="（迁移）";
    target={...structuredClone(policy),id:`${policy.id}-CONDITION-${suffix}`,name,rev:0,versions:[],draft:undefined,checked:false};s.rules.push(target);
   }
   target.versions.push({...structuredClone(current),version:target.versions.length?current.version+1:1,at,configurationModel:"shared-policy",config:{...group.config,...Object.fromEntries(policyFieldKeys.map(key=>[key,current.config?.[key] ?? detectionFields["6.3.4"].find(f=>f.key===key)!.value]))}});
   target.rev++;if(target.draft)target.checked=false;
   for(const ref of group.refs)bindingPolicies.set(ref,target.id);
  }
 }
 for(const rule of s.rules.filter(r=>r.indicator!=="6.3.4")){
  const v=rule.versions.at(-1);if(!v?.bindings)continue;
  const bindings=v.bindings.map(b=>({...b,policyId:bindingPolicies.get(`${rule.id}\u0000${b.id}`) ?? b.policyId,conditions:specificConditions(b)}));
  rule.versions.push({...structuredClone(v),version:v.version+1,at,configurationModel:"shared-policy",bindings,policyVersions:bindingPolicyVersions(bindings,s)});rule.rev++;if(rule.draft)rule.checked=false;
 }
 s.strategyDemoVersion=7;return s;
}
