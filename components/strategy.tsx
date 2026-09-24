"use client";
import { PolicyFieldGuide } from "./policy-field-guide";
import { PolicyParameters } from "./policy-parameters";
import { PolicyRuleReferences } from "./policy-rule-references";
import { IndicatorBindingEditor } from "./indicator-binding-editor";
import { RuleCardContent } from "./binding-read";
import { ResourceDialog } from "./rule-resource-dialog";
import { IndicatorDetail } from "./indicator-detail";
import { SurfaceButton } from "./ui/button";
import { SelectField } from "./select-field";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Tabs, DetailNavigation, Empty, SearchField, Modal } from "./ui";
import { Icon } from "./icon";
import { ConfigurationEditor, ConfigurationRead, IndicatorMatrix } from "./indicator-config";
import { indicatorRuleCategories, indicatorName, indicatorConfigurationCategories, indicatorConfigurationCategory, resourceSchemas } from "../lib/strategy-schema";
import { actions, roleOf, type State, type Rule, type Resource, type ResourceVersion, type RuleVersion, type Command } from "../lib/workflow";
import { stamp } from "./workspace";
import { ResourceContent } from "./policy-content";
import { RuleEditor, parameterNames, parameterHints, allowNavigation } from "./rule-editor";

export function Strategy({ state, view, onAction, onSubmit, onOpen, focus, detailOnly = false, embedded = false }: {
  detailOnly?: boolean; embedded?: boolean; focus?: string; state: State; view: "rules" | "resources";
  onAction: (id: string, action: string) => void;
  onSubmit: (command: Command) => void; onOpen: (id: string) => void;
}) {
  const parameterRef = useRef<HTMLElement>(null);
  const restoreParameterFocus = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const [selectedMode, setMode] = useState("rules");
  const focusedRule = focus ? state.rules.find(r => r.id === focus) : undefined;
  const mode = focusedRule ? focusedRule.indicator === "6.3.4" ? "alerts" : "rules" : selectedMode;
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState(false);
  const [creatingPolicy,setCreatingPolicy]=useState<string[] | undefined>();
  const policyAnchor=state.rules.find(r=>r.indicator==="6.3.4" && !r.retired);
  const [resourceDialog,setResourceDialog]=useState<{id:string;edit:boolean}>();
  const scrollPositions=useRef<Record<string,number>>({});
  const [editing, setEditing] = useState<string>();
  const [viewingPolicy,setViewingPolicy]=useState(false);
  const policyTrigger=useRef<HTMLElement | null>(null);
  const createPolicyTrigger=useRef<HTMLElement | null>(null);
  useEffect(() => { if (!editing && restoreParameterFocus.current) { policyTrigger.current?.focus({preventScroll:true}); restoreParameterFocus.current = false; } }, [editing]);
  const resources = view === "resources";
  const manager = roleOf(state) === "supervisor";
  const all = resources ? state.resources.filter(resource=>!resource.deletedAt) : state.rules.filter(rule=>mode==="alerts" ? rule.indicator==="6.3.4" && !rule.retired : indicatorRuleCategories.some(([id])=>id===rule.indicator)).sort((a,b)=>indicatorRuleCategories.findIndex(([id])=>id===a.indicator)-indicatorRuleCategories.findIndex(([id])=>id===b.indicator));
  const list = all.filter(x => (category === "all" || ("type" in x ? x.type : mode==="alerts"?(x.versions.at(-1)?.config?.level ?? x.draft?.config?.level):indicatorConfigurationCategory(x.indicator)) === category) && `${x.id} ${x.name} ${"indicator" in x ? indicatorName(x.indicator) : ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const current = (focus ? all.find(x => x.id === focus) ?? (!resources ? state.rules.find(r=>r.id===focus && r.retired) : undefined) : list[0]);
  useEffect(()=>{const element=detailRef.current,id=current?.id,positions=scrollPositions.current;if(!element || !id)return;element.scrollTo({top:positions[id] ?? 0});if(detailOnly)headingRef.current?.focus({preventScroll:true});return()=>{positions[id]=element.scrollTop;};},[detailOnly,current?.id]);
  const versions = current?.versions ?? [];
  const snapshot = versions.at(-1) ?? (current?.draft ? { ...current.draft, version: 0, at: "" } : undefined);
  const historical = false;
  const rule = current && "indicator" in current ? current as Rule : undefined;
  const referencedRules = current ? state.rules.filter(r => current.id in (r.versions.at(-1)?.resources ?? {}) || (current as Resource).draftRuleIds?.includes(r.id)) : [];
  const allowed = current ? actions(state, current.id) : [];
  const canEdit = !!rule && allowed.includes("save_rule") && !historical;
  function choose(id: string) { if (!allowNavigation()) return; setMode(mode); setEditing(undefined);
    const nextRule = state.rules.find(r=>r.id===id);
    if (nextRule && (nextRule.indicator==="6.3.4" ? "alerts" : "rules") !== mode) { setMode(nextRule.indicator==="6.3.4" ? "alerts" : "rules"); setCategory("all"); setSearch(""); }
    onOpen(id); }
  function changeCategory(value: string) { if (!allowNavigation()) return; setCategory(value); setEditing(undefined); onOpen(""); }
  const filterControls = <>
          <SearchField label={resources ? "搜索资源" : mode==="alerts"?"搜索策略":"搜索规则"} name="policy-search" placeholder={resources ? "搜索资源名称或编号…" : mode==="alerts"?"搜索策略名称或编号…":"搜索规则名称或编号…"} value={search} onValueChange={value => { if (!allowNavigation()) return false; setSearch(value); setEditing(undefined); onOpen(""); }}/>

          <label className="policy-category"><span>{resources ? "资源类型" : mode==="alerts"?"风险等级":"配置分类"}</span><SelectField aria-label={resources ? "资源类型筛选" : mode==="alerts"?"风险等级筛选":"配置分类筛选"} value={category} onValueChange={value => changeCategory(value)}><option value="all">{resources ? "全部资源" : mode==="alerts"?"全部等级":"全部分类"}（{all.length}）</option>{(resources ? [["词库", "词库"], ["业务知识", "业务知识"], ["SOP", "SOP"]] : mode==="alerts"?[["高","高风险"],["中","中风险"],["低","低风险"]]:indicatorConfigurationCategories).map(([id, label]) => <option key={id} value={id}>{label}{!resources && mode === "rules" ? `（${all.filter(item => "indicator" in item && indicatorConfigurationCategory(item.indicator) === id).length}）` : ""}</option>)}</SelectField></label>
        </>;
  return <>
    {!resources && <div className="strategy-nav"><div className="strategy-mode-toolbar"><Tabs value={mode} options={[{value:"rules",label:"指标规则"},{value:"alerts",label:"预警策略"}]} label="质检策略分类" panelId="strategy-content" onChange={value=>{if(!allowNavigation())return;setMode(value);setCategory("all");setSearch("");onOpen("");}}/><Button onClick={()=>setCatalog(true)}>字段说明</Button></div>{!detailOnly && <div className="strategy-filters">{filterControls}<div className="strategy-filter-actions">{(search || category!=="all") && <Button onClick={()=>{if(!allowNavigation())return;setSearch("");changeCategory("all");}}>重置筛选</Button>}<span role="status">共 {list.length} 项</span>{mode==="alerts" && manager && policyAnchor && <Button primary icon="plus" onClick={()=>{createPolicyTrigger.current=document.activeElement as HTMLElement;setCreatingPolicy([]);}}>新增预警策略</Button>}</div></div>}</div>}

    <div id="strategy-content" role={!resources?"tabpanel":undefined} aria-labelledby={!resources?`strategy-content-tab-${mode}`:undefined} className={`policy-layout ${resources ? "resource-layout" : "rule-layout strategy-redesign"} ${focus ? "has-selection" : ""} ${detailOnly ? "policy-full-detail" : ""}`}>
      {!detailOnly && <aside className="policy-list panel" aria-label={resources ? "资源列表" : mode==="alerts"?"策略列表":"规则列表"}>
        <div className="policy-list-actions">{resources && manager && state.resources[0] && <Button primary icon="plus" onClick={() => onAction(state.resources[0].id, "create_resource")}>新增资源</Button>}</div>
        {resources && <div className="policy-list-filters">{filterControls}</div>}
        {!resources && <header className="policy-queue-heading"><b>{mode==="alerts"?"策略列表":"指标规则"}</b><span>{list.length} 项</span></header>}
        <div className="policy-items">
          {list.map(x => <SurfaceButton type="button" key={x.id} className={`policy-item ${"indicator" in x && x.indicator !== "6.3.4" ? "indicator-rule-card" : ""} ${current?.id === x.id ? "selected" : ""}`} aria-pressed={current?.id === x.id} onClick={() => choose(x.id)}>
            {"indicator" in x ? <RuleCardContent rule={x} state={state}/> : <><span className="policy-item-top"><small>{x.id}</small>{x.draft && <Badge tone="warning">有未完成修改</Badge>}</span><strong>{x.name}</strong><span className="policy-item-bottom">{x.type}<span>引用 {state.rules.filter(r=>x.id in (r.versions.at(-1)?.resources ?? {})).length} 条规则</span></span>
          </>} </SurfaceButton>)}
          {!list.length ? <Empty text={resources ? "未找到资源" : mode==="alerts"?"未找到策略":"未找到指标规则"} hint="调整关键词或类别后重试。" action={<Button onClick={() => { if (!allowNavigation()) return; setSearch(""); changeCategory("all"); }}>重置筛选</Button>}/> : null}
        {!resources && list.length>0 && <p className="policy-queue-end">已全部加载 · 共 {list.length} 项</p>}
        </div>
        {resources && <p className="policy-list-count" role="status">{search || category !== "all" ? `找到 ${list.length} 项，共 ${all.length} 项` : `共 ${all.length} 项`}<span>{resources ? "共享内容维护" : mode==="alerts" ? "统一条件与处置" : "结果与业务资源"}</span></p>}
      </aside>}
      <section ref={detailRef} className="policy-detail panel" aria-label={resources ? "资源详情" : mode==="alerts" ? "策略详情" : "规则详情"}>
        {current && snapshot ? <>
          {detailOnly && !embedded && <DetailNavigation label={resources?"返回资源列表":mode==="alerts"?"返回策略列表":"返回规则列表"} onBack={()=>choose("")}/>}
          <div className="policy-mobile-back"><Button onClick={() => choose("")}>返回{resources ? "资源" : mode==="alerts"?"策略":"规则"}列表</Button></div>
          <header className="policy-heading"><div><div className="policy-identity"><div><p>{current.id}{rule ? (rule.indicator==="6.3.4"?"":` · 指标 ${rule.indicator}`) : ` · ${(current as Resource).type}`}{rule && rule.indicator!=="6.3.4" && <SurfaceButton className="policy-info" aria-label="指标说明" title="指标说明" onClick={()=>setCatalog(true)}><Icon name="info" size={16}/></SurfaceButton>}</p><h2 ref={headingRef} tabIndex={-1}>{(snapshot as RuleVersion).definition?.name ?? current.name}</h2></div></div><div className="policy-heading-status"><Badge tone={snapshot.version ? "success" : "warning"}>{rule?.retired?"已归档":snapshot.version?"当前生效":"待完善"}</Badge>{snapshot.at && <span>更新于 {stamp(snapshot.at)}</span>}</div></div></header>
          {rule?.retired && <div className="policy-notice">该策略已归档，仅供历史依据追溯；新规则请关联当前预警策略。</div>}
          <div className={resources ? "resource-sections" : undefined}>
          {rule ? <>

            {rule.indicator!=="6.3.4" && <IndicatorDetail rule={rule} snapshot={snapshot as RuleVersion} state={state} historical={historical} canConfigure={canEdit}
              onOpenResource={id=>setResourceDialog({id,edit:false})} onEditResource={id=>{if(!allowNavigation())return;setEditing(undefined);setResourceDialog({id,edit:true});}}
              onConfigure={()=>{if(canEdit && allowNavigation())setEditing(rule.id);}}/>}
            {rule.indicator==="6.3.4" && <section ref={parameterRef} className="policy-section parameter-section shared-policy-parameters">
              <div className="policy-section-title"><h3>策略配置</h3><div className="rule-section-actions"><Button onClick={()=>{policyTrigger.current=document.activeElement as HTMLElement;setViewingPolicy(true);}}>查看策略</Button>{!canEdit && <span className="subtle">{rule.retired ? "已归档，仅供查看" : "仅质检主管可配置"}</span>}<Button primary disabled={!canEdit} onClick={() => {policyTrigger.current=document.activeElement as HTMLElement;setEditing(current.id);}}>配置策略</Button></div></div>
              <p className="shared-policy-description">关联规则的检测结果满足以下条件时，按统一方式预警。</p>
              {(snapshot as RuleVersion).config ? <ConfigurationRead rule={rule} snapshot={snapshot as RuleVersion} state={state}/> : rule.editable ? <div className="parameter-read"><div><span>{parameterNames[rule.editable]}</span><strong>{String((snapshot as unknown as Record<string, unknown>)[rule.editable])}{rule.editable === "threshold" ? <small> 秒</small> : null}</strong><small className="parameter-limit">{rule.editable === "threshold" ? "允许 3–60 秒 · 整数" : rule.editable === "scope" ? "可选：全部业务 / 账户查询 / 信用卡 / 转账汇款" : "可选：高风险候选 / 所有候选 / 关闭提醒"}</small></div><p>{parameterHints[rule.editable]}</p></div> : <p className="policy-readonly">本规则依据下方资源进行判断，没有独立可调参数。{manager ? "需要调整业务依据时，前往业务资源维护。" : "可核对判断说明及引用内容。"}</p>}
            <p className="parameter-effect">保存后用于所有关联规则的后续检测，不改写已有检测结果。</p>
            </section>}
            {rule.indicator==="6.3.4" && <PolicyRuleReferences key={rule.id+String(historical)} policy={rule} state={state} manager={manager} historical={historical} onSubmit={onSubmit} onEdit={()=>setEditing(rule.id)}/>}
          </> : <section className="policy-section resource-content-section"><div className="policy-section-title"><h3>{(current as Resource).kind ? resourceSchemas[(current as Resource).kind!].name : (current as Resource).type === "词库" ? "词库条目" : (current as Resource).type === "SOP" ? "SOP 规则集合" : "业务知识"}</h3>{allowed.includes("save_resource") && !historical ? <Button primary icon="edit" onClick={() => onAction(current.id, "save_resource")}>编辑内容</Button> : <span>只读查看</span>}</div><ResourceContent resource={current as Resource} snapshot={snapshot as ResourceVersion}/>{(current as Resource).kind !== "voice" && <dl className="policy-facts resource-boundaries"><div><dt>适用业务</dt><dd>{snapshot.scope}</dd></div><div><dt>适用角色</dt><dd>{"role" in snapshot ? snapshot.role : ""}</dd></div><div><dt>允许例外</dt><dd>{"exception" in snapshot ? snapshot.exception || "无额外例外" : ""}</dd></div></dl>}</section>}

          {resources && <section className="policy-section resource-references"><div className="policy-section-title"><h3>引用与影响</h3><span>{referencedRules.length} 条规则</span></div>{referencedRules.map(linked=><div className="policy-reference" key={linked.id}><Icon name="sliders"/><span><b>{linked.name}</b><small>{linked.id}</small></span><Button onClick={()=>choose(linked.id)}>查看规则</Button></div>)}<p className="subtle">保存内容会更新所有引用规则的后续检测依据。</p></section>}
          {resources && state.logs.some(l => l.target === current.id && l.action === "提出依据补充意见") ? <section className="policy-section"><h3>依据补充意见</h3>{state.logs.filter(l => l.target === current.id && l.action === "提出依据补充意见").map(l => <p className="policy-feedback" key={l.id}><small>{stamp(l.at)}</small>{l.note}</p>)}</section> : null}
          </div>
        </> : <Empty text="暂无可查看的内容"/>}
      </section>
    </div>
    {editing === current?.id && rule && rule.indicator!=="6.3.4" && canEdit && <IndicatorBindingEditor key={rule.id} rule={rule} state={state} onSubmit={onSubmit} onDone={()=>{setEditing(undefined);requestAnimationFrame(()=>detailRef.current?.querySelector<HTMLButtonElement>(".indicator-warning-fields .policy-section-title button")?.focus({preventScroll:true}));}}/>}
    {editing === current?.id && rule?.indicator==="6.3.4" && canEdit && <RuleEditor key={rule.id} rule={rule} state={state} onSubmit={onSubmit} onDone={()=>{restoreParameterFocus.current=true;setEditing(undefined);}}/>}
    {resourceDialog && rule && state.resources.find(r=>r.id===resourceDialog.id) && <ResourceDialog key={resourceDialog.id} state={state} rule={rule} resource={state.resources.find(r=>r.id===resourceDialog.id)!} initialEdit={resourceDialog.edit} onClose={()=>{const row=Array.from(detailRef.current?.querySelectorAll<HTMLElement>("[data-resource-actions]") ?? []).find(item=>item.dataset.resourceActions===resourceDialog.id);const trigger=row?.querySelectorAll<HTMLButtonElement>("button")[resourceDialog.edit?1:0];setResourceDialog(undefined);requestAnimationFrame(()=>trigger?.focus({preventScroll:true}));}} onSubmit={onSubmit} onRequestEdit={()=>{if(!allowNavigation())return false;setEditing(undefined);return true;}}/>}
    {viewingPolicy && rule?.indicator==="6.3.4" && <Modal title="查看预警策略" description={rule.name} onClose={()=>{setViewingPolicy(false);requestAnimationFrame(()=>policyTrigger.current?.focus({preventScroll:true}));}} footer={<><Button onClick={()=>{setViewingPolicy(false);requestAnimationFrame(()=>policyTrigger.current?.focus({preventScroll:true}));}}>关闭</Button>{canEdit && <Button primary onClick={()=>{setViewingPolicy(false);setEditing(rule.id);}}>编辑策略</Button>}</>}><p className="policy-view-context">当前关联 {state.rules.filter(item=>!item.retired && item.versions.at(-1)?.bindings?.some(binding=>binding.policyId===rule.id)).length} 条指标规则，共用以下参数。</p><PolicyParameters config={(snapshot as RuleVersion).config ?? {}}/></Modal>}
    {creatingPolicy && policyAnchor && <ConfigurationEditor creating initialTriggerRules={creatingPolicy} rule={policyAnchor} state={state} onSubmit={command=>{onSubmit(command);setMode("alerts");setCategory("all");setSearch("");}} onDone={()=>{setCreatingPolicy(undefined);requestAnimationFrame(()=>createPolicyTrigger.current?.focus({preventScroll:true}));}}/>}
    {catalog && (mode==="alerts"?<PolicyFieldGuide onClose={()=>setCatalog(false)}/>:<IndicatorMatrix onClose={()=>setCatalog(false)}/>)}
  </>;
}
