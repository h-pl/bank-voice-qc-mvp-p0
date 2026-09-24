"use client";
import { useState, type ReactNode } from "react";
import { person, latest, verdictNames, type Entity, type Finding } from "../lib/workflow";
import { Badge, Button, Modal } from "./ui";
import { SurfaceButton } from "./ui/button";
import { Icon } from "./icon";

export function nextResponsibility(item:Entity):string {
  if ("pause" in item && item.pause) return "申诉裁定后，按裁定结果恢复整改或终止本案。";
  if ("status" in item && ["done","terminated","cancelled","withdrawn","rejected","closed"].includes(item.status)) return "本轮已结束，结论与材料保留供追溯。";
  if ("standardVersion" in item) {
    if(item.status === "response") return "质检员核对主管意见：不赞同则向主管补充核验说明；赞同则补充整改要求并退回坐席。";
    if(!item.inspector) return "坐席可先整改并提交资料；主管并行指定质检员，核验前必须完成指派。";
    if (["pending","executing"].includes(item.status)) return `坐席提交材料 → ${person(item.inspector)?.name ?? "指定质检员"}独立验收 → 主管确认。`;
    if (item.status==="verification") return "质检员提交验收意见 → 主管确认；材料不足则退回补充。";
    return item.supervisorReason==="approve" ? "主管确认通过 → 整改结案。" : item.supervisorReason==="return" ? `主管退回 → 质检员核对意见，再决定向主管说明或让坐席补充。` : "主管调整要求 → 按新标准继续验收。";
  }
  if ("findingIds" in item) {
    if(item.evidenceRequest) return "主管安排补证 → 原质检员继续核查。";
    if(item.type === "spotcheck" && !item.findingIds.length) return item.status === "supervisor" ? "主管确认未发现问题后完成抽检；不认可则退回原质检员核查。" : "按抽检范围核查：有发现登记问题，无发现提交范围核验说明，由主管确认。";
    if(item.appealId) return "质检员提交核查意见 → 主管完成申诉裁定。";
    return item.status==="supervisor" ? "认可核实结果：误报归档，非误报分发给坐席；不认可：退回原质检员重新核实。" : "质检员提交逐项意见 → 主管确认正式结论。";
  }
  if ("conclusionVersion" in item) return item.status==="supplement" ? "坐席补证 → 质检员核对接收 → 返回原办理环节。" : item.status==="submitted" ? "主管指派质检员 → 核查并提交意见 → 主管确认 → 结果送达坐席。" : "核查意见交主管裁定 → 结果送达坐席，同步关联整改。";
  if ("executor" in item) return "执行人补齐材料 → 指定接收人核对 → 返回原办理环节。";
  if ("conclusions" in item) return latest(item)?.value === "false_positive" ? "误报已归档，保留原因与证据；主管可记录规则优化反馈。" : latest(item) ? "坐席查看处理结果与要求：接受进入整改，不接受进入申诉。" : "主管初审：误报归档；需核实交质检员；无需核实直接提醒并分发。";
  return "检测完成后查看候选问题，必要时发起人工抽查。";
}

type DocumentEntry={id:string;title:string;summary:string;status:string;ready:boolean;content:ReactNode};
export function CaseDocuments({item,primary,onOpen}: {item:Entity;primary?:Finding;onOpen:(id:string)=>void}) {
  const [selected,setSelected]=useState<string>();
  const entries:DocumentEntry[]=[];
  const conclusion=primary ? "conclusionVersion" in item ? primary.conclusions.find(c=>c.version===item.conclusionVersion) : latest(primary) : undefined;
  if(primary && conclusion && !("findingIds" in item)) entries.push({id:"conclusion",title:"原始问题与结论依据",summary:conclusion ? `V${conclusion.version} · ${verdictNames[conclusion.value]} · ${conclusion.note}` : `${primary.title} · 原始候选，尚无人工结论`,status:conclusion ? `结论 V${conclusion.version}` : "待复核",ready:!!conclusion,content:<><p>{primary.title}</p><p>{conclusion?.note ?? "该候选尚未形成正式人工结论。"}</p><dl><dt>规则依据</dt><dd>{primary.ruleId} · V{conclusion?.ruleVersion ?? primary.ruleVersion}</dd><dt>检测批次</dt><dd>{conclusion?.batchId ?? primary.batchId}</dd></dl></>});
  if("conclusionVersion" in item && !("standardVersion" in item) && (item.sameReviewerReason || item.outcome)) entries.push({id:"appeal",title:"申诉核查与裁定",summary:item.outcome ? "查看裁定结果与核查说明" : "查看同人核查说明",status:item.outcome ? "已裁定" : "已提交",ready:true,content:<><p>针对结论 V{item.conclusionVersion}</p>{item.sameReviewerReason && <p>同人核查说明：{item.sameReviewerReason}</p>}{item.outcome && <p>裁定：{{maintain:"维持原结论",false_positive:"改判误报",insufficient:"证据不足",adjust:"调整成立范围"}[item.outcome]}</p>}</>});
  if("standardVersion" in item) {
    entries.push({id:"standard",title:"整改交接要求",summary:item.standard,status:`标准 V${item.standardVersion}`,ready:true,content:<><h3>整改目标</h3><p>{item.goal}</p><h3>完成标准</h3><p>{item.standard}</p><p>观察要求：{item.observation} · {item.sampleCount} 通样例</p></>});
    entries.push({id:"materials",title:"整改完成材料",summary:item.materials.at(-1)?.text ?? "等待坐席提交完成说明与复测样例",status:item.materials.length ? `${item.materials.length} 份已提交` : "待补充",ready:!!item.materials.length,content:<>{item.materials.map((m,index)=><section key={index}><h3>材料 {index+1}</h3><p>{m.text}</p>{m.attachment && <p>附件记录：{m.attachment}</p>}<div className="sample-links">{m.samples.map(id=><Button key={id} onClick={()=>{setSelected(undefined);onOpen(id);}}>查看样例 {id}</Button>)}</div></section>)}{!item.materials.length && <p>本轮尚未提交材料，提交后会保留完成说明和样例记录。</p>}</>});
    entries.push({id:"acceptance",title:"独立验收意见",summary:item.acceptance?.note ?? (item.acceptanceDraft ? "验收意见已保存为草稿，尚未正式提交" : "材料提交后由指定质检员验收"),status:item.acceptance ? {pass:"通过",fail:"不通过",insufficient:"材料不足"}[item.acceptance.result] : "待验收",ready:!!item.acceptance,content:<><p>{item.acceptance?.note ?? "尚未形成正式验收意见。"}</p><p>第 {item.acceptance?.round ?? item.round} 轮 · 标准 V{item.acceptance?.version ?? item.standardVersion}</p><p>验收人：{person(item.inspector)?.name}</p></>});
  }
  const document=entries.find(x=>x.id===selected);
  return <>{entries.map(entry=>{
    const content=<><span className="case-document-icon"><Icon name="file"/></span><span><b>{entry.title}</b><small>{entry.summary}</small></span><Badge tone={entry.ready ? "neutral" : "warning"}>{entry.status}</Badge></>;
    return entry.ready ? <SurfaceButton className="case-document" key={entry.id} onClick={()=>setSelected(entry.id)}>{content}<span className="case-preview-label"><Icon name="eye" size={15}/>预览</span></SurfaceButton> : <div className="case-document case-document-pending" key={entry.id}>{content}</div>;
  })}{document && <Modal title={document.title} description={`${item.id} · ${document.status}`} onClose={()=>setSelected(undefined)} footer={<Button onClick={()=>setSelected(undefined)}>返回案件</Button>}><div className="document-preview">{document.content}</div></Modal>}</>;
}
