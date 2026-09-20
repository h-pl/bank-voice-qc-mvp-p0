"use client";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Empty, Modal, SearchField } from "./ui";
import { pendingResourceRules } from "../lib/resource-publication";
import { Icon } from "./icon";
import { officialIndicators } from "../lib/official-indicators";
import { ruleCategories } from "../lib/fixtures";
import { actions, roleOf, type State, type Rule, type Resource, type ResourceVersion, type Command } from "../lib/workflow";
import { stamp } from "./workspace";
import { ResourceContent, VersionHistory, versionSummary } from "./policy-content";
import { RuleEditor, parameterNames, parameterHints, allowNavigation } from "./rule-editor";

export function Strategy({ state, view, onAction, onSubmit, onOpen, focus, detailOnly = false }: {
  detailOnly?: boolean; focus?: string; state: State; view: "rules" | "resources";
  onAction: (id: string, action: string) => void;
  onSubmit: (command: Command) => void; onOpen: (id: string) => void;
}) {
  const parameterRef = useRef<HTMLElement>(null);
  const restoreParameterFocus = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState(false);
  const [version, setVersion] = useState<{ id: string; value: number }>();
  const [editing, setEditing] = useState<string>();
  useEffect(() => { if (!editing && restoreParameterFocus.current) { parameterRef.current?.querySelector<HTMLButtonElement>(".policy-section-title button")?.focus({preventScroll:true}); restoreParameterFocus.current = false; } }, [editing]);
  const resources = view === "resources";
  const manager = roleOf(state) === "supervisor";
  const all = resources ? state.resources : state.rules;
  const list = all.filter(x => (category === "all" || ("type" in x ? x.type : x.indicator) === category) && `${x.id} ${x.name}`.toLowerCase().includes(search.toLowerCase()));
  const current = (focus ? all.find(x => x.id === focus) : undefined) ?? list[0];
  useEffect(()=>{if(detailOnly) headingRef.current?.focus({preventScroll:true});},[detailOnly,current?.id]);
  const versions = current?.versions ?? [];
  const snapshot = versions.find(v => version?.id === current?.id && v.version === version?.value) ?? versions.at(-1) ?? (current?.draft ? { ...current.draft, version: 0, at: "" } : undefined);
  const historical = !!snapshot && !!versions.length && snapshot.version !== versions.at(-1)?.version;
  const rule = current && "indicator" in current ? current as Rule : undefined;
  const referencedRules = current ? state.rules.filter(r => current.id in (r.versions.at(-1)?.resources ?? {}) || (current as Resource).draftRuleIds?.includes(r.id)) : [];
  const canEdit = !!rule?.editable && manager && !historical;
  const allowed = current ? actions(state, current.id) : [];
  function choose(id: string) { if (!allowNavigation()) return; setVersion(undefined); setEditing(undefined); onOpen(id); }
  function chooseVersion(value: number) { if (!current || !allowNavigation()) return false; setVersion({ id: current.id, value }); setEditing(undefined); return true; }
  function changeCategory(value: string) { if (!allowNavigation()) return; setCategory(value); setVersion(undefined); setEditing(undefined); onOpen(""); }
  const fields: Array<[string, string]> = resources ? [["content", "内容"], ["scope", "适用业务"], ["role", "适用角色"], ["exception", "例外说明"]] : rule?.editable ? [[rule.editable, parameterNames[rule.editable]]] : [];
  return <>
    <div className={`policy-layout ${resources ? "resource-layout" : "rule-layout"} ${focus ? "has-selection" : ""} ${detailOnly ? "policy-full-detail" : ""}`}>
      {!detailOnly && <aside className="policy-list panel" aria-label={resources ? "资源列表" : "规则列表"}>
        <div className="policy-list-actions">{resources && manager && <Button primary icon="plus" onClick={() => onAction(state.resources[0].id, "create_resource")}>新增资源</Button>}</div>
        <div className="policy-list-filters">
          <SearchField label={resources ? "搜索资源" : "搜索规则"} name="policy-search" placeholder={resources ? "搜索资源名称或编号…" : "搜索规则名称或编号…"} value={search} onValueChange={value => { if (!allowNavigation()) return false; setSearch(value); setEditing(undefined); onOpen(""); }}/>

          <label className="policy-category"><span>{resources ? "资源类型" : "规则类别"}</span><select aria-label={resources ? "资源类型筛选" : "规则类别筛选"} value={category} onChange={e => changeCategory(e.target.value)}><option value="all">{resources ? "全部资源" : "全部规则"}（{all.length}）</option>{(resources ? [["词库", "词库"], ["业务知识", "业务知识"], ["SOP", "SOP"]] : ruleCategories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        </div>
        <div className="policy-items">
          {list.map(x => <button type="button" key={x.id} className={`policy-item ${current?.id === x.id ? "selected" : ""}`} aria-pressed={current?.id === x.id} onClick={() => choose(x.id)}>
            <span className="policy-item-top"><small>{x.id}</small>{x.draft ? <Badge tone="warning">待发布</Badge> : <span className="policy-version">V{x.versions.at(-1)?.version ?? 0}</span>}</span>
            <strong>{x.name}</strong><span className="policy-item-scope">{x.versions.at(-1)?.scope ?? "未发布草稿"}</span><span className="policy-item-bottom">{"indicator" in x ? ruleCategories.find(([id]) => id === x.indicator)?.[1] : x.type}<span>{"indicator" in x ? x.editable ? "可调参数" : "固定规则" : `引用 ${state.rules.filter(r => x.id in (r.versions.at(-1)?.resources ?? {})).length} 条规则`}</span></span>
          </button>)}
          {!list.length ? <Empty text={resources ? "未找到资源" : "未找到规则"} hint="调整关键词或类别后重试。" action={<Button onClick={() => { if (!allowNavigation()) return; setSearch(""); changeCategory("all"); }}>重置筛选</Button>}/> : null}
        </div>
        <p className="policy-list-count" role="status">{search || category !== "all" ? `找到 ${list.length} 项，共 ${all.length} 项` : `共 ${all.length} 项`}<span>{resources ? "版本化管理" : "结构固定 · 参数可配"}</span></p>
      </aside>}
      <section className="policy-detail panel" aria-label={resources ? "资源详情" : "规则详情"}>
        {current && snapshot ? <>
          {detailOnly && <div className="resource-back"><Button icon="arrow" onClick={()=>choose("")}>返回资源列表</Button><span>内容、引用与版本</span></div>}
          <div className="policy-mobile-back"><Button onClick={() => choose("")}>返回{resources ? "资源" : "规则"}列表</Button></div>
          <header className="policy-heading"><div><div className="policy-identity"><span className="policy-mark" aria-hidden="true"><Icon name={resources ? "database" : "sliders"} size={20}/></span><div><p>{current.id}{rule ? ` · 指标 ${rule.indicator}` : ` · ${(current as Resource).type}`}{rule && <button className="policy-info" aria-label="指标说明" title="指标说明" onClick={()=>setCatalog(true)}><Icon name="info" size={16}/></button>}</p><h2 ref={headingRef} tabIndex={-1}>{current.name}</h2></div></div><div className="policy-heading-status"><Badge tone={historical ? "neutral" : snapshot.version ? "success" : "warning"}>{historical ? "历史版本 · 只读" : snapshot.version ? resources ? "最新已发布" : "当前生效" : "尚未发布"}</Badge><span>{snapshot.at ? `更新于 ${stamp(snapshot.at)}` : "先完善内容，再发布"}</span></div></div><label className="policy-version-picker"><span>查看版本</span><select aria-label="查看历史版本" value={snapshot.version} onChange={e => chooseVersion(Number(e.target.value))}>{!versions.length ? <option value={0}>未发布草稿</option> : [...versions].reverse().map(v => <option key={v.version} value={v.version}>V{v.version} {v === versions.at(-1) ? resources ? "最新已发布" : "当前生效" : "历史版本"}</option>)}</select></label></header>
          {!!versions.length && <p className="policy-version-summary">{versionSummary(snapshot as ResourceVersion, versions.find(v => v.version === snapshot.version - 1))}</p>}
          {historical ? <div className="policy-notice"><span>正在查看历史依据。后续修改从当前生效版本开始。</span><Button onClick={() => setVersion(undefined)}>返回当前版本</Button></div> : null}
          <div className={resources ? "resource-sections" : undefined}>
          {rule ? <>
            {rule.editable && <section ref={parameterRef} className={`policy-section parameter-section ${editing === current.id ? "is-editing" : ""}`}>
              <div className="policy-section-title"><h3>可调整参数</h3>{canEdit && editing !== current.id ? <Button primary icon="edit" onClick={() => setEditing(current.id)}>{current.draft ? "修改草稿" : "编辑参数"}</Button> : <span>{historical ? "历史参数" : manager ? rule.editable ? "编辑中" : "固定规则" : "当前身份只读"}</span>}</div>
              {editing === current.id && canEdit ? <RuleEditor key={current.id} rule={rule} onSubmit={onSubmit} onDone={() => {restoreParameterFocus.current=true;setEditing(undefined);}}/> : rule.editable ? <div className="parameter-read"><div><span>{parameterNames[rule.editable]}</span><strong>{String((snapshot as unknown as Record<string, unknown>)[rule.editable])}{rule.editable === "threshold" ? <small> 秒</small> : null}</strong><small className="parameter-limit">{rule.editable === "threshold" ? "允许 3–60 秒 · 整数" : rule.editable === "scope" ? "可选：全部业务 / 账户查询 / 信用卡 / 转账汇款" : "可选：高风险候选 / 所有候选 / 关闭提醒"}</small></div><p>{parameterHints[rule.editable]}</p></div> : <p className="policy-readonly">本规则依据下方资源进行判断，没有独立可调参数。{manager ? "需要调整业务依据时，前往业务资源维护。" : "可核对判断说明及引用版本。"}</p>}
            <p className="parameter-effect">保存为草稿，检查并发布后用于新检测；历史案件保留原版本。</p>
            </section>}
            <section className="policy-section"><div className="policy-section-title"><h3>判定依据</h3><span>固定口径</span></div><p className="policy-description">{rule.description}</p><dl className="policy-facts"><div><dt>风险级别</dt><dd><Badge tone={rule.severity === "high" ? "danger" : "warning"}>{rule.severity === "high" ? "高风险" : "中风险"}</Badge></dd></div>{rule.editable !== "scope" ? <div><dt>适用业务</dt><dd>{snapshot.scope}</dd></div> : null}<div><dt>证据要求</dt><dd>角色原话、时间片段、前后文与适用例外</dd></div></dl>{!rule.editable && <p className="policy-inline-note"><Icon name="shield" size={17}/><span>规则判定口径固定。{manager ? "如需调整业务依据，可维护下方引用资源。" : "可查看引用资源与历史版本。"}</span></p>}</section>
          </> : <section className="policy-section resource-content-section"><div className="policy-section-title"><h3>{(current as Resource).type === "词库" ? "词库条目" : (current as Resource).type === "SOP" ? "流程步骤" : "业务知识"}</h3>{allowed.includes("save_resource") && !historical ? <Button primary icon="edit" onClick={() => onAction(current.id, "save_resource")}>{current.draft ? "修改草稿" : "编辑资源"}</Button> : <span>只读查看</span>}</div><ResourceContent resource={current as Resource} snapshot={snapshot as ResourceVersion}/><dl className="policy-facts resource-boundaries"><div><dt>适用业务</dt><dd>{snapshot.scope}</dd></div><div><dt>适用角色</dt><dd>{"role" in snapshot ? snapshot.role : ""}</dd></div><div><dt>允许例外</dt><dd>{"exception" in snapshot ? snapshot.exception || "无额外例外" : ""}</dd></div></dl></section>}

          {current.draft && !historical && editing !== current.id ? <section className="policy-section policy-draft"><div className="policy-section-title"><h3>待发布草稿</h3><Badge tone={current.checked ? "success" : "warning"}>{current.checked ? "检查通过 · 待发布" : "待检查"}</Badge></div><table className="diff-table"><thead><tr><th>参数 / 内容</th><th>{resources ? "最新发布版本" : "当前生效"}</th><th>草稿</th></tr></thead><tbody>{fields.map(([key, name]) => {const old = current.versions.at(-1) as unknown as Record<string, unknown> | undefined; const next = current.draft as unknown as Record<string, unknown>;return <tr key={key}><th>{name}</th><td>{String(old?.[key] ?? "—")}</td><td>{String(next[key] ?? "—")}{old?.[key] === next[key] ? <small>未变化</small> : null}</td></tr>;})}</tbody></table><div className="policy-publish"><p>{resources ? "发布后不会自动切换规则引用，需另行确认影响范围。" : "仅影响新启动的检测，已产生的案件保留原版本。"}</p>{manager ? <div><Button onClick={() => onAction(current.id, resources ? "discard_resource" : "discard_rule")}>放弃草稿</Button>{current.checked ? <Button onClick={() => onAction(current.id, resources ? "check_resource" : "check_rule")}>重新检查</Button> : null}<Button primary onClick={() => onAction(current.id, `${current.checked ? "publish" : "check"}_${resources ? "resource" : "rule"}`)}>{current.checked ? "发布新版本" : "检查草稿"}</Button></div> : null}</div></section> : null}
          <section className={`policy-section ${resources ? "resource-references" : ""}`}><div className="policy-section-title"><h3>{resources ? "引用与影响" : "引用业务资源"}</h3>{allowed.includes("resource_feedback") && !historical ? <Button onClick={() => onAction(current.id, "resource_feedback")}>补充依据建议</Button> : null}</div>{resources && <p className="resource-impact">{historical ? "以下为当前引用关系，历史案件仍保留当时的资源快照。" : `关联 ${referencedRules.length} 条规则。资源发布与引用切换分开执行，历史案件始终保留旧快照。`}</p>}{resources && !referencedRules.length && <p className="subtle">暂无关联规则，发布前需选择适用规则。</p>}{resources ? referencedRules.map(r => <a key={r.id} className="policy-reference" href={`?view=rules&id=${r.id}`} onClick={e => { if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); if (allowNavigation()) onOpen(r.id); } }}><Icon name="file"/><span><b>{r.name}</b><small>{r.id} · 规则 V{r.versions.at(-1)!.version}{current.id in r.versions.at(-1)!.resources ? ` · 引用资源 V${r.versions.at(-1)!.resources[current.id]}` : " · 草稿待关联"}</small></span><Icon name="chevron" size={16}/></a>) : "resources" in snapshot && Object.entries(snapshot.resources).map(([id, v]) => <div className="policy-reference" key={id}><Icon name="database"/><span><b>{state.resources.find(r => r.id === id)?.name ?? id}</b><small>{id} · 本规则引用 V{v}</small></span><a href={`?view=resources&id=${id}`} onClick={e => {if (!e.metaKey && !e.ctrlKey) {e.preventDefault(); if (allowNavigation()) onOpen(id);}}}>查看资源</a></div>)}</section>
          {resources && !historical && pendingResourceRules(state,current as Resource).length > 0 && <section className="policy-section reference-update"><div className="policy-section-title"><div><h3>待切换的规则引用</h3><p>最新资源 V{snapshot.version} 已发布，下列规则仍使用旧版或尚未关联。</p></div>{allowed.includes("switch_resource") && <Button primary onClick={()=>onAction(current.id,"switch_resource")}>核对并切换引用</Button>}</div>{pendingResourceRules(state,current as Resource).map(r=><p key={r.id}><b>{r.name}</b><span>{r.versions.at(-1)!.resources[current.id] ? `引用 V${r.versions.at(-1)!.resources[current.id]}` : "尚未引用"} → V{snapshot.version}{r.draft ? " · 参数草稿待处理" : ""}</span></p>)}</section>}
          <VersionHistory current={current} selected={snapshot.version} onSelect={value => { if (chooseVersion(value)) { headingRef.current?.scrollIntoView({ block: "start" }); headingRef.current?.focus({ preventScroll: true }); } }}/>
          {resources && state.logs.some(l => l.target === current.id && l.action === "提出依据补充意见") ? <section className="policy-section"><h3>依据补充意见</h3>{state.logs.filter(l => l.target === current.id && l.action === "提出依据补充意见").map(l => <p className="policy-feedback" key={l.id}><small>{stamp(l.at)}</small>{l.note}</p>)}</section> : null}
          </div>
        </> : <Empty text="暂无可查看的内容"/>}
      </section>
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
  </>;
}
