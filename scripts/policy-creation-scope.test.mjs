import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {withStrategyDemo} from '../lib/strategy-demo.ts';
import {apply,entity} from '../lib/workflow.ts';
import {editableBindings} from '../lib/indicator-bindings.ts';
import {pendingPoliciesForRule} from '../lib/policy-associations.ts';
const edit=(s,id,action,input={})=>apply(s,{id,rev:entity(s,id).rev,action,requestId:crypto.randomUUID(),input:{note:'验证策略创建与关联同时发布',...input}});
function seed(){let s=withStrategyDemo(createInitial(new Date('2026-09-23T10:00:00+08:00')));for(const id of ['R-EM-002','R-AC-003']){const bindings=editableBindings(entity(s,id),s).map(b=>({...b,policyId:b.policyId || 'none'}));s=edit(s,id,'save_rule',{bindings});s=edit(s,id,'check_rule');s=edit(s,id,'publish_rule');}return s;}
const selections=s=>[['R-EM-002',['愤怒']],['R-AC-003',['静默']]].map(([ruleId,features])=>({ruleId,features,rev:entity(s,ruleId).rev}));
function create(s,policyBindings=selections(s),extra={}){const config={...entity(s,'R-AL-001').versions.at(-1).config,mode:'单次命中'};const next=edit(s,'R-AL-001','create_policy',{title:'新建关联策略测试',config,policyBindings,...extra});return [next,next.rules.at(-1).id];}

test('New policy selections remain pending and are visible from rules without modifying published bindings',()=>{
 const before=seed();const [s,id]=create(before);const policy=entity(s,id);assert.equal(policy.versions.length,0);assert.deepEqual(policy.draft.pendingPolicyBindings,selections(before));
 for(const target of selections(before)){assert.deepEqual(entity(s,target.ruleId),entity(before,target.ruleId));assert.equal(pendingPoliciesForRule(s,target.ruleId)[0].policy.id,id);assert.equal(pendingPoliciesForRule(s,target.ruleId)[0].conflict,false);}
 assert.deepEqual(s.calls,before.calls);assert.deepEqual(JSON.parse(JSON.stringify(s.findings)),JSON.parse(JSON.stringify(before.findings)));
});

test('Publishing a checked new policy publishes all selected bindings atomically and preserves prior history and other policies',()=>{
 const before=seed();let [s,id]=create(before);assert.throws(()=>edit(s,id,'publish_rule'),/不允许|检查/);s=edit(s,id,'check_rule');s=edit(s,id,'publish_rule');s=JSON.parse(JSON.stringify(s));
 const policy=entity(s,id);assert.equal(policy.versions.length,1);assert.equal(policy.draft,undefined);assert.equal(policy.versions[0].pendingPolicyBindings,undefined);
 for(const target of selections(before)){const rule=entity(s,target.ruleId),old=entity(before,target.ruleId);assert.equal(rule.versions.length,old.versions.length+1);assert.deepEqual(rule.versions.slice(0,-1),old.versions);assert.equal(rule.rev,old.rev+1);assert.equal(rule.draft,undefined);assert.deepEqual(rule.versions.at(-1).resources,old.versions.at(-1).resources);for(const b of old.versions.at(-1).bindings.filter(b=>b.policyId && b.policyId!=='none'))assert.deepEqual(rule.versions.at(-1).bindings.find(row=>row.id===b.id),b);assert.ok(rule.versions.at(-1).bindings.some(b=>b.policyId===id && target.features.includes(b.feature)));assert.equal(rule.versions.at(-1).policyVersions[id],1);assert.equal(pendingPoliciesForRule(s,target.ruleId).length,0);}
 assert.deepEqual(s.calls,before.calls);assert.deepEqual(JSON.parse(JSON.stringify(s.findings)),JSON.parse(JSON.stringify(before.findings)));
});

test('Creation rejects existing rule drafts, stale selections and invalid features without partial writes',()=>{
 const s=seed();const before=structuredClone(s);const stale=selections(s);stale[1].rev--;assert.throws(()=>create(s,stale),/已更新/);assert.deepEqual(s,before);
 const invalid=selections(s);invalid[0].features=['不存在的特征'];assert.throws(()=>create(s,invalid),/特征无效/);
 const draft=edit(s,'R-AC-003','save_rule',{bindings:editableBindings(entity(s,'R-AC-003'),s)});assert.throws(()=>create(draft),/未发布草稿/);
 assert.throws(()=>create(s,[...selections(s),selections(s)[0]]),/重复/);
});

test('A target update after checking blocks entire publication including the policy and first target',()=>{
 let [s,id]=create(seed());s=edit(s,id,'check_rule');s=edit(s,'R-AC-003','save_rule',{bindings:editableBindings(entity(s,'R-AC-003'),s)});const before=structuredClone(s);assert.equal(pendingPoliciesForRule(s,'R-AC-003')[0].conflict,true);assert.throws(()=>edit(s,id,'publish_rule'),/未发布草稿/);assert.deepEqual(s,before);
 s=edit(s,'R-AC-003','discard_rule');assert.throws(()=>edit(s,id,'publish_rule'),/已更新/);
 // Reconfirm current versions by saving the proposal, then run checks again.
 s=edit(s,id,'save_rule',{config:entity(s,id).draft.config,policyBindings:selections(s)});assert.equal(entity(s,id).checked,false);s=edit(s,id,'check_rule');s=edit(s,id,'publish_rule');assert.equal(entity(s,id).versions.length,1);
});

test('Editing or discarding new-policy scope leaves target rules untouched; unbound creation remains valid',()=>{
 const before=seed();let [s,id]=create(before);s=edit(s,id,'save_rule',{config:entity(s,id).draft.config,policyBindings:[selections(s)[1]]});assert.equal(pendingPoliciesForRule(s,'R-EM-002').length,0);s=edit(s,id,'discard_rule');assert.equal(s.rules.some(r=>r.id===id),false);for(const target of selections(before))assert.deepEqual(entity(s,target.ruleId),entity(before,target.ruleId));
 [s,id]=create(s,[]);s=edit(s,id,'check_rule');s=edit(s,id,'publish_rule');assert.equal(entity(s,id).versions.length,1);
});

test('An incompatible policy configuration and unauthorized creation are rejected',()=>{
 const s=seed();const config={...entity(s,'R-AL-001').versions.at(-1).config,mode:'持续时长',duration:'10'};const plan=[{ruleId:'R-VOICE-001',rev:entity(s,'R-VOICE-001').rev,features:['身份不匹配']}];assert.throws(()=>create(s,plan,{config}),/不适用|不支持/);assert.throws(()=>create({...s,identity:'Q01'}),/不允许/);
});
