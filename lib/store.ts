import { initialCases } from './fixtures';
import { nav, type Case, type Role, type View } from './workflow';
export type AppState={version:1;role:Role;view:View;cases:Case[]};
const initial:AppState={version:1,role:'supervisor',view:'alerts',cases:initialCases};
export const storageKey='moss-qc-mvp-p0-v1';
let cache:AppState|undefined;
export function getServerSnapshot(){return initial;}
export function getSnapshot():AppState {
 if(typeof window==='undefined')return initial;
 if(!cache){
  cache=initial;
  try {const d=JSON.parse(localStorage.getItem(storageKey)||'null');if(d?.version===1&&d.role in nav&&Array.isArray(d.cases)&&d.cases.length===initialCases.length&&d.cases.every((x:Case)=>x.id&&Array.isArray(x.events)&&Array.isArray(x.transcript))){cache={...d,view:nav[d.role as Role].includes(d.view)?d.view:nav[d.role as Role][0]};}}catch{/* Invalid demo state starts from the standard fixtures. */}
  const query=new URLSearchParams(window.location.search).get('view') as View|null;
  if(query&&nav[cache!.role].includes(query))cache={...cache!,view:query};
 }
 return cache!;
}
export function subscribe(callback:()=>void){
 const sync=()=>{cache=undefined;callback();};window.addEventListener('storage',sync);window.addEventListener('qc-state',callback);
 return()=>{window.removeEventListener('storage',sync);window.removeEventListener('qc-state',callback);};
}
export function updateState(next:AppState){cache=next;let persisted=true;try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{persisted=false;}window.dispatchEvent(new Event('qc-state'));return persisted;}
export function resetState(){updateState({...initial,cases:structuredClone(initialCases)});window.history.replaceState(null,'','?view=alerts');}
