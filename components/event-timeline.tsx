export type TimelineEvent={id:string;at:string;title:string;actor:string;note:string;kind?:"system"|"human"|"change";demo?:boolean};
const formatTime=(at:string)=>new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(at)).replaceAll("/","-");
export function EventTimeline({events}:{events:TimelineEvent[]}) {
  const sorted=events.filter(event=>event.title!=="示例场景已载入").sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  return <section className="event-timeline" aria-label="处理记录">{sorted.length ? <ol aria-label="处理记录时间线">{sorted.map(event=><li key={event.id} data-kind={event.kind ?? "human"}><span className="event-node" aria-hidden="true"/><div><div className="event-meta"><time dateTime={event.at}>{formatTime(event.at)}</time></div><h3>{event.title}</h3><span className="event-actor">{event.actor}</span><p>{event.note}</p></div></li>)}</ol> : <div className="event-empty">暂无处理记录<p>完成操作后，处理人、时间与意见会显示在这里。</p></div>}</section>;
}
