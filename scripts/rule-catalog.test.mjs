import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviousCatalogState, createPrototypeState, migrateRuleCatalog } from '../lib/prototype-seeds.ts';
import { ruleBasis } from '../lib/rule-catalog.ts';
import { actions, apply, entity } from '../lib/workflow.ts';
import { validateBindings } from '../lib/indicator-bindings.ts';
import { refreshFixedResourceReferences } from '../lib/resource-publication.ts';
const now=new Date('2026-09-23T00:00:00Z');
const latest=(s,id)=>entity(s,id).versions.at(-1);

test('catalog keeps 14 checks and reuses four active policies with unchanged warning behavior',()=>{
 const s=createPrototypeState(now);
 assert.equal(s.rules.filter(r=>r.indicator!=='6.3.4').length,14);
 const policies=s.rules.filter(r=>r.indicator==='6.3.4'&&!r.retired);assert.equal(policies.length,4);
 for(const r of s.rules.filter(r=>r.indicator!=='6.3.4')){
  const v=r.versions.at(-1);assert.ok(v.definition);
  for(const b of v.bindings ?? [])if(b.policyId!=='none'){
   const old=r.versions[0].bindings.find(x=>x.id===b.id);
   assert.deepEqual(latest(s,b.policyId).config,latest(s,old.policyId).config);
  }
  if(v.bindings?.length)validateBindings(r,v.bindings,s);
 }
 assert.equal(latest(s,'R-KW-018').bindings[0].policyId,latest(s,'R-SOP-TIME').bindings[0].policyId);
 assert.equal(latest(s,'R-ASR-001').bindings?.length ?? 0,0);
 assert.equal(s.warningDecisions.find(w=>w.id==='W-BELOW-THRESHOLD').result,'not_matched');
});

test('professional checks select distinct, real pinned resource entries',()=>{
 const s=createPrototypeState(now);
 const identity=ruleBasis(latest(s,'R-SOP-006'),s),timing=ruleBasis(latest(s,'R-SOP-TIME'),s),info=ruleBasis(latest(s,'R-SVC-INFO'),s);
 assert.equal(identity.length,1);assert.deepEqual(identity[0].entries,['身份核验']);assert.equal(identity[0].rows.length,3);
 assert.deepEqual(timing[0].entries,['处理时限说明']);assert.equal(timing[0].rows.length,1);
 assert.deepEqual(info[0].entries,['办理条件告知','业务转接说明']);assert.equal(info[0].rows.length,2);
 assert.ok([...identity,...timing,...info].every(x=>!x.missing.length));
 assert.equal(entity(s,'R-INT-001').name,'客户诉求识别');assert.match(latest(s,'R-INT-001').definition.boundary,/专业性/);
});

test('upgrade is idempotent and preserves all case data and historical rule/policy snapshots',()=>{
 const old=createPreviousCatalogState(now),copy=structuredClone(old),s=migrateRuleCatalog(old,now);
 assert.deepEqual(old,copy);
 for(const key of ['calls','findings','reviews','appeals','remedies','supplements','requests','logs','resources','detectionResults','warningDecisions','seedCommands'])assert.deepEqual(s[key],old[key],key);
 for(const rule of old.rules)assert.deepEqual(entity(s,rule.id).versions.slice(0,rule.versions.length),rule.versions,rule.id);
 assert.equal(migrateRuleCatalog(s,now),s);
 for(const w of s.warningDecisions)assert.ok(entity(s,w.policyId).versions.some(v=>v.version===w.policyVersion));
});

test('upgrade preserves edited rules, drafts, policy settings and resource content',()=>{
 const old=createPreviousCatalogState(now);
 entity(old,'R-INT-001').name='客户自定义意图规则';
 entity(old,'R-SOP-006').draft={...structuredClone(latest(old,'R-SOP-006')),scope:'自定义草稿'};
 latest(old,'POL-R-KW-018').config.repeat='每次满足都提醒';
 latest(old,'RES-CFG-KNOWLEDGE').content+='\n客户知识,自定义内容,业务规范,2026-01-01,2026-12-31';
 const s=migrateRuleCatalog(old,now);
 for(const id of ['R-INT-001','R-SOP-006','POL-R-KW-018','R-SOP-TIME','R-SVC-INFO','RES-CFG-KNOWLEDGE'])assert.deepEqual(entity(s,id),entity(old,id),id);
 assert.equal(latest(s,'R-KW-018').bindings[0].policyId,'POL-R-KW-018');
 assert.ok(s.rules.filter(r=>r.id.startsWith('POL-SHARED-')).every(p=>s.rules.some(r=>r.versions.at(-1)?.bindings?.some(b=>b.policyId===p.id))));
});

test('retired policies remain readable but cannot be edited or newly associated',()=>{
 const s=createPrototypeState(now),retired=entity(s,'POL-R-KW-018');
 assert.equal(retired.retired,true);assert.ok(!actions(s,retired.id).includes('save_rule'));
 const rule=entity(s,'R-KW-018'),rows=structuredClone(rule.versions.at(-1).bindings);rows[0].policyId=retired.id;
 assert.throws(()=>validateBindings(rule,rows,s),/已发布/);
});

test('resource refresh retains selected check scope and historical evidence, reports removed entries',()=>{
 const s=createPrototypeState(now),id='R-SOP-TIME',v=structuredClone(latest(s,id)),resource=entity(s,'RES-CFG-KNOWLEDGE');
 resource.versions.push({...structuredClone(resource.versions.at(-1)),version:2,content:resource.versions.at(-1).content.split('\n').filter(line=>!line.startsWith('处理时限说明,')).join('\n')});
 refreshFixedResourceReferences(s,resource,now.toISOString());
 assert.deepEqual(ruleBasis(v,s)[0].missing,[]);assert.deepEqual(ruleBasis(latest(s,id),s)[0].missing,['处理时限说明']);
 assert.deepEqual(latest(s,id).definition,v.definition);
 assert.equal(latest(s,'R-SOP-006').resources[resource.id],undefined);
});

test('publishing a shared policy updates all its users and preserves independent check definitions',()=>{
 let s=createPrototypeState(now),policy=s.rules.find(r=>r.id==='POL-SHARED-SINGLE-MEDIUM');
 const checks=s.rules.filter(r=>r.versions.at(-1)?.bindings?.some(b=>b.policyId===policy.id));
 const before=new Map(checks.map(r=>[r.id,structuredClone(r.versions.at(-1))]));
 const run=(action,input={})=>{s=apply(s,{id:policy.id,rev:entity(s,policy.id).rev,action,requestId:action,input:{note:'统一调整通知等级',...input}},now)};
 run('save_rule',{config:{...policy.versions.at(-1).config,level:'高'}});run('check_rule');run('publish_rule');
 for(const r of checks){assert.equal(latest(s,r.id).policyVersions[policy.id],2);assert.deepEqual(latest(s,r.id).definition,before.get(r.id).definition);assert.deepEqual(entity(s,r.id).versions.find(v=>v.version===before.get(r.id).version),before.get(r.id));}
});
