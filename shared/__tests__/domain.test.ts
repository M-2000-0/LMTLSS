/* Jest port of the domain-test sections of js/tests.js (browser harness:
   tests.html). Assertion names are preserved 1:1 so a failure here maps
   directly back to the browser suite. This covers js/domain.js only — the
   store-migration, pricing, share-card and UI assertions remain in the
   browser suite (130 assertions total there).

   Conditions are identical to tests.html: empty stored state (the default
   platform bindings), so plan generation, trends and coach rules observe the
   same inputs as in the browser. */

import * as Domain from "../src/domain";
import { todayISO } from "../src/platform";
import type { AppState, PlannedSession, Profile } from "../src/types";

const baseProfile: Profile = {
  goal: "strength",
  sports: ["strength"],
  experience: "intermediate",
  daysPerWeek: 4,
  equipment: ["full-gym"]
};

/* ---------- planFor ---------- */

describe("planFor", () => {
  const gymPlan = Domain.planFor({ ...baseProfile });

  it("gym plan session count = 4", () => {
    expect(gymPlan.sessions.length).toBe(4);
  });
  it("gym plan strength sessions are non-empty", () => {
    expect(
      gymPlan.sessions
        .filter((s) => s.sport === "strength")
        .every((s) => s.exercises.length >= 3)
    ).toBe(true);
  });
  it("gym push day contains Back Squat", () => {
    expect(
      gymPlan.sessions.some(
        (s) =>
          s.title.indexOf("Push") >= 0 &&
          s.exercises.some((e) => e.name === "Back Squat")
      )
    ).toBe(true);
  });
  it("plan assigns unique days", () => {
    const days = gymPlan.sessions.map((s) => s.day);
    expect(new Set(days).size).toBe(days.length);
  });
  it("rationale mentions goal and experience", () => {
    expect(gymPlan.rationale.join(" ").indexOf("Intermediate") >= 0).toBe(true);
  });

  const bwPlan = Domain.planFor({ ...baseProfile, equipment: ["bodyweight"] });
  const bwStrength = bwPlan.sessions.filter((s) => s.sport === "strength");

  it("bodyweight plan never yields empty sessions", () => {
    expect(bwStrength.every((s) => s.exercises.length >= 1)).toBe(true);
  });
  it("bodyweight plan uses only available exercises", () => {
    expect(
      bwStrength.every((s) =>
        s.exercises.every(
          (e) =>
            ["Push-Up", "Plank"].indexOf(e.name) >= 0 ||
            Domain.availableExercises(["bodyweight"]).some((a) => a.name === e.name)
        )
      )
    ).toBe(true);
  });
  it("bodyweight plan minutes are plausible", () => {
    expect(bwStrength.every((s) => s.estMinutes >= 20)).toBe(true);
  });

  const runPlan = Domain.planFor({
    ...baseProfile,
    sports: ["strength", "running"],
    daysPerWeek: 5
  });
  const runSessions = runPlan.sessions.filter((s) => s.sport === "running");

  it("mixed plan includes runs", () => {
    expect(runSessions.length >= 1).toBe(true);
  });
  it("run sessions carry no exercises", () => {
    expect(runSessions.every((s) => s.exercises.length === 0)).toBe(true);
  });
  it("run sessions have durations", () => {
    expect(runSessions.every((s) => s.estMinutes >= 20)).toBe(true);
  });

  const bwOnlyRuns = Domain.planFor({ ...baseProfile, equipment: ["outdoor"] });
  it("outdoor-only plan still yields trainable sessions", () => {
    expect(
      bwOnlyRuns.sessions.every(
        (s) => s.exercises.length >= 1 || s.sport === "running"
      )
    ).toBe(true);
  });

  const bigWeek = Domain.planFor({ ...baseProfile, daysPerWeek: 6 });
  it("6-day plan caps at 6", () => {
    expect(bigWeek.sessions.length).toBe(6);
  });
  const smallWeek = Domain.planFor({ ...baseProfile, daysPerWeek: 1 });
  it("1-day request floors at 2", () => {
    expect(smallWeek.sessions.length >= 2).toBe(true);
  });
});

/* ---------- availableExercises ---------- */

describe("availableExercises", () => {
  it("bodyweight moves are always available", () => {
    expect(
      Domain.availableExercises(["dumbbells"]).some((e) => e.name === "Push-Up")
    ).toBe(true);
  });
  it("barbell-only excludes dumbbell curls", () => {
    expect(
      Domain.availableExercises(["barbell"]).some((e) => e.name === "Biceps Curl")
    ).toBe(false);
  });
  it("full gym gets everything", () => {
    expect(Domain.availableExercises(["full-gym"]).length).toBe(
      Domain.EXERCISES.length
    );
  });
});

/* ---------- e1RM & records ---------- */

describe("e1RM & records", () => {
  it("Epley 100x5", () => {
    expect(Domain.est1RM(100, 5)).toBe(117);
  });
  it("Epley single = load", () => {
    expect(Domain.est1RM(100, 1)).toBe(100);
  });
  it("no load = 0", () => {
    expect(Domain.est1RM(0, 5)).toBe(0);
  });

  const prState: AppState = {
    log: [
      { id: "a", sport: "strength", startedAt: "2026-01-01T10:00:00Z", exercises: [{ name: "Bench Press", sets: [{ reps: 5, load: 80, done: true }] }] },
      { id: "b", sport: "strength", startedAt: "2026-01-08T10:00:00Z", exercises: [{ name: "Bench Press", sets: [{ reps: 3, load: 95, done: true }] }] },
      { id: "c", sport: "strength", startedAt: "2026-01-15T10:00:00Z", exercises: [{ name: "Bench Press", sets: [{ reps: 5, load: 75, done: true }, { reps: 1, load: 100, done: true }] }] },
      { id: "d", sport: "running", startedAt: "2026-01-16T10:00:00Z", distanceM: 5000, durationSec: 1500, title: "Easy Run" },
      { id: "e", sport: "running", startedAt: "2026-01-20T10:00:00Z", distanceM: 10000, durationSec: 3300, title: "Long Run" }
    ],
    readiness: [],
    settings: { unit: "metric" },
    plan: { sessions: [] },
    profile: baseProfile
  };
  const prs = Domain.strengthPRs(prState);

  it("PR picks highest e1RM (95x3=105 vs 80x5=93 vs 100x1=100)", () => {
    expect(prs["Bench Press"].e1rm).toBe(105);
  });
  it("PR source session", () => {
    expect(prs["Bench Press"].sessionId).toBe("b");
  });

  const rprs = Domain.runningPRs(prState);
  it("Long Run recorded pace (5:30/km)", () => {
    expect(Math.round(rprs["Long Run"].paceSec)).toBe(330);
  });
  it("Easy Run recorded pace (5:00/km)", () => {
    expect(Math.round(rprs["Easy Run"].paceSec)).toBe(300);
  });
  it("running PRs keyed per title keep each best", () => {
    expect(!!rprs["Easy Run"] && !!rprs["Long Run"]).toBe(true);
  });
});

/* ---------- trends ---------- */

describe("trends", () => {
  const prLog = [
    { id: "a", sport: "strength", startedAt: "2026-01-01T10:00:00Z", exercises: [{ name: "Bench Press", sets: [{ reps: 5, load: 80, done: true }] }] }
  ];
  const series = Domain.weeklyVolumeSeries({ log: prLog }, 4);

  it("series length", () => {
    expect(series.length).toBe(4);
  });
  it("old log falls outside 4-week window", () => {
    expect(series[3].vol).toBe(0);
  });

  const now = Date.now();
  const fresh: AppState = {
    log: [
      { sport: "strength", startedAt: new Date(now - 1 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }] }] },
      { sport: "strength", startedAt: new Date(now - 2 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }, { reps: 5, load: 100, done: true }] }] },
      { sport: "running", startedAt: new Date(now - 3 * 86400000).toISOString(), distanceM: 6000, durationSec: 2100 }
    ]
  };
  const freshSeries = Domain.weeklyVolumeSeries(fresh, 2);

  it("current week volume = 1500 kg", () => {
    expect(freshSeries[1].vol).toBe(1500);
  });
  it("current week run meters", () => {
    expect(freshSeries[1].runM).toBe(6000);
  });
  it("prior week empty", () => {
    expect(freshSeries[0].vol).toBe(0);
  });
});

/* ---------- insights ---------- */

describe("insights", () => {
  const now = Date.now();
  const fresh: AppState = {
    log: [
      { sport: "strength", startedAt: new Date(now - 1 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }] }] },
      { sport: "strength", startedAt: new Date(now - 2 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }, { reps: 5, load: 100, done: true }] }] },
      { sport: "running", startedAt: new Date(now - 3 * 86400000).toISOString(), distanceM: 6000, durationSec: 2100 }
    ]
  };

  it("no log = no insights", () => {
    expect(Domain.insights({ log: [] }).length).toBe(0);
  });
  it("single week of data = no fabricated trend", () => {
    expect(Domain.insights(fresh).length).toBe(0);
  });

  // Add a comparable prior week so a real trend exists.
  const insState: AppState = {
    log: (fresh.log || []).concat([{
      sport: "strength",
      startedAt: new Date(now - 8 * 86400000).toISOString(),
      exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }, { reps: 5, load: 100, done: true }] }]
    }])
  };
  const ins = Domain.insights(insState);

  it("volume insight cites measured sets", () => {
    expect(
      ins.some((i) => i.text.indexOf("1,500") >= 0 && i.source.indexOf("logged") >= 0)
    ).toBe(true);
  });
  it("volume insight states the week-over-week change", () => {
    expect(ins.some((i) => i.text.indexOf("50%") >= 0)).toBe(true);
  });

  // Regression: a single working set must render "1 working set", never "1 working sets".
  const singleSetState: AppState = {
    log: [
      { sport: "strength", startedAt: new Date(now - 1 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }] }] },
      { sport: "strength", startedAt: new Date(now - 9 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }, { reps: 5, load: 100, done: true }] }] }
    ]
  };
  const oneIns = Domain.insights(singleSetState);
  it('singular set count renders as "1 working set"', () => {
    expect(
      oneIns.some(
        (i) =>
          i.text.indexOf("1 working set.") >= 0 &&
          i.text.indexOf("1 working sets") < 0
      )
    ).toBe(true);
  });
});

/* ---------- coach rules ---------- */

describe("coach rules", () => {
  const now = Date.now();
  const fresh: AppState = {
    log: [
      { sport: "strength", startedAt: new Date(now - 1 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }] }] },
      { sport: "strength", startedAt: new Date(now - 2 * 86400000).toISOString(), exercises: [{ name: "X", sets: [{ reps: 5, load: 100, done: true }, { reps: 5, load: 100, done: true }] }] },
      { sport: "running", startedAt: new Date(now - 3 * 86400000).toISOString(), distanceM: 6000, durationSec: 2100 }
    ]
  };
  const gymPlan = Domain.planFor({ ...baseProfile });

  it("empty history suggests logging first", () => {
    const emptyCoach = Domain.coachRecommendations({
      log: [],
      profile: baseProfile,
      plan: { sessions: [] },
      readiness: []
    });
    expect(
      emptyCoach.length === 1 && emptyCoach[0].title.indexOf("first session") >= 0
    ).toBe(true);
  });
  it("every rec carries why + confidence", () => {
    expect(
      Domain.coachRecommendations({
        log: fresh.log,
        profile: baseProfile,
        plan: gymPlan,
        readiness: []
      }).every((r) => r.why && r.confidence >= 1)
    ).toBe(true);
  });
  it("low readiness triggers rest suggestion", () => {
    const lowReady: AppState = {
      log: fresh.log,
      profile: baseProfile,
      plan: gymPlan,
      readiness: [{ date: todayISO(), energy: 2, soreness: 4 }]
    };
    expect(
      Domain.coachRecommendations(lowReady).some(
        (r) => r.title.indexOf("rest") >= 0
      )
    ).toBe(true);
  });
});

/* ---------- sport model ---------- */

describe("sport model", () => {
  it("covers the advertised activity list", () => {
    expect(Domain.SPORTS.length).toBe(14);
  });
  it("boxing records rounds", () => {
    expect(Domain.sportById("boxing")?.metrics).toContain("rounds");
  });
  it("running does not record rounds", () => {
    expect(Domain.sportById("running")?.metrics).not.toContain("rounds");
  });
  it("unknown sport has no metric definitions", () => {
    expect(Domain.metricDefs("quidditch")).toEqual([]);
  });
  it("combat sports are grouped together", () => {
    expect(Domain.sportsInGroup("combat").length).toBe(4);
  });
  it("run metrics include derived pace", () => {
    const m = Domain.activityMetrics({ sport: "running", durationSec: 1500, distanceM: 5000 }, "metric");
    expect(m.some((x) => x.key === "pace" && x.value === "5:00")).toBe(true);
  });
  it("run metrics never include rounds", () => {
    const m = Domain.activityMetrics({ sport: "running", durationSec: 1500, distanceM: 5000 }, "metric");
    expect(m.every((x) => x.key !== "rounds")).toBe(true);
  });
  it("absent metrics are not invented", () => {
    const m = Domain.activityMetrics({ sport: "running", durationSec: 600 }, "metric");
    expect(m.every((x) => x.key !== "distanceM" && x.key !== "pace")).toBe(true);
  });
  it("boxing reports rounds", () => {
    const m = Domain.activityMetrics({ sport: "boxing", rounds: 6 }, "metric");
    expect(m.some((x) => x.key === "rounds" && x.value === "6")).toBe(true);
  });
  it("valid run passes validation", () => {
    expect(Domain.validateActivity({ sport: "running", durationSec: 1800, distanceM: 5000 }).ok).toBe(true);
  });
  it("negative duration is rejected and names the field", () => {
    const r = Domain.validateActivity({ sport: "running", durationSec: -5 });
    expect(r.ok).toBe(false);
    expect(r.errors[0].field).toBe("durationSec");
  });
  it("fractional reps are rejected", () => {
    expect(Domain.validateActivity({ sport: "strength", reps: 4.5 }).ok).toBe(false);
  });
  it("unknown sport is rejected", () => {
    expect(Domain.validateActivity({ sport: "quidditch", durationSec: 60 }).ok).toBe(false);
  });
  it("metrics the sport cannot record are ignored, not errors", () => {
    expect(Domain.validateActivity({ sport: "running", durationSec: 600, rounds: 3 }).ok).toBe(true);
  });
});

/* ---------- formatting ---------- */

describe("formatting", () => {
  it("pace 330s = 5:30", () => {
    expect(Domain.fmtPace(330)).toBe("5:30");
  });
  it("pace 59s = 0:59", () => {
    expect(Domain.fmtPace(59)).toBe("0:59");
  });
  it("dur 150 = 2:30", () => {
    expect(Domain.fmtDur(150)).toBe("2:30");
  });
  it("dur 3725 = 1:02:05", () => {
    expect(Domain.fmtDur(3725)).toBe("1:02:05");
  });
  it("dist km", () => {
    expect(Domain.fmtDist(6500, "metric")).toBe("6.50 km");
  });
  it("dist mi", () => {
    expect(Domain.fmtDist(6500, "imperial")).toBe("4.04 mi");
  });
  it("relDay today", () => {
    expect(Domain.relDay(new Date().toISOString())).toBe("Today");
  });
  it("relDay yesterday", () => {
    expect(Domain.relDay(new Date(Date.now() - 86400000).toISOString())).toBe(
      "Yesterday"
    );
  });
});

/* ---------- nextPlannedSession ---------- */

describe("nextPlannedSession", () => {
  const gymPlan = Domain.planFor({ ...baseProfile });

  it("next session is a plan item", () => {
    const next = Domain.nextPlannedSession({ plan: gymPlan });
    expect(gymPlan.sessions.indexOf(next!)).toBeGreaterThanOrEqual(0);
  });
  it("no plan = null", () => {
    expect(Domain.nextPlannedSession({ plan: { sessions: [] } })).toBeNull();
  });
});

/* ---------- session clock math ---------- */

describe("session clock math", () => {

  it("runningIntervalSummary counts work/rest and completed segments", () => {
    const summary = Domain.runningIntervalSummary({
      durationSec: 500,
      distanceM: 2500,
      intervalTemplate: {
        name: "Tempo Intervals",
        segments: [
          { index: 0, segmentType: "work", targetDurationSec: 100, durationSec: 100, done: true },
          { index: 1, segmentType: "rest", targetDurationSec: 100, durationSec: 100, done: true },
          { index: 2, segmentType: "work", targetDurationSec: 100, durationSec: null, done: false },
          { index: 3, segmentType: "rest", targetDurationSec: 100, durationSec: null, done: false }
        ]
      },
      intervalSegments: [
        { index: 0, segmentType: "work", targetDurationSec: 100, durationSec: 100, done: true },
        { index: 1, segmentType: "rest", targetDurationSec: 100, durationSec: 100, done: true },
        { index: 2, segmentType: "work", targetDurationSec: 100, durationSec: null, done: false },
        { index: 3, segmentType: "rest", targetDurationSec: 100, durationSec: null, done: false }
      ]
    });
    expect(summary.workCount).toBe(2);
    expect(summary.restCount).toBe(2);
    expect(summary.completedSegments).toBe(2);
    expect(summary.totalWorkSec).toBe(100);
    expect(summary.totalRestSec).toBe(100);
  });

  it("runningIntervalSummary with no interval data reports zero work", () => {
    const summary = Domain.runningIntervalSummary({ durationSec: 600 });
    expect(summary.workCount).toBe(0);
    expect(summary.completedSegments).toBe(0);
    expect(summary.lastSegmentIndex).toBe(-1);
    expect(summary.template).toBeNull();
  });

  const mNow = Date.now();

  it("elapsed counts live time", () => {
    expect(
      Domain.elapsedSec(
        { elapsedBase: 60000, startMs: mNow - 30000, paused: false },
        mNow
      )
    ).toBe(90);
  });
  it("elapsed while paused is frozen", () => {
    expect(
      Domain.elapsedSec(
        { elapsedBase: 60000, startMs: mNow - 30000, paused: true },
        mNow
      )
    ).toBe(60);
  });

  const shortGap = Domain.resumeSession(
    { elapsedBase: 60000, startMs: mNow - 20000, paused: false, updatedAt: mNow - 5000 },
    mNow
  );
  it("short gap: not frozen", () => {
    expect(shortGap.frozen).toBe(false);
  });
  it("short gap: clock keeps running", () => {
    expect(Domain.elapsedSec(shortGap.session, mNow)).toBe(80);
  });

  const longGap = Domain.resumeSession(
    { elapsedBase: 60000, startMs: mNow - 20 * 60000, paused: false, updatedAt: mNow - 15 * 60000 },
    mNow
  );
  it("long gap: frozen", () => {
    expect(longGap.frozen).toBe(true);
  });
  it("long gap: idle time not counted", () => {
    expect(longGap.session.elapsedBase).toBe(60000 + 5 * 60000);
  });
  it("long gap: session paused", () => {
    expect(longGap.session.paused).toBe(true);
  });

  const pausedGap = Domain.resumeSession(
    { elapsedBase: 60000, startMs: mNow - 20 * 60000, paused: true, updatedAt: mNow - 20 * 60000 },
    mNow
  );
  it("long gap while already paused: elapsed unchanged", () => {
    expect(pausedGap.session.elapsedBase).toBe(60000);
  });
  it("no updatedAt: never frozen", () => {
    expect(
      Domain.resumeSession({ elapsedBase: 0, startMs: mNow, paused: false }, mNow)
        .frozen
    ).toBe(false);
  });
});

/* ---------- adaptive calendar (explainable weekly rebalancing) ---------- */

describe("adaptive calendar (explainable weekly rebalancing)", () => {
  const mkPlanS = (
    id: string,
    day: string,
    sport: string,
    title: string,
    rpe: number
  ): PlannedSession => ({
    id,
    day,
    sport,
    title,
    exercises:
      sport === "strength"
        ? [{
            name: "Back Squat",
            targetSets: 3,
            targetReps: 5,
            targetLoad: null,
            lastLoad: null,
            lastReps: null,
            restSec: 150
          }]
        : [],
    estMinutes: 40,
    targetRPE: rpe
  });

  // Fixed instants (local calendar time) so weekday math is deterministic.
  const wWed = new Date(2026, 9, 14, 9, 0, 0).getTime(); // Wed 2026-10-14, week of Mon 2026-10-12
  const wThu = new Date(2026, 9, 15, 9, 0, 0).getTime(); // Thu 2026-10-15
  const wMonAM = new Date(2026, 9, 12, 7, 0, 0).getTime(); // Mon 2026-10-12 07:00
  const wSun = new Date(2026, 9, 18, 9, 0, 0).getTime(); // Sun 2026-10-18
  const rcPlanA: { sessions: PlannedSession[] } = {
    sessions: [
      mkPlanS("ra", "Mon", "strength", "Push + Squat", 8),
      mkPlanS("rb", "Tue", "running", "Easy Run", 7),
      mkPlanS("rc", "Thu", "strength", "Pull + Hinge", 8),
      mkPlanS("rd", "Fri", "running", "Long Run", 7)
    ]
  };
  const readyNow = todayISO(new Date(wWed));

  const ra1 = Domain.rebalanceWeek({ plan: rcPlanA, log: [], readiness: [] }, wWed);

  it("missed sessions move onto open days (2 moves)", () => {
    expect(Object.keys(ra1.moves).length).toBe(2);
  });
  it("missed strength skips adjacency (Wed sits next to Thu's strength) → Sat", () => {
    expect(ra1.moves.ra).toBe("Sat");
  });
  it("missed run fills the earliest open day (today, Wed)", () => {
    expect(ra1.moves.rb).toBe("Wed");
  });
  it("moves never land on days a pending session occupies", () => {
    expect(
      Object.keys(ra1.moves).every(
        (k) => ra1.moves[k] !== "Thu" && ra1.moves[k] !== "Fri"
      )
    ).toBe(true);
  });
  it("every change explains its why and source", () => {
    expect(
      ra1.changes.every(
        (c) => c.text && c.why && c.why.length > 30 && c.source && c.source.length > 20
      )
    ).toBe(true);
  });
  it("missed-session reasons name the planned day and the log basis", () => {
    expect(
      ra1.changes.every(
        (c) =>
          c.trigger !== "missed" ||
          (c.why.indexOf(c.fromDay) >= 0 && c.source.indexOf("log") >= 0)
      )
    ).toBe(true);
  });

  const ra2 = Domain.rebalanceWeek(
    {
      plan: rcPlanA,
      log: [
        {
          planId: "ra",
          sport: "strength",
          startedAt: new Date(2026, 9, 12, 17, 0, 0).toISOString()
        }
      ],
      readiness: []
    },
    wWed
  );
  it("logged plan session (planId) is never moved", () => {
    expect(!ra2.moves.ra).toBe(true);
  });
  it("remaining missed session fills the now-first open day", () => {
    expect(ra2.moves.rb).toBe("Wed");
  });

  const ra3 = Domain.rebalanceWeek(
    {
      plan: rcPlanA,
      log: [
        {
          sport: "strength",
          title: "Strength — Push + Squat",
          startedAt: new Date(2026, 9, 12, 17, 0, 0).toISOString()
        }
      ],
      readiness: []
    },
    wWed
  );
  it("legacy sport+weekday log covers the planned day (no false 'missed')", () => {
    expect(!ra3.moves.ra).toBe(true);
  });

  const clean = Domain.rebalanceWeek({ plan: rcPlanA, log: [], readiness: [] }, wMonAM);
  it("fresh Monday with nothing missed → no changes", () => {
    expect(clean.changes.length).toBe(0);
  });
  it("untouched week summarizes as on track", () => {
    expect(clean.summary.indexOf("on track") >= 0).toBe(true);
  });

  // Low readiness: today's hard session shifts a day, explainably.
  const rbPlan = { sessions: [mkPlanS("wb", "Wed", "strength", "Push + Squat", 8)] };
  const lowReady = [{ date: readyNow, energy: 2, soreness: 2 }];
  const rr = Domain.rebalanceWeek({ plan: rbPlan, log: [], readiness: lowReady }, wWed);
  it("low readiness moves today's hard session one day", () => {
    expect(rr.moves.wb).toBe("Thu");
  });
  it("readiness change is tagged by its trigger", () => {
    expect(
      rr.changes.filter((c) => c.trigger === "readiness" && c.kind === "move").length
    ).toBe(1);
  });
  it("readiness reason quotes the check-in numbers", () => {
    expect(rr.changes[0].why.indexOf("energy 2/5") >= 0).toBe(true);
  });
  it("readiness source stays a self-rating, not a measurement", () => {
    expect(rr.changes[0].source.indexOf("not a measured") >= 0).toBe(true);
  });

  const rdPlan = {
    sessions: [
      mkPlanS("dm", "Mon", "strength", "Push + Squat", 8),
      mkPlanS("ep", "Wed", "running", "Easy Run", 7)
    ]
  };
  const rr2 = Domain.rebalanceWeek({ plan: rdPlan, log: [], readiness: lowReady }, wWed);
  it("low readiness keeps makeup sessions off today (→ Thu, not Wed)", () => {
    expect(rr2.moves.dm).toBe("Thu");
  });
  it("low readiness alone moves nothing when today's session is easy", () => {
    expect(rr2.changes.filter((c) => c.trigger === "readiness").length).toBe(0);
  });
  it("today's easy run stays put", () => {
    expect(!rr2.moves.ep).toBe(true);
  });

  // Rest-gap preference: strength makeup skipped past an occupied neighbor.
  const spPlan = {
    sessions: [
      mkPlanS("es", "Mon", "strength", "Push + Squat", 8),
      mkPlanS("fs", "Fri", "strength", "Pull + Hinge", 8)
    ]
  };
  const sp = Domain.rebalanceWeek({ plan: spPlan, log: [], readiness: [] }, wThu);
  it("strength makeup prefers a non-adjacent open day", () => {
    expect(sp.moves.es).toBe("Sun");
  });
  it("rest-gap choice is named in the reason", () => {
    expect(sp.changes[0].why.indexOf("back-to-back") >= 0).toBe(true);
  });
  it("pending Friday strength is not relocated", () => {
    expect(!sp.moves.fs).toBe(true);
  });

  // No room left: defer with an explanation instead of silently dropping.
  const fullPlan = {
    sessions: [
      mkPlanS("f1", "Mon", "strength", "Push + Squat", 8),
      mkPlanS("f2", "Tue", "running", "Easy Run", 7),
      mkPlanS("f3", "Wed", "strength", "Pull + Hinge", 8),
      mkPlanS("f4", "Thu", "running", "Easy Run", 7),
      mkPlanS("f5", "Fri", "strength", "Full Body", 8),
      mkPlanS("f6", "Sat", "running", "Long Run", 7)
    ]
  };
  const full = Domain.rebalanceWeek({ plan: fullPlan, log: [], readiness: [] }, wSun);
  it("full week: the single open day (today) is used", () => {
    expect(Object.keys(full.moves).length).toBe(1);
  });
  it("full week: the rest are deferred, listed explicitly", () => {
    expect(full.dropped.length).toBe(5);
  });
  it("deferrals explain that the week is full", () => {
    expect(
      full.changes
        .filter((c) => c.kind === "defer")
        .every((c) => c.why.indexOf("every remaining day") >= 0)
    ).toBe(true);
  });

  it("weekStartISO rolls back to Monday (midweek)", () => {
    expect(Domain.weekStartISO(wWed)).toBe("2026-10-12");
  });
  it("weekStartISO rolls back to Monday (from Sunday)", () => {
    expect(Domain.weekStartISO(wSun)).toBe("2026-10-12");
  });

  const wpState = {
    plan: rcPlanA,
    weekPlan: { weekStart: Domain.weekStartISO(wWed), moves: { ra: "Thu" } }
  };
  it("effectivePlanDay honors a current-week override", () => {
    expect(Domain.effectivePlanDay(rcPlanA.sessions[0], wpState, wWed)).toBe("Thu");
  });
  const staleState = {
    plan: rcPlanA,
    weekPlan: { weekStart: "2026-01-05", moves: { ra: "Sat" } }
  };
  it("effectivePlanDay ignores overrides from another week", () => {
    expect(Domain.effectivePlanDay(rcPlanA.sessions[0], staleState, wWed)).toBe("Mon");
  });

  it("nextPlannedSession skips sessions deferred this week", () => {
    const nxt = Domain.nextPlannedSession(
      {
        plan: rcPlanA,
        weekPlan: { weekStart: Domain.weekStartISO(wWed), dropped: ["rc"] }
      },
      wWed
    );
    expect(nxt?.id).toBe("rd");
  });
  it("nextPlannedSession offers a moved session on its new day", () => {
    const nxt = Domain.nextPlannedSession(
      {
        plan: rcPlanA,
        weekPlan: { weekStart: Domain.weekStartISO(wWed), moves: { rc: "Wed" } }
      },
      wWed
    );
    expect(nxt?.id).toBe("rc");
  });
});