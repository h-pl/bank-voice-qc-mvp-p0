"use client";
import { Activity, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon, type IconName } from "../components/icon";
import { Button, Empty, Modal, Tabs } from "../components/ui";
import dynamic from "next/dynamic";
import { allowNavigation } from "../components/rule-editor";
const ActionForm = dynamic(() => import("../components/action-form").then(m => m.ActionForm));
import { Workspace, label, stateLabel, viewFor } from "../components/workspace";
import { Workbench } from "../components/workbench";
import { ResourceCatalog } from "../components/resource-catalog";
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
  actionNames,
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
  { title: string; icon: IconName; group: string }
> = {
  overview: {title:"工作台",icon:"grid",group:"工作区"},
  alerts: {
    title: "风险预警",
    icon: "bell",
    group: "质检作业",
  },
  workorders: {
    title: "复核工单",
    icon: "package",
    group: "质检作业",
  },
  improvement: {
    title: "申诉与整改",
    icon: "shield",
    group: "质检作业",
  },
  calls: {
    title: "通话记录",
    icon: "headset",
    group: "质检作业",
  },
  rules: {
    title: "质检规则",
    icon: "sliders",
    group: "策略与资源",
  },
  resources: {
    title: "业务资源",
    icon: "database",
    group: "策略与资源",
  },
  reports: {
    title: "质量报表",
    icon: "chart",
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
    allowedNav = nav[role];
  const routeRef = useRef("");
  const [visited, setVisited] = useState<Set<View>>(() => new Set());
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
    if (!allowNavigation()) return;
    const s = getSnapshot();
    if (!nav[roleOf(s)].includes(view) || (id && !canSee(s, id))) {
      setToast("该记录不在当前身份授权范围内");
      return;
    }
    history.replaceState({...history.state,qc:true,identity:s.identity,scrollY:window.scrollY}, "", location.href);
    updateState({ ...s, view });
    setVisited(prev => new Set([...prev, s.view, view]));
    setFocus(id);
    setMobile(false);
    setNoticeOpen(false);
    if (view !== s.view || view === "calls" && id) requestAnimationFrame(() => window.scrollTo(0, 0));
    window.history.pushState(
      {qc:true,identity:s.identity,scrollY:0,fromView:s.view},
      "",
      `?view=${view}${id ? `&id=${encodeURIComponent(id)}` : ""}`,
    );
    routeRef.current = location.href;
  };
  useEffect(() => {
    routeRef.current = location.href;
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
      if (!allowNavigation()) { history.pushState(history.state, "", routeRef.current); return; }
      routeRef.current = location.href;
      setVisited(prev => new Set([...prev, valid]));
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
      if (!allowNavigation()) return;
      setFocus(undefined);
      history.replaceState(null, "", `?view=${state.view}`);
      routeRef.current = location.href;
      return;
    }
    const item=entity(state,id);
    const target=item && "executor" in item ? item.target : id;
    go(viewFor(state,target), target);
  };
  const changeIdentity = (identity: string) => {
    if (!allowNavigation()) return;
    const s = getSnapshot(),
      view = nav[person(identity).role][0];
    updateState({ ...s, identity, view });
    setVisited(new Set([view]));
    setForm(undefined);
    setFocus(undefined);
    setNoticeOpen(false);
    history.replaceState(null, "", `?view=${view}`);
    routeRef.current = location.href;
  };
  const submit = (command: Command) => {
    const before = getSnapshot();
    const result = apply(before, command);
    const saved = updateState(result);
    if (command.action === "create_resource") {
      const created = result.resources.find(resource => !before.resources.some(old => old.id === resource.id));
      if (created) go("resources", created.id);
    }
    setToast(
      saved
        ? `${({save_rule:"参数草稿已保存，当前生效版本未改变",check_rule:"草稿检查已完成",publish_rule:"新规则版本已生效",save_resource:"资源草稿已保存",publish_resource:"资源版本已发布，规则引用保持不变",switch_resource:"所选规则引用已切换，历史检测保持原版本"} as Record<string,string>)[command.action] ?? `${actionNames[command.action] ?? "操作"}已完成`}`
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
  useEffect(() => {
    const pointer = () => { document.documentElement.dataset.input = "pointer"; };
    const keyboard = () => { document.documentElement.dataset.input = "keyboard"; };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    return () => { document.removeEventListener("pointerdown", pointer, true); document.removeEventListener("keydown", keyboard, true); };
  }, []);
  useEffect(() => { document.title = ready ? `${pages[state.view].title} · Moss Quality` : "正在恢复工作区 · Moss Quality"; }, [ready, state.view]);
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
  const navigation = (
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="headset" size={23} />
          </span>
          <div>
            <b>Moss Quality</b>
            <small>银行呼入客服质检</small>
          </div>
        </div>
        <div className="workspace-name">银行客服中心</div>
        <nav aria-label="主导航">
          {["工作区", "质检作业", "策略与资源", "分析"].map(
            (group) =>
              allowedNav.some((v) => pages[v].group === group) && (
                <div key={group}>
                  <p className="nav-label">{group}</p>
                  {allowedNav
                    .filter((v) => pages[v].group === group)
                    .map((v) => (
                      <a
                        href={`?view=${v}`}
                        key={v}
                        className={state.view === v ? "active" : ""}
                        onClick={event => { if (!event.metaKey && !event.ctrlKey) { event.preventDefault(); go(v); } }}
                        aria-current={state.view === v ? "page" : undefined}
                      >
                        <Icon name={pages[v].icon} />
                        <span>{pages[v].title}</span>
                        {["alerts", "workorders", "improvement"].includes(v) &&
                          tasks.filter((x) => viewFor(state, x.id) === v)
                            .length > 0 && (
                            <em title="此模块全部业务待办，不随列表筛选变化">
                              {
                                tasks.filter((x) => viewFor(state, x.id) === v)
                                  .length
                              }
                            </em>
                          )}
                      </a>
                    ))}
                </div>
              ),
          )}
        </nav>
        <div className="sidebar-utilities">
          <button onClick={() => setResetOpen(true)} aria-label="重置演示数据"><Icon name="refresh" size={14} /><span>重置演示</span></button>
          <small>6001 · 对比迭代</small>
        </div>
      </aside>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      {mobile ? <Modal title="导航" variant="navigation" onClose={() => setMobile(false)}>{navigation}</Modal> : navigation}
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="打开导航"
              aria-haspopup="dialog"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Icon name="menu" />
            </button>
            <span>{current.group}</span>
            <Icon name="chevron" size={13} />
            <h1 id="page-title">{current.title}</h1>
          </div>
          <div className="top-actions">
            <span className="demo-badge">演示</span>
            <label className="role-select">
              <span className="role-avatar" aria-hidden="true">{person(state.identity).name.slice(0,1)}</span>
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
              aria-haspopup="dialog"
              aria-expanded={noticeOpen}
              onClick={() => setNoticeOpen(!noticeOpen)}
            >
              <Icon name="bell" />
              {tasks.length > 0 && <span>{tasks.length}</span>}
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} aria-labelledby="page-title">
          {focus && !["rules","resources"].includes(state.view) && history.state?.fromView && history.state.fromView !== state.view && <div className="context-back"><Button onClick={()=>{if(history.state?.qc)history.back();else open("");}}>返回来源页面</Button></div>}
          {allowedNav.filter(v => visited.has(v) || state.view === v).map((v) => (
            <Activity key={`${state.identity}-${v}`} mode={state.view === v ? "visible" : "hidden"}><div>
              {["alerts", "workorders", "improvement", "calls"].includes(v) ? (
                <Workspace
                  state={state}
                  view={v}
                  focus={state.view === v ? focus : undefined}
                  onOpen={open}
                  onAction={handleAction}
                />
              ) : v === "overview" ? <Workbench state={state} onOpen={open} onNavigate={go}/> : v === "resources" ? <ResourceCatalog state={state} focus={state.view === v ? focus : undefined} onOpen={open} onAction={handleAction} onSubmit={submit}/> : v === "rules" ? (
                <Strategy
                  state={state}
                  view={v}
                  focus={state.view === v ? focus : undefined}
                  onAction={handleAction}
                  onOpen={open}
                  onSubmit={submit}
                />
              ) : (
                <ReportPage state={state} onOpen={open} />
              )}
            </div></Activity>
          ))}
        </main>
      </div>
      {noticeOpen && (
        <Modal title="我的待办" variant="notification" description={`${tasks.length} 项等待你处理`} onClose={() => setNoticeOpen(false)}>
          <Tabs value={noticeTab} label="通知分类" panelId="notice-panel" options={[{value:"todo",label:"我的待办",count:tasks.length},{value:"events",label:"事件通知",count:events.filter(e => !readEvents.includes(e.id)).length}]} onChange={setNoticeTab}/>
          <div role="tabpanel" id="notice-panel" aria-labelledby={`notice-panel-tab-${noticeTab}`}>
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
                      {x.id} · {stateLabel(x,state)}
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
        </Modal>
      )}
      <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite" aria-atomic="true">{toast ? <><Icon name="bell" size={17}/>{toast}</> : null}</div>
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
              intent="danger"
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
