// 修复前诊断证据脚本；修复后回归请运行 scripts/pm-reconciliation.test.mjs。
// 只读评估：状态变更只发生在内存副本，不连接浏览器或修改业务数据。
// 运行：node --experimental-strip-types docs/reviews/6001-PM-评估证据-20260927/probes.mjs
import {createPrototypeState} from '../../../lib/prototype-seeds.ts';
import {apply,entity,contextActions,people,isTodo,currentOwner,latest} from '../../../lib/workflow.ts';
import {report} from '../../../lib/reports.ts';
import {teamReportVisuals} from '../../../lib/report-visuals.ts';
const now=new Date('2026-09-27T13:00:00+08:00');let seq=0;
const base=createPrototypeState(now);const as=(s,identity)=>({...s,identity});
const run=(s,id,action,input={},at=now)=>apply(s,{id,action,rev:entity(s,id).rev,requestId:`pm-probe-${++seq}`,input:{note:'本轮核对业务处理流程',...input}},at);
const filter={start:'',end:'',business:'',group:'',agent:''};
const metrics=report(base,filter,now);
console.log('REPORT_STATES',JSON.stringify({total:base.remedies.length,covered:metrics.filter(m=>m.key.startsWith('remedy-state-')).reduce((n,m)=>n+Number(m.value),0),missing:base.remedies.filter(r=>r.status==='response').map(r=>r.id)}));
const teams=teamReportVisuals(base,metrics,filter,'calls');console.log('FALSE_POSITIVES',JSON.stringify({overview:metrics.find(m=>m.key==='fp').note,teamFalsePositives:teams.agents.reduce((n,a)=>n+a.fp,0),manualRevoked:base.findings.filter(f=>f.source==='manual'&&latest(f)?.value==='false_positive').map(f=>f.id)}));
const f=entity(base,'F-1041');let s=run(base,f.id,'assign',{owner:'Q01',dueAt:new Date(+now+86400000).toISOString()});console.log('ALERT_DEADLINE',JSON.stringify({alertDue:f.alertTiming.resolutionDueAt,assignedReviewDue:s.reviews.at(-1).dueAt,accepted:true}));
const r=base.remedies.find(r=>r.status==='verification'&&r.inspector);if(r){s=run(base,r.id,'reassign',{owner:r.inspector==='Q01'?'Q02':'Q01',dueAt:new Date(+now+86400000).toISOString()});console.log('REASSIGN_DUE',JSON.stringify({id:r.id,before:r.dueAt,after:entity(s,r.id).dueAt,original:r.originalDueAt}));}
const ap=base.appeals.find(a=>a.status==='reviewing'&&a.reviewId);if(ap){const wr=entity(base,ap.reviewId);s=run(base,wr.id,'extend',{dueAt:new Date(+now+5*86400000).toISOString()});console.log('APPEAL_DUE',JSON.stringify({id:ap.id,review:wr.id,appeal:entity(s,ap.id).dueAt,reviewDue:entity(s,wr.id).dueAt}));}
const direct=base.remedies.find(r=>r.status==='executing'&&!r.inspector&&r.origin==='direct');if(direct){s=run(as(base,direct.agentId),direct.id,'adjust_request');console.log('ADJUST_BLOCK',JSON.stringify({id:direct.id,status:entity(s,direct.id).status,agentActions:contextActions(as(s,direct.agentId),direct.id),supervisorActions:contextActions(as(s,'S01'),direct.id),original:contextActions(as(base,direct.agentId),direct.id)}));}
const es=[...base.reviews,...base.appeals,...base.remedies,...base.findings,...base.supplements];for(const p of people){const s=as(base,p.id);console.log('TODOS_WITHOUT_DIRECT_ACTION',p.id,JSON.stringify(es.filter(e=>isTodo(s,e)&&!contextActions(s,e.id).length).map(e=>({id:e.id,owner:currentOwner(s,e),status:e.status}))));}
