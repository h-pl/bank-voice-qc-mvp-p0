"use client";
import { useRef, useState } from "react";
import { localDate } from "../lib/reports";
import { useDemoClock } from "../lib/store";
import { Badge, Button, Empty, SearchField, Tabs } from "./ui";
import { Icon } from "./icon";
import {
  actions,
  agentWorkItems,
  openSupplement,
  isTodo,
  primaryAction,
  people,
  activeAppeal,
  type Conclusion,
  actionNames,
  canSee,
  canSeeCall,
  callFor,
  currentOwner,
  entity,
  latest,
  person,
  roleOf,
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
export const stateLabel = (e: Entity, s?: State) =>
  s && "conclusions" in e && roleOf(s) === "agent" && e.reminder && !latest(e) ? (e.reminder.feedback ? "已反馈执行" : e.reminder.dissent ? "已提出异议" : e.reminder.readAt ? "提醒已读" : "提醒待阅读") :
  s && s.appeals.some(a => a.id === e.id && a.status === "supplement") ? (s.supplements.some(sp => sp.target === e.id && sp.status === "submitted") ? "待主管接收补证" : "等待坐席补证") :
  s && "findingIds" in e && e.appealId && s.appeals.some(a => a.id === e.appealId && a.status === "supplement") ? (s.supplements.some(sp => sp.target === e.appealId && sp.status === "submitted") ? "等待主管接收补证" : "等待坐席补证") :
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
      : "已生效";
export const viewFor = (s: State, id: string): View => {
  const e = entity(s, id);
  return e && "versions" in e
    ? "indicator" in e
      ? "rules"
      : "resources"
    : e && "batches" in e
      ? "calls"
      : e && "findingIds" in e
        ? "workorders"
        : e && "conclusions" in e
          ? roleOf(s) === "supervisor" &&
            ["candidate", "reminded", "supplement"].includes(e.status)
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
  onOpen,
  onAction,
}: {
  state: State;
  view: View;
  focus?: string;
  onOpen: (id: string) => void;
  onAction: (id: string, action: string) => void;
}) {
  const [tab, setTab] = useState(view === "calls" ? "all" : "mine"),
    [kind,setKind] = useState(""),
    [startDate,setStartDate] = useState(""), [endDate,setEndDate] = useState(""),
    [agent,setAgent] = useState(""), [group,setGroup] = useState(""), [execution,setExecution] = useState(""),
    [search, setSearch] = useState(""),
    [business, setBusiness] = useState(""),
    [page, setPage] = useState(1),
    [size, setSize] = useState(5),
    [selection, setSelection] = useState<string>();
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
            : [...state.reviews,...state.findings.filter(f=>isTodo(state,f) && f.status!=="review" && viewFor(state,f.id)==="workorders")]
          : [...state.appeals, ...state.remedies]
  ).filter((e) => canSee(state, e.id));
  const category = all.filter(e=>view!=="improvement" || !kind || (kind === "appeal" ? state.appeals.some(a=>a.id===e.id) : "standardVersion" in e));
  const tabs = view === "alerts" ? [["mine","待分诊 / 待我跟进"],["all","全部候选"],["review","已转复核"],["closed","已关闭"]]
    : view === "improvement" ? [["mine","需我处理"],["active","进行中"],["done","已结束"],["all","全部"]]
    : view === "workorders" ? role === "agent" ? [["mine","需我处理"],["all","全部事项"],["reminders","通话提醒"],["results","质检结果"]] : [["mine","我的待办"],["active","进行中"],["done","已完成"],["all","全部工单"]]
    : [["all","全部通话"],["live","通话中"],["failed","处理异常"],["sample","授权样例"]];
  const done = (e:Entity) => "status" in e && ["done","cancelled","withdrawn","rejected","terminated","closed","delivered"].includes(e.status);
  const match = (e:Entity,key:string) => key === "all" ? true : key === "reminders" ? "conclusions" in e && !!e.reminder : key === "results" ? "conclusions" in e && !!latest(e) : key === "mine" ? isTodo(state,e) : key === "active" ? !done(e) : key === "done" ? done(e) : key === "live" ? "batches" in e && !e.endedAt : key === "failed" ? "batches" in e && detection(e).includes("失败") : key === "sample" ? "batches" in e && e.sample : "status" in e && (e.status===key || key === "closed" && e.status === "delivered");
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
  const filtered = searched.filter((e) => match(e, tab)).sort((a,b)=>{
    const rank=(e:Entity)=> isTodo(state,e) ? ("dueAt" in e && Date.parse(e.dueAt)<now ? 0 : "severity" in e && e.severity==="high" ? 1 : 2) : 3;
    return rank(a)-rank(b) || ("dueAt" in a && "dueAt" in b ? Date.parse(a.dueAt)-Date.parse(b.dueAt) : 0);
  }),
    currentPage = Math.min(
      page,
      Math.max(1, Math.ceil(filtered.length / size)),
    ),
    rows = filtered.slice((currentPage - 1) * size, currentPage * size);
  const selectedId =
    focus && all.some((e) => e.id === focus)
      ? focus
      : selection && rows.some((e) => e.id === selection)
        ? selection
        : rows[0]?.id;
  const focused =
    focus && canSee(state, focus) ? entity(state, focus) : undefined;
  const selected =
    focused || (selectedId && all.find((x) => x.id === selectedId));
  const overdue = filtered.filter(
    (e) =>
      "dueAt" in e &&
      Date.parse(e.dueAt) < now &&
      currentOwner(state, e) &&
      !("pause" in e && e.pause),
  ).length;
  const click = (id: string) => {
    setSelection(id);
    onOpen(id);
  };
  if (view === "calls" && focused && "batches" in focused) {
    const index = filtered.findIndex(x => x.id === focused.id);
    return <section className="panel call-focus" aria-label="通话详情">
      <div className="detail-navigation"><Button onClick={() => onOpen("")}>返回通话列表</Button><span>筛选条件和第 {currentPage} 页已保留</span><div><Button disabled={index <= 0} onClick={() => click(filtered[index - 1].id)}>上一通</Button><Button disabled={index < 0 || index >= filtered.length - 1} onClick={() => click(filtered[index + 1].id)}>下一通</Button></div></div>
      <Detail key={focused.id} state={state} item={focused} onOpen={onOpen} onAction={onAction}/>
    </section>;
  }
  return (
    <>
      <div className={`panel work-panel ${focus ? "has-focus" : ""}`}>
        <Tabs value={tab} label="记录分类" panelId={`workspace-${view}`} options={tabs.map(([value,label]) => ({value,label,count:searched.filter(x => match(x,value)).length}))} onChange={value => { setTab(value); setPage(1); onOpen(""); }}/>
        <div role="tabpanel" id={`workspace-${view}`} aria-labelledby={`workspace-${view}-tab-${tab}`}>
        <div className="filters">
          {view === "improvement" && <select aria-label="事项类型" value={kind} onChange={e=>{setKind(e.target.value);setPage(1);onOpen("");}}><option value="">全部类型</option><option value="appeal">申诉</option><option value="remedy">整改</option></select>}
          <SearchField label="搜索记录" name="record-search" placeholder="搜索编号、问题或坐席…" value={search} onValueChange={value => { setSearch(value); setPage(1); onOpen(""); }}/>
          <select
            aria-label="业务筛选"
            value={business}
            onChange={(e) => {
              setBusiness(e.target.value);
              setPage(1);
              onOpen("");
            }}
          >
            <option value="">全部业务</option>
            {["账户查询", "信用卡", "转账汇款"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          {view === "calls" && <>
            <label>开始日期<input aria-label="通话开始日期" type="date" aria-invalid={invalidDates} aria-describedby={invalidDates ? "call-date-error" : undefined} value={startDate} onChange={e=>{setStartDate(e.target.value);setPage(1);onOpen("");}}/></label>
            <label>结束日期<input aria-label="通话结束日期" type="date" aria-invalid={invalidDates} aria-describedby={invalidDates ? "call-date-error" : undefined} value={endDate} onChange={e=>{setEndDate(e.target.value);setPage(1);onOpen("");}}/></label>
            <select aria-label="通话坐席" value={agent} onChange={e=>{setAgent(e.target.value);setPage(1);onOpen("");}}><option value="">全部坐席</option>{people.filter(p=>p.role==="agent" && (role!=="agent" || p.id===state.identity)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <div className="additional-filters"><select aria-label="通话班组" value={group} onChange={e=>{setGroup(e.target.value);setPage(1);onOpen("");}}><option value="">全部班组</option>{[...new Set(state.calls.filter(c=>canSeeCall(state,c)).map(c=>c.group))].map(g=><option key={g}>{g}</option>)}</select><select aria-label="检测状态" value={execution} onChange={e=>{setExecution(e.target.value);setPage(1);onOpen("");}}><option value="">全部检测状态</option>{["待处理","处理中","已完成","部分失败","失败"].map(x=><option key={x}>{x}</option>)}</select></div>
          </>}
          <div className="filter-actions">
          {view !== "calls" && <span className={`queue-overdue ${overdue ? "has-overdue" : ""}`}>当前结果逾期 <b>{overdue}</b></span>}
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
                  ],
                  ...filtered.map((e) => {
                    const c = callFor(state, e.id);
                    return [
                      e.id,
                      c?.id,
                      label(e),
                      c?.business,
                      c ? person(c.agentId)?.name : "",
                      stateLabel(e, state),
                      person(currentOwner(state, e))?.name ?? "",
                      "dueAt" in e ? stamp(e.dueAt) : "",
                      e.deadlineChanges?.map(h=>`${stamp(h.at)} ${stamp(h.from)} → ${stamp(h.to)} ${h.reason}`).join("；") ?? "",
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
        {invalidDates ? <p className="filter-error" id="call-date-error" role="alert">开始日期不能晚于结束日期，请调整日期范围。<button className="text-button" onClick={() => { setStartDate(endDate); setEndDate(startDate); }}>交换日期</button></p> : null}
        {view === "calls" ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>通话 / 客户</th>
                    <th>业务 / 班组</th>
                    <th>坐席</th>
                    <th>通话时间 / 时长</th>
                    <th>检测状态</th>
                    <th>质检结果</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const c = e as Call,
                      findings = state.findings.filter(
                        (f) => f.callId === c.id && canSee(state, f.id),
                      );
                    return (
                      <tr
                        key={c.id}
                      >
                        <td>
                          <a className="record-link" href={`?view=calls&id=${c.id}`} onClick={e => { if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); click(c.id); } }}>{c.id}</a>
                          <small>{c.customer}</small>
                        </td>
                        <td>
                          {c.business}
                          <small>{c.group}</small>
                        </td>
                        <td>{person(c.agentId)?.name}</td>
                        <td>
                          {c.endedAt ? (
                            stamp(c.endedAt)
                          ) : (
                            <Badge tone="success">通话中</Badge>
                          )}
                          <small>{clock(c.duration)}</small>
                        </td>
                        <td>
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
                        </td>
                        <td>
                          <span className="result-counts">候选 {findings.filter((f) => f.source === "auto").length}<small>已确认成立 {findings.filter((f) => latest(f)?.value === "risk").length}</small></span>
                        </td>
                        <td>
                          <a className="table-detail-link" href={`?view=calls&id=${c.id}`} onClick={e => { if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); click(c.id); } }}>查看详情<Icon name="chevron" size={14}/></a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
          </>
        ) : (
          <>
            <div className="work-layout">
              <section className="queue" aria-label="事项队列">
                {rows.length ? (
                  rows.map((e) => {
                    const c = callFor(state, e.id);
                    return (
                      <button
                        key={e.id}
                        aria-pressed={selectedId === e.id}
                        className={`queue-card ${selectedId === e.id ? "selected" : ""}`}
                        onClick={() => click(e.id)}
                      >
                        <div className="queue-top">
                          <span>{e.id}</span>
                          <Badge
                            tone={
                              "severity" in e && e.severity === "high"
                                ? "danger"
                                : "neutral"
                            }
                          >
                            {role === "agent" && "conclusions" in e ? (latest(e) ? "质检结果" : "通话提醒") : "severity" in e
                              ? e.severity === "high"
                                ? "高风险"
                                : "待关注"
                              : "standardVersion" in e
                                ? "整改"
                                : "findingIds" in e
                                  ? e.type === "appeal"
                                    ? "申诉核查"
                                    : e.type === "spotcheck"
                                      ? "人工抽查"
                                      : "候选复核"
                                  : "executor" in e
                                    ? "补件"
                                    : "申诉"}
                          </Badge>
                        </div>
                        <b>{label(e)}</b>
                        <p>
                          {c && person(c.agentId)?.name} · {c?.business}
                        </p>
                        <div className="queue-bottom">
                          <span className="status-dot" />
                          {stateLabel(e, state)}
                          {"pause" in e && e.pause && <em>申诉暂停</em>}
                          <span className="queue-time">
                            {"dueAt" in e
                              ? stamp(e.dueAt)
                              : stamp(c?.startedAt)}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <Empty
                    text="当前队列为空"
                    hint="可以切换其他分类，或调整筛选条件。"
                  />
                )}
              </section>
              <section className="detail">
                <div className="case-mobile-back"><Button onClick={() => onOpen("")}>返回事项列表</Button></div>
                {selected ? (
                  <Detail
                    key={selected.id}
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
          </>
        )}
        </div>
      </div>
    </>
  );
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
      <select
        aria-label="每页条数"
        value={size}
        onChange={(e) => onSize(Number(e.target.value))}
      >
        {[5, 10, 20].map((n) => (
          <option key={n} value={n}>
            {n} 条 / 页
          </option>
        ))}
      </select>
      <div />
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="上一页"
      >
        ‹
      </button>
      <b>{page}</b>
      <span>/ {max}</span>
      <button
        disabled={page >= max}
        onClick={() => onPage(page + 1)}
        aria-label="下一页"
      >
        ›
      </button>
    </div>
  );
}
export function Detail({
  state,
  item,
  onOpen,
  onAction,
}: {
  state: State;
  item: Entity;
  onOpen: (id: string) => void;
  onAction: (id: string, action: string) => void;
}) {
  const [tab, setTab] = useState("evidence");
  const call = callFor(state, item.id),
    allowed = actions(state, item.id).filter((a) => !["sample_calls","accept_appeal","save_review","save_acceptance"].includes(a));
  const mainAction = primaryAction(state,item.id);
  const supplements = state.supplements.filter(sp=>sp.target===item.id && canSee(state,sp.id));
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
          : associated[0];
  const related = call
    ? [
        ...state.reviews,
        ...state.appeals,
        ...state.remedies,
        ...state.supplements,
      ].filter(
        (x) =>
          callFor(state, x.id)?.id === call.id &&
          x.id !== item.id &&
          canSee(state, x.id),
      )
    : [];
  const logs = state.logs
    .filter(
      (l) =>
        l.target === item.id ||
        (call && l.callId === call.id && canSee(state, l.target)),
    )
    .slice()
    .reverse();
  return (
    <>
      <header className="detail-heading">
        <div>
          <div className="overline">
            {item.id}{call && call.id !== item.id ? <span> / {call.id}</span> : null}
          </div>
          <h2>{label(item)}</h2>
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
            {"pause" in item && item.pause && (
              <Badge tone="warning">申诉暂停</Badge>
            )}
            {primary && !("batches" in item) && (
              <span>
                {primary.source === "auto" ? "自动候选" : "人工发现"} ·{" "}
                {primary.indicator}
              </span>
            )}
          </div>
        </div>
        {!("batches" in item) && <button
          className="icon-button"
          title="查看通话"
          aria-label="查看关联通话"
          onClick={() => call && onOpen(call.id)}
        >
          <Icon name="headset" />
        </button>}
      </header>
      <div className="detail-meta">
        <span>
          坐席 <b>{call && person(call.agentId)?.name}</b>
        </span>
        <span>
          业务 <b>{call?.business}</b>
        </span>
        {"batches" in item ? <><span>通话状态 <b>{item.endedAt ? "已结束" : "通话中"}</b></span><span>时长 <b>{clock(item.duration)}</b></span><span>班组 <b>{item.group}</b></span></> : null}
        {"dueAt" in item && (
          <span>
            期限 <b>{stamp(item.dueAt)}</b>
          </span>
        )}
      </div>
      {"conclusions" in item && latest(item) && (
        <div className="result-banner">
          <Icon name="shield" />
          <div>
            <b>
              {verdictNames[latest(item)!.value]}{" "}
              <span>第 {latest(item)!.version} 版</span>
            </b>
            <p>{latest(item)!.note}</p>
            {latest(item)!.noRemedy && (
              <p>无需整改：{latest(item)!.noRemedy}</p>
            )}
          </div>
        </div>
      )}
      {"pause" in item && item.pause && (
        <div className="callout">
          整改暂停于 {stamp(item.pause.startedAt)}，保留原阶段“
          {statusNames[item.pause.phase]}
          ”。允许补充材料，验收通过与结案暂不可用。
          {item.pause.wasOverdue ? "暂停前已逾期，历史标记保留。" : ""}
        </div>
      )}
      {"findingIds" in item && item.evidenceRequest && <div className="callout"><b>补证申请 · 待主管协调</b><p>{item.evidenceRequest.note}</p></div>}
      {primary && activeAppeal(state,primary.id) && activeAppeal(state,primary.id)!.id !== item.id && <div className="case-links"><span>本问题申诉处理中，新证据回当前申诉。</span><Button onClick={()=>onOpen(activeAppeal(state,primary.id)!.id)}>查看当前申诉</Button></div>}
      <div className="case-links"><span>本问题关联</span>{related.filter(r=>!("executor" in r) && ("findingId" in r ? r.findingId===primary?.id : "findingIds" in r && r.findingIds.includes(primary?.id??""))).map(r=><Button key={r.id} onClick={()=>onOpen(r.id)}>{"standardVersion" in r ? "整改" : "findingIds" in r ? "复核" : "申诉"} · {stateLabel(r, state)}</Button>)}</div>
      {supplements.map(sp=><div className="requirements inline-supplement" key={sp.id}><h3>{openSupplement(sp) ? "待补材料" : "补件记录"} <Badge>{stateLabel(sp, state)}</Badge></h3><p>{sp.note}</p><small>执行：{person(sp.executor)?.name} · 期限：{stamp(sp.dueAt)} {openSupplement(sp) ? ` · 下一接收人：${"standardVersion" in item ? person(item.inspector)?.name : "主管"}` : ""}</small>{sp.reply && <p>补充说明：{sp.reply}</p>}{sp.cancellationReason && <p>结束原因：{sp.cancellationReason} · {stamp(sp.cancelledAt)}</p>}{actions(state,sp.id).map(a=><Button primary key={a} onClick={()=>onAction(sp.id,a)}>{actionNames[a]}</Button>)}</div>)}
      <div className="detail-body">
        <div className="evidence-main">
          <Tabs value={tab} label="事项详情" className="subtabs" panelId={`detail-${item.id}`} options={[{value:"evidence",label:"通话证据"},{value:"history",label:"处理记录"},{value:"related",label:`关联事项 ${related.length}`}]} onChange={setTab}/>
          <div role="tabpanel" id={`detail-${item.id}`} aria-labelledby={`detail-${item.id}-tab-${tab}`}>
          {tab === "evidence" && (
            <>
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
                  {item.rounds?.map(round=><details key={round.round} className="round-history"><summary>第 {round.round} 轮材料与验收 · 标准 V{round.standardVersion}</summary><p>目标：{round.goal}；标准：{round.standard}；要求：{round.sampleCount} 通 / {round.observation}</p>{round.materials.map((m,n)=><div key={n}><p>{m.text}</p>{m.samples.map(id=><Button key={id} onClick={()=>onOpen(id)}>查看样例 {id}</Button>)}{m.attachment && <p>{m.attachment}</p>}</div>)}<p>验收：{round.acceptance?.result === "fail" ? "不通过" : round.acceptance?.result === "pass" ? "通过" : "材料不足"} · {round.acceptance?.note}</p></details>)}
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
                        : "本次尚未登记问题，可提交“检查范围内未发现问题”或证据不足。"}
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
              {call && (
                <Evidence
                  state={state}
                  call={call}
                  key={item.id}
                  findings={"batches" in item || "findingIds" in item ? associated : primary ? [primary] : []}
                  primary={primary}
                  pinnedVersion={"conclusionVersion" in item ? item.conclusionVersion : undefined}
                />
              )}
            </>
          )}
          {tab === "history" && (
            <div className="timeline">
              {logs.length ? (
                logs.map((l) => (
                  <article key={l.id}>
                    <span />
                    <div>
                      <b>{l.action}</b>
                      <small>
                        {person(l.actor)?.name} · {stamp(l.at)}
                      </small>
                      <p>{l.note}</p>
                    </div>
                  </article>
                ))
              ) : (
                <Empty
                  text="暂无本轮操作记录"
                  hint="该示例从当前阶段开始，后续操作会按时间追加。"
                />
              )}
              {item.deadlineChanges?.map((h,n)=><article key={`deadline${n}`}><span/><div><b>期限调整（北京时间）</b><p>{stamp(h.from)} → {stamp(h.to)}</p><small>{stamp(h.at)} · {h.reason}</small></div></article>)}
              {primary?.conclusions.map((c) => (
                <article key={`v${c.version}`}>
                  <span />
                  <div>
                    <b>
                      结论 V{c.version} · {verdictNames[c.value]}
                    </b>
                    <small>{stamp(c.at)}</small>
                    <p>{c.note}</p>
                  </div>
                </article>
              ))}
              {"standardVersion" in item &&
                item.standards.map((v) => (
                  <article key={`std${v.version}`}>
                    <span />
                    <div>
                      <b>完成标准 V{v.version}</b>
                      <p>{v.standard}</p>
                      <small>{v.note}</small>
                    </div>
                  </article>
                ))}
              {"standardVersion" in item &&
                item.pauseHistory.map((p, n) => (
                  <article key={`pause${n}`}>
                    <span />
                    <div>
                      <b>暂停恢复 · 顺延 {Math.round(p.duration / 1000)} 秒</b>
                      <small>
                        {stamp(p.start)} → {stamp(p.end)}
                      </small>
                    </div>
                  </article>
                ))}
            </div>
          )}
          {tab === "related" && (
            <div className="related-list">
              <h3>同通话其他问题</h3>
              {associated
                .filter((x) => x.id !== item.id && x.id !== primary?.id)
                .map((f) => (
                  <button key={f.id} onClick={() => onOpen(f.id)}>
                    <Icon name="shield" />
                    <div>
                      <b>{f.title}</b>
                      <small>
                        {f.id} · {stateLabel(f, state)}
                      </small>
                    </div>
                    <Icon name="chevron" />
                  </button>
                ))}
              <h3>关联处理记录</h3>
              {related.map((r) => (
                <button key={r.id} onClick={() => onOpen(r.id)}>
                  <Icon name="file" />
                  <div>
                    <b>{label(r)}</b>
                    <small>
                      {r.id} · {stateLabel(r, state)}
                    </small>
                  </div>
                  <Icon name="chevron" />
                </button>
              ))}
              {!related.length && !associated.length && (
                <Empty text="暂无关联事项" />
              )}
            </div>
          )}
          </div>
        </div>
        <aside className="action-rail">
          <h3>{"batches" in item ? "通话操作" : "处理"}</h3>
          {!("batches" in item) && <div className="case-owner"><span>当前处理人</span><b>{owner?.name ?? "当前无待办"}</b></div>}
          {allowed.length || actions(state,item.id).includes("save_acceptance") ? (
            <>
            {[...allowed.filter(a => a === mainAction), ...allowed.filter(a => a !== mainAction)].map(a => (
              <Button key={a} primary={a === mainAction} onClick={() => onAction(item.id, a)}>{a === "verify" ? "验收处理" : actionNames[a]}</Button>
            ))}
            {actions(state,item.id).includes("save_review") && !allowed.includes("submit_review") && <Button onClick={()=>onAction(item.id,"save_review")}>编辑复核草稿</Button>}
            {actions(state,item.id).includes("save_acceptance") && !allowed.includes("verify") && <Button onClick={()=>onAction(item.id,"save_acceptance")}>继续验收草稿</Button>}
            {!mainAction && !("batches" in item) && <p className="subtle">当前等待{owner?.name ?? "后续处理"}，无需重复提交。</p>}
            </>
          ) : (
            <p className="subtle">
              当前身份无需处理此阶段，相关结果与记录可继续查看。
            </p>
          )}
          {call &&
            !call.endedAt &&
            roleOf(state) === "supervisor" &&
            item.id !== call.id && (
              <div className="scenario">
                <p className="scenario-label">演示辅助</p>
                <Button onClick={() => onAction(call.id, "end_call")}>
                  模拟通话结束
                </Button>
              </div>
            )}
          {"standardVersion" in item &&
            !["done", "terminated"].includes(item.status) &&
            roleOf(state) === "agent" && (
              <div className="scenario">
                <p className="scenario-label">演示辅助</p>
                <Button onClick={() => onAction(item.id, "sample_calls")}>
                  生成整改后样例
                </Button>
              </div>
            )}
          <div className="rail-note">
            <Icon name="file" size={16} />
            <p>操作将同步更新相关队列、待办和质量报表，刷新后保留进度。</p>
          </div>
          {"firstOverdueAt" in item && item.firstOverdueAt && (
            <p className="red">首次逾期：{stamp(item.firstOverdueAt)}</p>
          )}
        </aside>
      </div>
    </>
  );
}
function Evidence({
  state,
  call,
  findings,
  primary,
  pinnedVersion,
}: {
  state: State;
  call: Call;
  findings: Finding[];
  primary?: Finding;
  pinnedVersion?: number;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [audioError, setAudioError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0),
    [corrected, setCorrected] = useState(false);
  const [chosen, setChosen] = useState<string>();
  const [basis,setBasis]=useState(pinnedVersion ? String(pinnedVersion):"latest");
  const f = findings.find((x) => x.id === chosen) ?? primary ?? findings[0];
  const conclusion: Conclusion | undefined = f ? basis === "original" ? undefined : basis === "latest" ? latest(f) : f.conclusions.find(c=>c.version===Number(basis)) : undefined;
  const evidence = conclusion?.evidence ?? f?.evidence ?? [];
  const rule = f && state.rules.find((x) => x.id === f.ruleId),
    version = rule?.versions.find((v) => v.version === (conclusion?.ruleVersion ?? f?.ruleVersion));
  return (
    <div className="evidence-block">
      <div className="section-title">
        <h3>原音与转写</h3>
        <Badge>{call.endedAt ? "证据已封存" : "通话进行中"}</Badge>
      </div>
      {call.audio ? (
        <div className="audio-player">
          <audio
            ref={audio}
            src={call.audio}
            controls
            preload="metadata"
            aria-label="通话原音"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => { setAudioError(true); setPlaying(false); }}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          />
          <small>本地合成演示录音 · 点击时间定位回听</small>{audioError && <div className="audio-error" role="alert"><span>录音暂时无法播放，可先查看转写。</span><Button onClick={() => { setAudioError(false); audio.current?.load(); }}>重新加载</Button></div>}
        </div>
      ) : (
        <div className="audio-missing">
          <Icon name="mic" size={20} />
          <div>
            <b>本示例未附录音</b>
            <small>可阅读预设转写；CALL-1041 提供可回听的合成录音。</small>
          </div>
        </div>
      )}
      {findings.length > 1 && (
        <label className="finding-switch">
          查看问题证据
          <select value={f?.id} onChange={(e) => {setChosen(e.target.value);setBasis("latest");}}>
            {findings.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {!!f?.conclusions.length && <label className="finding-switch">判断依据版本<select aria-label="判断依据版本" value={basis} onChange={e=>setBasis(e.target.value)}><option value="latest">当前正式结论</option>{f.conclusions.map(c=><option key={c.version} value={String(c.version)}>结论 V{c.version} · {verdictNames[c.value]}</option>)}<option value="original">原始候选命中</option></select></label>}
      {conclusion && <div className="result-banner"><b>{verdictNames[conclusion.value]} · V{conclusion.version}</b><p>{conclusion.note}</p>{!conclusion.evidence && <small>旧版记录未保存独立证据，以下显示原始命中供参考。</small>}</div>}
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
          <small>示例修订独立保留，不覆盖原文</small>
        </div>
      )}
      <div className="transcript">
        {call.transcript.map((seg, n) => (
          <div
            key={n}
            className={`utterance ${evidence.includes(n) ? "hit" : ""} ${call.audio && playing && current >= seg.at && current < (call.transcript[n + 1]?.at ?? Infinity) ? "playing" : ""}`}
          >
            <button
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
            </button>
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
      {rule && version && (
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
      <details className="basis">
        <summary>检测批次与执行状态（{call.batches.length}）</summary>
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
      </details>
    </div>
  );
}
