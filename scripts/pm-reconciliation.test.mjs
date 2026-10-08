import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {apply,entity,actions,latest,visibleTaskTarget} from '../lib/workflow.ts';
import {taskDeadlineLimit,defaultTaskDeadline} from '../lib/task-deadlines.ts';
import {caseSearchText} from '../lib/case-search.ts';
import {report,reportCsv} from '../lib/reports.ts';
import {teamReportVisuals,issueReportVisuals} from '../lib/report-visuals.ts';
import {distributionReminders} from '../lib/distribution-reminders.ts';
const now=new Date('2026-09-27T05:00:00Z');
const seed=()=>createPrototypeState(now), as=(s,identity)=>({...s,identity});
let seq=0;
const run=(s,id,action,input={},at=now)=>apply(s,{id,action,rev:entity(s,id).rev,requestId:`pm-${++seq}`,input:{note:'核对原始证据并说明本次处理理由',...input}},at);
const filter={start:'',end:'',business:'',group:'',agent:''};
test('review deadlines reserve supervisor time; assign/extend/return/reassign reject overflow',()=>{
 const s=seed(),f=entity(s,'F-1041'),limit=taskDeadlineLimit(s,f),before=structuredClone(s);
 assert.ok(Date.parse(defaultTaskDeadline(s,f,'assign',+now))<=Date.parse(limit));
 assert.throws(()=>run(s,f.id,'assign',{owner:'Q01',dueAt:new Date(+now+86400000).toISOString()}),/超过上级/);
 assert.deepEqual(s,before);
 let next=run(s,f.id,'assign',{owner:'Q01',dueAt:limit});const r=next.reviews.at(-1);
 for(const action of ['extend','reassign'])assert.throws(()=>run(next,r.id,action,{owner:'Q02',dueAt:new Date(Date.parse(limit)+60000).toISOString()}),/超过上级/);
 assert.deepEqual(entity(next,f.id).alertTiming,f.alertTiming);
 r.status='supervisor';r.opinions={[f.id]:{value:'risk',note:'核对证据确认问题',evidence:f.evidence}};
 assert.throws(()=>run(next,r.id,'return_review',{dueAt:new Date(Date.parse(limit)+60000).toISOString()}),/超过上级/);
});
test('reassignment retains expired deadline and history unless explicitly changed',()=>{
 let s=seed();const r=s.remedies.find(r=>r.status==='executing'&&r.inspector);r.dueAt=new Date(+now-60000).toISOString();
 const old=r.dueAt,version=r.standardVersion;
 s=run(s,r.id,'reassign',{owner:r.inspector==='Q01'?'Q02':'Q01'});
 assert.equal(entity(s,r.id).dueAt,old);assert.equal(entity(s,r.id).firstOverdueAt,old);assert.equal(entity(s,r.id).standardVersion,version);
});
test('appeal child deadline cannot exceed parent deadline',()=>{
 const s=seed(),ap=s.appeals.find(a=>a.status==='reviewing'&&a.reviewId),r=entity(s,ap.reviewId);
 assert.throws(()=>run(s,r.id,'extend',{dueAt:new Date(Date.parse(ap.dueAt)+60000).toISOString()}),/超过上级/);
});
test('visible appeal title is searchable; unrelated sibling title is excluded',()=>{
 const s=seed(),ap=entity(s,'AP-1033'),f=entity(s,ap.findingId);assert.ok(caseSearchText(s,ap).includes(f.title.toLowerCase()));
 const sibling=s.findings.find(x=>x.callId===f.callId&&x.id!==f.id);if(sibling){sibling.title='唯一无关兄弟标题';assert.ok(!caseSearchText(s,ap).includes(sibling.title));}
});
test('manual revoked findings open a visible original case without manufacturing alerts',()=>{
 const s=seed(),f=entity(s,'F-SPOT-5'),target=entity(s,visibleTaskTarget(s,f.id));
 assert.notEqual(target.id,f.id);assert.ok('findingId' in target || 'findingIds' in target);
 assert.equal(f.source,'manual');assert.equal(latest(f).value,'false_positive');
});
test('remedy stages conserve every record; appeals and manual revocations have contextual labels in CSV',()=>{
 const s=seed(),metrics=report(s,filter,now),stages=metrics.filter(m=>m.key.startsWith('remedy-state-'));
 const ids=stages.flatMap(m=>m.rows.map(r=>r.id));assert.equal(ids.length,s.remedies.length);assert.equal(new Set(ids).size,ids.length);
 assert.ok(stages.find(m=>m.key==='remedy-state-response').rows.some(r=>r.id==='REC-REC-RESPONSE'));
 const appeals=metrics.find(m=>m.key==='appealchange');assert.equal(appeals.rows.find(r=>r.id==='AP-SPOT-5').status,'申诉成立·撤销原结论');
 assert.match(reportCsv(appeals,s,now.toISOString(),filter),/申诉成立·撤销原结论/);
 const teams=teamReportVisuals(s,metrics,filter,'calls');assert.equal(teams.agents.reduce((n,a)=>n+a.fp,0),3);assert.equal(teams.agents.reduce((n,a)=>n+a.manualRevoked,0),1);
 assert.ok(issueReportVisuals(s,metrics,'manual').verdicts.find(v=>v.key==='manual_revoked').rows.some(r=>r.id==='F-SPOT-5'));
});
test('rejecting an adjustment and approving only a deadline both restore agent work without changing standard',()=>{
 for(const action of ['reject_adjustment','extend']){
  let s=seed();const r=s.remedies.find(r=>r.status==='executing'&&!r.inspector&&r.origin==='direct');const version=r.standardVersion;
  s=run(as(s,r.agentId),r.id,'adjust_request');assert.ok(actions(as(s,'S01'),r.id).includes('reject_adjustment'));
  s=run(as(s,'S01'),r.id,action,action==='extend'?{dueAt:new Date(+now+86400000).toISOString()}:{});
  assert.equal(entity(s,r.id).standardVersion,version);assert.ok(actions(as(s,r.agentId),r.id).includes('material'));
 }
});
test('response reminders are stable, scoped, and accepting late keeps original completion deadline',()=>{
 let s=seed();const f=entity(s,'F-1041');s=run(s,f.id,'dispatch',{goal:'请规范安全核验操作',standard:'逐项执行安全核验并提交资料',observation:'提交整改后样例',sampleCount:1,evidence:f.evidence,dueAt:new Date(+now+3600000).toISOString(),responseDueAt:new Date(+now+1800000).toISOString()});
 const agent=s.calls.find(c=>c.id===f.callId).agentId;
 const a=distributionReminders(as(s,agent),+now+1900000),b=distributionReminders(as(s,agent),+now+2000000);assert.ok(a.some(e=>e.target===f.id));assert.deepEqual(a.map(e=>e.id),b.map(e=>e.id));assert.equal(distributionReminders(as(s,'Q01'),+now+1900000).length,0);
 s=run(as(s,agent),f.id,'accept_result',{},new Date(+now+3700000));const r=s.remedies.find(r=>r.findingId===f.id);
 assert.equal(r.dueAt,new Date(+now+3600000).toISOString());assert.equal(r.firstOverdueAt,r.dueAt);assert.ok(entity(s,f.id).distribution.responseOverdueAt);
 assert.ok(!distributionReminders(as(s,'S01'),+now+4000000).some(e=>e.target===f.id));
});
test('pending distribution extension does not accept or create remedy, preserves overdue facts',()=>{
 let s=seed();const f=entity(s,'F-1041');s=run(s,f.id,'dispatch',{goal:'请规范安全核验操作',standard:'逐项执行安全核验并提交资料',observation:'提交整改后样例',sampleCount:1,evidence:f.evidence,dueAt:new Date(+now+3600000).toISOString(),responseDueAt:new Date(+now+1800000).toISOString()});
 const agent=s.calls.find(c=>c.id===f.callId).agentId;
 s=run(as(s,agent),f.id,'request_distribution_extension',{},new Date(+now+2000000));
 s=run(as(s,'S01'),f.id,'adjust_distribution',{dueAt:new Date(+now+86400000).toISOString(),responseDueAt:new Date(+now+7200000).toISOString()},new Date(+now+2000001));
 const d=entity(s,f.id).distribution;assert.equal(d.status,'pending');assert.ok(d.responseOverdueAt);assert.equal(d.originalDueAt,new Date(+now+3600000).toISOString());assert.equal(d.deadlineHistory.length,1);assert.ok(!s.remedies.some(r=>r.findingId===f.id));
});
