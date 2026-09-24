"use client";
import { useEffect, useRef, useState } from "react";
import { BindingPolicyFields } from "./binding-policy-fields";
import { bindingFields, bindingFeatures, editableBindings, newBinding, validateBindings, type IndicatorBinding } from "../lib/indicator-bindings";
import { visibleFields, policyCompatibility } from "../lib/strategy-schema";
import type { Rule, State, Command } from "../lib/workflow";
import { Button, Modal } from "./ui";
import { Input } from "./ui/input";
import { SelectField } from "./select-field";
export function IndicatorBindingEditor({rule,state,onSubmit,onDone}:{rule:Rule;state:State;onSubmit:(cmd:Command)=>void;onDone:()=>void}) {
 const [initial]=useState(()=>editableBindings(rule,state)),[rows,setRows]=useState(initial),[rev]=useState(rule.rev);
 const [error,setError]=useState(""),[discard,setDiscard]=useState(false),[busy,setBusy]=useState(false);
 const completing=useRef(false),form=useRef<HTMLFormElement>(null),errorRef=useRef<HTMLParagraphElement>(null);
 const dirty=JSON.stringify(rows)!==JSON.stringify(initial);
 const changed=dirty || !!rule.draft;
 const policies=state.rules.filter(r=>r.indicator==="6.3.4" && !r.retired && r.versions.length),features=bindingFeatures(rule,state);
 useEffect(()=>{form.current?.querySelector<HTMLButtonElement>('button[role="combobox"]')?.focus({preventScroll:true});},[]);
 useEffect(()=>{if(error)errorRef.current?.focus({preventScroll:true});},[error]);
 useEffect(()=>{
  if(!dirty)return;
  const block=(e:Event)=>{if(completing.current)return;e.preventDefault();setError("预警配置尚未保存，请先保存，或取消并放弃修改后再操作。");requestAnimationFrame(()=>errorRef.current?.scrollIntoView({block:"nearest"}));};
  const unload=(e:BeforeUnloadEvent)=>{if(!completing.current){e.preventDefault();e.returnValue="";}};
  window.addEventListener("qc:before-navigate",block);window.addEventListener("beforeunload",unload);
  return()=>{window.removeEventListener("qc:before-navigate",block);window.removeEventListener("beforeunload",unload);};
 },[dirty]);
 const update=(id:string,change:Partial<IndicatorBinding>)=>{setRows(previous=>previous.map(b=>b.id===id?{...b,...change}:b));setError("");};
 const remove=(b:IndicatorBinding)=>{setRows(previous=>previous.flatMap(row=>row.id!==b.id?[row]:features.includes(b.feature) && !previous.some(other=>other.id!==b.id && other.feature===b.feature)?[newBinding(rule,b.feature,state)]:[]));setError("");};
 const requestClose=()=>{if(busy)return;if(dirty)setDiscard(true);else onDone();};
 return <Modal title={`配置预警 · ${rule.name}`} variant="action" onClose={requestClose}><form ref={form} className="warning-dialog-form" aria-label={`配置预警 · ${rule.name}`} noValidate onSubmit={e=>{
  e.preventDefault();if(busy || discard)return;
  try {if(!changed)throw new Error("配置未变更");validateBindings(rule,rows,state);setBusy(true);completing.current=true;onSubmit({id:rule.id,rev,action:"save_rule_configuration",requestId:crypto.randomUUID(),input:{bindings:rows}});onDone();}
  catch(e){completing.current=false;setBusy(false);setError(e instanceof Error?e.message:"保存失败，请重试");}
 }}>
 <div className="warning-dialog-body"><p className="subtle">配置当前规则的特定参数与预警关联。特定参数仅作用于当前规则；关联策略的通用触发条件与处置在下方只读展示。多条策略独立判断。</p>
 {rule.draft && <p className="callout">已载入此前未完成的修改，请核对后保存。</p>}
 {!policies.length && <p role="alert">暂无可用策略，请先前往策略管理创建。</p>}
 {rows.map((b,index)=>{
  const count=rows.filter(x=>x.feature===b.feature).length,config=policies.find(p=>p.id===b.policyId)?.versions.at(-1)?.config;
  return <fieldset className="configuration-fieldset binding-editor-row" key={b.id}>
   <legend>检测结果：{b.feature}{count>1?` · 关联 ${rows.filter((x,i)=>x.feature===b.feature && i<=index).length}`:""}</legend>
   {!features.includes(b.feature) && <p className="form-error">该检测结果已失效，请移除。</p>}
   <div className="binding-select-row"><div><label htmlFor={`policy-${b.id}`}>关联策略</label><SelectField id={`policy-${b.id}`} value={b.policyId || "unconfigured"} onValueChange={value=>update(b.id,{policyId:value==="unconfigured"?"":value})}>
    <option value="unconfigured">请选择策略</option><option value="none" disabled={count>1}>{count>1?"不预警（请先移除其他关联）":"不预警"}</option>
    {policies.map(p=>{const issue=policyCompatibility(rule,b.feature,p.versions.at(-1)?.config ?? {},state);return <option key={p.id} value={p.id} disabled={!!issue}>{p.name}{issue?` · ${issue}`:""}</option>;})}
    {b.policyId && b.policyId!=="none" && !policies.some(p=>p.id===b.policyId) && <option value={b.policyId}>原策略已失效，请重新选择</option>}
   </SelectField></div>{(b.policyId && b.policyId!=="none" || count>1 || !features.includes(b.feature)) && <Button onClick={()=>remove(b)}>移除此关联</Button>}</div>
   {count>1 && <p className="subtle">选择“不预警”前，需先移除该结果的其他关联。</p>}
   {b.policyId && b.policyId!=="none" && <>
    {bindingFields(rule,b.feature,state).length>0 && <p className="binding-config-label">本规则特定参数</p>}
    <div className="indicator-config-form">{visibleFields(bindingFields(rule,b.feature,state),b.conditions).map(f=><div className="config-field" key={f.key}><label htmlFor={`${b.id}-${f.key}`}>{f.label}</label>{f.options?<SelectField id={`${b.id}-${f.key}`} value={b.conditions[f.key]} onValueChange={value=>update(b.id,{conditions:{...b.conditions,[f.key]:value}})}>{f.options.map(v=><option key={v} value={v}>{v}</option>)}</SelectField>:<div className="number-unit"><Input id={`${b.id}-${f.key}`} type="number" required min={f.min} max={f.max} step={1} value={b.conditions[f.key] ?? ""} onChange={e=>update(b.id,{conditions:{...b.conditions,[f.key]:e.target.value}})}/><span>{f.unit}</span></div>}</div>)}</div>
    <p className="binding-config-label">关联策略参数（只读）</p>
    {config?<BindingPolicyFields key={b.policyId} detailed binding={b} conditions={config} config={config}/>:<p className="form-error">策略不可用，请重新选择。</p>}
    <div className="indicator-policy-actions"><Button disabled={rows.some(row=>row.feature===b.feature && !row.policyId)} onClick={()=>setRows([...rows,newBinding(rule,b.feature,state)])}>再关联一条策略</Button></div>
   </>}
  </fieldset>;
 })}
 {error && <p ref={errorRef} tabIndex={-1} role="alert" className="form-error">{error}</p>}
 </div><div className="warning-dialog-footer">{discard?<><p role="alert">放弃未保存的预警修改？</p><Button onClick={()=>setDiscard(false)}>继续编辑</Button><Button intent="danger" onClick={onDone}>放弃修改</Button></>:<><span className="subtle">{changed?"保存后用于后续检测":"配置未变更"}</span><Button onClick={onDone} disabled={busy}>取消</Button><Button primary type="submit" disabled={busy || !changed} busy={busy}>保存预警配置</Button></>}</div>
 </form></Modal>;
}
