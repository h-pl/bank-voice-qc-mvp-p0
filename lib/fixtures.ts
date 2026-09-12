import type {
  State,
  Rule,
  Finding,
  Review,
  Remedy,
  Call,
  Verdict,
} from "./workflow.ts";
export const ruleCategories = [
  ["6.2.3", "关键词检出"],
  ["6.2.5", "情绪识别"],
  ["6.2.6", "意图识别"],
  ["6.3.4", "风险上报与干预"],
  ["6.3.5", "服务礼仪"],
  ["6.3.6", "语言表达"],
  ["6.3.7", "专业性"],
  ["6.3.8", "隐私性"],
  ["6.3.9", "禁用词"],
  ["6.3.10", "消极情感"],
];
export function createInitial(now = new Date()): State {
  const time = (hours: number) =>
    new Date(now.getTime() + hours * 3600000).toISOString();
  const specs = [
    [
      "R-KW-018",
      "敏感关键词检出",
      "6.2.3",
      "识别业务敏感词，引用和否定语境需要人工核对",
      "medium",
      "",
    ],
    [
      "R-EM-002",
      "客户情绪异常",
      "6.2.5",
      "客户情绪仅作服务辅助线索，不直接认定坐席违规",
      "medium",
      "",
    ],
    [
      "R-INT-001",
      "客户诉求与业务匹配",
      "6.2.6",
      "按业务诉求识别待核对的转接偏差",
      "medium",
      "scope",
    ],
    [
      "R-AL-001",
      "高风险提醒",
      "6.3.4",
      "高风险候选发出人工处理建议；提醒不等于违规结论",
      "high",
      "trigger",
    ],
    [
      "R-SVC-002",
      "标准结束语检查",
      "6.3.5",
      "客户先挂断、紧急转接可作为例外",
      "medium",
      "",
    ],
    [
      "R-AC-003",
      "通话异常静默",
      "6.3.6",
      "定位连续静默片段，业务等待需结合上下文",
      "medium",
      "threshold",
    ],
    [
      "R-SOP-006",
      "身份核验流程",
      "6.3.7",
      "核对坐席及 IVR 核验记录，不以单句缺失直接判定",
      "high",
      "",
    ],
    [
      "R-COM-012",
      "敏感信息保护",
      "6.3.8",
      "坐席不得索取完整短信验证码；提醒勿泄露属于反例",
      "high",
      "",
    ],
    [
      "R-BAN-001",
      "禁用表达检查",
      "6.3.9",
      "区分坐席主动表达、转述客户原话与否定",
      "medium",
      "",
    ],
    [
      "R-SVC-009",
      "消极服务表达",
      "6.3.10",
      "结合角色和前后文复核推诿、不耐烦等表达",
      "medium",
      "",
    ],
  ];
  const rules: Rule[] = specs.map(
    ([id, name, indicator, description, severity, editable]) => ({
      id,
      rev: 0,
      name,
      indicator,
      description,
      severity: severity as "high" | "medium",
      ...(editable ? { editable: editable as Rule["editable"] } : {}),
      versions: [
        {
          version: 1,
          at: time(-168),
          threshold: 15,
          scope: "全部业务",
          trigger: "高风险候选",
          resources: {
            ...(id === "R-SOP-006"
              ? { "RES-SOP": 1 }
              : id === "R-COM-012" || id === "R-KW-018" || id === "R-BAN-001"
                ? { "RES-WORD": 1 }
                : { "RES-KNOW": 1 }),
          },
        },
      ],
    }),
  );
  const transcript = [
    {
      at: 0.0,
      speaker: "agent" as const,
      text: "您好，银行客服中心，工号一零四八，很高兴为您服务。",
    },
    {
      at: 6.412,
      speaker: "customer" as const,
      text: "你好，我想查询一下转账进度。",
    },
    {
      at: 10.061,
      speaker: "agent" as const,
      text: "好的，为您核对信息，请把手机收到的完整验证码告诉我。",
    },
    {
      at: 16.347,
      speaker: "customer" as const,
      text: "短信提示我不要把验证码告诉任何人，这个可以说吗？",
    },
    {
      at: 21.828,
      speaker: "agent" as const,
      text: "抱歉，刚才表述有误，请不要提供验证码。我们通过安全核验继续处理。",
    },
    { at: 29.418, speaker: "customer" as const, text: "好的，谢谢。" },
  ];
  const calls: Call[] = Array.from({ length: 24 }, (_, n) => ({
    id: `CALL-${String(1041 - n)}`,
    rev: 0,
    agentId: n % 4 === 3 ? "A1186" : "A1048",
    business: ["转账汇款", "账户查询", "信用卡"][n % 3],
    group: n % 4 === 3 ? "客服二组" : "客服一组",
    customer: `客户 ${["王", "李", "张", "刘", "陈"][n % 5]}女士 · 尾号 ${3600 + n}`,
    startedAt: time(-n * 3 - 0.1),
    ...(n === 0 ? {} : { endedAt: time(-n * 3) }),
    duration: n === 0 ? 31 : 180 + n * 13,
    transcript:
      n === 0
        ? transcript
        : [
            {
              at: 0,
              speaker: "agent",
              text: "您好，银行客服中心，很高兴为您服务。",
            },
            {
              at: 8,
              speaker: "customer",
              text:
                n === 1
                  ? "我刚才在自动语音里已经核验过身份了。"
                  : "我想查询账户和相关业务办理进度。",
            },
            {
              at: 16,
              speaker: "agent",
              text:
                n === 2
                  ? "这件事我们这边确实没办法处理。"
                  : n === 4
                    ? "客户刚才说“你们真不负责”，我理解您的着急。"
                    : n === 6
                      ? "请您不要向任何人提供验证码。"
                      : "我为您查询，请稍等片刻。",
            },
            { at: 24, speaker: "customer", text: "好的，请您帮忙确认一下。" },
            {
              at: 32,
              speaker: "agent",
              text: "已经为您查询，后续处理方式我向您说明。",
            },
          ],
    ...(n === 0 ? { audio: "/audio/privacy-demo.m4a" } : {}),
    ...(n === 1
      ? {
          corrections: [
            {
              segment: 1,
              text: "我刚才在自动语音（IVR）中已经完成身份核验。",
              reason: "领域表达规范化示例；原始转写保留，未运行真实纠错模型。",
            },
          ],
        }
      : {}),
    authorized: n > 14 ? ["Q01", "Q02"] : [],
    batches: [
      {
        id: `B-${1041 - n}-1`,
        startedAt: time(-n * 3 - 0.1),
        ...(n === 0 ? {} : { endedAt: time(-n * 3) }),
        ruleVersions: Object.fromEntries(rules.map((r) => [r.id, 1])),
        checks: [
          {
            name: "转写",
            state:
              n === 0 || n === 15
                ? "running"
                : n === 14
                  ? "pending"
                  : n === 13
                    ? "failed"
                    : "success",
          },
          {
            name: "场景规则",
            state:
              n === 0 || n === 14 || n === 15
                ? "pending"
                : n === 12 || n === 13
                  ? "failed"
                  : "success",
          },
        ],
      },
    ],
    ...(n >= 16 ? { sample: true } : {}),
  }));
  const names = [
    "疑似索取完整短信验证码",
    "身份核验依据待核对",
    "出现消极服务表达",
    "结束语缺失",
    "引用禁用表达待核对",
    "静默时间偏长",
    "提醒语被误识别为索取验证码",
    "业务解释不完整",
    "身份核验存在争议",
    "重复打断客户表达",
    "业务转接不匹配",
    "未说明风险提示",
  ];
  const ruleIds = [
    "R-COM-012",
    "R-SOP-006",
    "R-SVC-009",
    "R-SVC-002",
    "R-BAN-001",
    "R-AC-003",
    "R-COM-012",
    "R-SOP-006",
    "R-SOP-006",
    "R-AC-003",
    "R-INT-001",
    "R-AL-001",
  ];
  const findings: Finding[] = names.map((title, n) => {
    const rule = rules.find((r) => r.id === ruleIds[n])!;
    return {
      id: `F-${1041 - n}`,
      rev: 0,
      callId: calls[n].id,
      title,
      indicator: rule.indicator,
      related: n === 0 ? ["6.2.3"] : [],
      ruleId: rule.id,
      ruleVersion: 1,
      batchId: calls[n].batches[0].id,
      source: "auto",
      severity: rule.severity,
      evidence: [2],
      status:
        n < 1 || [4, 5, 10, 11].includes(n)
          ? "candidate"
          : [1, 2].includes(n)
            ? "review"
            : "delivered",
      conclusions: [],
    };
  });
  const concluded = (
    n: number,
    value: Verdict,
    note: string,
    noRemedy?: string,
  ) => {
    findings[n].conclusions = [
      {
        version: 1,
        value,
        note,
        at: time(-n - 4),
        by: "S01",
        reviewer: "Q01",
        noRemedy,
      },
    ];
  };
  concluded(3, "false_positive", "客户提前挂断，结束语规则例外适用");
  concluded(6, "false_positive", "原话是提醒客户勿泄露验证码，属于否定语境");
  concluded(7, "risk", "未完整解释办理条件，需补充服务说明");
  concluded(8, "risk", "现有证据未体现完整身份核验");
  concluded(
    9,
    "risk",
    "多次打断客户表达，当通已纠正",
    "当通已道歉并完成重述，有对应片段",
  );
  findings.push({
    ...structuredClone(findings[2]),
    id: "F-1039-B",
    title: "未完整说明处理时限",
    ruleId: "R-SOP-006",
    indicator: "6.3.7",
  });
  const reviews: Review[] = [
    {
      id: "WO-1038",
      rev: 0,
      callId: calls[1].id,
      findingIds: [findings[1].id],
      type: "candidate",
      scope: "核对 IVR 核验与人工核验记录",
      owner: "Q01",
      dueAt: time(8),
      originalDueAt: time(8),
      status: "pending",
      opinions: {},
      history: [],
    },
    {
      id: "WO-1039",
      rev: 0,
      callId: calls[2].id,
      findingIds: [findings[2].id, "F-1039-B"],
      type: "candidate",
      scope: "逐项核对服务表达与业务依据",
      owner: "Q01",
      dueAt: time(12),
      originalDueAt: time(12),
      status: "supervisor",
      opinions: {
        [findings[2].id]: {
          value: "risk",
          note: "原话存在消极表达，需改进服务方式",
          evidence: [2],
        },
        "F-1039-B": {
          value: "insufficient",
          note: "通话未覆盖完整处理条件，需要补充业务依据",
          evidence: [2],
        },
      },
      history: [],
    },
    ...[3, 6, 7, 8, 9].map((n) => ({
      id: `WO-D-${n}`,
      rev: 0,
      callId: calls[n].id,
      findingIds: [findings[n].id],
      type: "candidate" as const,
      scope: "示例已完成复核",
      owner: "Q01",
      dueAt: time(-n),
      originalDueAt: time(-n),
      status: "done" as const,
      finishedAt: time(-n - 4),
      opinions: {
        [findings[n].id]: {
          value: findings[n].conclusions[0].value,
          note: findings[n].conclusions[0].note,
          evidence: [2],
        },
      },
      history: [],
    })),
  ];
  const remedies: Remedy[] = [7, 8].map((n) => ({
    id: `REC-${1041 - n}`,
    rev: 0,
    findingId: findings[n].id,
    conclusionVersion: 1,
    agentId: calls[n].agentId,
    inspector: n === 7 ? "Q01" : "Q02",
    status: "executing",
    goal: n === 7 ? "完整解释业务办理条件" : "严格执行身份核验流程",
    standard: "整改后同业务通话体现全部必要核验步骤，无跳步；说明清楚可追溯。",
    standardVersion: 1,
    sampleCount: 1,
    observation: "提交 1 通整改后同类业务样例（演示值）",
    dueAt: time(n === 7 ? 12 : -2),
    originalDueAt: time(n === 7 ? 12 : -2),
    createdAt: time(-100),
    round: 1,
    materials: [],
    acceptanceHistory: [],
    pauseHistory: [],
    standards: [
      {
        version: 1,
        goal: "改善业务服务",
        standard: "必要步骤完整可追溯",
        note: "主管下发整改",
        at: time(-100),
      },
    ],
  }));
  remedies[1].pause = {
    reasons: ["AP-1033"],
    startedAt: time(-1),
    phase: "executing",
    owner: "A1048",
    dueAt: time(-2),
    wasOverdue: true,
  };
  remedies[1].firstOverdueAt = time(-2);
  return {
    schema: 2,
    revision: 1,
    identity: "S01",
    view: "alerts",
    calls,
    findings,
    reviews,
    appeals: [
      {
        id: "AP-1033",
        rev: 0,
        findingId: findings[8].id,
        agentId: "A1048",
        conclusionVersion: 1,
        status: "submitted",
        note: "通话前已经完成 IVR 核验，请结合自动核验记录复查。",
        evidence: [1],
        dueAt: time(20),
        originalDueAt: time(20),
      },
    ],
    remedies,
    supplements: [],
    rules,
    resources: [
      {
        id: "RES-WORD",
        rev: 0,
        type: "词库",
        name: "敏感信息与禁用表达",
        versions: [
          {
            version: 1,
            content: "完整验证码\n银行卡密码\n不负责",
            scope: "全部业务",
            role: "坐席",
            exception: "客户引用、否定提醒须结合上下文",
            at: time(-168),
          },
        ],
      },
      {
        id: "RES-KNOW",
        rev: 0,
        type: "业务知识",
        name: "账户与转账服务问答",
        versions: [
          {
            version: 1,
            content:
              "客户查询转账进度时，完成安全核验后查询当前状态，并说明预计处理方式。不得承诺未经核实的结果。",
            scope: "转账汇款",
            role: "坐席",
            exception: "跨行处理时效以业务实际查询为准",
            at: time(-168),
          },
        ],
      },
      {
        id: "RES-SOP",
        rev: 0,
        type: "SOP",
        name: "银行呼入身份核验流程",
        versions: [
          {
            version: 1,
            content:
              "1. 确认客户诉求与业务范围\n2. 核对 IVR 核验是否有效\n3. 未完成时按安全流程补充核验\n4. 查询业务并说明处理结果",
            scope: "全部业务",
            role: "坐席",
            exception: "有效 IVR 核验可以复用；不得索取完整短信验证码",
            at: time(-168),
          },
        ],
      },
    ],
    logs: [
      {
        id: "EV-SEED",
        target: "F-1041",
        callId: "CALL-1041",
        at: time(-0.05),
        actor: "S01",
        action: "示例场景已载入",
        note: "自动结果仅为候选；请结合证据完成分诊。",
      },
    ],
    requests: [],
  };
}
