"use client";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import type { State } from "../lib/workflow";

export function NotificationCenter({events,readIds,open,onOpenChange,onRead,onNavigate}:{events:State["logs"];readIds:string[];open:boolean;onOpenChange:(open:boolean)=>void;onRead:(id:string)=>void;onNavigate:(target:string)=>void}) {
  const unread=events.filter(event=>!readIds.includes(event.id)).length;
  return <Popover open={open} onOpenChange={onOpenChange}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="notification-button" aria-label={`通知中心，${unread} 条未读`}><Bell size={18}/>{unread>0 && <span>{unread}</span>}</Button></PopoverTrigger>
    <PopoverContent align="end" className="notification-popover" aria-label="通知中心">
      <header><strong>通知中心</strong><span>{unread ? `${unread} 条未读` : "全部已读"}</span></header>
      <div className="notification-list">{events.length ? events.map(event=>{
        const isUnread=!readIds.includes(event.id);
        return <article key={event.id} data-unread={isUnread}>
          <Button variant="ghost" className="notification-event" onClick={()=>{onRead(event.id);onNavigate(event.target);onOpenChange(false);}}>
            <span><strong>{event.action}</strong><p>{event.note}</p><small title={event.target}>{event.target}</small></span>
          </Button>
          <div className="notification-meta"><time dateTime={event.at}>{new Date(event.at).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false})}</time>
            {isUnread && <Button variant="link" size="sm" onClick={()=>onRead(event.id)}>标记已读</Button>}
          </div>
        </article>;
      }) : <p className="notification-empty">暂无通知</p>}</div>
    </PopoverContent>
  </Popover>;
}
