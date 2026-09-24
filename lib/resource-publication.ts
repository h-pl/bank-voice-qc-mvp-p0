import { validateRuleResources, fixedResourceReferences, resourceSchemas } from "./strategy-schema.ts";
import type { State, Resource, Input } from "./workflow.ts";

export function pendingResourceRules(state: State, resource: Resource) {
  if (resource.deletedAt || fixedResourceRules(state,resource).length) return [];
  const latest = resource.versions.at(-1);
  if (!latest) return [];
  return state.rules.filter(rule => {
    const current = rule.versions.at(-1);
    if(!current)return false;
    return (resource.id in current.resources || resource.draftRuleIds?.includes(rule.id)) && current.resources[resource.id] !== latest.version;
  });
}

/** Apply an explicitly selected reference change to the cloned transaction state. */
export function switchResourceReferences(state: State, resource: Resource, input: Input, at: string) {
  const version = resource.versions.at(-1);
  const eligible = pendingResourceRules(state, resource);
  const selected = [...new Set(input.refs ?? [])];
  if (!version || !selected.length) throw new Error("请选择需要切换引用的规则");
  const rules = selected.map(id => {
    const rule = eligible.find(item => item.id === id);
    if (!rule) throw new Error("规则引用已变化，请重新核对影响范围");
    if (rule.draft) throw new Error(`${rule.name}存在参数草稿，请先完成或放弃草稿`);
    if (input.referenceRevs?.[id] !== rule.rev) throw new Error("关联规则已更新，请重新打开表单核对版本");
    return rule;
  });
  for (const rule of rules) {
    const previous = rule.versions.at(-1)!;
    if(resource.kind)validateRuleResources(rule,{...previous.resources,[resource.id]:version.version},state);
    rule.versions.push({...structuredClone(previous), version: previous.version + 1, at, resources: {...previous.resources, [resource.id]: version.version}});
    rule.rev++;
    state.logs.push({id:`REF-${state.revision + 1}-${state.logs.length + 1}`,target:rule.id,at,actor:state.identity,action:"切换资源引用",note:`${resource.name}：${previous.resources[resource.id] ? `V${previous.resources[resource.id]}` : "未引用"} → V${version.version}；${input.note}`});
  }
}

/** Active and draft references must be resolved before deleting a resource. */
export function resourceDeletionBlockers(state: State, id: string) {
  return state.rules.filter(rule => id in (rule.versions.at(-1)?.resources ?? {}) || id in (rule.draft?.resources ?? {}));
}

/** Resource kind determines its indicator. Customers edit content, not bindings. */
export function fixedResourceRules(state:State,resource:Resource){
 return resource.kind ? state.rules.filter(rule=>rule.fixedResources && rule.indicator===resourceSchemas[resource.kind!]?.indicator) : [];
}
export function refreshFixedResourceReferences(state:State,resource:Resource,at:string){
 for(const rule of fixedResourceRules(state,resource)){
  const previous=rule.versions.at(-1)!;const resources=fixedResourceReferences(rule,state);
  if(JSON.stringify(resources)===JSON.stringify(previous.resources))continue;
  rule.versions.push({...structuredClone(previous),version:previous.version+1,at,resources});rule.rev++;
  // Preserve parameter drafts; changed resource evidence requires another check.
  if(rule.draft)rule.checked=false;
  state.logs.push({id:`AUTO-REF-${state.revision+1}-${state.logs.length+1}`,target:rule.id,at,actor:state.identity,action:"资源发布自动生效",note:`${resource.name} V${resource.versions.at(-1)!.version} 已用于后续检测；历史快照保留。`});
 }
}
