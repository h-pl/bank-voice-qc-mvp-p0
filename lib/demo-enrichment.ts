import type { State, Finding, Review, Resource } from './workflow.ts';

/** One-time additive demo migration. Existing user changes and deleted records are retained. */
export function withRichDemo(input: State): State {
  if(input.demoUiVersion === 1) return input;
  const state=structuredClone(input);
  const live=state.calls.find(call=>call.id==='CALL-1041');
  const base=live ? Date.parse(live.startedAt)+live.duration*1000 : Math.max(...state.calls.map(call=>Date.parse(call.startedAt)));
  const at=(hours:number)=>new Date(base+hours*3600000).toISOString();
  const scenarios:[string,string,string,string,Finding['status'],Review['status']?][]=[
    ['转账到账时间承诺待核对','转账汇款','R-SVC-INFO','这笔跨行转账肯定马上到账，不需要再查询。','candidate'],
    ['信用卡费用说明缺少适用条件','信用卡','R-SVC-INFO','后续不会产生任何费用，您不用查看账单规则。','candidate'],
    ['查询中长时间静默','账户查询','R-AC-003','请稍等，我正在查询您的账户状态。','candidate'],
    ['坐席否定语境中的敏感词命中','账户查询','R-KW-018','不要告诉我完整验证码，我们不会索取这类信息。','review','working'],
    ['挂失办理结束语待确认','信用卡','R-SVC-002','您的挂失登记已经完成。','review','pending'],
    ['转账争议中服务表达生硬','转账汇款','R-SVC-009','这不是我们负责的问题，您自己联系对方吧。','review','supervisor'],
    ['IVR 失效后人工核验步骤遗漏','账户查询','R-SOP-006','前面的验证没有成功，不过我先帮您查询。','review','supervisor'],
    ['业务转接与客户诉求不一致','信用卡','R-INT-001','您要查信用卡账单，我给您转到账户开户组。','candidate'],
  ];
  scenarios.forEach(([title,business,ruleId,quote,status,reviewStatus],index)=>{
    const callId=`CALL-UI-${index+1}`,findingId=`F-UI-${index+1}`,reviewId=`WO-UI-${index+1}`;
    if(state.calls.some(call=>call.id===callId) || state.findings.some(f=>f.id===findingId))return;
    const rule=state.rules.find(rule=>rule.id===ruleId);if(!rule)return;
    const version=rule.versions.at(-1)!;const startedAt=at(-index-1),endedAt=new Date(Date.parse(startedAt)+185000+index*17000).toISOString();
    const agentId=index%2 ? 'A1186' : 'A1048';
    state.calls.push({id:callId,rev:0,agentId,business,group:index%2?'客服二组':'客服一组',customer:`客户 ${index+1}`,startedAt,endedAt,duration:185+index*17,authorized:['S01','Q01','Q02',agentId],transcript:[{at:0,speaker:'customer',text:`您好，我想咨询${business}的处理情况。`},{at:18,speaker:'agent',text:quote},{at:index===2?62:42,speaker:'customer',text:'请帮我核对具体依据和后续处理方式。'}],batches:[{id:`B-UI-${index+1}`,startedAt:endedAt,endedAt:new Date(Date.parse(endedAt)+60000).toISOString(),ruleVersions:Object.fromEntries(state.rules.map(r=>[r.id,r.versions.at(-1)!.version])),checks:[{name:'转写',state:'success'},{name:'场景规则',state:'success'}]}]});
    const finding:Finding={id:findingId,rev:0,callId,title,indicator:rule.indicator,related:[],ruleId,ruleVersion:version.version,batchId:`B-UI-${index+1}`,source:'auto',severity:index===1 || index===6?'high':'medium',evidence:[1],status,conclusions:[]};
    if(status==='reminded')finding.reminder={text:'查询等待时请说明原因并告知客户预计等待时间。',sentAt:at(-index-0.5),readAt:at(-index-0.4),feedback:'已向客户说明查询进度。'};
    const summary=index===2?'声学检测记录 00:22–01:02 连续静默 40 秒，超过命中版本 15 秒阈值；需核对业务等待例外。':`${quote} 需按“${rule.name}”核对说话角色、完整上下文及适用例外。`;
    finding.detectionBasis={summary,checks:[{requirement:rule.description,observation:summary,result:'待核对'}]};
    state.findings.push(finding);
    const log=(target:string,hours:number,actor:string,action:string,note:string)=>state.logs.push({id:`EV-UI-${target}-${action}`,target,callId,at:at(hours),actor,action,note});
    log(findingId,-index-1+(185+index*17+60)/3600,'system','生成风险候选',`命中${rule.name}，请结合原话与业务上下文核对。`);
    if(finding.reminder)log(findingId,-index-0.5,'S01','提醒坐席',finding.reminder.text);
    if(reviewStatus){
      const review:Review={id:reviewId,rev:0,callId,findingIds:[findingId],type:'candidate',scope:title,owner:index%2?'Q02':'Q01',dueAt:at(24+index*3),originalDueAt:at(24+index*3),status:reviewStatus,opinions:{},history:[]};
      if(reviewStatus==='supervisor'){
        review.opinions[findingId]={value:'risk',note:index===6?'原话明确核验未成功后继续办理，建议主管结合核验记录确认。':'原话存在推诿表达，已结合前后文复核，等待主管确认。',evidence:[1]};
        review.summary='已核对现有转写与规则依据，提交主管确认。';
        review.history.push({at:at(-index+0.4),opinions:structuredClone(review.opinions),summary:review.summary});
      }
      finding.assignment={owner:review.owner,dueAt:review.dueAt};
      state.reviews.push(review);
      log(reviewId,-index-0.6,'S01','分派复核',`核对${title}，核对现有转写与规则版本。`);
      if(reviewStatus==='working')log(reviewId,-index-0.2,review.owner,'开始复核','正在核对命中片段及否定语境，尚未提交正式意见。');
      if(reviewStatus==='supervisor')log(reviewId,-index+0.4,review.owner,'提交复核意见',review.summary!);
    }
  });
  for(const review of state.reviews){
    if(review.rev===0 && review.scope==='示例已完成复核')review.scope=`${state.findings.find(f=>f.id===review.findingIds[0])?.title ?? '通话问题'}复核`;
  }
  const resources:[Resource['type'],string,string,string,boolean][]=[
    ['SOP','信用卡挂失办理流程','挂失登记：核对客户身份，确认卡片状态，登记挂失申请，告知后续补卡方式；\n补卡指引：确认收件信息，说明进度查询方式；','信用卡',false],
    ['SOP','跨行转账查询流程','进度查询：完成身份核验，核对转账信息，查询处理状态，说明后续跟进方式；','转账汇款',true],
    ['词库','服务沟通不当表达','你自己处理\n别再问了\n我也没办法','全部业务',false],
    ['词库','过度承诺表达','保证立即到账\n绝对没有费用\n肯定审批通过','全部业务',true],
    ['业务知识','信用卡账单查询口径','账单问题应先核对账期与交易状态。费用及减免以当前业务查询结果为准，不能作无依据承诺。','信用卡',false],
    ['业务知识','账户异常处理指引','账户状态异常时，完成身份核验后查询限制原因，并说明适用的处理渠道及需补充材料。','账户查询',false],
  ];
  resources.forEach(([type,name,content,scope,draft],index)=>{
    const id=`RES-UI-${index+1}`;if(state.resources.some(r=>r.id===id))return;
    const snapshot={content,scope,role:'坐席',exception:'实际办理以核实后的业务依据为准。',sourceFile:type==='SOP'?'sop-template.csv':undefined};
    state.resources.push({id,rev:0,type,name,versions:draft?[]:[{...snapshot,version:1,at:at(-72-index*12)}],...(draft?{draft:snapshot,draftRuleIds:[type==='SOP'?'R-SOP-006':'R-KW-018'],checked:false}:{})});
  });
  state.demoUiVersion=1;
  return state;
}
