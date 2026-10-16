// Collect only review-linked, known fixture transcripts; never read or alter browser state.
import {readFileSync,writeFileSync} from 'node:fs';
import {createPrototypeState,createPreviousCatalogState,migrateContextScenarios} from '../lib/prototype-seeds.ts';
import {withFindingContext} from '../lib/finding-context.ts';
const now=new Date('2026-10-08T12:00:00+08:00');
const states=[createPrototypeState(now),createPreviousCatalogState(now)];
for(const name of ['legacy-initial','legacy-rich']) {
 const s=withFindingContext(JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8')));
 states.push(s,migrateContextScenarios(s,now));
}
const groups=new Map();
for(const s of states) {
 const ids=new Set(s.reviews.map(r=>r.callId));
 for(const c of s.calls.filter(c=>ids.has(c.id)&&c.transcript.length&&!c.audio)) {
  const transcript=c.transcript.map(({at,speaker,text})=>({at,speaker,text}));
  const key=JSON.stringify(transcript); const group=groups.get(key)??{callIds:[],transcript};
  if(!group.callIds.includes(c.id))group.callIds.push(c.id);groups.set(key,group);
 }
}
writeFileSync(process.argv[2] ?? '/tmp/review-audio-input.json',JSON.stringify([...groups.values()],null,2));
console.log(JSON.stringify({variants:groups.size,bindings:[...groups.values()].reduce((n,g)=>n+g.callIds.length,0),groups:[...groups.values()].map(g=>({ids:g.callIds,segments:g.transcript.length,lastAt:g.transcript.at(-1).at,text:g.transcript[2]?.text}))},null,2));
