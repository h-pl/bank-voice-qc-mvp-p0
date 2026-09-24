import { BindingRead } from "./binding-read";
import { actions } from "../lib/workflow";
import { Button } from "./ui";
import { indicatorName, supportsWarning } from "../lib/strategy-schema";
import { ruleBasis } from "../lib/rule-catalog";
import type { Rule, RuleVersion, State } from "../lib/workflow";

export function IndicatorDetail({ rule, snapshot, state, historical, canConfigure, onConfigure, onOpenResource, onEditResource }: {
  rule: Rule; snapshot: RuleVersion; state: State; historical: boolean; canConfigure: boolean;
  onConfigure: () => void; onOpenResource: (id: string) => void; onEditResource: (id: string) => void;
}) {
  const definition=snapshot.definition,resources=ruleBasis(snapshot,state),warning=supportsWarning(rule.indicator);
  const peers=state.rules.filter(r=>r.indicator===rule.indicator && r.id!==rule.id);
  return <>
    <section className="policy-section indicator-checks">
      <div className="policy-section-title"><h3>检查定义</h3></div>
      <dl className="rule-detail-fields">
        <div><dt>关联指标</dt><dd>{indicatorName(rule.indicator)}</dd></div>
        <div><dt>适用业务</dt><dd>{snapshot.scope}</dd></div>
        <div className="rule-detail-wide"><dt>检查目标</dt><dd>{definition?.objective ?? (historical ? "暂无记录" : rule.description)}</dd></div>
        <div className="rule-detail-wide"><dt>检查项目</dt><dd>{definition?.checks.length ? <ul className="rule-detail-checks">{definition.checks.map(check=><li key={check}>{check}</li>)}</ul> : <span className="subtle">暂无记录独立的检查项目</span>}</dd></div>
        <div className="rule-detail-wide"><dt>判断边界</dt><dd>{definition?.boundary || "暂无记录"}</dd></div>
        <div className="rule-detail-wide"><dt>输出证据</dt><dd>{definition?.output || "暂无记录"}</dd></div>
      </dl>
      {!definition && historical && <p className="rule-peer-note">原版本说明：{snapshot.trigger}</p>}
      {peers.length>0 && <p className="rule-peer-note">同属{indicatorName(rule.indicator)}的其他规则：{peers.map(r=>r.name).join("、")}。各自按检查范围独立判断。</p>}
    </section>
    <section className="policy-section indicator-resource-fields">
      <div className="policy-section-title"><h3>业务依据</h3>
        <div className="rule-section-actions">{resources.filter(ref=>ref.resource).map(ref=><div className="rule-basis-actions" data-resource-actions={ref.id} key={ref.id} role="group" aria-label={`${ref.resource!.name}操作`}>
          {resources.length>1 && <span className="subtle">{ref.resource!.name}</span>}
          <Button onClick={()=>onOpenResource(ref.id)}>查看内容</Button>{!historical && actions(state,ref.id).includes("save_resource") && <Button onClick={()=>onEditResource(ref.id)}>编辑内容</Button>}
        </div>)}</div>
      </div>
      {resources.length ? resources.map(ref=><div className="rule-basis" data-resource-id={ref.id} key={ref.id}>
        <div className="rule-basis-heading"><dl className="rule-detail-fields">
          <div><dt>引用资源</dt><dd><strong>{ref.resource?.name ?? ref.id}</strong></dd></div>
        </dl>
        </div>
        {!ref.available && <p className="form-error">引用的资源不可用，请核对业务依据。</p>}
        {ref.missing.length>0 && <p className="form-error">引用条目未找到：{ref.missing.join("、")}。请核对资源内容。</p>}
        {ref.entries && ref.rows.length>0 && <div className="rule-basis-entries">{ref.rows.map((row,index)=><div key={index}><strong>{ref.resource?.kind==="sop" ? `步骤 ${row[1]}${row[3]==="是"?" · 必需":" · 可选"}` : row[0]}</strong><p>{ref.resource?.kind==="sop"?row[2]:row[1]}</p></div>)}</div>}
      </div>) : <dl className="rule-detail-fields"><div className="rule-detail-wide"><dt>引用资源</dt><dd>无需引用业务资源</dd></div><div className="rule-detail-wide"><dt>判断依据</dt><dd>检测服务输出的表达特征</dd></div></dl>}
    </section>
    <section className="policy-section indicator-warning-fields">
      <div className="policy-section-title"><h3>预警配置</h3>{warning && <div className="rule-section-actions">{!canConfigure && <span className="subtle">仅质检主管可配置</span>}<Button primary disabled={!canConfigure} onClick={onConfigure}>配置预警</Button></div>}</div>
      {warning ? <>
        <p className="rule-warning-intro">检出以下结果后，按关联策略判断是否预警。</p>
        <BindingRead rule={rule} snapshot={snapshot} state={state}/>
        <div className="rule-warning-footer"><p className="subtle">触发条件与处置在策略中统一维护。</p></div>
      </> : <dl className="rule-detail-fields"><div className="rule-detail-wide"><dt>预警状态</dt><dd>不适用，该指标仅输出检测结果</dd></div></dl>}
    </section>
  </>;
}
