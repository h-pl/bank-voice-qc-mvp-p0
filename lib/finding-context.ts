import type { Finding, State } from './workflow.ts';

export function findingContext(state: State, finding: Finding) {
  const call = state.calls.find(item => item.id === finding.callId);
  const rule = state.rules.find(item => item.id === finding.ruleId);
  const version = rule?.versions.find(item => item.version === finding.ruleVersion);
  const basis = finding.detectionBasis;
  return { call, rule, version, basis,
    summary: basis?.summary ?? (finding.source === 'manual' ? '人工登记的问题，具体发现依据待补充；请结合原话与复核意见核对。' : '系统已标记候选片段，但未保存具体触发说明；需结合命中规则和上下文核对。'),
  };
}

/** Repair only untouched demo seeds; never rewrite a saved opinion or formal conclusion. */
export function withFindingContext(input: State): State {
  const service = input.findings.find(f => f.id === 'F-1039');
  const timing = input.findings.find(f => f.id === 'F-1039-B');
  const review = input.reviews.find(r => r.id === 'WO-1039');
  const call = input.calls.find(c => c.id === 'CALL-1039');
  const originalTranscript = call?.transcript[2]?.text === '这件事我们这边确实没办法处理。' && call?.transcript[4]?.text === '已经为您查询，后续处理方式我向您说明。';
  if (!originalTranscript || !review || review.rev !== 0 || review.status !== 'supervisor') return input;
  const fixService = service?.rev === 0 && service.ruleId === 'R-SVC-009' && !service.conclusions.length && !service.detectionBasis;
  const fixTiming = timing?.rev === 0 && timing.ruleId === 'R-SOP-006' && timing.title === '未完整说明处理时限' && !timing.conclusions.length && !timing.detectionBasis;
  if (!fixService && !fixTiming) return input;
  const state = structuredClone(input);
  if (fixService) state.findings.find(f => f.id === 'F-1039')!.detectionBasis = {
    summary: '00:16 出现“没办法处理”的表述；00:32 又表示已查询，是否构成推诿需结合后续处理说明核对。',
    checks: [
      { requirement: '核对坐席是否拒绝处理或转嫁责任', observation: '00:16 坐席表示“我们这边确实没办法处理”。', result: '待核对' },
      { requirement: '结合后续回应与合理转接等例外', observation: '00:32 坐席表示“已经为您查询”，现有上下文不足以直接确认推诿。', result: '待核对' },
    ],
  };
  if (fixTiming) {
    const original = state.rules.find(r => r.id === 'R-SOP-006')!;
    const at = original.versions.find(v => v.version === 1)?.at ?? call!.startedAt;
    if (!state.resources.some(r => r.id === 'RES-SERVICE-TIME')) state.resources.push({
      id: 'RES-SERVICE-TIME', rev: 0, name: '业务处理时限告知要求', type: 'SOP', versions: [{ version: 1, at, scope: '信用卡', role: '坐席', content: '说明已查询到的处理进度；可确认时限时告知预计时限，无法确认时说明原因和后续查询渠道。', exception: '不得承诺未经核实的时效；客户提前挂断或业务不涉及后续处理时，需结合上下文核对。' }],
    });
    if (!state.rules.some(r => r.id === 'R-SOP-TIME')) state.rules.push({
      id: 'R-SOP-TIME', rev: 0, name: '处理时限告知', indicator: '6.3.7', description: '核对处理进度、预计时限或无法确认的说明及后续查询渠道。', severity: 'medium', versions: [{ version: 1, at, scope: '信用卡', threshold: 0, trigger: '处理时限或后续查询渠道未说明，需核对完整业务上下文', resources: { 'RES-SERVICE-TIME': 1 } }],
    });
    const f = state.findings.find(f => f.id === 'F-1039-B')!;
    f.ruleId = 'R-SOP-TIME'; f.ruleVersion = 1; f.evidence = [4];
    f.detectionBasis = {
      summary: '00:32 提到后续处理，但现有转写未见具体时限或查询渠道；是否应当告知及是否存在例外仍待补证。',
      checks: [
        { requirement: '说明可确认的预计时限，或无法确认的原因与查询渠道', observation: '00:32 仅提到“后续处理方式我向您说明”，现有片段未包含具体说明。', result: '待核对' },
        { requirement: '核对完整通话、业务适用条件与提前挂断等例外', observation: '当前转写不足以确认是否漏告知，需要补充完整通话及业务依据。', result: '待补证' },
      ],
    };
    const r = state.reviews.find(r => r.id === 'WO-1039')!;
    if (r.opinions[f.id]?.note === '通话未覆盖完整处理条件，需要补充业务依据') r.opinions[f.id].evidence = [4];
    const batch = state.calls.find(c => c.id === f.callId)?.batches.find(b => b.id === f.batchId);
    if (batch) batch.ruleVersions[f.ruleId] = f.ruleVersion;
  }
  return state;
}
