import type { State, Log } from "./workflow.ts";
/** Backfill only the untouched demo scenarios; never infer user actions from a later state. */
export function withDemoHistory(state: State): State {
  const added: Log[]=[];
  const add=(target:string,callId:string|undefined,at:string,actor:string,action:string,note:string,index:number)=>{
    const id=`EV-DEMO-${target}-${index}`;
    if(!state.logs.some(log=>log.id===id))added.push({id,target,callId,at,actor,action,note});
  };
  const ago=(at:string,minutes:number)=>new Date(Date.parse(at)-minutes*60000).toISOString();
  for(const review of state.reviews.filter(item=>["WO-1039","WO-1039-B","WO-1038"].includes(item.id) && item.rev===0)) {
    if(state.logs.some(log=>log.target===review.id && !log.id.startsWith("EV-DEMO-")))continue;
    const call=state.calls.find(item=>item.id===review.callId);if(!call?.endedAt)continue;
    const base=call.endedAt;
    add(review.id,call.id,ago(base,0),"system","通话检测完成",`已生成 ${review.findingIds.length} 项候选问题，命中转写与规则版本已保留，等待人工核对。`,1);
    add(review.id,call.id,new Date(Date.parse(base)+5*60000).toISOString(),"S01","分派复核",`已分派质检员核对${review.scope}，复核结果提交主管确认。`,2);
    if(review.status==="supervisor")add(review.id,call.id,new Date(Date.parse(base)+30*60000).toISOString(),review.owner,"提交复核意见",review.findingIds.map(id=>`${state.findings.find(f=>f.id===id)?.title}：${review.opinions[id]?.note ?? "待核对"}`).join("；") + "。等待主管确认。",3);
  }
  for(const appeal of state.appeals.filter(item=>item.id==="AP-1033" && item.rev===0 && item.status==="submitted")){
    if(state.logs.some(log=>log.target===appeal.id && !log.id.startsWith("EV-DEMO-")))continue;
    const finding=state.findings.find(item=>item.id===appeal.findingId);const conclusion=finding?.conclusions.find(item=>item.version===appeal.conclusionVersion);if(!conclusion)continue;
    add(appeal.id,finding?.callId,new Date(Date.parse(conclusion.at)+30*60000).toISOString(),appeal.agentId,"提交申诉",appeal.note,1);
    add(appeal.id,finding?.callId,new Date(Date.parse(conclusion.at)+31*60000).toISOString(),"system","申诉进入待受理队列","已保留原结论版本与申诉证据，当前由质检主管受理。",2);
  }
  for(const finding of state.findings.filter(item=>item.id==="F-1041" && item.rev===0 && item.status==="candidate")){
    const seed=state.logs.find(log=>log.id==="EV-SEED");if(!seed)continue;
    add(finding.id,finding.callId,ago(seed.at,0),"system","生成风险候选","通话片段命中隐私保护规则，已关联原始转写与录音位置，等待主管核对。",1);
  }
  return added.length ? {...state,logs:[...added,...state.logs].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))} : state;
}
