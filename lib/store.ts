import { withAlertDeadlines } from "./alert-deadlines.ts";
import { createPrototypeState, migrateUntouchedSeeds, migrateRuleCatalog, migrateContextScenarios } from "./prototype-seeds.ts";
import { normalizeLegacyLabels } from "./prototype-labels.ts";
import { withFindingContext } from "./finding-context.ts";
import { withStrategyDemo } from "./strategy-demo.ts";
import { withRichDemo } from "./demo-enrichment.ts";
import { withDemoHistory } from "./demo-history.ts";
import { useSyncExternalStore } from "react";
import { defaultView, nav, person, restoreLifecycle, type State } from "./workflow.ts";
export const storageKey = "moss-qc-mvp-p0-v2";
const initial = createPrototypeState(new Date("2026-09-12T00:00:00+08:00"));
let cache: State | undefined;
export const getServerSnapshot = () => initial;
export function getSnapshot(): State {
  if (typeof window === "undefined") return initial;
  if (!cache) {
    try {
      const d = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (
        d?.schema === 2 &&
        person(d.identity) &&
        [
          "calls",
          "findings",
          "reviews",
          "appeals",
          "remedies",
          "supplements",
          "rules",
          "resources",
          "logs",
          "requests",
        ].every((k) => Array.isArray(d[k]))
      ) {
        const migrated = migrateUntouchedSeeds(d);
        // Keep a recoverable copy before replacing untouched historical fixtures.
        if (migrated !== d) {
          const backupKey = `${storageKey}-before-prd-seed-v2`;
          if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, JSON.stringify(d));
          localStorage.setItem(storageKey, JSON.stringify(migrated));
          cache = migrated;
        } else cache = normalizeLegacyLabels(withFindingContext(withStrategyDemo(withRichDemo(withDemoHistory(restoreLifecycle(d))))));
      }
    } catch {
      /* Corrupt local demo state is replaced with coherent seeds. */
    }
    if (!cache) {
      cache = createPrototypeState();
      try {
        localStorage.setItem(storageKey, JSON.stringify(cache));
      } catch {}
    }
    const refined=migrateRuleCatalog(cache);
    if(refined!==cache){
      try {
        const key=`${storageKey}-before-rule-catalog-v1`;
        if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(cache));
        localStorage.setItem(storageKey,JSON.stringify(refined));
      } catch {}
      cache=refined;
    }
    const expanded=migrateContextScenarios(cache);
    if(expanded!==cache){
      try {
        const key=`${storageKey}-before-context-scenarios-v3`;
        if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(cache));
        localStorage.setItem(storageKey,JSON.stringify(expanded));
      } catch {}
      cache=expanded;
    }
    const timed = withAlertDeadlines(cache);
    if (timed !== cache) {
      cache = timed;
      try { localStorage.setItem(storageKey, JSON.stringify(cache)); } catch {}
    }
    const allowed = nav[person(cache.identity).role],
      query = new URLSearchParams(location.search).get("view");
    cache = {
      ...cache,
      view:
        query && allowed.includes(query as State["view"])
          ? (query as State["view"])
          : defaultView,
    };
  }
  return cache;
}
export function subscribe(fn: () => void) {
  const sync = () => {
    cache = undefined;
    fn();
  };
  window.addEventListener("storage", sync);
  window.addEventListener("qc-state", fn);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener("qc-state", fn);
  };
}
export function updateState(s: State) {
  cache = s;
  let persisted = true;
  try {
    localStorage.setItem(storageKey, JSON.stringify(s));
  } catch {
    persisted = false;
  }
  window.dispatchEvent(new Event("qc-state"));
  return persisted;
}
export function resetState() {
  const s = createPrototypeState();
  updateState(s);
  history.replaceState(null, "", `?view=${defaultView}`);
  return s;
}

let clockTime = Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | undefined;
function subscribeClock(fn: () => void) {
  clockListeners.add(fn);
  if (!clockTimer)
    clockTimer = setInterval(() => {
      clockTime = Date.now();
      clockListeners.forEach((f) => f());
    }, 1000);
  return () => {
    clockListeners.delete(fn);
    if (!clockListeners.size) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}
export function useDemoClock() {
  return useSyncExternalStore(
    subscribeClock,
    () => clockTime,
    () => Date.parse("2026-09-12T00:00:00+08:00"),
  );
}
