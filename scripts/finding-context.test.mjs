import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyInitial as createInitial } from './helpers/legacy-initial.mjs';
import { withFindingContext, findingContext } from '../lib/finding-context.ts';

test('untouched demo problems retain separate rules and evidence without changing verdicts',()=>{
  const input=createInitial();
  const prior=structuredClone(input.reviews.find(r=>r.id==='WO-1039').opinions);
  const state=withFindingContext(input);
  const finding=state.findings.find(f=>f.id==='F-1039-B');
  assert.equal(finding.ruleId,'R-SOP-TIME');
  assert.deepEqual(finding.evidence,[4]);
  assert.equal(state.reviews.find(r=>r.id==='WO-1039').opinions[finding.id].value,prior[finding.id].value);
  assert.equal(input.findings.find(f=>f.id===finding.id).ruleId,'R-SOP-006');
  assert.equal(findingContext(state,finding).version.version,1);
  assert.equal(withFindingContext(state),state);
});

test('saved review or formal conclusion is never overwritten by seed repair',()=>{
  const saved=createInitial(); saved.reviews.find(r=>r.id==='WO-1039').rev=1;
  assert.equal(withFindingContext(saved),saved);
  const concluded=createInitial(); const f=concluded.findings.find(f=>f.id==='F-1039-B');
  f.conclusions.push({version:1,value:'risk',note:'已有人工结论',at:new Date().toISOString(),by:'S01'});
  assert.equal(withFindingContext(concluded).findings.find(x=>x.id===f.id).ruleId,'R-SOP-006');
});

test('pinned rule lookup never falls back to latest version',()=>{
  const state=withFindingContext(createInitial()); const finding=state.findings.find(f=>f.id==='F-1039-B');
  const rule=state.rules.find(r=>r.id===finding.ruleId);
  rule.versions.push({...rule.versions[0],version:2,scope:'新范围'});
  assert.equal(findingContext(state,finding).version.version,1);
  rule.versions=rule.versions.filter(v=>v.version!==1);
  assert.equal(findingContext(state,finding).version,undefined);
});
