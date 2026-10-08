import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {withRichDemo} from '../lib/demo-enrichment.ts';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {withPrototypeAlertDeadlines} from '../lib/prototype-alert-deadlines.ts';
const now = new Date('2026-09-22T02:00:00Z');

test('legacy mock warnings gain stable deadlines from saved detection times without resetting edited state',()=>{
 const old=withRichDemo(createInitial(now));
 old.revision=8;old.requests.push('user-reviewed');old.findings.find(f=>f.id==='F-1030').rev=3;
 const before=structuredClone(old),next=withPrototypeAlertDeadlines(old);
 for(const f of next.findings.filter(f=>f.source==='auto')) assert.ok(f.alertTiming,f.id);
 const f=next.findings.find(f=>f.id==='F-1030'),batch=old.calls.find(c=>c.id===f.callId).batches.find(b=>b.id===f.batchId);
 assert.equal(f.alertTiming.triggeredAt,batch.endedAt);
 assert.equal(Date.parse(f.alertTiming.triageDueAt)-Date.parse(batch.endedAt),{high:5,medium:30,low:120}[f.severity]*60000);
 assert.equal(next.revision,old.revision);assert.deepEqual(next.requests,old.requests);
 assert.deepEqual(next.reviews,old.reviews);assert.deepEqual(next.calls,old.calls);
 assert.equal(f.rev,3);assert.deepEqual(old,before);
 assert.equal(withPrototypeAlertDeadlines(next),next);
 const saved=JSON.parse(JSON.stringify(next));assert.equal(withPrototypeAlertDeadlines(saved),saved);
});

test('existing clocks and current coherent mock scenarios are retained exactly',()=>{
 const current=createPrototypeState(now);
 assert.equal(withPrototypeAlertDeadlines(current),current);
 const old=withRichDemo(createInitial(now));
 const f=old.findings.find(f=>f.id==='F-1030');
 f.alertTiming={triggeredAt:'2020-01-01T00:00:00Z',triageDueAt:'2020-01-01T00:30:00Z',resolutionDueAt:'2020-01-01T08:00:00Z',level:'medium'};
 const next=withPrototypeAlertDeadlines(old);
 assert.deepEqual(next.findings.find(x=>x.id===f.id).alertTiming,f.alertTiming);
});

test('unknown records and missing detection evidence never get fabricated deadlines',()=>{
 const old=createInitial(now),f=old.findings.find(f=>f.id==='F-1030');
 old.findings=[{...f,id:'F-CUSTOM'},f];old.logs=[];
 old.calls.find(c=>c.id===f.callId).batches=[];
 assert.equal(withPrototypeAlertDeadlines(old),old);
});
