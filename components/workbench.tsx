"use client";
import { useState } from "react";
import { canSee, callFor, notices, person, primaryAction, actionNames, type State, type Entity, type View } from "../lib/workflow";
import { useDemoClock } from "../lib/store";
import { caseTitle, stateLabel, stamp, viewFor } from "./workspace";
import { Badge, Button, Empty, MetricSummary, PageHeader } from "./ui";
import { Icon } from "./icon";

export function Workbench({state,onOpen,onNavigate}: {state:State;onOpen:(id:string)=>void;onNavigate:(view:View)=>void}) {
  const now=useDemoClock(),[filter,setFilter]=useState("all");
  const tasks=notices(state);
  const due=(item:Entity)=>"dueAt" in item ? item.dueAt : "assignment" in item ? item.assignment?.dueAt : undefined;
  const late=(item:Entity)=>!!due(item) && Date.parse(due(item)!)<now && !("pause" in item && item.pause);
  const soon=(item:Entity)=>!!due(item) && Date.parse(due(item)!)>=now && Date.parse(due(item)!)-now<=86400000 && !("pause" in item && item.pause);
  const rows=tasks.filter(x=>filter==="all" || (filter==="late" ? late(x) : soon(x))).sort((a,b)=>(Date.parse(due(a) ?? "") || Infinity)-(Date.parse(due(b) ?? "") || Infinity));
  const events=state.logs.filter(log=>canSee(state,log.target)).slice(-5).reverse();
  const pending=rows.filter(x=>"conclusions" in x && x.severity==="high" && !x.conclusions.length && ["candidate","reminded","supplement"].includes(x.status)).length;
  const activeDate=state.calls.filter(c=>canSee(state,c.id)).map(c=>c.endedAt ?? c.startedAt).sort().at(-1);
  const filters=[{key:"all",label:"待我处理",count:tasks.length,hint:"当前责任与待阅读结果"},{key:"late",label:"已逾期",count:tasks.filter(late).length,hint:"优先处理或调整期限"},{key:"soon",label:"24 小时内到期",count:tasks.filter(soon).length,hint:"提前安排，避免积压"}];
  return <div className="workbench panel page-work-surface"><PageHeader title="我的待办" description={`${person(state.identity).name}，按期限处理当前责任事项。`}><span className="page-update">演示记录更新至 {stamp(activeDate)}</span></PageHeader><MetricSummary label="待办范围" items={filters.map(x=>({...x,value:<>{x.count}<small>项</small></>}))} selected={filter} onSelect={setFilter}/>
<div className="workbench-columns"><section className="workbench-tasks"><div className="catalog-heading"><div><h3>{filter==="all" ? "全部待办" : filter==="late" ? "逾期待办" : "即将到期"}<span className="section-count">{rows.length} 项</span></h3><p>按到期时间排序</p></div>{pending>0 && <Badge tone="danger">{pending} 项高风险候选</Badge>}</div><div aria-label="待办事项" role="region">{rows.map(item=>{const call=callFor(state,item.id),action=primaryAction(state,item.id);return <button className="workbench-task" key={item.id} onClick={()=>onOpen(item.id)}><span className="task-kind"><Icon name={viewFor(state,item.id)==="improvement" ? "shield" : "package"}/></span><span><b>{caseTitle(state,item)}</b><small>{item.id} · {call ? person(call.agentId)?.name : ""} · {stateLabel(item,state)}</small></span><span className="task-due"><small className={late(item) ? "red" : ""}>{due(item) ? `${late(item) ? "已逾期 · " : ""}${stamp(due(item))}` : "待处理"}</small><b>{action ? actionNames[action] : "查看并处理"} →</b></span></button>})}{!rows.length && <Empty text={tasks.length ? "当前分类没有待办" : "当前没有待办"} hint={tasks.length ? "其他任务仍可在全部待办中查看。" : "新任务会随责任交接出现在这里。"} action={<Button onClick={()=>tasks.length ? setFilter("all") : onNavigate("workorders")}>{tasks.length ? "查看全部待办" : "查看复核工单"}</Button>}/>}</div></section><aside className="workbench-events"><div className="catalog-heading"><div><h3>最近变化</h3><p>只显示授权范围内的事件。</p></div></div>{events.map(event=><button key={event.id} onClick={()=>onOpen(event.target)}><small>{stamp(event.at)} · {person(event.actor)?.name ?? "系统"}</small><b>{event.action}</b><p>{event.note}</p></button>)}{!events.length && <Empty text="暂无处理记录" hint="操作后会显示已发生的变化。"/>}</aside></div></div>;
}
