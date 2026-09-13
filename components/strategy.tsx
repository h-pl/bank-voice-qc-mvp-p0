"use client";
import { useState } from "react";
import { Badge, Button, Modal } from "./ui";
import { Icon } from "./icon";
import { officialIndicators } from "../lib/official-indicators";
import { ruleCategories } from "../lib/fixtures";
import {
  actions,
  actionNames,
  roleOf,
  type State,
  type Rule,
  type Resource,
} from "../lib/workflow";
import { stamp } from "./workspace";
export function Strategy({
  state,
  view,
  onAction,
  focus,
}: {
  focus?: string;
  state: State;
  view: "rules" | "resources";
  onAction: (id: string, action: string) => void;
}) {
  const [category, setCategory] = useState("all"),
    [selected, setSelected] = useState<string>(),
    [catalog, setCatalog] = useState(false),
    [version, setVersion] = useState<number>();
  const resources = view === "resources";
  const all = resources ? state.resources : state.rules;
  const list = all.filter(
    (x) =>
      category === "all" || ("type" in x ? x.type : x.indicator) === category,
  );
  const current =
    (focus ? all.find((x) => x.id === focus) : undefined) ??
    list.find((x) => x.id === selected) ??
    list[0];
  const versions = current?.versions ?? [],
    snapshot =
      versions.find((v) => v.version === version) ??
      versions.at(-1) ??
      (current?.draft ? { ...current.draft, version: 0, at: "" } : undefined);
  return (
    <>
      <div className="strategy-summary">
        <div>
          <span className="eyebrow">
            {resources ? "BUSINESS FOUNDATION" : "QUALITY STANDARD"}
          </span>
          <h2>
            {resources
              ? "统一业务依据，保留历史引用"
              : "固定判断结构，明确开放边界"}
          </h2>
          <p>
            {resources
              ? "词库、业务知识、SOP 的维护都在这里。发布新版本后，历史案件仍能回到当时的依据。"
              : "完整 16 项指标由规则、基础能力与运营流程共同承接；规则页呈现其中对应的 10 类。"}
          </p>
        </div>
        <div className="summary-numbers">
          <div>
            <strong>{resources ? 3 : 16}</strong>
            <span>{resources ? "资源类型" : "完整指标"}</span>
          </div>
          <div>
            <strong>
              {resources
                ? state.resources.reduce((n, r) => n + r.versions.length, 0)
                : 10}
            </strong>
            <span>{resources ? "已发布版本" : "规则类别"}</span>
          </div>
        </div>
        {!resources && (
          <Button icon="grid" onClick={() => setCatalog(true)}>
            查看 16 项指标目录
          </Button>
        )}
      </div>
      <div className="strategy-layout">
        <aside className="panel category-nav">
          <h3>{resources ? "业务资源" : "规则分类"}</h3>
          {[
            ["all", resources ? "全部资源" : "全部规则"],
            ...(resources
              ? [
                  ["词库", "词库"],
                  ["业务知识", "业务知识"],
                  ["SOP", "SOP"],
                ]
              : ruleCategories),
          ].map(([id, name]) => (
            <button
              className={category === id ? "active" : ""}
              key={id}
              onClick={() => {
                setCategory(id);
                setVersion(undefined);
              }}
            >
              <span>{name}</span>
              <small>
                {id === "all"
                  ? all.length
                  : all.filter(
                      (x) => ("type" in x ? x.type : x.indicator) === id,
                    ).length}
              </small>
            </button>
          ))}
          <div className="category-note">
            <Icon name="shield" />
            <p>
              {roleOf(state) === "supervisor"
                ? "可维护开放字段；规则结构与模型编排固定。"
                : "当前身份只读，可核对版本与引用关系。"}
            </p>
          </div>
        </aside>
        <div className="strategy-content">
          <div className="panel">
            <div className="panel-title">
              <h3>{resources ? "资源列表" : "规则列表"}</h3>
              <span>共 {list.length} 项</span>{resources && roleOf(state)==="supervisor" && <Button primary onClick={()=>onAction(state.resources[0].id,"create_resource")}>新增资源条目</Button>}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{resources ? "资源名称" : "规则名称 / 主指标"}</th>
                    <th>适用业务</th>
                    <th>版本</th>
                    <th>状态</th>
                    <th>维护范围</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((x) => {
                    const v = x.versions.at(-1) ?? {
                      scope: x.draft?.scope ?? "全部业务",
                      version: 0,
                    };
                    return (
                      <tr
                        key={x.id}
                        className={current?.id === x.id ? "selected" : ""}
                      >
                        <td>
                          <button
                            className="table-link"
                            onClick={() => {
                              setSelected(x.id);
                              setVersion(undefined);
                            }}
                          >
                            {x.name}
                          </button>
                          <small>
                            {x.id}
                            {"indicator" in x
                              ? ` · ${x.indicator}`
                              : ` · ${x.type}`}
                          </small>
                        </td>
                        <td>{v.scope}</td>
                        <td>{v.version ? `V${v.version}` : "尚未发布"}</td>
                        <td>
                          <Badge tone={x.draft ? "warning" : "success"}>
                            {x.draft ? "有未发布草稿" : "已生效"}
                          </Badge>
                        </td>
                        <td>
                          {"indicator" in x
                            ? x.editable
                              ? {
                                  threshold: "静默阈值",
                                  scope: "适用业务",
                                  trigger: "提醒触发",
                                }[x.editable]
                              : "只读"
                            : "单条内容与例外"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {current && snapshot && (
            <div className="panel strategy-detail">
              <div className="panel-title">
                <div>
                  <p className="overline">{current.id}</p>
                  <h2>{current.name}</h2>
                </div>
                <select
                  aria-label="查看历史版本"
                  value={snapshot.version}
                  onChange={(e) => setVersion(Number(e.target.value))}
                >
                  {!versions.length && <option value={0}>未发布草稿</option>}
                  {versions
                    .slice()
                    .reverse()
                    .map((v) => (
                      <option value={v.version} key={v.version}>
                        V{v.version}{" "}
                        {v === versions.at(-1) ? "当前生效" : "历史快照"}
                      </option>
                    ))}
                </select>
              </div>
              <div className="strategy-columns">
                <div>
                  {resources ? (
                    <>
                      <h3>资源内容</h3>
                      <pre className="plain-text">
                        {"content" in snapshot ? snapshot.content : ""}
                      </pre>
                      <div className="property-grid">
                        <div>
                          <span>适用角色</span>
                          <b>{"role" in snapshot ? snapshot.role : ""}</b>
                        </div>
                        <div>
                          <span>适用业务</span>
                          <b>{snapshot.scope}</b>
                        </div>
                      </div>
                      <h3>允许例外</h3>
                      <p>{"exception" in snapshot ? snapshot.exception : ""}</p>
                    </>
                  ) : (
                    <>
                      <h3>判断说明</h3>
                      <p>{(current as Rule).description}</p>
                      <div className="property-grid">
                        <div>
                          <span>严重度</span>
                          <b>
                            {(current as Rule).severity === "high"
                              ? "高风险"
                              : "中风险"}
                          </b>
                        </div>
                        <div>
                          <span>适用业务</span>
                          <b>{snapshot.scope}</b>
                        </div>
                        {(current as Rule).editable === "threshold" && <div>
                          <span>静默阈值</span>
                          <b>
                            {"threshold" in snapshot ? snapshot.threshold : ""}{" "}
                            秒
                          </b>
                        </div>}
                        {(current as Rule).editable === "trigger" && <div>
                          <span>提醒触发</span>
                          <b>{"trigger" in snapshot ? snapshot.trigger : ""}</b>
                        </div>}
                      </div>
                      <h3>引用资源快照</h3>
                      {"resources" in snapshot &&
                        Object.entries(snapshot.resources).map(([id, v]) => (
                          <div className="reference-row" key={id}>
                            <Icon name="database" />
                            <div>
                              <b>
                                {state.resources.find((r) => r.id === id)?.name}
                              </b>
                              <small>
                                {id} · V{v}
                              </small>
                            </div>
                            <Badge>固定引用</Badge>
                          </div>
                        ))}
                      <p className="subtle">
                        证据要求：角色原话、时间片段、前后文与适用例外；由人工确认最终业务判断。
                      </p>
                    </>
                  )}
                </div>
                <aside>
                  <h3>{resources ? "被哪些规则引用" : "维护与发布"}</h3>
                  {resources &&
                    state.rules
                      .filter(
                        (r) =>
                          current.id in r.versions.at(-1)!.resources ||
                          (current as Resource).draftRuleIds?.includes(r.id),
                      )
                      .map((r) => (
                        <p className="reference-pill" key={r.id}>
                          {r.name} · V{r.versions.at(-1)!.version}
                        </p>
                      ))}
                  <small className="muted">
                    该版本更新于 {stamp(snapshot.at)}
                  </small>
                  <div className="strategy-actions">
                    {version && version !== versions.at(-1)?.version ? <><p>历史版本只读</p><Button onClick={()=>setVersion(undefined)}>返回当前版本维护</Button></> : actions(state, current.id).filter(a=>a!=="create_resource").map((a) => (
                      <Button
                        key={a}
                        primary={a.startsWith("save_")}
                        onClick={() => onAction(current.id, a)}
                      >
                        {a === "save_rule" ? "编辑参数" : a === "save_resource" ? "编辑资源" : actionNames[a]}
                      </Button>
                    ))}
                  </div>
                  <p className="subtle">
                    草稿 → 字段校验 → 预设检查 →
                    确认模拟发布。当前页面不连接真实检测模型。
                  </p>
                </aside>
              </div>
              {resources &&
                state.logs.some(
                  (l) =>
                    l.target === current.id && l.action === "提出依据补充意见",
                ) && (
                  <div className="draft-preview">
                    <h3>依据补充意见</h3>
                    {state.logs
                      .filter(
                        (l) =>
                          l.target === current.id &&
                          l.action === "提出依据补充意见",
                      )
                      .map((l) => (
                        <p key={l.id}>
                          {stamp(l.at)} · {l.note}
                        </p>
                      ))}
                  </div>
                )}
              {current.draft && (
                <div className="draft-preview">
                  <div className="section-title">
                    <h3>待发布草稿</h3>
                    <Badge tone={current.checked ? "success" : "warning"}>
                      {current.checked ? "预设检查通过" : "待检查 / 需修正"}
                    </Badge>
                  </div>
                  <table className="diff-table"><thead><tr><th>字段</th><th>当前生效</th><th>待发布</th></tr></thead><tbody>
                    {(resources ? ["content","scope","role","exception"] : [(current as Rule).editable!]).map(key=>{const old=(current.versions.at(-1) ?? {}) as unknown as Record<string,unknown>;const next=current.draft as unknown as Record<string,unknown>;return <tr key={key}><th>{{content:"内容",scope:"业务范围",role:"适用角色",exception:"例外说明",threshold:"静默阈值（秒）",trigger:"提醒触发"}[key]}</th><td>{String(old[key] ?? "—")}</td><td>{String(next[key] ?? "—")}{old[key]===next[key] && <small>（未变化）</small>}</td></tr>;})}
                  </tbody></table>
                  <p>
                    影响范围：仅新启动的示例检测；在途任务与既有结论保持原引用。资源发布同时新增引用它的规则版本。
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {catalog && (
        <Modal
          title="完整 16 项指标与页面分工"
          onClose={() => setCatalog(false)}
        >
          <p className="callout">
            指标完整保留。声纹、语音识别、文本纠错、覆盖率、时效性、数据展示由能力与流程承接，不提供独立规则配置。
          </p>
          <table className="catalog-table">
            <thead>
              <tr>
                <th>编号 / 指标</th>
                <th>P0 承接页面</th>
                <th>规则配置</th>
              </tr>
            </thead>
            <tbody>
              {officialIndicators.map((i) => {
                const rule = ruleCategories.some(([id]) => id === i.id);
                return (
                  <tr key={i.id}>
                    <td>
                      <b>{i.name}</b>
                      <small>{i.id}</small>
                    </td>
                    <td>
                      {rule
                        ? "质检规则、证据与处理流程"
                        : ["6.2.1", "6.2.2", "6.2.4"].includes(i.id)
                          ? "通话证据与能力说明"
                          : "通话台账、质量报表与交互验收"}
                    </td>
                    <td>
                      <Badge tone={rule ? "success" : "neutral"}>
                        {rule ? "10 类之一" : "不单列规则"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="subtle">
            这里展示产品承接关系，不宣称模型效果、覆盖率或时延已通过生产验收。
          </p>
          <div className="modal-actions">
            <Button primary onClick={() => setCatalog(false)}>
              了解
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
