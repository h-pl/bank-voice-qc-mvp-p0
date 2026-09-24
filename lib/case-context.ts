import { activeAppeal, currentOwner, needsRead, needsWork, person, roleOf, terminalRemedy, type Entity, type Finding, type State } from './workflow.ts';

/** Display the responsibility of this stage, including parallel assignment and read-only acknowledgements. */
export function responsibilityContext(state: State, item: Entity) {
  const paused = 'pause' in item && !!item.pause;
  const readOnly = needsRead(state, item) && !needsWork(state, item);
  const assignment = 'standardVersion' in item && !terminalRemedy(item) && !paused && !item.inspector && item.origin === 'direct' && roleOf(state) === 'supervisor';
  const owner = person(readOnly || assignment ? state.identity : currentOwner(state, item));
  const badge = paused ? '申诉暂停' : readOnly ? '待确认知悉' : assignment ? '待指派核验人' : needsWork(state, item) ? '轮到我处理' : owner?.id === state.identity ? '当前负责' : owner ? '等待他人' : '无待办';
  return { owner, badge, readOnly, paused };
}

/** Original distribution is historical during appeals; remedy pages use the current round's requirements. */
export function distributionContext(state: State, item: Entity, finding?: Finding) {
  const distribution = finding?.distribution;
  if (!distribution) return undefined;
  if ('standardVersion' in item) return {
    ...distribution, title: '本轮整改要求', goal: item.goal, standard: item.standard,
    observation: item.observation, sampleCount: item.sampleCount, dueAt: item.dueAt,
    inspector: person(item.inspector)?.name ?? (item.materials.length ? '待主管指派，已提交资料保留' : '待主管指派，可先提交整改资料'), guidance: '',
  };
  const appeal = 'findingId' in item ? state.appeals.find(a => a.id === item.id)
    : 'findingIds' in item && item.appealId ? state.appeals.find(a => a.id === item.appealId)
    : finding ? activeAppeal(state, finding.id) : undefined;
  const historical = !!appeal || distribution.status !== 'pending';
  return {
    ...distribution, title: historical ? '原处理结果与整改要求' : '处理结果与整改要求',
    inspector: person(distribution.inspector)?.name ?? (historical ? '原分发时未指定' : '接受整改后由主管补派，可先整改'),
    guidance: appeal ? ['done', 'withdrawn', 'rejected'].includes(appeal.status) ? '原分发要求保留供追溯，后续办理以裁定结果和当前任务为准。' : '当前按申诉流程办理；不成立后进入整改并沿用本案核查质检员，无需再次接受或补派。'
      : distribution.status === 'pending' ? '查看或确认知悉不会代替接受；请明确选择接受整改或提出申诉。' : '原分发要求保留供追溯，当前要求以关联整改任务为准。',
  };
}

/** Read the original return event for persisted records created before the dedicated field. */
export function supervisorReturnNote(state: State, item: Entity): string | undefined {
  if ('supervisorComment' in item && item.supervisorComment?.trim()) return item.supervisorComment;
  if (!('findingIds' in item) && !('standardVersion' in item)) return undefined;
  const appeal = 'findingIds' in item && item.type === 'appeal';
  const target = appeal ? item.appealId : item.id;
  const names = 'standardVersion' in item || appeal
    ? ['退回质检员核对'] : ['退回复核', '退回重新核实', '退回重新抽检'];
  return state.logs.filter(log => log.target === target && person(log.actor)?.role === 'supervisor' && names.includes(log.action) && log.note?.trim())
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]?.note;
}
