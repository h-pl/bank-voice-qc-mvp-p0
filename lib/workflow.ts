export type Role = 'supervisor' | 'inspector' | 'agent';
export type View = 'calls' | 'alerts' | 'workorders' | 'rules';
export type Status = 'candidate' | 'reminded' | 'dismissed' | 'reviewing' | 'decision' | 'notified' | 'appealed' | 'closed';
export type Conclusion = 'risk' | 'false_positive' | 'insufficient';
export type Action = 'remind' | 'end_call' | 'dismiss' | 'assign' | 'submit' | 'return' | 'publish' | 'acknowledge' | 'appeal' | 'maintain';
export type Event = { id: string; at: string; actor: string; action: string; note: string; from: Status; to: Status };
export type Segment = { at: number; speaker: 'agent' | 'customer'; text: string; hit?: boolean };
export type Case = { id: string; callId: string; title: string; agent: string; agentId: string; customer: string; business: string; date: string; duration: number; live: boolean; severity: 'high' | 'medium'; ruleId: string; indicatorId: string; source: string; status: Status; taskId?: string; dueAt?: string; conclusion?: Conclusion; reviewNote?: string; events: Event[]; transcript: Segment[] };
export const roleNames: Record<Role, string> = { supervisor: '质检主管', inspector: '质检员', agent: '客服坐席' };
export const rolePeople: Record<Role, string> = { supervisor: '何晴', inspector: '赵宁', agent: '周敏' };
export const statusNames: Record<Status,string> = { candidate:'待分诊',reminded:'已提醒 · 待通话结束',dismissed:'预警已关闭',reviewing:'待人工复核',decision:'待主管确认',notified:'待坐席知悉',appealed:'异议待处理',closed:'工单已关闭' };
export const conclusionNames: Record<Conclusion,string> = {risk:'风险成立',false_positive:'误报',insufficient:'证据不足'};
export const actionNames: Record<Action,string> = {remind:'提醒坐席',end_call:'模拟通话结束',dismiss:'关闭预警',assign:'转人工复核',submit:'提交复核意见',return:'退回复核',publish:'确认并通知坐席',acknowledge:'确认知悉',appeal:'提出异议',maintain:'维持结论并回复'};
export const nav: Record<Role,View[]> = {supervisor:['calls','alerts','workorders','rules'],inspector:['calls','workorders','rules'],agent:['calls','workorders']};
export function visible(item:Case,role:Role) { return role !== 'agent' || item.agentId === 'A1048'; }
export function owner(item:Case):Role|null { return ['candidate','reminded','decision','appealed'].includes(item.status)?'supervisor':item.status==='reviewing'?'inspector':item.status==='notified'?'agent':null; }
export function allowedActions(item:Case,role:Role):Action[] {
 if(!visible(item,role))return [];
 if(role==='supervisor') {
  if(['candidate','reminded'].includes(item.status))return [...(item.live&&item.status==='candidate'?['remind' as Action]:[]),'assign','dismiss',...(item.live?['end_call' as Action]:[])];
  if(item.status==='decision')return item.conclusion==='insufficient'?['return']:['publish','return'];
  if(item.status==='appealed')return ['return','maintain'];
 }
 if(role==='inspector'&&item.status==='reviewing')return ['submit'];
 if(role==='agent'&&item.status==='notified')return ['acknowledge','appeal'];
 return [];
}
export type Input = { note: string; conclusion?: Conclusion; dueAt?: string; closeReason?: 'false_positive'|'insufficient' };
export function transition(item:Case,role:Role,action:Action,input:Input,now=new Date()):Case {
 if(!allowedActions(item,role).includes(action))throw new Error('状态或角色已变化，请重新选择操作。');
 if(action!=='end_call'&&input.note.trim().length<4)throw new Error('请填写至少 4 个字的处理说明。');
 if(action==='assign'&&(!input.dueAt||!Number.isFinite(Date.parse(input.dueAt))||Date.parse(input.dueAt)<=now.getTime()))throw new Error('请选择晚于当前时间的复核期限。');
 if(action==='submit'&&!['risk','false_positive','insufficient'].includes(input.conclusion??''))throw new Error('请选择复核结论。');
 if(action==='dismiss'&&!input.closeReason)throw new Error('请选择关闭原因。');
 const next:Case={...item,events:[...item.events]};
 const task=()=>{next.taskId??=`WO-${item.id}`;next.status='reviewing';};
 if(action==='remind')next.status='reminded';
 if(action==='end_call'){next.live=false;if(item.status==='reminded'){task();next.dueAt=new Date(now.getTime()+86400000).toISOString();}}
 if(action==='dismiss'){next.status='dismissed';next.conclusion=input.closeReason;}
 if(action==='assign'){task();next.dueAt=input.dueAt;}
 if(action==='submit'){next.status='decision';next.conclusion=input.conclusion;next.reviewNote=input.note.trim();}
 if(action==='return'){next.status='reviewing';next.dueAt=new Date(now.getTime()+86400000).toISOString();}
 if(action==='publish'||action==='maintain')next.status='notified';
 if(action==='acknowledge')next.status='closed';
 if(action==='appeal')next.status='appealed';
 next.events.push({id:`${item.id}-${item.events.length+1}-${now.getTime()}`,at:now.toISOString(),actor:`${roleNames[role]} · ${rolePeople[role]}`,action:actionNames[action],note:input.note.trim()||'通话结束，原音与转写封存；已提醒风险按默认复核人赵宁自动派发。',from:item.status,to:next.status});
 return next;
}
export function isWorkOrder(item:Case){return !!item.taskId;}
export function toCsv(items:Case[]){const quote=(s:unknown)=>'"'+String(s??'').replace(/"/g,'""')+'"';return '\ufeff'+[['通话编号','业务','坐席','风险','状态','最终/复核结论'],...items.map(x=>[x.callId,x.business,x.agent,x.title,statusNames[x.status],x.conclusion?conclusionNames[x.conclusion]:'待判断'])].map(row=>row.map(quote).join(',')).join('\r\n');}
