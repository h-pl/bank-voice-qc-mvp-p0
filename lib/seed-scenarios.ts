import { withFindingContext } from './finding-context.ts';
import type { State } from './workflow.ts';

/** Fresh scenario construction only. Never run this against persisted user records. */
export function completeSeedScenarios(input: State): State {
  const s = withFindingContext(input);
  const now = Date.parse(s.calls[0].startedAt) + 360000;
  const at = (hours: number) => new Date(now + hours * 3600000).toISOString();
  const shift = (time: string, minutes: number) => new Date(Date.parse(time) + minutes * 60000).toISOString();
  const infoResource = { id:'RES-SERVICE-INFO',rev:0,type:'业务知识' as const,name:'业务条件与办理结果说明',versions:[{version:1,at:at(-168),scope:'全部业务',role:'坐席',content:'办理前说明适用条件；费用、到账时效与审批结果以核实后的业务记录为准，不作无依据保证。',exception:'条件已在有效前序环节完整告知时，应核对记录，避免重复判断。'}] };
  const timingResource=s.resources.find(r=>r.id==='RES-SERVICE-TIME');
  if(timingResource)timingResource.versions[0].content='处理时限告知：说明已查询到的处理进度，告知可确认的预计时限或无法确认的原因，说明后续查询渠道；';
  s.resources.push(infoResource);
  s.rules.push({id:'R-SVC-INFO',rev:0,name:'业务条件与结果说明',indicator:'6.3.7',description:'核对必要条件是否完整说明，以及费用、时效等承诺是否有已核实依据。',severity:'medium',versions:[{version:1,at:at(-168),threshold:0,scope:'全部业务',trigger:'业务条件遗漏或无依据承诺',resources:{'RES-SERVICE-INFO':1}}]});
  const references = [
    ['R-SVC-002','RES-CLOSING','结束语检查口径','服务结束时使用规范结束语；客户提前挂断或紧急转接时需核对例外。'],
    ['R-AC-003','RES-SILENCE','静默片段核对口径','按声学检测结果核对连续静默时长及规则阈值；业务等待需结合已告知的原因、预计时间及后续回应判断。'],
    ['R-SVC-009','RES-SERVICE-TONE','服务表达核对口径','核对坐席是否拒绝处理、推诿责任或表达不耐烦；合理转接、引用与后续继续处理需结合上下文核实。'],
    ['R-INT-001','RES-TRANSFER','业务转接核对口径','将客户明确诉求与转接业务组匹配；通用词命中本身不等于转接错误。'],
  ];
  for(const [ruleId,id,name,content] of references){s.resources.push({id,rev:0,type:'业务知识',name,versions:[{version:1,at:at(-168),scope:'全部业务',role:'坐席',content,exception:'结合完整通话及实际业务记录复核。'}]});s.rules.find(r=>r.id===ruleId)!.versions[0].resources={[id]:1};}
  // Each candidate warning has an independent review; the call is only a related record.
  const review = s.reviews.find(r=>r.id==='WO-1039')!;
  const timing = s.findings.find(f=>f.id==='F-1039-B')!;
  const timingOpinion = review.opinions[timing.id];
  review.findingIds=['F-1039']; review.scope='核对是否存在推诿表达及后续处理说明';
  delete review.opinions[timing.id];
  // The supplied context contradicts a definitive risk verdict; preserve uncertainty.
  review.opinions['F-1039']={value:'insufficient',note:'出现“没办法处理”，但后续又表示已查询；需补充完整处理经过，确认是否构成推诿。',evidence:[2,4]};
  s.reviews.splice(2,0,{...structuredClone(review),id:'WO-1039-B',findingIds:[timing.id],scope:'核对处理时限告知及业务适用条件',opinions:{[timing.id]:timingOpinion}});

  for (const [index,call] of s.calls.entries()) {
    if(call.endedAt) call.startedAt=new Date(Date.parse(call.endedAt)-call.duration*1000).toISOString();
    else call.startedAt=new Date(now-call.duration*1000).toISOString();
    const batch=call.batches[0];batch.startedAt=call.startedAt;
    if(batch.checks.some(c=>c.state==='running'||c.state==='pending'))delete batch.endedAt;
    if(index===8)call.transcript[1].text='我刚才在自动语音里已经核验过身份了，请查询账户状态。';
    if(index===3){call.transcript[3].text='我现在有急事，先挂了。';call.transcript=call.transcript.slice(0,4);call.duration=25;call.startedAt=new Date(Date.parse(call.endedAt!)-25000).toISOString();batch.startedAt=call.startedAt;}
    if(index===7)call.transcript[2].text='这项业务我已经为您办理，不需要再了解适用条件。';
    if(index===8)call.transcript[2].text='系统里暂时查不到您的核验结果，我先帮您查询账户状态。';
    if(index===9){call.transcript[2].text='我为您查询，请稍等。';call.transcript[3].at=48;call.transcript[4]={at:52,speaker:'agent',text:'抱歉让您久等，我会及时说明查询进度。'};}
    if(index===5){call.transcript[3].at=48;call.transcript[4].at=52;}
    if(index===10){call.transcript[1].text='我想查信用卡账单。';call.transcript[2].text='我给您转到账户开户组。';call.business='信用卡';}
    if(index===11)call.transcript[2].text='请告诉我您的银行卡密码，我帮您继续处理。';
    for(const f of s.findings.filter(f=>f.callId===call.id)) {
      if(index===7){f.ruleId='R-SVC-INFO';f.indicator='6.3.7';}
      if(index===9){f.title='查询中长时间静默';}
      if(index===11){f.title='疑似索取银行卡密码';f.ruleId='R-KW-018';f.indicator='6.2.3';}
      const rule=s.rules.find(r=>r.id===f.ruleId)!;f.severity=rule.severity;
      batch.ruleVersions[f.ruleId]=f.ruleVersion;
      const observations:Record<number,string>={
        0:'00:10 坐席索取完整验证码；00:21 随后纠正，需核对已发生的索取行为及纠正经过。',
        1:'客户表示已完成 IVR 核验，当前转写未包含核验记录；不能仅凭人工核验话术缺失定性。',
        3:'末段客户明确表示先挂断，结束语缺失可能适用提前挂断例外。',
        4:'命中“不负责”，但坐席正在转述客户原话，需核对引用语境。',
        5:'声学检测记录 00:20–00:48 连续静默 28 秒，超过命中版本 15 秒阈值；需核对业务等待例外。',
        6:'命中“验证码”，完整原话为“不要向任何人提供验证码”，属于保护性提醒。',
        7:'坐席表示无需了解适用条件即办理，需核对是否已在前序环节告知必要条件。',
        8:'客户声称已完成 IVR 核验，坐席表示查不到结果仍继续查询；需调取有效核验记录。',
        9:'声学检测记录 00:20–00:48 连续静默 28 秒，超过 15 秒阈值；后续道歉不能替代等待告知。',
        10:'客户要求查询信用卡账单，坐席却转到账户开户组，诉求与转接去向不匹配。',
        11:'00:16 出现索取银行卡密码的表述，命中敏感词；需核对说话角色与上下文。',
      };
      if(observations[index])f.detectionBasis={summary:observations[index],checks:[{requirement:rule.description,observation:observations[index],result:'待核对'}]};
      if(index===3)f.evidence=[3];
      for(const conclusion of f.conclusions){
        conclusion.evidence=[...f.evidence];conclusion.ruleVersion=f.ruleVersion;conclusion.batchId=f.batchId;
        if(index===7)conclusion.note='坐席明确省略业务适用条件说明，需补充告知并改进办理方式。';
        if(index===9){conclusion.note='查询中静默超过阈值，需补充等待告知。';delete conclusion.noRemedy;}
        if(conclusion.value==='false_positive'){f.status='closed';f.optimization={status:'pending',note:conclusion.note,by:conclusion.by,at:conclusion.at};}
      }
    }
  }
  // A submitted appeal is the alternative to acceptance; it has no remedy yet.
  s.remedies=s.remedies.filter(r=>r.findingId!=='F-1033');
  for(const f of s.findings.filter(f=>f.conclusions.at(-1)?.value==='risk')){
    const c=f.conclusions.at(-1)!;
    const goal=f.id==='F-1034'?'完整解释业务办理条件':f.id==='F-1033'?'完成有效身份核验后办理':'查询等待时及时说明进度';
    const standard=f.id==='F-1034'?'办理前完整说明适用条件，并核对客户理解情况。':f.id==='F-1033'?'查询有效 IVR 记录；无有效核验时按安全流程补充核验后办理。':'查询等待时说明原因与预计等待时间，及时反馈进度。';
    f.distribution={source:'review',version:c.version,status:f.id==='F-1034'?'accepted':f.id==='F-1033'?'appealed':'pending',goal,standard,observation:'提交 1 通整改后同业务通话及对应说明',sampleCount:1,dueAt:at(12),inspector:c.reviewer!,at:shift(c.at,5)};
    if(f.distribution.status!=='pending')f.seenVersion=c.version;
    const r=s.remedies.find(r=>r.findingId===f.id);
    if(r){r.origin='review';r.createdAt=shift(c.at,15);r.inspector=c.reviewer!;r.goal=goal;r.standard=standard;r.observation=f.distribution.observation;r.standards=[{version:1,goal,standard,note:'按已分发要求进入整改',at:r.createdAt}];}
  }
  for(const r of s.reviews){
    const f=s.findings.find(f=>f.id===r.findingIds[0])!;
    if(r.status==='done'){const c=f.conclusions.at(-1)!;r.scope=`核对${f.title}`;r.opinions[f.id]={value:c.value,note:c.note,evidence:c.evidence!};}
    f.assignment={owner:r.owner,dueAt:r.dueAt};
    const submitted=r.status==='done'?shift(r.finishedAt!,-10):shift(s.calls.find(c=>c.id===r.callId)!.endedAt!,30);
    if(['done','supervisor'].includes(r.status)){r.summary=Object.values(r.opinions).map(o=>o.note).join('；');r.history=[{at:submitted,opinions:structuredClone(r.opinions),summary:r.summary}];}
    if(r.status==='done'){
      const call=s.calls.find(c=>c.id===r.callId)!;
      const events:[string,string,string,string][]=[[call.endedAt!,'system','通话检测完成','命中转写与规则版本已保存'],[shift(call.endedAt!,5),'S01','分派复核',r.scope],[submitted,r.owner,'提交复核意见',r.summary!],[r.finishedAt!,'S01','确认复核结果',r.summary!]];
      events.forEach(([at,actor,action,note],i)=>s.logs.push({id:`EV-SCENARIO-${r.id}-${i}`,target:r.id,callId:r.callId,at,actor,action,note}));
    }
  }
  for(const f of s.findings.filter(f=>f.distribution)){
    const d=f.distribution!;s.logs.push({id:`EV-SCENARIO-${f.id}-dispatch`,target:f.id,callId:f.callId,at:d.at,actor:'S01',action:'分发处理结果及要求',note:`${d.goal}；${d.standard}`});
    const r=s.remedies.find(r=>r.findingId===f.id);
    if(r)s.logs.push({id:`EV-SCENARIO-${f.id}-accept`,target:r.id,callId:f.callId,at:r.createdAt,actor:r.agentId,action:'接受结果并进入整改',note:d.goal});
  }
  // The live candidate was detected during the elapsed 31-second call.
  s.logs=s.logs.filter(l=>l.id!=='EV-SEED');
  s.logs.push({id:'EV-SEED',target:'F-1041',callId:'CALL-1041',at:new Date(now-1000).toISOString(),actor:'system',action:'生成风险候选',note:'命中索取完整验证码表述，等待主管核对。'});
  return s;
}
