/* LMTLSS shared domain — training logic: plan generation, records, trends,
   insights, coach rules. Strict-TypeScript port of js/domain.js (Phase 1 web).

   Everything here derives from the user's own logged data. Nothing is
   fabricated. Pure: no DOM, no storage, no React Native — the two platform
   touch points (persisted state, text/date helpers) are injected through
   src/platform.ts. Keep this file behaviorally identical to js/domain.js;
   __tests__/parity.test.ts fails if the public API surfaces drift apart. */

import { getPlatformBindings } from "./platform";
import type {
  AppState,
  ClockState,
  CoachRecommendation,
  ExerciseLibraryEntry,
  Experience,
  Insight,
  LoggedSet,
  Plan,
  PlannedExercise,
  PlannedSession,
  Profile,
  FuelSummary,
  MealEntry,
  RecoveryDay,
  RestDayKit,
  RunningIntervalSegment,
  RunningIntervalSummary,
  RunningIntervalTemplate,
  RunningPR,
  SessionResult,
  SessionLog,
  StrengthPR,
  RebalanceProposal,
  WeekPlanState,
  WeekPoint,
  ReadinessSnapshot
} from "./types";

/* ---------- Exercise library (starter set, filtered by equipment) ---------- */

const EXERCISES: ExerciseLibraryEntry[] = [
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

function availableExercises(equipment?: string[]): ExerciseLibraryEntry[] {
  if (!equipment || !equipment.length || equipment.indexOf("full-gym") >= 0) return EXERCISES.slice();
  // Bodyweight movements are always possible regardless of equipment.
  return EXERCISES.filter(function (e) {
    if (e.equip.indexOf("bodyweight") >= 0) return true;
    return e.equip.some(function (eq) { return equipment.indexOf(eq) >= 0; });
  });
}

function groupOf(name: string): string | null {
  const ex = EXERCISES.find(function (e) { return e.name === name; });
  return ex ? ex.group : null;
}

/* ---------- Plan generation ---------- */

const GOAL_LABELS: Record<string, string | undefined> = {
  strength: "Build strength",
  hypertrophy: "Build muscle",
  general: "General fitness",
  endurance: "Improve endurance",
  weight: "Body composition"
};

const EQUIP_LABELS: Record<string, string | undefined> = {
  "full-gym": "Full gym",
  rack: "Squat rack",
  barbell: "Barbell",
  dumbbells: "Dumbbells",
  bench: "Bench",
  bar: "Pull-up bar",
  bodyweight: "Bodyweight only",
  "outdoor": "Outdoor space"
};

const EXPERIENCE_LABELS: Record<Experience | string, string | undefined> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced"
};

/* Generate a weekly recurring template of sessions from the profile.
   Conservative starting volumes, scaled by experience and availability. */
function planFor(profile: Profile): Plan {
  const days = Math.max(2, Math.min(6, profile.daysPerWeek || 4));
  const wantsStrength = !profile.sports.length || profile.sports.indexOf("strength") >= 0;
  const wantsRun = profile.sports.indexOf("running") >= 0;
  const sessions: PlannedSession[] = [];

  // Distribute: strength days and run days across the week, alternating
  const strengthDays = wantsStrength ? Math.max(1, days - (wantsRun ? Math.min(2, days - 1) : 0)) : 0;
  const runDays = wantsRun ? days - strengthDays : 0;

  const pushDay = mkTemplate("Push + Squat", "strength", ["Back Squat", "Bench Press", "Overhead Press", "Walking Lunge", "Triceps Extension"], profile);
  const pullDay = mkTemplate("Pull + Hinge", "strength", ["Deadlift", "Pull-Up", "Seated Row", "Face Pull", "Biceps Curl"], profile);
  const fullDay = mkTemplate("Full Body", "strength", ["Back Squat", "Bench Press", "Dumbbell Row", "Plank"], profile);
  const easyRun = mkTemplate("Easy Run", "running", [], profile, 30);
  const longRun = mkTemplate("Long Run", "running", [], profile, 45);

  // Deterministic layout: build ordered list by pattern
  const pattern: PlannedSession[] = [];
  let sLeft = strengthDays, rLeft = runDays;
  const strengthOrder = [pushDay, pullDay, fullDay];
  let sIdx = 0;
  const runOrder = [easyRun, easyRun, longRun];
  let rIdx = 0;
  // Pattern preference: S, R, S, R, S, R (for up to 6 days)
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
    const session: PlannedSession = JSON.parse(JSON.stringify(tpl));
    session.id = "plan_" + (i + 1);
    session.day = dayNames[cursor];
    sessions.push(session);
    // spacing: alternate 1-day and 2-day gaps for recovery
    cursor += (i % 2 === 0) ? 1 : 2;
    if (cursor > 6) cursor = 6 - (i % 2);
  });

  return { sessions: sessions, rationale: rationaleFor(profile, strengthDays, runDays) };
}

function mkTemplate(title: string, sport: string, exNames: string[], profile: Profile, minutes?: number): PlannedSession {
  const eq = profile.equipment || [];
  const avail = availableExercises(eq);
  const exp: Experience = profile.experience || "beginner";
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
    const groups: Record<string, boolean> = {};
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

  const exercises: PlannedExercise[] = finalNames.map(function (n) {
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

function lastExerciseData(_profile: Profile, name: string): { load: number; reps: number | null } | null {
  const state = getPlatformBindings().getState();
  const done = (state.log || [])
    .filter(function (s) { return s.sport === "strength"; })
    .sort(function (a, b) { return a.startedAt < b.startedAt ? 1 : -1; });
  for (let i = 0; i < done.length; i++) {
    const ex = (done[i].exercises || []).find(function (e) { return e.name === name; });
    if (ex && ex.sets && ex.sets.length) {
      const maxLoad = ex.sets.reduce(function (m, st: LoggedSet) { return Math.max(m, st.load || 0); }, 0);
      const topSet = ex.sets.reduce(function (m: LoggedSet, st: LoggedSet) { return (st.load || 0) >= (m.load || 0) ? st : m; }, ex.sets[0]);
      if (maxLoad > 0) return { load: maxLoad, reps: topSet.reps ?? null };
    }
  }
  return null;
}

function rationaleFor(profile: Profile, strengthDays: number, runDays: number): string[] {
  const bits: string[] = [];
  bits.push("Built from your goal (" + (GOAL_LABELS[profile.goal] || "general fitness") + "), " +
    (EXPERIENCE_LABELS[profile.experience] || "beginner") + " experience, and " +
    (profile.daysPerWeek || 4) + " training days per week.");
  if (strengthDays) bits.push(strengthDays + " strength day" + (strengthDays > 1 ? "s" : "") + " with push/pull/full-body rotation so each muscle recovers between sessions.");
  if (runDays) bits.push(runDays + " run" + (runDays > 1 ? "s" : "") + ": mostly easy aerobic work plus one longer run, the standard base-building split.");
  bits.push("Starting volumes are deliberately conservative — the plan increases only from your logged performance.");
  return bits;
}

/* ---------- Records & trends ---------- */

function strengthPRs(state: AppState): Record<string, StrengthPR> {
  const prs: Record<string, StrengthPR> = {}; // name -> {load, reps, date, e1rm}
  (state.log || []).forEach(function (sess) {
    if (sess.sport !== "strength") return;
    (sess.exercises || []).forEach(function (ex) {
      (ex.sets || []).forEach(function (st) {
        if (!st.done && st.done !== undefined) return;
        const load = st.load || 0;
        const e1rm = est1RM(load, st.reps || 0);
        const cur: StrengthPR | undefined = prs[ex.name];
        if (!cur || e1rm > cur.e1rm || (e1rm === cur.e1rm && load > cur.load)) {
          prs[ex.name] = { load: load, reps: st.reps || 0, date: sess.startedAt, e1rm: e1rm, sessionId: sess.id };
        }
      });
    });
  });
  return prs;
}

/* Epley estimate — clearly labeled as an estimate everywhere it's shown */
function est1RM(load: number, reps: number): number {
  if (!load || !reps || reps < 2) return load || 0;
  return Math.round(load * (1 + reps / 30));
}

function runningPRs(state: AppState): Record<string, RunningPR> {
  const prs: Record<string, RunningPR> = {};
  (state.log || []).forEach(function (sess) {
    if (sess.sport !== "running" || !sess.distanceM) return;
    const pace = (sess.durationSec ?? NaN) / (sess.distanceM / 1000); // sec per km
    const distKey = sess.title || "Run";
    const cur: RunningPR | undefined = prs[distKey];
    if (!cur || pace < cur.paceSec) {
      prs[distKey] = { paceSec: pace, distanceM: sess.distanceM, durationSec: sess.durationSec, date: sess.startedAt, sessionId: sess.id };
    }
  });
  return prs;
}

/** What runningIntervalSummary needs: a finished log entry, or a live session. */
export interface IntervalSessionInput {
  durationSec?: number | null;
  distanceM?: number | null;
  intervalSegments?: RunningIntervalSegment[] | null;
  intervalTemplate?: RunningIntervalTemplate | null;
  elapsedBase?: number;
  startMs?: number;
  paused?: boolean;
}

function runningIntervalSummary(session: IntervalSessionInput): RunningIntervalSummary {
  const segs: RunningIntervalSegment[] = (session.intervalSegments || []);
  const tmpl: RunningIntervalTemplate | null = session.intervalTemplate || null;
  const liveElapsed = typeof session.startMs === "number"
    ? elapsedSec({ elapsedBase: session.elapsedBase || 0, startMs: session.startMs, paused: !!session.paused })
    : 0;
  const elapsed = session.durationSec != null ? session.durationSec : liveElapsed;
  const totalTime = elapsed || 0;
  if (!segs.length) {
    const pace = session.distanceM && totalTime > 5
      ? totalTime / (session.distanceM / 1000)
      : null;
    return {
      segments: segs,
      totalTime: totalTime,
      distKm: session.distanceM ? session.distanceM / 1000 : null,
      avgPaceSecPerKm: pace,
      totalWorkSec: 0,
      totalRestSec: 0,
      workCount: 0,
      restCount: 0,
      lastSegmentIndex: -1,
      template: tmpl,
      completedSegments: 0
    };
  }
  let totalWorkSec = 0, totalRestSec = 0, workCount = 0, restCount = 0, lastIndex = -1;
  segs.forEach(function (s) {
    if (s.segmentType === "work") { totalWorkSec += s.durationSec || 0; workCount++; }
    else if (s.segmentType === "rest") { totalRestSec += s.durationSec || 0; restCount++; }
    if (s.done) lastIndex = Math.max(lastIndex, s.index);
  });
  const template = tmpl && tmpl.segments.length ? tmpl : null;
  return {
    segments: segs,
    totalTime: totalTime,
    distKm: session.distanceM ? session.distanceM / 1000 : null,
    avgPaceSecPerKm: session.distanceM && totalTime > 5
      ? totalTime / (session.distanceM / 1000)
      : null,
    totalWorkSec: totalWorkSec,
    totalRestSec: totalRestSec,
    workCount: workCount,
    restCount: restCount,
    lastSegmentIndex: lastIndex,
    template: template,
    completedSegments: lastIndex >= 0 ? lastIndex + 1 : 0
  };
}

function weeklyVolumeSeries(state: AppState, weeks?: number): WeekPoint[] {
  const wk = weeks || 8;
  const out: WeekPoint[] = [];
  const now = Date.now();
  for (let w = wk - 1; w >= 0; w--) {
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

function readinessAverage(state: AppState, days?: number): number | null {
  const dayCount = days || 7;
  const cutoff = getPlatformBindings().todayISO(new Date(Date.now() - dayCount * 86400000));
  const rows = (state.readiness || []).filter(function (r) { return r.date >= cutoff; });
  if (!rows.length) return null;
  const sum = rows.reduce(function (a, r) { return a + (r.energy || 0); }, 0);
  return sum / rows.length;
}

/* ---------- Insights — explainable, sourced from actual logs ---------- */

function insights(state: AppState): Insight[] {
  const out: Insight[] = [];
  const log = state.log || [];
  if (!log.length) return out;

  const series = weeklyVolumeSeries(state, 5);
  const cur: WeekPoint | undefined = series[series.length - 1];
  const prev: WeekPoint | undefined = series[series.length - 2];

  // Strength volume trend
  if (cur && prev && prev.vol > 0) {
    const pct = Math.round(((cur.vol - prev.vol) / prev.vol) * 100);
    if (Math.abs(pct) >= 5) {
      out.push({
        kind: pct > 0 ? "positive" : "neutral",
        text: "Strength volume (load × reps) is " + (pct > 0 ? "up " : "down ") + Math.abs(pct) + "% vs last week — " +
          fmt(cur.vol) + " kg this week from " + getPlatformBindings().plural(cur.sets, "working set") + ".",
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
    const avgP = function (arr: SessionLog[]): number {
      return arr.reduce(function (a, s) { return a + (s.durationSec ?? 0) / ((s.distanceM || 0) / 1000); }, 0) / arr.length;
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

function coachRecommendations(state: AppState): CoachRecommendation[] {
  const recs: CoachRecommendation[] = [];
  const profile: Partial<Profile> = state.profile || {};
  const log = state.log || [];

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
  const cur: WeekPoint | undefined = series[series.length - 1];
  const prev: WeekPoint | undefined = series[series.length - 2];
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

function recentTopSets(state: AppState, lift: string, n: number): number[] {
  const rows: number[] = [];
  (state.log || []).filter(function (s) { return s.sport === "strength"; })
    .sort(function (a, b) { return a.startedAt < b.startedAt ? 1 : -1; })
    .some(function (s) {
      const ex = (s.exercises || []).find(function (e) { return e.name === lift; });
      if (ex && ex.sets && ex.sets.length) {
        const top = ex.sets.reduce(function (m: LoggedSet, st: LoggedSet) { return (st.load || 0) > (m.load || 0) ? st : m; }, ex.sets[0]);
        rows.push(top.load || 0);
      }
      return rows.length >= n;
    });
  return rows;
}

function nextPlannedSession(state: AppState, nowMs?: number): PlannedSession | null {
  const all: PlannedSession[] = (state.plan && state.plan.sessions) || [];
  if (!all.length) return null;
  const wp = weekPlanFor(state, nowMs);
  // Sessions deferred out of this week are not offered this week.
  const plan: PlannedSession[] = wp && wp.dropped
    ? all.filter(function (p) { return (wp.dropped || []).indexOf(p.id || "") < 0; })
    : all;
  if (!plan.length) return null;
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = dayNames[new Date(now).getDay()];
  // today's session first (adjustment-aware), else next in order
  const todaySess = plan.find(function (p) { return effectivePlanDay(p, state, now) === today; });
  if (todaySess) return todaySess;
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayIdx = (new Date(now).getDay() + 6) % 7;
  for (let i = 1; i <= 7; i++) {
    const d = order[(todayIdx + i) % 7];
    const s = plan.find(function (p) { return effectivePlanDay(p, state, now) === d; });
    if (s) return s;
  }
  return plan[0];
}

/* ---------- Adaptive calendar — explainable weekly rebalancing ----------
   Pure proposal logic. Mirrors js/domain.js exactly: given the week's plan,
   this week's log and readiness check-ins, suggest moving missed sessions (or
   today's hard session on a low-readiness day) onto open days of the same
   week, explaining every change with the data behind it. Never mutates state;
   the UI applies the proposal to state.weekPlan (keyed by week), so the
   generated template is never rewritten and old payloads without the field
   are unaffected. */

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayIndexOf(day: string): number { return DAY_ORDER.indexOf(day); }

function pad2(n: number): string { return (n < 10 ? "0" : "") + n; }

/** Monday-based start (local calendar) of the week containing nowMs, as YYYY-MM-DD. */
function weekStartISO(nowMs?: number): string {
  const d = typeof nowMs === "number" ? new Date(nowMs) : new Date();
  const back = (d.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  return start.getFullYear() + "-" + pad2(start.getMonth() + 1) + "-" + pad2(start.getDate());
}

interface WeekBounds {
  startISO: string;
  startMs: number;
  endMs: number;
  todayIdx: number;
  todayStr: string;
}

function weekBounds(nowMs: number): WeekBounds {
  const d = new Date(nowMs);
  const back = (d.getDay() + 6) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  return {
    startISO: start.getFullYear() + "-" + pad2(start.getMonth() + 1) + "-" + pad2(start.getDate()),
    startMs: start.getTime(),
    endMs: start.getTime() + 7 * 86400000,
    todayIdx: back,
    todayStr: getPlatformBindings().todayISO(d)
  };
}

/** This week's live adjustment — only while it matches the current week.
    A dismissed (reverted) entry counts as "no adjustment". */
function weekPlanFor(state: AppState, nowMs?: number): WeekPlanState | null {
  const wp = state.weekPlan;
  if (!wp || wp.dismissed) return null;
  if (wp.weekStart !== weekStartISO(nowMs)) return null;
  return wp;
}

/** The day a planned session actually runs this week (template day unless a
    current-week adjustment moved it). */
function effectivePlanDay(sess: PlannedSession, state: AppState, nowMs?: number): string {
  const wp = weekPlanFor(state, nowMs);
  if (wp && wp.moves && wp.moves[sess.id || ""]) return wp.moves[sess.id || ""];
  return sess.day || "";
}

function withinWeek(iso: string | undefined, bounds: WeekBounds): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= bounds.startMs && t < bounds.endMs;
}

// Was a planned session covered by this week's log?
// Preferred: sessions started from the plan carry its id (new behavior).
// Legacy fallback: any same-sport session on that planned weekday counts —
// the training day happened even if the user ran a different named variant.
function planSessionDone(sess: PlannedSession, log: SessionLog[], bounds: WeekBounds, effIdx: number): boolean {
  if (log.some(function (x) { return x.planId === sess.id && withinWeek(x.startedAt, bounds); })) return true;
  return log.some(function (x) {
    if (x.sport !== sess.sport || !withinWeek(x.startedAt, bounds)) return false;
    return (new Date(x.startedAt).getDay() + 6) % 7 === effIdx;
  });
}

function isHardSession(sess: PlannedSession): boolean {
  return sess.sport === "strength" || (sess.targetRPE || 7) >= 8;
}

function readinessAvg(state: AppState, nowMs: number): number | null {
  const platform = getPlatformBindings();
  const cutoff = platform.todayISO(new Date(nowMs - 7 * 86400000));
  const rows = (state.readiness || []).filter(function (r) {
    return typeof r.date === "string" && r.date >= cutoff;
  });
  if (!rows.length) return null;
  return rows.reduce(function (a, r) { return a + (r.energy || 0); }, 0) / rows.length;
}

interface ReadinessTrigger extends ReadinessSnapshot {
  active: boolean;
  basis: "today" | "avg" | "none";
}

// Low readiness = today's check-in at energy ≤ 2 or soreness ≥ 4; when there
// is no entry for today, a 7-day average of ≤ 2.5 counts. Same self-rating
// data the Coach already uses — never a measured physiological value.
function readinessTrigger(state: AppState, nowMs: number, bounds: WeekBounds): ReadinessTrigger {
  const avg = readinessAvg(state, nowMs);
  const today = (state.readiness || []).find(function (r) { return r.date === bounds.todayStr; });
  if (today) {
    const lowEnergy = typeof today.energy === "number" && today.energy <= 2;
    const highSoreness = typeof today.soreness === "number" && today.soreness >= 4;
    if (lowEnergy || highSoreness) {
      return { active: true, basis: "today", date: today.date, energy: today.energy ?? null, soreness: today.soreness ?? null, avg: avg };
    }
    return { active: false, basis: "today", date: today.date, energy: today.energy ?? null, soreness: today.soreness ?? null, avg: avg };
  }
  if (avg !== null && avg <= 2.5) {
    return { active: true, basis: "avg", date: null, energy: null, soreness: null, avg: avg };
  }
  return { active: false, basis: "none", date: null, energy: null, soreness: null, avg: avg };
}

// First open day from `earliest` (inclusive). For strength, prefer a day
// without strength on either neighbor (no back-to-back strength stacking),
// falling back to the earliest open day if that's all there is — the caller
// only claims a rest-gap reason when a day was actually skipped for it.
function pickOpenDay(earliest: number, sess: PlannedSession, occupied: Record<number, PlannedSession | undefined>): { index: number; skippedDay: string | null } {
  const candidates: number[] = [];
  for (let i = earliest; i < 7; i++) if (!occupied[i]) candidates.push(i);
  if (!candidates.length) return { index: -1, skippedDay: null };
  if (sess.sport !== "strength") return { index: candidates[0], skippedDay: null };
  const roomy = candidates.filter(function (i) {
    const prev = i > 0 ? occupied[i - 1] : null;
    const next = i < 6 ? occupied[i + 1] : null;
    return !(prev && prev.sport === "strength") && !(next && next.sport === "strength");
  });
  if (roomy.length) {
    return { index: roomy[0], skippedDay: roomy[0] !== candidates[0] ? DAY_ORDER[candidates[0]] : null };
  }
  return { index: candidates[0], skippedDay: null };
}

function rebalanceWeek(state: AppState, nowMs?: number): RebalanceProposal {
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const bounds = weekBounds(now);
  const base: RebalanceProposal = {
    weekStart: bounds.startISO,
    changes: [],
    moves: {},
    dropped: [],
    readiness: null,
    summary: ""
  };
  const plan: PlannedSession[] = (state.plan && state.plan.sessions) || [];
  if (!plan.length) {
    base.summary = "No plan yet — nothing to rebalance.";
    return base;
  }
  const log = state.log || [];
  const wp = weekPlanFor(state, now);
  const alreadyDropped = (wp && wp.dropped) || [];
  const logThisWeek = log.filter(function (x) { return withinWeek(x.startedAt, bounds); }).length;

  // Classify: done / missed (day already passed) / still pending.
  const pending: { sess: PlannedSession; effIdx: number; effDay: string }[] = [];
  const missed: { sess: PlannedSession; effIdx: number; effDay: string }[] = [];
  plan.forEach(function (p) {
    if (alreadyDropped.indexOf(p.id || "") >= 0) return;
    const effDay = effectivePlanDay(p, state, now);
    const effIdx = dayIndexOf(effDay);
    if (effIdx < 0) return; // malformed day — skip, never crash
    if (planSessionDone(p, log, bounds, effIdx)) return;
    const entry = { sess: p, effIdx: effIdx, effDay: effDay };
    if (effIdx < bounds.todayIdx) missed.push(entry); else pending.push(entry);
  });

  const trigger = readinessTrigger(state, now, bounds);
  base.readiness = trigger.active
    ? { date: trigger.date, energy: trigger.energy, soreness: trigger.soreness, avg: trigger.avg }
    : null;

  // Occupy pending days; today's hard session is held back when readiness is low.
  const occupied: Record<number, PlannedSession | undefined> = {};
  pending.forEach(function (e) {
    if (trigger.active && e.effIdx === bounds.todayIdx && isHardSession(e.sess)) return;
    occupied[e.effIdx] = e.sess;
  });

  const changes = base.changes, moves = base.moves, dropped = base.dropped;
  const padDay = function (n: number): string { return DAY_ORDER[n]; };
  const missedSource = "Your weekly plan compared with this week's logged sessions (matched by plan item, or by sport and weekday for older entries).";

  const readinessWhy = function (e: { sess: PlannedSession; effDay: string }, toDay: string): string {
    let head: string;
    if (trigger.basis === "today") {
      head = "Check-in " + trigger.date + ": energy " + (trigger.energy !== null ? trigger.energy + "/5" : "—") +
        (trigger.soreness !== null ? ", soreness " + trigger.soreness + "/5" : "") +
        (trigger.avg !== null ? " (7-day average " + trigger.avg.toFixed(1) + "/5)" : "") + ".";
    } else {
      head = "Your readiness check-ins average " + (trigger.avg as number).toFixed(1) + "/5 over the last 7 days, with no entry for today yet.";
    }
    return head + " " + e.sess.title + (e.sess.sport === "strength" ? " is a strength session" : " is a hard session") +
      ", so it moves to " + toDay + " — same work, one day later, loads and volume unchanged.";
  };
  const readinessSource = trigger.basis === "today"
    ? "Your readiness check-in on " + trigger.date + " — your own rating, not a measured physiological value."
    : "Your own readiness check-ins from the last 7 days — a self-rating, not a measured physiological value.";

  // 1) Readiness move first: today's hard session off a low-readiness day.
  if (trigger.active) {
    pending.forEach(function (e) {
      if (!(e.effIdx === bounds.todayIdx && isHardSession(e.sess))) return;
      const pick = pickOpenDay(bounds.todayIdx + 1, e.sess, occupied);
      if (pick.index < 0) { occupied[bounds.todayIdx] = e.sess; return; } // no slot: stays put, no change claimed
      occupied[pick.index] = e.sess;
      moves[e.sess.id || ""] = padDay(pick.index);
      changes.push({
        planId: e.sess.id || "",
        title: e.sess.title,
        sport: e.sess.sport,
        kind: "move",
        trigger: "readiness",
        fromDay: e.effDay,
        toDay: padDay(pick.index),
        text: e.sess.title + ": " + e.effDay + " → " + padDay(pick.index),
        why: readinessWhy(e, padDay(pick.index)),
        source: readinessSource
      });
    });
  }

  // 2) Missed sessions, earliest planned day first, onto open days.
  missed.sort(function (a, b) { return a.effIdx - b.effIdx; });
  missed.forEach(function (e) {
    const earliest = trigger.active ? bounds.todayIdx + 1 : bounds.todayIdx;
    const pick = pickOpenDay(earliest, e.sess, occupied);
    const missWhy = function (toDay: string, spacingNote: string): string {
      return e.sess.title + " was planned for " + e.effDay + " and has no matching session in your log this week (" +
        logThisWeek + (logThisWeek === 1 ? " session" : " sessions") + " logged). The earliest open training day left is " + toDay + "." +
        (spacingNote ? " " + spacingNote : "");
    };
    if (pick.index < 0) {
      dropped.push(e.sess.id || "");
      changes.push({
        planId: e.sess.id || "",
        title: e.sess.title,
        sport: e.sess.sport,
        kind: "defer",
        trigger: "missed",
        fromDay: e.effDay,
        toDay: null,
        text: e.sess.title + ": " + e.effDay + " → deferred",
        why: e.sess.title + " was planned for " + e.effDay + " with no session logged, and every remaining day this week is already full — there is no open day to move it into. It drops out of this week only; next week's template runs as generated.",
        source: missedSource
      });
      return;
    }
    occupied[pick.index] = e.sess;
    moves[e.sess.id || ""] = padDay(pick.index);
    const spacingNote = pick.skippedDay
      ? "Chose " + padDay(pick.index) + " over " + pick.skippedDay + " so strength days don't stack back-to-back."
      : "";
    changes.push({
      planId: e.sess.id || "",
      title: e.sess.title,
      sport: e.sess.sport,
      kind: "move",
      trigger: "missed",
      fromDay: e.effDay,
      toDay: padDay(pick.index),
      text: e.sess.title + ": " + e.effDay + " → " + padDay(pick.index),
      why: missWhy(padDay(pick.index), spacingNote),
      source: missedSource
    });
  });

  // Human summary — one line, honest about what happened.
  const readLn = changes.filter(function (c) { return c.trigger === "readiness" && c.kind === "move"; }).length;
  const missLn = changes.filter(function (c) { return c.trigger === "missed" && c.kind === "move"; }).length;
  const defLn = changes.filter(function (c) { return c.kind === "defer"; }).length;
  const bits: string[] = [];
  if (readLn) bits.push(readLn + (readLn === 1 ? " session shifted" : " sessions shifted") + " for low readiness");
  if (missLn) bits.push(missLn + (missLn === 1 ? " missed session" : " missed sessions") + " moved to open days");
  if (defLn) bits.push(defLn + (defLn === 1 ? " session" : " sessions") + " deferred — no open day left");
  base.summary = bits.length ? "This week adjusted: " + bits.join("; ") + "." : "No changes needed — this week is on track.";
  return base;
}

/* ---------- Sport model ----------
   Every sport records different things. A run has distance and pace; a boxing
   session has rounds; a golf round has holes and strokes. Screens ask this
   registry which metrics a sport supports instead of forcing every activity
   through a running-shaped form.

   Everything here is athlete-entered or clock-measured. No GPS, wearable or
   heart-rate device is connected, so this model never claims a metric the app
   cannot actually observe. Mirrors js/domain.js exactly. */

/** One value an activity can carry. */
export interface MetricDef {
  label: string;
  kind: "duration" | "distance" | "pace" | "speed" | "height" | "count" | "weight" | "effort" | "text";
}

/** A sport and the full metric vocabulary it can record. */
export interface SportDef {
  id: string;
  label: string;
  group: string;
  metrics: string[];
}

// Metric vocabulary — one definition per value an activity can carry.
const METRICS: Record<string, MetricDef> = {
  durationSec: { label: "Duration", kind: "duration" },
  distanceM: { label: "Distance", kind: "distance" },
  pace: { label: "Pace", kind: "pace" },
  speed: { label: "Speed", kind: "speed" },
  elevationM: { label: "Elevation", kind: "height" },
  sets: { label: "Sets", kind: "count" },
  reps: { label: "Reps", kind: "count" },
  loadKg: { label: "Top load", kind: "weight" },
  rounds: { label: "Rounds", kind: "count" },
  roundDurationSec: { label: "Round length", kind: "duration" },
  setsWon: { label: "Sets won", kind: "count" },
  score: { label: "Score", kind: "text" },
  holes: { label: "Holes played", kind: "count" },
  strokes: { label: "Strokes", kind: "count" },
  arrows: { label: "Arrows", kind: "count" },
  strokeStyle: { label: "Stroke", kind: "text" },
  opponent: { label: "Opponent", kind: "text" },
  result: { label: "Result", kind: "text" },
  effort: { label: "Perceived effort", kind: "effort" }
};

const SPORTS: SportDef[] = [
  { id: "running", label: "Running", group: "endurance", metrics: ["durationSec", "distanceM", "pace", "elevationM", "effort"] },
  { id: "cycling", label: "Cycling", group: "endurance", metrics: ["durationSec", "distanceM", "speed", "elevationM", "effort"] },
  { id: "swimming", label: "Swimming", group: "endurance", metrics: ["durationSec", "distanceM", "pace", "strokeStyle", "effort"] },
  { id: "strength", label: "Strength", group: "strength", metrics: ["durationSec", "sets", "reps", "loadKg", "effort"] },
  { id: "boxing", label: "Boxing", group: "combat", metrics: ["durationSec", "rounds", "roundDurationSec", "result", "effort"] },
  { id: "mma", label: "MMA", group: "combat", metrics: ["durationSec", "rounds", "roundDurationSec", "result", "effort"] },
  { id: "taekwondo", label: "Taekwondo", group: "combat", metrics: ["durationSec", "rounds", "roundDurationSec", "score", "result"] },
  { id: "martial-arts", label: "Martial arts", group: "combat", metrics: ["durationSec", "rounds", "score", "effort"] },
  { id: "tennis", label: "Tennis", group: "racket", metrics: ["durationSec", "setsWon", "score", "opponent", "effort"] },
  { id: "pickleball", label: "Pickleball", group: "racket", metrics: ["durationSec", "setsWon", "score", "opponent", "effort"] },
  { id: "golf", label: "Golf", group: "precision", metrics: ["durationSec", "holes", "strokes", "score", "effort"] },
  { id: "archery", label: "Archery", group: "precision", metrics: ["durationSec", "arrows", "score", "effort"] },
  { id: "team-sports", label: "Team sports", group: "team", metrics: ["durationSec", "score", "result", "effort"] },
  { id: "other", label: "Other", group: "other", metrics: ["durationSec", "score", "effort"] }
];

function sportById(id: string): SportDef | null {
  return SPORTS.find(function (s) { return s.id === id; }) || null;
}

function sportsInGroup(group: string): SportDef[] {
  return SPORTS.filter(function (s) { return s.group === group; });
}

/** Metric definitions for a sport, in display order. Unknown sport = []. */
function metricDefs(sportId: string): { key: string; label: string; kind: MetricDef["kind"] }[] {
  const sport = sportById(sportId);
  if (!sport) return [];
  return sport.metrics.map(function (key) {
    return { key: key, label: METRICS[key].label, kind: METRICS[key].kind };
  });
}

/** A partial activity as the model sees it — any metric the sport allows. */
export interface ActivityInput {
  sport?: string | null;
  durationSec?: number | null;
  distanceM?: number | null;
  elevationM?: number | null;
  sets?: number | null;
  reps?: number | null;
  loadKg?: number | null;
  rounds?: number | null;
  roundDurationSec?: number | null;
  setsWon?: number | null;
  score?: number | string | null;
  holes?: number | null;
  strokes?: number | null;
  arrows?: number | null;
  strokeStyle?: string | null;
  opponent?: string | null;
  result?: string | null;
  effort?: number | null;
  [key: string]: unknown;
}

/** Format one metric for display, or null when the activity lacks a value. */
function formatMetric(key: string, activity: ActivityInput | null | undefined, unit?: string): string | null {
  const def = METRICS[key];
  if (!def || !activity) return null;
  if (key === "pace") {
    if (!activity.distanceM || !activity.durationSec) return null;
    return fmtPace(activity.durationSec / (activity.distanceM / 1000));
  }
  if (key === "speed") {
    if (!activity.distanceM || !activity.durationSec) return null;
    return ((activity.distanceM / 1000) / (activity.durationSec / 3600)).toFixed(1) + " km/h";
  }
  const v = activity[key];
  if (v === null || v === undefined || v === "") return null;
  switch (def.kind) {
    case "duration": return typeof v === "number" ? fmtDur(v) : null;
    case "distance": return typeof v === "number" ? fmtDist(v, unit) : null;
    case "height": return typeof v === "number" ? Math.round(v) + " m" : null;
    case "weight": return typeof v === "number" ? v + " kg" : null;
    case "count": return typeof v === "number" ? String(v) : null;
    case "effort": return typeof v === "number" ? v + "/10" : null;
    default: return String(v);
  }
}

/** The metrics an activity actually has, ready to render. */
function activityMetrics(activity: ActivityInput | null | undefined, unit?: string): { key: string; label: string; value: string }[] {
  if (!activity || !activity.sport) return [];
  const out: { key: string; label: string; value: string }[] = [];
  metricDefs(activity.sport).forEach(function (def) {
    const value = formatMetric(def.key, activity, unit);
    if (value !== null) out.push({ key: def.key, label: def.label, value: value });
  });
  return out;
}

/** Validation issue for one field (field is null for a whole-object problem). */
export interface ActivityError {
  field: string | null;
  message: string;
}

/**
 * Shape validation for an activity about to be stored. Rejects nonsense but
 * never invents missing values — absent metrics stay absent.
 */
function validateActivity(activity: ActivityInput | null | undefined): { ok: boolean; errors: ActivityError[] } {
  const errors: ActivityError[] = [];
  if (!activity || typeof activity !== "object") {
    return { ok: false, errors: [{ field: null, message: "Activity must be an object." }] };
  }
  const sport = sportById(String(activity.sport || ""));
  if (!sport) return { ok: false, errors: [{ field: "sport", message: "Unknown sport." }] };
  const allowed = sport.metrics;
  const limits: Record<string, number> = {
    durationSec: 86400, distanceM: 1000000, elevationM: 10000, sets: 100, reps: 1000,
    loadKg: 1000, rounds: 100, roundDurationSec: 3600, setsWon: 20, holes: 36,
    strokes: 300, arrows: 1000, effort: 10
  };
  const whole = ["sets", "reps", "rounds", "setsWon", "holes", "strokes", "arrows"];
  Object.keys(activity).forEach(function (key) {
    if (allowed.indexOf(key) < 0) return;
    const def = METRICS[key];
    if (!def) return;
    const v = activity[key];
    if (v === null || v === undefined) return;
    if (limits[key] !== undefined) {
      if (typeof v !== "number" || isNaN(v)) { errors.push({ field: key, message: def.label + " must be a number." }); return; }
      if (v < 0) { errors.push({ field: key, message: def.label + " cannot be negative." }); return; }
      if (v > limits[key]) { errors.push({ field: key, message: def.label + " exceeds a plausible maximum." }); return; }
      if (whole.indexOf(key) >= 0 && Math.round(v) !== v) {
        errors.push({ field: key, message: def.label + " must be a whole number." });
      }
      return;
    }
    if (typeof v !== "number" && typeof v !== "string") {
      errors.push({ field: key, message: def.label + " must be text." });
      return;
    }
    if (typeof v === "string" && v.length > 200) {
      errors.push({ field: key, message: def.label + " is too long." });
    }
  });
  return { ok: errors.length === 0, errors: errors };
}

/* ---------- Fuel & recovery — daily aggregates from what you logged ----------
   Mirrors js/domain.js exactly. Every value is derived from user entries; the
   meal figures stay explicitly labeled as user-entered estimates. */

/**
 * Calendar day an entry belongs to, in the athlete's local time (mirrors
 * js/domain.js). Date-only strings pass through; full timestamps are converted
 * so an evening entry is not pushed onto the next day by its UTC text.
 */
function logToDate(iso?: string | null): string | null {
  if (!iso || typeof iso !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (!m) return null;
  if (iso.length <= 10) return m[1];
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return m[1];
  return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate());
}

/** Ordered daily aggregate for the last `weeks` weeks ending today. */
function recoverySeries(state: AppState, weeks?: number): RecoveryDay[] {
  const count = weeks || 4;
  const out: RecoveryDay[] = [];
  const today = new Date();
  const meals = state.meals || [];
  for (let w = count - 1; w >= 0; w--) {
    const back = (today.getDay() + 6) % 7; // days since Monday (Sunday belongs to the week that started Monday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - back - w * 7);
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + d);
      // Local calendar date — toISOString() would shift a day east of UTC.
      const date = day.getFullYear() + "-" + pad2(day.getMonth() + 1) + "-" + pad2(day.getDate());
      const r = (state.readiness || []).find(function (x) { return x.date === date; });
      const h = (state.hydration || []).find(function (x) { return x.date === date; });
      const mealCount = meals.filter(function (m) { return logToDate(m.time) === date; }).length;
      const trained = (state.log || []).some(function (s) { return logToDate(s.startedAt) === date; });
      out.push({
        date: date,
        weekday: DAY_ORDER[day.getDay() === 0 ? 6 : day.getDay() - 1],
        rest: !trained,
        readiness: r ? { energy: r.energy, soreness: r.soreness } : null,
        hydration: h ? h.ml : null,
        meals: mealCount
      });
    }
  }
  return out;
}

/** Plain recommendation, not a medical judgment. */
function restDayRecommendation(state: AppState): RestDayKit {
  /* "Last 7 days" = the 7 elapsed local days ending today. The old slice took
     the last seven cells of a Mon–Sun grid, so on Mon–Sat it counted future
     days and reported too few training days. Two weeks guarantee seven
     elapsed days across the week boundary. Mirrors js/domain.js. */
  const series = recoverySeries(state, 2);
  const today = getPlatformBindings().todayISO();
  const last7 = series.filter(function (d) { return d.date <= today; }).slice(-7);
  const trainingDays = last7.filter(function (d) { return !d.rest; }).length;
  const lowEnergyDays = last7.filter(function (d) { return d.readiness && (d.readiness.energy || 0) <= 2; }).length;
  const kit: RestDayKit = {
    trainingDaysLast7: trainingDays,
    lowEnergyDaysLast7: lowEnergyDays,
    suggestion: null,
    why: "",
    confidence: 2,
    source: "Derived from your logged sessions and readiness entries this week — your own data, not a measured recovery metric."
  };
  if (trainingDays >= 6 && lowEnergyDays >= 2) {
    kit.suggestion = "Consider a scheduled rest day this week if you haven't taken one already.";
    kit.why = "You trained on " + trainingDays + " of the last 7 days and rated energy low on " + lowEnergyDays + " of them. A planned rest day is part of the program, not a lapse.";
  } else if (trainingDays >= 5) {
    kit.suggestion = "If today is your sixth session day this week, a rest or mobility day is reasonable.";
    kit.why = "At " + trainingDays + " training days in 7, you're at typical weekly capacity for most intermediates. Recovery is when the work sticks.";
  } else {
    kit.suggestion = "Your week has room — keep today's plan unless your readiness says otherwise.";
    kit.why = "You trained on " + trainingDays + " of the last 7 days, which leaves normal recovery headroom for this week.";
  }
  return kit;
}

/** Honest label attached wherever meal totals are shown. */
function mealEstimateLabel(meals?: MealEntry[]): string {
  if (!meals || !meals.length) return "No meals logged — shown values are estimates only.";
  return "Meal entries are user-entered estimates (not tracked intake). Totals are directional, not exact.";
}

function fuelSummary(state: AppState): FuelSummary {
  const today = getPlatformBindings().todayISO();
  const hRow = (state.hydration || []).find(function (h) { return h.date === today; });
  const meals = (state.meals || []).filter(function (m) { return logToDate(m.time) === today; });
  const mealCals = meals.reduce(function (a, m) { return a + (typeof m.calories === "number" ? m.calories : 0); }, 0);
  const mealProtein = meals.reduce(function (a, m) { return a + (typeof m.proteinG === "number" ? m.proteinG : 0); }, 0);
  return {
    date: today,
    hydrationMl: hRow ? hRow.ml : 0,
    hydrationLogged: !!hRow,
    mealsLogged: meals.length,
    mealCalories: mealCals,
    mealProteinG: mealProtein,
    mealEstimateLabel: mealEstimateLabel(meals)
  };
}

/* ---------- Session clock math (pure — used by session recording) ---------- */

const SESSION_IDLE_FREEZE_MS = 10 * 60 * 1000; // >10 min closed ⇒ freeze the clock

// Live elapsed seconds for a session object. nowMs is injectable for tests.
function elapsedSec(session: ClockState | null, nowMs?: number): number {
  if (!session) return 0;
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  return Math.floor((session.elapsedBase + (session.paused ? 0 : now - session.startMs)) / 1000);
}

// Called when an active session is reloaded from storage. If the app was
// closed for longer than idleFreezeMs while the clock was running, freeze the
// clock so idle time is not counted. Returns {session, frozen}.
function resumeSession(session: ClockState, nowMs?: number, idleFreezeMs?: number): SessionResult {
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const limit = typeof idleFreezeMs === "number" ? idleFreezeMs : SESSION_IDLE_FREEZE_MS;
  const updated = session.updatedAt || 0;
  if (!updated || now - updated <= limit) return { session: session, frozen: false };
  const s: ClockState = Object.assign({}, session);
  if (!s.paused) {
    s.elapsedBase += Math.max(0, updated - s.startMs);
    s.paused = true;
  }
  s.startMs = now;
  return { session: s, frozen: true };
}

/* ---------- Formatting ---------- */

function fmt(n?: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function fmtPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function fmtDur(sec?: number | null): string {
  if (sec === undefined || sec === null || isNaN(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function fmtDurHuman(sec?: number | null): string {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return m + " min";
  return Math.floor(m / 60) + "h " + (m % 60) + "m";
}

function fmtDist(m?: number | null, unit?: string): string {
  if (!m && m !== 0) return "—";
  if (unit === "imperial") return ((m as number) / 1609.34).toFixed(2) + " mi";
  return ((m as number) / 1000).toFixed(2) + " km";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function relDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return diff + " days ago";
  return fmtDate(iso);
}

export {
  DAY_ORDER,
  METRICS,
  SPORTS,
  sportById,
  sportsInGroup,
  metricDefs,
  formatMetric,
  activityMetrics,
  validateActivity,
  EXERCISES,
  GOAL_LABELS,
  EQUIP_LABELS,
  EXPERIENCE_LABELS,
  availableExercises,
  planFor,
  strengthPRs,
  runningPRs,
  est1RM,
  weeklyVolumeSeries,
  readinessAverage,
  insights,
  coachRecommendations,
  nextPlannedSession,
  weekStartISO,
  effectivePlanDay,
  rebalanceWeek,
  recentTopSets,
  recoverySeries,
  restDayRecommendation,
  mealEstimateLabel,
  fuelSummary,
  elapsedSec,
  resumeSession,
  runningIntervalSummary,
  SESSION_IDLE_FREEZE_MS,
  fmt,
  fmtPace,
  fmtDur,
  fmtDurHuman,
  fmtDist,
  fmtDate,
  fmtDateFull,
  relDay
};