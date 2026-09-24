"use client";
import { useEffect, useRef, useState } from "react";
import { Button, SearchField, Modal } from "./ui";
import { ResourceContent } from "./policy-content";
import { ResourceFields } from "./resource-fields";
import { resourceRows, serializeRows } from "../lib/resource-import";
import { resourceSchemas } from "../lib/strategy-schema";
import { sopEditingText } from "../lib/sop-rules";
import { actions, type State, type Rule, type Resource, type Input, type Command } from "../lib/workflow";
export function ResourceDialog({state,rule,resource,initialEdit=false,onClose,onSubmit,onRequestEdit}:{state:State;rule?:Rule;resource:Resource;initialEdit?:boolean;onClose:()=>void;onSubmit:(cmd:Command)=>void;onRequestEdit?:()=>boolean}) {
 const [editing,setEditing]=useState(initialEdit),[search,setSearch]=useState("");
 const defaults=()=>{const v=resource.draft ?? resource.versions.at(-1);return {resourceKind:resource.kind,content:!resource.kind && resource.type==="SOP"?sopEditingText(v?.content ?? "",resource.name):v?.content ?? "",scope:v?.scope,resourceRole:v?.role,exception:v?.exception,sourceFile:v?.sourceFile};};
 const [input,setInput]=useState<Input>(defaults),[initial,setInitial]=useState(()=>JSON.stringify(input)),[rev,setRev]=useState(resource.rev);
 const [pending,setPending]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[discard,setDiscard]=useState(false);
 const dirty=editing && (JSON.stringify(input)!==initial || pending),completing=useRef(false),errorRef=useRef<HTMLParagraphElement>(null),body=useRef<HTMLDivElement>(null);
 const snapshot=resource.versions.at(-1) ?? (resource.draft?{...resource.draft,version:0,at:""}:undefined);
 const shared=state.rules.filter(r=>!r.retired && (resource.id in (r.versions.at(-1)?.resources ?? {}) || resource.id in (r.draft?.resources ?? {})));
 const canEdit=actions(state,resource.id).includes("save_resource");
 useEffect(()=>{if(error)errorRef.current?.focus({preventScroll:true});},[error]);
 useEffect(()=>{body.current?.scrollTo({top:0});if(editing)body.current?.querySelector<HTMLInputElement>('input:not([type=file]):not([type=checkbox])')?.focus({preventScroll:true});},[editing]);
 useEffect(()=>{
  if(!dirty)return;
  const block=(e:Event)=>{if(completing.current)return;e.preventDefault();setError("资源内容尚未保存，请保存或取消修改后再操作。");};
  const unload=(e:BeforeUnloadEvent)=>{if(!completing.current){e.preventDefault();e.returnValue="";}};
  window.addEventListener("qc:before-navigate",block);window.addEventListener("beforeunload",unload);
  return()=>{window.removeEventListener("qc:before-navigate",block);window.removeEventListener("beforeunload",unload);};
 },[dirty]);
 const finishClose=()=>{completing.current=true;onClose();};
 const requestClose=()=>{if(busy)return;if(dirty)setDiscard(true);else finishClose();};
 const startEdit=()=>{if(!canEdit)return;if(onRequestEdit && !onRequestEdit()){setError("请先保存或取消当前修改。");return;}const next=defaults();setInput(next);setInitial(JSON.stringify(next));setRev(resource.rev);setEditing(true);setError("");};
 let shown=snapshot;let shownCount:number | undefined;
 if(snapshot && resource.kind){const rows=resourceRows(resource.kind,snapshot.content).filter(row=>!search || row.join(" ").toLowerCase().includes(search.toLowerCase()));shownCount=rows.length;shown={...snapshot,content:serializeRows([resourceSchemas[resource.kind].fields,...rows])};}
 return <Modal title={`${editing?"编辑":"查看"}${resource.name}`} description={`${resource.id}${rule?` · 当前规则：${rule.name}`:""}`} variant="action" onClose={requestClose}>
  <form className="resource-dialog-form" noValidate onSubmit={e=>{e.preventDefault();if(busy || discard || !editing || !canEdit)return;try{if(pending)throw new Error("请先确认或取消文件导入");if(!dirty && !resource.draft)throw new Error("资源内容未变更");setBusy(true);completing.current=true;onSubmit({id:resource.id,action:"save_resource_content",rev,requestId:crypto.randomUUID(),input});onClose();}catch(e){completing.current=false;setBusy(false);setError(e instanceof Error?e.message:"保存失败，请重试");}}}>
   <div className="resource-dialog-body" ref={body}>
    {editing?<>
     <p className="dialog-impact-note">保存影响 {shared.length} 条引用规则的后续检测，不改写已有检测结果。</p>
     <ResourceFields state={state} input={input} onChange={patch=>{setInput(value=>({...value,...patch}));setError("");}} type={resource.type} create={false} pending={pending} onPending={setPending}/>
     {resource.draft && <p className="subtle">已载入此前未完成的内容，请核对后保存。</p>}
    </>:<>
     <div className="dialog-section-heading"><h3>资源内容</h3>{shownCount!==undefined && <span>{shownCount} 条</span>}</div>
     {resource.kind && <SearchField name="rule-resource-search" label="搜索资源内容" placeholder="搜索资源内容…" value={search} onValueChange={setSearch}/>}
     {shown?(shownCount===0?<p role="status" className="subtle">{search?"未找到匹配内容，请调整关键词。":"暂无资源内容。"}</p>:<ResourceContent resource={resource} snapshot={shown} compact/>):<p role="alert">暂无资源内容。</p>}
     {!resource.kind && snapshot && <dl className="rule-detail-fields resource-dialog-settings"><div><dt>业务范围</dt><dd>{snapshot.scope}</dd></div><div><dt>适用角色</dt><dd>{snapshot.role}</dd></div><div className="rule-detail-wide"><dt>例外说明</dt><dd>{snapshot.exception || "无"}</dd></div></dl>}
     <section className="resource-dialog-references"><div className="dialog-section-heading"><h3>引用规则</h3><span>{shared.length} 条</span></div>{shared.length?<ul>{shared.map(item=><li key={item.id}>{item.name}</li>)}</ul>:<p className="subtle">暂无规则引用。</p>}</section>
    </>}
   </div>
   <div className="resource-dialog-footer">
    {error && <p ref={errorRef} tabIndex={-1} role="alert" className="form-error">{error}</p>}
    {discard?<><p role="alert">资源修改尚未保存，是否放弃？</p><div><Button onClick={()=>setDiscard(false)}>继续编辑</Button><Button intent="danger" onClick={finishClose}>放弃修改</Button></div></>:<div>{editing?<><span className="subtle">{dirty || resource.draft?"保存后用于后续检测":"资源内容未变更"}</span><Button disabled={busy} onClick={finishClose}>取消</Button><Button primary type="submit" busy={busy} disabled={!canEdit || pending || (!dirty && !resource.draft)}>保存资源</Button></>:<><Button onClick={finishClose}>关闭</Button>{canEdit && <Button primary onClick={startEdit}>编辑内容</Button>}</>}</div>}
   </div>
  </form>
 </Modal>;
}
