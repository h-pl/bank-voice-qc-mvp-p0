import { detectionFields, visibleFields, resourceSchemas } from "./strategy-schema.ts";
import { parseCsv } from "./csv.ts";
import type { Rule, RuleDefinition, RuleVersion, State } from "./workflow.ts";

export const ruleDefinitions: Record<string, RuleDefinition> = {
 "R-VOICE-001": {name:"声纹识别",objective:"将通话声纹与已注册声纹进行比对，输出身份比对结果。",checks:["区分身份不匹配、未注册声纹和无法确认身份。"],boundary:"未注册或输入不足不等于身份冒用；各结果分别配置预警。",output:"身份比对结果及对应通话片段",basis:[{kind:"voice"}]},
 "R-ASR-001": {name:"语音识别",objective:"将通话音频转换为按角色、时间排列的文本。",checks:["结合识别热词处理业务术语，保留分角色转写及时间位置。"],boundary:"转写结果作为后续检查输入，不直接判定服务风险。",output:"分角色转写文本及时间位置",basis:[{kind:"hotword"}]},
 "R-CORR-001": {name:"文本纠错",objective:"按纠错词典修正转写中的易错词。",checks:["按纠错词典匹配错误表达和标准表达。"],boundary:"保留原始转写与修正结果，不以纠错命中生成预警。",output:"修正文本及原文对应关系",basis:[{kind:"correction"}]},
 "R-KW-018": {name:"敏感关键词检出",objective:"检查通话文本是否包含关键词库中的敏感表达。",checks:["识别关键词及其同义表达，记录命中原文和时间位置。"],boundary:"关键词命中不直接等于违规，需结合上下文核实。",output:"命中词、原文及时间位置",basis:[{kind:"keyword"}]},
 "R-EM-002": {name:"客户情绪识别",objective:"识别客户情绪类别及其持续片段。",checks:["区分愤怒、焦虑、悲伤和平静，输出连续情绪片段。"],boundary:"检出情绪与触发预警分别判断；是否预警以所关联策略为准。",output:"情绪类别、时间范围及持续时长",basis:[{kind:"emotion"}]},
 "R-INT-001": {name:"客户诉求识别",objective:"依据意图定义识别客户本次来电的业务诉求。",checks:["按意图定义区分查询转账进度、办理挂失等诉求。"],boundary:"仅识别客户意图；是否转接到正确团队由专业性规则依据业务转接规范检查。",output:"意图类别及支持该判断的原文",basis:[{kind:"intent"}]},
 "R-SVC-002": {name:"服务礼仪检查",objective:"检查开场问候与结束确认是否符合服务礼仪规范。",checks:["开场核对问候及工号告知。","结束核对需求确认及致谢，结合提前挂断等例外判断。"],boundary:"客户提前挂断等例外按资源条目处理，不能直接记为规范缺失。",output:"缺失的规范项、适用阶段及对应片段",basis:[{kind:"etiquette"}]},
 "R-AC-003": {name:"通话表达检查",objective:"识别静默、抢话、语速过快和语速过慢等表达特征。",checks:["记录静默与抢话的发生位置和持续范围。","语速特征按配置的字数阈值判断。"],boundary:"各表达特征独立配置；未关联预警策略的特征不产生预警。",output:"表达特征、时间范围及语速或持续时长",basis:[]},
 "R-SOP-006": {name:"身份核验流程",objective:"检查需要身份核验的业务是否按规定顺序完成核验。",checks:["确认客户诉求，通过安全渠道核验身份。","核验成功后方可办理业务，核对必需步骤和先后顺序。"],boundary:"仅检查身份核验 SOP；不检查挂失操作步骤、时限告知或业务转接。前序 IVR 是否有效需核对记录。",output:"缺失或顺序不符的步骤及对应证据",basis:[{kind:"sop",entries:["身份核验"]}]},
 "R-SOP-TIME": {name:"处理时限告知",objective:"检查办理进度相关答复是否说明预计时限或后续查询方式。",checks:["时限可确认时说明预计处理时间。","无法确认时说明原因及后续查询渠道。"],boundary:"仅使用处理时限说明条目；缺少受理记录时保留待核实依据，不推定已超过承诺时限。",output:"时限或查询渠道的缺失项及对应原文",basis:[{kind:"knowledge",entries:["处理时限说明"]}]},
 "R-SVC-INFO": {name:"业务办理与转接说明",objective:"检查办理条件、费用口径及转接说明是否符合业务知识。",checks:["办理前说明适用条件，费用依据实际账单与查询结果。","转接时确认接收团队承接客户诉求，并说明转接原因。"],boundary:"仅引用办理条件和转接说明；客户意图识别是输入，不能直接作为转接错误的结论。",output:"不符合业务口径的答复、对应知识条目及证据",basis:[{kind:"knowledge",entries:["办理条件告知","业务转接说明"]}]},
 "R-COM-012": {name:"敏感信息保护",objective:"检查是否索取或不当披露隐私规则中列明的敏感信息。",checks:["核对信息类型、禁止行为及脱敏要求。","结合正反例区分主动索取与保护性提醒。"],boundary:"“请勿提供验证码”等否定或保护性表达不直接认定为索取。",output:"涉及的信息类型、禁止行为及原文证据",basis:[{kind:"privacy"}]},
 "R-BAN-001": {name:"禁用表达检查",objective:"检查是否使用禁用词库中的过度承诺或不当表达。",checks:["匹配禁用词并核对所属类别、上下文和例外。"],boundary:"引用客户原话或否定表述按词库例外排除。",output:"命中表达、类别及对应片段",basis:[{kind:"banned"}]},
 "R-SVC-009": {name:"消极服务表达",objective:"依据服务态度规范检查推诿、敷衍等服务表现。",checks:["核对是否回应核心诉求、说明负责团队和后续处理渠道。"],boundary:"按流程转接且说明原因，不直接判为推诿；结合上下文与规范例外核实。",output:"不符合的服务表现及上下文证据",basis:[{kind:"attitude"}]},
};

/** Resolve selected entries against the pinned resource version, never the latest resource. */
export function ruleBasis(snapshot: RuleVersion, state: State) {
 return Object.entries(snapshot.resources).flatMap(([id,version])=>{
  const resource=state.resources.find(r=>r.id===id),kind=resource?.kind;
  const selection=snapshot.definition?.basis.find(b=>b.kind===kind);
  if(snapshot.definition && !selection)return [];
  const published=resource?.versions.find(v=>v.version===version);
  const schema=kind?resourceSchemas[kind]:undefined;
  const rows=published && schema?.csv?parseCsv(published.content).slice(1):[];
  const selected=selection?.entries;
  return [{id,version,resource,schema,entries:selected,rows:selected?rows.filter(row=>selected.includes(row[0])):rows,
   missing:selected?.filter(key=>!rows.some(row=>row[0]===key)) ?? [],available:!!published}];
 });
}

const policySignature=(rule:Rule)=>{const c=rule.versions.at(-1)?.config ?? {};return JSON.stringify(visibleFields(detectionFields["6.3.4"],c).map(f=>[f.key,c[f.key]]));};

/** Append current definitions; retain every historical rule, policy and case snapshot. */
export function refineRuleCatalog(input:State, eligibleIds:string[],at:string):State {
 if(input.ruleCatalogVersion===1)return input;
 const s=structuredClone(input),eligible=new Set(eligibleIds),replacements=new Map<string,Rule>();
 const groups=new Map<string,Rule>();
 for(const original of s.rules.filter(r=>r.id.startsWith("POL-R-") && eligible.has(r.id) && eligible.has(r.id.slice(4)))){
  const key=policySignature(original),c=original.versions.at(-1)!.config!;
  let shared=groups.get(key);
  if(!shared){
   const suffix=c.mode==="持续时长"?(c.role==="客户"?"EMOTION":"SILENCE"):`SINGLE-${c.level==="高"?"HIGH":"MEDIUM"}`;
   const id=`POL-SHARED-${suffix}`;
   if(s.rules.some(r=>r.id===id))continue;
   shared={id,rev:0,name:c.mode==="持续时长"?(c.role==="客户"?`客户情绪持续 ${c.duration} 秒提醒`:`静默持续 ${c.duration} 秒提醒`):`${c.level}风险单次命中提醒`,indicator:"6.3.4",description:"按统一条件判断指标结果，满足条件后通知所属主管；多条规则可复用同一策略。",severity:original.severity,fixedResources:true,versions:[{...structuredClone(original.versions.at(-1)!),version:1,at,configurationModel:"shared-policy",triggerRules:undefined}]};
   groups.set(key,shared);s.rules.push(shared);
  }
  replacements.set(original.id,shared);
 }
 for(const rule of s.rules.filter(r=>eligible.has(r.id) && ruleDefinitions[r.id])){
  const previous=rule.versions.at(-1)!;
  const definition=structuredClone(ruleDefinitions[rule.id]);
  const bindings=previous.bindings?.map(b=>({...b,policyId:replacements.get(b.policyId)?.id ?? b.policyId}));
  const policyVersions=Object.fromEntries((bindings ?? []).filter(b=>b.policyId && b.policyId!=="none").map(b=>[b.policyId,[...replacements.values()].some(p=>p.id===b.policyId)?1:previous.policyVersions?.[b.policyId] ?? s.rules.find(p=>p.id===b.policyId)!.versions.at(-1)!.version]));
  const resources=Object.fromEntries(Object.entries(previous.resources).filter(([id])=>definition.basis.some(b=>b.kind===s.resources.find(r=>r.id===id)?.kind)));
  rule.versions.push({...structuredClone(previous),definition,bindings,policyVersions,resources,version:previous.version+1,at});
  rule.name=definition.name;rule.description=definition.objective;rule.rev++;
 }
 for(const rule of s.rules.filter(r=>r.indicator==="6.3.4" && eligible.has(r.id))){
  const used=s.rules.some(r=>[r.versions.at(-1),r.draft].some(v=>v?.bindings?.some(b=>b.policyId===rule.id)));
  if(!used)rule.retired=true;
 }
 s.ruleCatalogVersion=1;
 return s;
}
