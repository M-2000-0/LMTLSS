/* Platform seam (the BUILD-PLAN "storage shim") for the shared domain layer.

   js/domain.js runs on the web as an IIFE that reads two globals:
     - Store.get()      → persisted state (js/store.js, localStorage-backed)
     - UI.plural()      → tiny text helper (js/ui.js, DOM module)
   The shared port must stay pure — no DOM, no localStorage, no React Native
   imports — so those two touch points are injected here instead:

     - the mobile app binds a persistent store at startup (M1: AsyncStorage/SQLite)
     - Jest uses the defaults, which behave exactly like an empty js/store.js
       state, matching how tests.html runs (fresh localStorage).
*/
import type { AppState } from "./types";

/** Same shape as js/store.js emptyState(), minus nothing domain-relevant. */
export function emptyState(): AppState {
  return {
    version: 1,
    profile: null,
    plan: { sessions: [] },
    weekPlan: null,
    log: [],
    readiness: [],
    hydration: [],
    activeSession: null,
    coachThread: [],
    settings: { unit: "metric", restSeconds: 90, weekStart: "mon" },
    meta: { createdAt: new Date().toISOString() }
  };
}

/** Identical to js/store.js todayISO() — date-only UTC (YYYY-MM-DD). */
export function todayISO(date?: Date | string | number): string {
  const dt = date ? new Date(date) : new Date();
  return dt.toISOString().slice(0, 10);
}

/** Identical to js/ui.js plural() — "1 exercise" / "3 sets". */
export function plural(n: number, word: string): string {
  return n + " " + word + (n === 1 ? "" : "s");
}

export interface PlatformBindings {
  /** Current persisted state (web: Store.get(); mobile: stored state). */
  getState(): AppState;
  /** Date-only UTC string for a given moment (defaults to now). */
  todayISO(date?: Date | string | number): string;
  /** Count + word formatting used by insight copy. */
  plural(n: number, word: string): string;
}

/* Cached like Store.get() (a live mutated state object, not a fresh copy). */
let cachedState: AppState | null = null;

function defaultBindings(): PlatformBindings {
  return {
    getState: function () {
      if (!cachedState) cachedState = emptyState();
      return cachedState;
    },
    todayISO: todayISO,
    plural: plural
  };
}

let bindings: PlatformBindings = defaultBindings();

/** Inject partial bindings (app startup or a test); returns the active set. */
export function setPlatformBindings(patch: Partial<PlatformBindings>): PlatformBindings {
  bindings = Object.assign({}, bindings, patch);
  return bindings;
}

/** Restore defaults (tests: run this in beforeEach). */
export function resetPlatformBindings(): void {
  bindings = defaultBindings();
  cachedState = null;
}

export function getPlatformBindings(): PlatformBindings {
  return bindings;
}