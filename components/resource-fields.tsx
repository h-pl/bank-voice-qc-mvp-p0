"use client";
import { useId, useState } from "react";
import { resourceSchemas, indicatorName } from "../lib/strategy-schema";
import { serializeRows } from "../lib/resource-import";
import { StructuredResourceEditor } from "./structured-resource";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { Combobox, ComboboxChips, ComboboxChip, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxValue, useComboboxAnchor } from "./ui/combobox";
import { ResourceFileImport } from "./resource-file-import";
import { SopPreview } from "./sop-preview";
import { MAX_RESOURCE_CHARS } from "../lib/resource-import";
import type { Input as FormInput, State, Resource } from "../lib/workflow";

function FieldSelect({id,label,value,options,onChange}: {id:string;label:string;value:string;options:string[];onChange:(value:string)=>void}) {
  return <div className="resource-field"><Label htmlFor={id}>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger id={id} className="w-full"><SelectValue/></SelectTrigger><SelectContent position="popper">{options.map(option=><SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>;
}
export function ResourceFields({state,input,onChange,type,create,pending,onPending}: {state:State;input:FormInput;onChange:(patch:Partial<FormInput>)=>void;type:Resource["type"];create:boolean;pending:boolean;onPending:(pending:boolean)=>void}) {
  const id=useId();
  const kind=input.resourceKind;
  const anchor=useComboboxAnchor();
  const [portalContainer,setPortalContainer]=useState<HTMLElement | null>(null);
  const refs=input.refs ?? [];
  return <div className="resource-fields">
    {create && <>
      <div className="resource-field"><Label htmlFor={`${id}-name`}>资源名称 <span aria-hidden="true">*</span></Label><Input id={`${id}-name`} required maxLength={100} placeholder="输入资源名称" value={input.title ?? ""} onChange={event=>onChange({title:event.target.value})}/></div>
      <div className="resource-field-row">
        <FieldSelect id={`${id}-type`} label="资源类型" value={kind?resourceSchemas[kind].name:type} options={[...new Set(Object.values(resourceSchemas).map(s=>s.name)),"词库（旧模板）","SOP（旧模板）"]} onChange={value=>{onPending(false);const entry=Object.entries(resourceSchemas).find(([,s])=>s.name===value);onChange(entry?{resourceType:entry[1].group,resourceKind:entry[0],content:serializeRows([entry[1].fields,...(entry[0]==="emotion"?entry[1].rows:[])]),sourceFile:undefined,refs:state.rules.filter(r=>r.indicator===entry[1].indicator).map(r=>r.id)}:{resourceType:value.startsWith("词库")?"词库":"SOP",resourceKind:undefined,content:"",sourceFile:undefined,refs:[]});}}/>
        {kind ? <div className="resource-field"><Label>对应指标规则</Label><p>{indicatorName(resourceSchemas[kind].indicator)} · 自动关联</p></div> : <div className="resource-field"><Label htmlFor={`${id}-rules`}>关联规则 <span aria-hidden="true">*</span></Label>
          <Combobox multiple items={state.rules.filter(rule=>rule.indicator!=="6.3.4" && (!kind || rule.indicator===resourceSchemas[kind].indicator)).map(rule=>rule.id)} value={refs} onValueChange={refs=>onChange({refs})} itemToStringLabel={value=>`${state.rules.find(rule=>rule.id===value)?.name ?? value} ${value}`} onOpenChange={open=>{if(open)setPortalContainer(anchor.current?.closest<HTMLElement>('[role="dialog"]') ?? null);}}>
            <ComboboxChips ref={anchor} className="resource-rule-chips">
              <ComboboxValue>{refs.map(value=><ComboboxChip key={value} removeLabel={`移除${state.rules.find(rule=>rule.id===value)?.name ?? value}`}><span>{state.rules.find(rule=>rule.id===value)?.name ?? value}</span></ComboboxChip>)}</ComboboxValue>
              <ComboboxChipsInput id={`${id}-rules`} placeholder="搜索规则名称或编号" aria-required="true"/>
            </ComboboxChips>
            <ComboboxContent anchor={anchor} container={portalContainer} className="resource-rule-options">
              <ComboboxEmpty>没有匹配规则</ComboboxEmpty>
              <ComboboxList>{(value:string)=><ComboboxItem key={value} value={value}><span>{state.rules.find(rule=>rule.id===value)?.name ?? value}<small>{value}</small></span></ComboboxItem>}</ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>}
      </div><p className="resource-field-hint">资源类型与指标的对应关系固定；保存后自动用于后续检测。</p>
    </>}
    <ResourceFileImport key={kind ?? type} type={kind ?? type} current={input.content ?? ""} onPending={onPending} onApply={(content,name)=>onChange({content,sourceFile:name})}/>
    {input.sourceFile && <p className="resource-field-hint">内容来源：{input.sourceFile}</p>}
    {!pending && kind && <StructuredResourceEditor kind={kind} content={input.content ?? ""} onChange={content=>onChange({content})}/>}
    {!pending && !kind && <div className="resource-field"><Label htmlFor={`${id}-content`}>{type === "SOP" ? "SOP 规则集合（每行一条）" : type === "词库" ? "词条（每行一个）" : "知识内容"}</Label><Textarea id={`${id}-content`} rows={5} required maxLength={MAX_RESOURCE_CHARS} value={input.content ?? ""} onChange={event=>onChange({content:event.target.value})}/>{type === "SOP" && <><small>格式：SOP名称：步骤1，步骤2；使用中文标点，一行一条。</small><SopPreview content={input.content ?? ""}/></>}</div>}
    {!kind && <div className="resource-settings"><div className="resource-field-row"><FieldSelect id={`${id}-scope`} label="业务范围" value={input.scope ?? "全部业务"} options={["全部业务","账户查询","信用卡","转账汇款"]} onChange={scope=>onChange({scope})}/><FieldSelect id={`${id}-role`} label="适用角色" value={input.resourceRole ?? "坐席"} options={["坐席","客户","双方"]} onChange={resourceRole=>onChange({resourceRole})}/></div><div className="resource-field"><Label htmlFor={`${id}-exception`}>例外说明</Label><Textarea id={`${id}-exception`} rows={2} value={input.exception ?? ""} onChange={event=>onChange({exception:event.target.value})}/></div></div>}
  </div>;
}
