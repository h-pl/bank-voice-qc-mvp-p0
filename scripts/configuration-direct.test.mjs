import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {apply,entity} from '../lib/workflow.ts';
import {editableBindings} from '../lib/indicator-bindings.ts';
import {resourceRows,serializeRows} from '../lib/resource-import.ts';
import {resourceSchemas} from '../lib/strategy-schema.ts';
const seed=()=>createPrototypeState(new Date('2026-09-23T02:00:00Z'));
const command=(s,id,action,input={})=>({id,action,rev:entity(s,id).rev,requestId:crypto.randomUUID(),input});
const save=(s,id,action,input)=>apply(s,command(s,id,action,input));
test('Direct warning save is complete, atomic, idempotent and preserves issued evidence',()=>{
 const s=seed(),id='R-VOICE-001',before=structuredClone(s),bindings=editableBindings(entity(s,id),s);
 bindings[0].policyId='none';
 const cmd=command(s,id,'save_rule_configuration',{bindings}),next=apply(s,cmd);
 assert.deepEqual(s,before);assert.equal(entity(next,id).draft,undefined);assert.deepEqual(entity(next,id).versions.at(-1).bindings,bindings);
 assert.deepEqual(entity(next,id).versions.slice(0,-1),entity(s,id).versions);assert.deepEqual(next.calls,s.calls);assert.deepEqual(next.findings,s.findings);
 assert.equal(next.logs.length,s.logs.length+1);assert.strictEqual(apply(next,cmd),next);
 assert.throws(()=>apply(next,{...cmd,requestId:crypto.randomUUID()}),/记录已更新/);
});
test('Incomplete, duplicate, conflicting and incompatible warning saves preserve the full original state',()=>{
 const s=seed(),id='R-VOICE-001',bindings=editableBindings(entity(s,id),s),before=structuredClone(s);
 const policy=bindings.find(b=>b.policyId && b.policyId!=='none').policyId;
 const cases=[bindings.map((b,i)=>({...b,policyId:i===0?'':b.policyId})),[...bindings,{...bindings[0],id:'duplicate',policyId:policy}],[...bindings,{...bindings[0],id:'none',policyId:'none'}],bindings.map((b,i)=>({...b,policyId:i===0?'ALERT-EMOTION':b.policyId}))];
 for(const rows of cases){assert.throws(()=>save(s,id,'save_rule_configuration',{bindings:rows}));assert.deepEqual(s,before);}
});
test('Shared resource saves refresh all referencing rules and retain previous snapshots',()=>{
 const s=seed(),resource=s.resources.find(r=>r.kind==='knowledge'),before=structuredClone(s),v=resource.versions.at(-1);
 const rows=resourceRows('knowledge',v.content);rows[0][1]+='，以受理结果为准';
 const next=save(s,resource.id,'save_resource_content',{content:serializeRows([resourceSchemas.knowledge.fields,...rows])});
 const saved=entity(next,resource.id);assert.equal(saved.draft,undefined);assert.notEqual(saved.versions.at(-1).content,v.content);
 const refs=s.rules.filter(r=>resource.id in (r.versions.at(-1)?.resources ?? {}));assert.ok(refs.length>=2);
 for(const r of refs){const changed=entity(next,r.id);assert.equal(changed.versions.at(-1).resources[resource.id],saved.versions.at(-1).version);assert.deepEqual(changed.versions.slice(0,-1),r.versions);}
 assert.deepEqual(s,before);assert.deepEqual(next.findings,s.findings);
});
test('Invalid resource content and unauthorized saves do not mutate state',()=>{
 const s=seed(),resource=s.resources.find(r=>r.kind==='keyword'),before=structuredClone(s);
 assert.throws(()=>save(s,resource.id,'save_resource_content',{content:'关键词,同义词\n,缺失关键词'}),/必填/);assert.deepEqual(s,before);
 s.identity='Q01';assert.throws(()=>save(s,resource.id,'save_resource_content',{content:resource.versions.at(-1).content}),/不允许/);
});
test('Shared policy saves refresh active references and reject incompatible changes atomically',()=>{
 const s=seed(),voice=entity(s,'R-VOICE-001'),policyId=voice.versions.at(-1).bindings.find(b=>b.policyId && b.policyId!=='none').policyId,policy=entity(s,policyId);
 const next=save(s,policyId,'save_rule_configuration',{config:{...policy.versions.at(-1).config,level:'高'}});
 assert.equal(entity(next,policyId).draft,undefined);assert.equal(entity(next,voice.id).versions.at(-1).policyVersions[policyId],entity(next,policyId).versions.at(-1).version);
 const before=structuredClone(s);assert.throws(()=>save(s,policyId,'save_rule_configuration',{config:{...policy.versions.at(-1).config,mode:'持续时长',duration:'30'}}));assert.deepEqual(s,before);
});
test('Policy management cannot silently turn the last association into no-warning',()=>{
 const s=seed(),rule=entity(s,'R-VOICE-001'),policyId=rule.versions.at(-1).bindings.find(b=>b.policyId && b.policyId!=='none').policyId;
 assert.throws(()=>save(s,policyId,'save_policy_associations',{policyBindings:[{ruleId:rule.id,rev:rule.rev,features:[]}]}),/最后一条/);
});
test('New policies and resources save without draft or reason steps',()=>{
 const s=seed(),anchor=s.rules.find(r=>r.indicator==='6.3.4' && !r.retired),policyInput={title:'验收策略',config:anchor.versions.at(-1).config};
 const next=save(s,anchor.id,'create_policy_configuration',policyInput),created=next.rules.find(r=>r.name==='验收策略');assert.ok(created?.versions.length);assert.equal(created.draft,undefined);
 const resource=next.resources.find(r=>r.kind==='keyword');
 const createdState=save(next,resource.id,'create_resource_content',{title:'验收词库',resourceType:'词库',resourceKind:'keyword',content:'关键词,同义词\n测试词,近义测试'});
 const newResource=createdState.resources.find(r=>r.name==='验收词库');assert.ok(newResource?.versions.length);assert.equal(newResource.draft,undefined);
});
