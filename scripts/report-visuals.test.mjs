import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {report, reportCsv} from '../lib/reports.ts';
import {reportTrend, reportVisuals, periodRows, periodMetric, visualMetric} from '../lib/report-visuals.ts';
const now = new Date('2026-09-13T10:00:00+08:00');
const filter = {business:'',group:'',agent:'',start:'2026-09-07',end:'2026-09-13'};
const sum = xs => xs.reduce((n,x)=>n+x,0);

test('V01: daily count and weighted ratios reconcile with source metrics, excluding live calls',()=>{
  const s=createInitial(now), metrics=report(s,filter,now), m=k=>metrics.find(x=>x.key===k);
  for(const key of ['calls','risk','coverage','fp']) {
    const {points}=reportTrend(s,metrics,key,filter,'2026-09-13');
    assert.equal(points.length,7);
    if(['coverage','fp'].includes(key)) {
      const n=sum(points.map(p=>p.count)),d=sum(points.map(p=>p.denominator));
      assert.equal(d,m(key).rows.length);
      assert.equal(d?`${(n/d*100).toFixed(1)}%`:'—',m(key).value);
      for(const p of points) assert.equal(p.value,p.denominator?p.count/p.denominator*100:null);
    } else assert.equal(sum(points.map(p=>p.count)),Number(m(key).value));
  }
  assert.ok(!m('calls').rows.some(r=>r.id==='CALL-1041'));
});
test('V02: Beijing midnight is the inclusive attribution boundary for drill-down and CSV',()=>{
  const rows=[{id:'before',date:'2026-09-12T15:59:59Z'},{id:'start',date:'2026-09-12T16:00:00Z'},{id:'end',date:'2026-09-13T15:59:59Z'},{id:'after',date:'2026-09-13T16:00:00Z'}].map(r=>({...r,callId:'',title:'边界测试',status:'已完成'}));
  const selected=periodRows(rows,'2026-09-13','2026-09-13');
  assert.deepEqual(selected.map(r=>r.id),['start','end']);
  const csv=reportCsv(visualMetric('day','所选日期',selected,'当前日期范围'),createInitial(now),now.toISOString(),filter);
  assert.match(csv,/start/);assert.match(csv,/end/);assert.ok(!csv.includes('before'));assert.ok(!csv.includes('after'));
});
test('V03: long ranges aggregate at most 31 buckets with no duplicate or lost samples',()=>{
  const s=createInitial(now), f={...filter,start:'2026-01-01',end:'2026-09-13'},ms=report(s,f,now);
  const t=reportTrend(s,ms,'calls',f,'2026-09-13');
  assert.ok(t.points.length<=31);assert.ok(t.stride>1);
  assert.equal(t.points[0].start,f.start);assert.equal(t.points.at(-1).end,f.end);
  assert.equal(sum(t.points.map(p=>p.count)),Number(ms.find(m=>m.key==='calls').value));
  const ids=t.points.flatMap(p=>periodRows(ms.find(m=>m.key==='calls').rows,p.start,p.end).map(r=>r.id));
  assert.equal(new Set(ids).size,ids.length);
});
test('V04: empty ratio dates and future dates remain absent, while historical count zero stays zero',()=>{
  const s=createInitial(now),f={...filter,start:'2026-09-01',end:'2026-09-20'},ms=report(s,f,now);
  const ratio=reportTrend(s,ms,'coverage',f,'2026-09-13'),counts=reportTrend(s,ms,'calls',f,'2026-09-13');
  assert.equal(ratio.points[0].value,null);assert.equal(counts.points[0].value,0);
  assert.ok(counts.points.filter(p=>p.start>'2026-09-13').every(p=>p.value===null));
  assert.equal(reportTrend(s,ms,'calls',{...f,start:'2026-09-21'},'2026-09-13').points.length,0);
});
test('V05: indicator bars, verdict segments and agent matrix reconcile and update with latest conclusions',()=>{
  const s=createInitial(now),ms=report(s,filter,now),v=reportVisuals(s,ms,filter);
  assert.equal(v.indicators.length,10);
  assert.equal(sum(v.indicators.map(i=>i.rows.length)),Number(ms.find(m=>m.key==='risk').value));
  assert.equal(sum(v.verdicts.map(g=>g.rows.length)),v.allFindings.length);
  assert.equal(sum(v.teams.flatMap(a=>a.indicators.map(i=>i.rows.length))),Number(ms.find(m=>m.key==='risk').value));
  const changed=structuredClone(s),f=changed.findings.find(f=>v.indicators.some(i=>i.rows.some(r=>r.id===f.id)));
  f.conclusions.push({...f.conclusions.at(-1),version:f.conclusions.at(-1).version+1,value:'false_positive'});
  const next=reportVisuals(changed,report(changed,filter,now),filter);
  assert.ok(!next.indicators.some(i=>i.rows.some(r=>r.id===f.id)));
  assert.ok(next.verdicts.find(g=>g.key==='false_positive').rows.some(r=>r.id===f.id));
});
test('V06: agent and business filters apply to every visualization; restricted roles expose no report rows',()=>{
  const s=createInitial(now),f={...filter,agent:'A1048',business:'信用卡'},ms=report(s,f,now),v=reportVisuals(s,ms,f);
  const allowed=new Set(s.calls.filter(c=>c.agentId===f.agent&&c.business===f.business&&c.endedAt).map(c=>c.id));
  assert.equal(v.teams.length,1);
  for(const r of [...v.allFindings,...v.indicators.flatMap(i=>i.rows),...v.teams.flatMap(a=>a.calls)]) assert.ok(allowed.has(r.callId));
  for(const identity of ['Q01','A1048']) {
    const a={...s,identity},metrics=report(a,f,now),v=reportVisuals(a,metrics,f);
    assert.deepEqual(metrics,[]);assert.deepEqual(v.allFindings,[]);
    assert.ok(v.indicators.every(i=>!i.rows.length));assert.ok(v.teams.every(a=>!a.calls.length));
  }
});
test('V07: selected-period ratio, denominator and export note use the selected period rather than overall totals',()=>{
  const s=createInitial(now),metrics=report(s,filter,now),period={start:'2026-09-13',end:'2026-09-13'};
  for(const key of ['calls','risk','coverage','fp']) {
    const m=periodMetric(s,metrics,key,period),p=reportTrend(s,metrics,key,filter,'2026-09-13').points.at(-1);
    assert.equal(m.rows.length,p.denominator??p.count);
    assert.equal(m.value,['coverage','fp'].includes(key)?p.value===null?'—':`${p.value.toFixed(1)}%`:String(p.count));
    const csv=reportCsv(m,s,now.toISOString(),filter);
    assert.ok(m.note.startsWith('所选日期 2026-09-13'));
    if(key==='coverage')assert.ok(m.note.includes(`已完成 ${p.count} / 已结束通话 ${p.denominator}`));
    if(m.rows.length)assert.ok(csv.includes(m.note));
  }
});
