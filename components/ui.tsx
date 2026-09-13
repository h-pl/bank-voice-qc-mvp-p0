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
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  primary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`btn ${primary ? "primary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={15} />}
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
}: {
  text?: string;
  hint?: string;
}) {
  return (
    <div className="empty">
      <Icon name="file" size={30} />
      <b>{text}</b>
      <p>{hint}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
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
  return <dialog ref={ref} className="modal" aria-label={title}>
    <header><h2>{title}</h2><button type="button" className="icon-button" aria-label="关闭弹窗" onClick={onClose}><Icon name="close"/></button></header>
    {children}
  </dialog>;
}
