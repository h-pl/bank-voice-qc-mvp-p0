import { detectionFields, visibleFields } from "../lib/strategy-schema";
import { groupFields } from "../lib/policy-parameter-groups";
export function PolicyParameters({config,compact=false}:{config:Record<string,string>;compact?:boolean}) {
 if(compact)return <dl className="policy-compact-fields">{visibleFields(detectionFields["6.3.4"],config).map(field=><div key={field.key}><dt>{field.label}</dt><dd>{config[field.key]?`${config[field.key]}${field.key==="level"?"风险":field.unit?` ${field.unit}`:""}`:"未配置"}</dd></div>)}</dl>;
 return <div className="policy-parameter-groups">{groupFields(visibleFields(detectionFields["6.3.4"],config)).map(group=><section key={group.title}><h3>{group.title}</h3><dl className="rule-detail-fields">{group.fields.map(field=><div key={field.key}><dt>{field.label}</dt><dd>{config[field.key]?`${config[field.key]}${field.key==="level"?"风险":field.unit?` ${field.unit}`:""}`:"未配置"}</dd></div>)}</dl></section>)}</div>;
}
