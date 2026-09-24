import { apply, entity, callFor, type Command, type Input, type Review } from './workflow.ts';
import type { PrdState, SeedScenario } from './prd-seed-catalog.ts';

export type ContextSeedState = PrdState & { contextScenarioVersion?: number; contextScenarioCommands?: {actor:string;at:string;command:Command}[] };
const tables = ['calls','findings','reviews','appeals','remedies','supplements','logs','detectionResults','warningDecisions'] as const;
/** Append independent, command-driven examples. Never reset or advance existing user records. */
export function withContextScenarios(input: ContextSeedState, template: PrdState, now = new Date()): ContextSeedState {
  if (input.contextScenarioVersion === 3) return input;
  const specs = [
    ['REVIEW-FP','F-1039-B','误报复核·待主管确认'],
    ['REVIEW-RETURN','F-1039','主管退回·重新核实'],
    ['EVIDENCE-REQUEST','F-1039-B','核实资料不足·待主管安排补证'],
    ['EVIDENCE-PENDING','F-1039-B','复核补证·待坐席提交'],
    ['EVIDENCE-SUBMITTED','F-1039-B','复核补证·待主管接收'],
    ['EVIDENCE-INSPECTOR','F-1039-B','复核补证·由另一位质检员提交'],
    ['AP-UPHELD','F-AP-DECISION','申诉成立·待主管裁定'],
    ['AP-SUBMITTED','F-AP-SUPPLEMENT','申诉补件·待质检员接收'],
    ['AP-EXPLAIN','F-UI-7','质检员不赞同退回·待主管再次裁定'],
    ['AP-RECHECK','F-UI-7','质检员赞同退回·重新核查申诉'],
    ['REC-ADJUST','F-1036','坐席申请调整整改要求·待主管处理'],
    ['REC-RETRY','F-REC-FAIL','不满足要求后重新提交·待核验'],
    ['SPOT-RETURN','WO-SPOT-2','未发现问题抽检·退回重新检查'],
    ['SPOT-FOUND','WO-SPOT-1','人工抽检发现问题·待主管确认'],
    ['AP-WITHDRAWN','F-AP-SUPPLEMENT','申诉撤回·重新选择处理结果'],
    ['SPOT-LINK','F-1031','人工抽检·可关联同通话待核实问题'],
    ['LIVE-DRAFT','F-1041','通话未结束·仅可保存核实草稿'],
  ] as const;
  let result = structuredClone(input);
  const commands: NonNullable<ContextSeedState['contextScenarioCommands']> = [];
  for (const [key, sourceId, label] of specs) {
    const scenarioId = `CTX-${key}`;
    if (result.seedScenarios?.some(x => x.id === scenarioId)) continue;
    const sourceCall = callFor(template,sourceId)!;
    const sourceReview=template.reviews.find(x=>x.id===sourceId);
    const findingIds=sourceReview?.findingIds ?? [sourceId];
    const findings = template.findings.filter(x => findingIds.includes(x.id));
    const reviews = template.reviews.filter(x => x.id===sourceId || x.findingIds.some(id=>findingIds.includes(id)));
    const appeals = template.appeals.filter(x => findings.some(f => f.id === x.findingId));
    const remedies = template.remedies.filter(x => findings.some(f => f.id === x.findingId));
    const taskIds = new Set([sourceCall.id,...findings.map(x=>x.id),...reviews.map(x=>x.id),...appeals.map(x=>x.id),...remedies.map(x=>x.id)]);
    const supplements = template.supplements.filter(x=>taskIds.has(x.target));
    supplements.forEach(x=>taskIds.add(x.id));
    const sampleIds = new Set(remedies.flatMap(x=>[...x.materials,...(x.rounds??[]).flatMap(r=>r.materials)].flatMap(m=>m.samples)));
    const calls = template.calls.filter(x=>x.id===sourceCall.id || sampleIds.has(x.id));
    const ids = new Map<string,string>();
    const mapped = (id:string) => `${id.split('-')[0]}-CTX-${key}-${id}`;
    const pack = {calls,findings,reviews,appeals,remedies,supplements,
      logs:template.logs.filter(x=>taskIds.has(x.target)),
      detectionResults:(template.detectionResults??[]).filter(x=>calls.some(c=>c.id===x.callId)),
      warningDecisions:(template.warningDecisions??[]).filter(x=>calls.some(c=>c.id===x.callId) && (!x.findingId || findingIds.includes(x.findingId)))};
    // Include nested batch/event IDs and map references and opinion dictionary keys together.
    const collect=(value:unknown):void=>{if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(k==='id'&&typeof v==='string')ids.set(v,mapped(v));collect(v);}};
    collect(pack);
    const remap=(value:unknown):unknown=>typeof value==='string' ? ids.get(value)??value : Array.isArray(value) ? value.map(remap) : value&&typeof value==='object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[ids.get(k)??k,remap(v)])) : value;
    let s = {...structuredClone(template),...remap(pack) as typeof pack,requests:[],revision:1} as ContextSeedState;
    let clock = key==='LIVE-DRAFT' ? now.getTime()-61000 : Math.max(now.getTime()-1200000,...s.logs.map(x=>Date.parse(x.at)));
    const commandStart=commands.length;
    let sequence = 0;
    const ref=(id:string)=>ids.get(id)!;
    const finding=s.findings.find(x=>x.id===ref(sourceId));
    const review=()=>s.reviews.find(x=>x.id===ref(sourceId)) ?? s.reviews.find(x=>x.findingIds.includes(finding!.id) && !['done','cancelled'].includes(x.status))!;
    const appeal=()=>s.appeals.find(x=>x.findingId===finding!.id)!;
    const remedy=()=>s.remedies.find(x=>x.findingId===finding!.id)!;
    function run(id:string, actor:string, action:string, data:Input={}) {
      clock+=60000; s.identity=actor;
      const command:Command={id,rev:entity(s,id)!.rev,action,requestId:`SEED-${scenarioId}-${++sequence}`,input:{note:'已核对本次业务记录、通话上下文及所列检查要求。',owner:'Q01',dueAt:new Date(now.getTime()+72*3600000).toISOString(),...data}};
      s=apply(s,command,new Date(clock)) as ContextSeedState;
      commands.push({actor,at:new Date(clock).toISOString(),command});
    }
    function submit(r:Review,value:'risk'|'false_positive') {
      run(r.id,r.owner,'submit_review',{summary:value==='risk'?'已核实问题及证据，确认非误报。':'已核对完整业务背景，原判断不成立，确认误报。',opinions:Object.fromEntries(r.findingIds.map(id=>[id,{value,note:value==='risk'?'结合完整转写及业务记录，原问题成立。':'补充业务记录证明本次场景符合例外，原判断不成立。',evidence:s.findings.find(x=>x.id===id)!.evidence}]))});
    }
    if(key==='REVIEW-FP'){
      // Complete context makes the timing exception and the available channel explicit.
      s.calls.find(x=>x.id===ref(sourceCall.id))!.transcript[4].text='目前无法确认具体处理时限，因为申请尚在审批；您可以通过银行官方渠道查询办理进度。';
      finding!.detectionBasis={summary:'初始片段疑似未说明时限，需结合完整转写确认时限例外及查询渠道。',checks:[]};
      for(const d of s.detectionResults??[])if(d.callId===finding!.callId&&d.ruleId===finding!.ruleId)d.reason=finding!.detectionBasis.summary;
      submit(review(),'false_positive');
    }
    if(key==='REVIEW-RETURN'||key==='SPOT-RETURN')run(review().id,'S01','return_review',{note:'请重新核对业务受理范围、查询渠道及适用时限，再次提交核实记录。'});
    if(key.startsWith('EVIDENCE-')){
      run(review().id,review().owner,'request_evidence',{note:'需补充业务受理记录及可确认时限，资料齐全后再形成结论。'});
      if(key!=='EVIDENCE-REQUEST')run(review().id,'S01','supplement',{owner:key==='EVIDENCE-INSPECTOR'?'Q02':sourceCall.agentId,note:'请提供本次业务受理回执、当前进度及可确认时限。'});
      if(key==='EVIDENCE-SUBMITTED')run(s.supplements.at(-1)!.id,sourceCall.agentId,'reply',{note:'已补充本次业务受理回执及进度说明，待核对时限适用条件。',attachment:'业务受理回执.pdf'});
    }
    if(key==='AP-UPHELD'){
      run(appeal().id,'S01','return_appeal',{note:'请补充有效期内的业务核验依据，重新判断申诉是否成立。'});
      run(review().id,review().owner,'agree_appeal_return');submit(review(),'false_positive');
    }
    if(key==='AP-SUBMITTED')run(s.supplements.find(x=>x.status==='pending')!.id,sourceCall.agentId,'reply',{note:'已提交与本次通话对应的 IVR 核验回执及有效期记录。',attachment:'IVR核验记录.pdf'});
    if(key==='AP-EXPLAIN')run(review().id,review().owner,'explain_appeal',{note:'补充记录显示 IVR 核验未成功，维持申诉不成立的核查结论。'});
    if(key==='AP-RECHECK')run(review().id,review().owner,'agree_appeal_return',{note:'赞同重新核对 IVR 记录与人工查询的关联，重新检查业务依据。'});
    if(key==='REC-ADJUST')run(remedy().id,remedy().agentId,'adjust_request',{note:'原资料要求未覆盖实际受理流程，请主管明确需要补充的业务记录。'});
    if(key==='REC-RETRY'){
      run(remedy().id,remedy().agentId,'sample_calls');
      run(remedy().id,remedy().agentId,'material',{samples:[s.calls.at(-1)!.id],note:'根据上一轮不满足项补充完整业务受理说明，提交第二轮通话样例。'});
    }
    if(key==='SPOT-FOUND'){
      s.calls.find(x=>x.id===ref(sourceCall.id))!.transcript[3].text='后续处理时限也不向您说明，请自行查询。';
      run(review().id,review().owner,'add_finding',{title:'人工发现办理时限说明需核实',ruleId:'R-SOP-TIME',evidence:[3]});
      submit(review(),'risk');
    }
    if(key==='AP-WITHDRAWN')run(appeal().id,sourceCall.agentId,'withdraw',{note:'已核对处理依据，撤回本次申诉并重新选择后续处理。'});
    if(key==='SPOT-LINK')run(ref(sourceCall.id),'S01','spotcheck',{owner:'Q01',scope:'核对业务转接与已有预警是否属于同一事实'});
    if(key==='LIVE-DRAFT')run(finding!.id,'S01','assign',{owner:'Q01',note:'先保存实时核实记录，待通话结束后提交正式结论。'});
    // Stable IDs for generated tasks, supplements and events across reloads.
    const generated = new Map<string,string>();
    for(const table of tables)for(const item of s[table]??[])if(!item.id.includes(`CTX-${key}-`))generated.set(item.id,`${item.id.split('-')[0]}-CTX-${key}-NEW-${generated.size+1}`);
    const stable=(value:unknown):unknown=>typeof value==='string'?generated.get(value)??value:Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[generated.get(k)??k,stable(v)])):value;
    s=stable(s) as ContextSeedState;
    commands.splice(commandStart,commands.length-commandStart,...stable(commands.slice(commandStart)) as typeof commands);
    const row:SeedScenario={id:scenarioId,label,callId:ref(sourceCall.id),findingId:finding?.id ?? s.findings[0]?.id,reviewId:s.reviews.find(x=>!['done','cancelled'].includes(x.status))?.id,appealId:s.appeals[0]?.id,remedyId:s.remedies[0]?.id,clauses:['7.3','7.4','7.5','7.11.3']};
    for(const table of tables){const added=s[table]??[];const current=result[table]??[];const occupied=new Set(current.map(x=>x.id));if(added.some(x=>occupied.has(x.id)))throw new Error(`场景编号冲突：${scenarioId}`);Object.assign(result,{[table]:[...current,...added]});}
    result.seedScenarios=[...(result.seedScenarios??[]),row];
  }
  result={...result,contextScenarioVersion:3,contextScenarioCommands:[...(result.contextScenarioCommands??[]),...commands]};
  return result;
}
