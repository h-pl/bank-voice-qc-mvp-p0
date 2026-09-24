import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {withRichDemo} from '../lib/demo-enrichment.ts';
import {parseSopRules} from '../lib/sop-rules.ts';
test('Rich demo adds coherent scenarios once without changing existing user work',()=>{
 const original=createInitial(new Date('2026-09-22T10:00:00+08:00'));
 original.resources[0].draft={...original.resources[0].versions[0],content:'用户保留的词条'};
 const next=withRichDemo(original);
 assert.equal(next.calls.length,original.calls.length+8);assert.equal(next.reviews.length,original.reviews.length+4);assert.equal(next.resources.length,original.resources.length+6);
 assert.deepEqual(next.resources[0],original.resources[0]);assert.equal(original.demoUiVersion,undefined);assert.equal(withRichDemo(next),next);
 for(const finding of next.findings.filter(f=>f.id.startsWith('F-UI-'))){
  const call=next.calls.find(c=>c.id===finding.callId);assert.ok(call);assert.ok(call.batches.some(b=>b.id===finding.batchId));assert.ok(next.rules.some(r=>r.id===finding.ruleId&&r.indicator===finding.indicator));assert.ok(finding.evidence.every(i=>call.transcript[i]));
  if(finding.status==='review')assert.equal(next.reviews.filter(r=>r.findingIds.includes(finding.id)).length,1);
 }
 for(const resource of next.resources.filter(r=>r.type==='SOP'))assert.ok(parseSopRules((resource.draft??resource.versions.at(-1)).content).length);
 next.resources.at(-1).deletedAt='2026-09-22';assert.equal(withRichDemo(next).resources.at(-1).deletedAt,'2026-09-22');
});
