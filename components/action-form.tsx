"use client";
import { supervisorReturnNote } from "../lib/case-context";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { SelectField } from "./select-field";
import { reviewResultLabel } from "../lib/lifecycle-labels";
import { bindingsDiff } from "../lib/indicator-bindings";
import { configurationDiff } from "../lib/strategy-schema";
import { ResourceFields } from "./resource-fields";
import { Textarea } from "./ui/textarea";
import { Input as TextInput } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
import { Button as ShadcnButton } from "./ui/button";
import { sopEditingText } from "../lib/sop-rules";
import { pendingResourceRules, fixedResourceRules } from "../lib/resource-publication";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Modal, Button, InlineFormSurface } from "./ui";
import {
  actionLabel,
  actions,
  acceptanceDraftMatches,
  supplementExecutors,
  linkableFindings,
  type Review,
  callFor,
  entity,
  latest,
  people,
  person,
  type Command,
  type Input,
  type Opinion,
  type State,
  type Rule,
  type Resource,
} from "../lib/workflow";
const localInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
export function ActionForm({
  embedded = false,
  state,
  id,
  action: requestedAction,
  onClose,
  onSubmit,
}: {
  embedded?: boolean;
  state: State;
  id: string;
  action: string;
  onClose: () => void;
  onSubmit: (command: Command) => void;
}) {
  const Surface = embedded ? InlineFormSurface : Modal;
  const target = entity(state, id)!;
  const supervisorComment = supervisorReturnNote(state, target);
  const actionTitle = ({check_rule:"检查草稿",check_resource:"检查草稿",publish_rule:"发布新版本",publish_resource:"发布新版本",save_resource:"编辑资源",create_resource:"新增资源"} as Record<string,string>)[requestedAction] ?? actionLabel(state, id, requestedAction);
  const isAcceptance = ["save_acceptance", "verify"].includes(requestedAction);
  const action = isAcceptance ? "verify" : requestedAction === "accept_assign" ? "assign_appeal" : requestedAction === "accept_decide" ? "decide" : requestedAction;
  const [formRev,setFormRev] = useState(target.rev);
  const remedyTarget = "standardVersion" in target ? target : "target" in target ? state.remedies.find(r=>r.id === target.target) : undefined;
  const call = callFor(state, id);
  const isReview = "findingIds" in target;
  const isRemedy = "standardVersion" in target;
  const staleAcceptanceDraft = isAcceptance && isRemedy && !!(target.acceptanceDraft || target.draft) && !acceptanceDraftMatches(target, state.identity);
  const isRule = "indicator" in target && "versions" in target;
  const isResource = "versions" in target && !isRule;
  const f =
    "conclusions" in target
      ? target
      : "findingId" in target
        ? state.findings.find((f) => f.id === target.findingId)
        : undefined;
  const appealReview = "reviewId" in target ? state.reviews.find(review => review.id === target.reviewId) : undefined;
  const fixedAppealOutcome = action === "decide" && appealReview?.status === "supervisor" ? appealReview.opinions[f?.id ?? ""]?.value : undefined;
  const fixedSupplementRecipient = action === "supplement" && (isReview && target.type === "appeal" || "conclusionVersion" in target && !isRemedy);
  const originalReviewer = f ? latest(f)?.reviewer : undefined;
  const defaults = () => {
    const data: Input = {
      note: "",
      owner:
        action === "reassign" ? (isReview ? target.owner : isRemedy ? target.inspector : "") === "Q01" ? "Q02" : "Q01" : action === "assign_appeal"
          ? originalReviewer === "Q02"
            ? "Q01"
            : "Q02"
          : ["remind","dispatch"].includes(action) ? "" : "Q01",
      value:
        action === "dismiss"
          ? "false_positive"
          : action === "decide"
            ? "maintain"
            : action === "verify"
              ? "pass"
              : "clear",
      evidence: f ? latest(f)?.evidence ?? f.evidence : [2],
      sampleCount: 1,
      observation: "提交整改后同业务通话，逐项核对改进效果",
      remedy: true,
      noRemedy: "",
      samples: [],
      refs: [],
      referenceRevs: Object.fromEntries(state.rules.map(rule=>[rule.id,rule.rev])),
      resourceType:
        "type" in target ? (target.type as Resource["type"]) : "词库",
      checkPass: true,
      scope: "全部业务",
      resourceRole: "坐席",
    };
    if (isReview) data.dispositions = Object.fromEntries(target.findingIds.map(fid=>[fid,{remedy:true,noRemedy:"",owner:target.owner,sampleCount:1,observation:"整改后同业务样例",dueAt:new Date(Date.now()+86400000).toISOString()}]));
    if (isReview && ["save_review", "submit_review", "publish"].includes(action)) data.note = target.summary ?? "";
    if (isReview && target.scopeResult) data.value = target.scopeResult;
    if (isReview)
      data.opinions = Object.fromEntries(
        target.findingIds.map((fid) => [
          fid,
          target.opinions[fid] ?? {
            value: "risk",
            note: "",
            evidence: state.findings.find((f) => f.id === fid)!.evidence,
          },
        ]),
      );
    if (isRemedy) {
      data.goal = target.goal;
      data.standard = target.standard;
      data.sampleCount = target.sampleCount;
      data.observation = target.observation;
      if (action !== "reassign") data.owner = target.inspector || "Q01";
      if (isAcceptance) {
        data.note = target.acceptanceDraft?.note ?? target.draft ?? "";
        data.value = target.acceptanceDraft?.result ?? "pass";
      }
    }
    if (isRule) {
      const r = target as Rule,
        v = r.draft ?? r.versions.at(-1)!;
      data.threshold = v.threshold;
      data.scope = v.scope;
      data.trigger = v.trigger;
    }
    if (isResource) {
      const r = target as Resource,
        v = r.draft ?? r.versions.at(-1)!;
      data.resourceKind=r.kind;
      data.content = !r.kind && r.type === "SOP" ? sopEditingText(v.content,r.name) : v.content;
      data.scope = v.scope;
      data.resourceRole = v.role;
      data.exception = v.exception;
      data.sourceFile = v.sourceFile;
    }
    if (action === "create_resource") {
      data.resourceKind="keyword";
      data.resourceType="词库";
      data.content = "关键词,同义词";
      data.refs=state.rules.filter(rule=>rule.indicator==="6.2.3").map(rule=>rule.id);
      data.exception = "";
      data.sourceFile = undefined;
    }
    if (action === "decide" && f?.distribution) {
      const review="reviewId" in target ? state.reviews.find(r=>r.id===target.reviewId) : undefined;
      Object.assign(data,{...f.distribution,owner:review?.owner});
      data.value=review?.opinions[f.id]?.value==="false_positive" ? "false_positive" : "maintain";
    }
    if (fixedAppealOutcome) data.value = fixedAppealOutcome === "false_positive" ? "false_positive" : "maintain";
    if (action === "optimization_feedback") data.value=f?.optimization?.status ?? "pending";
    if (action === "supplement") data.owner = call?.agentId ?? "S01";
    return data;
  };
  const [input, setInput] = useState<Input>(defaults);
  const [date, setDate] = useState(() =>
    localInput(new Date(isAcceptance && isRemedy && target.acceptanceDraft?.dueAt || Date.now() + 86400000)),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [initialInput] = useState(() => JSON.stringify(input));
  const committing = useRef(false);
  const resourceEditing = ["save_resource", "create_resource"].includes(action);
  const formRef = useRef<HTMLFormElement>(null);
  const [initialDate] = useState(date);
  const dirty = JSON.stringify(input) !== initialInput || date !== initialDate || importPending;
  const actionAvailable = actions(state, id).includes(requestedAction);
  const [discardPrompt,setDiscardPrompt] = useState(false);
  const closeForm = () => { if (busy) return; if (dirty) setDiscardPrompt(true); else onClose(); };
  useEffect(()=>{
    if(discardPrompt) formRef.current?.querySelector<HTMLButtonElement>("[data-continue-editing]")?.focus();
  },[discardPrompt]);
  useEffect(()=>{
    if(!resourceEditing) return;
    const frame = requestAnimationFrame(()=>formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input:not([type=checkbox]):not([type=file]), textarea")?.focus());
    return ()=>cancelAnimationFrame(frame);
  },[resourceEditing]);
  useEffect(()=>{
    if(!dirty) return;
    const guard=(event:Event)=>{if(committing.current)return;event.preventDefault();setError("内容尚未保存。请先保存，或取消修改后再切换页面。");requestAnimationFrame(()=>errorRef.current?.focus());};
    const unload=(event:BeforeUnloadEvent)=>{if(!committing.current)event.preventDefault();};
    window.addEventListener("qc:before-navigate",guard);window.addEventListener("beforeunload",unload);
    return()=>{window.removeEventListener("qc:before-navigate",guard);window.removeEventListener("beforeunload",unload);};
  },[dirty]);
  const [requestId] = useState(() => crypto.randomUUID());
  const set = <K extends keyof Input>(key: K, value: Input[K]) =>
    setInput((x) => ({ ...x, [key]: value }));
  const needsDue = ["accept_assign","accept_decide"].includes(requestedAction) ||
    [
      "assign",
      "spotcheck",
      "accept_appeal",
      "assign_appeal",
      "supplement",
      "followup",
      "return_review",
      "extend",
      "reassign",
    ].includes(action) ||
    false ||
    (action === "verify" && input.value === "insufficient") ||
    (action === "decide" && input.value === "insufficient" && !!input.owner);
  const needsOwner =
    [
      "assign",
      "assign_inspector",
      "spotcheck",
      "assign_appeal",
      "supplement",
      "followup",
      "reassign",
    ].includes(action) && !fixedSupplementRecipient;
  const needsEvidence = ["dispatch", "dismiss", "appeal", "decide", "add_finding"].includes(
    action,
  );
  const resourceType =
    action === "create_resource"
      ? input.resourceType
      : (target as Resource).type;
  const needsGoal =
    action === "change_standard" ||
    false ||
    (action === "decide" && input.value === "adjust");
  const free = [
    ...(isReview && target.findingIds.length ? ["save_review","submit_review","publish"] : []),
    "sample_calls",
    "end_call",
    "read_reminder",
    "ack",
    "accept_remedy",
    "accept_result",
    "check_rule",
    "check_resource",
    "discard_rule",
    "discard_resource",
    "start_detection",
    "finish_detection",
  ].includes(action);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const execute = (override?: string) => {
    if (busy) return;
    if (!actions(state,id).includes(override ?? requestedAction)) { setError("当前状态或身份已变化，此操作不可继续。请关闭表单查看最新记录。"); return; }
    if (importPending) { setError("请先确认或取消文件导入，再保存。"); return; }
    setBusy(true);
    setError("");
    try {
      const data = {
        ...input,
        dueAt: date ? new Date(date).toISOString() : undefined,
      };
      committing.current = true;
      onSubmit({ id, action: override ?? (resourceEditing ? action === "create_resource" ? "create_resource_content" : "save_resource_content" : ["save_review","submit_review"].includes(action) ? "submit_review" : isAcceptance ? "verify" : requestedAction), rev: formRev, requestId, input: data });
      onClose();
    } catch (e) {
      committing.current = false;
      setError(e instanceof Error ? e.message : "操作失败");
      setBusy(false);
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  };
  const evidenceSelector = (
    selected: number[],
    onChange: (indices: number[]) => void,
  ) => (
    <EvidenceSelection transcript={call?.transcript ?? []} selected={selected} onChange={onChange}/>
  );
  return (
    <Surface title={isAcceptance ? "整改核验" : ["save_review","submit_review"].includes(action) ? actionLabel(state,id,"submit_review") : resourceEditing && input.resourceKind === "voice" ? action === "create_resource" ? "新增声纹库" : "编辑声纹库" : actionTitle} onClose={closeForm} {...(!embedded ? {variant:"action" as const, description: action === "create_resource" ? "保存后分配资源编号" : `${id} · ${isReview ? target.scope : "title" in target ? target.title : "name" in target ? target.name : person(state.identity).name}`} : {})}>
      <form ref={formRef} className="action-form" noValidate onSubmit={(e:FormEvent<HTMLFormElement>)=>{
        e.preventDefault();
        if (discardPrompt) return;
        const invalid = Array.from(e.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")).find(field => !field.disabled && !field.validity.valid);
        if (invalid) {
          setError(invalid.validity.valueMissing ? "请完成此必填项后再提交。" : invalid.validity.tooShort ? "填写内容过短，请补充完整说明。" : "此项格式或数值范围不正确，请检查后重新提交。");
          invalid.setAttribute("aria-invalid", "true");
          invalid.setAttribute("aria-describedby", "action-error");
          invalid.dataset.formInvalid = "true";
          requestAnimationFrame(() => invalid.focus());
          return;
        }
        execute();
      }} onChangeCapture={event => {
        const field = event.target as HTMLElement;
        if (field.dataset.formInvalid) { field.removeAttribute("aria-invalid"); field.removeAttribute("aria-describedby"); delete field.dataset.formInvalid; setError(""); }
      }}>
        <div className="action-form-body">
        {embedded && <div className="form-context">
          <b>
            {action === "create_resource" ? "新资源" : "title" in target
              ? target.title
              : "goal" in target
                ? target.goal
                : "name" in target
                  ? target.name
                  : id}
          </b>
          <span>
            {action === "create_resource" ? "保存后分配编号" : id} · 当前操作：{person(state.identity).name}
          </span>
        </div>}
        {isAcceptance && isRemedy && <div className="callout">
          <b>第 {target.round} 轮 · 标准 V{target.standardVersion}</b>
          <p>验收标准：{target.standard}</p><p>保存草稿由你继续处理；核验通过交主管确认；不通过或资料不足时列明补充要求，退回坐席重新提交。</p>
          {target.pause && <p>申诉处理中，当前只能保存草稿。</p>}
          {staleAcceptanceDraft && <><p>原草稿的轮次、标准或验收人已变化。内容已保留为参考，请核对本轮材料与标准。</p><label className="checkbox"><Checkbox checked={!!input.draftBasisConfirmed} onCheckedChange={checked=>set("draftBasisConfirmed",checked===true)}/>已核对当前轮次、标准与材料</label></>}
        </div>}
        {action === "end_call" && (
          <p className="callout">
            这是原型场景事件。结束后封存证据，有效预设分派自动衔接复核；未设置或失效的分派回主管待办。
          </p>
        )}
        {action === "appeal" && (
          <p className="callout">
            申诉针对当前第 {latest(f!)?.version}{" "}
            版成立结论。有效提交后，关联的未完成整改立即暂停。
          </p>
        )}
        {action === "withdraw" && (
          <p className="callout">
            撤回后取消未完成的核查任务，关联整改恢复原阶段并顺延实际暂停时长。撤回不等于承认原结论。
          </p>
        )}
        {isReview && ["submit_review", "save_review"].includes(action) && supervisorComment && <div className="requirements"><h3>主管退回意见</h3><p>{supervisorComment}</p><p>请按本次退回要求重新核实，再提交本轮结果。</p></div>}
        {"executor" in target && ["reply", "receive_supplement"].includes(action) && <div className="requirements"><h3>补件要求</h3><p>{target.note}</p>{target.reply && <><h3>已提交材料</h3><p>{target.reply}</p></>}</div>}
        {action === "return_review" && <p className="callout">退回{person(isReview ? target.owner : "")?.name ?? "原质检员"}，请说明不认可的原因、需要重新核实的事项及期限。重新提交后再由主管确认。</p>}
        {action === "spotcheck" && (
          <label>
            检查范围
            <TextInput
              required
              placeholder="例如：身份核验、敏感信息保护"
              value={input.scope === "全部业务" ? "" : input.scope}
              onChange={(e) => set("scope", e.target.value)}
            />
          </label>
        )}
        {action === "remind" && <section className="reminder-fields"><p>发送给 <strong>{person(call?.agentId ?? "")?.name ?? "当前坐席"}</strong> · 通话中提醒</p><label>提醒内容<Textarea required minLength={4} rows={3} aria-label="提醒内容" placeholder="例如：请勿索取完整短信验证码，使用安全核验流程。" value={input.note} onChange={event=>set("note",event.target.value)}/><small>这段内容将展示给坐席。</small></label><Collapsible><CollapsibleTrigger asChild><ShadcnButton type="button" variant="ghost" className="followup-toggle">安排后续复核（可选）</ShadcnButton></CollapsibleTrigger><CollapsibleContent><div className="form-grid"><label>复核人<SelectField value={input.owner ?? ""} onValueChange={value=>set("owner",value)}><option value="">暂不预设</option>{people.filter(p=>p.role==="inspector").map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</SelectField></label>{input.owner && <label>复核期限<TextInput type="datetime-local" required value={date} onChange={event=>setDate(event.target.value)}/></label>}</div><small>通话结束后进入复核；未预设时由主管分派。</small></CollapsibleContent></Collapsible></section>}
        {action === "accept_result" && f?.distribution && <div className="requirements"><h3>接受后开始整改</h3><p>目标：{f.distribution.goal}</p><p>标准：{f.distribution.standard}</p><p>资料：{f.distribution.observation} · {f.distribution.sampleCount} 通样例</p><p>期限：{new Date(f.distribution.dueAt).toLocaleString("zh-CN")}</p><p>{f.distribution.inspector ? `核验质检员：${person(f.distribution.inspector)?.name}` : "可先整改和提交资料；主管将在核验前补派质检员。"}</p></div>}
        {action === "assign_inspector" && <p className="callout">仅此直接提醒、直接接受整改的任务需要补派。指派后保留已提交资料和原期限，坐席无需重复提交。</p>}
        {["agree_remedy_return","explain_remedy","agree_appeal_return","explain_appeal"].includes(action) && <div className="requirements"><h3>主管退回意见</h3><p>{supervisorComment || "请查看处理记录"}</p><p>{action.startsWith("explain") ? "本次说明提交给主管，不退回坐席。" : action==="agree_remedy_return" ? "列明整改缺项及补充要求后交坐席办理。" : "返回核查环节，需要材料时另行向坐席发起补件。"}</p></div>}
        {action === "optimization_feedback" && <label>反馈状态<SelectField value={input.value} onValueChange={value=>set("value",value)}><option value="pending">待评估</option><option value="recorded">已记录优化建议</option><option value="unnecessary">无需调整规则</option></SelectField><small>反馈保留在误报档案中，规则变更仍需在质检策略中单独配置并保存。</small></label>}
        {(action === "dispatch" || action === "decide" && input.value === "maintain" && f?.distribution) && <DispositionFields appealDecision={action === "decide"} value={{...input,remedy:true,dueAt:date ? new Date(date).toISOString() : ""}} onChange={patch=>{setInput(x=>({...x,...patch}));if(patch.dueAt)setDate(localInput(new Date(patch.dueAt)));}} />}
        {fixedSupplementRecipient && <p className="callout">补件执行人：{person(call?.agentId ?? "")?.name ?? "本通话坐席"}。补齐后由本案核查质检员接收，继续核查。</p>}
        {needsOwner && (
          <label>
            {action === "supplement" || action === "followup"
              ? "补件执行人"
              : action === "remind"
                ? "通话结束后复核人（可不预设）"
                : "负责质检员"}
            <SelectField
              aria-label="负责人员"
              value={input.owner}
              onValueChange={value => set("owner", value)}
            >
              {action === "remind" && (
                <option value="">暂不预设，结束后由主管补全</option>
              )}
              {people
                .filter(
                  (p) =>
                    ["supplement", "followup"].includes(action) ? supplementExecutors(state,id).some(x=>x.id===p.id) : p.role === "inspector" && (action !== "reassign" || p.id !== (isReview ? target.owner : isRemedy ? target.inspector : "")),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ·{" "}
                    {p.role === "inspector"
                      ? "质检员"
                      : p.role === "agent"
                        ? "坐席"
                        : "主管"}
                    {action === "assign_appeal" && p.id === originalReviewer
                      ? "（原复核人）"
                      : ""}
                  </option>
                ))}
            </SelectField>
          </label>
        )}
        {action === "assign_appeal" && (
          <p className="subtle">
            优先由另一名质检员核查；选择原复核人时，请说明无其他人员可用的原因。
          </p>
        )}
        {needsDue && (
          <label>
            {action === "supplement" || action === "followup"
              ? "补件期限"
              : "办理期限"}
            <TextInput
              aria-label={action === "supplement" || action === "followup" ? "补件期限" : "办理期限"}
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}
        {["decide", "return_appeal"].includes(action) && appealReview?.status === "supervisor" && <div className="requirements">
          <h3>质检员核查结论：{reviewResultLabel(appealReview.opinions[f?.id ?? ""]?.value, "appeal")}</h3>
          <p>{appealReview.opinions[f?.id ?? ""]?.note}</p>
          {appealReview.supervisorComment && <><h4>上次退回意见</h4><p>{appealReview.supervisorComment}</p><h4>质检员本轮说明</h4><p className="whitespace-pre-wrap">{appealReview.summary}</p></>}
          <p>{action === "return_appeal" ? "退回后由本案质检员核对主管意见，再决定重新核查或补充说明。" : `${appealReview.opinions[f?.id ?? ""]?.value === "risk" ? "确认后维持原结论并进入整改。" : "确认后撤销原结论并归档。"}有异议请退回质检员核对。`}</p>
        </div>}
        {isRemedy && ["close_remedy", "return_remedy"].includes(action) && target.acceptance && <div className="requirements">
          <h3>第 {target.round} 轮核验 · 标准 V{target.standardVersion}</h3>
          <p>验收标准：{target.standard}</p>
          {target.supervisorComment && <><h4>上次退回意见</h4><p>{target.supervisorComment}</p></>}
          <h4>质检员核验依据</h4><p className="whitespace-pre-wrap">{target.acceptance.note}</p>
          <p>{action === "close_remedy" ? "确认后整改完成并归档。" : "退回后由质检员核对主管意见，再决定补充说明或要求坐席继续整改。"}</p>
        </div>}
        {(!fixedAppealOutcome || action !== "decide") && ["dismiss", "decide", "verify", "finish_detection"].includes(
          action,
        ) && (
          <label>
            {action === "decide"
              ? "裁定结果"
              : action === "verify"
                ? "验收结果"
                : action === "finish_detection"
                  ? "预设执行结果"
                  : "归档结论"}
            <SelectField
              aria-label={action === "decide" ? "裁定结果" : action === "verify" ? "验收结果" : action === "finish_detection" ? "预设执行结果" : "归档结论"}
              name="action-result"
              value={input.value}
              onValueChange={value => set("value", value)}
            >
              {(action === "dismiss"
                ? [
                    ["false_positive", "误报 / 不成立"],
                  ]
                : action === "decide"
                  ? [
                      ["maintain", "申诉不成立，进入整改"],
                      ["false_positive", "申诉成立，撤销原结论"],
                    ]
                  : action === "verify"
                    ? [
                        ["pass", "满足要求，提交主管"],
                        ["fail", "不满足要求，退回坐席"],
                        ...(isRemedy && target.origin ? [] : [["insufficient", "证据 / 样例不足"]]),
                      ]
                    : [
                        ["clear", "执行成功"],
                        ["failed", "必需检查失败"],
                      ]
              ).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </SelectField>
          </label>
        )}
        {action === "decide" && input.value === "insufficient" && (
          <>
            <p className="callout">
              未结束的关联整改将以“依据不充分”终止。可登记有责任人与期限的补证跟进，后续重新成立时新建整改。
            </p>
            <label>
              后续补证执行人
              <SelectField
                value={input.owner}
                onValueChange={value => set("owner", value)}
              >
                <option value="">当前无法补证，结束本次处理</option>
                {supplementExecutors(state,id).map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
            </label>
          </>
        )}
        {action === "request_evidence" && <p className="callout">说明缺失资料及建议来源。草稿保留，由主管协调执行人和期限，补齐后回到本工单。</p>}
        {action === "link_finding" && <label>同通话已有问题<SelectField required value={input.findingId ?? ""} onValueChange={value => set("findingId",value)}><option value="">请选择问题</option>{linkableFindings(state,target as Review).map(f=><option value={f.id} key={f.id}>{f.id} · {f.title}</option>)}</SelectField><small>已有进行中复核时，请回原工单处理；不重复建立事实和结论。</small></label>}
        {action === "add_finding" && (
          <>
            <label>
              问题标题
              <TextInput
                required
                value={input.title ?? ""}
                onChange={(e) => set("title", e.target.value)}
                placeholder="同一事实只登记一个问题"
              />
            </label>
            <label>
              关联规则
              <SelectField
                required
                value={input.ruleId ?? ""}
                onValueChange={value => set("ruleId", value)}
              >
                <option value="">选择规则</option>
                {state.rules.filter(r=>!r.retired && r.indicator !== "6.3.4" && r.versions.length).map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectField>
            </label>
          </>
        )}
        {["save_review", "submit_review", "publish"].includes(action) &&
          isReview && (
            <div className="opinion-list">
              {target.findingIds.length ? (
                target.findingIds.map((fid) => {
                  const finding = state.findings.find((f) => f.id === fid)!,
                    op = input.opinions![fid];
                  const update = (patch: Partial<Opinion>) =>
                    set("opinions", {
                      ...input.opinions,
                      [fid]: { ...op, ...patch },
                    });
                  return (
                    <fieldset className="opinion-section" key={fid}>
                      <legend><span>{target.findingIds.indexOf(fid)+1}.</span> {finding.title}</legend>
                      {action === "publish" ? <div className="requirements"><p>质检员核实结论：<strong>{reviewResultLabel(op.value, target.type)}</strong></p><p>判断依据：{op.note}</p><p>证据：{op.evidence.map(index => call?.transcript[index]).filter(Boolean).map(segment => `${segment!.text}`).join("；")}</p><small>有异议请取消，退回质检员重新核实。</small></div> : <><label className="opinion-verdict-field">
                        <span>结论</span>
                        <SelectField
                          value={op.value}
                          onValueChange={value => update({
                              value: value as Opinion["value"],
                            })}
                        >
                          {["risk", "false_positive"].map(v => (
                            <option value={v} key={v}>
                              {reviewResultLabel(v, target.type)}
                            </option>
                          ))}
                        </SelectField>
                      </label>
                      <label>
                        判断依据
                        <Textarea className="resize-none"
                          value={op.note}
                          onChange={(e) => update({ note: e.target.value })}
                          placeholder="说明结论与证据的关系"
                        />
                      </label>
                      <div className="review-evidence">
                        {evidenceSelector(op.evidence, (v) =>
                          update({ evidence: v }),
                        )}
                      </div>
                      </>}
                      {action === "publish" && op.value === "risk" && <DispositionFields value={input.dispositions?.[fid] ?? {remedy:false}} onChange={patch=>set("dispositions",{...input.dispositions,[fid]:{...input.dispositions?.[fid],remedy:false,...input.dispositions?.[fid],...patch}})} previous={target.findingIds.indexOf(fid)>0 ? input.dispositions?.[target.findingIds[target.findingIds.indexOf(fid)-1]] : undefined} />}
                    </fieldset>
                  );
                })
              ) : action === "publish" ? <div className="requirements"><h3>抽检结果：未发现问题</h3><p>检查范围：{target.scope}</p><p>核验记录：{target.summary}</p><small>确认后办结抽检，不生成误报或整改任务。</small></div> : (
                <label>
                  抽查汇总
                  <SelectField
                    value={input.value}
                    onValueChange={value => set("value", value)}
                  >
                    <option value="clear">检查范围内未发现问题</option>

                  </SelectField>
                </label>
              )}
            </div>
          )}
        {needsGoal && (
          <>
            <label>
              整改目标
              <Textarea className="resize-none"
                required
                value={input.goal ?? ""}
                onChange={(e) => set("goal", e.target.value)}
                placeholder="应改善的行为与范围"
              />
            </label>
            <label>
              完成标准
              <Textarea className="resize-none"
                required
                value={input.standard ?? ""}
                onChange={(e) => set("standard", e.target.value)}
                placeholder="验收时如何判断达到要求"
              />
            </label>
            {action === "publish" && (
              <div className="form-grid">
                <label>
                  所需样例数
                  <TextInput
                    type="number"
                    min="1"
                    max="20"
                    value={input.sampleCount}
                    onChange={(e) => set("sampleCount", Number(e.target.value))}
                  />
                </label>
                <label>
                  观察与复测要求
                  <TextInput
                    value={input.observation}
                    onChange={(e) => set("observation", e.target.value)}
                  />
                </label>
              </div>
            )}
          </>
        )}
        {action === "change_standard" && (
          <p className="callout">
            保存后生成新标准版本。已有验收意见仅作为历史，必须重新核验才能结案。
          </p>
        )}
        {(action === "material" || action === "reply") && remedyTarget && (
          <>
            <label>关联整改后样例</label>
            <div className="evidence-options">
              {state.calls
                .filter(
                  (c) =>
                    c.sample &&
                    c.agentId === remedyTarget.agentId &&
                    c.business === call?.business &&
                    Date.parse(c.endedAt ?? "") >= Date.parse(remedyTarget.createdAt),
                )
                .map((c) => (
                  <label className="checkbox" key={c.id}>
                    <Checkbox
                      checked={input.samples?.includes(c.id)}
                      onCheckedChange={(checked) =>
                        set(
                          "samples",
                          checked===true
                            ? [...(input.samples ?? []), c.id]
                            : input.samples?.filter((id) => id !== c.id),
                        )
                      }
                    />
                    {c.id} · {c.business}
                  </label>
                ))}
            </div>
            <label>
              附件示例
              <SelectField
                value={input.attachment ?? ""}
                onValueChange={value => set("attachment", value)}
              >
                <option value="">不附加</option>
                <option value="整改操作说明（预设附件）">
                  整改操作说明（预设附件）
                </option>
              </SelectField>
            </label>
            <p className="subtle">
              附件说明可补充材料，但不自动代表效果达标。没有新样例时可先生成一通整改后示例通话。
            </p>
          </>
        )}
        {needsEvidence && (
          <fieldset>
            <legend>选择证据片段</legend>
            {evidenceSelector(input.evidence ?? [], (v) => set("evidence", v))}
          </fieldset>
        )}
        {action === "save_rule" && isRule && (
          <>
            {(target as Rule).editable === "threshold" && (
              <label>
                静默阈值（秒）
                <TextInput
                  type="number"
                  min="3"
                  max="60"
                  step="1"
                  value={input.threshold}
                  onChange={(e) => set("threshold", Number(e.target.value))}
                />
                <small>默认 15 秒；仅开放 3–60 秒整数。</small>
              </label>
            )}
            {(target as Rule).editable === "scope" && (
              <label>
                适用业务
                <SelectField
                  value={input.scope}
                  onValueChange={value => set("scope", value)}
                >
                  {["全部业务", "账户查询", "信用卡", "转账汇款"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </SelectField>
              </label>
            )}
            {(target as Rule).editable === "trigger" && (
              <label>
                提醒触发
                <SelectField
                  value={input.trigger}
                  onValueChange={value => set("trigger", value)}
                >
                  {["高风险候选", "所有候选", "关闭提醒"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </SelectField>
              </label>
            )}
          </>
        )}
        {resourceEditing && isResource && <ResourceFields state={state} input={input} onChange={patch=>setInput(current=>({...current,...patch}))} type={resourceType ?? "词库"} create={action === "create_resource"} pending={importPending} onPending={setImportPending}/>}
        {["check_rule", "check_resource"].includes(action) && (
          <>
            <p className="callout">
              检查结果来自预设场景，尚未连接模型服务。检查不通过时，草稿无法发布。
            </p>
            <label>
              预设检查场景
              <SelectField
                value={input.checkPass ? "pass" : "fail"}
                onValueChange={value => set("checkPass", value === "pass")}
              >
                <option value="pass">检查通过：正例、反例及引用完整</option>
                <option value="fail">检查失败：示例例外说明未覆盖</option>
              </SelectField>
            </label>
          </>
        )}
        {action === "switch_resource" && isResource && <section className="reference-adoption"><p className="callout">将所选规则切换到资源 V{(target as Resource).versions.at(-1)?.version}。只影响后续检测，历史证据和已开始的检测保持原快照。</p><fieldset><legend>选择需要切换的规则</legend>{pendingResourceRules(state,target as Resource).map(rule=><label key={rule.id}><Checkbox disabled={!!rule.draft} checked={input.refs?.includes(rule.id) ?? false} onCheckedChange={checked=>set("refs",checked===true ? [...(input.refs ?? []),rule.id] : (input.refs ?? []).filter(id=>id!==rule.id))}/><span><b>{rule.name}</b><small>{rule.draft ? "存在参数草稿，需先处理草稿" : `规则 V${rule.versions.at(-1)!.version} · 资源 ${(rule.versions.at(-1)?.resources ?? {})[id] ? `V${(rule.versions.at(-1)?.resources ?? {})[id]}` : "未引用"} → V${(target as Resource).versions.at(-1)?.version}`}</small></span></label>)}</fieldset></section>}
        {["publish_rule", "publish_resource"].includes(action) && (
          <>
            <p className="callout">
              {isRule && (target as Rule).draft?.pendingPolicyBindings?.length ? "确认后同时发布新策略及下列规则关联。其他策略关联保持原样；规则已有草稿或版本变更时，整次发布将被阻止。" : isResource ? fixedResourceRules(state,target as Resource).length ? "确认后发布资源新版本，并自动用于对应指标的后续检测，无需再配置规则。已开始的检测与历史结论保留原快照。" : "确认后发布历史资源新版本，原有引用保持不变。" : "确认后生成新规则版本。新检测使用新版，已开始的检测与历史结论保留原快照。"}
            </p>
            <div className="change-preview">
              <b>{isResource ? fixedResourceRules(state,target as Resource).length ? "发布后自动生效的指标规则" : "相关规则" : "影响范围"}</b>
              <p>
                {isResource
                  ? state.rules
                      .filter((r) => target.id in (r.versions.at(-1)?.resources ?? {}) || (target as Resource).draftRuleIds?.includes(r.id))
                      .map((r) => r.name)
                      .join("、")
                  : (target as Rule).name}
              </p>
              {isRule && !!(target as Rule).draft?.pendingPolicyBindings?.length && <div className="new-policy-publish-scope"><b>将同时关联的规则</b><Table><TableHeader><TableRow><TableHead>指标规则</TableHead><TableHead>所选特征</TableHead><TableHead>核对状态</TableHead></TableRow></TableHeader><TableBody>{(target as Rule).draft!.pendingPolicyBindings!.map(item=>{const linked=state.rules.find(r=>r.id===item.ruleId);return <TableRow key={item.ruleId}><TableCell>{linked?.name ?? item.ruleId}</TableCell><TableCell>{item.features.join("、")}</TableCell><TableCell>{!linked || linked.retired?"规则不可用":linked.draft?"存在规则草稿，暂不可发布":linked.rev!==item.rev?"规则已更新，需重新核对":"版本一致"}</TableCell></TableRow>;})}</TableBody></Table></div>}
              <b>草稿差异</b>
              <Table className="diff-table"><TableHeader><TableRow><TableHead>字段</TableHead><TableHead>{isResource ? "最新发布版本" : "当前生效"}</TableHead><TableHead>待发布</TableHead></TableRow></TableHeader><TableBody>
              {(isRule ? ((target as Rule).draft?.bindings ? bindingsDiff(target as Rule,state) : (target as Rule).draft?.config ? configurationDiff(target as Rule,state) : (target as Rule).editable === "threshold" ? [["静默阈值（秒）",(target as Rule).versions.at(-1)!.threshold,(target as Rule).draft?.threshold]] : (target as Rule).editable === "scope" ? [["适用业务",(target as Rule).versions.at(-1)!.scope,(target as Rule).draft?.scope]] : [["提醒触发",(target as Rule).versions.at(-1)!.trigger,(target as Rule).draft?.trigger]]) : [["内容",(target as Resource).versions.at(-1)?.content,(target as Resource).draft?.content],...((target as Resource).kind ? [] : [["业务范围",(target as Resource).versions.at(-1)?.scope,(target as Resource).draft?.scope],["适用角色",(target as Resource).versions.at(-1)?.role,(target as Resource).draft?.role],["例外说明",(target as Resource).versions.at(-1)?.exception,(target as Resource).draft?.exception]])]).map(([name,oldValue,newValue],index)=><TableRow key={`${name}-${index}`}><TableHead>{name}</TableHead><TableCell>{oldValue || "—"}</TableCell><TableCell>{newValue || "—"}{oldValue === newValue && <small>（未变化）</small>}</TableCell></TableRow>)}
              {isResource && <TableRow><TableHead>引用规则</TableHead><TableCell>{state.rules.filter(r=>target.id in (r.versions.at(-1)?.resources ?? {})).map(r=>r.name).join("、") || "尚未引用"}</TableCell><TableCell>{state.rules.filter(r=>target.id in (r.versions.at(-1)?.resources ?? {}) || (target as Resource).draftRuleIds?.includes(r.id)).map(r=>r.name).join("、")}</TableCell></TableRow>}
              </TableBody></Table>
            </div>
          </>
        )}
        {!free && !resourceEditing && action !== "remind" && (
          <label>
            {["reply", "material"].includes(action)
              ? "材料说明"
              : action === "assign_appeal" && input.owner === originalReviewer
                ? "同人核查原因与要求"
                : resourceEditing ? "修改说明" : action === "dismiss" ? "误报原因" : action === "return_review" ? "退回原因与核实要求" : "处理说明"}
            <Textarea className="resize-none"
              aria-label={["reply", "material"].includes(action) ? "材料说明" : action === "assign_appeal" && input.owner === originalReviewer ? "同人核查原因与要求" : resourceEditing ? "修改说明" : action === "dismiss" ? "误报原因" : action === "return_review" ? "退回原因与核实要求" : "处理说明"}
              name="action-note"
              autoComplete="off"
              required
              minLength={4}
              rows={3}
              placeholder={resourceEditing ? "说明本次修改了哪些内容，至少 4 个字" : "例如：已核对本轮样例中的业务说明，至少 4 个字…"}
              value={input.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </label>
        )}
        {!actionAvailable && <p className="callout" role="status">当前状态或身份已变化，此操作已不可用。请关闭表单查看最新记录。</p>}
        {target.rev !== formRev && <p className="callout">当前记录已更新，输入已保留。请核对最新阶段与要求。<Button onClick={()=>{setFormRev(target.rev);setError("");}}>已核对，使用最新记录</Button></p>}
        </div>
        {error && (
          <p className="form-error" id="action-error" ref={errorRef} tabIndex={-1} role="alert">
            {error}
          </p>
        )}
        {discardPrompt && <p className="parameter-discard" role="alert">修改尚未保存，放弃后将恢复已保存的内容。</p>}
        <div className="modal-actions">
          {discardPrompt ? <><ShadcnButton type="button" variant="outline" className="btn" data-continue-editing onClick={()=>setDiscardPrompt(false)}>继续编辑</ShadcnButton><Button intent="danger" onClick={onClose}>放弃修改</Button></> : <>
          <Button disabled={busy} onClick={resourceEditing?onClose:closeForm}>取消</Button>
          {isAcceptance && <Button disabled={!actionAvailable || busy || importPending || target.rev !== formRev || staleAcceptanceDraft && !input.draftBasisConfirmed} onClick={()=>execute("save_acceptance")}>保存草稿</Button>}
          {["save_review","submit_review"].includes(action) && <Button disabled={!actions(state,id).includes("save_review") || busy} onClick={()=>execute("save_review")}>保存草稿</Button>}
          {(!isAcceptance || actions(state,id).includes("verify")) && <Button primary type="submit" disabled={!actionAvailable || busy || importPending || target.rev !== formRev || staleAcceptanceDraft && !input.draftBasisConfirmed || (["save_review","submit_review"].includes(action) && !call?.endedAt)}>
            {busy ? "保存中…" : isAcceptance ? "提交核验结果" : ["save_review","submit_review"].includes(action) ? actionLabel(state, id, "submit_review") : ["save_resource", "create_resource"].includes(action) ? "保存资源" : actionTitle}
          </Button>}
          </>}
        </div>
      </form>
    </Surface>
  );
}

function DispositionFields({value,onChange,previous,appealDecision=false}:{appealDecision?:boolean;value:NonNullable<Input["dispositions"]>[string];onChange:(patch:Partial<NonNullable<Input["dispositions"]>[string]>)=>void;previous?:NonNullable<Input["dispositions"]>[string]}) {
  return <div className="disposition-fields">
    <p className="subtle">{appealDecision ? "确认申诉不成立后直接进入整改，沿用本案核查质检员，无需坐席再次接受。" : "分发处理结果与要求后，坐席接受进入整改，不接受进入申诉。"}</p>
    {previous && <Button onClick={()=>onChange({...previous})}>沿用上一项要求</Button>}
    <label>整改目标<Textarea className="resize-none" required value={value.goal ?? ""} onChange={e=>onChange({goal:e.target.value})}/></label>
    <label>完成标准<Textarea className="resize-none" required value={value.standard ?? ""} onChange={e=>onChange({standard:e.target.value})}/></label>
    <p className="subtle">{value.owner && person(value.owner)?.role==="inspector" ? `沿用质检员：${person(value.owner)?.name}` : "直接提醒：坐席接受后由主管补派质检员，不阻塞坐席整改。"}</p>
    <div className="form-grid">
    <label>整改期限（北京时间）<TextInput required type="datetime-local" value={value.dueAt ? localInput(new Date(value.dueAt)):""} onChange={e=>onChange({dueAt:e.target.value ? new Date(e.target.value).toISOString():""})}/></label>
    <label>所需样例数<TextInput required type="number" min={1} max={20} value={value.sampleCount ?? 1} onChange={e=>onChange({sampleCount:Number(e.target.value)})}/></label>
    <label>观察与复测要求<TextInput required value={value.observation ?? ""} onChange={e=>onChange({observation:e.target.value})}/></label></div>
  </div>;
}


function EvidenceSelection({transcript,selected,onChange}:{
  transcript: NonNullable<ReturnType<typeof callFor>>["transcript"];
  selected:number[];
  onChange:(indices:number[])=>void;
}) {
  const [expanded,setExpanded]=useState(selected.length===0);
  const listId=useId();
  return <section className="evidence-selection" aria-label="证据片段">
    <div className="evidence-selection-heading"><span>证据片段 <small>已选 {selected.length}</small></span><ShadcnButton variant="link" type="button" className="text-button" aria-expanded={expanded} aria-controls={listId} onClick={()=>setExpanded(!expanded)}>{expanded ? "收起列表" : "调整证据"}</ShadcnButton></div>
    {!expanded && <div className="selected-evidence">{selected.length ? selected.slice().sort((a,b)=>a-b).map(n=>transcript[n] && <p key={n}><span>{String(transcript[n].at).padStart(2,"0")}s · {transcript[n].speaker==='agent' ? '坐席' : '客户'}</span>{transcript[n].text}</p>) : <p className="subtle">尚未选择证据片段</p>}</div>}
    <div id={listId} hidden={!expanded} className="evidence-options">
      {transcript.map((seg,n)=><label className="checkbox" key={n}><Checkbox checked={selected.includes(n)} onCheckedChange={checked=>onChange(checked===true ? [...selected,n] : selected.filter(x=>x!==n))}/><span><b>{String(seg.at).padStart(2,"0")}s · {seg.speaker==='agent' ? '坐席' : '客户'}</b>{seg.text}</span></label>)}
      {!transcript.length && <p className="subtle">暂无转写片段</p>}
    </div>
  </section>;
}
