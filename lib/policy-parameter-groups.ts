import type { ConfigField } from "./strategy-schema";
export const configurationGroups = [
 { title: "指标特有参数", hint: "匹配任一所选特征；不同风险等级分别建立策略。", accepts: (key: string) => key.startsWith("feature:") },
 { title: "检测范围", hint: "统一约定检测的角色和通话阶段。", accepts: (key: string) => ["role", "stage", "stageSeconds", "middleStartSeconds", "middleEndSeconds"].includes(key) },
 { title: "触发条件", hint: "按指标分别统计，任一满足即触发。", accepts: (key: string) => ["mode", "count", "window", "windowSeconds", "duration"].includes(key) },
 { title: "风险与处置", hint: "同一策略共用等级与处置；通话中提醒固定发给当前坐席。", accepts: (key: string) => ["level", "action", "recipient", "repeat", "repeatSeconds"].includes(key) },
];
export const groupFields = (fields: ConfigField[]) => configurationGroups.map(group => ({...group, fields: fields.filter(field => group.accepts(field.key))})).filter(group => group.fields.length);
