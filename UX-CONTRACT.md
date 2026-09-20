# Moss Quality UX Contract

## Business sources and scope

权威业务来源：docs/reviews/PRD-银行语音质检-MVP-P0.md 第 7–9 节；版本、权限、状态、幂等由 lib/workflow.ts 承载。当前为浏览器内高保真原型，未接入真实模型、银行系统或服务端身份权限。此次 UI 迭代不改变业务状态机、权限、财务、隐私或规则结构。无支付流程。

视觉与 token 所有者见 DESIGN.md。zh-CN，Asia/Shanghai；示例日期保留既有定义，日期范围以 YYYY-MM-DD 表达。

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | 原生 select | PRD / 本契约 | 接受系统弹层几何和键盘行为 | 浏览器打开与键盘检查 |
| Date | 原生 date / datetime-local | PRD / 本契约 | 接受系统日历；标签与校验中文 | 范围错误检查 |
| Form | ActionForm / RuleEditor | workflow 校验 + 本契约 | 业务动作弹窗 / 规则就地编辑 | 校验、取消、冲突、保存 |
| Scrollbar | app/workspace-system.css | DESIGN.md | 全局主题；策略列表稳定 gutter | 宽窄屏、滚动检查 |
| Toast | Home 单一 live region | 本契约 | 操作回执；错误仍保留表单中 | 保存与失败反馈 |
| CRUD | Home go/open + workflow apply | PRD 第 7–9 节 | 就地草稿 / 新资源定位 / 版本化发布 | 业务回归测试 |
| Search | components/ui.tsx SearchField | 本契约 | 本地即时筛选 | 清除、IME、无结果 |
| Tabs | components/ui.tsx Tabs | 本契约 | 主分类 / 详情 / 报表 / 通知 | 方向键、Home/End、焦点 |
| Dialog | components/ui.tsx Modal | 本契约 | default / notification / navigation / evidence | Escape、焦点恢复、inert |
| Table Selection | Workspace 单条上下文选择 | PRD 第 7.1 节 | 无批量选择；保留原型单条浏览 | aria-pressed、选中与详情一致 |

## Dataset navigation and search

作业与通话列表沿用 5/10/20 分页，筛选重置页码，当前页越界自动夹紧。规则目录固定 10 项、资源示例量小，桌面使用有界滚动目录，移动端自然滚动。

查询状态遵循现有 Activity 页面缓存：同身份跨页面返回保留分类、筛选、页码；当前 view/id 在 URL，搜索与其他筛选仅存本次页面内存。当前原型搜索可含坐席名及通话内容，不写 URL，不新增持久化或分享范围；刷新恢复业务状态但筛选回默认。这是敏感、非分享型搜索的明确例外，不声称支持分享筛选链接。

本地搜索实时提交，不需远程 debounce；中文输入组合期间不筛选，结束后提交。清除 X 或 Escape 立即清空，仅清除搜索词，返回输入框焦点。无结果保留筛选和页签，规则目录提供重置筛选动作。

## Interaction and recovery

| 操作 | 触发 / 成功 | 失败与恢复 | 来源 |
| --- | --- | --- | --- |
| 查看事项 | 队列选择 → 详情；移动端返回列表 | 空队列保留分类入口 | PRD 7.1 |
| 编辑规则 | 保存草稿 → 留在本规则，显示待发布 | 越界/缺原因就地报错、聚焦字段、保留输入 | PRD 7.12 / D05 |
| 检查/发布 | 展示检查与影响 → 确认发布 → 新版本 | rev 冲突拒绝旧提交；历史快照不变 | workflow apply |
| 业务动作 | 当前可用动作 → 上下文表单 → 同步任务与待办 | 校验失败保留表单，防重复提交 | PRD 7.2–7.11 |
| 通知 | 打开具体对象；已读只改变事件已读状态 | 空通知保留页签；Escape 关闭并恢复焦点 | PRD 7.15 |
| 音频 | 原生播放器或时间码定位 | 加载/播放错误明确提示，重新加载；转写仍可读 | PRD 7.7 |

弹窗统一 native dialog/showModal：背景 inert、圈定焦点、Escape 和明确关闭按钮、关闭后恢复触发者。通知浮层和移动导航为同一 Modal 的业务变体。重置演示数据属于最终危险动作，在现有确认弹窗内明确后果、取消在前；不增加无关审批。

所有产品 form 使用 noValidate，校验由应用和业务层执行。textarea 禁止拖拽，以充分高度和 field-sizing:content 扩展。仅在浏览器实际卸载时允许 beforeunload；规则编辑跨页仍使用既有阻止导航并提示保存/取消的上下文保护。

各 route 同步 document.title 为“页面名 · Moss Quality”。默认 hydration 显示真实恢复进度说明。音频提供加载错误；没有远程数据请求，不伪造离线同步或后台加载进度。未来接入服务器需要补请求取消、超时重试、服务端权限、并发与安全存储。

## Case and policy presentation variants

- 申诉、整改的队列与详情标题使用关联问题名称；申诉理由、整改目标、标准与材料完整保留在正文，不改写已存数据。
- 当前责任从 workflow.currentOwner 读取；阶段与可用动作沿用 stateLabel / actions。等待他人不提示当前用户执行对方的动作；质检员在关联申诉中可以直接打开自己负责的核查工单。最近处理仅展示本案已发生日志，全量记录仍由原处理记录页签承载。
- 期限使用示例业务时间，暂停显示暂停状态而不继续计算剩余期限；保留首次逾期事实。这些期限不宣称为客户 SLA。
- ResourceContent 与 VersionHistory 为策略页面共用呈现组件。词库和 SOP 从已存换行文本生成行与步骤；知识未提供独立问答字段时显示原主题与标准口径，不虚构问题或依据。
- 版本摘要由相邻已发布快照的字段差异生成。点击版本记录后把焦点与阅读位置移至详情标题；原生版本选择器和历史只读约束保持一致。草稿独立显示，不计入已发布版本。
- 资源“引用与影响”明确展示当前规则引用的资源版本；浏览历史资源时明确当前引用关系与历史案件快照的区别。

## Consistency and content layout

全部七个页面共享 Button、SearchField、Tabs、Modal、Pagination 和 runtime tokens。业务页允许改变列数、信息顺序与密度，禁止单独定义另一套选中、焦点、危险或成功语义。报表保留独立图表布局，页签、表格、控件和颜色沿用公共语言。

详情关联页签计数包含同通话其他问题及关联处理记录，仅在有内容时显示对应标题；没有可查看关联对象时显示说明，不提示不存在的筛选操作。风险、工单和申诉整改共用 case-shell；案件与责任栏顶部对齐，案件内部切换办理概览、处理记录和关联事项，不影响责任与操作位置。

## Verification ownership

pnpm typecheck、pnpm lint、pnpm test:workflow、pnpm verify:mvp、pnpm build；Premium 静态审计报告 premium-audit.json。浏览器检查记录在 docs/reviews/UI生产体验优化-20260913.md。静态审核不替代运行时行为验证。

本轮全页视觉与响应式检查见 docs/reviews/七页设计语言统一与布局修复-20260913.md。

## Desktop operation contract

- 案件的摘要与完整材料分层；长转写和录音不直接铺满默认页面。证据 Modal 复用 Evidence，保留原音定位、判断依据版本、历史快照与音频失败恢复。原结论不存在时明确缺失，不用最新版本冒充。
- 案件材料 Modal 保留整改目标、完成标准、轮次、材料、样例、验收意见、补件和复核范围。材料中的跨对象操作先关闭预览再打开目标；不叠加两个操作弹窗。
- 显示的所有案件动作仍由 workflow.actions 与 primaryAction 决定。暂停状态不增加正式验收或结案动作；质检员核查入口和补件责任流不变。
- 通话更多筛选支持 aria-expanded；收起不会清空条件，活动条件标签常显。标签移除与重置都回第一页并清除旧详情选择。
- 趋势 callout 随鼠标或键盘焦点定位，Escape 隐藏，屏幕边缘自动限制在图表内；数据点仍通过 Enter/点击下钻，悬停不触发下钻。零分母不变成 0%。环图与条形图补类别和数量反馈，图例保留键盘下钻。
- 规则 info 入口打开原有完整指标说明，关闭恢复入口焦点。参数继续就地展开，不新增编辑弹窗。

本轮桌面操作验收见 docs/reviews/桌面作业交互重构-20260913.md。
