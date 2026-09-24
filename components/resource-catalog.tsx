"use client";
import { indicatorName, indicatorRuleCategories, resourceSchemas } from "../lib/strategy-schema";
import { resourceRows } from "../lib/resource-import";
import { Button as ShadcnButton } from "./ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { SelectField } from "./select-field";
import { useRef, useState } from "react";
import { actions, roleOf, type State, type Command } from "../lib/workflow";
import { readSopRules } from "../lib/sop-rules";
import { resourceDeletionBlockers } from "../lib/resource-publication";
import { Badge, Button, Empty, Modal, SearchField, Tabs } from "./ui";
import { ResourceDialog } from "./rule-resource-dialog";
import { ActionForm } from "./action-form";
import { Pagination, stamp } from "./workspace";
import { Icon } from "./icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

function ResourceFieldInfo({name, fields}: {name:string; fields:string[]}) {
  const [open, setOpen] = useState(false);
  return <TooltipProvider><Tooltip open={open} onOpenChange={setOpen}><TooltipTrigger asChild><ShadcnButton type="button" variant="ghost" size="icon-xs" className="resource-field-info" aria-label={`${name}字段说明`} onClick={()=>setOpen(true)}><Icon name="info" size={15}/></ShadcnButton></TooltipTrigger><TooltipContent side="top" align="start" sideOffset={6} className="resource-fields-tooltip"><b>包含字段</b><p>{fields.join("、")}</p></TooltipContent></Tooltip></TooltipProvider>;
}

export function ResourceCatalog({state,focus,onOpen,onAction,onSubmit}: {state:State;focus?:string;onOpen:(id:string)=>void;onAction:(id:string,action:string)=>void;onSubmit:(cmd:Command)=>void}) {
  const [source,setSource]=useState("current");
  const [category,setCategory]=useState("全部"),[search,setSearch]=useState(""),[status,setStatus]=useState("");
  const [page,setPage]=useState(1),[size,setSize]=useState(10),[deleting,setDeleting]=useState<{id:string;rev:number}>();
  const [deleteError,setDeleteError]=useState("");
  const [editing,setEditing]=useState<{id:string;action:string}>();
  const table=useRef<HTMLDivElement>(null),trigger=useRef<HTMLElement | null>(null);
  const selectedResource=state.resources.find(item=>item.id===(editing?.action==="save_resource"?editing.id:focus));
  const closeResource=()=>{setEditing(undefined);if(focus)onOpen("");requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));};
  const manager=roleOf(state)==="supervisor";
  const available=state.resources.filter(x=>!x.deletedAt && (source==="current"?!!x.kind:!x.kind)).sort((a,b)=>indicatorRuleCategories.findIndex(([id])=>id===resourceSchemas[a.kind ?? ""]?.indicator)-indicatorRuleCategories.findIndex(([id])=>id===resourceSchemas[b.kind ?? ""]?.indicator));
  const rows=available.filter(x=>(category==="全部" || (x.kind?resourceSchemas[x.kind].name:x.type)===category) && `${x.name} ${x.id} ${x.versions.at(-1)?.scope ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (!status || (status==="draft" ? !!x.draft : !!x.versions.length)));
  const currentPage=Math.min(page,Math.max(1,Math.ceil(rows.length/size)));
  const shown=rows.slice((currentPage-1)*size,currentPage*size);
  const resource=state.resources.find(x=>x.id===deleting?.id);
  const blockers=resource ? resourceDeletionBlockers(state,resource.id) : [];
  const remove=()=>{if(!deleting)return;try{onSubmit({id:deleting.id,rev:deleting.rev,action:"delete_resource",requestId:crypto.randomUUID(),input:{note:"从业务资源列表删除资源"}});setDeleting(undefined);}catch(error){setDeleteError(error instanceof Error ? error.message : "删除失败，请重试");}};
  const open=(id:string)=>{if(id)trigger.current=document.activeElement as HTMLElement;onOpen(id);};
  const act=(id:string,action:string)=>{if(["save_resource","create_resource"].includes(action)){trigger.current=document.activeElement as HTMLElement;setEditing({id,action});}else onAction(id,action);};
  const reset=()=>{setSearch("");setCategory("全部");setStatus("");setPage(1);};
  return <>
    <div className="resource-workspace">
      <div className="resource-workspace-tabs"><Tabs label="资源分类" panelId="resource-results" value={source} onChange={value=>{setSource(value);reset();}} options={[{value:"current",label:"指标业务资源",count:state.resources.filter(x=>!x.deletedAt && !!x.kind).length},{value:"legacy",label:"历史资源",count:state.resources.filter(x=>!x.deletedAt && !x.kind).length}]}/></div>
      <div className="catalog-toolbar resource-workspace-filters">
        <SearchField name="resource-search" label="搜索资源" placeholder="搜索名称、编号或适用业务…" value={search} onValueChange={value=>{setSearch(value);setPage(1);}}/>
        <SelectField aria-label="业务资源类型" value={category} onValueChange={value=>{setCategory(value);setPage(1);}}>{["全部",...new Set(available.map(r=>r.kind?resourceSchemas[r.kind].name:r.type))].map(value=><option key={value} value={value}>{value==="全部" ? "全部资源类型" : value}</option>)}</SelectField>
        <SelectField aria-label="资源状态" value={status} onValueChange={value => {setStatus(value);setPage(1);}}><option value="">全部状态</option><option value="draft">有未完成修改</option><option value="published">已配置</option></SelectField>
        {(search || status || category!=="全部") && <Button onClick={reset}>重置筛选</Button>}<span role="status">共 {rows.length} 项</span>{manager && state.resources[0] && <Button primary icon="plus" onClick={()=>act(state.resources[0].id,"create_resource")}>新增资源</Button>}
      </div>
      <div className="resource-catalog panel" id="resource-results" role="tabpanel" aria-labelledby={`resource-results-tab-${source}`}>
        <div className="resource-table-scroll" ref={table}><Table className="resource-table"><TableHeader><TableRow><TableHead>业务资源</TableHead><TableHead>对应指标</TableHead><TableHead>维护方式</TableHead><TableHead>配置状态</TableHead><TableHead>规则引用</TableHead><TableHead>更新时间</TableHead><TableHead className="resource-actions-heading">操作</TableHead></TableRow></TableHeader><TableBody>{shown.map(x=>{const v=x.versions.at(-1),ref=state.rules.filter(rule=>x.id in (rule.versions.at(-1)?.resources ?? {}));return <TableRow key={x.id}><TableCell><div className="resource-name"><span className="resource-type-icon"><Icon name={x.type==="SOP" ? "sliders" : x.type==="词库" ? "database" : "file"}/></span><div className="resource-name-details"><div className="resource-title-line"><ShadcnButton variant="ghost" className="resource-open" data-resource={x.id} aria-label={`查看资源 ${x.name}`} onClick={()=>open(x.id)}><b>{x.name}</b></ShadcnButton>{x.kind && <ResourceFieldInfo name={x.name} fields={resourceSchemas[x.kind].fields}/>}</div><small>{x.id} · {x.kind ? resourceRows(x.kind,(v ?? x.draft)?.content ?? "").length : x.type === "SOP" ? readSopRules((v ?? x.draft)?.content ?? "",x.name).length : (v ?? x.draft)?.content.split("\n").filter(Boolean).length ?? 0} {x.kind ? "条记录" : x.type==="SOP" ? "条 SOP 规则" : "条内容"}</small></div></div></TableCell><TableCell>{x.kind?indicatorName(resourceSchemas[x.kind].indicator):"历史资源"}</TableCell><TableCell>{x.kind?(resourceSchemas[x.kind].csv?"CSV / 表单":"表单"):x.type}</TableCell><TableCell>{x.draft?<Badge tone="warning">有未完成修改</Badge>:<Badge tone={v?"success":"warning"}>{v?"已配置":"待完善"}</Badge>}</TableCell><TableCell><span>{ref.length} 条规则</span></TableCell><TableCell className="resource-date">{stamp(v?.at)}</TableCell><TableCell><div className="resource-row-actions"><ShadcnButton variant="link" size="sm" onClick={()=>open(x.id)}>查看</ShadcnButton>{actions(state,x.id).includes("save_resource") && <ShadcnButton variant="link" size="sm" onClick={()=>act(x.id,"save_resource")}>编辑</ShadcnButton>}{actions(state,x.id).includes("delete_resource") && <ShadcnButton variant="link" size="sm" className="resource-delete-action" onClick={()=>{setDeleteError("");setDeleting({id:x.id,rev:x.rev});}}>删除</ShadcnButton>}</div></TableCell></TableRow>;})}</TableBody></Table>{!rows.length && <Empty text="没有符合条件的资源" hint="调整关键词、分类或配置状态。" action={<Button onClick={reset}>重置筛选</Button>}/>}</div>
        <Pagination page={currentPage} total={rows.length} size={size} onPage={setPage} onSize={value=>{setSize(value);setPage(1);}}/>
      </div>
    </div>
    {selectedResource && <ResourceDialog key={selectedResource.id} state={state} resource={selectedResource} initialEdit={editing?.action==="save_resource"} onSubmit={onSubmit} onClose={closeResource}/>}
    {editing?.action==="create_resource" && <ActionForm key={`${editing.id}-${editing.action}`} state={state} id={editing.id} action={editing.action} onSubmit={onSubmit} onClose={()=>setEditing(undefined)}/>}
    {resource && deleting && <Modal title={blockers.length ? "暂时无法删除" : "删除资源"} description={`${resource.id} · ${resource.name}`} onClose={()=>setDeleting(undefined)} footer={<><Button onClick={()=>setDeleting(undefined)}>{blockers.length ? "关闭" : "取消"}</Button>{!blockers.length && <Button intent="danger" onClick={remove}>确认删除</Button>}</>}>
      {blockers.length ? <><p>该资源仍被以下指标使用，当前不可删除。可编辑并保存资源内容。</p><ul className="resource-delete-references">{blockers.map(rule=><li key={rule.id}>{rule.name} · {rule.id}</li>)}</ul></> : <p>确认删除“{resource.name}”？删除后将从资源列表移除，已有检测结果和处理记录保留。</p>}
      {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
    </Modal>}
  </>;
}
