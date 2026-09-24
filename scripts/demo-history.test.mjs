import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {withDemoHistory} from '../lib/demo-history.ts';
test('Demo history is ordered, idempotent and consistent with pending review',()=>{
 const state=createInitial(new Date('2026-09-21T12:00:00+08:00'));
 const logs=state.logs.filter(x=>x.target==='WO-1039');
 assert.equal(logs.length,3);assert.equal(logs.at(-1).action,'提交复核意见');
 assert.equal(state.reviews.find(x=>x.id==='WO-1039').status,'supervisor');
 assert.equal(withDemoHistory(state),state);
 assert.ok(logs.every(x=>Date.parse(x.at)<=Date.parse('2026-09-21T12:00:00+08:00')));
});
test('Backfill preserves existing actions and never invents events for progressed records',()=>{
 const state=createInitial();state.logs=state.logs.filter(x=>!x.id.startsWith('EV-DEMO-WO-1039'));
 state.reviews.find(x=>x.id==='WO-1039').rev=1;
 state.logs.push({id:'user-action',target:'WO-1039',at:new Date().toISOString(),actor:'S01',action:'用户操作',note:'保留'});
 const result=withDemoHistory(state);assert.equal(result.logs.filter(x=>x.target==='WO-1039').length,1);assert.equal(result.logs.at(-1).id,'user-action');
});
