import { parseCsv } from "./csv.ts";
import type { State, Rule, RuleVersion, Resource } from "./workflow.ts";
export type ConfigField={key:string;label:string;options?:string[];min?:number;max?:number;unit?:string;multiple?:boolean;value:string;when?:[string,string]};
const select=(key:string,label:string,options:string[],value=options[0] ?? ""):ConfigField=>({key,label,options,value});
const number=(key:string,label:string,value:number,min:number,max:number,unit:string,when?:[string,string]):ConfigField=>({key,label,value:String(value),min,max,unit,when});
export const indicatorRuleCategories=[
 ["6.2.1","声纹识别"],["6.2.2","语音识别"],["6.2.3","关键词检出"],["6.2.4","文本纠错"],["6.2.5","情绪识别"],["6.2.6","意图识别"],
 ["6.3.5","服务礼仪"],["6.3.6","语言表达"],["6.3.7","专业性"],["6.3.8","隐私性"],["6.3.9","禁用词"],["6.3.10","消极情感"],
];
export const indicatorName=(id:string)=>indicatorRuleCategories.find(([key])=>key===id)?.[1] ?? (id==="6.3.4"?"风险上报与干预":id);
export const supportsWarning=(indicator:string)=>indicatorRuleCategories.some(([id])=>id===indicator) && !["6.2.2","6.2.4"].includes(indicator);
export const featureIndicators=["6.2.1","6.2.5","6.2.6","6.3.6"];
// PRD 7.9.2：先区分预警归属，再按是否具有指标特有字段分类。
// 分类描述能力本身；某条特征选择“不预警”不会改变其所属类别。
export const indicatorConfigurationCategories = [
 ["fixed", "固定参数"], ["configurable", "可配参数"], ["no-warning", "无需预警"],
] as const;
export function indicatorConfigurationCategory(indicator: string) {
 if (indicator === "6.3.4") return "alert";
 if (!indicatorRuleCategories.some(([id]) => id === indicator)) return undefined;
 if (!supportsWarning(indicator)) return "no-warning";
 return featureIndicators.includes(indicator) ? "configurable" : "fixed";
}
export const indicatorConfigurationLabel = (indicator: string) => indicator === "6.3.4" ? "预警配置" : indicatorConfigurationCategories.find(([id]) => id === indicatorConfigurationCategory(indicator))?.[1] ?? "任务或展示设置";
export const featureKey=(indicator:string)=>`feature:${indicator}`;
export const policyTriggers=(rule:Rule,state:State,snapshot?:RuleVersion)=>snapshot?.triggerRules ?? rule.versions.at(-1)?.triggerRules ?? rule.draft?.triggerRules ?? rule.legacyTriggerRules ?? state.rules.filter(r=>r.versions.at(-1)?.config?.alertPolicy===rule.id).map(r=>r.id);
export function indicatorFeatureField(indicator:string,state:State):ConfigField|undefined {
 let label="",options:string[]=[];
 if(indicator==="6.2.1"){label="异常类型";options=["身份不匹配","未注册声纹","无法确认身份"];}
 if(indicator==="6.2.5"){label="情绪类别";options=["愤怒","焦虑","悲伤","平静"];}
 if(indicator==="6.2.6"){label="意图类别";options=[...new Set(state.resources.filter(r=>r.kind==="intent" && !r.deletedAt).flatMap(r=>parseCsv(r.versions.at(-1)?.content ?? "").slice(1).map(row=>row[0]).filter(Boolean)))];}
 if(indicator==="6.3.6"){label="表达特征";options=["静默","抢话","语速过快","语速过慢"];}
 return label?{...select(featureKey(indicator),`${indicatorName(indicator)} · ${label}`,options,""),multiple:true}:undefined;
}
export const detectionFields:Record<string,ConfigField[]>={"6.3.4":[
 select("role","检测角色",["坐席","客户","双方"]),select("stage","检测阶段",["全程","开场","服务中","结束"]),
 number("stageSeconds","阶段范围",30,1,3600,"秒"),
 number("middleStartSeconds","服务中起点（开始后）",30,0,3600,"秒",["stage","服务中"]),number("middleEndSeconds","服务中终点（结束前）",30,0,3600,"秒",["stage","服务中"]),
 select("mode","触发方式",["单次命中","累计次数","持续时长"]),number("count","累计次数",3,2,1000,"次",["mode","累计次数"]),
 select("window","统计窗口",["整通通话","最近 1 分钟","最近 5 分钟","自定义时长"]),number("windowSeconds","自定义统计窗口",60,1,86400,"秒",["window","自定义时长"]),
 number("duration","持续时长",30,1,3600,"秒",["mode","持续时长"]),select("level","风险等级",["高","中","低"]),
 {...select("action","处置动作",["通知","通话中提醒","进入人工复核"]),multiple:true},select("recipient","接收对象",["所属主管","质检一组","质检二组","当前坐席"]),
 select("repeat","重复提醒间隔",["每通话仅一次","1 分钟","5 分钟","自定义时长"]),number("repeatSeconds","自定义提醒间隔",60,1,86400,"秒",["repeat","自定义时长"])
]};
export const visibleFields=(fields:ConfigField[],config:Record<string,string>)=>fields.filter(f=>(!f.when || config[f.when[0]]===f.when[1]) && !(f.key==="stageSeconds" && !["开场","结束"].includes(config.stage)) && !(["window","windowSeconds"].includes(f.key) && config.mode!=="累计次数"));
export function policyCapabilities(state:State,triggers:string[]){
 const linked=state.rules.filter(r=>triggers.includes(r.id));
 return {roles:linked.some(r=>["6.2.1","6.3.5","6.3.7","6.3.8","6.3.9","6.3.10"].includes(r.indicator))?["坐席"]:["坐席","客户","双方"],stages:linked.some(r=>r.indicator==="6.2.1")?["全程"]:["全程","开场","服务中","结束"],modes:linked.length && linked.every(r=>["6.2.5","6.3.6"].includes(r.indicator))?["单次命中","累计次数","持续时长"]:["单次命中","累计次数"]};
}
export function legacyRuleFields(rule:Rule,state?:State,triggers?:string[]):ConfigField[]{
 if(rule.indicator!=="6.3.4")return [];
 const fields=detectionFields["6.3.4"].map(f=>({...f}));if(!state)return fields;
 const selected=triggers ?? policyTriggers(rule,state);const caps=policyCapabilities(state,selected);
 for(const f of fields){if(f.key==="role")f.options=caps.roles;if(f.key==="stage")f.options=caps.stages;if(f.key==="mode")f.options=caps.modes;}
 return [...new Set(state.rules.filter(r=>selected.includes(r.id)).map(r=>r.indicator))].flatMap(id=>{const f=indicatorFeatureField(id,state);return f?[f]:[];}).concat(fields);
}
export const policyFieldKeys=["level","action","recipient","repeat","repeatSeconds"];
export function ruleFields(rule:Rule,...context:[State?,string[]?]):ConfigField[]{void context;return rule.indicator==="6.3.4"?detectionFields["6.3.4"].map(f=>({...f})):[];}
export function policyCompatibility(rule:Rule,feature:string,config:Record<string,string>,state:State){
 const caps=policyCapabilities(state,[rule.id]);
 if(!caps.roles.includes(config.role))return "检测角色不适用";
 if(!caps.stages.includes(config.stage))return "检测阶段不适用";
 if(!caps.modes.includes(config.mode) || (feature==="抢话" && config.mode==="持续时长"))return "触发方式不适用";
 return "";
}
export const ruleHasParameters=(rule:Rule)=>rule.retired?false:rule.fixedResources?(rule.indicator==="6.3.4" || supportsWarning(rule.indicator)):!!rule.editable || !!rule.versions.at(-1)?.config;
export const fieldDefaults=(fields:ConfigField[])=>Object.fromEntries(fields.map(f=>[f.key,f.value]));
export function fixedResourceReferences(rule:Rule,state:State):Record<string,number>{return Object.fromEntries(state.resources.filter(r=>!r.deletedAt && r.kind && resourceSchemas[r.kind]?.indicator===rule.indicator && (!rule.versions.at(-1)?.definition || rule.versions.at(-1)!.definition!.basis.some(b=>b.kind===r.kind)) && r.versions.length).map(r=>[r.id,r.versions.at(-1)!.version]));}
export const resourceKindsFor=(rule:Rule)=>Object.entries(resourceSchemas).filter(([kind,schema])=>schema.indicator===rule.indicator && (!rule.versions.at(-1)?.definition || rule.versions.at(-1)!.definition!.basis.some(b=>b.kind===kind)));
export function validateRuleResources(rule:Rule,refs:Record<string,number>,state:State){
 const kinds=resourceKindsFor(rule).map(([kind])=>kind);
 for(const [id,version] of Object.entries(refs)){const r=state.resources.find(r=>r.id===id && !r.deletedAt);if(!r?.kind || resourceSchemas[r.kind]?.indicator!==rule.indicator)throw new Error("请选择该指标对应类型的业务资源");if(!r.versions.some(v=>v.version===version))throw new Error("只能引用资源的已发布版本");}
 for(const kind of kinds)if(!Object.keys(refs).some(id=>state.resources.find(r=>r.id===id)?.kind===kind))throw new Error(`请先发布${resourceSchemas[kind].name}`);
}
export function validateRuleConfig(rule:Rule,config:Record<string,string>,state:State,triggers=policyTriggers(rule,state)){
 const fields=ruleFields(rule,state,triggers);
 for(const key of Object.keys(config))if(!fields.some(f=>f.key===key))throw new Error(`不支持的配置字段：${key}`);
 for(const f of visibleFields(fields,config)){
  const v=config[f.key];const valid=f.options?(f.multiple?!!v && new Set(v.split(/[；＋]/)).size===v.split(/[；＋]/).length && v.split(/[；＋]/).every(x=>f.options!.includes(x)):f.options.includes(v)):/^\d+$/.test(v ?? "") && Number(v)>=f.min! && Number(v)<=f.max!;
  if(!valid)throw new Error(`请正确填写${f.label}${f.unit?`（${f.min}–${f.max} ${f.unit}）`:"；选项须与所选指标兼容"}`);
 }
 if(rule.indicator==="6.3.4"){
  for(const linked of state.rules){
   for(const b of linked.versions.at(-1)?.bindings ?? [])if(b.policyId===rule.id){const issue=policyCompatibility(linked,b.feature,config,state);if(issue)throw new Error(`${linked.name} · ${b.feature}：${issue}，请先调整关联`);}
  }
  if(config.action==="通话中提醒" && config.recipient!=="当前坐席")throw new Error("通话中提醒的接收对象应为当前坐席");
  if(config.action!=="通话中提醒" && config.recipient==="当前坐席")throw new Error("通知或人工复核请选择主管或质检组");
 }
}
export function configurationDiff(rule:Rule,state:State):Array<[string,string,string]>{
 const previous=rule.versions.at(-1),draft=rule.draft;if(!draft)return [];
 const fields=ruleFields(rule,state),beforeFields=visibleFields(fields,previous?.config ?? {}),afterFields=visibleFields(fields,draft.config ?? {});
 const value=(snapshot:RuleVersion|undefined,active:ConfigField[],f:ConfigField)=>!snapshot?"—":!active.some(x=>x.key===f.key)?"未启用":snapshot.config?.[f.key]===undefined?"—":`${snapshot.config[f.key]}${f.unit?` ${f.unit}`:""}`;
 const diff:Array<[string,string,string]>=fields.filter(f=>beforeFields.some(x=>x.key===f.key)||afterFields.some(x=>x.key===f.key)).map(f=>[f.label,value(previous,beforeFields,f),value(draft,afterFields,f)]);
 return diff;
}
export const configLabel=(key:string,value:string,state:State)=>key==="alertPolicy"?state.rules.find(r=>r.id===value)?.name ?? value:value;
export type ResourceSchema={name:string;group:Resource["type"];fields:string[];required:number[];rows:string[][];csv:boolean;indicator:string;note?:string};
export const resourceSchemas:Record<string,ResourceSchema>={
 voice:{name:"声纹库",group:"业务知识",fields:["坐席/工号","注册语音","启用状态"],required:[0,1,2],rows:[["A1048","A1048-注册语音.wav","启用"],["A1186","A1186-注册语音.wav","停用"]],csv:false,indicator:"6.2.1",note:"音频仅记录文件名，尚未接入声纹注册服务。"},
 hotword:{name:"识别热词",group:"词库",fields:["词条"],required:[0],rows:["慧盈存","惠民贷","跨行汇款","对公账户","自动还款","信用卡分期","大额存单"].map(x=>[x]),csv:true,indicator:"6.2.2"},
 keyword:{name:"关键词库",group:"词库",fields:["关键词","同义词"],required:[0],rows:[["投诉","申诉；我要投诉"],["提前还款","提前结清"],["挂失","卡丢了；遗失银行卡"],["费用争议","乱扣费"],["转账失败","汇款失败"],["账户冻结","账户受限"]],csv:true,indicator:"6.2.3"},
 correction:{name:"纠错词库",group:"词库",fields:["易错文本","正确文本"],required:[0,1],rows:[["跨行会款","跨行汇款"],["帐单日","账单日"],["慧赢存","慧盈存"]],csv:true,indicator:"6.2.4"},
 emotion:{name:"情绪标签",group:"业务知识",fields:["情绪名称","情绪描述"],required:[0,1],rows:[["愤怒","强烈不满、激动或愤怒的表达"],["焦虑","反复担忧结果、催促确认"],["悲伤","低落或悲伤的表达"],["平静","情绪稳定、正常交流"]],csv:false,indicator:"6.2.5",note:"使用已交付标签，可维护业务说明；不支持新增模型尚未提供的情绪。"},
 intent:{name:"意图定义",group:"业务知识",fields:["意图名称","定义","正例","反例"],required:[0,1],rows:[["查询转账进度","确认已提交转账的状态","我昨天的转账到了吗","我想现在转一笔钱"],["办理挂失","申请挂失遗失的银行卡","我的卡丢了需要挂失","我找到了之前的卡"]],csv:true,indicator:"6.2.6"},
 etiquette:{name:"服务礼仪规范",group:"业务知识",fields:["检查项名称","必说要素","允许表达","例外表达"],required:[0,1],rows:[["开场问候","问候；银行身份；工号","您好，银行客服，工号1048","客户直接说明紧急挂失"],["结束确认","确认其他需求；致谢","还有其他可以帮您的吗","客户提前挂断"]],csv:true,indicator:"6.3.5"},
 sop:{name:"SOP 规则集合",group:"SOP",fields:["SOP名称","步骤序号","步骤内容","是否必需"],required:[0,1,2,3],rows:[["身份核验","1","确认客户当前诉求","是"],["身份核验","2","通过安全渠道核验身份","是"],["身份核验","3","确认核验成功后办理业务","是"],["挂失办理","1","确认遗失卡片信息","是"],["挂失办理","2","完成挂失登记并告知结果","是"],["挂失办理","3","说明补卡方式","否"]],csv:true,indicator:"6.3.7"},
 knowledge:{name:"业务知识",group:"业务知识",fields:["知识主题","知识内容","依据名称","生效日期","失效日期"],required:[0,1],rows:[["转账进度查询","完成身份核验后查询处理状态，不作无依据到账承诺","业务口径","2026-01-01","2026-12-31"],["账单争议处理","核对账期和交易明细，说明争议登记渠道","服务规范","2026-01-01",""]],csv:true,indicator:"6.3.7"},
 privacy:{name:"隐私规则",group:"业务知识",fields:["规则名称","信息类型","禁止行为","正例","反例","脱敏要求"],required:[0,1,2],rows:[["禁止索取验证码","短信验证码","索取完整验证码","请把六位验证码告诉我","请勿向任何人透露验证码","全部遮蔽"],["限制披露卡号","银行卡号","未经核验披露完整卡号","您的完整卡号是…","核验后确认卡号尾四位","仅显示后四位"]],csv:true,indicator:"6.3.8"},
 banned:{name:"禁用词库",group:"词库",fields:["禁用词","类别","例外"],required:[0],rows:[["保证立即到账","过度承诺","引用客户原话或否定表述"],["绝对没有费用","过度承诺","说明不能承诺无费用"],["别再问了","不当表达","转述客户原话"]],csv:true,indicator:"6.3.9"},
 attitude:{name:"服务态度规范",group:"业务知识",fields:["表现名称","判定说明","正例","反例","例外"],required:[0,1],rows:[["推诿","拒绝说明后续处理渠道并转嫁责任","你自己去找对方吧","我为您查询负责团队并说明联系方式","按流程转接且说明原因"],["敷衍","未回应核心问题且重复无关回答","都说过了就这样吧","我再为您确认具体原因","客户反复要求无法承诺的结果"]],csv:true,indicator:"6.3.10"},
};
export const indicatorMatrix=[
 ["声纹识别","资源固定引用；指标中配置异常类型","voice"],["语音识别","引用资源","hotword"],["关键词检出","引用资源；检出后按通用策略预警","keyword"],["文本纠错","引用资源","correction"],["情绪识别","资源固定引用；指标中配置情绪类别","emotion"],["意图识别","资源固定引用；指标中配置意图类别","intent"],
 ["覆盖率","录音来源、业务/班组范围、全量/抽检、抽检比例",""],["时效性","实时/事后、允许耗时、超时提醒、接收对象",""],["数据展示","可见列、筛选条件、导出字段",""],["风险上报与干预","通用预警策略",""],
 ["服务礼仪","引用资源；缺失结果按通用策略预警","etiquette"],["语言表达","指标中配置表达特征",""],["专业性","引用资源","sop,knowledge"],["隐私性","引用资源","privacy"],["禁用词","引用资源","banned"],["消极情感","引用资源","attitude"]
];
export const indicatorSpecificFields:Record<string,string>={"声纹识别":"异常类型：身份不匹配、未注册声纹、无法确认身份","情绪识别":"情绪类别：愤怒、焦虑、悲伤、平静（以已交付标签为准）","意图识别":"意图类别：从客户维护的意图定义中选择，如投诉、业务咨询、办理挂失","语言表达":"表达特征：静默、抢话、语速过快、语速过慢"};
export const warningRequirement=(name:string)=>["语音识别","文本纠错"].includes(name)?"不需要":["覆盖率","数据展示"].includes(name)?"不适用":name==="时效性"?"不适用；任务设置内超时提醒":name==="风险上报与干预"?"本身即预警策略":"可按需配置";
export const warningConfigurationFields=(name:string)=>["语音识别","文本纠错","覆盖率","时效性","数据展示"].includes(name)?"—":"检测角色、检测阶段及范围、触发方式、次数及统计窗口或持续时长、风险等级、处置动作、接收对象、重复提醒间隔";
export const warningFieldRows=indicatorRuleCategories.filter(([id])=>supportsWarning(id)).map(([id,name])=>[name,indicatorSpecificFields[name] ?? "无；直接使用指标命中结果",["6.2.5","6.3.6"].includes(id)?"单次命中／累计次数／持续时长":"单次命中／累计次数"]);
export const commonPolicyRows=[
 ["检测角色","坐席、客户、双方","须与关联指标支持的角色相容"],
 ["检测阶段","全程、开场、服务中、结束","按通话阶段限定检测范围"],
 ["阶段范围","开场/结束秒数；服务中起止偏移","选择相应阶段时填写"],
 ["触发方式","单次命中、累计次数、持续时长","须与关联特征能力相容；抢话不支持持续时长"],
 ["累计次数与统计窗口","次数；整通通话、最近 1/5 分钟、自定义时长","累计方式时填写，自定义时补充秒数"],
 ["持续时长","N 秒","持续方式时填写"],
 ["风险等级","高、中、低","标记本次预警等级"],["处置动作","通知、通话中提醒、进入人工复核","可多选；通话中提醒仅实时任务执行"],
 ["接收对象","所属主管、指定质检组、当前坐席","通知及复核发主管或质检组；通话中提醒发当前坐席"],["重复提醒间隔","每通话仅一次、1 分钟、5 分钟、自定义时长","按同一通话、同一策略控制重复提醒"]
];
