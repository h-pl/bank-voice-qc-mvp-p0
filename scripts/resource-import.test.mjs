import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseCsv, validateImportedContent, readResourceFile} from '../lib/resource-import.ts';
import {parseSopRules,readSopRules,sopEditingText} from '../lib/sop-rules.ts';
import {createInitial} from '../lib/fixtures.ts';
import {apply,entity} from '../lib/workflow.ts';
test('CSV preserves escaped quotes and rejects unclosed quotes',()=>{
 assert.deepEqual(parseCsv('"a,b","line1\nline2"\r\n"a""b",c'),[['a,b','line1\nline2'],['a"b','c']]);
 assert.throws(()=>parseCsv('"broken'),/引号/);
});
test('SOP parses named collections and reports duplicate, empty and malformed rows',()=>{
 const rules=parseSopRules('身份核验：核对身份，确认结果；\n业务办理：查询进度，反馈结果；');
 assert.equal(rules.length,2);assert.deepEqual(rules[0],{name:'身份核验',steps:['核对身份','确认结果']});
 assert.throws(()=>parseSopRules('核验：核对身份，确认结果；\n核验：核对信息，确认结果；'),/第 2 行.*重复/);
 assert.throws(()=>parseSopRules('核验：核对身份，确认结果'),/第 1 行.*分号/);
 assert.throws(()=>parseSopRules('核验：核对身份，，确认结果；'),/步骤不能为空/);
 assert.throws(()=>parseSopRules('核验：核对身份；'),/至少两个/);
 assert.throws(()=>parseSopRules('核验：核对身份，确认结果；办理：查询进度，反馈结果；'),/一行只能/);
});
test('Only single-column UTF-8 CSV is supported; template is importable',async()=>{
 for(const ext of ['xlsx','pdf','md','json','txt']) await assert.rejects(readResourceFile(new File(['abc'],`x.${ext}`),'SOP'),/仅支持 CSV/);
 await assert.rejects(readResourceFile(new File(['a'.repeat(5*1024*1024+1)],'x.csv'),'词库'),/5 MB/);
 await assert.rejects(readResourceFile(new File(['a,b'],'x.csv'),'词库'),/只有一列/);
 assert.throws(()=>validateImportedContent('\ufffd'),/编码/);
 const result=await readResourceFile(new File([fs.readFileSync('public/templates/sop-template.csv')],'sop.csv'),'SOP');
 assert.equal(parseSopRules(result).length,2);
});
test('Legacy snapshots remain unchanged while edit text becomes a named rule',()=>{
 const source='1. 核对身份\n2. 确认结果';
 assert.deepEqual(readSopRules(source,'身份核验'),[{name:'身份核验',steps:['核对身份','确认结果']}]);
 assert.equal(sopEditingText(source,'身份核验'),'身份核验：核对身份，确认结果；');
});
test('Imported SOP draft and source survive serialization; publish leaves rule references unchanged',()=>{
 const now=new Date('2026-09-21T10:00:00+08:00');let s=createInitial(now);const original=structuredClone(entity(s,'RES-SOP').versions);const rules=structuredClone(s.rules);
 const run=(action,input={})=>{s=apply(s,{id:'RES-SOP',action,rev:entity(s,'RES-SOP').rev,requestId:action,input:{note:'导入新的 SOP 规则集合',...input}},now);};
 run('save_resource',{content:'身份核验：核对身份，确认结果；',scope:'全部业务',resourceRole:'坐席',exception:'保留例外',sourceFile:'sop-template.csv'});
 s=JSON.parse(JSON.stringify(s));assert.equal(entity(s,'RES-SOP').draft.sourceFile,'sop-template.csv');assert.deepEqual(entity(s,'RES-SOP').versions,original);
 run('check_resource',{checkPass:true});run('publish_resource');assert.deepEqual(s.rules,rules);assert.deepEqual(entity(s,'RES-SOP').versions.slice(0,-1),original);
});
