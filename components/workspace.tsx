"use client";
import { distributionContext, responsibilityContext, supervisorReturnNote } from "../lib/case-context";
import { activeDeadline, alertDeadlineLabel, alertFinished, deadlineRemaining } from "../lib/alert-deadlines";
import { lifecycleLabel } from "../lib/lifecycle-labels";
import { alertTabs, alertCategory, problemRecords, problemLogs } from "../lib/alert-records";
import { callTriggers } from "../lib/call-triggers";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { useQueueScroll } from "./use-queue-scroll";
import { Review2Indicators } from "./review2-indicators";
import { Review2Findings } from "./review2-findings";
import { Review2FindingDetail, Review2RuleDetail } from "./review2-detail";
import { Disclosure } from "./disclosure";
import { SelectField } from "./select-field";
import { useEffect, useRef, useState } from "react";
import { AudioPlayer } from "./audio-player";
import { EventTimeline } from "./event-timeline";
import { ruleCategories } from "../lib/fixtures";
import { CaseDocuments } from "./case-documents";
import { localDate } from "../lib/reports";
import { useDemoClock } from "../lib/store";
import { Badge, Button, Empty, Modal, SearchField, Tabs } from "./ui";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button as ShadcnButton, SurfaceButton } from "./ui/button";
import { Input } from "./ui/input";
import { Icon } from "./icon";
import {
  actions,
  agentWorkItems,
  standaloneSupplements,
  openSupplement,
  isTodo,
  primaryAction,
  people,
  type Conclusion,
  actionLabel,
  contextActions,
  canSee,
  canSeeCall,
  callFor,
  currentOwner,
  entity,
  latest,
  person,
  roleOf,
  roleNames,
  statusNames,
  verdictNames,
  detection,
  csv,
  type State,
  type Entity,
  type View,
  type Call,
  type Finding,
} from "../lib/workflow";
export const stamp = (s?: string) =>
  s
    ? new Date(s).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";
export const clock = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
export const label = (e: Entity) =>
  "title" in e
    ? e.title
    : "goal" in e
      ? e.goal
      : "name" in e
        ? e.name
        : "scope" in e
          ? e.scope
          : "note" in e
            ? e.note
            : "business" in e
              ? e.business
              : "申诉核查";
// Use the underlying issue as the case title; preserve the submitted reason in the body.
export const caseTitle = (state: State, item: Entity) =>
  "findingId" in item
    ? state.findings.find(f => f.id === item.findingId)?.title ?? label(item)
    : "findingIds" in item && item.type === "candidate" && item.findingIds.length === 1
      ? state.findings.find(f => f.id === item.findingIds[0])?.title ?? label(item)
      : label(item);

export const stateLabel = (e: Entity, s?: State) => lifecycleLabel(e,s) ?? (
  "conclusions" in e && latest(e)?.value === "false_positive" ? e.source === "auto" ? "误报归档" : "人工问题已撤销" :
  "conclusions" in e && e.distribution?.status === "pending" ? "待坐席选择" :
  "standardVersion" in e && !e.inspector && e.origin === "direct" ? e.materials.length ? "资料已提交 · 待指派核验" : "整改中 · 待指派核验" :
  "pause" in e && e.pause ? "已暂停 · 等待申诉裁定" :
  s && "conclusions" in e && roleOf(s) === "agent" && e.reminder && !latest(e) ? (e.reminder.feedback ? "已反馈执行" : e.reminder.dissent ? "已提出异议" : e.reminder.readAt ? "提醒已读" : "提醒待阅读") :
  s && s.appeals.some(a => a.id === e.id && a.status === "supplement") ? (s.supplements.some(sp => sp.target === e.id && sp.status === "submitted") ? "待质检员接收补证" : "等待坐席补证") :
  s && "findingIds" in e && e.appealId && s.appeals.some(a => a.id === e.appealId && a.status === "supplement") ? (s.supplements.some(sp => sp.target === e.appealId && sp.status === "submitted") ? "等待质检员接收补证" : "等待坐席补证") :
  "executor" in e ? ({pending:"待补充",submitted:"待核对补件",done:"补件已完成",cancelled:"随整改结束"}[e.status]) :
  "standardVersion" in e && e.status === "pending" ? "待坐席接收" :
  "findingIds" in e && e.evidenceRequest ? "待主管协调补证" :
  "batches" in e
    ? detection(e)
    : "status" in e
      ? "standardVersion" in e && e.status === "supervisor"
        ? e.supervisorReason === "approve"
          ? "待主管结案"
          : e.supervisorReason === "return"
            ? "待主管退回"
            : "待调整要求"
        : (statusNames[e.status] ?? e.status)
      : "已生效");
export const viewFor = (s: State, id: string): View => {
  const e = entity(s, id);
  return e && "versions" in e
    ? "indicator" in e
      ? "rules"
      : "resources"
    : e && "batches" in e
      ? "calls"
      : e && ("findingIds" in e || "executor" in e)
        ? "workorders"
        : e && "conclusions" in e
          ? roleOf(s) === "supervisor" &&
            ["candidate", "reminded", "supplement", "closed", "delivered"].includes(e.status)
            ? "alerts"
            : "workorders"
          : "improvement";
};
export function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
export function Workspace({
  state,
  view,
  focus,
  returnSource,
  review2 = false,
  onOpen,
  onAction,
}: {
  state: State;
  view: View;
  review2?: boolean;
  focus?: string;
  returnSource?: {label:string; onBack:()=>void};
  onOpen: (id: string) => void;
  onAction: (id: string, action: string) => void;
}) {
  const [tab, setTab] = useState(()=>{
      if(view==="calls")return "all";
      const target=focus ? entity(state,focus) : undefined;
      if(view==="alerts" && target && "conclusions" in target)return alertCategory(target);
      if(!target || isTodo(state,target))return "mine";
      return ["workorders","improvement"].includes(view) && roleOf(state)!=="agent" && "status" in target && ["done","cancelled","withdrawn","rejected","terminated","closed","delivered"].includes(target.status) ? "done" : "all";
    }),
    [overdueOnly,setOverdueOnly] = useState(false),
    [kind,setKind] = useState(""),
    [moreFilters, setMoreFilters] = useState(false),
    [startDate,setStartDate] = useState(""), [endDate,setEndDate] = useState(""),
    [agent,setAgent] = useState(""), [group,setGroup] = useState(""), [execution,setExecution] = useState(""),
    [search, setSearch] = useState(""),
    [business, setBusiness] = useState(""),
    [page, setPage] = useState(1),
    [size, setSize] = useState(5),
    [selection, setSelection] = useState<string>();
  useEffect(() => {
    if (view !== "alerts") return;
    const showArchive = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setTab("closed"); setSearch(""); setBusiness(""); setAgent(""); setGroup("");
      setStartDate(""); setEndDate(""); setPage(1); setSelection(id);
    };
    window.addEventListener("qc:show-archive", showArchive);
    return () => window.removeEventListener("qc:show-archive", showArchive);
  }, [view]);
  const workspaceId = view;
  const splitWorkspace = review2 || view === "alerts" || view === "improvement";
  const role = roleOf(state),
    now = useDemoClock();
  const all: Entity[] = (
    view === "alerts"
      ? state.findings.filter((f) => f.source === "auto")
      : view === "calls"
        ? state.calls.filter((c) => canSeeCall(state, c))
        : view === "workorders"
          ? role === "agent"
            ? agentWorkItems(state)
            : [...state.reviews,...standaloneSupplements(state),...state.findings.filter(f=>isTodo(state,f) && f.status!=="review" && viewFor(state,f.id)==="workorders")]
          : [...state.appeals, ...state.remedies]
  ).filter((e) => canSee(state, e.id));
  const category = all.filter(e=>view!=="improvement" || !kind || (kind === "appeal" ? state.appeals.some(a=>a.id===e.id) : "standardVersion" in e));
  const tabs = view === "alerts" ? alertTabs
    : view === "improvement" ? [["mine","待我处理"],["active","进行中"],["done","已结束"],["all","全部"]]
    : view === "workorders" ? role === "agent" ? [["mine","待我处理"],["all","全部事项"],["reminders","通话提醒"],["results","质检结果"]] : [["mine","待我处理"],["active",review2 ? "处理中（含待办）" : "进行中"],["done","已结束"],["all","全部工单"]]
    : [["all","全部通话"],["live","通话中"],["failed","处理异常"],["unflagged","未命中规则"],["spotchecked","人工抽检"],["sample","授权样例"]];
  const done = (e:Entity) => "status" in e && ["done","cancelled","withdrawn","rejected","terminated","closed","delivered"].includes(e.status);
  const match = (e:Entity,key:string) => view === "alerts" && "conclusions" in e ? key === "all" || alertCategory(e) === key : key === "all" ? true : key === "reminders" ? "conclusions" in e && !!e.reminder : key === "results" ? "conclusions" in e && !!latest(e) : key === "mine" ? isTodo(state,e) : key === "active" ? !done(e) : key === "done" ? done(e) : key === "live" ? "batches" in e && !e.endedAt : key === "failed" ? "batches" in e && detection(e).includes("失败") : key === "sample" ? "batches" in e && e.sample : key === "unflagged" ? "batches" in e && detection(e)==="已完成" && !state.findings.some(f=>f.callId===e.id && f.source==="auto" && f.batchId===e.batches.at(-1)?.id) : key === "spotchecked" ? "batches" in e && state.reviews.some(r=>r.callId===e.id && r.type==="spotcheck") : key === "closed" ? "conclusions" in e && latest(e)?.value === "false_positive" : "status" in e && e.status===key;
  const [previousFocus,setPreviousFocus]=useState(focus);
  const focusTarget=focus ? all.find(item=>item.id===focus) : undefined;
  const invalidDates = !!startDate && !!endDate && startDate > endDate;
  const searched = category.filter((e) => {
    const c = callFor(state, e.id);
    return (
      !invalidDates && (!business || c?.business === business) &&
      (!agent || c?.agentId===agent) && (!group || c?.group===group) &&
      (!execution || c && detection(c)===execution) &&
      (!startDate || !!c && localDate(c.endedAt ?? c.startedAt)>=startDate) &&
      (!endDate || !!c && localDate(c.endedAt ?? c.startedAt)<=endDate) &&
      `${e.id} ${label(e)} ${c?.id ?? ""} ${c ? person(c.agentId)?.name : ""} ${state.findings.filter(f=>f.callId===c?.id && canSee(state,f.id)).map(f=>f.id).join(" ")} ${state.reviews.filter(r=>r.callId===c?.id && canSee(state,r.id)).map(r=>r.id).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  const isOverdue = (e: Entity) => !!activeDeadline(e) && Date.parse(activeDeadline(e)!) <= now && !!currentOwner(state,e) && !("pause" in e && e.pause);
  const filtered = searched.filter((e) => match(e, tab) && (!splitWorkspace || !overdueOnly || isOverdue(e))).sort((a,b)=>{
    const rank=(e:Entity)=> splitWorkspace && isOverdue(e) ? 0 : isTodo(state,e) ? (isOverdue(e) ? 0 : "severity" in e && e.severity==="high" ? 1 : 2) : 3;
    return rank(a)-rank(b) || ((activeDeadline(a) ? Date.parse(activeDeadline(a)!) : Infinity) - (activeDeadline(b) ? Date.parse(activeDeadline(b)!) : Infinity) || 0);
  });
  // A queue click preserves the current filter and loaded window; an external target may change scope.
  if(focus!==previousFocus){
    setPreviousFocus(focus);
    if(focusTarget && view!=="calls" && (!splitWorkspace || !filtered.some(item=>item.id===focusTarget.id))){
      setTab(view === "alerts" && "conclusions" in focusTarget ? alertCategory(focusTarget) : isTodo(state,focusTarget) ? "mine" : done(focusTarget) && tabs.some(([key])=>key==="done") ? "done" : "all");
      setOverdueOnly(false);setKind("");setSearch("");setBusiness("");setAgent("");setGroup("");setExecution("");setStartDate("");setEndDate("");setPage(1);
    }
  }
  const queueScope = JSON.stringify([state.identity,tab,search,business,overdueOnly,kind,startDate,endDate,agent,group,execution]);
  const { rows: scrollRows, hasMore, loadMore, containerRef, sentinelRef } = useQueueScroll(filtered, queueScope, splitWorkspace, focus);
  const currentPage = Math.min(
      focus && filtered.some(item=>item.id===focus) ? Math.floor(filtered.findIndex(item=>item.id===focus)/size)+1 : page,
      Math.max(1, Math.ceil(filtered.length / size)),
    ),
    rows = splitWorkspace ? scrollRows : filtered.slice((currentPage - 1) * size, currentPage * size);
  const selectedId =
    focus && rows.some((e) => e.id === focus)
      ? focus
      : selection && rows.some((e) => e.id === selection)
        ? selection
        : rows[0]?.id;
  const focused =
    focus && canSee(state, focus) ? entity(state, focus) : undefined;
  const selected =
    focused || (selectedId && all.find((x) => x.id === selectedId));
  const overdue = (splitWorkspace ? searched.filter(e => match(e,tab)) : filtered).filter(isOverdue).length;
  const click = (id: string) => {
    setSelection(id);
    onOpen(id);
  };
  return (
    <>
      <div className={`panel work-panel ${review2 ? "review-workspace2" : splitWorkspace ? "case-workspace" : view === "calls" ? "calls-workspace" : ""} ${focus ? "has-focus" : ""}`}>
        <div className="workspace-tabs-row">
        {focus && returnSource && <ShadcnButton variant="ghost" size="sm" className="workspace-source-back" onClick={returnSource.onBack}><span aria-hidden="true">←</span>{returnSource.label}</ShadcnButton>}
        <Tabs value={tab} label="记录分类" panelId={`workspace-${workspaceId}`} options={tabs.map(([value,label]) => ({value,label,count:searched.filter(x => match(x,value)).length}))} onChange={value => { setTab(value); setPage(1); onOpen(""); }}/>
        </div>
        <div role="tabpanel" id={`workspace-${workspaceId}`} aria-labelledby={`workspace-${workspaceId}-tab-${tab}`}>
        <div className="filters">
          <SearchField label="搜索记录" name="record-search" placeholder="搜索编号、问题或坐席…" value={search} onValueChange={value => { setSearch(value); setPage(1); onOpen(""); }}/>
          {view === "improvement" && <SelectField aria-label="事项类型" value={kind} onValueChange={value => {setKind(value);setPage(1);onOpen("");}}><option value="">全部类型</option><option value="appeal">申诉</option><option value="remedy">整改</option></SelectField>}
          <SelectField
            aria-label="业务筛选"
            value={business}
            onValueChange={value => {
              setBusiness(value);
              setPage(1);
              onOpen("");
            }}
          >
            <option value="">全部业务</option>
            {["账户查询", "信用卡", "转账汇款"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </SelectField>
          {view === "calls" && <ShadcnButton variant="outline" className="btn" aria-expanded={moreFilters} aria-controls="call-more-filters" onClick={()=>setMoreFilters(!moreFilters)}><Icon name="filter" size={16}/>筛选条件{[startDate,endDate,agent,group,execution].filter(Boolean).length ? ` · ${[startDate,endDate,agent,group,execution].filter(Boolean).length}` : ""}</ShadcnButton>}
          {view === "calls" && <div id="call-more-filters" className="advanced-filters" hidden={!moreFilters}>
            <label>开始日期<Input aria-label="通话开始日期" type="date" aria-invalid={invalidDates} aria-describedby={invalidDates ? "call-date-error" : undefined} value={startDate} onChange={e=>{setStartDate(e.target.value);setPage(1);onOpen("");}}/></label>
            <label>结束日期<Input aria-label="通话结束日期" type="date" aria-invalid={invalidDates} aria-describedby={invalidDates ? "call-date-error" : undefined} value={endDate} onChange={e=>{setEndDate(e.target.value);setPage(1);onOpen("");}}/></label>
            <SelectField aria-label="通话坐席" value={agent} onValueChange={value => {setAgent(value);setPage(1);onOpen("");}}><option value="">全部坐席</option>{people.filter(p=>p.role==="agent" && (role!=="agent" || p.id===state.identity)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</SelectField>
            <div className="additional-filters"><SelectField aria-label="通话班组" value={group} onValueChange={value => {setGroup(value);setPage(1);onOpen("");}}><option value="">全部班组</option>{[...new Set(state.calls.filter(c=>canSeeCall(state,c)).map(c=>c.group))].map(g=><option key={g}>{g}</option>)}</SelectField><SelectField aria-label="检测状态" value={execution} onValueChange={value => {setExecution(value);setPage(1);onOpen("");}}><option value="">全部检测状态</option>{["待处理","处理中","已完成","部分失败","失败"].map(x=><option key={x}>{x}</option>)}</SelectField></div>
          </div>}
          <div className="filter-actions">
          {splitWorkspace && (view !== "alerts" || overdue > 0) ? <ShadcnButton variant="ghost" size="sm" className={`review2-overdue-filter ${overdueOnly ? "is-active" : ""}`} aria-pressed={overdueOnly} onClick={()=>{setOverdueOnly(!overdueOnly);setPage(1);onOpen("");}}>仅看逾期 <b>{overdue}</b></ShadcnButton> : view !== "calls" && overdue > 0 && <span className="queue-overdue has-overdue">逾期 <b>{overdue}</b></span>}
          {(search || business || startDate || endDate || agent || group || execution || view === "improvement" && kind) && <Button onClick={()=>{setSearch("");setBusiness("");setKind("");setStartDate("");setEndDate("");setAgent("");setGroup("");setExecution("");setPage(1);onOpen("");}}>重置筛选</Button>}
          <span className="filter-total" role="status">共 {filtered.length} 条</span>
          <Button
            disabled={invalidDates}
            icon="download"
            onClick={() =>
              download(
                csv([
                  [
                    "编号",
                    "通话",
                    "事项",
                    "业务",
                    "坐席",
                    "阶段",
                    "责任人",
                    "有效期限（北京时间）",
                    "期限变更记录",
                    ...(view === "calls" ? ["触发规则数", "涉及指标数", "触发统计状态"] : []),
                  ],
                  ...filtered.map((e) => {
                    const c = callFor(state, e.id);
                    const triggers = view === "calls" && c ? callTriggers(c, state.findings.filter(f => canSee(state, f.id))) : undefined;
                    return [
                      e.id,
                      c?.id,
                      label(e),
                      c?.business,
                      c ? person(c.agentId)?.name : "",
                      stateLabel(e, state),
                      person(currentOwner(state, e))?.name ?? "",
                      activeDeadline(e) ? stamp(activeDeadline(e)) : "",
                      e.deadlineChanges?.map(h=>`${stamp(h.at)} ${stamp(h.from)} → ${stamp(h.to)} ${h.reason}`).join("；") ?? "",
                      ...(triggers ? [triggers.ruleCount ?? "", triggers.indicatorCount ?? "", triggers.complete ? "已完成" : triggers.ruleCount === null ? "待统计" : "暂计"] : []),
                    ];
                  }),
                ]),
                `${view}-当前筛选.csv`,
              )
            }
          >
            导出
          </Button>
          </div>
        </div>
        {(search || business || kind || startDate || endDate || agent || group || execution) && <div className="active-filter-list" aria-label="已生效筛选条件"><span>已筛选</span>{[{value:search,label:`关键词：${search}`,clear:()=>setSearch("")},{value:business,label:business,clear:()=>setBusiness("")},{value:kind,label:kind === "appeal" ? "申诉" : "整改",clear:()=>setKind("")},{value:startDate,label:`起：${startDate}`,clear:()=>setStartDate("")},{value:endDate,label:`止：${endDate}`,clear:()=>setEndDate("")},{value:agent,label:person(agent)?.name ?? agent,clear:()=>setAgent("")},{value:group,label:group,clear:()=>setGroup("")},{value:execution,label:execution,clear:()=>setExecution("")}].filter(x=>x.value).map((x,i)=><SurfaceButton key={i} aria-label={`移除筛选：${x.label}`} onClick={()=>{x.clear();setPage(1);onOpen("");}}>{x.label}<Icon name="close" size={12}/></SurfaceButton>)}</div>}
        {invalidDates ? <p className="filter-error" id="call-date-error" role="alert">开始日期不能晚于结束日期，请调整日期范围。<SurfaceButton className="text-button" onClick={() => { setStartDate(endDate); setEndDate(startDate); }}>交换日期</SurfaceButton></p> : null}
        {view === "calls" ? (
          <section className="calls-results" aria-label="通话列表">
            <div className="table-scroll">
              <Table className="call-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>通话 / 客户</TableHead>
                    <TableHead>业务 / 班组</TableHead>
                    <TableHead>坐席</TableHead>
                    <TableHead>通话时间 / 时长</TableHead>
                    <TableHead>检测状态</TableHead>
                    <TableHead title="最新检测批次自动命中的规则去重计数；同一规则的多个问题只计一条，不代表已确认违规">触发规则</TableHead>
                    <TableHead>质检结果</TableHead>
                    {role === "supervisor" && <TableHead>抽检记录</TableHead>}
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => {
                    const c = e as Call,
                      findings = state.findings.filter(
                        (f) => f.callId === c.id && canSee(state, f.id),
                      ),
                      triggers = callTriggers(c, findings);
                    return (
                      <TableRow
                        key={c.id}
                      >
                        <TableCell>
                          <div className="call-record-identity">
                            <span className="call-type-icon" aria-hidden="true"><Icon name="phone"/></span>
                            <div><a className="record-link call-id-link" aria-label={`查看通话 ${c.id}`} href={`?view=calls&id=${c.id}`} onClick={e => { if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); click(c.id); } }}>{c.id}</a>
                            <small>{c.customer}</small></div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.business}
                          <small>{c.group}</small>
                        </TableCell>
                        <TableCell>{person(c.agentId)?.name}</TableCell>
                        <TableCell>
                          {c.endedAt ? (
                            stamp(c.endedAt)
                          ) : (
                            <Badge tone="success">通话中</Badge>
                          )}
                          <small>{clock(c.duration)}</small>
                        </TableCell>
                        <TableCell>
                          <Badge
                            tone={
                              detection(c) === "已完成"
                                ? "success"
                                : detection(c).includes("失败")
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {detection(c)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="result-counts">{triggers.ruleCount === null ? "—" : `${triggers.ruleCount} 条`}<small>{triggers.ruleCount === null ? "待统计" : `涉及 ${triggers.indicatorCount} 项指标${triggers.complete ? "" : " · 暂计"}`}</small></span>
                        </TableCell>
                        <TableCell>
                          <span className="result-counts">候选 {findings.filter((f) => f.source === "auto").length}<small>已确认成立 {findings.filter((f) => latest(f)?.value === "risk").length}</small></span>
                        </TableCell>
                        {role === "supervisor" && <TableCell>{state.reviews.filter(r=>r.callId===c.id && r.type==="spotcheck").length} 次</TableCell>}
                        <TableCell><div className="call-row-actions">
                          <ShadcnButton variant="link" size="sm" onClick={()=>click(c.id)}>查看</ShadcnButton>
                          {role === "supervisor" && <ShadcnButton variant="link" size="sm" disabled={!contextActions(state,c.id).includes("spotcheck")} onClick={()=>onAction(c.id,"spotcheck")}>人工抽检</ShadcnButton>}
                        </div></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!rows.length && <Empty />}
            </div>
            <Pagination
              page={currentPage}
              total={filtered.length}
              size={size}
              onPage={n => { setPage(n); setSelection(undefined); onOpen(""); }}
              onSize={(n) => {
                setSize(n);
                setPage(1);
                setSelection(undefined);
                onOpen("");
              }}
            />
          </section>
        ) : (
          <>
            <div className="work-layout">
              <section id={`queue-${workspaceId}`} className="queue" aria-label="事项队列"><header className="queue-heading"><b>{review2 ? "工单队列" : view==="alerts" ? "预警队列" : view==="improvement" ? "事项队列" : "事项队列"}</b>{splitWorkspace && <span>{filtered.length} 条{review2 ? " · 逾期优先" : ""}</span>}</header><div className="queue-items" ref={containerRef} tabIndex={splitWorkspace ? 0 : undefined} aria-label={splitWorkspace ? "滚动事项队列" : undefined}>
                {rows.length ? (
                  rows.map((e) => {
                    const c = callFor(state, e.id);
                    return (
                      <ShadcnButton variant="ghost"
                        key={e.id}
                        aria-pressed={selectedId === e.id}
                        className={`queue-card ${selectedId === e.id ? "selected" : ""}`}
                        onClick={() => click(e.id)}
                      >
                        <div className="queue-top">
                          <span>{e.id}</span>
                          {splitWorkspace && isOverdue(e) ? <Badge tone="danger">已逾期</Badge> : <Badge
                            tone={
                              "severity" in e && e.severity === "high"
                                ? "danger"
                                : "neutral"
                            }
                          >
                            {role === "agent" && "conclusions" in e ? (latest(e) ? "质检结果" : "通话提醒") : "severity" in e
                              ? e.severity === "high"
                                ? "高风险"
                                : e.severity === "medium" ? "中风险" : "低风险"
                              : "standardVersion" in e
                                ? "整改"
                                : "findingIds" in e
                                  ? e.type === "appeal"
                                    ? "申诉核查"
                                    : e.type === "spotcheck"
                                      ? "人工抽检"
                                      : "人工复核"
                                  : "executor" in e
                                    ? "补件"
                                    : "申诉"}
                          </Badge>}
                        </div>
                        <b>{caseTitle(state, e)}</b>
                        <p>
                          {c && person(c.agentId)?.name} · {c?.business}
                        </p>
                        <div className="queue-bottom">
                          <span className="status-dot" />
                          {stateLabel(e, state)}
                          <span className="queue-time">
                            {activeDeadline(e)
                              ? `${splitWorkspace ? "截止 " : ""}${stamp(activeDeadline(e))}`
                              : stamp(c?.startedAt)}
                          </span>
                        </div>
                      </ShadcnButton>
                    );
                  })
                ) : (
                  <Empty
                    text="当前队列为空"
                    hint="可以切换其他分类，或调整筛选条件。"
                  />
                )}
                {splitWorkspace && rows.length > 0 && <div ref={sentinelRef} className="queue-scroll-status">
                  {hasMore ? <><span role="status">已显示 {rows.length} / {filtered.length} 条</span><ShadcnButton variant="ghost" size="sm" onClick={loadMore}>加载更多</ShadcnButton></> : <span role="status">已全部加载 · 共 {filtered.length} 条</span>}
                </div>}
              </div>{!splitWorkspace && <Pagination page={currentPage} total={filtered.length} size={size} onPage={n=>{setPage(n);setSelection(undefined);onOpen("");}} onSize={n=>{setSize(n);setPage(1);setSelection(undefined);onOpen("");}}/>}
              </section>
              <section className="detail">
                <div className="case-mobile-back"><Button onClick={() => onOpen("")}>返回事项列表</Button></div>
                {selected ? (
                  <Detail
                    key={selected.id}
                    review2={review2}
                    workbenchStyle={splitWorkspace}
                    state={state}
                    item={selected}
                    onOpen={onOpen}
                    onAction={onAction}
                  />
                ) : (
                  <Empty
                    text="暂无可查看的事项"
                    hint="新事项到达后会显示在这里。"
                  />
                )}
              </section>
            </div>
          </>
        )}
        </div>
      </div>
      {view === "calls" && focused && "batches" in focused && <CallSheet key={focused.id} state={state} call={focused} onClose={()=>onOpen("")} onOpen={onOpen} onAction={onAction}/>}
    </>
  );
}
function CallSheet({state,call,onClose,onOpen,onAction}:{state:State;call:Call;onClose:()=>void;onOpen:(id:string)=>void;onAction:(id:string,action:string)=>void}) {
  const [tab,setTab]=useState("evidence");
  useEffect(()=>{
    const show=(event:Event)=>{if((event as CustomEvent<string>).detail===call.id){setTab("history");requestAnimationFrame(()=>document.getElementById(`call-${call.id}-tab-history`)?.focus({preventScroll:true}));}};
    window.addEventListener("qc:show-history",show);return()=>window.removeEventListener("qc:show-history",show);
  },[call.id]);
  const findings=state.findings.filter(f=>f.callId===call.id && canSee(state,f.id));
  const related=[...findings,...state.reviews,...state.appeals,...state.remedies,...state.supplements].filter(item=>callFor(state,item.id)?.id===call.id && canSee(state,item.id));
  const logs=state.logs.filter(log=>log.target===call.id || log.callId===call.id && canSee(state,log.target));
  return <Sheet open onOpenChange={open=>{if(!open)onClose();}}><SheetContent className="call-sheet" showCloseButton={false} onCloseAutoFocus={event=>{event.preventDefault();document.querySelector<HTMLAnchorElement>(`a.call-id-link[href$="id=${call.id}"]`)?.focus();}}>
    <SheetHeader><div><SheetTitle>{call.id} · {call.business}</SheetTitle><SheetDescription>{person(call.agentId)?.name} · {call.group} · {clock(call.duration)}</SheetDescription></div><ShadcnButton variant="ghost" size="icon" aria-label="关闭通话详情" onClick={onClose}><Icon name="close"/></ShadcnButton></SheetHeader>
    <div className="call-inspection-layout"><section className="call-inspection-main"><Tabs label="通话详情" panelId={`call-${call.id}`} value={tab} onChange={setTab} options={[{value:"evidence",label:"录音与证据"},{value:"history",label:"处理记录"},{value:"related",label:"问题与处理记录",count:findings.length}]}/>
    <div className="call-sheet-body" role="tabpanel" id={`call-${call.id}`} aria-labelledby={`call-${call.id}-tab-${tab}`}>
      {tab==="evidence" && <Evidence state={state} call={call} findings={findings}/>}
      {tab==="history" && <EventTimeline events={logs.map(log=>({id:log.id,at:log.at,title:log.action,actor:log.actor==="system" ? "系统 · 工作流" : `${person(log.actor)?.name ?? "系统"} · ${person(log.actor) ? roleNames[person(log.actor).role] : "工作流"}`,note:log.note,kind:log.actor==="system" ? "system" : "human",demo:log.id.startsWith("EV-DEMO-") || log.id==="EV-SEED"}))}/>}
      {tab==="related" && <section className="call-sheet-issues" aria-label="问题与处理记录"><h3>问题记录 · {findings.length} 项</h3>{findings.map(item=><ShadcnButton variant="ghost" key={item.id} onClick={()=>onOpen(item.id)}><span>{item.title}<small>{item.id} · {item.source === "auto" ? "自动预警" : "人工发现"} · {stateLabel(item,state)} · {person(currentOwner(state,item))?.name ?? "当前无需办理"}</small></span><span>查看详情<Icon name="chevron"/></span></ShadcnButton>)}{!findings.length && <p>暂无问题，抽检记录仍可在下方查看。</p>}<h3>关联办理事项</h3>{related.filter(item=>!("conclusions" in item)).map(item=><ShadcnButton variant="ghost" key={item.id} onClick={()=>onOpen(item.id)}><span>{caseTitle(state,item)}<small>{item.id} · {stateLabel(item,state)}</small></span><Icon name="chevron"/></ShadcnButton>)}{!related.length && <Empty text="暂无关联事项" hint="产生问题或复核工单后会显示在这里。"/>}</section>}
    </div>
    </section><aside className="call-inspection-rail" aria-label="通话信息与操作">
      <h3>通话信息</h3><dl><div><dt>坐席 / 班组</dt><dd>{person(call.agentId)?.name} · {call.group}</dd></div><div><dt>客户</dt><dd>{call.customer}</dd></div><div><dt>开始时间</dt><dd>{stamp(call.startedAt)}</dd></div><div><dt>结束时间</dt><dd>{call.endedAt ? stamp(call.endedAt) : "通话进行中"}</dd></div><div><dt>通话时长</dt><dd>{clock(call.duration)}</dd></div><div><dt>检测状态</dt><dd>{detection(call)}</dd></div></dl>
      {contextActions(state,call.id).length>0 && <section className="call-inspection-actions"><h3>可用操作</h3><div className="call-sheet-actions">{contextActions(state,call.id).map((action,index)=><Button primary={index===0} key={action} onClick={()=>onAction(call.id,action)}>{actionLabel(state,call.id,action)}</Button>)}</div></section>}
    </aside></div>
  </SheetContent></Sheet>;
}
export function Pagination({
  page,
  total,
  size,
  onPage,
  onSize,
}: {
  page: number;
  total: number;
  size: number;
  onPage: (n: number) => void;
  onSize: (n: number) => void;
}) {
  const max = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pagination">
      <span role="status">{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} 条，共 ${total} 条` : "共 0 条"}</span>
      <SelectField
        aria-label="每页条数"
        value={size}
        onValueChange={value => onSize(Number(value))}
      >
        {[5, 10, 20].map((n) => (
          <option key={n} value={n}>
            {n} 条 / 页
          </option>
        ))}
      </SelectField>
      <div />
      <ShadcnButton variant="outline" size="icon-sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="上一页"
      >
        ‹
      </ShadcnButton>
      <b>{page}</b>
      <span>/ {max}</span>
      <ShadcnButton variant="outline" size="icon-sm"
        disabled={page >= max}
        onClick={() => onPage(page + 1)}
        aria-label="下一页"
      >
        ›
      </ShadcnButton>
    </div>
  );
}
export function Detail({
  review2 = false,
  workbenchStyle = false,
  state,
  item,
  onOpen,
  onAction,
}: {
  state: State;
  item: Entity;
  review2?: boolean;
  workbenchStyle?: boolean;
  onOpen: (id: string) => void;
  onAction: (id: string, action: string) => void;
}) {
  const modernDetail = review2 || workbenchStyle;
  const alertDetail = "conclusions" in item && item.source === "auto";
  const detailPanelId = `${review2 ? "review2-" : ""}detail-${item.id}`;
  const [tab, setTab] = useState("overview");
  useEffect(()=>{
    const show=(event:Event)=>{if((event as CustomEvent<string>).detail===item.id){setTab("history");requestAnimationFrame(()=>document.getElementById(`${detailPanelId}-tab-history`)?.focus({preventScroll:true}));}};
    window.addEventListener("qc:show-history",show);return()=>window.removeEventListener("qc:show-history",show);
  },[item.id,detailPanelId]);
  const [preview, setPreview] = useState<"evidence" | "materials" | "finding" | "rule" | null>(null);
  const [previewSegment, setPreviewSegment] = useState<number>();
  const [ruleReturn, setRuleReturn] = useState<"finding" | null>(null);
  const previewSurface = useRef<HTMLDivElement>(null);
  const findingScroll = useRef(0);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{
      const surface=previewSurface.current;
      if(!surface)return;
      surface.focus({preventScroll:true});
      const body=surface.closest(".modal-body");
      if(body)body.scrollTop=preview==="finding" ? findingScroll.current : 0;
    });
    return()=>cancelAnimationFrame(frame);
  },[preview]);
  const [previewFinding, setPreviewFinding] = useState<string>();
  const [ruleFindingIds, setRuleFindingIds] = useState<string[]>([]);
  const call = callFor(state, item.id),
    allowed = contextActions(state, item.id);
  const mainAction = primaryAction(state,item.id);
  const supervisorComment = supervisorReturnNote(state, item);
  const visibleActions = allowed;
  const closure = "conclusionVersion" in item;
  const now = useDemoClock();
  const appealDecision = "findingIds" in item && item.appealId && roleOf(state) === "supervisor" && item.status === "supervisor" ? state.appeals.find(a => a.id === item.appealId && contextActions(state, a.id).includes("decide")) : undefined;
  const assignedReview = "reviewId" in item ? state.reviews.find(r => r.id === item.reviewId && r.owner === state.identity && !["done", "cancelled"].includes(r.status) && canSee(state, r.id)) : undefined;
  const supplements = state.supplements.filter(sp=>sp.target===item.id && canSee(state,sp.id));
  const supplementActions=state.supplements.filter(sp=>(sp.target===item.id || "findingIds" in item && sp.target===item.appealId) && canSee(state,sp.id)).flatMap(sp=>contextActions(state,sp.id).map(action=>({id:sp.id,action})));
  const owner = person(currentOwner(state, item));
  const associated = call
    ? state.findings.filter((f) => f.callId === call.id && canSee(state, f.id))
    : [];
  const primary =
    "conclusions" in item
      ? item
      : "findingId" in item
        ? state.findings.find((f) => f.id === item.findingId)
        : "findingIds" in item
          ? state.findings.find((f) => item.findingIds.includes(f.id))
          : "executor" in item ? undefined : associated[0];
  const otherFindings = associated.filter(x => x.id !== item.id && x.id !== primary?.id);
  const distribution = distributionContext(state, item, primary);
  const issueIds = "findingIds" in item ? item.findingIds : primary ? [primary.id] : [];
  const related = problemRecords(state, issueIds).filter(record => record.id !== item.id);
  const logs = (issueIds.length ? problemLogs(state, issueIds) : state.logs.filter(log => log.target === item.id && canSee(state, log.target))).slice().reverse();
  const showEvidence = (findingId?: string, segment?: number) => { setPreviewFinding(findingId); setPreviewSegment(segment); findingScroll.current=0; setPreview(review2 && "findingIds" in item && findingId ? "finding" : "evidence"); };
  const showRule = (findingId: string, fromDetail = false, matchingIds: string[] = [findingId]) => {
    setRuleFindingIds(matchingIds);
    findingScroll.current=fromDetail ? previewSurface.current?.closest(".modal-body")?.scrollTop ?? 0 : 0;
    setPreviewFinding(findingId); setRuleReturn(fromDetail ? "finding" : null); setPreview("rule");
  };
  const selectedFinding=associated.find(f=>f.id===previewFinding) ?? primary;
  const verdict = primary && !("findingIds" in item) ? closure ? primary.conclusions.find(c => c.version === item.conclusionVersion) : latest(primary) : undefined;
  const caseNote = "standardVersion" in item ? item.goal : "conclusionVersion" in item ? item.note : "findingIds" in item ? item.scope : "executor" in item ? item.note : primary?.reminder?.text ?? verdict?.note;
  const distinctNote=caseNote && caseNote!==caseTitle(state,item) && !(review2 && "findingIds" in item && item.type==="candidate") ? caseNote : undefined;
  const hasSummary=("findingIds" in item && !item.findingIds.length) || !!supervisorComment || !!verdict || "conclusions" in item && !!call || !!distinctNote || "findingIds" in item && !!item.evidenceRequest || "pause" in item && !!item.pause || "standardVersion" in item || "executor" in item;
  const hasDocuments=!!verdict && !("findingIds" in item) || "conclusionVersion" in item || "standardVersion" in item || supplements.length>0;
  return <>
    <div className="case-shell">
      <div className="case-main">
        <div className="detail-overview">
      <header className="detail-heading">
        <div>
          <div className="overline">
            {item.id}
          </div>
          <h2>{caseTitle(state, item)}</h2>
          <div className="detail-badges">
            <Badge
              tone={
                ("batches" in item ? detection(item) === "已完成" : "status" in item &&
                ["done", "closed", "delivered"].includes(item.status))
                  ? "success"
                  : "warning"
              }
            >
              {"batches" in item ? `检测${stateLabel(item, state)}` : stateLabel(item, state)}
            </Badge>
            {primary && "conclusions" in item && (
              <span>
                {primary.source === "auto" ? "自动候选" : "人工发现"}
              </span>
            )}
          </div>
        </div>
        {modernDetail && call && !("batches" in item) && <div className="case-header-tools"><Badge tone={call.endedAt ? "neutral" : "success"}>{call.endedAt ? "通话已结束" : "通话中"}</Badge></div>}
      </header>
      <div className={`detail-meta${modernDetail ? " review2-header-meta" : ""}`}>
        <span>
          坐席 <b>{call && person(call.agentId)?.name}</b>
        </span>
        <span>
          业务 <b>{call?.business}</b>
        </span>
        {"batches" in item ? <><span>通话状态 <b>{item.endedAt ? "已结束" : "通话中"}</b></span><span>时长 <b>{clock(item.duration)}</b></span><span>班组 <b>{item.group}</b></span></> : null}
        {call && call.id !== item.id && <span>来源通话 {modernDetail ? <ShadcnButton variant="link" className="review2-inline-link" onClick={()=>onOpen(call.id)}>{call.id}</ShadcnButton> : <ShadcnButton variant="link" onClick={()=>onOpen(call.id)} aria-label={`查看关联通话 ${call.id}`}>{call.id}</ShadcnButton>}</span>}
        {"findingIds" in item ? review2 ? <Review2Indicators state={state} findingIds={item.findingIds} onRule={(id, matchingIds)=>showRule(id,false,matchingIds)}/> : <span>问题 <b>{item.findingIds.length} 项</b></span> : primary && <span>指标 <b>{ruleCategories.find(([id])=>id===primary.indicator)?.[1] ?? primary.indicator}</b></span>}
        {!modernDetail && call && !("batches" in item) && <Badge tone={call.endedAt ? "neutral" : "success"}>{call.endedAt ? "通话已结束" : "通话中"}</Badge>}
      </div>

        </div>
        <Tabs value={tab} label="事项详情" className="subtabs case-tabs" panelId={detailPanelId} options={[{value:"overview",label:review2 && "findingIds" in item ? "问题与证据" : "办理概览"},{value:"history",label:"处理记录"},{value:"related",label:`关联事项 ${related.length + otherFindings.length}`}]} onChange={setTab}/>
        <div className="case-content" role="tabpanel" id={detailPanelId} aria-labelledby={`${detailPanelId}-tab-${tab}`}>
          {tab === "overview" && <>
            {hasSummary && <section className="case-section" aria-label="案件摘要">
              {verdict && <div className="case-verdict"><span>{closure ? "原结论" : "当前结论"}</span><Badge tone={verdict.value === "risk" ? "danger" : "neutral"}>{verdictNames[verdict.value]} · V{verdict.version}</Badge></div>}
              {"conclusions" in item && call && <div className="evidence-summary"><h3>命中片段</h3>{item.evidence.map(index=>call.transcript[index] && <ShadcnButton variant="ghost" key={index} className="evidence-excerpt" onClick={()=>showEvidence()}><time>{clock(call.transcript[index].at)}</time><span>{call.transcript[index].text}</span><Icon name="chevron" size={14}/></ShadcnButton>)}<p>{latest(item) ? "结论与原始证据保留供追溯。" : "自动结果待核对，请结合上下文确认。"}</p></div>}
              {distribution && <div className="requirements"><h3>{distribution.title}</h3><p>{distribution.goal}</p><p>完成标准：{distribution.standard}</p><p>资料要求：{distribution.observation} · {distribution.sampleCount} 通样例</p><p>期限：{stamp(distribution.dueAt)} · 质检员：{distribution.inspector}</p>{distribution.guidance && <small>{distribution.guidance}</small>}</div>}
              {primary && latest(primary)?.value === "false_positive" && <div className="requirements"><h3>{primary.source === "auto" ? "系统误报归档" : "人工发现撤销记录"}</h3><p>归档原因：{latest(primary)?.note}</p><p>确认人：{person(latest(primary)!.by)?.name} · {stamp(latest(primary)?.at)}</p><p>规则：{primary.ruleId} · V{latest(primary)?.ruleVersion ?? primary.ruleVersion} · 检测批次：{latest(primary)?.batchId ?? primary.batchId}</p><p>来源：{primary.source === "auto" ? "系统规则检测" : "人工抽检"} · 核实人：{person(latest(primary)?.reviewer ?? "")?.name ?? "主管直接确认"}</p>{primary.source === "auto" && <p>规则优化：{{pending:"待评估",recorded:"已记录优化建议",unnecessary:"无需调整"}[primary.optimization?.status ?? "pending"]} · {primary.optimization?.note ?? "等待主管记录反馈"}</p>}</div>}
              {"executor" in item && <div className="requirements"><h3>补件要求</h3><p>{item.note}</p><p>执行人：{person(item.executor)?.name} · 期限：{stamp(item.dueAt)}</p>{item.reply && <><h3>已提交材料</h3><p>{item.reply}</p></>}{item.cancellationReason && <p>结束原因：{item.cancellationReason}</p>}</div>}
              {"findingIds" in item && item.evidenceRequest && <div className="requirements"><h3>质检员补证申请</h3><p>{item.evidenceRequest.note}</p><small>安排执行人和补证期限，接收后由原质检员继续核实。</small></div>}
              {supervisorComment && <div className="requirements"><h3>主管退回意见</h3><p>{supervisorComment}</p><small>{"findingIds" in item && item.type !== "appeal" ? "请按退回要求重新核实并提交结果。" : "findingIds" in item ? "赞同则重新核查；不赞同则补充依据向主管说明。" : "赞同则补充要求退回坐席；不赞同则补充核验依据向主管说明。"}</small></div>}
              {"standardVersion" in item && item.supplementRequirements && <div className="requirements"><h3>本轮补充整改要求</h3><p>{item.supplementRequirements}</p></div>}
              {"findingIds" in item && !item.findingIds.length && <div className="requirements"><h3>人工抽检范围</h3><p>{item.scope}</p><p>{item.scopeResult==="clear" ? `范围内未发现问题：${item.summary ?? ""}` : "核查后登记人工发现，或提交未发现问题的范围核验说明。"}</p></div>}
              {distinctNote && <div className="case-summary-note"><span>{"standardVersion" in item ? "整改目标" : "conclusionVersion" in item ? "申诉理由" : "findingIds" in item ? "检查范围" : "处理摘要"}</span><p>{distinctNote}</p>{!("conclusionVersion" in item) && <SurfaceButton className="text-button" onClick={()=>setPreview("materials")}>查看完整材料</SurfaceButton>}</div>}
              {"pause" in item && item.pause && <p className="case-pause">申诉处理中，整改暂停。可以补充材料，暂不能验收通过或结案。</p>}
              {"standardVersion" in item && <div className="case-progress"><span>本轮样例 <b>{new Set(item.materials.flatMap(m=>m.samples)).size} / {item.sampleCount}</b></span><span>完成标准 V{item.standardVersion}</span></div>}
            </section>}
            {"findingIds" in item && item.findingIds.length > 0 && (review2 ? <Review2Findings state={state} review={item} call={call} onEvidence={showEvidence} onRule={id=>showRule(id)}/> : <section className="case-section" aria-label="问题与意见"><div className="case-section-title"><h3>复核意见</h3><span>{item.status === "supervisor" ? "待主管确认 · " : ""}{item.findingIds.length} 项</span></div><div className="case-findings">{item.findingIds.map(id=>{const f=state.findings.find(x=>x.id===id);return f && <div key={id}><div><b>{f.title}</b><div className="finding-verdict">{item.opinions[id] ? <><Badge tone={item.opinions[id].value==='risk' ? 'danger' : item.opinions[id].value==='false_positive' ? 'success' : 'warning'}>{verdictNames[item.opinions[id].value]}</Badge><p>{item.opinions[id].note}</p></> : <span>待填写复核意见</span>}</div></div><Button onClick={()=>showEvidence(id)}>查看证据</Button></div>;})}</div></section>)}
            {hasDocuments && <section className="case-section" aria-label="证据与材料"><div className="case-section-title"><h3>证据与材料</h3></div>
              <CaseDocuments item={item} primary={primary} onOpen={onOpen}/>
              {supplements.map(sp=><div className="case-supplement" key={sp.id}><SurfaceButton className="case-document" onClick={()=>setPreview("materials")}><span className="case-document-icon"><Icon name="file"/></span><span><b>{openSupplement(sp) ? "待补材料" : "补件记录"} · {stateLabel(sp,state)}</b><small>{person(sp.executor)?.name} · {stamp(sp.dueAt)}</small></span><span className="case-preview-label">预览</span></SurfaceButton><div>{contextActions(state,sp.id).map(action=><Button key={action} onClick={()=>onAction(sp.id,action)}>{actionLabel(state,sp.id,action)}</Button>)}</div></div>)}
            </section>}

          </>}
          {tab === "history" && <EventTimeline events={[
            ...("firstOverdueAt" in item && item.firstOverdueAt ? [{id:`overdue-${item.id}`,at:item.firstOverdueAt,title:"超过办理期限",actor:"系统 · 时限记录",note:`当时截止时间：${stamp(item.firstOverdueAt)}；到期时尚未完成办理。当时责任人未记录。`,kind:"system" as const}] : []),
            ...logs.map(log=>({id:log.id,at:log.at,title:log.action,actor:log.actor === "system" ? "系统 · 工作流" : `${person(log.actor)?.name ?? "系统"} · ${person(log.actor) ? roleNames[person(log.actor).role] : "工作流"}`,note:log.note,kind:log.actor === "system" ? "system" as const : "human" as const,demo:log.id.startsWith("EV-DEMO-") || log.id === "EV-SEED"})),
            ...(item.deadlineChanges ?? []).map((entry,index)=>({id:`deadline-${index}`,at:entry.at,title:"调整完成期限",actor:"责任流转",note:`${stamp(entry.from)} → ${stamp(entry.to)}；${entry.reason}`,kind:"change" as const})),
            ...(primary?.conclusions ?? []).map(conclusion=>({id:`conclusion-${conclusion.version}`,at:conclusion.at,title:`结论 V${conclusion.version} · ${verdictNames[conclusion.value]}`,actor:`${person(conclusion.by)?.name ?? "主管"} · 质检主管`,note:conclusion.note})),
            ...("standardVersion" in item ? item.standards.map(standard=>({id:`standard-${standard.version}`,at:standard.at,title:`完成标准 V${standard.version}`,actor:"整改要求",note:`${standard.standard} ${standard.note}`,kind:"change" as const})) : []),
            ...("standardVersion" in item ? item.pauseHistory.map((pause,index)=>({id:`pause-${index}`,at:pause.end,title:"恢复处理",actor:"系统 · 工作流",note:`${stamp(pause.start)} → ${stamp(pause.end)}；期限顺延 ${Math.round(pause.duration/1000)} 秒`,kind:"system" as const})) : []),
          ]}/>}
          {tab === "related" && (
            <div className="related-list">
              {!review2 && otherFindings.length > 0 && <h3>同通话其他问题</h3>}
              {otherFindings.map((f) => (
                  <ShadcnButton variant="ghost" key={f.id} onClick={() => onOpen(f.id)}>
                    <Icon name="shield" />
                    <div>
                      <b>{f.title}</b>
                      <small>
                        {f.id} · 风险问题
                      </small>
                    </div>
                    <Badge tone="neutral">{stateLabel(f, state)}</Badge>
                    {!review2 && <Icon name="chevron" />}
                  </ShadcnButton>
                ))}
              {!review2 && related.length > 0 && otherFindings.length > 0 && <h3>处理事项</h3>}
              {related.map((r) => (
                <ShadcnButton variant="ghost" key={r.id} onClick={() => onOpen(r.id)}>
                  <Icon name="file" />
                  <div>
                    <b>{caseTitle(state, r)}</b>
                    <small>
                      {r.id} · {"findingIds" in r ? "复核工单" : "standardVersion" in r ? "整改任务" : "申诉"}
                    </small>
                  </div>
                  <Badge tone={"status" in r && r.status === "done" ? "success" : "neutral"}>{stateLabel(r, state)}</Badge>
                  {!review2 && <Icon name="chevron" />}
                </ShadcnButton>
              ))}
              {!related.length && !otherFindings.length && (
                <Empty text="暂无关联事项" hint="当前通话没有其他可查看的问题或处理记录。" />
              )}
            </div>
          )}
        </div>
      </div>
      <aside className="case-rail" aria-label="当前责任与下一步操作">
        <CaseResponsibility state={state} item={item} now={now}/>
        <section className="case-next-action"><h3>{"batches" in item ? "通话操作" : "下一步操作"}</h3>
          {"findingIds" in item && item.status === "supervisor" && mainAction === "return_review" && <p className="case-action-hint">当前尚无可确认的完整结果，请退回质检员补充核实。</p>}
          {closure && "pause" in item && item.pause && <p className="case-action-hint">申诉处理中，整改暂停；暂不能验收通过或结案。</p>}
          <div className="case-action-buttons">
          {supplementActions.length || allowed.length || actions(state,item.id).includes("save_acceptance") || actions(state,item.id).includes("save_review") ? (
            <>
            {supplementActions.map(({id,action})=><Button key={`${id}-${action}`} primary={!mainAction} onClick={()=>onAction(id,action)}>{actionLabel(state,id,action)}</Button>)}
            {[...visibleActions.filter(a => a === mainAction), ...visibleActions.filter(a => a !== mainAction)].map(a => (
              <Button key={a} primary={a === mainAction} onClick={() => onAction(item.id, a)}>{actionLabel(state, item.id, a)}</Button>
            ))}
            {actions(state,item.id).includes("save_review") && !allowed.includes("submit_review") && <Button onClick={()=>onAction(item.id,"save_review")}>编辑复核草稿</Button>}
            {actions(state,item.id).includes("save_acceptance") && !allowed.includes("verify") && <Button onClick={()=>onAction(item.id,"save_acceptance")}>继续验收草稿</Button>}
            {!allowed.length && !supplementActions.length && !("batches" in item) && !("pause" in item && item.pause) && <p className="subtle">{owner ? `当前等待${owner.name}，无需重复提交。` : "当前无待办，可查看结果与处理记录。"}</p>}
            </>
          ) : appealDecision ? (
            <Button primary onClick={() => onOpen(appealDecision.id)}>打开申诉裁定</Button>
          ) : assignedReview ? (
            <Button primary onClick={() => onOpen(assignedReview.id)}>打开核查工单</Button>
          ) : (
            <p className="subtle">
              当前身份无需处理此阶段，相关结果与记录可继续查看。
            </p>
          )}
          </div>
        </section>
          {!alertDetail && call &&
            !call.endedAt &&
            roleOf(state) === "supervisor" &&
            item.id !== call.id && (
              <div className="scenario">
                <p className="scenario-label">场景操作</p>
                <Button onClick={() => onAction(call.id, "end_call")}>
                  模拟通话结束
                </Button>
              </div>
            )}
          {"standardVersion" in item &&
            actions(state, item.id).includes("sample_calls") && (
              <div className="scenario">
                <p className="scenario-label">场景操作</p>
                <Button onClick={() => onAction(item.id, "sample_calls")}>
                  生成整改后样例
                </Button>
              </div>
            )}


      </aside>
    </div>
    {preview && <Modal title={preview === "finding" ? "问题详情" : preview === "rule" ? "命中规则" : preview === "evidence" ? "录音与证据" : "案件材料"} description={preview === "finding" || preview === "rule" ? `${selectedFinding?.title ?? "问题记录暂不可用"} · ${item.id}` : `${item.id} · ${caseTitle(state,item)}`} variant={preview !== "materials" ? "evidence" : "default"} onClose={()=>setPreview(null)}>
      {(preview === "finding" || preview === "rule") && selectedFinding && call && "findingIds" in item ? <div className="review2-preview" ref={previewSurface} tabIndex={-1} aria-label={preview === "rule" ? "命中规则详情" : "问题详情内容"}>
        {preview === "rule" ? <><ShadcnButton variant="ghost" className="finding-back" onClick={()=>{setPreviewSegment(undefined);setPreview(ruleReturn);}}>← {ruleReturn ? "返回问题详情" : "返回问题列表"}</ShadcnButton>{ruleFindingIds.length > 1 && <div className="review2-rule-choices" aria-label="该指标命中的问题与规则">{associated.filter(f=>ruleFindingIds.includes(f.id)).map(f=><ShadcnButton key={f.id} variant="ghost" aria-pressed={selectedFinding.id===f.id} onClick={()=>setPreviewFinding(f.id)}>{f.title} · {state.rules.find(r=>r.id===f.ruleId)?.name ?? f.ruleId} V{f.ruleVersion}</ShadcnButton>)}</div>}<Review2RuleDetail state={state} finding={selectedFinding}/></> : <Review2FindingDetail state={state} finding={selectedFinding} review={item} onRule={()=>showRule(selectedFinding.id,true)} onCall={()=>{setPreview(null);onOpen(call.id);}}><Evidence state={state} call={call} findings={[selectedFinding]} primary={selectedFinding} initialSegment={previewSegment} evidenceOverride={item.opinions[selectedFinding.id]?.evidence} problemDetail/></Review2FindingDetail>}
      </div> : preview === "evidence" && call ? <Evidence state={state} call={call} findings={"batches" in item || "findingIds" in item ? associated : primary ? [primary] : []} primary={associated.find(f=>f.id===previewFinding) ?? primary} pinnedVersion={closure ? item.conclusionVersion : undefined}/> : <CaseMaterials state={state} item={item} primary={primary} onOpen={id=>{setPreview(null);onOpen(id);}} onAction={(id,action)=>{setPreview(null);onAction(id,action);}}/>}
    </Modal>}
  </>;
}
function CaseMaterials({state,item,primary,onOpen,onAction}: {state:State;item:Entity;primary?:Finding;onOpen:(id:string)=>void;onAction:(id:string,action:string)=>void}) {
  const supplements=state.supplements.filter(sp=>sp.target===item.id && canSee(state,sp.id));
  return <div className="case-materials">
    {primary && <section className="case-section"><h3>结论依据</h3>{primary.conclusions.length ? primary.conclusions.map(c=><div key={c.version}><b>V{c.version} · {verdictNames[c.value]}</b><p>{c.note}</p>{c.noRemedy && <p>无需整改：{c.noRemedy}</p>}</div>) : <p>尚未形成正式结论。</p>}</section>}
              {"standardVersion" in item && (
                <div className="requirements">
                  <h3>
                    整改要求{" "}
                    <Badge>
                      标准 V{item.standardVersion} · 第 {item.round} 轮
                    </Badge>
                  </h3>
                  <p>
                    <b>目标</b>
                    {item.goal}
                  </p>
                  <p>
                    <b>标准</b>
                    {item.standard}
                  </p>
                  <p>
                    <b>复测</b>
                    {item.observation} · 需要 {item.sampleCount} 通
                  </p>
                  {item.materials.map((m, n) => (
                    <div className="material-card" key={n}>
                      <b>
                        材料 {n + 1} · {stamp(m.at)}
                      </b>
                      <p>{m.text}</p>
                      <div className="sample-links">{m.samples.map(id=><Button key={id} onClick={()=>onOpen(id)}>查看样例 {id}</Button>)}{m.attachment && <small>{m.attachment}</small>}</div>
                    </div>
                  ))}
                  <p>本轮已提交 {new Set(item.materials.flatMap(m=>m.samples)).size} / {item.sampleCount} 通样例</p>
                  {item.rounds?.map(round=><Disclosure key={round.round} className="round-history" title={<>第 {round.round} 轮材料与验收 · 标准 V{round.standardVersion}</>}><p>目标：{round.goal}；标准：{round.standard}；要求：{round.sampleCount} 通 / {round.observation}</p>{round.materials.map((m,n)=><div key={n}><p>{m.text}</p>{m.samples.map(id=><Button key={id} onClick={()=>onOpen(id)}>查看样例 {id}</Button>)}{m.attachment && <p>{m.attachment}</p>}</div>)}<p>验收：{round.acceptance?.result === "fail" ? "不通过" : round.acceptance?.result === "pass" ? "通过" : "材料不足"} · {round.acceptance?.note}</p></Disclosure>)}
                  {(item.acceptanceDraft || item.draft) && <div className="material-card"><b>验收草稿</b><p>{item.acceptanceDraft?.note ?? item.draft}</p><small>{item.acceptanceDraft ? `第 ${item.acceptanceDraft.round} 轮 · 标准 V${item.acceptanceDraft.version} · ${person(item.acceptanceDraft.author)?.name ?? "原验收人"}保存` : "旧版草稿，继续处理前需核对当前标准"}</small></div>}
                  {item.acceptance && (
                    <div className="material-card">
                      <b>
                        验收：
                        {
                          {
                            pass: "通过",
                            fail: "不通过",
                            insufficient: "样例不足",
                          }[item.acceptance.result]
                        }
                      </b>
                      <p>{item.acceptance.note}</p>
                      <small>
                        针对标准 V{item.acceptance.version} · 第{" "}
                        {item.acceptance.round} 轮
                      </small>
                    </div>
                  )}
                  {item.terminationReason && (
                    <p className="red">终止原因：{item.terminationReason}</p>
                  )}
                </div>
              )}
              {"conclusionVersion" in item && !("standardVersion" in item) && (
                <div className="requirements">
                  <h3>
                    申诉理由 <Badge>结论 V{item.conclusionVersion}</Badge>
                  </h3>
                  <p>{item.note}</p>
                  {item.sameReviewerReason && (
                    <p>同人核查：{item.sameReviewerReason}</p>
                  )}
                  {item.outcome && (
                    <p>
                      裁定：
                      {
                        {
                          maintain: "维持",
                          false_positive: "改判误报",
                          insufficient: "证据不足",
                          adjust: "调整成立范围",
                        }[item.outcome]
                      }
                    </p>
                  )}
                </div>
              )}
              {"executor" in item && (
                <div className="requirements">
                  <h3>补件要求</h3>
                  <p>{item.note}</p>
                  <p>
                    执行人：{person(item.executor)?.name} · {stamp(item.dueAt)}
                  </p>
                  <p>返回规则：{item.trigger}</p>
                  {item.reply && <p>已提交：{item.reply}</p>}
                </div>
              )}
              {"findingIds" in item && (
                <div className="finding-list">
                  <h3>
                    {item.type === "spotcheck" ? "抽查范围" : "逐项复核"}{" "}
                    <small>{item.scope}</small>
                  </h3>
                  {item.findingIds.length ? (
                    item.findingIds.map((id) => {
                      const f = state.findings.find((f) => f.id === id)!;
                      return (
                        <div key={id}>
                          <b>{f.title}</b>
                          <p>
                            {item.opinions[id]
                              ? `${verdictNames[item.opinions[id].value]} · ${item.opinions[id].note}`
                              : "待填写复核意见"}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <p>
                      {item.scopeResult
                        ? item.scopeResult === "clear"
                          ? "检查范围内未发现问题"
                          : "检查范围内证据不足"
                        : "本次尚未登记问题。核查后可提交“检查范围内未发现问题”；资料不足时申请补证后继续核查。"}
                    </p>
                  )}
                </div>
              )}
              {primary?.reminder && (
                <div className="requirements">
                  <h3>通话中提醒</h3>
                  <p>{primary.reminder.text}</p>
                  <div className="inline-badges">
                    <Badge>已送达</Badge>
                    <Badge
                      tone={primary.reminder.readAt ? "success" : "neutral"}
                    >
                      {primary.reminder.readAt ? "已读" : "未读"}
                    </Badge>
                  </div>
                  {primary.reminder.feedback && (
                    <p>执行反馈：{primary.reminder.feedback}</p>
                  )}
                  {primary.reminder.dissent && (
                    <p>提醒异议：{primary.reminder.dissent}</p>
                  )}
                </div>
              )}
      {supplements.map(sp=><div className="requirements inline-supplement" key={sp.id}><h3>{openSupplement(sp) ? "待补材料" : "补件记录"} <Badge>{stateLabel(sp, state)}</Badge></h3><p>{sp.note}</p><small>执行：{person(sp.executor)?.name} · 期限：{stamp(sp.dueAt)} {openSupplement(sp) ? ` · 下一接收人：${person(currentOwner(state, {...sp, status:"submitted"}))?.name ?? "指定责任人"}` : ""}</small>{sp.reply && <p>补充说明：{sp.reply}</p>}{sp.cancellationReason && <p>结束原因：{sp.cancellationReason} · {stamp(sp.cancelledAt)}</p>}{contextActions(state,sp.id).map(a=><Button primary key={a} onClick={()=>onAction(sp.id,a)}>{actionLabel(state,sp.id,a)}</Button>)}</div>)}
    {"findingIds" in item && item.evidenceRequest && <div className="requirements"><h3>补证申请</h3><p>{item.evidenceRequest.note}</p></div>}
  </div>;
}

function CaseResponsibility({ state, item, now }: { state: State; item: Entity; now: number }) {
  const { owner, badge, readOnly, paused } = responsibilityContext(state, item);
  const warning = "conclusions" in item && item.source === "auto" ? item : undefined;
  const due = activeDeadline(item);
  const warningReview = warning?.status === "review" ? state.reviews.find(r => r.type !== "appeal" && r.findingIds.includes(warning.id) && !["done", "cancelled"].includes(r.status)) : undefined;
  const overdue = !!owner && !paused && !!due && Date.parse(due) <= now;
  return <section className="case-responsibility-card">
    <div className="case-section-title"><h3>{"batches" in item ? "通话状态" : readOnly ? "结果知悉" : "当前责任"}</h3><Badge tone={!owner ? "neutral" : paused || owner.id === state.identity ? "warning" : "neutral"}>{badge}</Badge></div>
    <div className="case-person"><span aria-hidden="true">{owner?.name.slice(-1) ?? "✓"}</span><div><b>{owner?.name ?? ("batches" in item ? item.endedAt ? "通话已结束" : "通话进行中" : "当前无待办")}</b><small>{owner ? roleNames[owner.role] : "结果与记录可继续查看"}</small></div></div>
    {readOnly && <p className="callout">请查看并确认知悉结果，确认知悉不会改变业务结论或启动整改。</p>}
    {"standardVersion" in item && !item.inspector && item.origin === "direct" && <p className="callout">主管待办：指定核验质检员。坐席可先整改、提交资料；指派前无法核验。</p>}
    {due && <dl><div><dt>{warning ? alertDeadlineLabel(warning) : "完成期限"}</dt><dd>{stamp(due)}{owner && <small className={overdue ? "red" : ""}>{paused ? "暂停计时" : deadlineRemaining(due, now)}</small>}</dd></div></dl>}
    {warning?.alertTiming && alertFinished(warning) && <dl><div><dt>预警处置截止</dt><dd>{stamp(warning.alertTiming.resolutionDueAt)}<small>{alertFinished(warning) ? "预警处置已结束" : deadlineRemaining(warning.alertTiming.resolutionDueAt, now)}</small></dd></div></dl>}
    {warningReview && <dl><div><dt>复核完成期限</dt><dd>{stamp(warningReview.dueAt)}</dd></div></dl>}
    {warning && !warning.alertTiming && <dl><div><dt>{alertDeadlineLabel(warning)}</dt><dd>时限未记录</dd></div></dl>}
  </section>;
}

function Evidence({
  state,
  call,
  findings,
  primary,
  pinnedVersion,
  initialSegment,
  evidenceOverride,
  problemDetail = false,
}: {
  state: State;
  call: Call;
  findings: Finding[];
  primary?: Finding;
  pinnedVersion?: number;
  initialSegment?: number;
  evidenceOverride?: number[];
  problemDetail?: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [audioError, setAudioError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0),
    [corrected, setCorrected] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(initialSegment===undefined)return;
    const frame=requestAnimationFrame(()=>{
      transcriptRef.current?.children[initialSegment]?.scrollIntoView({block:"center"});
      if(audio.current && call.transcript[initialSegment])audio.current.currentTime=call.transcript[initialSegment].at;
    });
    return()=>cancelAnimationFrame(frame);
  },[initialSegment,call]);
  const [chosen, setChosen] = useState<string>();
  const [basis,setBasis]=useState(pinnedVersion ? String(pinnedVersion):"latest");
  const f = findings.find((x) => x.id === chosen) ?? primary ?? findings[0];
  const conclusion: Conclusion | undefined = f ? basis === "original" ? undefined : basis === "latest" ? latest(f) : f.conclusions.find(c=>c.version===Number(basis)) : undefined;
  const evidence = evidenceOverride ?? conclusion?.evidence ?? f?.evidence ?? [];
  const rule = f && state.rules.find((x) => x.id === f.ruleId),
    version = rule?.versions.find((v) => v.version === (conclusion?.ruleVersion ?? f?.ruleVersion));
  return (
    <div className="evidence-block">
      <div className="section-title">
        <h3>原音与转写</h3>
        <Badge>{call.endedAt ? "证据已封存" : "通话进行中"}</Badge>
      </div>
      {call.audio ? (
        <AudioPlayer audio={audio} src={call.audio} onTime={setCurrent} onPlaying={setPlaying} onError={()=>{setAudioError(true);setPlaying(false);}}/>
      ) : (
        <div className="audio-missing">
          <Icon name="mic" size={20} />
          <div>
            <b>暂无可用录音</b>
            <small>可先查看通话转写与已关联证据。</small>
          </div>
        </div>
      )}
      {findings.length > 1 && (
        <label className="finding-switch">
          查看问题证据
          <SelectField value={f?.id} onValueChange={value => {setChosen(value);setBasis("latest");}}>
            {findings.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </SelectField>
        </label>
      )}
      {!problemDetail && !!f?.conclusions.length && <label className="finding-switch">判断依据版本<SelectField aria-label="判断依据版本" value={basis} onValueChange={value => setBasis(value)}><option value="latest">当前正式结论</option>{f.conclusions.map(c=><option key={c.version} value={String(c.version)}>结论 V{c.version} · {verdictNames[c.value]}</option>)}<option value="original">原始候选命中</option></SelectField></label>}
      {!problemDetail && conclusion && <div className="result-banner"><b>{verdictNames[conclusion.value]} · V{conclusion.version}</b><p>{conclusion.note}</p>{!conclusion.evidence && <small>旧版记录未保存独立证据，以下显示原始命中供参考。</small>}</div>}
      {f && (
        <div className="evidence-caption">
          <Icon name="spark" size={16} />
          <span>定位片段仅作判断依据，需结合前后文确认。</span>
        </div>
      )}
      {call.corrections?.length && (
        <div className="correction-toggle">
          <Button onClick={() => setCorrected(!corrected)}>
            {corrected ? "查看原始转写" : "查看修订对照"}
          </Button>
          <small>修订独立保留，不覆盖原文</small>
        </div>
      )}
      <div className="transcript" ref={transcriptRef}>
        {call.transcript.map((seg, n) => (
          <div
            key={n}
            className={`utterance ${evidence.includes(n) ? "hit" : ""} ${call.audio && playing && current >= seg.at && current < (call.transcript[n + 1]?.at ?? Infinity) ? "playing" : ""}`}
          >
            <ShadcnButton variant="link" size="sm"
              className="timecode"
              aria-label={`定位到 ${clock(seg.at)}`}
              onClick={() => {
                if (audio.current) {
                  audio.current.currentTime = seg.at;
                  audio.current.play().catch(() => { setAudioError(true); });
                }
              }}
              disabled={!call.audio || audioError}
            >
              {clock(seg.at)}
            </ShadcnButton>
            <span className={`speaker ${seg.speaker}`}>
              {seg.speaker === "agent" ? "坐席" : "客户"}
            </span>
            <p>
              {corrected
                ? (call.corrections?.find((x) => x.segment === n)?.text ??
                  seg.text)
                : seg.text}
              {corrected && call.corrections?.some((x) => x.segment === n) && (
                <small className="correction-original">
                  原文：{seg.text}
                  <br />
                  {call.corrections.find((x) => x.segment === n)?.reason}
                </small>
              )}
            </p>
            {evidence.includes(n) && <span className="hit-label">证据</span>}
          </div>
        ))}
      </div>
      {!problemDetail && rule && version && (
        <section className="basis evidence-basis">
          <h3>
            判断依据 · {rule.id} / V{version.version}
          </h3>
          <p>
            <b>{rule.name}</b> · {rule.description}
          </p>
          <div className="basis-params">
            <span>业务：{version.scope}</span>
            {rule.editable === "threshold" && <span>静默阈值：{version.threshold} 秒</span>}{rule.editable === "trigger" && <span>提醒触发：{version.trigger}</span>}
          </div>
          {Object.entries(version.resources).map(([id, v]) => {
            const r = state.resources.find((r) => r.id === id),
              snapshot = r?.versions.find((x) => x.version === v);
            return (
              <div className="resource-excerpt" key={id}>
                <b>
                  {r?.name} · V{v}
                </b>
                <p>{snapshot?.content}</p>
                <small>例外：{snapshot?.exception}</small>
              </div>
            );
          })}
          <small>
            检测批次 {f?.batchId} · 保留命中时版本，不随当前参数改变
          </small>
        </section>
      )}
      <Disclosure className="basis" title={<>检测批次与执行状态（{call.batches.length}）</>}>
        {call.batches.map((b) => (
          <div className="batch" key={b.id}>
            <b>
              {b.id} · {stamp(b.startedAt)}
            </b>
            <p>
              {b.checks
                .map(
                  (x) =>
                    `${x.name}：${{ pending: "待处理", running: "处理中", success: "执行成功", failed: "执行失败" }[x.state]}`,
                )
                .join(" / ")}
            </p>
            <small>
              固定版本：
              {Object.entries(b.ruleVersions)
                .map(([k, v]) => `${k} V${v}`)
                .join("、")}
            </small>
          </div>
        ))}
      </Disclosure>
    </div>
  );
}
