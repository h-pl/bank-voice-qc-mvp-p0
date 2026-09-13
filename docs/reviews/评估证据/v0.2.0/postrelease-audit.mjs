import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=process.env.QC_AUDIT_ROOT || fileURLToPath(new URL('../../../../',import.meta.url));
const {createInitial}=await import(`${root}/lib/fixtures.ts`);
const {apply,entity,actions,notices,isTodo,latest}=await import(`${root}/lib/workflow.ts`);
const now=new Date('2026-09-13T10:30:00+08:00'),due='2026-09-17T12:00:00+08:00';let seq=0;
const as=(s,identity)=>({...s,identity});const run=(s,id,action,input={})=>apply(s,{id,action,rev:entity(s,id).rev,requestId:`postrelease-${++seq}`,input:{note:'核对本轮证据及完整业务事实',owner:'Q01',dueAt:due,evidence:[2],...input}},now);
const results=[];
// Historical reproduction script: assertions prove gaps exist at v0.2.0; NOT a passing release gate.
{
 let s=run(createInitial(now),'WO-1039','publish',{remedy:true,goal:'改善服务说明',standard:'完整说明业务条件',sampleCount:2,observation:'后续同业务复测'}),r=s.remedies.at(-1),id=r.id;
 s=run(as(s,'A1048'),id,'accept_remedy');s=run(s,id,'sample_calls');s=run(s,id,'material',{samples:[s.calls.at(-1).id]});s=run(as(s,'Q01'),id,'verify',{value:'insufficient'});const sp=s.supplements.at(-1).id;
 s=run(as(s,'A1048'),r.findingId,'appeal');const ap=s.appeals.at(-1).id;s=run(as(s,'S01'),ap,'accept_decide',{value:'false_positive'});
 const a=as(s,'A1048');let error='';try{run(a,sp,'reply',{attachment:'授权演示附件'})}catch(e){error=e.message}
 assert.equal(entity(s,id).status,'terminated');assert.equal(entity(s,sp).status,'pending');assert.ok(notices(a).some(e=>e.id===id));assert.match(error,/整改已结束/);
 results.push({id:'N01',remedy:entity(s,id).status,supplement:entity(s,sp).status,agentTodo: isTodo(a,entity(a,id)),replyButton:actions(a,sp),error});
}
{
 let s=run(createInitial(now),'AP-1033','accept_assign',{owner:'Q02'});const rid=entity(s,'AP-1033').reviewId;
 s=run(as(s,'Q02'),rid,'request_evidence');s=run(as(s,'S01'),rid,'supplement',{owner:'A1048'});
 assert.ok(isTodo(s,entity(s,rid)));assert.deepEqual(actions(s,rid),[]);
 results.push({id:'N02',review:rid,supervisorTodo:isTodo(s,entity(s,rid)),availableActions:actions(s,rid),appealStatus:entity(s,'AP-1033').status});
}
{
 let s=run(createInitial(now),'F-1041','remind');s=as(s,'A1048');
 const queue=s.findings.filter(f=>latest(f)).filter(e=>isTodo(s,e));assert.ok(notices(s).some(e=>e.id==='F-1041'));assert.ok(!queue.some(e=>e.id==='F-1041'));
 results.push({id:'N03',reminderInNotice:true,reminderInDefaultResults:false,actions:actions(s,'F-1041')});
}
console.log(JSON.stringify({baseline:'v0.2.0-mvp-p0',commit:'7bd90b26ab9ac0053c3dd95e472bdd45b9a4b5e9',note:'已知问题复现，不是发布验收测试',results},null,2));
