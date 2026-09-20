import type { State, Resource, Input } from "./workflow.ts";

export function pendingResourceRules(state: State, resource: Resource) {
  const latest = resource.versions.at(-1);
  if (!latest) return [];
  return state.rules.filter(rule => {
    const current = rule.versions.at(-1)!;
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
    rule.versions.push({...structuredClone(previous), version: previous.version + 1, at, resources: {...previous.resources, [resource.id]: version.version}});
    rule.rev++;
    state.logs.push({id:`REF-${state.revision + 1}-${state.logs.length + 1}`,target:rule.id,at,actor:state.identity,action:"切换资源引用",note:`${resource.name}：${previous.resources[resource.id] ? `V${previous.resources[resource.id]}` : "未引用"} → V${version.version}；${input.note}`});
  }
}
