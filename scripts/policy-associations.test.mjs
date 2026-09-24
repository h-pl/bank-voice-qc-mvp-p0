import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {withStrategyDemo} from '../lib/strategy-demo.ts';
import {apply,entity} from '../lib/workflow.ts';
import {editableBindings,policyBindingSelection} from '../lib/indicator-bindings.ts';
const seed=()=>withStrategyDemo(createInitial(new Date('2026-09-23T10:00:00+08:00')));
const edit=(s,id,action,input={})=>apply(s,{id,rev:entity(s,id).rev,action,requestId:crypto.randomUUID(),input:{note:'验证就地关联保存与发布',...input}});
const command=(s,updates,policy='R-AL-001')=>({id:policy,rev:entity(s,policy).rev,action:'save_policy_bindings',requestId:crypto.randomUUID(),input:{note:'验证就地关联保存与发布',policyBindings:updates.map(([ruleId,features])=>({ruleId,rev:entity(s,ruleId).rev,features}))}});

test('Policy-side multi-rule save is draft-only, visible in rule editor and publishes through existing gate',()=>{
 const before=seed();const cmd=command(before,[['R-VOICE-001',['身份不匹配']],['R-EM-002',['焦虑']]]);
 let s=apply(before,cmd);
 for(const id of ['R-VOICE-001','R-EM-002']){assert.deepEqual(entity(s,id).versions,entity(before,id).versions);assert.equal(entity(s,id).checked,false);assert.ok(editableBindings(entity(s,id),s).some(b=>b.policyId===cmd.id));}
 assert.deepEqual(s.calls,before.calls);assert.deepEqual(s.findings,before.findings);
 assert.strictEqual(apply(s,cmd),s);
 const id='R-EM-002';assert.throws(()=>edit(s,id,'publish_rule'),/不允许|检查/);
 // Existing unfinished features remain unfinished; complete them in the original rule editor.
 const rows=editableBindings(entity(s,id),s).map(b=>b.policyId?b:{...b,policyId:'none'});
 s=edit(s,id,'save_rule',{bindings:rows});s=edit(s,id,'check_rule');s=edit(s,id,'publish_rule');
 assert.deepEqual(entity(s,id).versions.slice(0,-1),entity(before,id).versions);
 assert.ok(entity(s,id).versions.at(-1).bindings.some(b=>b.feature==='焦虑'&&b.policyId===cmd.id));
 assert.equal(entity(s,id).draft,undefined);
});

test('Policy-side add preserves other policy bindings, custom parameters and existing draft metadata',()=>{
 let s=seed();const id='R-AC-003';
 let bindings=editableBindings(entity(s,id),s).map(b=>({...b,policyId:b.feature==='语速过快'?'ALERT-SERVICE':'none',conditions:b.feature==='语速过快'?{speed:'345'}:b.conditions}));
 s=edit(s,id,'save_rule',{bindings});entity(s,id).draft.definition={name:'未发布的规则名称',objective:'保留原有草稿',checks:[],boundary:'原判断边界',output:'检测结果',basis:[]};
 const before=structuredClone(entity(s,id).draft);
 s=apply(s,command(s,[[id,['语速过快']]]));
 const draft=entity(s,id).draft;
 assert.deepEqual(draft.definition,before.definition);
 for(const original of before.bindings.filter(b=>b.policyId==='ALERT-SERVICE'))assert.deepEqual(draft.bindings.find(b=>b.id===original.id),original);
 assert.equal(draft.bindings.find(b=>b.policyId==='R-AL-001').conditions.speed,'345');
 assert.deepEqual(policyBindingSelection(entity(s,id),'R-AL-001'),['语速过快']);
});

test('Removing this policy retains other policies and marks no-warning only when the last association is removed',()=>{
 let s=seed();const id='R-EM-002';
 const rows=editableBindings(entity(s,id),s).map(b=>({...b,policyId:b.feature==='愤怒'?'R-AL-001':'none'}));
 rows.push({...structuredClone(rows.find(b=>b.feature==='愤怒')),id:'other-tier',policyId:'ALERT-SERVICE'});
 s=edit(s,id,'save_rule',{bindings:rows});s=apply(s,command(s,[[id,[]]]));
 const remaining=entity(s,id).draft.bindings.filter(b=>b.feature==='愤怒');assert.equal(remaining.length,1);assert.equal(remaining[0].policyId,'ALERT-SERVICE');
 s=apply(s,command(s,[[id,[]]],'ALERT-SERVICE'));
 assert.equal(entity(s,id).draft.bindings.find(b=>b.feature==='愤怒').policyId,'none');
});

test('A stale second rule rolls back the entire multi-rule update',()=>{
 const s=seed(),before=structuredClone(s),cmd=command(s,[['R-VOICE-001',['身份不匹配']],['R-EM-002',['焦虑']]]);
 cmd.input.policyBindings[1].rev--;
 assert.throws(()=>apply(s,cmd),/已更新/);assert.deepEqual(s,before);
});

test('Authorization, retired/unpublished policies, duplicate rules and incompatible selections are rejected',()=>{
 const s=seed();const cmd=command(s,[['R-VOICE-001',['身份不匹配']]]);
 assert.throws(()=>apply({...s,identity:'Q01'},cmd),/不允许/);
 assert.throws(()=>apply(s,{...cmd,rev:-1}),/已更新/);
 const retired=structuredClone(s);entity(retired,cmd.id).retired=true;assert.throws(()=>apply(retired,cmd),/不允许/);
 const unpublished=structuredClone(s);entity(unpublished,cmd.id).versions=[];assert.throws(()=>apply(unpublished,cmd),/不允许/);
 assert.throws(()=>apply(s,{...cmd,input:{...cmd.input,policyBindings:[...cmd.input.policyBindings,...cmd.input.policyBindings]}}),/重复/);
 assert.throws(()=>apply(s,command(s,[['R-VOICE-001',['身份不匹配']]],'ALERT-EMOTION')),/不适用/);
 assert.throws(()=>apply(s,command(s,[['R-VOICE-001',['不存在的特征']]])),/特征无效/);
});

test('An existing checked draft is invalidated; rule-side edits are reflected in policy selections after reload',()=>{
 let s=seed();const id='R-EM-002';s=edit(s,id,'save_rule',{bindings:editableBindings(entity(s,id),s).map(b=>({...b,policyId:'none'}))});s=edit(s,id,'check_rule');
 s=apply(s,command(s,[[id,['焦虑']]]));assert.equal(entity(s,id).checked,false);
 let rows=editableBindings(entity(s,id),s).map(b=>b.feature==='愤怒'?{...b,policyId:'R-AL-001'}:b);
 s=edit(s,id,'save_rule',{bindings:rows});s=JSON.parse(JSON.stringify(s));
 assert.deepEqual(new Set(policyBindingSelection(entity(s,id),'R-AL-001')),new Set(['焦虑','愤怒']));
});
