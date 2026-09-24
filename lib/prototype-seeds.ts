import { withAlertDeadlines } from "./alert-deadlines.ts";
import { withPrdSeedCatalog } from "./prd-seed-catalog.ts";
import { createInitial } from './fixtures.ts';
import { withRichDemo } from './demo-enrichment.ts';
import { withStrategyDemo } from './strategy-demo.ts';
import { normalizeLegacyLabels } from './prototype-labels.ts';

import { withContextScenarios, type ContextSeedState } from "./context-scenarios.ts";

import { refineRuleCatalog } from "./rule-catalog.ts";

type SeedState = ContextSeedState;
export function createPreviousCatalogState(now:Date): SeedState {
 return normalizeLegacyLabels(withPrdSeedCatalog(withStrategyDemo(withRichDemo(createInitial(now))),now)) as SeedState;
}
const fingerprint=(value:unknown)=>JSON.stringify(value,(key,value)=>key==="at"?undefined:value);
export function migrateRuleCatalog(input:SeedState,now=new Date()):SeedState {
 if(input.ruleCatalogVersion===1 || input.seedIntegrityVersion!==2)return input;
 const baseline=createPreviousCatalogState(now);
 const eligible=input.rules.filter(rule=>{
  const original=baseline.rules.find(r=>r.id===rule.id);
  return original && fingerprint(rule)===fingerprint(original) && Object.keys(rule.versions.at(-1)?.resources ?? {}).every(id=>fingerprint(input.resources.find(r=>r.id===id))===fingerprint(baseline.resources.find(r=>r.id===id)));
 }).map(r=>r.id);
 return refineRuleCatalog(input,eligible,now.toISOString()) as SeedState;
}
export function createPrototypeState(now=new Date()): SeedState {
  const previous=createPreviousCatalogState(now);
  const refined=refineRuleCatalog(previous,previous.rules.map(r=>r.id),now.toISOString()) as SeedState;
  return withAlertDeadlines(withContextScenarios(refined,refined,now));
}

/** Refresh only the known, completely untouched old fixture. Any command/edit blocks migration. */
export function migrateUntouchedSeeds(input: SeedState): SeedState {
  if(input.seedIntegrityVersion===2 || input.revision!==1 || input.requests.length || input.supplements.length)return input;
  const entities=[...input.calls,...input.findings,...input.reviews,...input.appeals,...input.remedies];
  if(entities.some(e=>e.rev!==0))return input;
  if(input.logs.some(l=>!/^EV-(SEED$|DEMO-|UI-|SCENARIO-)/.test(l.id)))return input;
  const old=input.reviews.find(r=>r.id==='WO-1039');
  if(!old || (input.seedIntegrityVersion!==1 && (old.scope!=='逐项核对服务表达与业务依据'||old.status!=='supervisor'||old.findingIds.join(',')!=='F-1039,F-1039-B')))return input;
  if(![24,32].includes(input.calls.length)||![13,21].includes(input.findings.length))return input;
  const live=input.calls.find(c=>c.id==='CALL-1041');if(!live||live.endedAt||live.duration!==31)return input;
  const now=new Date(Date.parse(live.startedAt)+(input.seedIntegrityVersion===1?live.duration*1000:360000));
  const fresh=createPrototypeState(now);
  return {...fresh,identity:input.identity,view:input.view,readEvents:input.readEvents};
}

export function migrateContextScenarios(input:SeedState,now=new Date()):SeedState {
 if(input.contextScenarioVersion===3)return input;
 const previous=createPreviousCatalogState(now);
 const template=refineRuleCatalog(previous,previous.rules.map(r=>r.id),now.toISOString()) as SeedState;
 return withContextScenarios(input,template,now);
}
