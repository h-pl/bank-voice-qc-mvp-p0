"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon, type IconName } from "../components/icon";
import { Badge, Button, Empty, Modal } from "../components/ui";
import { ActionForm } from "../components/action-form";
import { Workspace, label, stateLabel, viewFor } from "../components/workspace";
import { Strategy } from "../components/strategy";
import { ReportPage } from "../components/report-page";
import {
  getSnapshot,
  getServerSnapshot,
  subscribe,
  updateState,
  resetState,
} from "../lib/store";
import {
  apply,
  entity,
  canSee,
  nav,
  notices,
  people,
  person,
  roleNames,
  roleOf,
  type Command,
  type View,
} from "../lib/workflow";
const pages: Record<
  View,
  { title: string; icon: IconName; description: string; group: string }
> = {
  alerts: {
    title: "风险预警",
    icon: "bell",
    description: "从自动候选到人工判断，优先处理真正需要关注的风险。",
    group: "质检作业",
  },
  workorders: {
    title: "质检工单",
    icon: "package",
    description: "围绕证据逐项核查，让每个结论都有依据。",
    group: "质检作业",
  },
  improvement: {
    title: "申诉与整改",
    icon: "shield",
    description: "回应结论争议，跟进整改效果，完成质量改进闭环。",
    group: "质检作业",
  },
  calls: {
    title: "通话记录",
    icon: "headset",
    description: "查询通话、回听原音，追溯检测结果与后续处理。",
    group: "质检作业",
  },
  rules: {
    title: "质检规则",
    icon: "sliders",
    description: "核对判断口径，维护开放参数与规则引用版本。",
    group: "策略与资源",
  },
  resources: {
    title: "业务资源",
    icon: "database",
    description: "维护词库、业务知识与 SOP，为人工判断提供统一依据。",
    group: "策略与资源",
  },
  reports: {
    title: "质量报表",
    icon: "chart",
    description: "从通话、问题与改进结果，了解当前服务质量。",
    group: "分析",
  },
};
const subscribeReady = () => () => {};
export default function Home() {
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
    role = roleOf(state),
    personNow = person(state.identity),
    allowedNav = nav[role];
  const [mobile, setMobile] = useState(false),
    [noticeOpen, setNoticeOpen] = useState(false),
    [noticeTab, setNoticeTab] = useState("todo"),
    [resetOpen, setResetOpen] = useState(false),
    [toast, setToast] = useState(""),
    [focus, setFocus] = useState<string>(),
    [form, setForm] = useState<{ id: string; action: string }>();
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const go = (view: View, id?: string) => {
    const s = getSnapshot();
    if (!nav[roleOf(s)].includes(view) || (id && !canSee(s, id))) {
      setToast("该记录不在当前身份授权范围内");
      return;
    }
    history.replaceState({...history.state,qc:true,identity:s.identity,scrollY:window.scrollY}, "", location.href);
    updateState({ ...s, view });
    setFocus(id);
    setMobile(false);
    setNoticeOpen(false);
    window.history.pushState(
      {qc:true,identity:s.identity,scrollY:0},
      "",
      `?view=${view}${id ? `&id=${encodeURIComponent(id)}` : ""}`,
    );
  };
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      id = params.get("id");
    if (id && canSee(getSnapshot(), id)) {
      queueMicrotask(() => setFocus(id));
    }
    const pop = () => {
      const p = new URLSearchParams(location.search),
        s = getSnapshot(),
        view = p.get("view") as View;
      const valid = nav[roleOf(s)].includes(view) ? view : nav[roleOf(s)][0];
      updateState({ ...s, view: valid });
      setFocus(
        p.get("id") && canSee(s, p.get("id")!) ? p.get("id")! : undefined,
      );
      requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo(0,history.state?.scrollY ?? 0)));
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const open = (id: string) => {
    if (!id) {
      setFocus(undefined);
      history.replaceState(null, "", `?view=${state.view}`);
      return;
    }
    const item=entity(state,id);
    const target=item && "executor" in item ? item.target : id;
    go(item && ("batches" in item || "versions" in item) ? viewFor(state,target) : state.view, target);
  };
  const changeIdentity = (identity: string) => {
    const s = getSnapshot(),
      view = nav[person(identity).role][0];
    updateState({ ...s, identity, view });
    setForm(undefined);
    setFocus(undefined);
    setNoticeOpen(false);
    history.replaceState(null, "", `?view=${view}`);
  };
  const submit = (command: Command) => {
    const result = apply(getSnapshot(), command);
    const saved = updateState(result);
    setToast(
      saved
        ? "已保存，相关事项与待办已同步"
        : "本次已更新，但浏览器存储不可用，刷新可能恢复示例",
    );
  };
  const handleAction = (id:string, action:string) => {
    if(["ack","read_reminder","accept_remedy"].includes(action)) {
      try {submit({id,action,rev:entity(getSnapshot(),id)!.rev,requestId:crypto.randomUUID(),input:{}});} catch(e) {setToast(e instanceof Error ? e.message : "操作失败");}
    } else setForm({id,action});
  };
  const tasks = notices(state),
    current = pages[state.view],
    events = state.logs
      .filter((l) => canSee(state, l.target))
      .slice()
      .reverse(),
    readEvents = state.readEvents?.[state.identity] ?? [];
  const readEvent = (id: string) => {
    const s = getSnapshot();
    updateState({
      ...s,
      readEvents: {
        ...s.readEvents,
        [s.identity]: [...new Set([...(s.readEvents?.[s.identity] ?? []), id])],
      },
    });
  };
  if (!ready)
    return (
      <div className="loading-state" role="status">
        <span className="brand-mark">
          <Icon name="headset" />
        </span>
        <b>Moss Quality</b>
        <p>正在恢复当前身份与演示进度…</p>
      </div>
    );
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="关闭导航"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <Icon name="headset" size={23} />
          </span>
          <div>
            <b>Moss Quality</b>
            <small>银行呼入客服质检</small>
          </div>
        </div>
        <div className="project">
          <span className="project-icon">银</span>
          <div>
            <b>银行客服中心</b>
            <small>客户生产台</small>
          </div>
          <Badge>P0</Badge>
        </div>
        <nav aria-label="主导航">
          {["质检作业", "策略与资源", "分析"].map(
            (group) =>
              allowedNav.some((v) => pages[v].group === group) && (
                <div key={group}>
                  <p className="nav-label">{group}</p>
                  {allowedNav
                    .filter((v) => pages[v].group === group)
                    .map((v) => (
                      <button
                        key={v}
                        className={state.view === v ? "active" : ""}
                        onClick={() => go(v)}
                        aria-current={state.view === v ? "page" : undefined}
                      >
                        <Icon name={pages[v].icon} />
                        <span>{pages[v].title}</span>
                        {["alerts", "workorders", "improvement"].includes(v) &&
                          tasks.filter((x) => viewFor(state, x.id) === v)
                            .length > 0 && (
                            <em>
                              {
                                tasks.filter((x) => viewFor(state, x.id) === v)
                                  .length
                              }
                            </em>
                          )}
                      </button>
                    ))}
                </div>
              ),
          )}
        </nav>
        <div className="sidebar-note">
          <span className="mini-label">MVP · P0</span>
          <b>让每个结论都有依据</b>
          <p>
            发现风险 → 人工复核
            <br />
            申诉反馈 → 整改验收
          </p>
        </div>
        <div className="sidebar-bottom">
          <span className="avatar">{personNow.name.slice(-1)}</span>
          <div>
            <b>{personNow.name}</b>
            <small>{roleNames[role]}</small>
          </div>
          <button
            className="icon-button"
            aria-label="重置演示数据"
            onClick={() => setResetOpen(true)}
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="打开导航"
              onClick={() => setMobile(true)}
            >
              <Icon name="menu" />
            </button>
            <span>客户生产台</span>
            <Icon name="chevron" size={13} />
            <b>{current.title}</b>
          </div>
          <div className="top-actions">
            <span className="demo-badge">高保真原型 · 示例数据</span>
            <label className="role-select">
              <span>演示身份</span>
              <select
                aria-label="演示身份"
                value={state.identity}
                onChange={(e) => changeIdentity(e.target.value)}
              >
                {people.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name} · {roleNames[p.role]}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="notification-button"
              aria-label={`我的待办 ${tasks.length}`}
              onClick={() => setNoticeOpen(!noticeOpen)}
            >
              <Icon name="bell" />
              {tasks.length > 0 && <span>{tasks.length}</span>}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">BANKING QUALITY · MVP-P0</p>
              <h1>{current.title}</h1>
              <p>{current.description}</p>
            </div>
            <div className="heading-meta">
              <span className="online-dot" />
              当前：{roleNames[role]}
            </div>
          </div>
          {focus && <div className="context-back"><Button onClick={()=>{if(history.state?.qc)history.back();else open("");}}>返回上一位置</Button><span>查看关联事项，原队列条件保留</span></div>}
          {allowedNav.map((v) => (
            <div key={`${state.identity}-${v}`} hidden={state.view !== v}>
              {["alerts", "workorders", "improvement", "calls"].includes(v) ? (
                <Workspace
                  state={state}
                  view={v}
                  focus={state.view === v ? focus : undefined}
                  onOpen={open}
                  onAction={handleAction}
                />
              ) : v === "rules" || v === "resources" ? (
                <Strategy
                  state={state}
                  view={v}
                  focus={state.view === v ? focus : undefined}
                  onAction={handleAction}
                />
              ) : (
                <ReportPage state={state} onOpen={open} />
              )}
            </div>
          ))}
          <footer className="page-footer">
            <span>Moss Quality · 核心质检闭环</span>
            <span>3 个核心角色 · 7 个业务模块 · v0.2.0</span>
          </footer>
        </main>
      </div>
      {noticeOpen && (
        <>
          <button
            className="notice-backdrop"
            aria-label="关闭待办浮层"
            onClick={() => setNoticeOpen(false)}
          />
          <div className="notification-panel">
            <header>
              <div>
                <b>我的待办</b>
                <small>{tasks.length} 项等待你处理</small>
              </div>
              <button
                className="icon-button"
                aria-label="关闭待办"
                onClick={() => setNoticeOpen(false)}
              >
                <Icon name="close" />
              </button>
            </header>
            <div className="tabs">
              <button
                className={noticeTab === "todo" ? "active" : ""}
                onClick={() => setNoticeTab("todo")}
              >
                我的待办
              </button>
              <button
                className={noticeTab === "events" ? "active" : ""}
                onClick={() => setNoticeTab("events")}
              >
                事件通知{" "}
                {events.filter((e) => !readEvents.includes(e.id)).length}
              </button>
            </div>
            {noticeTab === "events" ? (
              events.length ? (
                events.map((e) => (
                  <div className="event-notice" key={e.id}>
                    <button
                      className="notice"
                      onClick={() => {
                        readEvent(e.id);
                        const target=entity(state,e.target);
                        const id=target && "executor" in target ? target.target : e.target;
                        go(viewFor(state,id),id);
                      }}
                    >
                      <span
                        className={
                          readEvents.includes(e.id)
                            ? "notice-read"
                            : "notice-dot"
                        }
                      />
                      <div>
                        <b>{e.action}</b>
                        <p>{e.note}</p>
                        <small>
                          {new Date(e.at).toLocaleString("zh-CN")} · {e.target}
                        </small>
                      </div>
                    </button>
                    {!readEvents.includes(e.id) && (
                      <button
                        className="event-read text-button"
                        onClick={() => readEvent(e.id)}
                      >
                        标记已读
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <Empty text="暂无事件通知" />
              )
            ) : tasks.length ? (
              tasks.map((x) => (
                <button
                  className="notice"
                  key={x.id}
                  onClick={() => go(viewFor(state,x.id),x.id)}
                >
                  <span className="notice-dot" />
                  <div>
                    <b>{label(x)}</b>
                    <p>
                      {x.id} · {stateLabel(x)}
                    </p>
                  </div>
                  <Icon name="chevron" size={15} />
                </button>
              ))
            ) : (
              <Empty
                text="当前没有待办"
                hint="角色交接后的新任务会出现在这里。"
              />
            )}
          </div>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}
      {form && (
        <ActionForm
          key={`${form.id}-${form.action}`}
          state={state}
          id={form.id}
          action={form.action}
          onClose={() => setForm(undefined)}
          onSubmit={submit}
        />
      )}
      {resetOpen && (
        <Modal title="恢复标准演示数据" onClose={() => setResetOpen(false)}>
          <p className="modal-copy">
            将清除本浏览器中的本轮演示进度，并按当前时间恢复标准示例。此操作可用于重新演示完整流程。
          </p>
          <div className="modal-actions">
            <Button onClick={() => setResetOpen(false)}>取消</Button>
            <Button
              primary
              onClick={() => {
                resetState();
                setFocus(undefined);
                setResetOpen(false);
                setToast("已恢复标准演示数据");
              }}
            >
              确认重置
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
