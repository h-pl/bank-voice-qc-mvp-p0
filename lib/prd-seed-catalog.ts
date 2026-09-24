import { apply, entity, callFor, type State, type Finding, type Call, type Input, type Review, type Remedy, type Command } from './workflow.ts';
import { fieldDefaults, detectionFields, fixedResourceReferences, supportsWarning } from './strategy-schema.ts';
import { bindingFeatures } from './indicator-bindings.ts';
import { serializeRows } from './resource-import.ts';
import { parseCsv } from './csv.ts';

export type SeedDetection = { id:string; callId:string; batchId:string; ruleId:string; ruleVersion:number; execution:'success'|'failed'|'running'|'pending'; result?:'hit'|'no_hit'|'indeterminate'|'not_applicable'; role:'agent'|'customer'; range:[number,number]; evidence:number[]; resources:Record<string,number>; serviceVersion:string; feature:string; count:number; duration?:number; reason:string };
export type SeedWarning = { id:string; detectionId:string; callId:string; batchId:string; findingId?:string; policyId:string; policyVersion:number; result:'matched'|'not_matched'; conditions:Record<string,string>; level:'high'|'medium'; actions:string[]; at:string; reason:string };
export type SeedScenario = { id:string; label:string; callId:string; findingId?:string; reviewId?:string; appealId?:string; remedyId?:string; clauses:string[] };
export type PrdState = State & { seedIntegrityVersion?:number; seedPrd?:{url:string;revision:number}; seedScenarios?:SeedScenario[]; seedCommands?:{actor:string;at:string;command:Command}[]; detectionResults?:SeedDetection[]; warningDecisions?:SeedWarning[] };
const iso=(time:number)=>new Date(time).toISOString();

/** Build human states by executing the same commands as the UI, never by setting a target status. */
export function withPrdSeedCatalog(input:State,now:Date):PrdState {
 let s:PrdState=structuredClone(input);
 s.reviews=[];s.appeals=[];s.remedies=[];s.supplements=[];s.logs=[];s.requests=[];s.revision=1;
 const epoch=now.getTime(),published=epoch-240*3600000;
 const deadline=iso(epoch+48*3600000);
 for(const f of s.findings){f.rev=0;f.status='candidate';f.conclusions=[];f.related=[];delete f.assignment;delete f.reminder;delete f.distribution;delete f.optimization;delete f.seenVersion;}
 // Fresh PRD fixtures use only the documented resource schemas. Legacy snapshots stay in migration/test data.
 s.resources=s.resources.filter(r=>r.kind);
 for(const r of s.resources){r.name=r.name.replace(' · 银行示例','');r.versions=[{...structuredClone(r.versions.at(-1)!),version:1,at:iso(published+60000)}];delete r.draft;}
 for(const r of s.rules){r.versions=[{...structuredClone(r.versions.at(-1)!),version:1,at:iso(published+3660000)}];delete r.draft;delete r.checked;}

 function appendResource(id:string,rows:string[][]){const r=s.resources.find(r=>r.id===id)!;const v=r.versions.at(-1)!;v.content=serializeRows([...parseCsv(v.content),...rows]);}
 appendResource('RES-CFG-KEYWORD',[['银行卡密码','账户密码']]);
 appendResource('RES-CFG-BANNED',[['不负责','不当表达','引用客户原话或否定表述']]);
 appendResource('RES-CFG-KNOWLEDGE',[
  ['办理条件告知','办理前说明适用条件；费用以实际账单及业务查询结果为准，不承诺无依据的减免费用。','业务办理口径','2026-01-01','2026-12-31'],
  ['处理时限说明','已确认时说明预计时限，无法确认时说明原因及后续查询渠道。','进度查询规范','2026-01-01','2026-12-31'],
  ['业务转接说明','按客户诉求确认接收团队并说明转接原因，不将账单查询转给不承接该业务的开户团队。','业务转接规范','2026-01-01','2026-12-31'],
 ]);
 // Clear refusal is supported by the dialogue; the separate timing issue still needs additional facts.
 const serviceCall=s.calls.find(c=>c.id==='CALL-1039')!;
 serviceCall.transcript[2].text='这个问题我们不处理，您自己去找对方吧。';
 serviceCall.transcript[3].text='请告诉我应该联系哪个部门以及办理进度。';
 serviceCall.transcript[4].text='我不清楚后续处理时限，也不提供查询渠道。';
 const service=s.findings.find(f=>f.id==='F-1039')!;
 service.detectionBasis={summary:'00:16 明确拒绝处理并要求客户自行联系；00:32 仍未提供后续渠道，命中推诿表现。',checks:[{requirement:'结合上下文核对是否拒绝说明后续处理渠道',observation:'客户再次询问负责部门，坐席仍拒绝提供查询渠道。',result:'不符合'}]};
 const timing=s.findings.find(f=>f.id==='F-1039-B')!;
 timing.detectionBasis={summary:'00:32 未说明办理时限或查询渠道；需补充本业务受理记录，核对时限告知是否适用。',checks:[{requirement:'核对业务受理状态及可确认时限',observation:'现有通话未包含业务受理记录，不能直接作出正式结论。',result:'待补证'}]};
 for(const id of ['F-1031','F-UI-8']){const f=s.findings.find(f=>f.id===id)!;f.ruleId='R-SVC-INFO';f.indicator='6.3.7';f.detectionBasis={summary:'客户提出账单查询，坐席转接至开户团队；需核对业务转接规范和接收范围。',checks:[{requirement:'转接团队应承接客户诉求',observation:'账单查询与开户团队不一致。',result:'待核对'}]};}
 // A resource association is an indicator snapshot; notification criteria are separate policies.
 for(const r of s.rules.filter(r=>supportsWarning(r.indicator))){
  const v=r.versions.at(-1)!;v.resources=fixedResourceReferences(r,s);v.scope='全部业务';
  const policyId=`POL-${r.id}`,acoustic=r.indicator==='6.3.6',emotional=r.indicator==='6.2.5';
  const config={...fieldDefaults(detectionFields['6.3.4']),role:emotional?'客户':'坐席',stage:'全程',mode:acoustic||emotional?'持续时长':'单次命中',duration:emotional?'30':'15',level:r.severity==='high'?'高':'中',action:'通知',recipient:'所属主管',repeat:'每通话仅一次'};
  s.rules.push({id:policyId,rev:0,name:`${r.name}预警`,indicator:'6.3.4',description:'依据已发布的指标结果及触发条件生成预警，不替代人工结论。',severity:r.severity,fixedResources:true,versions:[{version:1,at:iso(published+7200000),scope:'全部业务',threshold:acoustic?15:1,trigger:acoustic?'连续静默达到 15 秒':'单次有效命中',resources:{},triggerRules:[r.id],config}]});
  const selected=acoustic?'静默':emotional?'焦虑':bindingFeatures(r,s)[0];
  v.bindings=bindingFeatures(r,s).map(feature=>({id:`${r.id}:${feature}`,feature,policyId:feature===selected?policyId:'none',conditions:{}}));v.policyVersions={[policyId]:1};
 }
 for(const f of s.findings){const r=s.rules.find(r=>r.id===f.ruleId)!;f.ruleVersion=r.versions.at(-1)!.version;f.severity=r.severity;}
 for(const c of s.calls)for(const b of c.batches)b.ruleVersions=Object.fromEntries(s.rules.filter(r=>r.indicator!=='6.3.4').map(r=>[r.id,r.versions.at(-1)!.version]));
 const manifest:SeedScenario[]=[],commands:NonNullable<PrdState["seedCommands"]>=[];
 let clock=epoch-3600000,seq=0;
 const find=(id:string)=>s.findings.find(f=>f.id===id)!;
 function run(id:string,actor:string,action:string,input:Input={}){
  clock+=60000;s.identity=actor;
  const f='conclusions' in entity(s,id)! ? find(id) : undefined;
  const command={id,rev:entity(s,id)!.rev,action,requestId:`SEED-PRD-${++seq}`,input:{note:'依据本次转写和业务记录核对',owner:'Q01',dueAt:deadline,evidence:f?.evidence ?? [2],...input}};
  s=apply(s,command,new Date(clock)) as PrdState;commands.push({actor,at:iso(clock),command});
 }
 function rename(old:string,id:string){s=JSON.parse(JSON.stringify(s).split(JSON.stringify(old)).join(JSON.stringify(id))) as PrdState;return id;}
 function begin(fid:string,label:string){const f=find(fid),call=callFor(s,fid)!;clock=Date.parse(call.endedAt ?? iso(epoch-600000))+120000;const row:SeedScenario={id:fid,label,callId:f.callId,findingId:fid,clauses:['7.3','7.4','7.11.3']};manifest.push(row);return row;}
 function requirements(fid:string):Input {const f=find(fid);return {goal:`改进${f.title}`,standard:f.indicator==='6.3.7'?'核对适用业务依据，完整说明办理条件、进度和后续查询渠道。':f.indicator==='6.3.6'?'等待前说明原因和预计时间，等待中主动反馈查询进度。':f.indicator==='6.3.8'?'使用安全核验渠道，不索取完整验证码或密码。':'回应客户核心诉求，说明可办理范围与正确处理渠道，不使用推诿表达。',observation:'提交整改后同业务通话及对应说明',sampleCount:1,dueAt:deadline};}
 function review(fid:string,id=`WO-${fid.slice(2)}`,owner='Q01') {run(fid,'S01','assign',{owner,note:`核对${find(fid).title}及业务上下文`});return rename(s.reviews.at(-1)!.id,id);}
 function submit(rid:string,value:'risk'|'false_positive'='risk',note?:string){const r=entity(s,rid) as Review;run(rid,r.owner,'submit_review',{opinions:Object.fromEntries(r.findingIds.map(fid=>[fid,{value,note:note ?? (value==='risk'?`${find(fid).detectionBasis?.summary} 已核对所列范围，确认非误报。`:'完整上下文符合规则例外，确认误报。'),evidence:find(fid).evidence}])),summary:note ?? '已核对本工单所列问题及证据，提交主管确认。'});}
 function publish(rid:string){const r=entity(s,rid) as Review;run(rid,'S01','publish',r.findingIds.length?requirements(r.findingIds[0]):{});}
 function accepted(fid:string,id=`REC-${fid.slice(2)}`){run(fid,callFor(s,fid)!.agentId,'accept_result');return rename(s.remedies.at(-1)!.id,id);}
 function appealed(fid:string,id=`AP-${fid.slice(2)}`){run(fid,callFor(s,fid)!.agentId,'appeal',{note:fid==='F-1033'?'通话前已进行 IVR 核验，请调取核验记录确认是否有效。':'现有片段缺少前序业务背景，请结合所附原话重新核查。',evidence:fid==='F-1033'?[1]:find(fid).evidence});return rename(s.appeals.at(-1)!.id,id);}
 function appealReview(ap:string){run(ap,'S01','accept_assign',{owner:'Q02',note:'指定另一位质检员核查申诉证据与业务依据'});return rename(s.reviews.at(-1)!.id,`WO-${ap}`);}
 function direct(fid:string){run(fid,'S01','dispatch',{...requirements(fid),note:`${find(fid).detectionBasis?.summary} 主管核对后分发处理要求。`});}
 function material(rid:string){const r=entity(s,rid) as Remedy,source=callFor(s,rid)!;clock+=120000;const start=clock,end=start+60000,id=`CALL-${rid}-ROUND-${r.round}`;
  const call:Call={id,rev:0,agentId:r.agentId,business:source.business,group:source.group,customer:'客户 · 尾号 6281',startedAt:iso(start),endedAt:iso(end),duration:60,authorized:[r.agentId,'Q01','Q02','S01'],sample:true,transcript:[{at:0,speaker:'agent',text:'您好，银行客服中心，工号1048，请问需要办理什么业务？'},{at:8,speaker:'customer',text:`我想了解${source.business}的办理进度和下一步。`},{at:16,speaker:'agent',text:'已通过安全渠道完成身份核验。当前申请正在处理中，具体处理时限暂无法确认；您可通过银行官方渠道查询进度。'},{at:32,speaker:'agent',text:'需要查询时我会说明等待原因并及时反馈。请勿向任何人提供完整验证码或密码。'},{at:45,speaker:'customer',text:'清楚了，谢谢。'},{at:52,speaker:'agent',text:'请问还有其他需要帮助的吗？感谢您的来电。'}],batches:[{id:`B-${id}`,startedAt:iso(end),endedAt:iso(end+30000),ruleVersions:{...source.batches[0].ruleVersions},checks:[{name:'转写',state:'success'},{name:'场景规则',state:'success'}]}]};s.calls.push(call);clock=end+30000;run(rid,r.agentId,'material',{samples:[id],note:'提交本轮同业务通话，请核对安全核验、业务说明及查询渠道。'});
 }
 function verify(rid:string,result:'pass'|'fail'='pass'){const r=entity(s,rid) as Remedy;run(rid,r.inspector,'verify',{value:result,note:result==='pass'?'本轮通话包含安全核验、办理进度和查询渠道，符合所列核验要求。':'尚缺可核对的业务处理记录，请补充相应材料后再次提交。'});}
 // Pending and review stages.
 begin('F-1041','实时通话待主管初审');
 {const row=begin('F-1040','身份核验资料待补充');row.reviewId=review(row.id,'WO-1038');run(row.reviewId,'Q01','request_evidence',{note:'请补充 IVR 核验结果和有效期记录，资料齐全后再提交结论。'});run(row.reviewId,'S01','supplement',{owner:callFor(s,row.id)!.agentId,note:'请补充本次 IVR 回执以及有效期记录。'});const sp=s.supplements.at(-1)!.id;run(sp,callFor(s,row.id)!.agentId,'reply',{note:'已提交核验回执，回执暂未包含有效期信息。',attachment:'IVR回执.pdf'});run(sp,'S01','receive_supplement',{note:'补件已收到，交原质检员核对有效期是否完整。'});run(row.reviewId,'Q01','save_review',{opinions:{},summary:'已收到回执，仍缺有效期依据，继续核实；不提交正式结论。'});}
 {const row=begin('F-1039','非误报复核待主管确认');row.reviewId=review(row.id);submit(row.reviewId);}
 {const row=begin('F-1039-B','同通话另一问题独立核实');row.reviewId=review(row.id);run(row.reviewId,'Q01','save_review',{opinions:{},summary:'需补充信用卡申请受理记录及可确认时限，当前继续核实，不提交正式结论。'});}
 {const row=begin('F-1038','复核后误报归档');row.reviewId=review(row.id,'WO-D-3');submit(row.reviewId,'false_positive','末段客户明确表示先挂断，符合结束语例外。');publish(row.reviewId);}
 {const row=begin('F-1037','主管直接确认误报');run(row.id,'S01','dismiss',{value:'false_positive',note:'坐席正在转述客户原话中的“不负责”，并非主动使用禁用表达。'});}
 {const row=begin('F-1036','直接分发后接受·尚未指派');direct(row.id);row.remedyId=accepted(row.id);}
 {const row=begin('F-1035','自动预警申诉成立归档');direct(row.id);row.appealId=appealed(row.id);row.reviewId=appealReview(row.appealId);submit(row.reviewId,'false_positive','完整句子为“不要向任何人提供验证码”，属于保护性提醒而非索取。');run(row.appealId,'S01','decide',{value:'false_positive',evidence:find(row.id).evidence,note:'认可申诉核查意见，原预警为否定语境误报。'});}
 {const row=begin('F-1034','复核确认后接受整改');row.reviewId=review(row.id,'WO-D-7');submit(row.reviewId);publish(row.reviewId);row.remedyId=accepted(row.id);}
 {const row=begin('F-1033','不接受处理结果·待指派申诉核查');row.reviewId=review(row.id,'WO-D-8');submit(row.reviewId);publish(row.reviewId);row.appealId=appealed(row.id);}
 {const row=begin('F-1032','分发后尚未选择');row.reviewId=review(row.id,'WO-D-9');submit(row.reviewId);publish(row.reviewId);}
 begin('F-1031','业务转接预警待初审');begin('F-1030','敏感关键词预警待初审');
 {const row=begin('F-UI-1','已交资料·待指派核验');direct(row.id);row.remedyId=accepted(row.id);material(row.remedyId);}
 {const row=begin('F-UI-2','直接分发整改·已指派待核验');direct(row.id);row.remedyId=accepted(row.id);material(row.remedyId);run(row.remedyId,'S01','assign_inspector',{owner:'Q02',note:'已提交资料，由质检员核验，保留原资料和期限。'});}
 {const row=begin('F-UI-3','质检员不赞同退回·主管复审');direct(row.id);row.remedyId=accepted(row.id);run(row.remedyId,'S01','assign_inspector',{owner:'Q02'});material(row.remedyId);verify(row.remedyId);run(row.remedyId,'S01','return_remedy',{note:'请进一步说明等待告知是否覆盖完整业务等待过程。'});run(row.remedyId,'Q02','explain_remedy',{note:'本轮 00:32 说明等待原因与反馈方式，原核验范围与证据完整，维持满足要求建议。'});}
 {const row=begin('F-UI-4','否定语境继续核实');row.reviewId=review(row.id,'WO-UI-4','Q02');run(row.reviewId,'Q02','save_review',{opinions:{},summary:'正在核对否定语境与原始转写，尚未形成正式复核结论。'});}
 {const row=begin('F-UI-5','待质检员核实·已逾期');row.reviewId=review(row.id,'WO-UI-5');const r=entity(s,row.reviewId) as Review; // Deadline is an input, never a status mutation.
  run(r.id,'S01','extend',{dueAt:iso(epoch-3600000),note:'依据本次核实安排调整期限，保留原期限记录。'});}
 {const row=begin('F-UI-6','赞同主管意见·下一轮整改');row.reviewId=review(row.id,'WO-UI-6','Q02');submit(row.reviewId);publish(row.reviewId);row.remedyId=accepted(row.id);material(row.remedyId);verify(row.remedyId);run(row.remedyId,'S01','return_remedy',{note:'尚需核对业务查询渠道是否为可办理的实际渠道。'});run(row.remedyId,'Q02','agree_remedy_return',{note:'赞同，需要补充实际查询渠道及业务受理记录，请坐席补充整改资料。'});}
 {const row=begin('F-UI-7','申诉主管退回·待质检员回应');row.reviewId=review(row.id,'WO-UI-7');submit(row.reviewId);publish(row.reviewId);row.appealId=appealed(row.id);const ar=appealReview(row.appealId);submit(ar);run(row.appealId,'S01','return_appeal',{note:'请复核前序 IVR 记录是否在有效期内，说明与人工查询的关联。'});}
 {const row=begin('F-UI-8','申诉不成立·沿用核查人完成整改');row.reviewId=review(row.id,'WO-UI-8');submit(row.reviewId);publish(row.reviewId);row.appealId=appealed(row.id);const ar=appealReview(row.appealId);submit(ar);run(row.appealId,'S01','return_appeal',{note:'请补充所转团队不承接该诉求的业务依据。'});run(ar,'Q02','explain_appeal',{note:'已核对转接规范，开户团队不承接账单查询，维持原核查意见。'});run(row.appealId,'S01','return_appeal',{note:'请进一步核对当时是否存在临时转接安排。'});run(ar,'Q02','agree_appeal_return',{note:'赞同补充核对安排，再次核实当时的业务转接范围。'});submit(ar);run(row.appealId,'S01','decide',{...requirements(row.id),value:'maintain',evidence:find(row.id).evidence,note:'认可核查结果，维持原结论并明确整改要求。'});row.remedyId=rename(s.remedies.at(-1)!.id,`REC-${row.id.slice(2)}`);material(row.remedyId);verify(row.remedyId);run(row.remedyId,'S01','close_remedy',{note:'核验意见及业务依据完整，确认整改完成。'});}
 function cloneScenario(sourceId:string,suffix:string){const source=find(sourceId),call=callFor(s,sourceId)!;const cid=`CALL-${suffix}`,fid=`F-${suffix}`;const copy:Call={...structuredClone(call),id:cid,rev:0,startedAt:iso(epoch-36*3600000),endedAt:iso(epoch-36*3600000+call.duration*1000),authorized:['S01','Q01','Q02',call.agentId]};copy.batches=copy.batches.map(b=>({...b,id:`B-${suffix}`,startedAt:copy.startedAt,endedAt:copy.endedAt}));s.calls.push(copy);const f:Finding={...structuredClone(source),id:fid,rev:0,callId:cid,batchId:`B-${suffix}`,status:'candidate',conclusions:[]};delete f.distribution;delete f.optimization;delete f.assignment;delete f.seenVersion;s.findings.push(f);return fid;}
 {const fid=cloneScenario('F-UI-7','AP-SUPPLEMENT'),row=begin(fid,'申诉核查·待坐席补件');direct(fid);row.appealId=appealed(fid);row.reviewId=appealReview(row.appealId);run(row.reviewId,'Q02','supplement',{note:'请提供本次 IVR 核验回执及其对应通话记录。',owner:callFor(s,fid)!.agentId});}
 {const fid=cloneScenario('F-UI-7','AP-DECISION'),row=begin(fid,'申诉补件后·待主管裁定');direct(fid);row.appealId=appealed(fid);row.reviewId=appealReview(row.appealId);run(row.reviewId,'Q02','supplement',{note:'请提供原 IVR 核验回执与有效期记录。',owner:callFor(s,fid)!.agentId});const sp=s.supplements.at(-1)!.id;run(sp,callFor(s,fid)!.agentId,'reply',{note:'已提交对应通话核验回执，回执显示本次核验未成功。',attachment:'核验回执.pdf'});run(sp,'Q02','receive_supplement',{note:'已核对回执属于本次通话，回执显示核验未通过。'});submit(row.reviewId);}
 {const fid=cloneScenario('F-UI-6','REC-RESPONSE'),row=begin(fid,'整改核验·主管退回质检员');direct(fid);row.remedyId=accepted(fid);run(row.remedyId,'S01','assign_inspector',{owner:'Q02'});material(row.remedyId);verify(row.remedyId);run(row.remedyId,'S01','return_remedy',{note:'请说明所附样例是否覆盖本次全部整改要求。'});}
 {const fid=cloneScenario('F-UI-6','REC-FAIL'),row=begin(fid,'质检员核验不满足·新一轮整改');direct(fid);row.remedyId=accepted(fid);run(row.remedyId,'S01','assign_inspector',{owner:'Q02'});material(row.remedyId);verify(row.remedyId,'fail');}
 // Manual sampling includes no-findings completion; it does not manufacture false-positive warnings.
 for(const [index,stage] of ['pending','supervisor','done','found','revoked'].entries()){
  const cid=`CALL-${1025-index}`,call=entity(s,cid) as Call;call.authorized=['S01','Q01','Q02',call.agentId];clock=Date.parse(call.endedAt!)+120000;
  call.transcript=[{at:0,speaker:'agent',text:'您好，银行客服中心，工号1048，请问需要办理什么业务？'},{at:8,speaker:'customer',text:'我想查询业务办理进度和预计处理时间。'},{at:16,speaker:'agent',text:stage==='found'?'已通过安全渠道核验身份。我不说明后续查询渠道，您自己查询。':'已通过安全渠道完成身份核验，当前申请正在处理中。'},{at:24,speaker:'agent',text:stage==='found'?'后续处理时限也不向您说明。':'暂无法确认具体时限，您可以通过银行官方渠道继续查询进度。'},{at:40,speaker:'customer',text:'知道了，没有其他问题。'},{at:46,speaker:'agent',text:'感谢您的来电，再见。'}];
  run(cid,'S01','spotcheck',{scope:'核对安全核验、业务办理进度及时限告知',owner:'Q02'});const rid=rename(s.reviews.at(-1)!.id,`WO-SPOT-${index+1}`);const row:SeedScenario={id:rid,label:`人工抽检·${{pending:'核实中',supervisor:'未发现问题待确认',done:'未发现问题已完成',found:'发现问题后整改完成',revoked:'人工问题申诉成立'}[stage]}`,callId:cid,reviewId:rid,clauses:['7.3','7.5','7.11.3']};manifest.push(row);
  if(stage==='pending')continue;
  if(['supervisor','done'].includes(stage)){run(rid,'Q02','submit_review',{value:'clear',summary:'已核对安全核验、办理进度和时限告知范围，未发现问题。'});if(stage==='done')publish(rid);continue;}
  run(rid,'Q02','add_finding',{title:'人工发现处理时限告知待核对',ruleId:'R-SOP-TIME',evidence:[3]});const fid=rename(s.findings.at(-1)!.id,`F-SPOT-${index+1}`);row.findingId=fid;find(fid).detectionBasis={summary:stage==='found'?'人工核实发现未说明时限及查询渠道。':'人工核实对时限告知适用条件存在疑问，需要核对业务记录。',checks:[]};submit(rid);publish(rid);
  if(stage==='found'){row.remedyId=accepted(fid);material(row.remedyId);verify(row.remedyId);run(row.remedyId,'S01','close_remedy',{note:'整改资料与核验意见齐全，确认本次整改完成。'});}
  else {row.appealId=appealed(fid);run(row.appealId,'S01','accept_assign',{owner:'Q01',note:'由另一位质检员核对本次业务时限与查询渠道说明。'});const ar=rename(s.reviews.at(-1)!.id,`WO-${row.appealId}`);submit(ar,'false_positive','原话已说明无法确认时限的原因及查询渠道，本次人工判断不成立。');run(row.appealId,'S01','decide',{value:'false_positive',evidence:[2,3],note:'认可申诉核查意见，撤销人工问题；无原自动预警，不新增预警档案。'});}
 }
 // Keep detection execution, indicator outputs and warning decisions separate (PRD 7.8 / 7.11).
 const detections:SeedDetection[]=[],warnings:SeedWarning[]=[];
 for(const c of s.calls){
  const b=c.batches[0],transcription=b.checks.find(x=>x.name==='转写');
  if(transcription?.state==='failed'||transcription?.state==='pending')c.transcript=[];
  if(transcription?.state==='running'&&c.endedAt)c.transcript=c.transcript.slice(0,1);
  const frozen=b as typeof b & {policyVersions:Record<string,number>;resourceVersions:Record<string,number>};
  frozen.policyVersions=Object.fromEntries(s.rules.filter(r=>r.indicator==='6.3.4').map(r=>[r.id,r.versions.at(-1)!.version]));
  frozen.resourceVersions=Object.assign({},...s.rules.filter(r=>r.indicator!=='6.3.4').map(r=>r.versions.find(v=>v.version===b.ruleVersions[r.id])?.resources??{}));
  for(const r of s.rules.filter(r=>r.indicator!=='6.3.4')){
   const f=s.findings.find(f=>f.callId===c.id&&f.ruleId===r.id&&f.source==='auto');const v=r.versions.find(v=>v.version===(f?.ruleVersion??b.ruleVersions[r.id]))!;
   const check=r.indicator==='6.2.2'?transcription:b.checks.find(x=>x.name==='场景规则');
   const execution=f?'success':check?.state??'success';const acoustic=r.indicator==='6.3.6';
   const range:[number,number]=f&&acoustic?(f.id==='F-UI-3'?[22,62]:[20,48]):[0,c.duration];
   const outcome=execution==='success'?(f?'hit':r.indicator==='6.2.1'?'indeterminate':'no_hit'):undefined;
   const evidence=f?.evidence??[];
   const result:SeedDetection={id:`D-${c.id}-${r.id}`,callId:c.id,batchId:b.id,ruleId:r.id,ruleVersion:v.version,execution,...(supportsWarning(r.indicator)&&outcome?{result:outcome}:{}),role:'agent',range,evidence,resources:structuredClone(v.resources),serviceVersion:'qc-detection-1.0',feature:acoustic?'静默':bindingFeatures(r,s)[0]??'转写处理',count:f?1:0,...(f&&acoustic?{duration:range[1]-range[0]}:{}),reason:f?.detectionBasis?.summary??(execution!=='success'?'执行尚未成功，不输出未命中结论。':r.indicator==='6.2.1'?'缺少可用注册声纹及比对输入，无法确认身份。':'已保存本次检查范围内的处理结果。')};
   detections.push(result);
   if(f){
    const policy=s.rules.find(x=>x.id===`POL-${r.id}`)!;const pv=policy.versions.at(-1)!;const time=c.endedAt?b.endedAt??c.endedAt:iso(epoch-1000);
    warnings.push({id:`W-${f.id}`,detectionId:result.id,callId:c.id,batchId:b.id,findingId:f.id,policyId:policy.id,policyVersion:pv.version,result:'matched',conditions:structuredClone(pv.config!),level:f.severity,actions:pv.config!.action.split('；'),at:time,reason:acoustic?`同一角色连续静默 ${result.duration} 秒，达到策略 15 秒阈值。`:'本规则在坐席、全程范围内有效检出 1 次，满足单次命中条件。'});
    s.logs.push({id:`EV-PRD-DETECTION-${f.id}`,target:f.id,callId:c.id,at:time,actor:'system',action:'满足预警策略并生成预警',note:`${policy.name} · V${pv.version}；${warnings.at(-1)!.reason}`});
   }
  }
 }
 // A positive indicator result below the warning threshold remains a call result, not a Finding.
 const quietCall=s.calls.find(c=>c.id==='CALL-1018')!,emotion=s.rules.find(r=>r.id==='R-EM-002')!,pv=s.rules.find(r=>r.id===`POL-${emotion.id}`)!.versions.at(-1)!;
 const short=detections.find(d=>d.callId===quietCall.id&&d.ruleId===emotion.id)!;
 short.result='hit';short.role='customer';short.feature='焦虑';short.range=[8,18];short.duration=10;short.count=1;short.evidence=[1];short.reason='客户 00:08–00:18 表达焦虑，连续 10 秒。';quietCall.transcript[1].text='我有些担心这笔转账的进度，能帮我确认一下吗？';
 warnings.push({id:'W-BELOW-THRESHOLD',detectionId:short.id,callId:quietCall.id,batchId:short.batchId,policyId:`POL-${emotion.id}`,policyVersion:pv.version,result:'not_matched',conditions:structuredClone(pv.config!),level:'medium',actions:[],at:quietCall.endedAt!,reason:'焦虑连续 10 秒，未达到策略 30 秒阈值，不生成预警。'});
 manifest.push({id:'DETECTION-BELOW-THRESHOLD',label:'指标检出但未满足预警策略',callId:quietCall.id,clauses:['7.8','7.9.3','7.11.3']});
 // Preserve every command event and avoid treating seed requests as user actions on first load.
 s.logs=s.logs.map((l,i)=>({...l,id:l.id.startsWith('EV-PRD-')?l.id:`EV-PRD-${i}`})).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 for(const task of [...s.reviews,...s.appeals,...s.remedies])if(Date.parse(task.dueAt)<epoch&&!['done','cancelled','terminated'].includes(task.status))task.firstOverdueAt??=task.dueAt;
 s.identity='S01';s.revision=1;s.requests=[];s.seedIntegrityVersion=2;s.seedScenarios=manifest;s.seedCommands=commands;s.detectionResults=detections;s.warningDecisions=warnings;
 s.seedPrd={url:'https://acnc6zeentra.feishu.cn/docx/HfCadGmEroohoOx1qikcA2yAnfh',revision:464};
 return s;
}
