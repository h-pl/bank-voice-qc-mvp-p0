"use client";
import CallDemo from "../components/call-demo";
import callDemoStyles from "../components/call-demo.module.css";
import { flushSync } from "react-dom";
import { SurfaceButton } from "../components/ui/button";
import { SelectField } from "../components/select-field";
import { Activity, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon, type IconName } from "../components/icon";
import { Button, Modal } from "../components/ui";
import dynamic from "next/dynamic";
import { allowNavigation } from "../components/rule-editor";
const ActionForm = dynamic(() => import("../components/action-form").then(m => m.ActionForm));
import { NotificationCenter } from "../components/notification-center";
import { Workspace, viewFor } from "../components/workspace";
import { ResourceCatalog } from "../components/resource-catalog";
import { Strategy } from "../components/strategy";
import { ReportPage } from "../components/report-page";
import { reportModules, readReportModule, reportModuleTitle, type ReportModule } from "../lib/report-navigation";
import {
  getSnapshot,
  getServerSnapshot,
  subscribe,
  updateState,
  resetState,
} from "../lib/store";
import {
  apply,
  actions,
  latest,
  actionLabel,
  visibleTaskTarget,
  entity,
  canSee,
  nav,
  defaultView,
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
    title: "质检策略",
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
  const [reportModule,setReportModule]=useState<ReportModule>("overview");
  const [visitedReports,setVisitedReports]=useState<Set<ReportModule>>(()=>new Set(["overview"]));
  const [visited, setVisited] = useState<Set<View>>(() => new Set());
  const [mobile, setMobile] = useState(false),
    [noticeOpen, setNoticeOpen] = useState(false),
    [resetOpen, setResetOpen] = useState(false),
    [toast, setToast] = useState(""),
    [toastTarget, setToastTarget] = useState<string | undefined>(),
    [archivedTarget, setArchivedTarget] = useState<string | undefined>(),
    [focus, setFocus] = useState<string>(),
    [form, setForm] = useState<{ id: string; action: string }>();
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), archivedTarget ? 15000 : 4500);
      return () => clearTimeout(timer);
    }
  }, [toast, archivedTarget]);
  const go = (view: View, id?: string, module:ReportModule = "overview") => {
    if (!allowNavigation()) return;
    const s = getSnapshot();
    if (!nav[roleOf(s)].includes(view) || (id && !canSee(s, id))) {
      setToast("该记录不在当前身份授权范围内");
      return;
    }
    const continuingCall = view === "calls" && !!id && s.view === "calls" && new URLSearchParams(location.search).has("id");
    history.replaceState({...history.state,qc:true,identity:s.identity,scrollY:window.scrollY}, "", location.href);
    updateState({ ...s, view });
    if(view === "reports") {setReportModule(module);setVisitedReports(previous=>new Set([...previous,module]));}
    setVisited(prev => new Set([...prev, s.view, view]));
    setFocus(id);
    setMobile(false);
    setNoticeOpen(false);
    if (view !== s.view || view === "reports" || view === "calls" && id) requestAnimationFrame(() => window.scrollTo(0, 0));
    window.history.pushState(
      {qc:true,identity:s.identity,scrollY:0,fromReportModule:continuingCall ? history.state?.fromReportModule : reportModule,fromView:continuingCall && history.state?.fromView ? history.state.fromView : s.view,returnSteps:continuingCall && history.state?.fromView && history.state.fromView !== "calls" ? (history.state?.returnSteps ?? 0)+1 : 1},
      "",
      `?view=${view}${view === "reports" ? `&module=${module}` : ""}${id ? `&id=${encodeURIComponent(id)}` : ""}`,
    );
    routeRef.current = location.href;
  };
  useEffect(() => {
    const initialQuery = new URLSearchParams(location.search);
    if (!initialQuery.has("view") || initialQuery.get("view") === "overview") {
      history.replaceState(null, "", `?view=${defaultView}`);
    }
    if (initialQuery.get("view") === "workorders2") {
      initialQuery.set("view", "workorders");
      history.replaceState(history.state, "", `?${initialQuery.toString()}`);
    }
    routeRef.current = location.href;
    const params = new URLSearchParams(window.location.search),
      id = params.get("id");
    const initialModule=readReportModule(params.get("module"));
    queueMicrotask(()=>{setReportModule(initialModule);setVisitedReports(previous=>new Set([...previous,initialModule]));});
    if (id && canSee(getSnapshot(), id)) {
      queueMicrotask(() => setFocus(id));
    }
    const pop = () => {
      const p = new URLSearchParams(location.search),
        s = getSnapshot(),
        view = (p.get("view") === "workorders2" ? "workorders" : p.get("view")) as View;
      if (p.get("view") === "workorders2") {
        p.set("view", "workorders");
        history.replaceState(history.state, "", `?${p.toString()}`);
      }
      const valid = nav[roleOf(s)].includes(view) ? view : defaultView;
      if (!allowNavigation()) { history.pushState(history.state, "", routeRef.current); return; }
      if (p.get("view") === "overview") history.replaceState(null, "", `?view=${defaultView}`);
      routeRef.current = location.href;
      setVisited(prev => new Set([...prev, valid]));
      updateState({ ...s, view: valid });
      if(valid === "reports") { const nextModule=readReportModule(p.get("module"));setReportModule(nextModule);setVisitedReports(previous=>new Set([...previous,nextModule])); }
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
    const target = visibleTaskTarget(state, id);
    const destination = viewFor(state,target);
    go(destination, target);
  };
  const changeIdentity = (identity: string) => {
    if (!allowNavigation()) return;
    const s = getSnapshot(),
      view = defaultView;
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
    const created = result.reviews.find(item => !before.reviews.some(old => old.id === item.id)) ?? result.appeals.find(item => !before.appeals.some(old => old.id === item.id)) ?? result.remedies.find(item => !before.remedies.some(old => old.id === item.id));
    setToastTarget(["alerts","workorders","improvement","calls"].includes(before.view) ? created?.id ?? visibleTaskTarget(result, command.id) : undefined);
    const archived = result.findings.find(f => f.source === "auto" && latest(f)?.value === "false_positive" && !before.findings.some(old => old.id === f.id && latest(old)?.value === "false_positive"));
    setArchivedTarget(archived?.id);
    if (["create_policy","create_policy_configuration"].includes(command.action)) {
      const created=result.rules.find(rule=>!before.rules.some(old=>old.id===rule.id));
      if(created)go("rules",created.id);
    }
    if (["create_resource","create_resource_content"].includes(command.action)) {
      const created = result.resources.find(resource => !before.resources.some(old => old.id === resource.id));
      if (created) go("resources", created.id);
    }
    if (command.action === "accept_result" || command.action === "decide") {
      const created=result.remedies.find(r=>!before.remedies.some(old=>old.id===r.id));
      if(created) go("improvement",created.id);
    }
    if(command.action === "spotcheck") {
      const created=result.reviews.find(r=>!before.reviews.some(old=>old.id===r.id));
      if(created) go("workorders",created.id);
    }
    setToast(
      saved
        ? archived ? "已归档，可在『误报归档』中查看" : `${({save_rule_configuration:"预警配置已保存",save_resource_content:"资源已保存",create_resource_content:"资源已创建",create_policy_configuration:"策略已创建",save_policy_associations:"策略关联已保存",save_policy_bindings:"关联草稿已保存，可在当前页检查并发布",create_policy:"策略及关联草稿已保存，检查后可一并发布",save_rule:"参数草稿已保存，当前生效版本未改变",check_rule:"草稿检查已完成",publish_rule:"新规则版本已生效",save_resource:"资源草稿已保存",publish_resource:"资源版本已发布，规则引用保持不变",switch_resource:"所选规则引用已切换，历史检测保持原版本"} as Record<string,string>)[command.action] ?? `${actionLabel(before, command.id, command.action)}已完成`}`
        : "本次已更新，但浏览器存储不可用，刷新可能恢复示例",
    );
  };
  const handleAction = (id:string, action:string) => {
    if (!actions(getSnapshot(),id).includes(action)) {setToast("当前状态或身份已变化，此操作已不可用");return;}
    if(["ack","read_reminder","accept_remedy"].includes(action)) {
      try {submit({id,action,rev:entity(getSnapshot(),id)!.rev,requestId:crypto.randomUUID(),input:{}});} catch(e) {setToast(e instanceof Error ? e.message : "操作失败");}
    } else setForm({id,action});
  };
  const sourceView = typeof window !== "undefined" ? history.state?.fromView as View | undefined : undefined;
  const sourceLabel = sourceView && sourceView !== state.view && pages[sourceView] ? `返回${sourceView === "reports" ? reportModuleTitle(readReportModule(history.state?.fromReportModule)) : pages[sourceView].title}` : undefined;
  const returnSource = sourceLabel ? {label:sourceLabel, onBack:()=>{if(history.state?.qc)history.go(-(history.state.returnSteps ?? 1));else open("");}} : undefined;
  const tasks = notices(state),
    current = state.view === "reports" ? {...pages.reports,title:reportModuleTitle(reportModule),group:"质量报表"} : pages[state.view],
    events = state.logs
      .filter((l) => canSee(state, l.target) && l.action !== "示例场景已载入")
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
  useEffect(() => { document.title = ready ? `${current.title} · Moss Quality` : "正在恢复工作区 · Moss Quality"; }, [ready, current.title]);
  if (!ready)
    return (
      <div className="loading-state" role="status">
        <span className="brand-mark">
          <Icon name="headset" />
        </span>
        <b>Moss Quality</b>
        <p>正在恢复工作区…</p>
      </div>
    );
  const navigation = (
      <aside className="sidebar">
        <div className={`brand ${callDemoStyles.brand}`}>
          <span className="brand-mark">
            <Icon name="headset" size={23} />
          </span>
          <div>
            <b>Moss Quality</b>
            <small>银行呼入客服质检</small>
          </div>
          <CallDemo/>
        </div>
        <nav aria-label="主导航">
          {["质检作业", "策略与资源", "分析"].map(
            (group) =>
              allowedNav.some((v) => pages[v].group === group) && (
                <div key={group}>
                  <p className="nav-label">{group === "分析" ? "质量报表" : group}</p>
                  {allowedNav
                    .filter((v) => pages[v].group === group)
                    .map((v) => v === "reports" ? <div className="report-nav-module" key={v}>
                      {reportModules.map(module=><a key={module.id} href={`?view=reports&module=${module.id}`} className={state.view === "reports" && reportModule === module.id ? "active" : ""} aria-current={state.view === "reports" && reportModule === module.id ? "page" : undefined} onClick={event=>{if(!event.metaKey && !event.ctrlKey){event.preventDefault();go("reports",undefined,module.id);}}}><Icon name={module.id === "overview" ? "chart" : module.id === "issues" ? "sliders" : module.id === "teams" ? "grid" : "shield"}/><span>{module.title}</span></a>)}
                    </div> : (
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
          <SurfaceButton onClick={() => setResetOpen(true)} aria-label="重置本地数据"><Icon name="refresh" size={14} /><span>重置数据</span></SurfaceButton>
        </div>
      </aside>
  );
  return (
    <div className={`app-shell${["workorders", "calls", "resources", "reports"].includes(state.view) ? " review2-shell" : ""}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      {mobile ? <Modal title="导航" variant="navigation" onClose={() => setMobile(false)}>{navigation}</Modal> : navigation}
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <SurfaceButton
              className="icon-button mobile-toggle"
              aria-label="打开导航"
              aria-haspopup="dialog"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Icon name="menu" />
            </SurfaceButton>
            <span>{current.group}</span>
            <Icon name="chevron" size={13} />
            <h1 id="page-title">{current.title}</h1>
          </div>
          <div className="top-actions">
            <label className="role-select">
              <span className="role-avatar" aria-hidden="true">{person(state.identity).name.slice(0,1)}</span>
              <SelectField
                aria-label="当前身份"
                value={state.identity}
                onValueChange={value => changeIdentity(value)}
              >
                {people.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name} · {roleNames[p.role]}
                  </option>
                ))}
              </SelectField>
            </label>
            <NotificationCenter events={events} readIds={readEvents} open={noticeOpen} onOpenChange={setNoticeOpen} onRead={readEvent} onNavigate={targetId=>{const target=entity(state,targetId);const id=target && "executor" in target ? target.target : targetId;go(viewFor(state,id),id);}}/>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} aria-labelledby="page-title">
          {allowedNav.filter(v => visited.has(v) || state.view === v).map((v) => (
            <Activity key={`${state.identity}-${v}`} mode={state.view === v ? "visible" : "hidden"}><div>
              {["alerts", "workorders", "improvement", "calls"].includes(v) ? (
                <Workspace
                  state={state}
                  view={v}
                  review2={v === "workorders"}
                  returnSource={state.view === v ? returnSource : undefined}
                  focus={state.view === v ? focus : undefined}
                  onOpen={open}
                  onAction={handleAction}
                />
              ) : v === "resources" ? <ResourceCatalog state={state} focus={state.view === v ? focus : undefined} onOpen={open} onAction={handleAction} onSubmit={submit}/> : v === "rules" ? (
                <Strategy
                  state={state}
                  view={v}
                  focus={state.view === v ? focus : undefined}
                  onAction={handleAction}
                  onOpen={open}
                  onSubmit={submit}
                />
              ) : (
                <>{reportModules.filter(module=>visitedReports.has(module.id) || reportModule===module.id).map(module=><Activity key={module.id} mode={reportModule===module.id ? "visible" : "hidden"}><ReportPage state={state} onOpen={open} module={module.id}/></Activity>)}</>
              )}
            </div></Activity>
          ))}
        </main>
      </div>
      <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite" aria-atomic="true">{toast ? <><Icon name="bell" size={17}/>{toast}{archivedTarget ? <SurfaceButton className="toast-history" onClick={()=>{go("alerts",archivedTarget);requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent("qc:show-archive",{detail:archivedTarget})));setToast("");}}>查看归档</SurfaceButton> : toastTarget && <SurfaceButton className="toast-history" onClick={()=>{flushSync(()=>open(toastTarget));window.dispatchEvent(new CustomEvent("qc:show-history",{detail:toastTarget}));setToast("");}}>查看处理记录</SurfaceButton>}</> : null}</div>
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
        <Modal title="恢复初始数据" onClose={() => setResetOpen(false)}>
          <p className="modal-copy">
            将清除本浏览器中保存的操作记录与修改，并恢复初始数据。此操作无法撤销。
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
                setToast("已恢复初始数据");
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
