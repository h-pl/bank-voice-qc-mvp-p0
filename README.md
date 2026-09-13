# 银行语音质检 MVP-P0

三个核心角色、七个业务模块的银行呼入客服质检高保真原型。延续灰白界面、橙色点缀与黑色主按钮，使用合成音频、预设检测和浏览器内状态。

- 本地演示：http://localhost:5001
- 飞书 PRD：https://acnc6zeentra.feishu.cn/docx/JJiCdLFFbotAvgxXr7rcsdmDnwe
- 私有仓库：https://github.com/h-pl/bank-voice-qc-mvp-p0
- 核心文档：[docs/reviews](docs/reviews/README.md)

```bash
pnpm install --frozen-lockfile
pnpm dev
```

生产演示：`pnpm build` 后 `pnpm start`，均使用端口 5001。Node.js 22–26，pnpm 11.19.0；本轮在 Node 26.8.1 下构建与验证。

```bash
pnpm typecheck
pnpm lint
pnpm test:workflow
pnpm verify:mvp
```

演示身份：何晴（主管）、赵宁 / 林悦（质检员）、周敏 / 陈佳（坐席）。左下角可重置样例；刷新与角色切换保留进度。此角色切换用于原型演示，未接入真实认证、模型或银行系统。

基线 `v0.0.0-draft`；当前交付 `v0.2.0-mvp-p0`；分支 `codex/mvp-p0-v0.2.0`（保留 v0.1.0）。原项目目录保持独立。
