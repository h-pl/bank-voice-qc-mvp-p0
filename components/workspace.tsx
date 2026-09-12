"use client";
import { useRef, useState } from "react";
import { useDemoClock } from "../lib/store";
import { Badge, Button, Empty } from "./ui";
import { Icon } from "./icon";
import {
  actions,
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
export const stateLabel = (e: Entity) =>
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
  const [tab, setTab] = useState("all"),
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
            ? state.findings.filter((f) => !!latest(f))
            : state.reviews
          : [...state.appeals, ...state.remedies, ...state.supplements]
  ).filter((e) => canSee(state, e.id));
  const tabs =
    view === "alerts"
      ? [
          ["all", "全部候选"],
          ["candidate", "待分诊"],
          ["reminded", "通话中提醒"],
          ["supplement", "待补材料"],
          ["review", "复核中"],
          ["closed", "已关闭"],
        ]
      : view === "improvement"
        ? [
            ["all", "全部事项"],
            ["mine", "我的待办"],
            ["appeal", "申诉"],
            ["remedy", "整改"],
            ["material", "补件"],
          ]
        : view === "workorders"
          ? [
              ["all", role === "agent" ? "已送达结果" : "全部工单"],
              ["mine", "我的待办"],
              ["pending", "待处理"],
              ["supervisor", "待主管"],
              ["done", "已办结"],
            ]
          : [
              ["all", "全部通话"],
              ["live", "通话中"],
              ["failed", "处理异常"],
              ["sample", "授权样例"],
            ];
  const match = (e: Entity, key: string) =>
    key === "all"
      ? true
      : key === "mine"
        ? currentOwner(state, e) === state.identity
        : key === "appeal"
          ? state.appeals.some((x) => x.id === e.id)
          : key === "remedy"
            ? "standardVersion" in e
            : key === "material"
              ? "executor" in e
              : key === "live"
                ? "batches" in e && !e.endedAt
                : key === "failed"
                  ? "batches" in e &&
                    ["部分失败", "失败"].includes(detection(e))
                  : key === "sample"
                    ? "batches" in e && e.sample
                    : "status" in e &&
                      (e.status === key ||
                        (key === "closed" && e.status === "delivered") ||
                        (key === "pending" && e.status === "working"));
  const searched = all.filter((e) => {
    const c = callFor(state, e.id);
    return (
      (!business || c?.business === business) &&
      `${e.id} ${label(e)} ${c ? person(c.agentId)?.name : ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  const filtered = searched.filter((e) => match(e, tab)),
    currentPage = Math.min(
      page,
      Math.max(1, Math.ceil(filtered.length / size)),
    ),
    rows = filtered.slice((currentPage - 1) * size, currentPage * size);
  const selectedId =
    focus && all.some((e) => e.id === focus)
      ? focus
      : selection && filtered.some((e) => e.id === selection)
        ? selection
        : rows[0]?.id;
  const focused =
    focus && canSee(state, focus) ? entity(state, focus) : undefined;
  const selected =
    focused || (selectedId && all.find((x) => x.id === selectedId));
  const overdue = all.filter(
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
  return (
    <>
      <div className="stats-strip">
        <div>
          <span>{view === "calls" ? "可见通话" : "当前范围事项"}</span>
          <strong>
            {all.length}
            <small> 项</small>
          </strong>
        </div>
        <div>
          <span>等待我处理</span>
          <strong>
            {
              all.filter((e) => currentOwner(state, e) === state.identity)
                .length
            }
            <small> 项</small>
          </strong>
        </div>
        <div>
          <span>当前逾期</span>
          <strong className={overdue ? "red" : ""}>
            {overdue}
            <small> 项</small>
          </strong>
        </div>
        <div className="stat-note">
          <Icon name="shield" size={25} />
          <div>
            <b>
              {view === "alerts"
                ? "自动发现，人工确认"
                : view === "improvement"
                  ? "结论有回路，改进有结果"
                  : "每个判断都能回到证据"}
            </b>
            <p>
              {view === "improvement"
                ? "申诉暂停与整改阶段分别保留"
                : "按当前身份呈现授权范围内的记录"}
            </p>
          </div>
        </div>
      </div>
      <div className="panel work-panel">
        <div className="tabs" role="tablist" aria-label="记录分类">
          {tabs.map(([key, name]) => (
            <button
              role="tab"
              aria-selected={tab === key}
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                setPage(1);
                onOpen("");
              }}
            >
              {name}
              <span>{searched.filter((x) => match(x, key)).length}</span>
            </button>
          ))}
        </div>
        <div className="filters">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input
              aria-label="搜索记录"
              placeholder="搜索编号、问题或坐席"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                onOpen("");
              }}
            />
          </div>
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
          <span className="filter-total">共 {filtered.length} 条</span>
          <Button
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
                    "有效期限",
                  ],
                  ...filtered.map((e) => {
                    const c = callFor(state, e.id);
                    return [
                      e.id,
                      c?.id,
                      label(e),
                      c?.business,
                      c ? person(c.agentId)?.name : "",
                      stateLabel(e),
                      person(currentOwner(state, e))?.name ?? "",
                      "dueAt" in e ? e.dueAt : "",
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
        {view === "calls" ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>通话 / 客户</th>
                    <th>业务 / 班组</th>
                    <th>坐席</th>
                    <th>结束时间</th>
                    <th>检测状态</th>
                    <th>候选 / 成立</th>
                    <th />
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
                        className={selectedId === c.id ? "selected" : ""}
                      >
                        <td>
                          <b>{c.id}</b>
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
                          {findings.filter((f) => f.source === "auto").length} /{" "}
                          {
                            findings.filter((f) => latest(f)?.value === "risk")
                              .length
                          }
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => click(c.id)}
                          >
                            查看详情
                          </button>
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
              onPage={setPage}
              onSize={(n) => {
                setSize(n);
                setPage(1);
              }}
            />
            {selected && (
              <div className="call-detail">
                <Detail
                  state={state}
                  item={selected}
                  onOpen={onOpen}
                  onAction={onAction}
                />
              </div>
            )}
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
                            {"severity" in e
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
                          {stateLabel(e)}
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
                {selected ? (
                  <Detail
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
              onPage={setPage}
              onSize={(n) => {
                setSize(n);
                setPage(1);
              }}
            />
          </>
        )}
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
      <span>共 {total} 条</span>
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
    allowed = actions(state, item.id).filter((a) => a !== "sample_calls");
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
            {item.id} <span> / {call?.id}</span>
          </div>
          <h2>{label(item)}</h2>
          <div className="detail-badges">
            <Badge
              tone={
                "status" in item &&
                ["done", "closed", "delivered"].includes(item.status)
                  ? "success"
                  : "warning"
              }
            >
              {stateLabel(item)}
            </Badge>
            {"pause" in item && item.pause && (
              <Badge tone="warning">申诉暂停</Badge>
            )}
            {primary && (
              <span>
                {primary.source === "auto" ? "自动候选" : "人工发现"} ·{" "}
                {primary.indicator}
              </span>
            )}
          </div>
        </div>
        <button
          className="icon-button"
          title="查看通话"
          aria-label="查看关联通话"
          onClick={() => call && onOpen(call.id)}
        >
          <Icon name="headset" />
        </button>
      </header>
      <div className="detail-meta">
        <span>
          坐席 <b>{call && person(call.agentId)?.name}</b>
        </span>
        <span>
          业务 <b>{call?.business}</b>
        </span>
        <span>
          当前责任 <b>{owner?.name ?? "已办结"}</b>
        </span>
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
      <div className="detail-body">
        <div className="evidence-main">
          <div className="subtabs">
            {[
              ["evidence", "通话证据"],
              ["history", "处理记录"],
              ["related", `关联事项 ${related.length}`],
            ].map(([v, l]) => (
              <button
                className={tab === v ? "active" : ""}
                onClick={() => setTab(v)}
                key={v}
              >
                {l}
              </button>
            ))}
          </div>
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
                      <small>{m.samples.join("、") || m.attachment}</small>
                    </div>
                  ))}
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
                  findings={associated}
                  primary={primary}
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
              {associated
                .filter((x) => x.id !== item.id)
                .map((f) => (
                  <button key={f.id} onClick={() => onOpen(f.id)}>
                    <Icon name="shield" />
                    <div>
                      <b>{f.title}</b>
                      <small>
                        {f.id} · {stateLabel(f)}
                      </small>
                    </div>
                    <Icon name="chevron" />
                  </button>
                ))}
              {related.map((r) => (
                <button key={r.id} onClick={() => onOpen(r.id)}>
                  <Icon name="file" />
                  <div>
                    <b>{label(r)}</b>
                    <small>
                      {r.id} · {stateLabel(r)}
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
        <aside className="action-rail">
          <h3>处理此事项</h3>
          <div className="owner-card">
            <span className="avatar">{owner?.name.slice(-1) ?? "✓"}</span>
            <div>
              <b>{owner?.name ?? "已完成当前阶段"}</b>
              <small>{owner ? "当前责任人" : "后续仍可追溯"}</small>
            </div>
          </div>
          {allowed.length ? (
            allowed.map((a, n) => (
              <Button
                key={a}
                primary={
                  n === 0 &&
                  !["end_call", "start_detection", "finish_detection"].includes(
                    a,
                  )
                }
                onClick={() => onAction(item.id, a)}
              >
                {actionNames[a]}
              </Button>
            ))
          ) : (
            <p className="subtle">
              当前身份无需处理此阶段，相关结果与记录可继续查看。
            </p>
          )}
          {call &&
            !call.endedAt &&
            roleOf(state) === "supervisor" &&
            item.id !== call.id && (
              <details className="scenario">
                <summary>原型场景事件</summary>
                <Button onClick={() => onAction(call.id, "end_call")}>
                  模拟通话结束
                </Button>
              </details>
            )}
          {"standardVersion" in item &&
            !["done", "terminated"].includes(item.status) &&
            roleOf(state) === "agent" && (
              <details className="scenario">
                <summary>原型场景事件</summary>
                <Button onClick={() => onAction(item.id, "sample_calls")}>
                  生成整改后样例
                </Button>
              </details>
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
}: {
  state: State;
  call: Call;
  findings: Finding[];
  primary?: Finding;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState(0),
    [corrected, setCorrected] = useState(false);
  const [chosen, setChosen] = useState<string>();
  const f = findings.find((x) => x.id === chosen) ?? primary ?? findings[0];
  const rule = f && state.rules.find((x) => x.id === f.ruleId),
    version = rule?.versions.find((v) => v.version === f?.ruleVersion);
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
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          />
          <small>本地合成演示录音 · 点击下方时间可定位回听</small>
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
          <select value={f?.id} onChange={(e) => setChosen(e.target.value)}>
            {findings.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
      )}
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
            className={`utterance ${f?.evidence.includes(n) ? "hit" : ""} ${call.audio && current >= seg.at && current < (call.transcript[n + 1]?.at ?? Infinity) ? "playing" : ""}`}
          >
            <button
              className="timecode"
              aria-label={`定位到 ${clock(seg.at)}`}
              onClick={() => {
                if (audio.current) {
                  audio.current.currentTime = seg.at;
                  audio.current.play().catch(() => {});
                }
              }}
              disabled={!call.audio}
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
            {f?.evidence.includes(n) && <span className="hit-label">证据</span>}
          </div>
        ))}
      </div>
      {rule && version && (
        <details className="basis" open>
          <summary>
            判断依据 · {rule.id} / V{version.version}
          </summary>
          <p>
            <b>{rule.name}</b> · {rule.description}
          </p>
          <div className="basis-params">
            <span>业务：{version.scope}</span>
            <span>静默阈值：{version.threshold} 秒</span>
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
        </details>
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
