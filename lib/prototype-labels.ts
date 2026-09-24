import type { State } from './workflow.ts';

/** Clean known legacy fixture labels without resetting progress or rewriting free text. */
export function normalizeLegacyLabels(input: State): State {
  const state = structuredClone(input);
  for (const call of state.calls) {
    const index = /^CALL-UI-([1-8])$/.exec(call.id)?.[1];
    if (index && call.customer === `演示客户 ${index}`) call.customer = `客户 ${index}`;
  }
  for (const resource of state.resources) {
    if (resource.id === 'RES-SERVICE-TIME' && resource.name === '业务处理时限告知要求（演示）') resource.name = '业务处理时限告知要求';
    if (!/^RES-UI-[1-6]$/.test(resource.id)) continue;
    for (const version of [...resource.versions, ...(resource.draft ? [resource.draft] : [])]) {
      if (version.exception === '演示业务口径；实际办理以核实后的业务依据为准。') version.exception = '实际办理以核实后的业务依据为准。';
    }
  }
  for (const remedy of state.remedies) {
    if (remedy.observation === '提交 1 通整改后同类业务样例（演示值）') remedy.observation = '提交 1 通整改后同类业务样例';
    if (remedy.observation === '提交整改后同业务通话，逐项核对改进效果（演示）') remedy.observation = '提交整改后同业务通话，逐项核对改进效果';
  }
  return state;
}
