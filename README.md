# 银行语音质检 MVP-P0

三个核心角色、七个业务模块的银行呼入客服质检高保真原型。延续灰白界面、橙色点缀与黑色主按钮，使用合成音频、预设检测和浏览器内状态。

- 本地演示：http://localhost:6001
- 飞书 PRD：https://acnc6zeentra.feishu.cn/docx/JJiCdLFFbotAvgxXr7rcsdmDnwe
- 私有仓库：https://github.com/h-pl/bank-voice-qc-mvp-p0
- 核心文档：[docs/reviews](docs/reviews/README.md)

```bash
pnpm install --frozen-lockfile
pnpm dev
```

生产演示：`pnpm build` 后 `pnpm start`，均使用端口 6001。Node.js 22–26，pnpm 11.19.0；本轮在 Node 26.8.1 下构建与验证。

```bash
pnpm typecheck
pnpm lint
pnpm test:workflow
pnpm verify:mvp
```

演示身份：何晴（主管）、赵宁 / 林悦（质检员）、周敏 / 陈佳（坐席）。左下角可重置样例；刷新与角色切换保留进度。此角色切换用于原型演示，未接入真实认证、模型或银行系统。

基线 `v0.0.0-draft`；当前交付 `v0.2.4-mvp-p0`；分支 `codex/unified-experience-6001`（保留此前所有标签）。原项目目录保持独立。

当前节点：页面减法、角色导航与申诉整改队列迭代，详见 [本轮验收](docs/reviews/UI减法迭代与验收-v0.2.4.md)。七模块统一页头，删除重复统计卡，申诉整改改为一层状态页签与类型筛选，共用导航顺序固定。

| 版本 | 模块 → 页面 | 主要变化 |
| --- | --- | --- |
| v0.2.4-mvp-p0 | 七模块界面、角色导航与申诉整改 | 单一页名、筛选口径、单层队列、当前责任与动作 |
| v0.2.3-mvp-p0 | 分析 → 质量报表 → 四个视图 | 摘要趋势联动、状态环图、问题条形图、坐席矩阵、日期钻取与 CSV |
| v0.2.2-mvp-p0 | 质检作业 → 质检工单、申诉与整改 | 提醒队列、补证交接、草稿恢复、终止补件 |
| v0.2.1-mvp-p0 | 策略与资源 → 规则/资源；质检作业 → 通话记录 | 参数就地编辑、独立详情、筛选与翻页 |
| v0.2.0-mvp-p0 | 七模块核心闭环 | 逐问题处置、补证、申诉及整改回流 |


## 6001 对比迭代

基于当前 5001 含未提交 UI 的完整快照（693d6a2）继续迭代，独立 worktree 为 `质检-ui-6001`。5001 保留当前 MVP，5002 为 MVP 前最后版本 v4.11.0-private.1（92ae9aa）。新分支未推送 GitHub。

- [需求、逻辑与架构比较](docs/reviews/新版与旧版-需求逻辑架构及方案汇总-20260920.md)
- [UI 交互比较](docs/reviews/新版与旧版-UI交互对比与采纳方案-20260920.md)
- [6001 实施与验收](docs/reviews/6001迭代实施与验收-20260920.md)

当前本机启动使用 `node node_modules/next/dist/bin/next start -p 6001 --hostname 127.0.0.1`。开发和生产脚本默认端口均为 6001；当前 worktree 的 node_modules 复用已安装依赖，分支自身不跟踪该链接。
