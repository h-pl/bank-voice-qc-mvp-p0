import { BindingPolicyFields } from "./binding-policy-fields";
import { bindingFeatures, conditionSummary, policyUsers, validateBindings } from "../lib/indicator-bindings";
import { supportsWarning, resourceKindsFor, indicatorName } from "../lib/strategy-schema";
import { Badge } from "./ui";
import { Badge as IndicatorBadge } from "./ui/badge";
import type { Rule, RuleVersion, State } from "../lib/workflow";
export function BindingRead({rule,snapshot,state}:{rule:Rule;snapshot:RuleVersion;state:State}){
 if(!snapshot.bindings)return <><p className="subtle">尚未配置预警关联。</p>{rule.editable && <p>原有参数：{rule.editable==="threshold"?`静默阈值 ${snapshot.threshold} 秒`:rule.editable==="scope"?snapshot.scope:snapshot.trigger}</p>}{Object.keys(snapshot.config ?? {}).length>0 && <dl className="indicator-config-grid">{Object.entries(snapshot.config ?? {}).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}</>;
 const missing=(snapshot===rule.versions.at(-1)?bindingFeatures(rule,state):[]).filter(f=>!snapshot.bindings?.some(b=>b.feature===f));
 return <div className="binding-read"><div className="binding-read-head"><span>检测结果</span><span>预警策略</span></div>{snapshot.bindings.map(b=>{
 const policy=state.rules.find(r=>r.id===b.policyId),v=policy?.versions.find(v=>v.version===snapshot.policyVersions?.[b.policyId]),c=v?.config;
 return <div className="binding-read-row" key={b.id}><div className="binding-feature"><span className="binding-mobile-label">检测结果</span><strong>{b.feature}</strong>{b.conditions.speed && <small>{b.feature==="语速过快"?">":"<"} {b.conditions.speed} 字/分钟</small>}</div><div className="binding-policy"><span className="binding-mobile-label">预警策略</span>{!c && <div className="binding-policy-name"><strong>{!b.policyId?"待配置":b.policyId==="none"?"不预警":policy?.name ?? "策略不可用"}</strong></div>}{c && <BindingPolicyFields policyName={policy?.name} binding={b} conditions={snapshot.configurationModel==="indicator-bindings"?b.conditions:c} config={c}/>}{!b.policyId && <p>请关联策略或明确选择不预警</p>}</div></div>;
 })}{missing.length>0 && <p className="form-error">新增检测结果待配置：{missing.join("、")}</p>}</div>;
}
export function RuleCardContent({rule,state}:{rule:Rule;state:State}){
 const v=rule.versions.at(-1),shown=v ?? rule.draft,policy=rule.indicator==="6.3.4",rows=v?.bindings ?? [],warning=supportsWarning(rule.indicator);
 let incomplete=false;if(warning){try{validateBindings(rule,rows,state);}catch{incomplete=true;}}
 const resourceNames=Object.keys(v?.resources ?? {}).map(id=>state.resources.find(r=>r.id===id)?.name ?? id);
 const activeBindings=rows.filter(b=>b.policyId && b.policyId!=="none");
 const alertSummary=!warning ? "无" : activeBindings.length ? activeBindings.map(b=>`${b.feature} → ${state.rules.find(p=>p.id===b.policyId)?.name ?? "策略不可用"}`).join("；") : incomplete ? "待配置" : "无";
 if(!policy) return <>
  <span className="indicator-card-heading"><strong>{rule.name}</strong><IndicatorBadge variant="secondary" className="indicator-card-indicator" title={`关联指标：${indicatorName(rule.indicator)}`}>{indicatorName(rule.indicator)}</IndicatorBadge></span>
  <span className="indicator-card-field"><span className="indicator-card-label">资源</span><span>{resourceNames.length ? resourceNames.join("、") : resourceKindsFor(rule).length ? "待关联资源" : "无需引用资源"}</span></span>
  <span className="indicator-card-field indicator-card-alerts"><span className="indicator-card-label">预警</span><span className="indicator-card-alert-summary" title={alertSummary}>{alertSummary}</span></span>
  {(rule.draft || incomplete || !v) && <span className="indicator-card-footer">{rule.draft?<Badge tone="warning">{"有未完成修改"}</Badge>:incomplete?<Badge tone="warning">待完善关联</Badge>:<Badge tone="neutral">待完善</Badge>}</span>}
 </>;
 const policyConfig=shown?.config;
 const scope=policyConfig?[policyConfig.role,policyConfig.stage].filter(Boolean).join(" · "):"待配置";
 const trigger=policyConfig?conditionSummary({id:"preview",feature:"",policyId:rule.id,conditions:{...policyConfig,role:"",stage:""}}):"待配置";
 return <><strong>{rule.name}</strong><span className="rule-card-facts shared-policy-card-facts"><span><small>范围</small>{scope}</span><span><small>触发</small>{trigger}</span><span><small>处置</small>{policyConfig?.level ? `${policyConfig.level}风险` : "待配置"} · {policyConfig?.action || "待配置"}</span><span><small>关联</small>{policyUsers(rule,state).length} 条规则</span></span>{rule.draft && <span className="rule-card-footer"><Badge tone="warning">有未完成修改</Badge></span>}</>;
}
