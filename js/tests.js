/* LMTLSS domain tests — runs in the browser at /tests.html, no framework needed. */

(function () {
  "use strict";

  const results = [];
  function ok(name, cond, detail) {
    results.push({ name: name, pass: !!cond, detail: cond ? "" : (detail || "") });
  }
  function eq(name, actual, expected) {
    ok(name, actual === expected, "expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
  }

  /* ---------- planFor ---------- */

  const baseProfile = { goal: "strength", sports: ["strength"], experience: "intermediate", daysPerWeek: 4, equipment: ["full-gym"] };

  const gymPlan = Domain.planFor(Object.assign({}, baseProfile));
  eq("gym plan session count = 4", gymPlan.sessions.length, 4);
  ok("gym plan strength sessions are non-empty", gymPlan.sessions
    .filter(function (s) { return s.sport === "strength"; })
    .every(function (s) { return s.exercises.length >= 3; }));
  ok("gym push day contains Back Squat", gymPlan.sessions.some(function (s) {
    return s.title.indexOf("Push") >= 0 && s.exercises.some(function (e) { return e.name === "Back Squat"; });
  }));
  ok("plan assigns unique days", (function () {
    const days = gymPlan.sessions.map(function (s) { return s.day; });
    return new Set(days).size === days.length;
  })());
  ok("rationale mentions goal and experience", gymPlan.rationale.join(" ").indexOf("Intermediate") >= 0);

  const bwPlan = Domain.planFor(Object.assign({}, baseProfile, { equipment: ["bodyweight"] }));
  const bwStrength = bwPlan.sessions.filter(function (s) { return s.sport === "strength"; });
  ok("bodyweight plan never yields empty sessions", bwStrength.every(function (s) { return s.exercises.length >= 1; }),
    JSON.stringify(bwStrength.map(function (s) { return s.exercises.length; })));
  ok("bodyweight plan uses only available exercises", bwStrength.every(function (s) {
    return s.exercises.every(function (e) { return ["Push-Up", "Plank"].indexOf(e.name) >= 0 || Domain.availableExercises(["bodyweight"]).some(function (a) { return a.name === e.name; }); });
  }));
  ok("bodyweight plan minutes are plausible", bwStrength.every(function (s) { return s.estMinutes >= 20; }));

  const runPlan = Domain.planFor(Object.assign({}, baseProfile, { sports: ["strength", "running"], daysPerWeek: 5 }));
  const runSessions = runPlan.sessions.filter(function (s) { return s.sport === "running"; });
  ok("mixed plan includes runs", runSessions.length >= 1);
  ok("run sessions carry no exercises", runSessions.every(function (s) { return s.exercises.length === 0; }));
  ok("run sessions have durations", runSessions.every(function (s) { return s.estMinutes >= 20; }));

  const bwOnlyRuns = Domain.planFor(Object.assign({}, baseProfile, { equipment: ["outdoor"] }));
  ok("outdoor-only plan still yields trainable sessions", bwOnlyRuns.sessions.every(function (s) { return s.exercises.length >= 1 || s.sport === "running"; }));

  const bigWeek = Domain.planFor(Object.assign({}, baseProfile, { daysPerWeek: 6 }));
  eq("6-day plan caps at 6", bigWeek.sessions.length, 6);
  const smallWeek = Domain.planFor(Object.assign({}, baseProfile, { daysPerWeek: 1 }));
  ok("1-day request floors at 2", smallWeek.sessions.length >= 2);

  /* ---------- availableExercises ---------- */

  ok("bodyweight moves are always available", Domain.availableExercises(["dumbbells"]).some(function (e) { return e.name === "Push-Up"; }));
  ok("barbell-only excludes dumbbell curls", !Domain.availableExercises(["barbell"]).some(function (e) { return e.name === "Biceps Curl"; }));
  eq("full gym gets everything", Domain.availableExercises(["full-gym"]).length, Domain.EXERCISES.length);

  /* ---------- e1RM & records ---------- */

  eq("Epley 100x5", Domain.est1RM(100, 5), 117);
  eq("Epley single = load", Domain.est1RM(100, 1), 100);
  eq("no load = 0", Domain.est1RM(0, 5), 0);

  const prState = {
    log: [
      { id: "a", sport: "strength", startedAt: "2026-01-01T10:00:00Z", exercises: [{ name: "Bench Press", sets: [{ reps: 5, load: 80, done: true }] }] },
      { id: "b", sport: "strength", startedAt: "2026-01-08T10:00:00Z", exercises: [{ name: "Bench Press", sets: [{ reps: 3, load: 95, done: true }] }] },
      { id: "c", sport: "strength", startedAt: "2026-01-15T10:00:00Z", exercises: [{ name: "Bench Press", sets: [{ reps: 5, load: 75, done: true }, { reps: 1, load: 100, done: true }] }] },
      { id: "d", sport: "running", startedAt: "2026-01-16T10:00:00Z", distanceM: 5000, durationSec: 1500, title: "Easy Run" },
      { id: "e", sport: "running", startedAt: "2026-01-20T10:00:00Z", distanceM: 10000, durationSec: 3300, title: "Long Run" }
    ],
    readiness: [], settings: { unit: "metric" }, plan: { sessions: [] }, profile: baseProfile
  };
  const prs = Domain.strengthPRs(prState);
  eq("PR picks highest e1RM (95x3=105 vs 80x5=93 vs 100x1=100)", prs["Bench Press"].e1rm, 105);
  eq("PR source session", prs["Bench Press"].sessionId, "b");

  const rprs = Domain.runningPRs(prState);
  eq("Long Run recorded pace (5:30/km)", Math.round(rprs["Long Run"].paceSec), 330);
  eq("Easy Run recorded pace (5:00/km)", Math.round(rprs["Easy Run"].paceSec), 300);
  ok("running PRs keyed per title keep each best", !!rprs["Easy Run"] && !!rprs["Long Run"]);

  /* ---------- trends ---------- */

  const series = Domain.weeklyVolumeSeries({ log: prState.log }, 4);
  eq("series length", series.length, 4);
  eq("old log falls outside 4-week window", series[3].vol, 0);

  const now = Date.now();
  const fresh = {
    log: [
      { sport: "strength", startedAt: new Date(now - 1 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }] }] },
      { sport: "strength", startedAt: new Date(now - 2 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }, { reps: 5, load: 100, done: true }] }] },
      { sport: "running", startedAt: new Date(now - 3 * 86400000).toISOString(), distanceM: 6000, durationSec: 2100 }
    ]
  };
  const freshSeries = Domain.weeklyVolumeSeries(fresh, 2);
  eq("current week volume = 1500 kg", freshSeries[1].vol, 1500);
  eq("current week run meters", freshSeries[1].runM, 6000);
  eq("prior week empty", freshSeries[0].vol, 0);

  /* ---------- insights ---------- */

  eq("no log = no insights", Domain.insights({ log: [] }).length, 0);
  eq("single week of data = no fabricated trend", Domain.insights(fresh).length, 0);
  // Add a comparable prior week so a real trend exists.
  const insState = {
    log: fresh.log.concat([{
      sport: "strength",
      startedAt: new Date(now - 8 * 86400000).toISOString(),
      exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }, { reps: 5, load: 100, done: true }] }]
    }])
  };
  const ins = Domain.insights(insState);
  ok("volume insight cites measured sets", ins.some(function (i) { return i.text.indexOf("1,500") >= 0 && i.source.indexOf("logged") >= 0; }),
    JSON.stringify(ins.map(function (i) { return i.text; })));
  ok("volume insight states the week-over-week change", ins.some(function (i) { return i.text.indexOf("50%") >= 0; }));

  // Regression: a single working set must render "1 working set", never "1 working sets".
  const singleSetState = {
    log: [
      { sport: "strength", startedAt: new Date(now - 1 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }] }] },
      { sport: "strength", startedAt: new Date(now - 9 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }, { reps: 5, load: 100, done: true }] }] }
    ]
  };
  const oneIns = Domain.insights(singleSetState);
  ok("singular set count renders as \"1 working set\"", oneIns.some(function (i) {
    return i.text.indexOf("1 working set.") >= 0 && i.text.indexOf("1 working sets") < 0;
  }), JSON.stringify(oneIns.map(function (i) { return i.text; })));

  /* ---------- coach rules ---------- */

  const emptyCoach = Domain.coachRecommendations({ log: [], profile: baseProfile, plan: { sessions: [] }, readiness: [] });
  ok("empty history suggests logging first", emptyCoach.length === 1 && emptyCoach[0].title.indexOf("first session") >= 0);
  ok("every rec carries why + confidence", Domain.coachRecommendations({
    log: fresh.log, profile: baseProfile, plan: gymPlan, readiness: []
  }).every(function (r) { return r.why && r.confidence >= 1; }));

  const lowReady = { log: fresh.log, profile: baseProfile, plan: gymPlan, readiness: [{ date: Store.todayISO(), energy: 2, soreness: 4 }] };
  ok("low readiness triggers rest suggestion", Domain.coachRecommendations(lowReady).some(function (r) { return r.title.indexOf("rest") >= 0; }));

  /* ---------- formatting ---------- */

  eq("pace 330s = 5:30", Domain.fmtPace(330), "5:30");
  eq("pace 59s = 0:59", Domain.fmtPace(59), "0:59");
  eq("dur 150 = 2:30", Domain.fmtDur(150), "2:30");
  eq("dur 3725 = 1:02:05", Domain.fmtDur(3725), "1:02:05");
  eq("dist km", Domain.fmtDist(6500, "metric"), "6.50 km");
  eq("dist mi", Domain.fmtDist(6500, "imperial"), "4.04 mi");
  eq("plural 1", UI.plural(1, "exercise"), "1 exercise");
  eq("plural 3", UI.plural(3, "set"), "3 sets");
  eq("relDay today", Domain.relDay(new Date().toISOString()), "Today");
  eq("relDay yesterday", Domain.relDay(new Date(Date.now() - 86400000).toISOString()), "Yesterday");

  /* ---------- nextPlannedSession ---------- */

  const next = Domain.nextPlannedSession({ plan: gymPlan });
  ok("next session is a plan item", gymPlan.sessions.indexOf(next) >= 0);
  eq("no plan = null", Domain.nextPlannedSession({ plan: { sessions: [] } }), null);

  /* ---------- report ---------- */

  const passed = results.filter(function (r) { return r.pass; }).length;
  const failed = results.length - passed;
  const list = document.getElementById("results");
  results.forEach(function (r) {
    const li = document.createElement("li");
    li.className = r.pass ? "pass" : "fail";
    li.textContent = (r.pass ? "✓ " : "✗ ") + r.name + (r.pass ? "" : " — " + r.detail);
    if (!r.pass) li.style.fontWeight = "700";
    list.appendChild(li);
  });
  const summary = document.getElementById("summary");
  summary.textContent = passed + " / " + results.length + " passed" + (failed ? " — " + failed + " FAILED" : "");
  summary.className = failed ? "fail" : "pass";
  document.title = failed ? "FAIL (" + failed + ")" : "PASS (" + passed + ")";
  window.__TESTS__ = { passed: passed, failed: failed, results: results };
})();
