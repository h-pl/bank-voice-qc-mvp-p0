"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "./ui";
import type { Command, Rule } from "../lib/workflow";

export const parameterNames = { threshold: "静默阈值", scope: "适用业务", trigger: "提醒触发" };
export const parameterHints = {
  threshold: "连续静默达到此时长时生成候选片段。业务等待是否合理，仍需人工结合上下文判断。",
  scope: "选择需要检查诉求匹配的业务范围。其他业务不使用这条规则。",
  trigger: "决定哪些候选进入提醒范围；关闭提醒不会关闭检测，也不改变人工复核结论。",
};
export function allowNavigation() {
  return window.dispatchEvent(new Event("qc:before-navigate", { cancelable: true }));
}
export function RuleEditor({ rule, onSubmit, onDone }: { rule: Rule; onSubmit: (command: Command) => void; onDone: () => void }) {
  const field = rule.editable!;
  const [initial] = useState(() => rule.draft ?? rule.versions.at(-1)!);
  const [rev] = useState(rule.rev);
  const [value, setValue] = useState(() => String(initial[field]));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { formRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>("input,select")?.focus({preventScroll:true}); }, []);
  const changed = value !== String(initial[field]);
  const dirty = changed || note.length > 0;
  useEffect(() => {
    if (!dirty) return;
    const stop = (event: Event) => {
      event.preventDefault();
      setWarning("参数尚未保存。请先保存草稿，或点击取消修改后再切换。");
      formRef.current?.scrollIntoView({ block: "center" });
    };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("qc:before-navigate", stop);
    window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("qc:before-navigate", stop); window.removeEventListener("beforeunload", unload); };
  }, [dirty]);
  function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!changed) { setError("参数与当前草稿一致。修改参数后保存，或取消修改。"); return; }
    if (field === "threshold" && (!/^\d+$/.test(value) || Number(value) < 3 || Number(value) > 60)) {
      setError("请输入 3–60 之间的整数秒数。"); formRef.current?.querySelector<HTMLInputElement>("input")?.focus(); return;
    }
    if (note.trim().length < 4) { setError("请填写至少 4 个字的修改原因。"); formRef.current?.querySelector("textarea")?.focus(); return; }
    setBusy(true);
    try {
      onSubmit({ id: rule.id, action: "save_rule", rev, requestId: crypto.randomUUID(), input: { ...initial, [field]: field === "threshold" ? Number(value) : value, note: note.trim() } });
      onDone();
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败，请重试。"); setBusy(false); }
  }
  return <form className="parameter-editor" ref={formRef} onSubmit={save} noValidate aria-label="编辑规则参数">
    <div className="parameter-field">
      <label htmlFor={`parameter-${rule.id}`}>{parameterNames[field]}</label>
      <p id="parameter-help">{parameterHints[field]}</p>
      {field === "threshold" ? <div className="number-unit"><input id={`parameter-${rule.id}`} name="threshold" type="number" inputMode="numeric" min={3} max={60} step={1} value={value} aria-describedby={`parameter-help parameter-range${error ? " parameter-error" : ""}`} aria-invalid={!!error} onChange={e => { setValue(e.target.value); setError(""); }} /><span>秒</span></div> : <select id={`parameter-${rule.id}`} name={field} value={value} aria-describedby={`parameter-help${error ? " parameter-error" : ""}`} onChange={e => { setValue(e.target.value); setError(""); }}>{(field === "scope" ? ["全部业务", "账户查询", "信用卡", "转账汇款"] : ["高风险候选", "所有候选", "关闭提醒"]).map(value => <option key={value}>{value}</option>)}</select>}
      <small id="parameter-range">当前生效：{String(rule.versions.at(-1)![field])}{field === "threshold" ? " 秒；允许范围 3–60 秒，默认 15 秒。" : "。"}</small>
    </div>
    <label className="editor-reason" htmlFor="parameter-reason">修改原因<textarea className="resize-none" id="parameter-reason" name="reason" aria-describedby={error ? "parameter-error" : undefined} autoComplete="off" rows={2} value={note} aria-invalid={!!error && note.trim().length < 4} placeholder="例如：结合业务等待时长调整静默阈值…" onChange={e => { setNote(e.target.value); setError(""); }} /></label>
    {error ? <p className="form-error" id="parameter-error" role="alert">{error}</p> : null}
    {warning ? <p className="edit-warning" role="status">{warning}</p> : null}
    <div className="editor-footer"><p>保存为草稿，检查并发布后才生效。</p><Button onClick={onDone}>取消修改</Button><Button primary type="submit" disabled={busy}>{busy ? "保存中…" : "保存草稿"}</Button></div>
  </form>;
}
