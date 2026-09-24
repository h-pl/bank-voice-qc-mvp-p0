import { commonPolicyRows } from "../lib/strategy-schema";
import { Modal } from "./ui";

export function PolicyFieldGuide({onClose}:{onClose:()=>void}) {
  return <Modal title="预警策略字段说明" description="策略参数由关联的指标规则共用" onClose={onClose}>
    <div className="policy-field-guide">
      <dl>{commonPolicyRows.map(([name,options,hint])=><div key={name}><dt>{name}</dt><dd><p>{options}</p><small>{hint}</small></dd></div>)}</dl>
      <section><h3>关联指标规则</h3><p>选择具体规则的检测结果建立关联；不适配当前检测角色、阶段或触发方式的结果会显示原因。持续时长适用于情绪识别和语言表达，抢话除外。</p><p>新增时可以暂不关联。已有规则移除最后一条策略关联前，需在规则中选择替代策略或明确选择不预警。</p></section>
    </div>
  </Modal>;
}
