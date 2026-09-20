"use client";
import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";
export function Button({
  children,
  onClick,
  icon,
  primary = false,
  disabled = false,
  type = "button",
  intent = "neutral",
  busy = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  primary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  intent?: "neutral" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      type={type}
      className={`btn ${primary ? "primary" : ""} ${intent === "danger" ? "danger" : ""}`}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <span className="button-spinner" aria-hidden="true" />}
      {icon && !busy && <Icon name={icon} size={15} />}
      <span>{children}</span>
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Empty({
  text = "没有符合条件的记录",
  hint = "试试调整搜索或筛选条件。",
  action,
}: {
  text?: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name="file" size={30} />
      <b>{text}</b>
      <p>{hint}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  variant = "default",
  description,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  variant?: "default" | "notification" | "navigation" | "evidence" | "resource" | "action";
  description?: string;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const dialog = ref.current!;
    const prior = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cancel = (event: Event) => { event.preventDefault(); close(); };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
      document.body.style.overflow = overflow;
      prior?.focus();
    };
  }, []);
  return <dialog ref={ref} className={`modal ${variant}-dialog`} aria-label={title}>
    <header><div><h2>{title}</h2>{description && <p className="modal-description">{description}</p>}</div><button type="button" className="icon-button" aria-label="关闭弹窗" onClick={onClose}><Icon name="close"/></button></header>
    {variant === "action" ? children : <><div className="modal-body">{children}</div>{variant !== "navigation" && <div className="modal-actions">{footer ?? <Button onClick={onClose}>关闭</Button>}</div>}</>}
  </dialog>;
}


/** Local filtering stays synchronous; an IME candidate is committed only at compositionend. */
export function SearchField({ value, onValueChange, label, placeholder, name }: {
  value: string; onValueChange: (value: string) => void | boolean;
  label: string; placeholder: string; name: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  useEffect(() => { if (input.current && !composing.current) input.current.value = value; }, [value]);
  const commit = (next: string) => {
    if (onValueChange(next) === false && input.current) input.current.value = value;
  };
  return <div className="search-box">
    <Icon name="search" size={17}/>
    <input ref={input} type="search" name={name} aria-label={label} autoComplete="off" placeholder={placeholder} defaultValue={value}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={e => { composing.current = false; commit(e.currentTarget.value); }}
      onChange={e => { if (!composing.current) commit(e.currentTarget.value); }}
      onKeyDown={e => { if (e.key === "Escape" && !e.nativeEvent.isComposing && !composing.current) { e.preventDefault(); commit(""); } }}/>
    <button className="search-clear" type="button" aria-label={`清除${label}`} title={`清除${label}`} disabled={!value} style={{visibility:value ? "visible" : "hidden"}} onClick={() => { composing.current = false; commit(""); input.current?.focus(); }}><Icon name="close" size={15}/></button>
  </div>;
}

export function Tabs<T extends string>({ value, options, onChange, label, panelId, className = "tabs" }: {
  value: T; options: ReadonlyArray<{value:T; label:ReactNode; count?:number}>;
  onChange:(value:T) => void; label:string; panelId:string; className?:string;
}) {
  return <div className={`ui-tabs ${className}`} role="tablist" aria-label={label}>
    {options.map((option, index) => <button type="button" role="tab" key={option.value}
      id={`${panelId}-tab-${option.value}`} aria-controls={panelId} aria-selected={value === option.value}
      tabIndex={value === option.value ? 0 : -1} className={value === option.value ? "active" : ""}
      onClick={() => onChange(option.value)} onKeyDown={e => {
        if (e.nativeEvent.isComposing || !["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return;
        e.preventDefault();
        const next = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
        onChange(options[next].value);
        (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
      }}>{option.label}{option.count !== undefined && <span>{option.count}</span>}</button>)}
  </div>;
}

export function InlineFormSurface({title, children, onClose}: {title:string;children:ReactNode;onClose:()=>void}) {
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();},[]);
  return <section className="inline-editor panel" aria-label={title}><header><div><p>业务资源 / 内容维护</p><h2 ref={heading} tabIndex={-1}>{title}</h2></div><Button onClick={onClose}>返回资源</Button></header>{children}</section>;
}
