---
version: alpha
colors:
  primary: '#20252b'
  canvas: '#f3f5f7'
  surface: '#ffffff'
  ink: '#20252b'
  muted: '#626b76'
  line: '#e1e5e9'
  accent: '#f47b34'
  accentInk: '#a64719'
  accentSoft: '#fff3e9'
  success: '#187349'
  danger: '#b52b38'
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif'
    fontSize: '14px'
    lineHeight: '1.6'
  heading:
    fontFamily: 'Avenir Next, PingFang SC, Microsoft YaHei, sans-serif'
  data:
    fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, monospace'
rounded:
  control: '7px'
  panel: '12px'
spacing:
  controlGap: '12px'
  panelGap: '20px'
  section: '24px'
---

# Moss Quality · 银行质检作业台

## Overview

为质检主管、质检员、客服坐席设计的中文桌面工作台。依据 docs/reviews/PRD-银行语音质检-MVP-P0.md，维持三个角色、七个业务模块和灰白橙黑身份。页面单一标题在顶栏，所有常用筛选与可执行动作常显。

使用原有灰白橙黑配色：黑色主动作、橙色导航与选中定位。参考 Moss API 企业控制台的筛选与就近反馈、3008 的案件分层，而不照搬整页或切换为黑白主题。优先让操作者定位案件、核对摘要、预览材料并执行下一步；辅助说明通过信息入口按需阅读，不占用主要操作位。

## Colors

运行时 token 为唯一值所有者（Model B）：app/workspace-system.css 的 :root → 全局共享组件 → 各业务页面。本文件镜像已接受值；app/globals.css 保留业务布局历史基线，共享系统由 workspace-system.css 最后统一。

黑色用于主动作；橙色点缀不承担正文对比度，正文强调使用 accentInk。成功/危险状态必须同时显示文字。浅灰画布与白色内容区保持对比，风险证据采用 accentSoft。只支持浅色主题；不凭空增加深色模式。

## Typography

正文及证据采用系统中文字体，14px 正文，13px 控件，12px 次要说明；标题用 Avenir Next / PingFang SC，17px 顶栏、21px 事项标题、21px 规则与资源标题、15px 分区标题。编号与时间使用等宽字，数字使用等宽数字。无需远程字体加载，不发生字体切换抖动。

## Layout

以桌面操作效率为中心。左导航与 68px 顶栏保留；风险、工单、申诉整改与通话详情共用 CaseShell、CaseResponsibility 和下一步操作结构。常用筛选、分类和分页保持在工作区边界，队列、案件内容和责任栏各自滚动，禁止长证据撑高整页。案件与责任栏顶部对齐，主动作在辅助说明和历史之前。次动作两列紧凑排列，不隐藏在“更多”菜单。

案件首屏包括摘要、状态、责任、证据与材料入口；完整录音、转写、规则快照和长材料进入 1060px 上限的预览 Modal。预览关闭后恢复原位置和触发者焦点。案件原结论、申诉理由、整改标准、复核意见与阶段差异真实保留。

规则保留目录与详情，参数在当前值处就地展开编辑；保存或取消后收起，切换规则仍保护未保存输入。指标目录作为 info 辅助入口放在规则指标信息旁。资源按内容、引用、版本阅读。规则与资源目录、正文在桌面独立滚动，标题保持可见。

通话筛选采用关键词、业务与筛选展开入口；收起后所有已生效条件持续显示，可单独移除或全部重置。报表保留分析布局，趋势点附近显示日期、指标值和样本口径，环图与条形图显示类别、数量与占比；点选进入实际明细。

## Elevation & Depth

白色面板用细边框分层，不使用常态投影；强阴影仅用于弹窗。禁止为每个字段单独加卡片。选中态使用背景、定位线和 aria 状态共同表达。

## Shapes

控制圆角 7px，面板 12px，状态标签 5px。图标沿用 components/icon.tsx 的线性 SVG。按钮按下改变背景，不缩放、不移动。

## Components

| 文档语义 | 运行时 token | 消费者 |
| --- | --- | --- |
| canvas / surface / ink / muted / line | --canvas / --surface / --ink / --muted / --line | 页面骨架、文字、面板 |
| accent / accentInk / accentSoft | --orange / --accent-ink / --accent-soft | 证据、业务链接、图表 |
| selection | --selection-bg / --selection-border | 导航、队列、版本选中、共享页签 |
| geometry | --control-height / --section-padding / --section-title-size | 控件高度、分区内边距、分区标题 |
| success / danger | --green / --red | Badge、危险按钮、字段错误 |
| body / heading / data | --font-body / --font-heading / --font-data | 正文、标题、编号与时间 |
| control / panel | --radius-control / --radius-panel | Button、SearchField、面板、Modal |
| scrollbar | --scrollbar-thumb / --scrollbar-track / --scrollbar-hover / --scrollbar-active | 所有应用滚动区域 |

共同组件与交互见 UX-CONTRACT.md。SearchField 保留清除按钮空间；Tabs 在焦点与选中间区分；Modal 使用原生 dialog 的焦点与 inert 行为。仅 Toast 淡入，reduced-motion 禁止动画；强制色模式保留系统滚动条与选中轮廓。

## Do's and Don'ts

- 保留三角色权限、版本快照和真实样例状态，不为视觉演示制造经营数字。
- 不将未播放录音的首句话标为正在播放；无法播放必须给出恢复入口。
- 规则结构固定时，用一条说明代替空的参数配置区，保留资源调整路径。
- 正文不使用低对比度浅灰；键盘焦点必须可见；高频按钮不放进“更多”。

## Reconcile drift

| 基线偏差 | 本轮处理 |
| --- | --- |
| 规则与业务搜索各自实现且无清除 | 统一 SearchField，保留 IME 组合输入 |
| 作业/详情/通知页签不一致 | 统一 Tabs，与原报表键盘模式对齐 |
| 待办与移动导航没有模态焦点隔离 | 复用 Modal 的 notification / navigation 变体 |
| scrollbar 未定义、旧 textarea 可拖动 | 全局 token 基线、自动增高且有界的 textarea |
| 页面标题一直相同 | 导航同步 document.title |

## Cross-page interaction system · 2026-09-13

统一的是任务的定位、核对、操作和反馈方式。作业页共用桌面工作区，规则和资源共用目录阅读方式，报表保留分析模式；不以响应式或简单颜色替换作为本轮重点。

UI 公共组件承载焦点、禁用、忙碌和状态表达，业务分区承担不同任务。案件固定工作区消费浏览器可用高度，内部滚动容器都可通过键盘聚焦后滚动；短内容不强行垂直均分。长内容由预览和明确的完整材料入口承载，摘要截断不丢弃原文。
