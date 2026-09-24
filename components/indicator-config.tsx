"use client";
import { groupFields } from "../lib/policy-parameter-groups";
import { PolicyAssociationFields } from "./policy-association-fields";
import { prepareNewPolicyAssociations } from "../lib/policy-associations";
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { SelectField } from "./select-field";
import { Button, Modal } from "./ui";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { indicatorSpecificFields, commonPolicyRows, warningConfigurationFields, warningRequirement, warningFieldRows, configLabel, detectionFields, policyFieldKeys, indicatorMatrix, resourceSchemas, legacyRuleFields, ruleFields, policyTriggers, validateRuleConfig, visibleFields } from "../lib/strategy-schema";
import type { Rule, RuleVersion, State, Command, PolicyBindingSelection } from "../lib/workflow";


export function ConfigurationRead({rule,snapshot,state}:{rule:Rule;snapshot:RuleVersion;state:State}){
 const config=snapshot.config;
 if(!config)return <p className="subtle">尚未配置参数与预警关联。</p>;
 const available=snapshot.configurationModel==="indicator-bindings"?detectionFields["6.3.4"].filter(f=>policyFieldKeys.includes(f.key)):(snapshot.configurationModel?ruleFields:legacyRuleFields)(rule,state,policyTriggers(rule,state,snapshot));
 const fields=visibleFields(available,config);
 return <div className={`indicator-config-read ${rule.indicator==="6.3.4"?"shared-policy-config-read":""}`}>
  {!detectionFields[rule.indicator]?.length && <p className="callout">配置方式：引用资源。对应资源固定，直接编辑资源内容，保存后用于后续检测。</p>}

  <div className="configuration-read-groups">{groupFields(fields).map(group=><section key={group.title}><h4>{group.title}</h4><dl className="indicator-config-grid">{group.fields.map(f=><div key={f.key}><dt>{f.label}</dt><dd>{config[f.key] ? f.key==="level"?`${config[f.key]}风险`:configLabel(f.key,config[f.key],state) : "未配置"}{config[f.key] && f.unit && ` ${f.unit}`}</dd></div>)}</dl></section>)}</div>
  {rule.indicator==="6.3.4" && config.action?.includes("通话中提醒") && <p className="subtle">通话中提醒仅用于实时通话；事后任务不执行此动作。</p>}
 </div>;
}
export function ConfigurationEditor({rule,state,onSubmit,onDone,creating=false}:{rule:Rule;state:State;onSubmit:(cmd:Command)=>void;onDone:()=>void;creating?:boolean;initialTriggerRules?:string[]}){
 const completing=useRef(false);
 const formRef=useRef<HTMLFormElement>(null);
 useEffect(()=>{const frame=requestAnimationFrame(()=>formRef.current?.querySelector<HTMLElement>('input[name="policy-title"],button[role="combobox"]')?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame);},[]);
 const finishClose=()=>{completing.current=true;onDone();};
 const [initial]=useState<RuleVersion>(()=>creating?{version:0,at:"",threshold:15,scope:"全部业务",trigger:"所有候选",resources:{},config:{},triggerRules:[]}:rule.draft ?? rule.versions.at(-1)!);
 const [rev]=useState(rule.rev);
 const [title,setTitle]=useState("");
 const [initialConfig]=useState(()=>Object.fromEntries(ruleFields(rule,state).map(f=>[f.key,initial.config?.[f.key] ?? (!creating?rule.versions.at(-1)?.config?.[f.key]:undefined) ?? f.value])));
 const [config,setConfig]=useState(()=>({...initialConfig}));
 const canSelectScope=creating || !rule.versions.length;
 const [initialSelection]=useState<Record<string,string[]>>(()=>Object.fromEntries((initial.pendingPolicyBindings ?? []).map(item=>[item.ruleId,item.features])));
 const [selection,setSelection]=useState(initialSelection);
 const [ruleRevisions]=useState(()=>Object.fromEntries(state.rules.map(r=>[r.id,r.rev])));
 const scopeChanged=JSON.stringify(selection)!==JSON.stringify(initialSelection);
 const pendingBindings:PolicyBindingSelection[]=Object.entries(selection).filter(([,features])=>features.length).map(([ruleId,features])=>({ruleId,rev:ruleRevisions[ruleId],features}));
 const updatedRules=(initial.pendingPolicyBindings ?? []).filter(item=>selection[item.ruleId]?.length && state.rules.find(r=>r.id===item.ruleId)?.rev!==item.rev);
 const [reviewedUpdates,setReviewedUpdates]=useState(false);
 const errorRef=useRef<HTMLParagraphElement>(null);
 const [error,setError]=useState("");const [discard,setDiscard]=useState(false);const [busy,setBusy]=useState(false);
 const changed=JSON.stringify(config)!==JSON.stringify(initialConfig) || (!creating && JSON.stringify(initial.config ?? {})!==JSON.stringify(initialConfig));const dirty=changed || scopeChanged || !!title;
 useEffect(()=>{if(!dirty)return;const block=(event:Event)=>{if(completing.current)return;event.preventDefault();setError("修改尚未保存，请保存或取消修改后再切换。");};window.addEventListener("qc:before-navigate",block);window.addEventListener("beforeunload",block);return()=>{window.removeEventListener("qc:before-navigate",block);window.removeEventListener("beforeunload",block);};},[dirty]);
 useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
 const fields=visibleFields(ruleFields(rule,state),config);
 const update=(key:string,value:string)=>{setConfig(previous=>({...previous,[key]:value,...(key==="action"?{recipient:value==="通话中提醒"?"当前坐席":"所属主管"}:{})}));setError("");};
 return <Modal variant="action" title={creating?"新增预警策略":"编辑预警策略"} description={creating?"设置共享预警条件，可暂不关联指标规则":rule.name} onClose={()=>{if(!busy){if(dirty)setDiscard(true);else finishClose();}}}>
  <form ref={formRef} className="action-form shared-policy-editor" noValidate onSubmit={e=>{e.preventDefault();try{if(busy || discard)return;if(!creating && !changed && !scopeChanged && !updatedRules.length && !rule.draft)throw new Error("配置未变更，请修改后保存");if(creating && !title.trim())throw new Error("请填写策略名称");validateRuleConfig(creating?{...rule,id:"NEW-POLICY"}:rule,config,state);if(canSelectScope){if(updatedRules.length && !reviewedUpdates)throw new Error("请核对已更新规则后确认关联范围");prepareNewPolicyAssociations({...rule,id:creating?"NEW-POLICY":rule.id,indicator:"6.3.4",versions:[],draft:{...initial,config,pendingPolicyBindings:pendingBindings}},state,false);}setBusy(true);completing.current=true;onSubmit({id:rule.id,rev,action:creating?"create_policy_configuration":"save_rule_configuration",requestId:crypto.randomUUID(),input:{config,...(creating?{title:title.trim()}:{}),...(canSelectScope?{policyBindings:pendingBindings}:{})}});onDone();}catch(e){completing.current=false;setBusy(false);setError(e instanceof Error?e.message:"保存失败");}}}>
   <div className="action-form-body">
    {creating && <label className="policy-name-field">策略名称 *<Input name="policy-title" autoComplete="off" value={title} maxLength={100} required onChange={e=>{setTitle(e.target.value);setError("");}} placeholder="例如：愤怒情绪高风险提醒…"/></label>}
    {!creating && rule.draft && !rule.draft.configurationModel && <p className="callout">此草稿来自旧版配置。本次按通用预警策略维护检测范围、触发条件与处置，请核对后保存。</p>}

    {!detectionFields[rule.indicator]?.length && <p className="callout">本项没有独立参数，请直接编辑对应业务资源。</p>}
    <div className="configuration-form-groups">{groupFields(fields).map(group=><fieldset className="configuration-fieldset" key={group.title}><legend>{group.title}</legend>{group.title==="触发条件" && <p className="subtle">按规则分别统计，任一满足即触发。</p>}<div className="indicator-config-form">{group.fields.map(f=>{const choices=f.key==="recipient"?(config.action==="通话中提醒"?["当前坐席"]:["所属主管","质检一组","质检二组"]):f.key==="alertPolicy"?f.options?.filter(value=>value==="不预警" || ["6.2.5","6.3.6"].includes(rule.indicator) || state.rules.find(r=>r.id===value)?.versions.at(-1)?.config?.mode!=="持续时长"):f.options;const displayChoices=f.multiple?[...new Set([...(choices ?? []),...(config[f.key]?.split(/[；＋]/).filter(Boolean) ?? [])])]:choices;return <div key={f.key} className="config-field">{f.multiple?<span>{f.label}</span>:<label htmlFor={`config-${f.key}`}>{f.label}</label>}{f.multiple?<div className="config-checkboxes" role="group" aria-label={f.label}>{displayChoices?.map(v=><span key={v}><Checkbox id={`config-${f.key}-${v}`} checked={config[f.key]?.split(/[；＋]/).includes(v)} onCheckedChange={checked=>{const selected=config[f.key]?.split(/[；＋]/).filter(Boolean) ?? [];update(f.key,(checked?[...selected,v]:selected.filter(x=>x!==v)).join("；"));}}/><label htmlFor={`config-${f.key}-${v}`}>{v}{!choices?.includes(v)?"（已失效，请移除）":""}</label></span>)}</div>:f.key==="recipient" && config.action==="通话中提醒"?<output id={`config-${f.key}`} className="policy-fixed-value">当前坐席</output>:choices?<SelectField id={`config-${f.key}`} value={config[f.key]} onValueChange={value=>update(f.key,value)}>{choices.map(v=><option key={v} value={v}>{f.key==="level"?`${v}风险`:configLabel(f.key,v,state)}</option>)}</SelectField>:<div className="number-unit"><Input id={`config-${f.key}`} name={f.key} type="number" required min={f.min} max={f.max} step={1} value={config[f.key]} onChange={e=>update(f.key,e.target.value)}/><span>{f.unit}</span></div>}{f.key==="stageSeconds" && <small>{config.stage==="开场"?"通话开始后的 N 秒":"通话结束前的 N 秒；结束后判定完整范围"}</small>}{f.key==="action" && config.action?.includes("通话中提醒") && <small>{config.action==="通话中提醒"?"仅用于实时通话，发送给当前坐席。":"通话中提醒发送给当前坐席；其他动作使用所选接收对象。"}</small>}{(f.multiple || !choices) && <small>{f.multiple?"可多选，至少选择一项":`${f.min}–${f.max} ${f.unit}`}</small>}</div>;})}</div></fieldset>)}</div>
    {canSelectScope && <section className="new-policy-scope" aria-label="关联范围"><h3>关联指标规则 <span>可选</span></h3><PolicyAssociationFields creating state={state} config={config} selected={selection} onChange={value=>{setSelection(value);setError("");}}/>{updatedRules.length>0 && <div className="scope-update-notice"><p>以下规则已有更新，请重新核对特征及参数：{updatedRules.map(item=>state.rules.find(r=>r.id===item.ruleId)?.name ?? item.ruleId).join("、")}</p><label><Checkbox checked={reviewedUpdates} onCheckedChange={value=>setReviewedUpdates(value===true)}/>已核对更新后的规则与关联范围</label></div>}</section>}

   </div>
   <div className="modal-actions policy-config-footer"><p className="policy-save-impact">{creating?(pendingBindings.length?`保存并关联 ${pendingBindings.length} 条规则，用于后续检测。`:"可先保存策略，再通过“管理关联”选择指标规则。"):`保存影响 ${state.rules.filter(item=>!item.retired && item.versions.at(-1)?.bindings?.some(binding=>binding.policyId===rule.id)).length} 条关联规则的后续检测，已有结果保留。`}</p>{discard && <p role="alert">修改尚未保存，是否放弃？</p>}{error && <p ref={errorRef} tabIndex={-1} className="form-error" role="alert">{error}</p>}<div>{discard?<><Button onClick={()=>setDiscard(false)}>继续编辑</Button><Button intent="danger" onClick={finishClose}>放弃修改</Button></>:<><Button disabled={busy} onClick={finishClose}>取消</Button><Button primary type="submit" disabled={busy || (!creating && !changed && !scopeChanged && !rule.draft)}>保存策略</Button></>}</div></div>
  </form>
 </Modal>;
}
export function IndicatorMatrix({onClose}:{onClose:()=>void}){
 return <Modal title="16 项指标配置与业务资源" onClose={onClose} footer={<Button primary onClick={onClose}>关闭</Button>}>
 <p className="callout">12 项指标中，声纹、情绪、意图、语言表达在对应指标内配置特有参数及关联策略。其他支持预警的指标按命中或缺失结果关联策略。风险上报与干预属于独立预警策略；覆盖率、时效性、数据展示属于其他设置。</p>
 <Table className="catalog-table indicator-matrix"><TableHeader><TableRow>{["指标","特有字段","规则配置","业务资源名","字段","是否需要预警策略","预警策略配置字段"].map(x=><TableHead key={x}>{x}</TableHead>)}</TableRow></TableHeader><TableBody>{indicatorMatrix.map(([name,config,kinds],index)=><TableRow key={name}><TableCell>{index+1}. {name}</TableCell><TableCell>{indicatorSpecificFields[name] ?? "—"}</TableCell><TableCell>{config}</TableCell><TableCell>{kinds?kinds.split(",").map(k=>resourceSchemas[k].name).join("；"):"—"}</TableCell><TableCell>{kinds?kinds.split(",").map(k=><p key={k}>{kinds.includes(",")?`${resourceSchemas[k].name}：`:""}{resourceSchemas[k].fields.join("、")}</p>):"—"}</TableCell><TableCell>{warningRequirement(name)}</TableCell><TableCell>{warningConfigurationFields(name)}</TableCell></TableRow>)}</TableBody></Table>
 <h3>通用预警策略字段</h3>
 <Table className="catalog-table"><TableHeader><TableRow>{["字段","可配置项","填写规则"].map(x=><TableHead key={x}>{x}</TableHead>)}</TableRow></TableHeader><TableBody>{commonPolicyRows.map(row=><TableRow key={row[0]}>{row.map((cell,i)=><TableCell key={i}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table>
 <Table className="catalog-table"><TableHeader><TableRow><TableHead>指标</TableHead><TableHead>可选择的特征</TableHead><TableHead>支持的触发方式</TableHead></TableRow></TableHeader><TableBody>{warningFieldRows.map(([name,features,modes])=><TableRow key={name}><TableCell>{name}</TableCell><TableCell>{features}</TableCell><TableCell>{modes}</TableCell></TableRow>)}</TableBody></Table>
 <p className="subtle">关键词仅检出后预警，不配置“未出现”或第二套次数。角色、阶段、次数、统计窗口与时长在预警策略维护；指标只配置特有参数及关联策略。</p>
 <p className="subtle">CSV 使用各资源专属表头，预览前 5 行，校验并导入全部记录。声纹和情绪使用表单。</p>
 </Modal>;
}
