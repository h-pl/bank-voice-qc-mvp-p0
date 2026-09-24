import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {withStrategyDemo} from '../lib/strategy-demo.ts';
import {resourceSchemas,validateRuleConfig,indicatorRuleCategories,ruleHasParameters,supportsWarning,ruleFields,fieldDefaults} from '../lib/strategy-schema.ts';
import {bindingFeatures,bindingFields,editableBindings,validateBindings,policyUsers} from '../lib/indicator-bindings.ts';
import {readResourceFile,resourceRows,serializeRows,validateResourceRows} from '../lib/resource-import.ts';
import {apply,entity,actions} from '../lib/workflow.ts';
const seed=()=>withStrategyDemo(createInitial(new Date('2026-09-22T10:00:00+08:00')));
const configFor=(s,patch={})=>({...fieldDefaults(ruleFields(entity(s,'R-AL-001'))),...patch});
const transact=(s,id,action,input={})=>apply(s,{id,action,rev:entity(s,id).rev,requestId:crypto.randomUUID(),input:{note:'验证策略资源配置流程',...input}});
const complete=(s,id,policy='R-AL-001')=>editableBindings(entity(s,id),s).map((b,i)=>({...b,policyId:i===0?policy:'none'}));
test('Migration retains source, drafts, history, snapshots and is idempotent',()=>{
 const old=createInitial();old.rules[0].draft={...old.rules[0].versions.at(-1),threshold:22};const before=structuredClone(old),s=withStrategyDemo(old);
 assert.deepEqual(old,before);assert.deepEqual(s.rules[0].draft,old.rules[0].draft);
 for(const r of old.rules)assert.deepEqual(entity(s,r.id).versions.slice(0,r.versions.length),r.versions);
 assert.strictEqual(withStrategyDemo(s),s);assert.equal(s.strategyDemoVersion,7);
 assert.deepEqual(s.calls,old.calls);assert.deepEqual(s.findings,old.findings);
 assert.deepEqual(new Set(s.rules.filter(r=>r.indicator!=='6.3.4').map(r=>r.indicator)),new Set(indicatorRuleCategories.map(x=>x[0])));
 const emotion=entity(s,'R-EM-002').versions.at(-1);assert.equal(emotion.bindings.find(b=>b.feature==='愤怒').policyId,'ALERT-EMOTION');assert.deepEqual(emotion.bindings.find(b=>b.feature==='愤怒').conditions,{});assert.equal(entity(s,'ALERT-EMOTION').versions.at(-1).config.duration,'30');
});
test('All CSV templates validate all records beyond preview row 5',async()=>{
 for(const [kind,schema] of Object.entries(resourceSchemas)){
  const csv=serializeRows([schema.fields,...schema.rows]);assert.deepEqual(validateResourceRows(kind,csv),schema.rows);
  if(schema.csv)assert.equal(await readResourceFile(new File([csv],'template.csv'),kind),csv);
 }
 const good=serializeRows([resourceSchemas.keyword.fields,...resourceSchemas.keyword.rows]);
 await assert.rejects(readResourceFile(new File([good+'\n,第七条缺少关键词'],'keyword.csv'),'keyword'),/第 8 行.*必填/);assert.equal(resourceRows('keyword',good).length,6);
});
test('Reject conflicting corrections, invalid SOP sequence and dates',()=>{
 assert.throws(()=>validateResourceRows('correction','易错文本,正确文本\na,b\na,c'),/冲突/);
 assert.throws(()=>validateResourceRows('sop','SOP名称,步骤序号,步骤内容,是否必需\n核验,2,确认身份,是'),/连续/);
 assert.throws(()=>validateResourceRows('knowledge','知识主题,知识内容,依据名称,生效日期,失效日期\na,b,c,2026-02-31,'),/日期/);
});

test('Indicators own features and association; policies own common conditions and dispositions',()=>{
 const s=seed();for(const r of s.rules.filter(r=>r.indicator!=='6.3.4')){assert.equal(ruleHasParameters(r),supportsWarning(r.indicator));assert.equal(actions(s,r.id).includes('save_rule'),supportsWarning(r.indicator));}
 for(const key of ['role','stage','mode','count','duration','level','action','recipient','repeat'])assert.ok(ruleFields(entity(s,'R-AL-001')).some(f=>f.key===key));
 assert.deepEqual(bindingFields(entity(s,'R-VOICE-001'),'身份不匹配',s),[]);
 assert.deepEqual(bindingFields(entity(s,'R-AC-003'),'语速过快',s).map(f=>f.key),['speed']);
 assert.deepEqual(bindingFeatures(entity(s,'R-INT-001'),s),['查询转账进度','办理挂失']);
});
test('Blank is distinct from explicit no-warning; unpublished policy cannot be bound',()=>{
 let s=seed();const r=entity(s,'R-VOICE-001'),blank=editableBindings(r,s);
 validateBindings(r,blank,s,false);assert.throws(()=>validateBindings(r,blank,s),/选择/);
 validateBindings(r,blank.map(b=>({...b,policyId:'none'})),s);
 s=transact(s,'R-AL-001','create_policy',{title:'未发布策略',config:configFor(s)});
 const id=s.rules.find(r=>r.name==='未发布策略').id;assert.throws(()=>validateBindings(r,complete(s,r.id,id),s),/已发布/);
});
test('Binding compatibility respects policy roles, stages and continuous capability',()=>{
 const s=seed(),voice=entity(s,'R-VOICE-001');assert.throws(()=>validateBindings(voice,complete(s,voice.id,'ALERT-EMOTION'),s),/不适用/);
 const expression=entity(s,'R-AC-003'),rows=complete(s,expression.id,'ALERT-EMOTION');rows[0].policyId='none';rows[1].policyId='ALERT-EMOTION';assert.throws(()=>validateBindings(expression,rows,s),/触发方式/);
 const legacy=complete(s,voice.id);legacy[0].conditions.role='坐席';assert.throws(()=>validateBindings(voice,legacy,s),/通用触发条件/);
});
test('Save incomplete draft survives reload and blocks check; complete bindings publish frozen policy refs',()=>{
 let s=seed(),id='R-VOICE-001';s=transact(s,id,'save_rule',{bindings:editableBindings(entity(s,id),s)});s=JSON.parse(JSON.stringify(s));assert.throws(()=>transact(s,id,'check_rule'),/选择/);
 const history=structuredClone(entity(s,id).versions);s=transact(s,id,'save_rule',{bindings:complete(s,id)});s=transact(s,id,'check_rule');s=transact(s,id,'publish_rule');
 assert.deepEqual(entity(s,id).versions.slice(0,-1),history);assert.equal(entity(s,id).versions.at(-1).policyVersions['R-AL-001'],entity(s,'R-AL-001').versions.at(-1).version);
});
test('Policy publishes uniformly update references, invalidate checked drafts and preserve running snapshots',()=>{
 let s=seed();for(const id of ['R-VOICE-001','R-AC-003']){s=transact(s,id,'save_rule',{bindings:complete(s,id)});s=transact(s,id,'check_rule');s=transact(s,id,'publish_rule');}
 s=transact(s,'R-VOICE-001','save_rule',{bindings:complete(s,'R-VOICE-001')});s=transact(s,'R-VOICE-001','check_rule');
 const before=structuredClone(s),users=policyUsers(entity(s,'R-AL-001'),s);
 s=transact(s,'R-AL-001','save_rule',{config:configFor(s,{level:'低'})});s=transact(s,'R-AL-001','check_rule');s=transact(s,'R-AL-001','publish_rule');
 for(const r of users){const next=entity(s,r.id);assert.deepEqual(next.versions.slice(0,-1),entity(before,r.id).versions);assert.equal(next.versions.at(-1).policyVersions['R-AL-001'],entity(s,'R-AL-001').versions.at(-1).version);}
 assert.equal(entity(s,'R-VOICE-001').checked,false);assert.deepEqual(s.calls,before.calls);assert.deepEqual(s.findings,before.findings);
});
test('Resource publication preserves bindings and policies; removed intent requires reconfiguration',()=>{
 let s=seed(),id='R-INT-001';s=transact(s,id,'save_rule',{bindings:complete(s,id)});s=transact(s,id,'check_rule');s=transact(s,id,'publish_rule');s=transact(s,id,'save_rule',{bindings:complete(s,id)});s=transact(s,id,'check_rule');
 const bindings=structuredClone(entity(s,id).versions.at(-1).bindings),policies=structuredClone(s.rules.filter(r=>r.indicator==='6.3.4'));
 s=transact(s,'RES-CFG-INTENT','save_resource',{content:serializeRows([resourceSchemas.intent.fields,resourceSchemas.intent.rows[1]])});s=transact(s,'RES-CFG-INTENT','check_resource');s=transact(s,'RES-CFG-INTENT','publish_resource');
 assert.deepEqual(entity(s,id).versions.at(-1).bindings,bindings);assert.deepEqual(s.rules.filter(r=>r.indicator==='6.3.4'),policies);assert.equal(entity(s,id).checked,false);assert.throws(()=>transact(s,id,'check_rule'),/失效/);
});
test('Authorization, stale revisions, action recipients and new policy lifecycle',()=>{
 let s=seed(),p=entity(s,'R-AL-001'),config=configFor(s);assert.throws(()=>transact({...s,identity:'Q01'},p.id,'create_policy',{title:'越权新增',config}),/不允许/);
 assert.throws(()=>transact({...s,identity:'Q01'},'R-VOICE-001','save_rule',{bindings:complete(s,'R-VOICE-001')}),/不允许/);
 assert.throws(()=>apply(s,{id:p.id,rev:-1,action:'save_rule',requestId:crypto.randomUUID(),input:{note:'陈旧配置请求',config}}),/已更新/);
 assert.throws(()=>validateRuleConfig(p,{...config,action:'通话中提醒',recipient:'所属主管'},s),/当前坐席/);
 s=transact(s,p.id,'create_policy',{title:'统一高风险处置',config});const id=s.rules.find(r=>r.name==='统一高风险处置').id;s=transact(s,id,'check_rule');s=transact(s,id,'publish_rule');assert.equal(entity(s,id).versions[0].version,1);assert.equal(entity(s,id).versions[0].triggerRules,undefined);
 s=transact(s,p.id,'create_policy',{title:'临时策略草稿',config});const temp=s.rules.find(r=>r.name==='临时策略草稿').id;s=transact(s,temp,'discard_rule');assert.ok(!entity(s,temp));
});

test('A feature cannot mix explicit no-warning with active or duplicate tiers',()=>{
 const s=seed(),r=entity(s,'R-VOICE-001'),rows=complete(s,r.id),first=rows[0];
 assert.throws(()=>validateBindings(r,[...rows,{...structuredClone(first),id:'duplicate'}],s),/重复/);
 assert.throws(()=>validateBindings(r,[...rows,{...structuredClone(first),id:'none',policyId:'none'}],s),/不预警/);
 const distinct={...structuredClone(first),id:'second',policyId:'ALERT-SERVICE'};validateBindings(r,[...rows,distinct],s);
});
test('Common policy stage offsets validate only while active and allow zero',()=>{
 const s=seed(),rule={...entity(s,'R-AL-001'),id:'UNBOUND'},config=configFor(s,{stage:'服务中',middleStartSeconds:'0',middleEndSeconds:'0'});
 validateRuleConfig(rule,config,s);config.middleEndSeconds='-1';assert.throws(()=>validateRuleConfig(rule,config,s),/服务中终点/);
 config.stage='全程';validateRuleConfig(rule,config,s);
});
test('Updating a policy invalidates a draft-only reference and advances its revision',()=>{
 let s=seed(),id='R-VOICE-001';s=transact(s,id,'save_rule',{bindings:complete(s,id)});s=transact(s,id,'check_rule');const rev=entity(s,id).rev;
 s=transact(s,'R-AL-001','save_rule',{config:configFor(s,{level:'低'})});s=transact(s,'R-AL-001','check_rule');s=transact(s,'R-AL-001','publish_rule');assert.equal(entity(s,id).checked,false);assert.ok(entity(s,id).rev>rev);
});

test('A policy edit cannot make a published binding incompatible',()=>{
 let s=seed();s=transact(s,'R-VOICE-001','save_rule',{bindings:complete(s,'R-VOICE-001')});s=transact(s,'R-VOICE-001','check_rule');s=transact(s,'R-VOICE-001','publish_rule');
 assert.throws(()=>transact(s,'R-AL-001','save_rule',{config:configFor(s,{role:'客户'})}),/检测角色不适用/);
 assert.throws(()=>transact(s,'R-AL-001','save_rule',{config:configFor(s,{mode:'持续时长'})}),/触发方式不适用/);
});
test('V7 preserves differing V6 trigger profiles in separate reusable policies',()=>{
 let old=seed();old.strategyDemoVersion=6;
 for(const [id,duration] of [['R-EM-002','10'],['R-AC-003','20']]){
  const v=entity(old,id).versions.at(-1);v.configurationModel='indicator-bindings';v.bindings=editableBindings(entity(old,id),old).map((b,i)=>({...b,policyId:i===0?'ALERT-EMOTION':'none',conditions:i===0?{role:'客户',stage:'全程',mode:'持续时长',duration}:{}}));
 }
 const before=structuredClone(old),s=withStrategyDemo(old),a=entity(s,'R-EM-002').versions.at(-1),b=entity(s,'R-AC-003').versions.at(-1);
 assert.deepEqual(old,before);assert.notEqual(a.bindings[0].policyId,b.bindings[0].policyId);
 assert.equal(entity(s,a.bindings[0].policyId).versions.at(-1).config.duration,'10');assert.equal(entity(s,b.bindings[0].policyId).versions.at(-1).config.duration,'20');
 for(const r of before.rules)assert.deepEqual(entity(s,r.id).versions.slice(0,r.versions.length),r.versions);
});
