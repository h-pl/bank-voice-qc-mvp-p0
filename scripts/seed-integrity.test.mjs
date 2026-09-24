import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPrototypeState,migrateUntouchedSeeds} from '../lib/prototype-seeds.ts';
import {withStrategyDemo} from '../lib/strategy-demo.ts';
import {withRichDemo} from '../lib/demo-enrichment.ts';
import {createInitial} from '../lib/fixtures.ts';
import {legacyInitial} from './helpers/legacy-initial.mjs';
import {apply,entity,callFor} from '../lib/workflow.ts';
import {validateRuleResources,supportsWarning,validateRuleConfig} from '../lib/strategy-schema.ts';
const now=new Date('2026-09-23T00:00:00Z');
const seed=()=>createPrototypeState(now);

test('PRD 7.11: every problem has a valid call, pinned rule/resource and evidence; manual findings are not automatic warnings',()=>{
 const s=seed();assert.equal(s.seedPrd.revision,464);assert.equal(s.seedScenarios.length,48);
 for(const f of s.findings){const c=callFor(s,f.id),r=entity(s,f.ruleId),v=r?.versions.find(v=>v.version===f.ruleVersion);assert.ok(c&&v,f.id);assert.equal(r.indicator,f.indicator,f.id);assert.ok(f.evidence.length&&f.evidence.every(i=>c.transcript[i]),f.id);validateRuleResources(r,v.resources,s);
  if(f.source==='auto'){const b=c.batches.find(b=>b.id===f.batchId);assert.equal(b.ruleVersions[r.id],v.version);assert.ok(Date.parse(v.at)<=Date.parse(b.startedAt));assert.equal(s.warningDecisions.filter(w=>w.findingId===f.id).length,1);}else{assert.equal(f.batchId,'manual');assert.ok(!s.warningDecisions.some(w=>w.findingId===f.id));}
  for(const conclusion of f.conclusions){assert.ok(['risk','false_positive'].includes(conclusion.value));assert.ok(conclusion.evidence?.length&&conclusion.evidence.every(i=>c.transcript[i]));assert.equal(conclusion.ruleVersion,f.ruleVersion);assert.equal(conclusion.batchId,f.batchId);assert.ok(Date.parse(conclusion.at)>=Date.parse(c.endedAt));}
 }
 for(const list of [s.calls,s.findings,s.reviews,s.remedies,s.appeals,s.resources,s.rules,s.logs,s.detectionResults,s.warningDecisions])assert.equal(new Set(list.map(x=>x.id)).size,list.length);
});
test('PRD 7.8/7.9: detection and strategy decisions are distinct; frozen policy conditions really satisfy each warning',()=>{
 const s=seed();for(const w of s.warningDecisions){const d=s.detectionResults.find(d=>d.id===w.detectionId),policy=entity(s,w.policyId),pv=policy.versions.find(v=>v.version===w.policyVersion),call=entity(s,w.callId),batch=call.batches.find(b=>b.id===w.batchId);assert.ok(d&&pv);assert.deepEqual(w.conditions,pv.config);assert.equal(batch.policyVersions[policy.id],pv.version);assert.ok(Date.parse(pv.at)<=Date.parse(batch.startedAt));validateRuleConfig(policy,pv.config,s);
  const satisfies=d.execution==='success'&&d.result==='hit'&&(pv.config.mode==='持续时长'?d.duration>=Number(pv.config.duration):d.count>=1);
  assert.equal(w.result==='matched',satisfies,w.id);if(satisfies)assert.ok(w.findingId);else assert.equal(w.findingId,undefined);
 }
 const short=s.warningDecisions.find(w=>w.id==='W-BELOW-THRESHOLD');assert.equal(short.result,'not_matched');assert.ok(!s.findings.some(f=>f.callId===short.callId));
 for(const d of s.detectionResults){const r=entity(s,d.ruleId);if(d.execution!=='success')assert.equal(d.result,undefined);if(!supportsWarning(r.indicator))assert.equal(d.result,undefined);for(const [id,v] of Object.entries(d.resources))assert.ok(entity(s,id)?.versions.some(x=>x.version===v));}
});
test('PRD 7.5/7.11.3: each ordinary warning has its own review; insufficient evidence stays in investigation with no third verdict',()=>{
 const s=seed();for(const r of s.reviews){if(r.type==='candidate')assert.equal(r.findingIds.length,1);assert.ok(r.findingIds.every(id=>entity(s,id).callId===r.callId));assert.ok(Object.keys(r.opinions).every(id=>r.findingIds.includes(id)));for(const op of Object.values(r.opinions))assert.ok(['risk','false_positive'].includes(op.value));if(['supervisor','done'].includes(r.status))assert.ok(r.history.length);}
 const a=entity(s,'WO-1039'),b=entity(s,'WO-1039-B');assert.equal(a.callId,b.callId);assert.deepEqual(a.findingIds,['F-1039']);assert.deepEqual(b.findingIds,['F-1039-B']);assert.equal(a.status,'supervisor');assert.equal(b.status,'working');assert.deepEqual(b.opinions,{});assert.match(b.summary,/补充/);assert.equal(entity(s,'F-1039-B').conclusions.length,0);
});
test('PRD 7.7: remedies require acceptance or adverse appeal; direct unassigned submissions retain materials and original deadline',()=>{
 const s=seed();for(const r of s.remedies){const f=entity(s,r.findingId),c=f.conclusions.find(c=>c.version===r.conclusionVersion),d=f.distribution;assert.ok(c&&d);assert.equal(d.status,'accepted');assert.equal(r.standard,d.standard);assert.ok(Date.parse(c.at)<=Date.parse(d.at)&&Date.parse(d.at)<=Date.parse(r.createdAt));if(r.origin==='review'||r.origin==='spotcheck')assert.equal(r.inspector,c.reviewer);if(!r.inspector)assert.equal(r.origin,'direct');if(r.origin==='appeal'){const a=s.appeals.find(a=>a.findingId===f.id&&a.outcome==='maintain');assert.equal(r.inspector,entity(s,a.reviewId).owner);}
  for(const m of r.materials)for(const id of m.samples){const call=entity(s,id);assert.equal(call.agentId,r.agentId);assert.ok(Date.parse(call.startedAt)>Date.parse(r.createdAt));assert.ok(Date.parse(call.endedAt)<=Date.parse(m.at));}
 }
 const wait=entity(s,'REC-UI-1');assert.equal(wait.inspector,'');assert.ok(wait.materials.length);const assigned=entity(s,'REC-UI-2');assert.equal(assigned.inspector,'Q02');assert.ok(assigned.materials.length);assert.equal(assigned.dueAt,assigned.originalDueAt);
 for(const a of s.appeals.filter(a=>a.status!=='done'))assert.ok(!s.remedies.some(r=>r.findingId===a.findingId&&r.conclusionVersion===a.conclusionVersion));
});
test('PRD 7.6/7.7: appeal and remedy return branches have real operator events, immutable opinions, and correct rounds',()=>{
 const s=seed();const r=entity(s,'REC-UI-6');assert.equal(r.status,'executing');assert.equal(r.round,2);assert.ok(r.rounds[0].materials.length&&r.rounds[0].acceptance);assert.ok(r.supplementRequirements);
 const explain=entity(s,'REC-UI-3');assert.equal(explain.status,'supervisor');assert.equal(explain.round,1);assert.ok(explain.materials.length);assert.equal(explain.acceptance.result,'pass');
 const response=entity(s,'REC-REC-RESPONSE');assert.equal(response.status,'response');assert.ok(response.supervisorComment);assert.equal(entity(s,'REC-REC-FAIL').round,2);
 const appeal=entity(s,'AP-UI-7');assert.equal(entity(s,appeal.reviewId).status,'response');assert.ok(entity(s,appeal.reviewId).supervisorComment);
 const final=entity(s,'AP-UI-8');assert.equal(final.outcome,'maintain');assert.equal(entity(s,'REC-UI-8').origin,'appeal');assert.equal(entity(s,'REC-UI-8').status,'done');
 assert.ok(s.supplements.some(x=>x.status==='pending'));assert.ok(s.supplements.some(x=>x.status==='done'));
});
test('PRD 7.3/7.11: no-findings spotchecks create no false positives; revoked manual issues never manufacture an automatic warning',()=>{
 const s=seed();for(const id of ['WO-SPOT-2','WO-SPOT-3']){const r=entity(s,id);assert.equal(r.scopeResult,'clear');assert.equal(r.findingIds.length,0);assert.ok(r.summary);assert.ok(!s.findings.some(f=>f.callId===r.callId));}
 assert.equal(entity(s,'WO-SPOT-3').status,'done');const manual=entity(s,'F-SPOT-5');assert.equal(manual.source,'manual');assert.equal(manual.status,'closed');assert.equal(manual.optimization,undefined);assert.equal(manual.conclusions.at(-1).value,'false_positive');assert.ok(!s.warningDecisions.some(w=>w.findingId===manual.id));assert.ok(s.appeals.some(a=>a.findingId===manual.id&&a.outcome==='false_positive'));
});
test('all seed timestamps, evidence ranges and submitted histories occur in a possible order',()=>{
 const s=seed();for(const c of s.calls){if(c.endedAt)assert.equal(Date.parse(c.endedAt)-Date.parse(c.startedAt),c.duration*1000,c.id);for(const seg of c.transcript)assert.ok(seg.at>=0&&seg.at<=c.duration,c.id);for(const b of c.batches){if(b.checks.some(x=>['running','pending'].includes(x.state)))assert.equal(b.endedAt,undefined);if(b.endedAt)assert.ok(Date.parse(b.endedAt)>=Date.parse(b.startedAt));}}
 for(const log of s.logs){assert.ok(Date.parse(log.at)<=now.getTime(),log.id);if(log.callId)assert.ok(Date.parse(log.at)>=Date.parse(entity(s,log.callId).startedAt),log.id);}
 for(const r of s.reviews)for(const h of r.history)assert.ok(Date.parse(h.at)>=Date.parse(entity(s,r.callId).endedAt),r.id);
});
test('legacy migration backs away from all user changes; both untouched generations rebuild against PRD 464',()=>{
 const old=withStrategyDemo(legacyInitial(now));old.identity='Q02';old.view='workorders2';old.readEvents={Q02:['event-id']};const next=migrateUntouchedSeeds(old);assert.equal(next.seedIntegrityVersion,2);assert.equal(next.identity,'Q02');assert.deepEqual(next.readEvents,old.readEvents);assert.equal(migrateUntouchedSeeds(next),next);
 for(const change of [s=>s.revision++,s=>s.requests.push('request'),s=>entity(s,'WO-1039').rev++,s=>s.logs.push({id:'custom-event'}),s=>entity(s,'WO-1039').scope='用户范围']){const saved=structuredClone(old);change(saved);assert.equal(migrateUntouchedSeeds(saved),saved);}
 const shipped=JSON.parse(readFileSync(new URL('./fixtures/legacy-rich.json',import.meta.url),'utf8'));assert.equal(migrateUntouchedSeeds(shipped).seedPrd.revision,464);
 const prior={...withStrategyDemo(withRichDemo(createInitial(now))),seedIntegrityVersion:1};const upgraded=migrateUntouchedSeeds(prior);assert.equal(upgraded.seedIntegrityVersion,2);assert.equal(entity(upgraded,'CALL-1039').endedAt,entity(prior,'CALL-1039').endedAt);
});
test('the generated pending review follows the same publish/accept commands without changing the sibling problem',()=>{
 let s=seed();const r=entity(s,'WO-1039');s=apply(s,{id:r.id,rev:r.rev,action:'publish',requestId:'user-publish',input:{goal:'改善服务表达',standard:'回应诉求并说明正确渠道',observation:'提交同业务通话',sampleCount:1,dueAt:new Date(now.getTime()+86400000).toISOString()}},now);s.identity='A1048';s=apply(s,{id:'F-1039',rev:entity(s,'F-1039').rev,action:'accept_result',requestId:'user-accept',input:{}},now);assert.equal(s.remedies.at(-1).inspector,'Q01');assert.equal(entity(s,'WO-1039-B').status,'working');assert.equal(migrateUntouchedSeeds(s),s);
});

test('PRD lifecycle terms distinguish handling state, judgment and receiving a result',async()=>{
 const {lifecycleLabel}=await import('../lib/lifecycle-labels.ts');const s=seed();
 for(const [id,label] of [['F-1041','待主管初审'],['F-1039','核实中'],['F-1032','已分发'],['F-1037','误报归档'],['WO-1039','待主管确认'],['WO-1039-B','核实中'],['AP-1033','待指派核查'],['AP-UI-7','待质检员回应'],['REC-UI-1','资料已提交 · 待指派核验'],['REC-UI-2','待核验'],['REC-UI-3','待主管审核'],['REC-UI-8','已完成']])assert.equal(lifecycleLabel(entity(s,id),s),label,id);
 assert.ok(s.seedCommands.length>100);for(const {command} of s.seedCommands){if(command.action==='submit_review')for(const opinion of Object.values(command.input.opinions??{}))assert.ok(['risk','false_positive'].includes(opinion.value));if(command.action==='verify')assert.ok(['pass','fail'].includes(command.input.value));}
});
