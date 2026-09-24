import { ResourceRowsTable } from "./structured-resource";
import { resourceSchemas } from "../lib/strategy-schema";
import { SurfaceButton } from "./ui/button";
import { readSopRules } from "../lib/sop-rules";
import type { Resource, ResourceVersion, Rule, RuleVersion } from "../lib/workflow";
import { Badge } from "./ui";
import { stamp } from "./workspace";

// Presentation preserves stored text; it never infers missing questions or business steps.
export function ResourceContent({ resource, snapshot, compact=false }: { resource: Resource; snapshot: ResourceVersion; compact?:boolean }) {
  if(resource.kind)return <>{!compact && <p className="subtle">{resourceSchemas[resource.kind].name} · {resourceSchemas[resource.kind].csv?"专属 CSV 模板":"表单维护"}</p>}<ResourceRowsTable kind={resource.kind} content={snapshot.content}/>{resourceSchemas[resource.kind].note && <p className="callout">{resourceSchemas[resource.kind].note}</p>}</>;
  const entries = snapshot.content.split(/\n/).map(line => line.trim()).filter(Boolean);
  if (!entries.length) return <p className="subtle">草稿尚未填写内容，编辑后可在这里预览。</p>;
  if (resource.type === "词库") return <div className="resource-lexicon"><p className="resource-caption">共 {entries.length} 条词语 · 适用角色：{snapshot.role}</p><ul aria-label="词库条目">{entries.map((entry, i) => <li key={i}><span>{entry}</span><Badge>词条</Badge></li>)}</ul></div>;
  if (resource.type === "SOP") { const rules=readSopRules(snapshot.content,resource.name); return rules.length ? <div className="sop-collection"><p className="subtle">共 {rules.length} 条 SOP 规则</p>{rules.map(rule=><section key={rule.name}><h4>{rule.name}</h4><ol className="resource-steps" aria-label={`${rule.name}的步骤`}>{rule.steps.map((step,i)=><li key={i}><span aria-hidden="true">{String(i+1).padStart(2,"0")}</span><p>{step}</p></li>)}</ol></section>)}</div> : <p>{snapshot.content}</p>; }
  return <dl className="resource-knowledge"><div><dt>业务主题</dt><dd>{resource.name}</dd></div><div><dt>标准口径</dt><dd>{snapshot.content}</dd></div></dl>;
}

const versionFields = { definition:"检查范围与依据", bindings:"触发配置", policyVersions:"策略引用", triggerRules: "触发规则", config:"规则配置", content: "内容", scope: "适用业务", role: "适用角色", exception: "例外说明", threshold: "静默阈值", trigger: "提醒触发", resources: "资源引用" };
export function versionSummary(current: ResourceVersion | RuleVersion, previous?: ResourceVersion | RuleVersion) {
  if (!previous) return "首次发布 · 建立可追溯的版本依据";
  const before = previous as unknown as Record<string, unknown>;
  const after = current as unknown as Record<string, unknown>;
  const changed = Object.entries(versionFields).filter(([field]) => field in after && JSON.stringify(after[field]) !== JSON.stringify(before[field])).map(([, name]) => name);
  return changed.length ? `变更：${changed.join("、")}` : "发布记录 · 内容与上一版本一致";
}

export function VersionHistory({ current, selected, onSelect }: { current: Rule | Resource; selected: number; onSelect: (version: number) => void }) {
  return <section className="policy-section policy-history" aria-label="版本记录">
    <div className="policy-section-title"><h3>版本记录</h3><span>{current.versions.length} 个已发布版本</span></div>
    {current.versions.length ? <div className="version-entries">{[...current.versions].reverse().map(v => <SurfaceButton type="button" key={v.version} aria-pressed={selected === v.version} className={`version-entry ${selected === v.version ? "selected" : ""}`} onClick={() => onSelect(v.version)}><span className="version-entry-id">V{v.version}<Badge tone={v === current.versions.at(-1) ? "success" : "neutral"}>{v === current.versions.at(-1) ? "indicator" in current ? current.retired ? "已归档" : "当前生效" : "最新已发布" : "历史版本"}</Badge></span><span><b>{versionSummary(v, current.versions.find(p => p.version === v.version - 1))}</b><small>{stamp(v.at)}{selected === v.version ? " · 正在查看" : " · 查看此版本"}</small></span></SurfaceButton>)}</div> : <p className="subtle">尚未发布。草稿通过检查并发布后生成首个版本。</p>}
  </section>;
}
