/* LMTLSS store — schema, persistence, seed data, export/delete.
   All data lives in localStorage under one key. No network, no accounts. */

(function () {
  "use strict";

  const STORAGE_KEY = "lmtlss:v1";
  const SCHEMA_VERSION = 1;

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayISO(d) {
    const dt = d ? new Date(d) : new Date();
    return dt.toISOString().slice(0, 10);
  }

  function emptyState() {
    return {
      version: SCHEMA_VERSION,
      profile: null, // set by onboarding
      plan: { sessions: [] }, // recurring weekly template
      log: [], // completed sessions
      readiness: [], // {date, energy:1-5, soreness:1-5, note}
      hydration: [], // {date, ml}
      activeSession: null, // in-flight workout
      coachThread: [], // {role:'user'|'coach', text, ts}
      settings: { unit: "metric", restSeconds: 90, weekStart: "mon" },
      meta: { createdAt: new Date().toISOString() }
    };
  }

  let state = null;
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SCHEMA_VERSION) return emptyState();
      // merge defaults for forward-compat
      const base = emptyState();
      return Object.assign(base, parsed, {
        settings: Object.assign(base.settings, parsed.settings || {})
      });
    } catch (e) {
      console.warn("LMTLSS: failed to load state, starting fresh", e);
      return emptyState();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("LMTLSS: failed to persist", e);
      UI.toast("Couldn't save locally. Storage may be full.", { error: true });
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
    addSession: addSession,
    deleteSession: deleteSession,
    saveActive: saveActive,
    clearActive: clearActive,
    logReadiness: logReadiness,
    addHydration: addHydration,
    pushCoach: pushCoach,
    clearCoach: clearCoach,
    updateSettings: updateSettings,
    exportJSON: exportJSON,
    resetAll: resetAll,
    seedDemo: seedDemo
  };
})();
