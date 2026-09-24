"use client";
import { useEffect, useRef, useState } from "react";
import { policyBindingSelection } from "../lib/indicator-bindings";
import { supportsWarning } from "../lib/strategy-schema";
import type { Command, Rule, State } from "../lib/workflow";
import { Button, Modal } from "./ui";
import { PolicyAssociationFields } from "./policy-association-fields";

export function PolicyAssociationEditor({policy,state,onSubmit,onDone}:{policy:Rule;state:State;onSubmit:(command:Command)=>void;onDone:()=>void}){
  const [initial]=useState(()=>({rev:policy.rev,rules:state.rules.filter(r=>!r.retired && supportsWarning(r.indicator)).map(rule=>({rule,rev:rule.rev,selected:policyBindingSelection(rule,policy.id)}))}));
  const [selected,setSelected]=useState<Record<string,string[]>>(()=>Object.fromEntries(initial.rules.map(({rule,selected})=>[rule.id,selected])));
  const [error,setError]=useState("");
  const [discard,setDiscard]=useState(false);
  const [busy,setBusy]=useState(false);
  const completing=useRef(false);
  const formRef=useRef<HTMLFormElement>(null);
  useEffect(()=>{const frame=requestAnimationFrame(()=>formRef.current?.querySelector<HTMLElement>('button[role="combobox"]')?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame);},[]);
  const errorRef=useRef<HTMLParagraphElement>(null);
  const changes=initial.rules.filter(row=>JSON.stringify([...row.selected].sort())!==JSON.stringify([...(selected[row.rule.id] ?? [])].sort()));
  const dirty=changes.length>0;
  const config=policy.versions.at(-1)?.config ?? {};
  useEffect(()=>{if(!dirty)return;const block=(event:Event)=>{if(completing.current)return;event.preventDefault();setError("关联尚未保存，请先保存或取消修改。");};window.addEventListener("qc:before-navigate",block);window.addEventListener("beforeunload",block);return()=>{window.removeEventListener("qc:before-navigate",block);window.removeEventListener("beforeunload",block);};},[dirty]);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  const finishClose=()=>{completing.current=true;onDone();};
  const close=()=>{if(!busy){if(dirty)setDiscard(true);else finishClose();}};
  return <Modal variant="action" title="管理关联" description={policy.name} onClose={close}>
    <form ref={formRef} className="action-form policy-association-form" noValidate onSubmit={event=>{
      event.preventDefault();if(busy || discard)return;
      try{
        if(!changes.length)throw new Error("关联未变更，请先勾选或取消检测结果。");
        setBusy(true);completing.current=true;
        onSubmit({id:policy.id,rev:initial.rev,action:"save_policy_associations",requestId:crypto.randomUUID(),input:{policyBindings:changes.map(({rule,rev})=>({ruleId:rule.id,rev,features:selected[rule.id]}))}});
        onDone();
      }catch(e){completing.current=false;setBusy(false);setError(e instanceof Error?e.message:"保存失败，请重试。");}
    }}>
      <div className="action-form-body">
        <p className="editor-intro">勾选检测结果使用本策略，保留规则已有的其他策略关联。</p>
        <PolicyAssociationFields state={state} config={config} selected={selected} onChange={next=>{setSelected(next);setError("");}}/>
      </div>
      <div className="modal-actions association-form-footer">
        <p className="policy-save-impact">仅更新本策略的关联，保存后用于后续检测。</p>
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="form-error">{error}</p>}
        {discard && <p role="alert">关联尚未保存，是否放弃修改？</p>}
        <div>{discard?<><Button onClick={()=>setDiscard(false)}>继续编辑</Button><Button intent="danger" onClick={finishClose}>放弃修改</Button></>:<><Button disabled={busy} onClick={finishClose}>取消</Button><Button primary type="submit" disabled={busy || !dirty}>保存关联</Button></>}</div>
      </div>
    </form>
  </Modal>;
}
