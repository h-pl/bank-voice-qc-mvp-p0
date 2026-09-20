"use client";
import { useEffect, useRef, useState } from "react";
import { actions, roleOf, type State, type Command } from "../lib/workflow";
import { pendingResourceRules } from "../lib/resource-publication";
import { Badge, Button, Empty, Modal, SearchField, Tabs } from "./ui";
import { ResourceContent } from "./policy-content";
import { Strategy } from "./strategy";
import { ActionForm } from "./action-form";
import { Pagination, stamp } from "./workspace";
import { Icon } from "./icon";

export function ResourceCatalog({state,focus,onOpen,onAction,onSubmit}: {state:State;focus?:string;onOpen:(id:string)=>void;onAction:(id:string,action:string)=>void;onSubmit:(cmd:Command)=>void}) {
  const [category,setCategory]=useState("全部"),[search,setSearch]=useState(""),[status,setStatus]=useState("");
  const [page,setPage]=useState(1),[size,setSize]=useState(10),[preview,setPreview]=useState<string>();
  const [editing,setEditing]=useState<{id:string;action:string}>();
  const table=useRef<HTMLDivElement>(null), lastOpened=useRef<string | undefined>(undefined), previousFocus=useRef(focus);
  useEffect(()=>{if(previousFocus.current && !focus) table.current?.querySelector<HTMLButtonElement>(`[data-resource="${lastOpened.current}"]`)?.focus({preventScroll:true});previousFocus.current=focus;},[focus]);
  const manager=roleOf(state)==="supervisor";
  const rows=state.resources.filter(x=>(category==="全部" || x.type===category) && `${x.name} ${x.id} ${x.versions.at(-1)?.scope ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (!status || (status==="draft" ? !!x.draft : status==="pending" ? pendingResourceRules(state,x).length>0 : !!x.versions.length)));
  const currentPage=Math.min(page,Math.max(1,Math.ceil(rows.length/size)));
  const shown=rows.slice((currentPage-1)*size,currentPage*size);
  const resource=state.resources.find(x=>x.id===preview);
  const snapshot=resource?.versions.at(-1) ?? resource?.draft;
  const open=(id:string)=>{lastOpened.current=id;setPreview(undefined);onOpen(id);};
  const act=(id:string,action:string)=>{if(["save_resource","create_resource"].includes(action))setEditing({id,action});else onAction(id,action);};
  const reset=()=>{setSearch("");setCategory("全部");setStatus("");setPage(1);};
  return <>
    <div hidden={!!focus || !!editing} className="resource-catalog panel">
      <header className="catalog-heading"><div><h2>业务资源库 <span>{state.resources.length}</span></h2><p>维护业务依据，查看哪些规则正在使用它。</p></div>{manager && state.resources[0] && <Button primary icon="plus" onClick={()=>act(state.resources[0].id,"create_resource")}>新增资源</Button>}</header>
      <Tabs label="资源分类" panelId="resource-results" value={category} options={["全部","业务知识","词库","SOP"].map(value=>({value,label:value,count:state.resources.filter(x=>value==="全部" || x.type===value).length}))} onChange={value=>{setCategory(value);setPage(1);}}/>
      <div role="tabpanel" id="resource-results" aria-labelledby={`resource-results-tab-${category}`}>
        <div className="catalog-toolbar"><SearchField name="resource-search" label="搜索资源" placeholder="搜索名称、编号或适用业务…" value={search} onValueChange={value=>{setSearch(value);setPage(1);}}/><label>状态<select aria-label="资源状态" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">全部状态</option><option value="draft">有待发布草稿</option><option value="pending">待切换引用</option><option value="published">已有发布版本</option></select></label><span role="status">共 {rows.length} 项</span>{(search || status || category!=="全部") && <Button onClick={reset}>重置筛选</Button>}</div>
        <div className="resource-table-scroll" ref={table}><table className="resource-table"><thead><tr><th>资源名称 / 内容</th><th>类型</th><th>适用业务</th><th>发布版本</th><th>规则引用</th><th>更新时间</th><th>操作</th></tr></thead><tbody>{shown.map(x=>{const v=x.versions.at(-1),ref=state.rules.filter(rule=>x.id in rule.versions.at(-1)!.resources),pending=pendingResourceRules(state,x);return <tr key={x.id}><td><button className="resource-name" data-resource={x.id} onClick={()=>{lastOpened.current=x.id;setPreview(x.id);}}><span className="resource-type-icon"><Icon name={x.type==="SOP" ? "sliders" : x.type==="词库" ? "database" : "file"}/></span><span><b>{x.name}</b><small>{x.id} · {(v ?? x.draft)?.content.split("\n").filter(Boolean).length ?? 0} {x.type==="SOP" ? "个步骤" : "条内容"}</small></span></button></td><td>{x.type}</td><td>{v?.scope ?? x.draft?.scope}</td><td><b>{v ? `V${v.version}` : "尚未发布"}</b><small>{x.draft ? <Badge tone="warning">{x.checked ? "草稿待发布" : "草稿待检查"}</Badge> : <Badge tone="success">已发布</Badge>}</small></td><td><span>{ref.length} 条规则</span>{pending.length>0 && <small className="resource-pending">{pending.length} 条待切换</small>}</td><td className="resource-date">{stamp(v?.at)}</td><td><button className="text-button" onClick={()=>open(x.id)}>查看详情</button></td></tr>;})}</tbody></table>{!rows.length && <Empty text="没有符合条件的资源" hint="调整关键词、分类或发布状态。" action={<Button onClick={reset}>重置筛选</Button>}/>}</div>
        <Pagination page={currentPage} total={rows.length} size={size} onPage={setPage} onSize={value=>{setSize(value);setPage(1);}}/>
      </div>
    </div>
    {focus && !editing && <Strategy detailOnly state={state} view="resources" focus={focus} onOpen={open} onAction={act} onSubmit={onSubmit}/>}
    {editing && <ActionForm embedded key={`${editing.id}-${editing.action}`} state={state} id={editing.id} action={editing.action} onSubmit={onSubmit} onClose={()=>setEditing(undefined)}/>}
    {resource && snapshot && <Modal variant="resource" title={resource.name} description={`${resource.id} · ${resource.type}`} onClose={()=>setPreview(undefined)}><div className="resource-preview-body"><div className="resource-preview-meta"><Badge tone={resource.versions.length ? "success" : "warning"}>{resource.versions.length ? `已发布 V${resource.versions.at(-1)!.version}` : "未发布草稿"}</Badge><span>{snapshot.scope}</span><span>{snapshot.role}</span></div><ResourceContent resource={resource} snapshot={{...snapshot,version:resource.versions.at(-1)?.version ?? 0,at:resource.versions.at(-1)?.at ?? ""}}/><section><h3>当前规则引用</h3>{state.rules.filter(rule=>resource.id in rule.versions.at(-1)!.resources).map(rule=><div className="preview-reference" key={rule.id}><span>{rule.name}</span><b>V{rule.versions.at(-1)!.resources[resource.id]}</b></div>)}{!state.rules.some(rule=>resource.id in rule.versions.at(-1)!.resources) && <p>尚未被规则引用。</p>}</section>{resource.draft && <p className="callout">有未发布草稿，可进入详情核对内容差异。</p>}</div><div className="modal-actions"><Button onClick={()=>setPreview(undefined)}>关闭预览</Button><Button primary onClick={()=>open(resource.id)}>{actions(state,resource.id).includes("save_resource") ? "查看详情与维护" : "查看完整详情"}</Button></div></Modal>}
  </>;
}
