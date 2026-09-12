"use client";
import { useState, type FormEvent } from "react";
import { Modal, Button } from "./ui";
import {
  actionNames,
  callFor,
  entity,
  latest,
  people,
  person,
  verdictNames,
  type Command,
  type Input,
  type Opinion,
  type State,
  type Rule,
  type Resource,
  type Remedy,
} from "../lib/workflow";
const localInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
export function ActionForm({
  state,
  id,
  action,
  onClose,
  onSubmit,
}: {
  state: State;
  id: string;
  action: string;
  onClose: () => void;
  onSubmit: (command: Command) => void;
}) {
  const target = entity(state, id)!;
  const call = callFor(state, id);
  const isReview = "findingIds" in target;
  const isRemedy = "standardVersion" in target;
  const isRule = "indicator" in target && "versions" in target;
  const isResource = "versions" in target && !isRule;
  const f =
    "conclusions" in target
      ? target
      : "findingId" in target
        ? state.findings.find((f) => f.id === target.findingId)
        : undefined;
  const originalReviewer = f ? latest(f)?.reviewer : undefined;
  const defaults = () => {
    const data: Input = {
      note: "",
      owner:
        action === "assign_appeal"
          ? originalReviewer === "Q02"
            ? "Q01"
            : "Q02"
          : "Q01",
      value:
        action === "dismiss"
          ? "false_positive"
          : action === "decide"
            ? "maintain"
            : action === "verify"
              ? "pass"
              : "clear",
      evidence: f?.evidence ?? [2],
      sampleCount: 1,
      observation: "提交整改后同业务通话，逐项核对改进效果（演示）",
      remedy: false,
      noRemedy: "",
      samples: [],
      refs: [],
      resourceType:
        "type" in target ? (target.type as Resource["type"]) : "词库",
      checkPass: true,
      scope: "全部业务",
      resourceRole: "坐席",
    };
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
      data.owner = target.inspector;
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
      data.content = v.content;
      data.scope = v.scope;
      data.resourceRole = v.role;
      data.exception = v.exception;
    }
    if (action === "create_resource") {
      data.content = "";
      data.exception = "";
    }
    if (action === "supplement") data.owner = call?.agentId ?? "S01";
    return data;
  };
  const [input, setInput] = useState<Input>(defaults);
  const [date, setDate] = useState(() =>
    localInput(new Date(Date.now() + 86400000)),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const set = <K extends keyof Input>(key: K, value: Input[K]) =>
    setInput((x) => ({ ...x, [key]: value }));
  const needsDue =
    [
      "assign",
      "remind",
      "spotcheck",
      "accept_appeal",
      "assign_appeal",
      "supplement",
      "followup",
      "return_review",
      "return_remedy",
      "extend",
      "reassign",
    ].includes(action) ||
    (action === "publish" && input.remedy) ||
    (action === "verify" && input.value === "insufficient") ||
    (action === "decide" && input.value === "insufficient" && !!input.owner);
  const needsOwner =
    [
      "assign",
      "remind",
      "spotcheck",
      "assign_appeal",
      "supplement",
      "followup",
      "reassign",
    ].includes(action) ||
    (action === "publish" && input.remedy);
  const needsEvidence = ["dismiss", "appeal", "decide", "add_finding"].includes(
    action,
  );
  const resourceType =
    action === "create_resource"
      ? input.resourceType
      : (target as Resource).type;
  const needsGoal =
    action === "change_standard" ||
    (action === "publish" && input.remedy) ||
    (action === "decide" && input.value === "adjust");
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
  ].includes(action);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = {
        ...input,
        dueAt: date ? new Date(date).toISOString() : undefined,
      };
      onSubmit({ id, action, rev: target.rev, requestId, input: data });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
      setBusy(false);
    }
  };
  const evidenceSelector = (
    selected: number[],
    onChange: (indices: number[]) => void,
  ) => (
    <div className="evidence-options">
      {call?.transcript.map((seg, n) => (
        <label className="checkbox" key={n}>
          <input
            type="checkbox"
            checked={selected.includes(n)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, n]
                  : selected.filter((x) => x !== n),
              )
            }
          />
          <span>
            <b>
              {String(seg.at).padStart(2, "0")}s ·{" "}
              {seg.speaker === "agent" ? "坐席" : "客户"}
            </b>
            {seg.text}
          </span>
        </label>
      ))}
    </div>
  );
  return (
    <Modal title={actionNames[action]} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-context">
          <b>
            {"title" in target
              ? target.title
              : "goal" in target
                ? target.goal
                : "name" in target
                  ? target.name
                  : id}
          </b>
          <span>
            {id} · 当前操作：{person(state.identity).name}
          </span>
        </div>
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
        {action === "spotcheck" && (
          <label>
            检查范围
            <input
              required
              placeholder="例如：身份核验、敏感信息保护"
              value={input.scope === "全部业务" ? "" : input.scope}
              onChange={(e) => set("scope", e.target.value)}
            />
          </label>
        )}
        {needsOwner && (
          <label>
            {action === "supplement" || action === "followup"
              ? "补件执行人"
              : action === "remind"
                ? "通话结束后复核人（可不预设）"
                : "负责质检员"}
            <select
              aria-label="负责人员"
              value={input.owner}
              onChange={(e) => set("owner", e.target.value)}
            >
              {action === "remind" && (
                <option value="">暂不预设，结束后由主管补全</option>
              )}
              {people
                .filter(
                  (p) =>
                    ["supplement", "followup"].includes(action) ||
                    p.role === "inspector",
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
            </select>
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
            <input
              aria-label="办理期限"
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}
        {["dismiss", "decide", "verify", "finish_detection"].includes(
          action,
        ) && (
          <label>
            {action === "decide"
              ? "裁定结果"
              : action === "verify"
                ? "验收结果"
                : action === "finish_detection"
                  ? "预设执行结果"
                  : "关闭原因"}
            <select
              aria-label="处理结果"
              value={input.value}
              onChange={(e) => set("value", e.target.value)}
            >
              {(action === "dismiss"
                ? [
                    ["false_positive", "误报 / 不成立"],
                    ["insufficient", "证据不足"],
                  ]
                : action === "decide"
                  ? [
                      ["maintain", "维持原结论"],
                      ["false_positive", "改判为误报"],
                      ["insufficient", "改判为证据不足"],
                      ["adjust", "调整成立范围"],
                    ]
                  : action === "verify"
                    ? [
                        ["pass", "通过"],
                        ["fail", "不通过"],
                        ["insufficient", "证据 / 样例不足"],
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
            </select>
          </label>
        )}
        {action === "decide" && input.value === "insufficient" && (
          <>
            <p className="callout">
              未结束的关联整改将以“依据不充分”终止。可登记有责任人与期限的补证跟进，后续重新成立时新建整改。
            </p>
            <label>
              后续补证执行人
              <select
                value={input.owner}
                onChange={(e) => set("owner", e.target.value)}
              >
                <option value="">当前无法补证，结束本次处理</option>
                {people.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {action === "add_finding" && (
          <>
            <label>
              问题标题
              <input
                required
                value={input.title ?? ""}
                onChange={(e) => set("title", e.target.value)}
                placeholder="同一事实只登记一个问题"
              />
            </label>
            <label>
              关联规则
              <select
                required
                value={input.ruleId ?? ""}
                onChange={(e) => set("ruleId", e.target.value)}
              >
                <option value="">选择规则</option>
                {state.rules.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
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
                    <fieldset key={fid}>
                      <legend>{finding.title}</legend>
                      <label>
                        逐项结论
                        <select
                          value={op.value}
                          onChange={(e) =>
                            update({
                              value: e.target.value as Opinion["value"],
                            })
                          }
                        >
                          {Object.entries(verdictNames).map(([v, l]) => (
                            <option value={v} key={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        判断依据
                        <textarea
                          value={op.note}
                          onChange={(e) => update({ note: e.target.value })}
                          placeholder="说明结论与证据的关系"
                        />
                      </label>
                      <details>
                        <summary>证据片段（已选 {op.evidence.length}）</summary>
                        {evidenceSelector(op.evidence, (v) =>
                          update({ evidence: v }),
                        )}
                      </details>
                    </fieldset>
                  );
                })
              ) : (
                <label>
                  抽查汇总
                  <select
                    value={input.value}
                    onChange={(e) => set("value", e.target.value)}
                  >
                    <option value="clear">检查范围内未发现问题</option>
                    <option value="insufficient">检查范围内证据不足</option>
                  </select>
                </label>
              )}
            </div>
          )}
        {action === "publish" &&
          isReview &&
          Object.values(input.opinions ?? {}).some(
            (x) => x.value === "risk",
          ) && (
            <>
              <label>
                成立问题的后续处置
                <select
                  value={input.remedy ? "yes" : "no"}
                  onChange={(e) => set("remedy", e.target.value === "yes")}
                >
                  <option value="no">无需整改，保留成立结论</option>
                  <option value="yes">下发整改（每个成立问题独立建案）</option>
                </select>
              </label>
              {!input.remedy && (
                <label>
                  无需整改原因
                  <textarea
                    required
                    value={input.noRemedy}
                    onChange={(e) => set("noRemedy", e.target.value)}
                    placeholder="例如：当通已纠正，具体证据可查"
                  />
                </label>
              )}
            </>
          )}
        {needsGoal && (
          <>
            <label>
              整改目标
              <textarea
                required
                value={input.goal ?? ""}
                onChange={(e) => set("goal", e.target.value)}
                placeholder="应改善的行为与范围"
              />
            </label>
            <label>
              完成标准
              <textarea
                required
                value={input.standard ?? ""}
                onChange={(e) => set("standard", e.target.value)}
                placeholder="验收时如何判断达到要求"
              />
            </label>
            {action === "publish" && (
              <div className="form-grid">
                <label>
                  所需样例数（演示值）
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={input.sampleCount}
                    onChange={(e) => set("sampleCount", Number(e.target.value))}
                  />
                </label>
                <label>
                  观察与复测要求
                  <input
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
        {action === "material" && isRemedy && (
          <>
            <label>关联整改后样例</label>
            <div className="evidence-options">
              {state.calls
                .filter(
                  (c) =>
                    c.sample &&
                    c.agentId === (target as Remedy).agentId &&
                    c.business === call?.business &&
                    Date.parse(c.endedAt ?? "") >= Date.parse(target.createdAt),
                )
                .map((c) => (
                  <label className="checkbox" key={c.id}>
                    <input
                      type="checkbox"
                      checked={input.samples?.includes(c.id)}
                      onChange={(e) =>
                        set(
                          "samples",
                          e.target.checked
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
              <select
                value={input.attachment ?? ""}
                onChange={(e) => set("attachment", e.target.value)}
              >
                <option value="">不附加</option>
                <option value="整改操作说明（预设附件）">
                  整改操作说明（预设附件）
                </option>
              </select>
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
                <input
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
                <select
                  value={input.scope}
                  onChange={(e) => set("scope", e.target.value)}
                >
                  {["全部业务", "账户查询", "信用卡", "转账汇款"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
            {(target as Rule).editable === "trigger" && (
              <label>
                提醒触发
                <select
                  value={input.trigger}
                  onChange={(e) => set("trigger", e.target.value)}
                >
                  {["高风险候选", "所有候选", "关闭提醒"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        {["save_resource", "create_resource"].includes(action) &&
          isResource && (
            <>
              {action === "create_resource" && (
                <>
                  <label>
                    资源名称
                    <input
                      required
                      value={input.title ?? ""}
                      onChange={(e) => set("title", e.target.value)}
                    />
                  </label>
                  <label>
                    资源类型
                    <select
                      value={input.resourceType}
                      onChange={(e) =>
                        set("resourceType", e.target.value as Resource["type"])
                      }
                    >
                      {["词库", "业务知识", "SOP"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend>引用规则（至少选择一项）</legend>
                    {state.rules.map((r) => (
                      <label className="checkbox" key={r.id}>
                        <input
                          type="checkbox"
                          checked={input.refs?.includes(r.id)}
                          onChange={(e) =>
                            set(
                              "refs",
                              e.target.checked
                                ? [...(input.refs ?? []), r.id]
                                : input.refs?.filter((id) => id !== r.id),
                            )
                          }
                        />
                        {r.name}
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
              <label>
                {resourceType === "SOP"
                  ? "有序步骤（每行一步）"
                  : resourceType === "词库"
                    ? "词条（每行一个）"
                    : "知识内容"}
                <textarea
                  rows={6}
                  required
                  value={input.content ?? ""}
                  onChange={(e) => set("content", e.target.value)}
                />
              </label>
              <div className="form-grid">
                <label>
                  业务范围
                  <select
                    value={input.scope}
                    onChange={(e) => set("scope", e.target.value)}
                  >
                    {["全部业务", "账户查询", "信用卡", "转账汇款"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  适用角色
                  <select
                    value={input.resourceRole}
                    onChange={(e) => set("resourceRole", e.target.value)}
                  >
                    {["坐席", "客户", "双方"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                例外说明
                <textarea
                  value={input.exception ?? ""}
                  onChange={(e) => set("exception", e.target.value)}
                />
              </label>
            </>
          )}
        {["check_rule", "check_resource"].includes(action) && (
          <>
            <p className="callout">
              以下为预设检查演示，不会运行真实模型。可切换失败场景查看草稿阻断。
            </p>
            <label>
              预设检查场景
              <select
                value={input.checkPass ? "pass" : "fail"}
                onChange={(e) => set("checkPass", e.target.value === "pass")}
              >
                <option value="pass">检查通过：正例、反例及引用完整</option>
                <option value="fail">检查失败：示例例外说明未覆盖</option>
              </select>
            </label>
          </>
        )}
        {["publish_rule", "publish_resource"].includes(action) && (
          <>
            <p className="callout">
              确认后生成新版本。新检测使用新版，已开始的检测与历史结论保留原快照。
            </p>
            <div className="change-preview">
              <b>影响范围</b>
              <p>
                {isResource
                  ? state.rules
                      .filter((r) => target.id in r.versions.at(-1)!.resources)
                      .map((r) => r.name)
                      .join("、")
                  : (target as Rule).name}
              </p>
              <b>草稿差异</b>
              <pre>
                {isRule
                  ? JSON.stringify(
                      {
                        原版: (target as Rule).versions.at(-1),
                        草稿: (target as Rule).draft,
                      },
                      null,
                      2,
                    )
                  : `原内容：${(target as Resource).versions.at(-1)?.content ?? "尚未发布"}\n\n草稿：${(target as Resource).draft?.content}`}
              </pre>
            </div>
          </>
        )}
        {!free && (
          <label>
            {["reply", "material"].includes(action)
              ? "材料说明"
              : action === "assign_appeal" && input.owner === originalReviewer
                ? "同人核查原因与要求"
                : "处理说明"}
            <textarea
              aria-label="处理说明"
              required
              minLength={4}
              rows={3}
              placeholder="写明本次处理的理由、要求或证据，至少 4 个字"
              value={input.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button onClick={onClose}>取消</Button>
          <Button primary type="submit" disabled={busy}>
            {busy ? "保存中…" : actionNames[action]}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
