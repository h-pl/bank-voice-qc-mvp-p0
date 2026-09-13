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

视觉签名是贯穿导航、当前事项与命中证据的橙色定位线，帮助在“队列—证据—处理”间保持上下文。它表示当前位置或证据，不表示已确认违规。禁止营销式巨幅标题、无依据统计卡、装饰渐变和隐藏高频操作。

## Colors

运行时 token 为唯一值所有者（Model B）：app/workspace-system.css 的 :root → 全局共享组件 → 各业务页面。本文件镜像已接受值；app/globals.css 保留业务布局历史基线，共享系统由 workspace-system.css 最后统一。

黑色用于主动作；橙色点缀不承担正文对比度，正文强调使用 accentInk。成功/危险状态必须同时显示文字。浅灰画布与白色内容区保持对比，风险证据采用 accentSoft。只支持浅色主题；不凭空增加深色模式。

## Typography

正文及证据采用系统中文字体，14px 正文，13px 控件，12px 次要说明；标题用 Avenir Next / PingFang SC，17px 顶栏、21px 事项标题、25px 规则标题。编号与时间使用等宽字，数字使用等宽数字。无需远程字体加载，不发生字体切换抖动。

## Layout

桌面保持现有固定左导航，顶栏 68px。业务队列、证据正文、处理区分别承担定位、判断、执行；规则使用列表与详情双栏。主文档自然滚动，策略列表在桌面独立滚动，移动端恢复自然高度。850px 以下使用列表与详情切换，600px 以下用原生模态导航抽屉；表格局部横向滚动。

## Elevation & Depth

白色面板用细边框和极轻阴影分层；强阴影仅用于弹窗。禁止为每个字段单独加卡片。选中态使用背景、定位线和 aria 状态共同表达。

## Shapes

控制圆角 7px，面板 12px，状态标签 5px。图标沿用 components/icon.tsx 的线性 SVG。按钮按下改变背景，不缩放、不移动。

## Components

| 文档语义 | 运行时 token | 消费者 |
| --- | --- | --- |
| canvas / surface / ink / muted / line | --canvas / --surface / --ink / --muted / --line | 页面骨架、文字、面板 |
| accent / accentInk / accentSoft | --orange / --accent-ink / --accent-soft | 导航、队列、Tabs、证据 |
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
