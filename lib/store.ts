import { useSyncExternalStore } from "react";
import { createInitial } from "./fixtures.ts";
import { defaultView, nav, person, restoreLifecycle, type State } from "./workflow.ts";
export const storageKey = "moss-qc-mvp-p0-v2";
const initial = createInitial(new Date("2026-09-12T00:00:00+08:00"));
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
      )
        cache = restoreLifecycle(d);
    } catch {
      /* Corrupt local demo state is replaced with coherent seeds. */
    }
    if (!cache) {
      cache = createInitial();
      try {
        localStorage.setItem(storageKey, JSON.stringify(cache));
      } catch {}
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
  const s = createInitial();
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
