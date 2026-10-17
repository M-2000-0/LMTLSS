/* LMTLSS domain — training logic: plan generation, records, trends, insights, coach rules.
   Everything here derives from the user's own logged data. Nothing is fabricated. */

(function () {
  "use strict";

  /* ---------- Exercise library (starter set, filtered by equipment) ---------- */

  const EXERCISES = [
    { name: "Back Squat", group: "legs", equip: ["full-gym", "rack"], comp: true },
    { name: "Front Squat", group: "legs", equip: ["full-gym", "rack"], comp: false },
    { name: "Romanian Deadlift", group: "legs", equip: ["full-gym", "barbell"], comp: false },
    { name: "Deadlift", group: "pull", equip: ["full-gym", "barbell"], comp: true },
    { name: "Bench Press", group: "push", equip: ["full-gym", "bench"], comp: true },
    { name: "Incline DB Press", group: "push", equip: ["full-gym", "dumbbells"], comp: false },
    { name: "Overhead Press", group: "push", equip: ["full-gym", "barbell"], comp: false },
    { name: "Pull-Up", group: "pull", equip: ["bar", "full-gym"], comp: false },
    { name: "Chin-Up", group: "pull", equip: ["bar", "full-gym"], comp: false },
    { name: "Seated Row", group: "pull", equip: ["full-gym"], comp: false },
    { name: "Lat Pulldown", group: "pull", equip: ["full-gym"], comp: false },
    { name: "Dumbbell Row", group: "pull", equip: ["dumbbells", "full-gym"], comp: false },
    { name: "Walking Lunge", group: "legs", equip: ["dumbbells", "full-gym"], comp: false },
    { name: "Leg Press", group: "legs", equip: ["full-gym"], comp: false },
    { name: "Bulgarian Split Squat", group: "legs", equip: ["dumbbells", "bench", "full-gym"], comp: false },
    { name: "Calf Raise", group: "legs", equip: ["full-gym", "dumbbells"], comp: false },
    { name: "Dips", group: "push", equip: ["bar", "full-gym"], comp: false },
    { name: "Push-Up", group: "push", equip: ["bodyweight"], comp: false },
    { name: "Lateral Raise", group: "push", equip: ["dumbbells"], comp: false },
    { name: "Biceps Curl", group: "pull", equip: ["dumbbells", "full-gym"], comp: false },
    { name: "Triceps Extension", group: "push", equip: ["dumbbells", "full-gym"], comp: false },
    { name: "Plank", group: "core", equip: ["bodyweight"], comp: false },
    { name: "Hanging Leg Raise", group: "core", equip: ["bar", "full-gym"], comp: false },
    { name: "Face Pull", group: "pull", equip: ["full-gym"], comp: false }
  ];

  function availableExercises(equipment) {
    if (!equipment || !equipment.length || equipment.indexOf("full-gym") >= 0) return EXERCISES.slice();
    // Bodyweight movements are always possible regardless of equipment.
    return EXERCISES.filter(function (e) {
      if (e.equip.indexOf("bodyweight") >= 0) return true;
      return e.equip.some(function (eq) { return equipment.indexOf(eq) >= 0; });
    });
  }

  function groupOf(name) {
    const ex = EXERCISES.find(function (e) { return e.name === name; });
    return ex ? ex.group : null;
  }

  /* ---------- Plan generation ---------- */

  const GOAL_LABELS = {
    strength: "Build strength",
    hypertrophy: "Build muscle",
    general: "General fitness",
    endurance: "Improve endurance",
    weight: "Body composition"
  };

  const EQUIP_LABELS = {
    "full-gym": "Full gym",
    rack: "Squat rack",
    barbell: "Barbell",
    dumbbells: "Dumbbells",
    bench: "Bench",
    bar: "Pull-up bar",
    bodyweight: "Bodyweight only",
    "outdoor": "Outdoor space"
  };

  const EXPERIENCE_LABELS = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

  /* Generate a weekly recurring template of sessions from the profile.
     Conservative starting volumes, scaled by experience and availability. */
  function planFor(profile) {
    const days = Math.max(2, Math.min(6, profile.daysPerWeek || 4));
    const wantsStrength = !profile.sports.length || profile.sports.indexOf("strength") >= 0;
    const wantsRun = profile.sports.indexOf("running") >= 0;
    const sessions = [];

    // Distribute: strength days and run days across the week, alternating
    const strengthDays = wantsStrength ? Math.max(1, days - (wantsRun ? Math.min(2, days - 1) : 0)) : 0;
    const runDays = wantsRun ? days - strengthDays : 0;

    const pushDay = mkTemplate("Push + Squat", "strength", ["Back Squat", "Bench Press", "Overhead Press", "Walking Lunge", "Triceps Extension"], profile);
    const pullDay = mkTemplate("Pull + Hinge", "strength", ["Deadlift", "Pull-Up", "Seated Row", "Face Pull", "Biceps Curl"], profile);
    const fullDay = mkTemplate("Full Body", "strength", ["Back Squat", "Bench Press", "Dumbbell Row", "Plank"], profile);
    const easyRun = mkTemplate("Easy Run", "running", [], profile, 30);
    const longRun = mkTemplate("Long Run", "running", [], profile, 45);

    // Deterministic layout: build ordered list by pattern
    const pattern = [];
    let sLeft = strengthDays, rLeft = runDays;
    const strengthOrder = [pushDay, pullDay, fullDay];
    let sIdx = 0;
    const runOrder = [easyRun, easyRun, longRun];
    let rIdx = 0;
    // Pattern preference: S, R, S, R, S, S (for up to 6 days)
    const preference = ["S", "R", "S", "R", "S", "R"];
    for (let i = 0; i < days; i++) {
      const want = preference[i];
      if (want === "S" && sLeft > 0) { pattern.push(strengthOrder[sIdx % 3]); sIdx++; sLeft--; }
      else if (want === "R" && rLeft > 0) { pattern.push(runOrder[Math.min(rIdx, 2)]); rIdx++; rLeft--; }
      else if (sLeft > 0) { pattern.push(strengthOrder[sIdx % 3]); sIdx++; sLeft--; }
      else if (rLeft > 0) { pattern.push(runOrder[Math.min(rIdx, 2)]); rIdx++; rLeft--; }
    }

    // Day-of-week assignment: start on the first day of the week, then rest gaps
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let cursor = 0;
    pattern.forEach(function (tpl, i) {
      const session = JSON.parse(JSON.stringify(tpl));
      session.id = "plan_" + (i + 1);
      session.day = dayNames[cursor];
      sessions.push(session);
      // spacing: alternate 1-day and 2-day gaps for recovery
      cursor += (i % 2 === 0) ? 1 : 2;
      if (cursor > 6) cursor = 6 - (i % 2);
    });

    return { sessions: sessions, rationale: rationaleFor(profile, strengthDays, runDays) };
  }

  function mkTemplate(title, sport, exNames, profile, minutes) {
    const eq = profile.equipment || [];
    const avail = availableExercises(eq);
    const exp = profile.experience || "beginner";
    const baseSets = exp === "advanced" ? 4 : exp === "intermediate" ? 3 : 2;
    const baseReps = title.indexOf("Pull") >= 0 ? 8 : 5;

    // Start with the template's preferred exercises that this user can do;
    // if equipment rules most of them out, supplement from available work in
    // the same movement groups so a session is never empty.
    const wanted = exNames.filter(function (n) {
      return avail.some(function (e) { return e.name === n; });
    });
    let finalNames = wanted;
    // Only strength sessions need exercise supplementation — a run is a run.
    const adapted = sport === "strength" && wanted.length < 3;
    if (adapted) {
      const groups = {};
      exNames.forEach(function (n) { const g = groupOf(n); if (g) groups[g] = true; });
      const supplements = avail
        .filter(function (e) {
          return finalNames.indexOf(e.name) < 0 && (groups[e.group] || e.group === "core");
        })
        .map(function (e) { return e.name; });
      finalNames = finalNames.concat(supplements);
      // Never ship a one-exercise session if more options exist.
      if (finalNames.length < 2) {
        const extra = avail
          .filter(function (e) { return finalNames.indexOf(e.name) < 0; })
          .map(function (e) { return e.name; });
        finalNames = finalNames.concat(extra);
      }
      finalNames = finalNames.slice(0, 5);
    }

    const exercises = finalNames.map(function (n) {
        const last = lastExerciseData(profile, n);
        return {
          name: n,
          targetSets: baseSets,
          targetReps: baseReps,
          targetLoad: last ? last.load : null, // null => ask user, prefilled from history when known
          lastLoad: last ? last.load : null,
          lastReps: last ? last.reps : null,
          restSec: baseReps <= 6 ? 150 : 90
        };
      });

    // If none of the preferred exercises were possible, the title would lie.
    const finalTitle = sport === "strength" && wanted.length === 0 ? "Bodyweight Circuit" : title;

    return {
      title: finalTitle,
      sport: sport,
      exercises: exercises,
      estMinutes: minutes || (exercises.length ? exercises.length * 12 + 8 : 25),
      targetRPE: exp === "advanced" ? 8 : 7
    };
  }

  function lastExerciseData(profile, name) {
    const state = Store.get();
    const done = state.log
      .filter(function (s) { return s.sport === "strength"; })
      .sort(function (a, b) { return a.startedAt < b.startedAt ? 1 : -1; });
    for (let i = 0; i < done.length; i++) {
      const ex = (done[i].exercises || []).find(function (e) { return e.name === name; });
      if (ex && ex.sets && ex.sets.length) {
        const maxLoad = ex.sets.reduce(function (m, st) { return Math.max(m, st.load || 0); }, 0);
        const topSet = ex.sets.reduce(function (m, st) { return (st.load || 0) >= (m.load || 0) ? st : m; }, ex.sets[0]);
        if (maxLoad > 0) return { load: maxLoad, reps: topSet.reps };
      }
    }
    return null;
  }

  function rationaleFor(profile, strengthDays, runDays) {
    const bits = [];
    bits.push("Built from your goal (" + (GOAL_LABELS[profile.goal] || "general fitness") + "), " +
      (EXPERIENCE_LABELS[profile.experience] || "beginner") + " experience, and " +
      (profile.daysPerWeek || 4) + " training days per week.");
    if (strengthDays) bits.push(strengthDays + " strength day" + (strengthDays > 1 ? "s" : "") + " with push/pull/full-body rotation so each muscle recovers between sessions.");
    if (runDays) bits.push(runDays + " run" + (runDays > 1 ? "s" : "") + ": mostly easy aerobic work plus one longer run, the standard base-building split.");
    bits.push("Starting volumes are deliberately conservative — the plan increases only from your logged performance.");
    return bits;
  }

  /* ---------- Records & trends ---------- */

  function strengthPRs(state) {
    const prs = {}; // name -> {load, reps, date, e1rm}
    (state.log || []).forEach(function (sess) {
      if (sess.sport !== "strength") return;
      (sess.exercises || []).forEach(function (ex) {
        (ex.sets || []).forEach(function (st) {
          if (!st.done && st.done !== undefined) return;
          const load = st.load || 0;
          const e1rm = est1RM(load, st.reps || 0);
          const cur = prs[ex.name];
          if (!cur || e1rm > cur.e1rm || (e1rm === cur.e1rm && load > cur.load)) {
            prs[ex.name] = { load: load, reps: st.reps || 0, date: sess.startedAt, e1rm: e1rm, sessionId: sess.id };
          }
        });
      });
    });
    return prs;
  }

  /* Epley estimate — clearly labeled as an estimate everywhere it's shown */
  function est1RM(load, reps) {
    if (!load || !reps || reps < 2) return load || 0;
    return Math.round(load * (1 + reps / 30));
  }

  function runningPRs(state) {
    const prs = {};
    (state.log || []).forEach(function (sess) {
      if (sess.sport !== "running" || !sess.distanceM) return;
      const pace = sess.durationSec / (sess.distanceM / 1000); // sec per km
      const distKey = sess.title || "Run";
      const cur = prs[distKey];
      if (!cur || pace < cur.paceSec) {
        prs[distKey] = { paceSec: pace, distanceM: sess.distanceM, durationSec: sess.durationSec, date: sess.startedAt, sessionId: sess.id };
      }
    });
    return prs;
  }

  function weeklyVolumeSeries(state, weeks) {
    weeks = weeks || 8;
    const out = [];
    const now = Date.now();
    for (let w = weeks - 1; w >= 0; w--) {
      const end = now - w * 7 * 86400000;
      const start = end - 7 * 86400000;
      let vol = 0, sets = 0, runs = 0, runM = 0;
      (state.log || []).forEach(function (s) {
        const t = new Date(s.startedAt).getTime();
        if (t < start || t >= end) return;
        if (s.sport === "strength") {
          (s.exercises || []).forEach(function (ex) {
            (ex.sets || []).forEach(function (st) {
              if (st.done === false) return;
              vol += (st.load || 0) * (st.reps || 0);
              sets++;
            });
          });
        } else if (s.sport === "running") {
          runs++; runM += s.distanceM || 0;
        }
      });
      out.push({ weekStart: start, vol: vol, sets: sets, runs: runs, runM: runM });
    }
    return out;
  }

  function readinessAverage(state, days) {
    days = days || 7;
    const cutoff = Store.todayISO(new Date(Date.now() - days * 86400000));
    const rows = (state.readiness || []).filter(function (r) { return r.date >= cutoff; });
    if (!rows.length) return null;
    const sum = rows.reduce(function (a, r) { return a + (r.energy || 0); }, 0);
    return sum / rows.length;
  }

  /* ---------- Insights — explainable, sourced from actual logs ---------- */

  function insights(state) {
    const out = [];
    const log = state.log || [];
    if (!log.length) return out;

    const series = weeklyVolumeSeries(state, 5);
    const cur = series[series.length - 1];
    const prev = series[series.length - 2];

    // Strength volume trend
    if (cur && prev && prev.vol > 0) {
      const pct = Math.round(((cur.vol - prev.vol) / prev.vol) * 100);
      if (Math.abs(pct) >= 5) {
        out.push({
          kind: pct > 0 ? "positive" : "neutral",
          text: "Strength volume (load × reps) is " + (pct > 0 ? "up " : "down ") + Math.abs(pct) + "% vs last week — " +            fmt(cur.vol) + " kg this week from " + UI.plural(cur.sets, "working set") + ".",
          source: "Measured from your logged sets."
        });
      } else {
        out.push({
          kind: "neutral",
          text: "Strength volume is holding steady week over week (" + fmt(cur.vol) + " kg). Consistent load is what drives adaptation.",
          source: "Measured from your logged sets."
        });
      }
    }

    // Run pace trend (sec/km across last 4 runs)
    const runs = log.filter(function (s) { return s.sport === "running" && s.distanceM; })
      .sort(function (a, b) { return a.startedAt < b.startedAt ? -1 : 1; });
    if (runs.length >= 4) {
      const last4 = runs.slice(-4);
      const firstHalf = last4.slice(0, 2), secondHalf = last4.slice(2);
      const avgP = function (arr) {
        return arr.reduce(function (a, s) { return a + s.durationSec / (s.distanceM / 1000); }, 0) / arr.length;
      };
      const p1 = avgP(firstHalf), p2 = avgP(secondHalf);
      const delta = p1 - p2;
      if (delta > 3) {
        out.push({
          kind: "positive",
          text: "Your recent runs average " + fmtPace(p2) + "/km, " + Math.round(delta) + " sec/km faster than the two before them.",
          source: "Measured from " + runs.length + " logged runs."
        });
      } else if (delta < -5) {
        out.push({
          kind: "neutral",
          text: "Recent runs are " + Math.abs(Math.round(delta)) + " sec/km slower than the prior pair. That's normal after heavy strength weeks — pace varies with fatigue.",
          source: "Measured from " + runs.length + " logged runs."
        });
      }
    }

    // Consistency
    const weekCount = series.filter(function (w) { return w.sets > 0 || w.runs > 0; }).length;
    if (weekCount >= 3) {
      out.push({
        kind: "neutral",
        text: "You've trained in " + series.filter(function (w) { return w.sets > 0 || w.runs > 0; }).length + " of the last " + series.length + " weeks. Consistency is the strongest predictor of progress in your own data.",
        source: "Counted from completed sessions."
      });
    }

    // Readiness
    const avg = readinessAverage(state, 7);
    if (avg !== null) {
      if (avg <= 2.5) {
        out.push({
          kind: "warning",
          text: "Your readiness ratings have averaged " + avg.toFixed(1) + "/5 this week. Consider an easier session or a rest day before adding load.",
          source: "From your own readiness entries — not a medical measurement."
        });
      }
    }

    return out;
  }

  /* ---------- Coach rules — each returns {text, why, confidence} ---------- */

  function coachRecommendations(state) {
    const recs = [];
    const profile = state.profile || {};
    const log = state.log || [];
    const plan = (state.plan && state.plan.sessions) || [];

    if (!log.length) {
      recs.push({
        title: "Log your first session",
        text: "Start with the planned session on the Train tab. Even one logged session lets the platform show you real history and previous-set references.",
        why: "Every recommendation in LMTLSS is derived from your logged data. With zero sessions there is nothing to analyze yet.",
        confidence: 3,
        action: { label: "Go to Train", tab: "train" }
      });
      return recs;
    }

    // Next planned session suggestion
    const next = nextPlannedSession(state);
    if (next) {
      recs.push({
        title: "Today: " + next.title,
        text: "This is the next session in your " + ((profile.daysPerWeek || 4) + "-day") + " plan. Expect about " + (next.estMinutes || 50) + " minutes.",
        why: "It's the next unlogged session in your weekly template, sequenced so pushing and pulling days alternate.",
        confidence: 3,
        action: { label: "Start session", tab: "train" }
      });
    }

    // Deload suggestion from volume trend
    const series = weeklyVolumeSeries(state, 5);
    const cur = series[series.length - 1], prev = series[series.length - 2];
    if (cur && prev && prev.vol > 0) {
      const pct = ((cur.vol - prev.vol) / prev.vol) * 100;
      if (pct > 15) {
        recs.push({
          title: "Hold the line this week",
          text: "Volume jumped " + Math.round(pct) + "% week over week. Keep load the same for one more week before adding — rapid increases are where joints complain first.",
          why: "Your logged tonnage rose sharply. Standard programming practice is to let adaptation catch up before progressing again. This is general training guidance, not medical advice.",
          confidence: 2,
          action: null
        });
      }
    }

    // Readiness-based
    const avg = readinessAverage(state, 7);
    if (avg !== null && avg <= 2.5) {
      recs.push({
        title: "Consider an extra rest day",
        text: "You've rated your energy low (" + avg.toFixed(1) + "/5 avg) recently. If today feels the same, swap the hard session for an easy walk or mobility work.",
        why: "This is based only on your own readiness entries — LMTLSS does not measure physiological recovery and this is not medical advice.",
        confidence: 2,
        action: null
      });
    }

    // Strength progression suggestion for main lifts
    const prs = strengthPRs(state);
    ["Back Squat", "Bench Press", "Deadlift"].forEach(function (lift) {
      const history = recentTopSets(state, lift, 3);
      if (history.length >= 3) {
        const flat = history[0] === history[1] && history[1] === history[2];
        if (flat) {
          recs.push({
            title: lift + " has plateaued — try a rep instead of load",
            text: "Your last " + history.length + " top sets at " + lift + " were all " + history[0] + " kg. Next session, keep the load and add one rep per set before going heavier.",
            why: "Adding reps at fixed load increases total volume, the primary driver of strength progress, before you push intensity again.",
            confidence: 2,
            action: null
          });
        }
      }
    });

    // Never-fabrication guard note attached to first rec when data is thin
    if (log.length < 4) {
      recs.push({
        title: "More data unlocks more useful coaching",
        text: "With only " + log.length + " session" + (log.length > 1 ? "s" : "") + " logged, trends aren't reliable yet. Log sessions as you do them — recommendations get specific once there's a real history.",
        why: "LMTLSS only states what your data supports. It won't invent trends from a handful of sessions.",
        confidence: 3,
        action: null
      });
    }

    return recs;
  }

  function recentTopSets(state, lift, n) {
    const rows = [];
    (state.log || []).filter(function (s) { return s.sport === "strength"; })
      .sort(function (a, b) { return a.startedAt < b.startedAt ? 1 : -1; })
      .some(function (s) {
        const ex = (s.exercises || []).find(function (e) { return e.name === lift; });
        if (ex && ex.sets && ex.sets.length) {
          const top = ex.sets.reduce(function (m, st) { return (st.load || 0) > (m.load || 0) ? st : m; }, ex.sets[0]);
          rows.push(top.load || 0);
        }
        return rows.length >= n;
      });
    return rows;
  }

  function nextPlannedSession(state) {
    const plan = (state.plan && state.plan.sessions) || [];
    if (!plan.length) return null;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = dayNames[new Date().getDay()];
    // today's session first, else next in order
    const todaySess = plan.find(function (p) { return p.day === today; });
    if (todaySess) return todaySess;
    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const todayIdx = order.indexOf(today);
    for (let i = 1; i <= 7; i++) {
      const d = order[(todayIdx + i) % 7];
      const s = plan.find(function (p) { return p.day === d; });
      if (s) return s;
    }
    return plan[0];
  }

  /* ---------- Formatting ---------- */

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Math.round(n).toLocaleString("en-US");
  }

  function fmtPace(secPerKm) {
    if (!isFinite(secPerKm) || secPerKm <= 0) return "—";
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function fmtDur(sec) {
    if (!sec && sec !== 0) return "—";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function fmtDurHuman(sec) {
    const m = Math.round(sec / 60);
    if (m < 60) return m + " min";
    return Math.floor(m / 60) + "h " + (m % 60) + "m";
  }

  function fmtDist(m, unit) {
    if (!m && m !== 0) return "—";
    if (unit === "imperial") return (m / 1609.34).toFixed(2) + " mi";
    return (m / 1000).toFixed(2) + " km";
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function fmtDateFull(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  function relDay(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return diff + " days ago";
    return fmtDate(iso);
  }

  window.Domain = {
    EXERCISES: EXERCISES,
    GOAL_LABELS: GOAL_LABELS,
    EQUIP_LABELS: EQUIP_LABELS,
    EXPERIENCE_LABELS: EXPERIENCE_LABELS,
    availableExercises: availableExercises,
    planFor: planFor,
    strengthPRs: strengthPRs,
    runningPRs: runningPRs,
    est1RM: est1RM,
    weeklyVolumeSeries: weeklyVolumeSeries,
    readinessAverage: readinessAverage,
    insights: insights,
    coachRecommendations: coachRecommendations,
    nextPlannedSession: nextPlannedSession,
    recentTopSets: recentTopSets,
    fmt: fmt,
    fmtPace: fmtPace,
    fmtDur: fmtDur,
    fmtDurHuman: fmtDurHuman,
    fmtDist: fmtDist,
    fmtDate: fmtDate,
    fmtDateFull: fmtDateFull,
    relDay: relDay
  };
})();
