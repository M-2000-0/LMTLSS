/* LMTLSS store — schema, persistence, seed data, export/delete.
   All data lives in localStorage under one key. No network, no accounts. */

(function () {
  "use strict";

  const STORAGE_KEY = "lmtlss:v1";
  const QUARANTINE_KEY = STORAGE_KEY + ":quarantine";
  const SCHEMA_VERSION = 1;
  /* MIGRATIONS[n] upgrades a version-n payload to version n+1.
     A version bump MUST add the matching step here — data is never discarded. */
  const MIGRATIONS = {};

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  /* The athlete's "today" is a LOCAL calendar day, never the UTC text slice.
     toISOString().slice(0,10) rolls over at 18:00 in UTC-6, so a 7 pm hydration
     entry was filed under tomorrow and the Fuel/Recover screens reported 0 for
     today. Domain.weekStartISO() and Domain.recoverySeries() already compute
     local dates; todayISO() must agree with them. */
  function todayISO(d) {
    const dt = d ? new Date(d) : new Date();
    return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate());
  }

  function emptyState() {
    return {
      version: SCHEMA_VERSION,
      profile: null, // set by onboarding
      plan: { sessions: [] }, // recurring weekly template
      weekPlan: null, // adaptive adjustment for one week {weekStart, moves, dropped, changes, summary} — additive field, old payloads just miss it
      log: [], // completed sessions
      readiness: [], // {date, energy:1-5, soreness:1-5, note}
      hydration: [], // {date, ml}
      meals: [], // {id, date, time, kind, calories, proteinG, carbsG, fatG, note}
      recoveryActions: [], // {id, date, kind, note, time}
      activeSession: null, // in-flight workout
      coachThread: [], // {role:'user'|'coach', text, ts}
      settings: { unit: "metric", restSeconds: 90, weekStart: "mon" },
      meta: { createdAt: new Date().toISOString() }
    };
  }

  let state = null;
  const listeners = new Set();

  function load() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.warn("LMTLSS: storage unavailable, running in memory", e);
      return emptyState();
    }
    if (!raw) return emptyState();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      quarantine(raw, "unparseable JSON");
      return emptyState();
    }
    const out = migrate(parsed);
    if (out.quarantine) quarantine(raw, out.quarantine);
    return out.state;
  }

  /* Unreadable data is preserved under a side key, never destroyed —
     a newer app version (or a repair) may still be able to read it. */
  function quarantine(raw, reason) {
    try {
      localStorage.setItem(QUARANTINE_KEY, JSON.stringify({
        reason: reason,
        at: new Date().toISOString(),
        payload: raw
      }));
      console.warn("LMTLSS: unreadable data preserved under " + QUARANTINE_KEY + " (" + reason + ")");
    } catch (e) {
      console.error("LMTLSS: could not quarantine data", e);
    }
  }

  /* Pure: parsed payload -> {state} or {state: fresh, quarantine: reason}.
     Never throws, never discards silently. */
  function migrate(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { state: emptyState(), quarantine: "payload is not an object" };
    }
    if (typeof parsed.version !== "number" || parsed.version < 1) {
      return { state: emptyState(), quarantine: "missing or invalid version" };
    }
    if (parsed.version > SCHEMA_VERSION) {
      return { state: emptyState(), quarantine: "written by a newer version (v" + parsed.version + ")" };
    }
    let cur = parsed;
    for (let v = parsed.version; v < SCHEMA_VERSION; v++) {
      const step = MIGRATIONS[v];
      if (!step) return { state: emptyState(), quarantine: "no migration path from v" + parsed.version };
      cur = step(cur);
    }
    cur.version = SCHEMA_VERSION;
    const base = emptyState();
    return {
      state: Object.assign(base, cur, {
        settings: Object.assign(base.settings, cur.settings || {})
      })
    };
  }

  /* Re-read storage, discarding the in-memory copy (used by tests). */
  function reload() {
    state = load();
    return state;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("LMTLSS: failed to persist", e);
      if (typeof UI !== "undefined" && UI && typeof UI.toast === "function") {
        UI.toast("Couldn't save locally. Storage may be full.", { error: true });
      }
    }
  }

  function get() {
    if (!state) state = load();
    return state;
  }

  function set(mutator, opts) {
    const s = get();
    mutator(s);
    persist();
    if (!opts || opts.notify !== false) {
      listeners.forEach(function (fn) {
        try { fn(s); } catch (e) { console.error(e); }
      });
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return function () { listeners.delete(fn); };
  }

  /* ---------- Profile ---------- */

  function setProfile(profile) {
    set(function (s) { s.profile = profile; });
  }

  /* ---------- Training plan ---------- */

  function savePlan(sessions) {
    set(function (s) { s.plan.sessions = sessions; });
  }

  /* Adaptive calendar: this week's adjustment (apply, revise or dismiss).
     Never touches state.plan — the generated template stays intact. */
  function saveWeekPlan(entry) {
    set(function (s) { s.weekPlan = entry; });
  }

  /* ---------- Completed sessions ---------- */

  function addSession(session) {
    set(function (s) {
      s.log.push(session);
      s.log.sort(function (a, b) { return a.startedAt < b.startedAt ? -1 : 1; });
    });
  }

  function deleteSession(id) {
    set(function (s) {
      s.log = s.log.filter(function (x) { return x.id !== id; });
    });
  }

  /* ---------- Active (in-flight) session ---------- */

  function saveActive(session) {
    session.updatedAt = Date.now();
    set(function (s) { s.activeSession = session; }, { notify: false });
  }

  function clearActive() {
    set(function (s) { s.activeSession = null; }, { notify: false });
  }

  /* ---------- Readiness & hydration ---------- */

  function logReadiness(entry) {
    set(function (s) {
      const i = s.readiness.findIndex(function (r) { return r.date === entry.date; });
      if (i >= 0) s.readiness[i] = entry; else s.readiness.push(entry);
    });
  }

  function addHydration(ml) {
    set(function (s) {
      const date = todayISO();
      const row = s.hydration.find(function (h) { return h.date === date; });
      if (row) row.ml += ml; else s.hydration.push({ date: date, ml: ml });
    });
  }

  function setHydration(ml) {
    set(function (s) {
      const date = todayISO();
      const idx = s.hydration.findIndex(function (h) { return h.date === date; });
      if (idx >= 0) s.hydration[idx].ml = ml; else s.hydration.push({ date: date, ml: ml });
    });
  }

  function logMeal(entry) {
    set(function (s) {
      if (!s.meals) s.meals = [];
      const date = todayISO();
      const dayStart = new Date(date + "T00:00:00").getTime();
      const ts = entry.time ? new Date(entry.time).getTime() : Date.now();
      if (ts < dayStart - 86400000 || ts > dayStart + 86400000) {
        if (typeof UI !== "undefined" && UI && UI.toast) UI.toast("Meal logged for " + Store.todayISO(new Date(ts)) + ", not today.", { duration: 3000 });
      }
      s.meals.push(Object.assign({ id: uid("meal"), date: todayISO(new Date(ts)) }, entry));
      s.meals.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    });
  }

  function deleteMeal(id) {
    set(function (s) { s.meals = (s.meals || []).filter(function (m) { return m.id !== id; }); });
  }

  function logRecoveryAction(entry) {
    set(function (s) {
      if (!s.recoveryActions) s.recoveryActions = [];
      s.recoveryActions.push(Object.assign({ id: uid("rec"), date: todayISO(), kind: entry.kind || "other", note: entry.note || "", time: entry.time || new Date().toISOString() }, entry));
    });
  }

  /* ---------- Coach thread ---------- */

  function pushCoach(msg) {
    set(function (s) { s.coachThread.push(msg); });
  }

  function clearCoach() {
    set(function (s) { s.coachThread = []; });
  }

  /* ---------- Settings ---------- */

  function updateSettings(patch) {
    set(function (s) { Object.assign(s.settings, patch); });
  }

  /* ---------- Export / delete ---------- */

  function exportJSON() {
    return JSON.stringify(get(), null, 2);
  }

  function resetAll() {
    state = emptyState();
    persist();
    listeners.forEach(function (fn) { fn(state); });
  }

  /* ---------- Seed (demo data, clearly labeled as generated) ---------- */

  function seedDemo() {
    const demo = buildDemoState();
    state = demo;
    persist();
    listeners.forEach(function (fn) { fn(state); });
  }

  function buildDemoState() {
    const s = emptyState();
    s.profile = {
      name: "Demo Athlete",
      goal: "general",
      sports: ["strength", "running"],
      experience: "intermediate",
      daysPerWeek: 4,
      equipment: ["full-gym"],
      limitations: "",
      seeded: true
    };
    s.plan = Domain.planFor(s.profile);

    // ~10 weeks of history: 3 strength sessions + 1 run per week, progressive
    const now = Date.now();
    const dayMs = 86400000;
    const strengthDays = [0, 2, 4]; // offsets within week
    const squatBase = 80, benchBase = 60, deadBase = 100, runBase = 3000; // runBase = meters in 30 min

    for (let w = 10; w >= 1; w--) {
      const weekStart = now - w * 7 * dayMs;
      // progression: small weekly increments with a deload every 4th week
      const factor = w % 4 === 0 ? 0.9 : 1 + (10 - w) * 0.012;
      strengthDays.forEach(function (off, idx) {
        const date = new Date(weekStart + off * dayMs);
        date.setHours(17 + idx, 30, 0, 0);
        const isPull = idx === 1;
        const isFull = idx === 2;
        const exs = [];
        if (!isPull) {
          exs.push(mkStrength("Back Squat", [[5, Math.round(squatBase * factor)], [5, Math.round(squatBase * factor)], [5, Math.round(squatBase * factor * 1.05)]], date));
          exs.push(mkStrength("Bench Press", [[5, Math.round(benchBase * factor)], [5, Math.round(benchBase * factor)], [5, Math.round(benchBase * factor * 1.05)]], date));
          exs.push(mkStrength("Walking Lunge", [[10, 20], [10, 20]], date));
        } else {
          exs.push(mkStrength("Deadlift", [[3, Math.round(deadBase * factor)], [3, Math.round(deadBase * factor)], [3, Math.round(deadBase * factor * 1.03)]], date));
          exs.push(mkStrength("Pull-Up", [[6, 0], [6, 0], [5, 0]], date));
          exs.push(mkStrength("Seated Row", [[10, 50], [10, 55], [10, 55]], date));
        }
        if (isFull) {
          exs.push(mkStrength("Overhead Press", [[6, Math.round(40 * factor)], [6, Math.round(40 * factor)], [6, Math.round(40 * factor * 1.05)]], date));
        }
        s.log.push({
          id: uid("sess"),
          sport: "strength",
          title: isPull ? "Strength — Pull" : isFull ? "Strength — Full Body" : "Strength — Push + Squat",
          startedAt: date.toISOString(),
          durationSec: 52 * 60 + Math.round(Math.random() * 400),
          notes: "",
          exercises: exs,
          provenance: "manual"
        });
      });
      // weekly run
      const runDate = new Date(weekStart + 5 * dayMs);
      runDate.setHours(7, 10, 0, 0);
      const pace = 5.85 - (10 - w) * 0.045 + (w % 4 === 0 ? 0.12 : 0); // min/km, improving
      const dist = 6000 + (10 - w) * 250 + (w % 2 === 0 ? 1500 : 0);
      s.log.push({
        id: uid("sess"),
        sport: "running",
        title: dist > 7000 ? "Long Run" : "Easy Run",
        startedAt: runDate.toISOString(),
        durationSec: Math.round((dist / 1000) * pace * 60),
        distanceM: dist,
        distanceSource: "manual-estimate",
        notes: "",
        provenance: "manual"
      });
    }

    // recent readiness (last 10 days)
    for (let d = 10; d >= 0; d--) {
      s.readiness.push({
        date: todayISO(new Date(now - d * dayMs)),
        energy: 3 + Math.round(Math.sin(d) * 1.2 + Math.random()),
        soreness: 2 + Math.round(Math.random() * 2),
        note: ""
      });
    }
    s.hydration.push({ date: todayISO(), ml: 750 });

    s.coachThread = [];
    s.meta.seededAt = new Date().toISOString();
    return s;
  }

  function mkStrength(name, sets, date) {
    return {
      name: name,
      sets: sets.map(function (p) {
        return { reps: p[0], load: p[1], done: true, rpe: null };
      })
    };
  }

  window.Store = {
    get: get,
    set: set,
    subscribe: subscribe,
    uid: uid,
    todayISO: todayISO,
    setProfile: setProfile,
    savePlan: savePlan,
    saveWeekPlan: saveWeekPlan,
    addSession: addSession,
    deleteSession: deleteSession,
    saveActive: saveActive,
    clearActive: clearActive,
    logReadiness: logReadiness,
    addHydration: addHydration,
    setHydration: setHydration,
    logMeal: logMeal,
    deleteMeal: deleteMeal,
    logRecoveryAction: logRecoveryAction,
    pushCoach: pushCoach,
    clearCoach: clearCoach,
    updateSettings: updateSettings,
    exportJSON: exportJSON,
    resetAll: resetAll,
    seedDemo: seedDemo,
    migrate: migrate,
    reload: reload
  };
})();
