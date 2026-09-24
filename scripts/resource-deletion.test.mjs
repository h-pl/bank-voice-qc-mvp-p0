import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {apply,actions} from '../lib/workflow.ts';
import {resourceDeletionBlockers,pendingResourceRules} from '../lib/resource-publication.ts';
const now=new Date('2026-09-22T10:00:00+08:00');
const command=s=>({id:'RES-SOP',action:'delete_resource',rev:s.resources.find(r=>r.id==='RES-SOP').rev,requestId:'delete-sop',input:{note:'从列表删除资源'}});
test('Deletion rejects active and draft references without changing state',()=>{
 const s=createInitial(now),before=structuredClone(s);
 assert.ok(resourceDeletionBlockers(s,'RES-SOP').length);
 assert.throws(()=>apply(s,command(s),now),/仍被.*引用/);
 assert.deepEqual(s,before);
 for(const r of s.rules) delete r.versions.at(-1).resources['RES-SOP'];
 s.rules[0].draft=structuredClone(s.rules[0].versions.at(-1));s.rules[0].draft.resources['RES-SOP']=1;
 assert.throws(()=>apply(s,command(s),now),/仍被.*引用/);
});
test('Deletion retains historical snapshots and audit while preventing edits or republication',()=>{
 const s=createInitial(now);
 for(const r of s.rules) if('RES-SOP' in r.versions.at(-1).resources){const v=structuredClone(r.versions.at(-1));v.version++;delete v.resources['RES-SOP'];r.versions.push(v);}
 const versions=structuredClone(s.resources.find(r=>r.id==='RES-SOP').versions),rules=structuredClone(s.rules);
 const next=apply(s,command(s),now),deleted=next.resources.find(r=>r.id==='RES-SOP');
 assert.equal(deleted.deletedAt,now.toISOString());assert.deepEqual(deleted.versions,versions);assert.deepEqual(next.rules,rules);
 assert.deepEqual(actions(next,'RES-SOP'),['create_resource']);assert.deepEqual(pendingResourceRules(next,deleted),[]);
 assert.ok(next.logs.some(l=>l.target==='RES-SOP'&&l.action==='删除资源'));
 assert.equal(apply(next,command(s),now),next);
 assert.equal(s.resources.find(r=>r.id==='RES-SOP').deletedAt,undefined);
});
test('Deletion rejects read-only roles and stale revisions',()=>{
 const s=createInitial(now);s.identity='Q01';assert.throws(()=>apply(s,command(s),now),/不允许/);
 s.identity='S01';const cmd=command(s);cmd.rev--;assert.throws(()=>apply(s,cmd,now),/记录已更新/);
});
