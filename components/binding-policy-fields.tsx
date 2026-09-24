"use client";
import { useRef, useState } from "react";
import { conditionSummary, type IndicatorBinding } from "../lib/indicator-bindings";
import { PolicyParameters } from "./policy-parameters";
import { Modal } from "./ui";
import { Button } from "./ui/button";
export function BindingPolicyFields({binding,conditions,config,policyName="预警策略",detailed=false}:{binding:IndicatorBinding;conditions:Record<string,string>;config:Record<string,string>;policyName?:string;detailed?:boolean}) {
 const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 const close=()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));};
 const summary=[["触发条件",conditionSummary({...binding,conditions:{...conditions,role:"",stage:"",speed:""}})],["风险等级",config.level?`${config.level}风险`:"未配置"],["处置方式",[config.action,config.recipient].filter(Boolean).join(" · ") || "未配置"]];
 const fields=(items:string[][])=><dl className="binding-policy-fields">{items.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
 if(detailed)return <PolicyParameters config={{...config,...conditions}}/>;
 return <div className="binding-policy-preview"><div className="binding-policy-heading"><strong>{policyName}</strong><Button ref={trigger} variant="outline" type="button" className="policy-details-button" onClick={()=>setOpen(true)}>查看策略</Button></div>{fields(summary)}{open && <Modal title="查看预警策略" description={`${policyName} · 检测结果：${binding.feature}`} onClose={close}><PolicyParameters config={{...config,...conditions}}/></Modal>}</div>;
}
