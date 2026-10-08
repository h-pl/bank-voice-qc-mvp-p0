"use client";
import { SopMatrixPreview, SopMatrixScroll } from "./sop-matrix";
import { groupSopRows } from "../lib/sop-matrix";
import { CopyRecordId, RecordText } from "./record-id";
import { useEffect, useRef, useState } from "react";
import { Button, SearchField, Modal } from "./ui";
import { ResourceContent } from "./policy-content";
import { ResourceAddRow } from "./structured-resource";
import { ResourceFields } from "./resource-fields";
import { resourceRows } from "../lib/resource-import";
import { resourceSchemas } from "../lib/strategy-schema";
import { sopEditingText } from "../lib/sop-rules";
import { actions, type State, type Rule, type Resource, type Input, type Command } from "../lib/workflow";
function StructuredResourcePreview({kind,content,references,search,onSearch}:{kind:string;content:string;references:Rule[];search:string;onSearch:(value:string)=>void}) {
 const schema=resourceSchemas[kind],hotword=kind==="hotword",pair=kind==="keyword" || kind==="correction";
 const list=useRef<HTMLDivElement>(null);
 const rows=(content.trim()?resourceRows(kind,content):[]).map((row,index)=>({line:index+1,word:row[0],cells:row}));
 const sopGroups=kind==="sop"?groupSopRows(rows.map(row=>row.cells)):[];
 const query=search.trim().toLowerCase();
 const sopMatches=sopGroups.filter(group=>[group.name,...group.steps.flatMap(step=>[step.content,step.required])].join(" ").toLowerCase().includes(query));
 const matches=rows.filter(row=>row.cells.join(" ").toLowerCase().includes(query));
 useEffect(()=>{list.current?.scrollTo({top:0});},[search]);
 return <section className={`hotword-preview${hotword?" hotword-resource-preview":""}${pair?" resource-read-pair":""}${kind==="correction"?" correction-resource-preview":""}${kind==="sop"?" sop-resource-preview":""}`} aria-label={`${schema.name}内容`}>
  <p className="hotword-preview-references"><span>引用规则：</span>{references.length?references.map(rule=>rule.name).join("、"):"暂无规则引用"}</p>
  {schema.note && <p className="resource-content-note">{schema.note}</p>}
  <div className="hotword-preview-toolbar">
   <SearchField name="rule-resource-search" label={hotword?"搜索热词":"搜索资源内容"} placeholder={hotword?"搜索热词…":kind==="sop"?"搜索 SOP 名称或步骤内容…":"搜索资源内容…"} value={search} onValueChange={onSearch}/>
   <span className="hotword-preview-count" role="status">{kind==="sop"?(query?`匹配 ${sopMatches.length} / 共 ${sopGroups.length} 条 SOP`:`共 ${sopGroups.length} 条 SOP · ${rows.length} 个步骤`):query?`匹配 ${matches.length} / 共 ${rows.length} ${hotword?"个":"条"}`:`共 ${rows.length} ${hotword?"个热词":"条记录"}`}</span>
  </div>
  {kind==="sop"?<SopMatrixScroll resetKey={search}><SopMatrixPreview rows={rows.map(row=>row.cells)} search={search}/></SopMatrixScroll>:<div className={`hotword-preview-list${hotword?"":" resource-record-scroll"}`} ref={list} tabIndex={0} role="region" aria-label={hotword?"热词列表":"资源内容列表"}>
   {matches.length?<table className="resource-record-table">{pair && <colgroup><col style={{width:44}}/><col style={{width:kind==="keyword"?"30%":"calc((100% - 44px)/2)"}}/><col/></colgroup>}<thead><tr><th scope="col" className="resource-row-number">行号</th>{schema.fields.map(field=><th scope="col" key={field}>{hotword?"热词":field}</th>)}</tr></thead><tbody>{matches.map(row=><tr key={row.line}><th scope="row" className="resource-row-number">{row.line}</th>{schema.fields.map((field,index)=><td key={field}>{pair && <span className="resource-preview-label">{field}</span>}{kind === "voice" && index === 0 && row.cells[index] ? <CopyRecordId id={row.cells[index]}/> : <RecordText text={row.cells[index] || "—"}/>}</td>)}</tr>)}</tbody></table>:<p className="hotword-preview-empty">{query?(hotword?"未找到匹配热词":"未找到匹配内容"):(hotword?"暂无热词":"暂无资源内容")}</p>}
  </div>}
 </section>;
}
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
 useEffect(()=>{body.current?.scrollTo({top:0});if(editing)body.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type=file]):not([type=checkbox]), textarea')?.focus({preventScroll:true});},[editing]);
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
 return <Modal title={`${editing?"编辑":"查看"}${resource.name}`} description={rule?`当前规则：${rule.name}`:undefined} variant="action" onClose={requestClose}>
  <form className={`resource-dialog-form${resource.kind==="sop"?" sop-resource-form":""}`} noValidate onSubmit={e=>{e.preventDefault();if(busy || discard || !editing || !canEdit)return;try{if(pending)throw new Error(resource.kind?"请等待文件读取完成或取消读取":"请先确认或取消文件导入");if(!dirty && !resource.draft)throw new Error("资源内容未变更");setBusy(true);completing.current=true;onSubmit({id:resource.id,action:"save_resource_content",rev,requestId:crypto.randomUUID(),input});onClose();}catch(e){completing.current=false;setBusy(false);const message=e instanceof Error?e.message:"保存失败，请重试";const rowError=input.resourceKind==="sop"?message.match(/^第 (\d+) 行[：:](.*)$/):null;const groups=rowError?groupSopRows(resourceRows("sop",input.content ?? "")):[];const group=groups.find(item=>item.steps.some(step=>step.index===Number(rowError?.[1])-1));const step=group?.steps.find(item=>item.index===Number(rowError?.[1])-1);setError(group && step?`${group.name || `第 ${groups.indexOf(group)+1} 条 SOP`} · 步骤 ${step.number}：${rowError![2]}`:message);}}}>
   <div className={`resource-dialog-body${resource.kind?editing?" resource-grid-edit-body":" hotword-preview-body":""}`} ref={body}>
    {editing?<>
     <ResourceFields saveImpact={`保存后影响 ${shared.length} 条引用规则的后续检测，已有结果不变。`} state={state} input={input} onChange={patch=>{setInput(value=>({...value,...patch}));setError("");}} type={resource.type} create={false} pending={pending} onPending={setPending}/>
     {resource.draft && <p className="subtle">已载入此前未完成的内容，请核对后保存。</p>}
    </>:resource.kind?<StructuredResourcePreview kind={resource.kind} content={snapshot?.content ?? ""} references={shared} search={search} onSearch={setSearch}/>:<>
     <p className="hotword-preview-references"><span>引用规则：</span>{shared.length?shared.map(item=>item.name).join("、"):"暂无规则引用"}</p>
     <div className="legacy-resource-preview">{snapshot?<ResourceContent resource={resource} snapshot={snapshot} compact/>:<p>暂无资源内容。</p>}</div>
     {!resource.kind && snapshot && <dl className="rule-detail-fields resource-dialog-settings"><div><dt>业务范围</dt><dd>{snapshot.scope}</dd></div><div><dt>适用角色</dt><dd>{snapshot.role}</dd></div><div className="rule-detail-wide"><dt>例外说明</dt><dd>{snapshot.exception || "无"}</dd></div></dl>}

    </>}
   </div>
   <div className="resource-dialog-footer">
    {error && <p ref={errorRef} tabIndex={-1} role="alert" className="form-error">{error}</p>}
    {discard?<><p role="alert">资源修改尚未保存，是否放弃？</p><div><Button onClick={()=>setDiscard(false)}>继续编辑</Button><Button intent="danger" onClick={finishClose}>放弃修改</Button></div></>:<div>{editing?<><ResourceAddRow kind={input.resourceKind ?? ""} content={input.content ?? ""} disabled={busy || pending || !canEdit} onChange={content=>{setInput(value=>({...value,content}));setError("");}}/><Button disabled={busy} onClick={finishClose}>取消</Button><Button primary type="submit" busy={busy} disabled={!canEdit || pending || (!dirty && !resource.draft)}>保存资源</Button></>:<><Button onClick={finishClose}>关闭</Button>{canEdit && <Button primary onClick={startEdit}>编辑内容</Button>}</>}</div>}
   </div>
  </form>
 </Modal>;
}
