"use client";
import { useState } from "react";
import { useDemoClock } from "../lib/store";
import {
  report,
  reportCsv,
  localDate,
  type ReportFilter,
} from "../lib/reports";
import { people, latest, callFor, type State } from "../lib/workflow";
import { Badge, Button, Empty } from "./ui";
import { download, stamp, Pagination } from "./workspace";
export function ReportPage({
  state,
  onOpen,
}: {
  state: State;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<ReportFilter>(() => ({
    business: "",
    group: "",
    agent: "",
    start: localDate(new Date(Date.now() - 7 * 86400000).toISOString()),
    end: localDate(new Date().toISOString()),
  }));
  const [tab, setTab] = useState("overview"),
    [selected, setSelected] = useState("calls"),
    [page, setPage] = useState(1),
    [size, setSize] = useState(5);
  const asOf = new Date(useDemoClock()).toISOString(),
    metrics = report(state, filter, new Date(asOf));
  const keys =
    tab === "overview"
      ? [
          "calls",
          "completed",
          "partial",
          "failed",
          "running",
          "pending",
          "coverage",
          "riskcalls",
          "candidates",
          "risk",
          "manual",
          "fp",
        ]
      : tab === "issues"
        ? ["candidates", "risk", "manual", "fp", "riskappealing"]
        : tab === "teams"
          ? ["calls", "completed", "riskcalls", "risk"]
          : [
              "appealchange",
              "review-backlog",
              "appeal-backlog",
              "remedy-backlog",
              "review-due",
              "appeal-due",
              "remedy-due",
              "review-overdue",
              "appeal-overdue",
              "remedy-overdue",
              "paused",
              "terminated",
              "ontime",
              "review-ontime",
              "appeal-ontime",
              "extended",
              "everoverdue",
              "sourcechanged",
              "materialpending",
              "remedy-state-pending",
              "remedy-state-executing",
              "remedy-state-verification",
              "remedy-state-supervisor",
              "remedy-state-done",
              "remedy-state-terminated",
            ];
  const cards = metrics.filter((x) => keys.includes(x.key)),
    metric = cards.find((x) => x.key === selected) ?? cards[0];
  const max = Math.max(1, Math.ceil((metric?.rows.length ?? 0) / size)),
    current = Math.min(page, max);
  const invalid = filter.start && filter.end && filter.start > filter.end;
  const set = (key: keyof ReportFilter, value: string) => {
    setFilter((x) => ({ ...x, [key]: value }));
    setPage(1);
  };
  return (
    <>
      <div className="panel report-filters">
        <div className="tabs">
          {[
            ["overview", "质检概览"],
            ["issues", "问题分布"],
            ["teams", "坐席 / 班组"],
            ["improvement", "申诉与整改"],
          ].map(([v, l]) => (
            <button
              className={tab === v ? "active" : ""}
              key={v}
              onClick={() => {
                setTab(v);
                setSelected(v === "improvement" ? "review-backlog" : "calls");
                setPage(1);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="filters">
          <label>
            日期范围
            <input
              aria-label="报表开始日期"
              type="date"
              value={filter.start}
              onChange={(e) => set("start", e.target.value)}
            />
          </label>
          <span>—</span>
          <input
            aria-label="报表结束日期"
            type="date"
            value={filter.end}
            onChange={(e) => set("end", e.target.value)}
          />
          <select
            aria-label="报表业务"
            value={filter.business}
            onChange={(e) => set("business", e.target.value)}
          >
            <option value="">全部业务</option>
            {["账户查询", "信用卡", "转账汇款"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="报表班组"
            value={filter.group}
            onChange={(e) => set("group", e.target.value)}
          >
            <option value="">全部班组</option>
            <option>客服一组</option>
            <option>客服二组</option>
          </select>
          <select
            aria-label="报表坐席"
            value={filter.agent}
            onChange={(e) => set("agent", e.target.value)}
          >
            <option value="">全部坐席</option>
            {people
              .filter((p) => p.role === "agent")
              .map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <div className="report-scope">
          <Badge>口径 P0-1.1</Badge>
          <span>
            {tab === "improvement"
              ? "裁定按裁定日，到期按当前有效期限；积压、暂停与历史逾期是当前快照。"
              : "按通话结束日期归属；当前有效结论用于确认问题统计。"}{" "}
            截至 {stamp(asOf)}
          </span>
        </div>
      </div>
      {invalid ? (
        <p className="form-error">开始日期不能晚于结束日期。</p>
      ) : (
        <>
          {(tab === "overview" ? [
            {title:"所选期间 · 核心结果",keys:["calls","coverage","risk","fp"],collapsed:false},
            {title:"检测状态与更多明细",keys:keys.filter(k=>!["calls","coverage","risk","fp"].includes(k)),collapsed:true}
          ] : tab === "improvement" ? [
            {title:"当前待处理 · 不受日期范围影响",keys:["review-backlog","appeal-backlog","remedy-backlog"],collapsed:false},
            {title:"所选期间结果 · 受日期范围影响",keys:["appealchange","review-ontime","appeal-ontime","ontime"],collapsed:false},
            {title:"当前状态、暂停与历史标记",keys:keys.filter(k=>!k.endsWith("-due") && !["review-backlog","appeal-backlog","remedy-backlog","appealchange","review-ontime","appeal-ontime","ontime","terminated"].includes(k)),collapsed:true},
            {title:"期间到期任务与终止明细",keys:["review-due","appeal-due","remedy-due","terminated"],collapsed:true}
          ] : [{title:"所选期间结果",keys,collapsed:false}]).map(group=>{
            const list=group.keys.flatMap(key=>{const m=cards.find(x=>x.key===key);return m?[m]:[];});
            const content=group.collapsed ? <table className="metric-details"><thead><tr><th>指标</th><th>数量 / 占比</th><th>口径</th></tr></thead><tbody>{list.map(m=><tr key={m.key}><td><button className="text-button" onClick={()=>{setSelected(m.key);setPage(1);}}>{m.label}</button></td><td>{m.value}</td><td>{m.note}</td></tr>)}</tbody></table> : <div className="report-cards">{list.map(m=><button key={m.key} className={`report-card ${metric?.key===m.key ? "selected":""}`} onClick={()=>{setSelected(m.key);setPage(1);}}><span>{m.label}<em>↗</em></span><strong>{m.value}<small>{m.value.includes("%") || m.value === "—" ? "" : m.key==="calls" ? " 通":" 项"}</small></strong><small>{m.note}</small></button>)}</div>;
            return group.collapsed ? <section className="panel report-section report-table-section" key={group.title}><h2>{group.title}</h2><div className="table-scroll">{content}</div></section> : <section className="report-section" key={group.title}><h2>{group.title}</h2>{content}</section>;
          })}
          {tab === "teams" && (
            <div className="panel team-report">
              <div className="panel-title">
                <h3>坐席 / 班组明细</h3>
                <span>按通话结束日，点击坐席下钻</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>坐席 / 班组</th>
                      <th>通话量</th>
                      <th>已判定</th>
                      <th>确认问题</th>
                      <th>误报</th>
                      <th>证据不足</th>
                      <th>整改未完成</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people
                      .filter(
                        (p) =>
                          p.role === "agent" &&
                          (!filter.agent || filter.agent === p.id),
                      )
                      .map((p) => {
                        const ms = report(
                            state,
                            { ...filter, agent: p.id },
                            new Date(asOf),
                          ),
                          ids = new Set(
                            ms
                              .find((m) => m.key === "calls")!
                              .rows.map((r) => r.id),
                          ),
                          fs = state.findings.filter((f) => ids.has(f.callId));
                        return (
                          <tr key={p.id}>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => {
                                  set("agent", p.id);
                                  setSelected("calls");
                                }}
                              >
                                {p.name}
                              </button>
                              <small>
                                {p.id === "A1048" ? "客服一组" : "客服二组"}
                              </small>
                            </td>
                            <td>{ids.size}</td>
                            <td>{fs.filter((f) => !!latest(f)).length}</td>
                            <td>
                              {
                                fs.filter((f) => latest(f)?.value === "risk")
                                  .length
                              }
                            </td>
                            <td>
                              {
                                fs.filter(
                                  (f) => latest(f)?.value === "false_positive",
                                ).length
                              }
                            </td>
                            <td>
                              {
                                fs.filter(
                                  (f) => latest(f)?.value === "insufficient",
                                ).length
                              }
                            </td>
                            <td>
                              {
                                state.remedies.filter(
                                  (r) =>
                                    ids.has(callFor(state, r.id)?.id ?? "") &&
                                    !["done", "terminated"].includes(r.status),
                                ).length
                              }
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "issues" && (
            <div className="panel distribution">
              <h3>当前成立问题 · 主指标分布</h3>
              {state.rules.map((r) => {
                const count =
                  metrics
                    .find((x) => x.key === "risk")
                    ?.rows.filter(
                      (row) =>
                        state.findings.find((f) => f.id === row.id)
                          ?.indicator === r.indicator,
                    ).length ?? 0;
                return (
                  <div key={r.id}>
                    <span>{r.name}</span>
                    <i
                      style={{
                        width: `${count ? Math.max(4, (count / Math.max(1, Number(metrics.find((x) => x.key === "risk")?.value))) * 70) : 0}%`,
                      }}
                    />
                    <b>{count}</b>
                  </div>
                );
              })}
            </div>
          )}
          {metric && (
            <div className="panel report-detail">
              <div className="panel-title">
                <div>
                  <h3>{metric.label} · 计算依据</h3>
                  <p>{metric.note}</p>
                </div>
                <Button
                  icon="download"
                  onClick={() =>
                    download(
                      reportCsv(metric, state, asOf, filter),
                      `${metric.key}-P0-1.1.csv`,
                    )
                  }
                >
                  导出当前明细
                </Button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>对象编号</th>
                      <th>关联通话</th>
                      <th>事项</th>
                      <th>状态 / 结果</th>
                      <th>归属时间</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {metric.rows
                      .slice((current - 1) * size, current * size)
                      .map((r) => (
                        <tr key={r.id}>
                          <td>{r.id}</td>
                          <td>{r.callId}</td>
                          <td>{r.title}</td>
                          <td>
                            {(
                              {
                                risk: "风险成立",
                                false_positive: "误报",
                                insufficient: "证据不足",
                                maintain: "维持",
                                adjust: "调整范围",
                              } as Record<string, string>
                            )[r.status] ?? r.status}
                          </td>
                          <td>{stamp(r.date)}</td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => onOpen(r.id)}
                            >
                              查看事项
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!metric.rows.length && (
                  <Empty
                    text="当前口径下没有记录"
                    hint="零分母显示 —；不以 0% 或 100% 替代未知。"
                  />
                )}
              </div>
              <Pagination
                page={current}
                size={size}
                total={metric.rows.length}
                onPage={setPage}
                onSize={(n) => {
                  setSize(n);
                  setPage(1);
                }}
              />
            </div>
          )}
        </>
      )}
      <p className="subtle report-note">
        报表用于核对原型流程。按时结案只显示数量；暂停标记不与基础状态重复累计，不输出未经约定的按时完成率。
      </p>
    </>
  );
}
