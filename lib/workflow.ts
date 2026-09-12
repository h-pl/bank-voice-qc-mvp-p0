export type Role = "supervisor" | "inspector" | "agent";
export type View =
  | "alerts"
  | "workorders"
  | "improvement"
  | "calls"
  | "rules"
  | "resources"
  | "reports";
export const roleNames: Record<Role, string> = {
  supervisor: "质检主管",
  inspector: "质检员",
  agent: "客服坐席",
};
export const people = [
  { id: "S01", name: "何晴", role: "supervisor" },
  { id: "Q01", name: "赵宁", role: "inspector" },
  { id: "Q02", name: "林悦", role: "inspector" },
  { id: "A1048", name: "周敏", role: "agent" },
  { id: "A1186", name: "陈佳", role: "agent" },
] as const;
export const person = (id: string) => people.find((p) => p.id === id)!;
export const nav: Record<Role, View[]> = {
  supervisor: [
    "alerts",
    "workorders",
    "improvement",
    "calls",
    "rules",
    "resources",
    "reports",
  ],
  inspector: ["workorders", "improvement", "calls", "rules", "resources"],
  agent: ["improvement", "workorders", "calls"],
};
export type Verdict = "risk" | "false_positive" | "insufficient";
export const verdictNames: Record<Verdict, string> = {
  risk: "风险成立",
  false_positive: "误报 / 不成立",
  insufficient: "证据不足",
};
export type Base = { id: string; rev: number };
export type Segment = {
  at: number;
  speaker: "agent" | "customer";
  text: string;
};
export type Batch = {
  id: string;
  startedAt: string;
  endedAt?: string;
  ruleVersions: Record<string, number>;
  checks: {
    name: string;
    state: "pending" | "running" | "success" | "failed";
  }[];
};
export type Call = Base & {
  agentId: string;
  business: string;
  group: string;
  customer: string;
  startedAt: string;
  endedAt?: string;
  duration: number;
  transcript: Segment[];
  corrections?: { segment: number; text: string; reason: string }[];
  audio?: string;
  authorized: string[];
  batches: Batch[];
  sample?: boolean;
};
export type Conclusion = {
  version: number;
  value: Verdict;
  note: string;
  at: string;
  by: string;
  reviewer?: string;
  noRemedy?: string;
};
export type Finding = Base & {
  callId: string;
  title: string;
  indicator: string;
  related: string[];
  ruleId: string;
  ruleVersion: number;
  batchId: string;
  source: "auto" | "manual";
  severity: "high" | "medium";
  evidence: number[];
  status:
    | "candidate"
    | "reminded"
    | "supplement"
    | "review"
    | "closed"
    | "delivered";
  conclusions: Conclusion[];
  assignment?: { owner: string; dueAt: string };
  reminder?: {
    text: string;
    sentAt: string;
    readAt?: string;
    feedback?: string;
    dissent?: string;
  };
  seenVersion?: number;
};
export type Opinion = { value: Verdict; note: string; evidence: number[] };
export type Review = Base & {
  callId: string;
  findingIds: string[];
  type: "candidate" | "spotcheck" | "appeal";
  scope: string;
  owner: string;
  dueAt: string;
  originalDueAt: string;
  status: "pending" | "working" | "supervisor" | "done" | "cancelled";
  opinions: Record<string, Opinion>;
  summary?: string;
  scopeResult?: "clear" | "insufficient";
  appealId?: string;
  finishedAt?: string;
  firstOverdueAt?: string;
  history: {
    at: string;
    opinions: Record<string, Opinion>;
    summary?: string;
  }[];
};
export type Appeal = Base & {
  findingId: string;
  conclusionVersion: number;
  agentId: string;
  status:
    | "submitted"
    | "supplement"
    | "accepted"
    | "reviewing"
    | "decision"
    | "done"
    | "withdrawn"
    | "rejected";
  note: string;
  evidence: number[];
  dueAt: string;
  originalDueAt: string;
  reviewId?: string;
  supplementOrigin?: string;
  sameReviewerReason?: string;
  outcome?: "maintain" | "false_positive" | "insufficient" | "adjust";
  decidedAt?: string;
  firstOverdueAt?: string;
};
export type Pause = {
  reasons: string[];
  startedAt: string;
  phase: string;
  owner: string;
  dueAt: string;
  wasOverdue: boolean;
};
export type Remedy = Base & {
  findingId: string;
  conclusionVersion: number;
  agentId: string;
  inspector: string;
  status:
    | "pending"
    | "executing"
    | "verification"
    | "supervisor"
    | "done"
    | "terminated";
  supervisorReason?: "approve" | "return" | "adjust";
  goal: string;
  standard: string;
  standardVersion: number;
  sampleCount: number;
  observation: string;
  dueAt: string;
  originalDueAt: string;
  createdAt: string;
  round: number;
  materials: {
    at: string;
    text: string;
    samples: string[];
    attachment?: string;
  }[];
  acceptance?: {
    result: "pass" | "fail" | "insufficient";
    note: string;
    version: number;
    round: number;
    at: string;
  };
  acceptanceHistory: NonNullable<Remedy["acceptance"]>[];
  pause?: Pause;
  pauseHistory: {
    start: string;
    end: string;
    duration: number;
    reasons: string[];
  }[];
  firstOverdueAt?: string;
  finishedAt?: string;
  terminationReason?: string;
  sourceChanged?: boolean;
  standards: {
    version: number;
    standard: string;
    goal: string;
    note: string;
    at: string;
  }[];
  draft?: string;
};
export type Supplement = Base & {
  target: string;
  executor: string;
  dueAt: string;
  note: string;
  status: "pending" | "submitted" | "done";
  reply?: string;
  origin: string;
  trigger: string;
};
export type ResourceVersion = {
  version: number;
  content: string;
  scope: string;
  role: string;
  exception: string;
  at: string;
};
export type Resource = Base & {
  name: string;
  type: "词库" | "业务知识" | "SOP";
  versions: ResourceVersion[];
  draft?: Omit<ResourceVersion, "version" | "at">;
  checked?: boolean;
  draftRuleIds?: string[];
};
export type RuleVersion = {
  version: number;
  at: string;
  threshold: number;
  scope: string;
  trigger: string;
  resources: Record<string, number>;
};
export type Rule = Base & {
  name: string;
  indicator: string;
  description: string;
  severity: "high" | "medium";
  editable?: "threshold" | "scope" | "trigger";
  versions: RuleVersion[];
  draft?: RuleVersion;
  checked?: boolean;
};
export type Log = {
  id: string;
  target: string;
  callId?: string;
  at: string;
  actor: string;
  action: string;
  note: string;
};
export type State = {
  schema: 2;
  revision: number;
  readEvents?: Record<string, string[]>;
  identity: string;
  view: View;
  calls: Call[];
  findings: Finding[];
  reviews: Review[];
  appeals: Appeal[];
  remedies: Remedy[];
  supplements: Supplement[];
  rules: Rule[];
  resources: Resource[];
  logs: Log[];
  requests: string[];
};
export type Entity =
  | Call
  | Finding
  | Review
  | Appeal
  | Remedy
  | Supplement
  | Rule
  | Resource;
export const latest = (f: Finding) => f.conclusions.at(-1);
export const terminalAppeal = (a: Appeal) =>
  ["done", "withdrawn", "rejected"].includes(a.status);
export const terminalRemedy = (r: Remedy) =>
  ["done", "terminated"].includes(r.status);
export const roleOf = (s: State) => person(s.identity).role;
export const entity = (s: State, id: string): Entity | undefined =>
  [
    ...s.calls,
    ...s.findings,
    ...s.reviews,
    ...s.appeals,
    ...s.remedies,
    ...s.supplements,
    ...s.rules,
    ...s.resources,
  ].find((x) => x.id === id);
export function callFor(s: State, id: string): Call | undefined {
  const e = entity(s, id);
  if (!e) return;
  if ("batches" in e) return e;
  if ("callId" in e) return s.calls.find((c) => c.id === e.callId);
  if ("findingId" in e) return callFor(s, e.findingId);
  if ("target" in e) return callFor(s, e.target);
}
export function canSeeCall(s: State, c: Call) {
  const role = roleOf(s);
  return (
    role === "supervisor" ||
    (role === "agent"
      ? c.agentId === s.identity
      : c.authorized.includes(s.identity) ||
        s.reviews.some((r) => r.callId === c.id && r.owner === s.identity) ||
        s.remedies.some(
          (r) => callFor(s, r.id)?.id === c.id && r.inspector === s.identity,
        ) ||
        s.supplements.some(
          (x) => x.executor === s.identity && callFor(s, x.target)?.id === c.id,
        ))
  );
}
export function canSee(s: State, id: string): boolean {
  const e = entity(s, id);
  if (!e) return false;
  const role = roleOf(s);
  if (role === "supervisor") return true;
  if ("versions" in e) return role === "inspector";
  const c = callFor(s, id);
  if (!c || !canSeeCall(s, c)) return false;
  if ("type" in e && "findingIds" in e)
    return role === "inspector"
      ? e.owner === s.identity
      : e.status === "done" && e.type !== "appeal";
  if ("findingId" in e && "agentId" in e)
    return role === "agent"
      ? e.agentId === s.identity
      : "inspector" in e
        ? e.inspector === s.identity
        : !!e.reviewId &&
          s.reviews.some((r) => r.id === e.reviewId && r.owner === s.identity);
  if ("target" in e) return e.executor === s.identity || canSee(s, e.target);
  if ("conclusions" in e && role === "agent")
    return !!latest(e) || !!e.reminder;
  return true;
}
export function detection(c: Call) {
  const checks = c.batches.at(-1)?.checks ?? [];
  if (!checks.length || checks.every((x) => x.state === "pending"))
    return "待处理";
  if (checks.some((x) => x.state === "running" || x.state === "pending"))
    return "处理中";
  const failed = checks.filter((x) => x.state === "failed").length;
  return failed === checks.length ? "失败" : failed ? "部分失败" : "已完成";
}
export const statusNames: Record<string, string> = {
  candidate: "待分诊",
  reminded: "已提醒 · 待衔接",
  supplement: "待补材料",
  review: "人工复核中",
  closed: "候选已关闭",
  delivered: "结论已送达",
  pending: "待处理",
  working: "复核中",
  supervisor: "待主管处理",
  done: "已办结",
  cancelled: "已取消",
  submitted: "待受理",
  accepted: "已受理",
  reviewing: "核查中",
  decision: "待裁定",
  withdrawn: "已撤回",
  rejected: "不受理",
  executing: "整改中",
  verification: "待验收",
  terminated: "已终止",
};
export const actionNames: Record<string, string> = {
  create_resource: "新增资源条目",
  resource_feedback: "提出依据补充意见",
  reassign: "转派任务",
  sample_calls: "生成整改后样例",
  remind: "提醒坐席",
  end_call: "模拟通话结束",
  dismiss: "关闭候选",
  assign: "转人工复核",
  supplement: "要求补充材料",
  reply: "提交补充材料",
  receive_supplement: "接收补件并继续",
  extend: "调整期限",
  save_review: "保存复核草稿",
  submit_review: "提交复核意见",
  return_review: "退回复核",
  publish: "确认结论",
  spotcheck: "新建人工抽查",
  add_finding: "登记人工发现",
  ack: "确认知悉",
  feedback_result: "补充结果意见",
  appeal: "提交申诉",
  withdraw: "撤回申诉",
  accept_appeal: "受理申诉",
  reject_appeal: "不予受理",
  assign_appeal: "分派申诉核查",
  decide: "提交申诉裁定",
  accept_remedy: "接收整改",
  adjust_request: "申请调整要求",
  material: "提交整改材料",
  save_acceptance: "保存验收草稿",
  verify: "提交验收意见",
  close_remedy: "确认整改结案",
  return_remedy: "退回整改 / 重新核验",
  change_standard: "调整目标与标准",
  read_reminder: "标记提醒已读",
  feedback_reminder: "反馈提醒执行",
  dissent_reminder: "提出提醒异议",
  start_detection: "新建示例检测批次",
  finish_detection: "完成示例检测",
  save_rule: "保存参数草稿",
  check_rule: "查看预设检查",
  publish_rule: "确认模拟生效",
  discard_rule: "放弃参数草稿",
  save_resource: "保存资源草稿",
  check_resource: "查看资源预设检查",
  publish_resource: "确认模拟发布",
  discard_resource: "放弃资源草稿",
  followup: "登记补证跟进",
};
export function actions(s: State, id: string): string[] {
  if (!canSee(s, id)) return [];
  const e = entity(s, id)!,
    role = roleOf(s),
    out: string[] = [];
  if ("batches" in e) {
    if (role === "supervisor") {
      if (e.endedAt) out.push("spotcheck");
      if (detection(e) === "处理中") out.push("finish_detection");
      else out.push("start_detection");
      if (!e.endedAt) out.push("end_call");
    }
    return out;
  }
  if ("conclusions" in e) {
    if (role === "supervisor") {
      if (["candidate", "reminded", "supplement"].includes(e.status)) {
        out.push("dismiss", "assign");
        if (!s.supplements.some((x) => x.target === id && x.status !== "done"))
          out.push("supplement");
        if (!callFor(s, id)!.endedAt && !e.reminder) out.unshift("remind");
      }
      if (latest(e) && e.status !== "review") out.push("followup");
    }
    if (role === "agent") {
      if (e.reminder) {
        if (!e.reminder.readAt) out.push("read_reminder");
        out.push("feedback_reminder", "dissent_reminder");
      }
      const c = latest(e);
      if (c) {
        if (e.seenVersion !== c.version) out.push("ack");
        out.push("feedback_result");
        if (
          c.value === "risk" &&
          !s.appeals.some(
            (a) =>
              a.findingId === id &&
              a.conclusionVersion === c.version &&
              (!terminalAppeal(a) || a.status === "done"),
          )
        )
          out.push("appeal");
      }
    }
  }
  if ("findingIds" in e) {
    if (e.appealId) {
      const ap = s.appeals.find((a) => a.id === e.appealId);
      if (!ap || terminalAppeal(ap) || ap.status === "supplement") return [];
    }
    const awaiting = s.supplements.some(
      (x) => x.target === e.id && x.status !== "done",
    );
    if (
      role === "inspector" &&
      e.owner === s.identity &&
      ["pending", "working"].includes(e.status)
    ) {
      out.push("save_review", "submit_review");
      if (e.type === "spotcheck") out.push("add_finding");
    }
    if (role === "supervisor" && e.status === "supervisor" && !awaiting)
      out.push(
        ...(e.type === "appeal" ? [] : ["publish"]),
        "return_review",
        "supplement",
      );
    if (role === "supervisor" && !["done", "cancelled"].includes(e.status))
      out.push("extend", "reassign");
  }
  if (
    ("conclusionVersion" in e && "reviewId" in e) ||
    s.appeals.includes(e as Appeal)
  ) {
    const a = e as Appeal;
    if (role === "agent" && !terminalAppeal(a)) out.push("withdraw");
    if (role === "supervisor" && !terminalAppeal(a)) {
      if (a.status === "submitted") out.push("accept_appeal", "reject_appeal");
      if (["accepted", "decision"].includes(a.status)) out.push("decide");
      if (a.status === "accepted" && !a.reviewId) out.push("assign_appeal");
      if (a.status !== "supplement") out.push("supplement");
      out.push("extend");
    }
  }
  if ("standardVersion" in e && !terminalRemedy(e)) {
    if (role === "agent") {
      out.push("sample_calls");
      if (e.status === "pending" && !e.pause) out.push("accept_remedy");
      if (["pending", "executing"].includes(e.status) && !e.pause)
        out.push("adjust_request");
      if (e.status === "executing" || e.pause) out.push("material");
    }
    if (
      role === "inspector" &&
      e.inspector === s.identity &&
      e.status === "verification"
    ) {
      out.push("save_acceptance");
      if (!e.pause) out.push("verify");
    }
    if (role === "supervisor") {
      out.push("change_standard", "extend", "reassign");
      if (e.status === "supervisor" && !e.pause) {
        if (
          e.supervisorReason === "approve" &&
          e.acceptance?.result === "pass" &&
          e.acceptance.version === e.standardVersion &&
          !s.supplements.some((x) => x.target === id && x.status !== "done")
        )
          out.push("close_remedy");
        out.push("return_remedy");
      }
    }
  }
  if ("executor" in e) {
    if (e.executor === s.identity && e.status === "pending") out.push("reply");
    if (
      e.status === "submitted" &&
      (role === "supervisor" ||
        s.remedies.some((r) => r.id === e.target && r.inspector === s.identity))
    )
      out.push("receive_supplement");
  }
  if ("versions" in e && role === "inspector" && "type" in e)
    out.push("resource_feedback");
  if ("versions" in e && role === "supervisor") {
    if ("editable" in e || "indicator" in e) {
      if ((e as Rule).editable) {
        out.push("save_rule");
        if (e.draft)
          out.push(
            "check_rule",
            "discard_rule",
            ...(e.checked ? ["publish_rule"] : []),
          );
      }
    } else {
      out.push("create_resource", "save_resource");
      if (e.draft)
        out.push(
          "check_resource",
          "discard_resource",
          ...(e.checked ? ["publish_resource"] : []),
        );
    }
  }
  return [...new Set(out)];
}
export type Input = {
  refs?: string[];
  resourceType?: Resource["type"];
  note?: string;
  owner?: string;
  dueAt?: string;
  value?: string;
  evidence?: number[];
  opinions?: Record<string, Opinion>;
  summary?: string;
  title?: string;
  ruleId?: string;
  goal?: string;
  standard?: string;
  sampleCount?: number;
  observation?: string;
  remedy?: boolean;
  noRemedy?: string;
  samples?: string[];
  attachment?: string;
  trigger?: string;
  scope?: string;
  threshold?: number;
  content?: string;
  resourceRole?: string;
  exception?: string;
  checkPass?: boolean;
};
export type Command = {
  id: string;
  action: string;
  rev: number;
  requestId: string;
  input: Input;
};
function must(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const future = (s: string | undefined, now: Date) =>
  s && Number.isFinite(Date.parse(s)) && Date.parse(s) > now.getTime();
const validInspector = (id?: string) =>
  people.some((p) => p.id === id && p.role === "inspector");
export const currentOwner = (s: State, e: Entity): string => {
  "use strict";
  if ("conclusions" in e) {
    if (["candidate", "reminded", "supplement"].includes(e.status))
      return "S01";
    if (e.status === "review") {
      const r = s.reviews.find(
        (r) =>
          r.findingIds.includes(e.id) &&
          r.type !== "appeal" &&
          !["done", "cancelled"].includes(r.status),
      );
      return r ? (r.status === "supervisor" ? "S01" : r.owner) : "";
    }
    return "";
  }
  if ("findingIds" in e)
    return ["done", "cancelled"].includes(e.status)
      ? ""
      : e.status === "supervisor"
        ? "S01"
        : e.owner;
  if ("standardVersion" in e)
    return terminalRemedy(e)
      ? ""
      : e.status === "verification"
        ? e.inspector
        : e.status === "supervisor"
          ? "S01"
          : e.agentId;
  if ("findingId" in e)
    return terminalAppeal(e)
      ? ""
      : e.status === "supplement"
        ? e.agentId
        : e.status === "reviewing"
          ? (s.reviews.find((r) => r.id === e.reviewId)?.owner ?? "S01")
          : "S01";
  if ("executor" in e)
    return e.status === "pending"
      ? e.executor
      : e.status === "submitted"
        ? (s.remedies.find((r) => r.id === e.target)?.inspector ?? "S01")
        : "";
  return "";
};
export function pauseRemedy(r: Remedy, reason: string, now: Date) {
  if (terminalRemedy(r)) return;
  if (r.pause) {
    if (!r.pause.reasons.includes(reason)) r.pause.reasons.push(reason);
    return;
  }
  const overdue = Date.parse(r.dueAt) < now.getTime();
  if (overdue) r.firstOverdueAt ??= r.dueAt;
  r.pause = {
    reasons: [reason],
    startedAt: now.toISOString(),
    phase: r.status,
    owner:
      r.status === "verification"
        ? r.inspector
        : r.status === "supervisor"
          ? "S01"
          : r.agentId,
    dueAt: r.dueAt,
    wasOverdue: overdue,
  };
  r.rev++;
}
export function resumeRemedy(r: Remedy, reason: string, now: Date) {
  if (!r.pause) return;
  const reasons = [...r.pause.reasons];
  r.pause.reasons = r.pause.reasons.filter((x) => x !== reason);
  if (r.pause.reasons.length) return;
  const elapsed = Math.max(0, now.getTime() - Date.parse(r.pause.startedAt));
  r.dueAt = new Date(Date.parse(r.dueAt) + elapsed).toISOString();
  r.pauseHistory.push({
    start: r.pause.startedAt,
    end: now.toISOString(),
    duration: elapsed,
    reasons,
  });
  r.pause = undefined;
  r.rev++;
}
function cancelAppealReview(s: State, a: Appeal, now: Date, completed = false) {
  const r = s.reviews.find((r) => r.id === a.reviewId);
  if (r && !["done", "cancelled"].includes(r.status)) {
    r.history.push({
      at: now.toISOString(),
      opinions: structuredClone(r.opinions),
      summary: r.summary,
    });
    r.status =
      completed &&
      r.status === "supervisor" &&
      r.findingIds.every((id) => r.opinions[id])
        ? "done"
        : "cancelled";
    if (r.status === "done") r.finishedAt = now.toISOString();
    r.rev++;
  }
  for (const x of s.supplements.filter(
    (x) => x.target === a.id && x.status !== "done",
  )) {
    x.status = "done";
    x.rev++;
  }
}
export function apply(state: State, cmd: Command, now = new Date()): State {
  if (state.requests.includes(cmd.requestId)) return state;
  const old = entity(state, cmd.id);
  must(old, "对象不存在");
  must(old.rev === cmd.rev, "记录已更新，请关闭旧表单后重新操作。");
  must(
    actions(state, cmd.id).includes(cmd.action),
    "当前身份或状态不允许此操作。",
  );
  const s = structuredClone(state),
    e = entity(s, cmd.id)!,
    i = cmd.input,
    a = cmd.action,
    at = now.toISOString(),
    role = roleOf(s);
  const free = [
    "sample_calls",
    "end_call",
    "read_reminder",
    "ack",
    "accept_remedy",
    "check_rule",
    "check_resource",
    "discard_rule",
    "discard_resource",
    "start_detection",
    "finish_detection",
  ];
  if (!free.includes(a))
    must((i.note ?? "").trim().length >= 4, "请填写至少 4 个字的处理说明。");
  const due = () => {
    must(future(i.dueAt, now), "请选择晚于当前时间的期限。");
    return i.dueAt!;
  };
  const inspector = () => {
    must(validInspector(i.owner), "请选择有效质检员。");
    return i.owner!;
  };
  const evidence = (callId: string) => {
    must(
      i.evidence?.length &&
        i.evidence.every(
          (n) => s.calls.find((c) => c.id === callId)!.transcript[n],
        ),
      "请选择有效证据片段。",
    );
    return i.evidence!;
  };
  const uid = (prefix: string) =>
    `${prefix}-${s.revision + 1}-${s.logs.length + 1}`;
  const addReview = (
    f: Finding,
    owner: string,
    dueAt: string,
    type: Review["type"] = "candidate",
    appealId?: string,
  ) => {
    const existing = s.reviews.find(
      (r) =>
        r.findingIds.includes(f.id) &&
        r.type === type &&
        !["done", "cancelled"].includes(r.status),
    );
    if (existing) return existing;
    const r: Review = {
      id: uid("WO"),
      rev: 0,
      callId: f.callId,
      findingIds: [f.id],
      type,
      scope: i.note?.trim() || "通话结束后核查提醒风险",
      owner,
      dueAt,
      originalDueAt: dueAt,
      status: "pending",
      opinions: {},
      history: [],
      ...(appealId ? { appealId } : {}),
    };
    s.reviews.push(r);
    if (type !== "appeal") {
      f.status = "review";
      f.rev++;
    }
    return r;
  };
  const conclude = (
    f: Finding,
    value: Verdict,
    note: string,
    reviewer?: string,
    noRemedy?: string,
  ) => {
    f.conclusions.push({
      version: (latest(f)?.version ?? 0) + 1,
      value,
      note,
      at,
      by: s.identity,
      reviewer,
      noRemedy,
    });
    f.status = "delivered";
    f.rev++;
  };
  const addSupplement = (target: string, executor: string, origin: string) => {
    must(
      !s.supplements.some((x) => x.target === target && x.status !== "done"),
      "已有补件在处理中。",
    );
    must(person(executor), "请选择有效补件人。");
    s.supplements.push({
      id: uid("SUP"),
      rev: 0,
      target,
      executor,
      dueAt: due(),
      note: i.note!,
      status: "pending",
      origin,
      trigger: i.trigger || "提交后由当前责任人重新核对",
    });
  };
  if (a === "end_call") {
    const c = e as Call;
    must(!c.endedAt, "通话已结束");
    c.endedAt = at;
    for (const f of s.findings.filter(
      (f) =>
        f.callId === c.id &&
        f.reminder &&
        ["candidate", "reminded"].includes(f.status),
    )) {
      if (
        f.assignment &&
        validInspector(f.assignment.owner) &&
        future(f.assignment.dueAt, now)
      )
        addReview(f, f.assignment.owner, f.assignment.dueAt);
      else {
        f.status = "candidate";
        f.rev++;
      }
    }
  }
  if (a === "remind") {
    const f = e as Finding;
    must(!callFor(s, f.id)!.endedAt, "通话已结束");
    f.reminder = { text: i.note!, sentAt: at };
    f.status = "reminded";
    if (i.owner) f.assignment = { owner: inspector(), dueAt: due() };
  }
  if (["read_reminder", "feedback_reminder", "dissent_reminder"].includes(a)) {
    const f = e as Finding;
    must(f.reminder, "提醒不存在");
    if (a === "read_reminder") f.reminder.readAt = at;
    if (a === "feedback_reminder") f.reminder.feedback = i.note;
    if (a === "dissent_reminder") f.reminder.dissent = i.note;
  }
  if (a === "ack") (e as Finding).seenVersion = latest(e as Finding)!.version;
  if (a === "dismiss") {
    const f = e as Finding;
    must(
      ["false_positive", "insufficient"].includes(i.value ?? ""),
      "关闭原因须为误报或证据不足",
    );
    evidence(f.callId);
    conclude(f, i.value as Verdict, i.note!);
    f.status = "closed";
    s.supplements
      .filter((x) => x.target === f.id)
      .forEach((x) => {
        x.status = "done";
        x.rev++;
      });
  }
  if (a === "assign") {
    const f = e as Finding;
    addReview(f, inspector(), due());
    s.supplements
      .filter((x) => x.target === f.id)
      .forEach((x) => {
        x.status = "done";
        x.rev++;
      });
  }
  if (a === "followup") {
    const f = e as Finding;
    f.status = "supplement";
    addSupplement(f.id, i.owner || "S01", "followup");
  }
  if (a === "spotcheck") {
    const c = e as Call;
    must(i.scope?.trim(), "请填写抽查范围");
    const deadline = due();
    s.reviews.push({
      id: uid("WO"),
      rev: 0,
      callId: c.id,
      findingIds: [],
      type: "spotcheck",
      scope: i.scope!,
      owner: inspector(),
      dueAt: deadline,
      originalDueAt: deadline,
      status: "pending",
      opinions: {},
      history: [],
    });
  }
  if (a === "add_finding") {
    const r = e as Review;
    must(i.title?.trim() && i.ruleId, "请填写问题标题并选择规则");
    must(
      !s.findings.some(
        (f) => f.callId === r.callId && f.title.trim() === i.title!.trim(),
      ),
      "同一事实已存在，请关联已有问题。",
    );
    const rule = s.rules.find((x) => x.id === i.ruleId);
    must(rule, "规则不存在");
    const f: Finding = {
      id: uid("F"),
      rev: 0,
      callId: r.callId,
      title: i.title!,
      ruleId: rule.id,
      ruleVersion: rule.versions.at(-1)!.version,
      batchId: "manual",
      indicator: rule.indicator,
      related: [],
      source: "manual",
      severity: rule.severity,
      evidence: evidence(r.callId),
      status: "review",
      conclusions: [],
    };
    s.findings.push(f);
    r.findingIds.push(f.id);
  }
  if (a === "save_review" || a === "submit_review") {
    const r = e as Review;
    const opinions = i.opinions ?? {};
    if (a === "submit_review") {
      for (const id of r.findingIds) {
        const op = opinions[id];
        must(
          op &&
            ["risk", "false_positive", "insufficient"].includes(op.value) &&
            op.note.trim().length >= 4 &&
            op.evidence.length &&
            op.evidence.every(
              (n) => s.calls.find((c) => c.id === r.callId)!.transcript[n],
            ),
          "每个问题均须填写判断、说明和有效证据",
        );
      }
      if (!r.findingIds.length) {
        must(
          ["clear", "insufficient"].includes(i.value ?? ""),
          "请确认抽查范围内未发现问题或证据不足",
        );
        r.scopeResult = i.value as "clear" | "insufficient";
      }
      r.status = "supervisor";
      if (r.appealId) {
        const ap = s.appeals.find((x) => x.id === r.appealId)!;
        must(
          !terminalAppeal(ap) && ap.status === "reviewing",
          "关联申诉已变化",
        );
        ap.status = "decision";
        ap.rev++;
      }
    } else r.status = "working";
    r.opinions = opinions;
    r.summary = i.summary || i.note;
    r.history.push({
      at,
      opinions: structuredClone(opinions),
      summary: r.summary,
    });
  }
  if (a === "return_review") {
    const r = e as Review;
    r.status = "working";
    r.dueAt = due();
    if (r.appealId) {
      const ap = s.appeals.find((x) => x.id === r.appealId)!;
      ap.status = "reviewing";
      ap.rev++;
    }
  }
  if (a === "publish") {
    const r = e as Review;
    must(r.type !== "appeal", "申诉核查须在申诉案件裁定");
    for (const id of r.findingIds) {
      const f = s.findings.find((f) => f.id === id)!,
        op = i.opinions?.[id] ?? r.opinions[id];
      must(
        op &&
          op.note.trim().length >= 4 &&
          op.evidence.length &&
          op.evidence.every(
            (n) => s.calls.find((c) => c.id === r.callId)!.transcript[n],
          ),
        "每个问题均须保留有效结论说明与证据",
      );
      must(
        ["risk", "false_positive", "insufficient"].includes(op.value),
        "结论无效",
      );
      if (op.value === "risk") {
        if (i.remedy) {
          must(
            i.goal?.trim() && i.standard?.trim() && i.observation?.trim(),
            "请补齐整改目标、标准与观察要求",
          );
          must(
            Number.isInteger(i.sampleCount) &&
              i.sampleCount! > 0 &&
              i.sampleCount! <= 20,
            "演示样例数须为 1–20",
          );
          inspector();
          due();
        } else
          must((i.noRemedy ?? "").trim().length >= 4, "无需整改须说明原因");
      }
      conclude(
        f,
        op.value,
        op.note || i.note!,
        r.owner,
        op.value === "risk" && !i.remedy ? i.noRemedy : undefined,
      );
      if (op.value === "risk" && i.remedy) {
        s.remedies.push({
          id: `${uid("REC")}-${id}`,
          rev: 0,
          findingId: id,
          conclusionVersion: latest(f)!.version,
          agentId: callFor(s, f.id)!.agentId,
          inspector: i.owner!,
          status: "pending",
          goal: i.goal!,
          standard: i.standard!,
          standardVersion: 1,
          sampleCount: i.sampleCount!,
          observation: i.observation!,
          dueAt: i.dueAt!,
          originalDueAt: i.dueAt!,
          createdAt: at,
          round: 1,
          materials: [],
          acceptanceHistory: [],
          pauseHistory: [],
          standards: [
            {
              version: 1,
              goal: i.goal!,
              standard: i.standard!,
              note: i.note!,
              at,
            },
          ],
        });
      }
    }
    r.status = "done";
    r.finishedAt = at;
  }
  if (a === "appeal") {
    const f = e as Finding,
      c = latest(f)!;
    evidence(f.callId);
    const ap: Appeal = {
      id: uid("AP"),
      rev: 0,
      findingId: f.id,
      conclusionVersion: c.version,
      agentId: callFor(s, f.id)!.agentId,
      status: "submitted",
      note: i.note!,
      evidence: i.evidence!,
      dueAt: new Date(now.getTime() + 86400000).toISOString(),
      originalDueAt: new Date(now.getTime() + 86400000).toISOString(),
    };
    s.appeals.push(ap);
    s.remedies
      .filter((r) => r.findingId === f.id && !terminalRemedy(r))
      .forEach((r) => pauseRemedy(r, ap.id, now));
  }
  if (
    [
      "withdraw",
      "reject_appeal",
      "accept_appeal",
      "assign_appeal",
      "decide",
    ].includes(a)
  ) {
    const ap = e as Appeal,
      f = s.findings.find((f) => f.id === ap.findingId)!;
    must(
      latest(f)?.version === ap.conclusionVersion,
      "结论版本已变化，请查看最新结果",
    );
    if (a === "accept_appeal") {
      ap.status = "accepted";
      ap.dueAt = due();
    }
    if (a === "withdraw" || a === "reject_appeal") {
      ap.status = a === "withdraw" ? "withdrawn" : "rejected";
      ap.decidedAt = at;
      cancelAppealReview(s, ap, now);
      s.remedies
        .filter((r) => r.findingId === f.id)
        .forEach((r) => resumeRemedy(r, ap.id, now));
    }
    if (a === "assign_appeal") {
      const own = inspector();
      if (own === latest(f)?.reviewer) {
        must(
          (i.note ?? "").length >= 8,
          "使用原质检员须说明无其他人员可用的原因（至少 8 字）",
        );
        ap.sameReviewerReason = i.note;
      }
      const r = addReview(f, own, due(), "appeal", ap.id);
      ap.reviewId = r.id;
      ap.status = "reviewing";
    }
    if (a === "decide") {
      must(
        ["maintain", "false_positive", "insufficient", "adjust"].includes(
          i.value ?? "",
        ),
        "请选择有效裁定",
      );
      evidence(f.callId);
      if (i.value === "adjust")
        must(
          i.goal?.trim() && i.standard?.trim(),
          "调整成立范围须同步填写新目标与标准",
        );
      ap.outcome = i.value as Appeal["outcome"];
      ap.status = "done";
      ap.decidedAt = at;
      cancelAppealReview(s, ap, now, true);
      if (i.value !== "maintain")
        conclude(
          f,
          i.value === "adjust" ? "risk" : (i.value as Verdict),
          i.note!,
          s.reviews.find((r) => r.id === ap.reviewId)?.owner,
        );
      for (const r of s.remedies.filter((r) => r.findingId === f.id)) {
        resumeRemedy(r, ap.id, now);
        if (i.value === "maintain") continue;
        if (terminalRemedy(r)) {
          r.sourceChanged = true;
          r.rev++;
          continue;
        }
        if (i.value === "false_positive" || i.value === "insufficient") {
          r.status = "terminated";
          r.terminationReason =
            i.value === "false_positive"
              ? "来源结论改判为误报"
              : "证据不足，原整改依据不充分";
          r.finishedAt = at;
          r.pause = undefined;
        }
        if (i.value === "adjust") {
          r.goal = i.goal!;
          r.standard = i.standard!;
          r.standardVersion++;
          r.standards.push({
            version: r.standardVersion,
            goal: r.goal,
            standard: r.standard,
            note: i.note!,
            at,
          });
          r.acceptance = undefined;
          r.status = r.materials.length ? "verification" : "executing";
          r.conclusionVersion = latest(f)!.version;
        }
        r.rev++;
      }
      if (i.value === "insufficient" && i.owner) {
        f.status = "supplement";
        addSupplement(f.id, i.owner, "appeal_insufficient");
      }
    }
  }
  if (a === "supplement") {
    if ("standardVersion" in e) throw new Error("请通过验收样例不足提出补件");
    const origin = "status" in e ? e.status : "";
    let executor = i.owner || callFor(s, e.id)!.agentId;
    if (s.appeals.includes(e as Appeal)) {
      const ap = e as Appeal;
      ap.supplementOrigin = ap.status;
      ap.status = "supplement";
      executor = ap.agentId;
      const r = s.reviews.find((r) => r.id === ap.reviewId);
      if (r && !["done", "cancelled"].includes(r.status)) {
        r.status = "supervisor";
        r.rev++;
      }
    }
    if ("conclusions" in e) e.status = "supplement";
    addSupplement(e.id, executor, origin);
  }
  if (a === "reply") {
    const sp = e as Supplement;
    sp.reply = i.note;
    sp.status = "submitted";
  }
  if (a === "receive_supplement") {
    const sp = e as Supplement;
    sp.status = "done";
    const target = entity(s, sp.target)!;
    target.rev++;
    if (s.appeals.includes(target as Appeal)) {
      const ap = target as Appeal;
      ap.status = ap.reviewId
        ? "reviewing"
        : sp.origin === "submitted"
          ? "submitted"
          : "accepted";
      const r = s.reviews.find((r) => r.id === ap.reviewId);
      if (r) {
        r.status = "working";
        r.rev++;
      }
    }
    if ("conclusions" in target) target.status = "candidate";
    if ("findingIds" in target) target.status = "working";
  }
  if (a === "sample_calls") {
    const r = e as Remedy,
      source = callFor(s, r.id)!;
    s.calls.push({
      ...structuredClone(source),
      id: uid("SAMPLE"),
      rev: 0,
      startedAt: at,
      endedAt: at,
      sample: true,
      audio: undefined,
      authorized: [r.inspector],
      transcript: [
        {
          at: 0,
          speaker: "agent",
          text: "您好，银行客服中心，我先为您确认业务诉求。",
        },
        { at: 7, speaker: "customer", text: "我想查询业务的办理进度。" },
        {
          at: 12,
          speaker: "agent",
          text: "安全核验已完成。请勿提供完整验证码。当前业务条件、办理状态和后续处理方式，我逐项向您说明。",
        },
        { at: 24, speaker: "customer", text: "已经清楚了，谢谢您的说明。" },
      ],
      batches: [
        {
          id: uid("SB"),
          startedAt: at,
          endedAt: at,
          ruleVersions: Object.fromEntries(
            s.rules.map((x) => [x.id, x.versions.at(-1)!.version]),
          ),
          checks: [{ name: "场景规则", state: "success" }],
        },
      ],
    });
  }
  if (a === "accept_remedy") (e as Remedy).status = "executing";
  if (a === "adjust_request") {
    const r = e as Remedy;
    r.status = "supervisor";
    r.supervisorReason = "adjust";
  }
  if (a === "material") {
    const r = e as Remedy;
    const selected = i.samples ?? [];
    must(
      selected.every((id) =>
        s.calls.some(
          (c) =>
            c.id === id &&
            c.sample &&
            c.agentId === r.agentId &&
            c.business === callFor(s, r.id)!.business &&
            Date.parse(c.endedAt ?? "") >= Date.parse(r.createdAt),
        ),
      ),
      "请选择整改后的本人授权通话样例",
    );
    must(selected.length || i.attachment, "请选择样例或预设附件");
    r.materials.push({
      at,
      text: i.note!,
      samples: selected,
      attachment: i.attachment,
    });
    if (!r.pause) r.status = "verification";
  }
  if (a === "save_acceptance") (e as Remedy).draft = i.note;
  if (a === "verify") {
    const r = e as Remedy;
    must(!r.pause, "申诉暂停期间只能保存意见草稿");
    must(
      ["pass", "fail", "insufficient"].includes(i.value ?? ""),
      "请选择验收结果",
    );
    const sampleIds = new Set(r.materials.flatMap((m) => m.samples));
    if (i.value === "pass")
      must(
        sampleIds.size >= r.sampleCount &&
          !s.supplements.some((x) => x.target === r.id && x.status !== "done"),
        "样例不足或尚有补件，不能通过",
      );
    r.acceptance = {
      result: i.value as "pass" | "fail" | "insufficient",
      note: i.note!,
      version: r.standardVersion,
      round: r.round,
      at,
    };
    r.acceptanceHistory.push({ ...r.acceptance });
    if (i.value === "insufficient") {
      addSupplement(r.id, r.agentId, "verification");
    } else {
      r.status = "supervisor";
      r.supervisorReason = i.value === "pass" ? "approve" : "return";
    }
  }
  if (a === "close_remedy") {
    const r = e as Remedy;
    must(
      r.acceptance?.result === "pass" &&
        r.acceptance.version === r.standardVersion &&
        r.acceptance.round === r.round &&
        !r.pause,
      "当前标准尚未通过有效验收",
    );
    r.status = "done";
    r.finishedAt = at;
  }
  if (a === "return_remedy") {
    const r = e as Remedy;
    if (r.supervisorReason === "return") {
      r.round++;
      r.status = "executing";
      r.materials = [];
    } else r.status = r.materials.length ? "verification" : "executing";
    r.acceptance = undefined;
    r.supervisorReason = undefined;
    r.dueAt = due();
  }
  if (a === "change_standard") {
    const r = e as Remedy;
    must(i.standard?.trim() && i.goal?.trim(), "请填写目标及标准");
    r.standard = i.standard!;
    r.goal = i.goal!;
    r.standardVersion++;
    r.standards.push({
      version: r.standardVersion,
      standard: r.standard,
      goal: r.goal,
      note: i.note!,
      at,
    });
    r.acceptance = undefined;
    r.status = r.materials.length ? "verification" : "executing";
    r.supervisorReason = undefined;
  }
  if (a === "extend") {
    must("dueAt" in e, "对象没有期限");
    must(!("pause" in e && e.pause), "暂停期间先处理申诉，恢复后再调整期限");
    if (Date.parse(e.dueAt) < now.getTime())
      (e as Review | Appeal | Remedy).firstOverdueAt ??= e.dueAt;
    e.dueAt = due();
  }
  if (a === "start_detection") {
    const c = e as Call;
    must(
      !c.batches.some((b) => b.checks.some((x) => x.state === "running")),
      "已有检测正在执行",
    );
    c.batches.push({
      id: uid("B"),
      startedAt: at,
      ruleVersions: Object.fromEntries(
        s.rules.map((r) => [r.id, r.versions.at(-1)!.version]),
      ),
      checks: [
        { name: "转写", state: "running" },
        { name: "场景规则", state: "pending" },
      ],
    });
  }
  if (a === "finish_detection") {
    const c = e as Call,
      b = c.batches.at(-1)!;
    must(
      b.checks.some((x) => x.state === "running"),
      "没有运行中检测",
    );
    b.checks.forEach(
      (x) => (x.state = i.value === "failed" ? "failed" : "success"),
    );
    b.endedAt = at;
  }
  if (a === "save_rule") {
    const r = e as Rule,
      v = structuredClone(r.versions.at(-1)!);
    if (r.editable === "threshold") {
      must(
        Number.isInteger(i.threshold) &&
          i.threshold! >= 3 &&
          i.threshold! <= 60,
        "静默阈值为 3–60 秒的整数",
      );
      v.threshold = i.threshold!;
    }
    if (r.editable === "scope") {
      must(
        ["账户查询", "信用卡", "转账汇款", "全部业务"].includes(i.scope ?? ""),
        "请选择允许的业务范围",
      );
      v.scope = i.scope!;
    }
    if (r.editable === "trigger") {
      must(
        ["高风险候选", "所有候选", "关闭提醒"].includes(i.trigger ?? ""),
        "请选择有效提醒触发项",
      );
      v.trigger = i.trigger!;
    }
    r.draft = v;
    r.checked = false;
  }
  if (a === "check_rule" || a === "check_resource") {
    const r = e as Rule | Resource;
    must(r.draft, "请先保存草稿");
    r.checked = i.checkPass !== false;
  }
  if (a === "publish_rule") {
    const r = e as Rule;
    must(r.draft && r.checked, "请先完成草稿预设检查");
    r.versions.push({
      ...r.draft,
      version: r.versions.at(-1)!.version + 1,
      at,
    });
    r.draft = undefined;
    r.checked = false;
  }
  if (a === "discard_rule") {
    const r = e as Rule;
    r.draft = undefined;
    r.checked = false;
  }
  if (a === "resource_feedback") {
    /* The appended resource event is the durable feedback record. */
  }
  if (a === "reassign") {
    const owner = inspector();
    if ("findingIds" in e) {
      e.owner = owner;
      e.dueAt = due();
      if (e.status === "supervisor") e.status = "working";
      if (e.appealId) {
        const ap = s.appeals.find((x) => x.id === e.appealId)!;
        ap.status = "reviewing";
        ap.rev++;
      }
    }
    if ("standardVersion" in e) {
      e.inspector = owner;
      e.acceptance = undefined;
      if (e.materials.length) e.status = "verification";
      e.dueAt = due();
    }
  }
  if (a === "save_resource" || a === "create_resource") {
    let r = e as Resource;
    if (a === "create_resource") {
      must(
        i.title?.trim() &&
          ["词库", "业务知识", "SOP"].includes(i.resourceType ?? ""),
        "请填写资源名称与类型",
      );
      must(
        !s.resources.some(
          (x) => x.name === i.title && x.type === i.resourceType,
        ),
        "同类型已有同名条目",
      );
      must(
        i.refs?.length &&
          i.refs.every((id) => s.rules.some((r) => r.id === id)),
        "新条目须选择有效引用规则",
      );
      r = {
        id: uid("RES"),
        rev: 0,
        name: i.title!,
        type: i.resourceType!,
        versions: [],
        draftRuleIds: i.refs,
      };
      s.resources.push(r);
    }
    must(
      (i.content ?? "").trim().length >= 4 && i.scope && i.resourceRole,
      "请填写内容、业务范围和适用角色",
    );
    if (r.type === "词库") {
      const words = i
        .content!.split(/[\n，,]/)
        .map((x) => x.trim())
        .filter(Boolean);
      must(new Set(words).size === words.length, "词条重复，请合并重复项");
      must(
        !s.resources.some(
          (x) =>
            x.id !== r.id &&
            x.type === "词库" &&
            x.versions.at(-1)?.scope === i.scope &&
            x.versions
              .at(-1)
              ?.content.split(/[\n，,]/)
              .some((w) => words.includes(w.trim())),
        ),
        "同范围已有重复词条",
      );
    }
    if (r.type === "SOP")
      must(
        i.content!.split("\n").filter((x) => x.trim()).length >= 2 &&
          i
            .content!.split("\n")
            .every(
              (x) => x.replace(/^\s*\d+[.、)）]\s*/, "").trim().length > 0,
            ),
        "SOP 至少需要两个有序步骤",
      );
    r.draft = {
      content: i.content!,
      scope: i.scope!,
      role: i.resourceRole!,
      exception: i.exception ?? "",
    };
    r.checked = false;
  }
  if (a === "publish_resource") {
    const r = e as Resource;
    must(r.draft && r.checked, "请先通过草稿预设检查");
    const version = (r.versions.at(-1)?.version ?? 0) + 1;
    r.versions.push({ ...r.draft, version, at });
    r.draft = undefined;
    r.checked = false;
    for (const rule of s.rules) {
      const old = rule.versions.at(-1)!;
      if (r.id in old.resources || r.draftRuleIds?.includes(rule.id)) {
        rule.versions.push({
          ...structuredClone(old),
          version: old.version + 1,
          at,
          resources: { ...old.resources, [r.id]: version },
        });
        rule.rev++;
        rule.checked = false;
        if (rule.draft)
          rule.draft.resources = { ...rule.draft.resources, [r.id]: version };
      }
    }
  }
  if (a === "discard_resource") {
    const r = e as Resource;
    if (!r.versions.length)
      s.resources = s.resources.filter((x) => x.id !== r.id);
    else {
      r.draft = undefined;
      r.checked = false;
    }
  }
  e.rev++;
  s.revision++;
  s.requests.push(cmd.requestId);
  s.logs.push({
    id: uid("EV"),
    target: e.id,
    callId: callFor(s, e.id)?.id,
    at,
    actor: s.identity,
    action: actionNames[a] ?? a,
    note:
      i.note?.trim() ||
      (a === "end_call"
        ? "原型场景事件：封存证据，有效分派复用，无效分派回主管"
        : "已完成"),
  });
  for (const task of [...s.reviews, ...s.appeals, ...s.remedies]) {
    if (
      Date.parse(task.dueAt) < now.getTime() &&
      !["done", "cancelled", "terminated", "withdrawn", "rejected"].includes(
        task.status,
      ) &&
      !("pause" in task && task.pause)
    )
      task.firstOverdueAt ??= task.dueAt;
  }
  // All mutations pass through the same authorization, version and business guards.
  must(role === roleOf(s), "身份不可在业务动作内变更");
  return s;
}
export function notices(s: State) {
  const candidates: Entity[] = [
    ...s.findings.filter(
      (f) =>
        ["candidate", "reminded", "supplement"].includes(f.status) ||
        (roleOf(s) === "agent" && (!!latest(f) || !!f.reminder)),
    ),
    ...s.reviews,
    ...s.appeals,
    ...s.remedies,
    ...s.supplements,
  ];
  const ids = new Set<string>();
  return candidates.filter((e) => {
    if (!canSee(s, e.id) || ids.has(e.id)) return false;
    const active = currentOwner(s, e) === s.identity;
    const special =
      "conclusions" in e &&
      roleOf(s) === "agent" &&
      ((!!e.reminder && !e.reminder.readAt) ||
        (!!latest(e) && e.seenVersion !== latest(e)!.version));
    if (active || special) {
      ids.add(e.id);
      return true;
    }
    return false;
  });
}
export const csv = (rows: unknown[][]) =>
  "\ufeff" +
  rows
    .map((r) =>
      r
        .map((c) => {
          const text = String(c ?? "");
          return (
            '"' +
            (/^[=+@\-\t\r]/.test(text) ? "'" : "") +
            text.replace(/"/g, '""') +
            '"'
          );
        })
        .join(","),
    )
    .join("\r\n");
