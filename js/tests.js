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

  /* ---------- schema migration & data integrity (store) ---------- */

  const migV1 = Store.migrate({ version: 1, profile: { name: "X" }, settings: { unit: "imperial" } });
  eq("migrate v1: no quarantine", migV1.quarantine, undefined);
  eq("migrate v1: profile preserved", migV1.state.profile.name, "X");
  eq("migrate v1: settings preserved", migV1.state.settings.unit, "imperial");
  eq("migrate v1: missing settings filled with defaults", migV1.state.settings.restSeconds, 90);
  ok("migrate: payload from newer version is quarantined, not accepted", !!Store.migrate({ version: 99 }).quarantine);
  ok("migrate: invalid version is quarantined", !!Store.migrate({ version: 0 }).quarantine);
  ok("migrate: non-object payloads are quarantined", !!Store.migrate(null).quarantine && !!Store.migrate("junk").quarantine);

  // End-to-end: unreadable data must be preserved under the quarantine key, never lost.
  const KEY = "lmtlss:v1";
  const QKEY = KEY + ":quarantine";
  const savedRaw = localStorage.getItem(KEY);
  const savedQ = localStorage.getItem(QKEY);
  localStorage.setItem(KEY, JSON.stringify({ version: 99, profile: { name: "Future Athlete" } }));
  Store.reload();
  eq("reload with newer-version payload starts fresh", Store.get().profile, null);
  const qNewer = JSON.parse(localStorage.getItem(QKEY));
  ok("newer-version payload preserved in quarantine", !!qNewer && qNewer.payload.indexOf("Future Athlete") >= 0,
    localStorage.getItem(QKEY));
  localStorage.setItem(KEY, "{not json");
  Store.reload();
  const qCorrupt = JSON.parse(localStorage.getItem(QKEY));
  ok("corrupt payload preserved in quarantine", !!qCorrupt && qCorrupt.reason === "unparseable JSON" && qCorrupt.payload === "{not json",
    localStorage.getItem(QKEY));
  // Restore storage exactly as it was found.
  if (savedRaw === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, savedRaw);
  if (savedQ === null) localStorage.removeItem(QKEY); else localStorage.setItem(QKEY, savedQ);
  Store.reload();

  /* ---------- session clock math ---------- */

  const mNow = Date.now();
  eq("elapsed counts live time", Domain.elapsedSec({ elapsedBase: 60000, startMs: mNow - 30000, paused: false }, mNow), 90);
  eq("elapsed while paused is frozen", Domain.elapsedSec({ elapsedBase: 60000, startMs: mNow - 30000, paused: true }, mNow), 60);

  const shortGap = Domain.resumeSession({ elapsedBase: 60000, startMs: mNow - 20000, paused: false, updatedAt: mNow - 5000 }, mNow);
  eq("short gap: not frozen", shortGap.frozen, false);
  eq("short gap: clock keeps running", Domain.elapsedSec(shortGap.session, mNow), 80);

  const longGap = Domain.resumeSession({ elapsedBase: 60000, startMs: mNow - 20 * 60000, paused: false, updatedAt: mNow - 15 * 60000 }, mNow);
  eq("long gap: frozen", longGap.frozen, true);
  eq("long gap: idle time not counted", longGap.session.elapsedBase, 60000 + 5 * 60000);
  eq("long gap: session paused", longGap.session.paused, true);

  const pausedGap = Domain.resumeSession({ elapsedBase: 60000, startMs: mNow - 20 * 60000, paused: true, updatedAt: mNow - 20 * 60000 }, mNow);
  eq("long gap while already paused: elapsed unchanged", pausedGap.session.elapsedBase, 60000);
  eq("no updatedAt: never frozen", Domain.resumeSession({ elapsedBase: 0, startMs: mNow, paused: false }, mNow).frozen, false);

  /* ---------- interval run summaries ---------- */

  // Only segments the runner actually recorded are counted. A partial run must
  // never report the plan's work segments as completed work.
  const partialRun = {
    durationSec: 260,
    distanceM: 1500,
    intervalTemplate: {
      name: "6 × 400m",
      segments: [
        { index: 0, segmentType: "work", targetDurationSec: 90 },
        { index: 1, segmentType: "rest", targetDurationSec: 60 },
        { index: 2, segmentType: "work", targetDurationSec: 90 },
        { index: 3, segmentType: "rest", targetDurationSec: 60 },
        { index: 4, segmentType: "work", targetDurationSec: 90 },
        { index: 5, segmentType: "rest", targetDurationSec: 60 }
      ]
    },
    intervalSegments: [
      { index: 0, segmentType: "work", targetDurationSec: 90, durationSec: 88, done: true },
      { index: 1, segmentType: "rest", targetDurationSec: 60, durationSec: 62, done: true },
      { index: 2, segmentType: "work", targetDurationSec: 90, durationSec: 92, done: true }
    ]
  };
  const partial = Domain.runningIntervalSummary(partialRun);
  eq("interval summary counts recorded work segments", partial.workCount, 2);
  eq("interval summary counts recorded rest segments", partial.restCount, 1);
  eq("interval summary records completed segment total", partial.completedSegments, 3);
  eq("interval summary sums recorded work time", partial.totalWorkSec, 180);
  eq("interval summary sums recorded rest time", partial.totalRestSec, 62);
  eq("interval summary keeps the plan length available for the denominator", partialRun.intervalTemplate.segments.length, 6);

  const noSegments = Domain.runningIntervalSummary({ durationSec: 300, distanceM: 1000 });
  eq("interval summary without segments reports zero work", noSegments.workCount, 0);
  eq("interval summary without segments reports zero completed", noSegments.completedSegments, 0);
  eq("interval summary without segments has no template", noSegments.template, null);

  /* ---------- sport model ---------- */

  eq("sports model covers the advertised activity list", Domain.SPORTS.length, 14);
  ok("boxing records rounds", Domain.sportById("boxing").metrics.indexOf("rounds") >= 0);
  ok("running does not record rounds", Domain.sportById("running").metrics.indexOf("rounds") < 0);
  eq("unknown sport has no metric definitions", Domain.metricDefs("quidditch").length, 0);
  eq("combat sports are grouped together", Domain.sportsInGroup("combat").length, 4);

  // Only metrics the sport supports AND the activity actually has are rendered.
  const runMetrics = Domain.activityMetrics({ sport: "running", durationSec: 1500, distanceM: 5000 }, "metric");
  ok("run metrics include pace", runMetrics.some(function (m) { return m.key === "pace" && m.value === "5:00"; }));
  ok("run metrics never include rounds", runMetrics.every(function (m) { return m.key !== "rounds"; }));
  ok("absent metrics are not invented", Domain.activityMetrics({ sport: "running", durationSec: 600 }, "metric").every(function (m) { return m.key !== "distanceM" && m.key !== "pace"; }));
  const boxingMetrics = Domain.activityMetrics({ sport: "boxing", durationSec: 1800, rounds: 6, roundDurationSec: 180 }, "metric");
  ok("boxing reports rounds", boxingMetrics.some(function (m) { return m.key === "rounds" && m.value === "6"; }));
  ok("boxing round length formats as a duration", boxingMetrics.some(function (m) { return m.key === "roundDurationSec" && m.value === "3:00"; }));
  eq("golf strokes have no pace", Domain.formatMetric("pace", { sport: "golf", strokes: 84 }, "metric"), null);

  ok("valid run passes validation", Domain.validateActivity({ sport: "running", durationSec: 1800, distanceM: 5000 }).ok);
  ok("negative duration is rejected", !Domain.validateActivity({ sport: "running", durationSec: -5 }).ok);
  ok("validation names the failing field", Domain.validateActivity({ sport: "running", durationSec: -5 }).errors[0].field === "durationSec");
  ok("fractional reps are rejected", !Domain.validateActivity({ sport: "strength", reps: 4.5 }).ok);
  ok("unknown sport is rejected", !Domain.validateActivity({ sport: "quidditch", durationSec: 60 }).ok);
  ok("metrics the sport cannot record are ignored, not errors", Domain.validateActivity({ sport: "running", durationSec: 600, rounds: 3 }).ok);
  ok("absent metrics stay absent instead of defaulting", Domain.validateActivity({ sport: "archery", arrows: null }).ok);

  /* ---------- pricing engine ---------- */

  // Money: integer minor units, explicit currency, no floats.
  eq("toMinor 12.99 USD", Pricing.toMinor("12.99", "USD"), 1299);
  eq("toMinor 5 USD", Pricing.toMinor("5", "USD"), 500);
  eq("toMinor JPY has no minor units", Pricing.toMinor("1200", "JPY"), 1200);
  eq("toMinor rejects garbage", Pricing.toMinor("12,99", "USD"), null);
  eq("formatMinor 1299 USD", Pricing.formatMinor(1299, "USD"), "$12.99");

  const pcat = Pricing.seedCatalog();
  const pNow = Date.now();

  // Standard price book: region-specific beats ANY; coupon applies to book prices.
  const std = Pricing.resolvePrice(pcat, { planId: "plan_premium", currency: "EUR", region: "EU", interval: "monthly", nowMs: pNow });
  eq("regional row beats ANY", std.amountMinor, 1099);
  eq("regional source labeled", std.source, "regional");
  const def = Pricing.resolvePrice(pcat, { planId: "plan_premium", currency: "EUR", region: "US", interval: "monthly", nowMs: pNow });
  eq("falls back to ANY region", def.amountMinor, 1199);
  eq("default source labeled", def.source, "plan-default");
  const promo = Pricing.resolvePrice(pcat, { planId: "plan_premium", currency: "USD", region: "ANY", interval: "monthly", discountCode: "LAUNCH20", nowMs: pNow });
  eq("coupon reduces book price by 20%", promo.amountMinor, 1039); // round(1299*0.2)=260 → 1039
  eq("discount source labeled", promo.source, "discounted");
  const badCode = Pricing.resolvePrice(pcat, { planId: "plan_premium", currency: "USD", region: "ANY", interval: "monthly", discountCode: "NOPE", nowMs: pNow });
  eq("unknown coupon ignored", badCode.amountMinor, 1299);

  // Custom offer: highest precedence, grandfathered, coupons never stack.
  const mkOffer = Pricing.createOffer(pcat, "test", {
    subjectType: "club", subjectId: "club_rivercity", planId: "plan_premium", billingModel: "flat",
    price: { currency: "EUR", amountMinor: 799, interval: "annual" },
    featureOverrides: { share_studio: { enabled: true, limit: 999 } },
    validFrom: pNow - 1000, validUntil: pNow + 30 * 86400000
  });
  eq("offer created without errors", mkOffer.errors.length, 0);
  const offerPrice = Pricing.resolvePrice(pcat, { planId: "plan_premium", subjectId: "club_rivercity", currency: "EUR", region: "EU", interval: "monthly", nowMs: pNow });
  eq("custom offer beats regional price", offerPrice.amountMinor, 799);
  eq("offer source labeled", offerPrice.source, "custom-offer");
  const offerWithCoupon = Pricing.resolvePrice(pcat, { planId: "plan_premium", subjectId: "club_rivercity", currency: "EUR", region: "EU", interval: "monthly", discountCode: "LAUNCH20", nowMs: pNow });
  eq("coupon never stacks on negotiated offer", offerWithCoupon.amountMinor, 799);
  // Grandfathering: changing the book does not move the negotiated price.
  Pricing.upsertPrice(pcat, "test", { planId: "plan_premium", currency: "EUR", region: "ANY", interval: "monthly", amountMinor: 1599 });
  const afterBookChange = Pricing.resolvePrice(pcat, { planId: "plan_premium", subjectId: "club_rivercity", currency: "EUR", region: "EU", interval: "monthly", nowMs: pNow });
  eq("negotiated price survives book change (grandfathered)", afterBookChange.amountMinor, 799);
  const nonOfferSubj = Pricing.resolvePrice(pcat, { planId: "plan_premium", currency: "EUR", region: "EU", interval: "monthly", nowMs: pNow });
  eq("other subjects see the new book price", nonOfferSubj.amountMinor, 1099);

  // Per-member pricing with volume tiers (piecewise bands).
  eq("memberAmount flat 30 × $5", Pricing.memberAmount(500, null, 30), 15000);
  const tiers = [{ upTo: 25, unitAmountMinor: 400 }, { upTo: null, unitAmountMinor: 300 }];
  eq("volume tiers piecewise (40 members)", Pricing.memberAmount(500, tiers, 40), 25 * 400 + 15 * 300);

  // Subscriptions & entitlements — resolved from relationships, never price.
  const mkSub = Pricing.subscribe(pcat, "test", { subjectId: "club_rivercity", subjectType: "club", planId: "plan_premium", offerId: mkOffer.offer.id, nowMs: pNow });
  eq("subscribe created without errors", mkSub.errors.length, 0);
  const ent = Pricing.resolveEntitlements(pcat, { subjectId: "club_rivercity", nowMs: pNow });
  ok("entitlements include AI coach", !!ent.features.ai_coach);
  eq("AI coach limit honored", ent.features.ai_coach.limit, 200);
  eq("offer feature overrides win over plan", ent.features.share_studio.source, "offer:" + mkOffer.offer.id);
  eq("offer override limit applied", ent.features.share_studio.limit, 999);
  eq("plan features without overrides still resolve", ent.features.ai_coach.source, "plan:plan_premium");
  const chk = Pricing.checkEntitlement(ent, "ai_coach", 150);
  eq("quota: 50 remaining", chk.remaining, 50);
  const chkExhausted = Pricing.checkEntitlement(ent, "ai_coach", 200);
  eq("quota exhausted blocks", chkExhausted.allowed, false);
  const chkOrg = Pricing.checkEntitlement(ent, "org_dashboard", 0);
  eq("feature not in plan blocks", chkOrg.allowed, false);
  // past_due drops all features; price unchanged — proves price ≠ permissions.
  Pricing.setSubscriptionStatus(pcat, "test", mkSub.subscription.id, "past_due");
  const entPastDue = Pricing.resolveEntitlements(pcat, { subjectId: "club_rivercity", nowMs: pNow });
  eq("past_due drops features", Object.keys(entPastDue.features).length, 0);
  const stillPriced = Pricing.resolvePrice(pcat, { planId: "plan_premium", subjectId: "club_rivercity", currency: "EUR", region: "EU", interval: "monthly", nowMs: pNow });
  eq("price unchanged while entitlements dropped (price ≠ permissions)", stillPriced.amountMinor, 799);
  // Canceled keeps access until period end, then expires.
  Pricing.setSubscriptionStatus(pcat, "test", mkSub.subscription.id, "canceled");
  const entCanceledNow = Pricing.resolveEntitlements(pcat, { subjectId: "club_rivercity", nowMs: pNow });
  ok("canceled keeps access before period end", Object.keys(entCanceledNow.features).length > 0);
  const entExpired = Pricing.resolveEntitlements(pcat, { subjectId: "club_rivercity", nowMs: pNow + 400 * 86400000 });
  eq("canceled loses access after period end", Object.keys(entExpired.features).length, 0);
  // Expired offer falls back to book pricing (already covered) & unknown subject has none.
  eq("unknown subject has no entitlements", Object.keys(Pricing.resolveEntitlements(pcat, { subjectId: "nobody", nowMs: pNow }).features).length, 0);

  // Audit trail: every mutation recorded with actor + before/after.
  // seedCatalog() itself is not an audited mutation; the admin loader audits
  // the seed. Here: offer + price + subscribe + 2 status changes = 5.
  ok("audit trail recorded this session", pcat.audit.length >= 5, String(pcat.audit.length));
  const lastAudit = pcat.audit[pcat.audit.length - 1];
  ok("audit entry carries actor and action", !!lastAudit.actor && !!lastAudit.action);
  const priceAudit = pcat.audit.find(function (a) { return a.action === "price.updated" && a.before && a.before.amountMinor === 1199; });
  ok("price change records before/after", !!priceAudit && priceAudit.after.amountMinor === 1599);

  // Boundary validation — invalid rows are rejected, not silently accepted.
  ok("price row rejects float minor units", Pricing.upsertPrice(pcat, "t", { planId: "plan_premium", currency: "USD", region: "ANY", interval: "monthly", amountMinor: 12.99 }).errors.length > 0);
  ok("price row rejects bad currency", Pricing.upsertPrice(pcat, "t", { planId: "plan_premium", currency: "dollars", region: "ANY", interval: "monthly", amountMinor: 1299 }).errors.length > 0);
  ok("plan rejects unknown feature keys", Pricing.createPlan(pcat, "t", { name: "Bad", features: { teleportation: { enabled: true, limit: null } } }).errors.length > 0);

  /* ---------- share cards ---------- */

  const runSess = { sport: "running", title: "Long Run", startedAt: "2026-10-10T07:00:00Z", durationSec: 2700, distanceM: 7500, distanceSource: "manual" };
  const runCard = ShareCards.composeCard(runSess, { unit: "metric" });
  eq("run card kind", runCard.kind, "run");
  eq("run card has 3 stats", runCard.stats.length, 3);
  eq("run card pace formatted", runCard.stats[2].value, "6:00/km");
  ok("manual distance keeps provenance on the card", !!runCard.provenance && runCard.provenance.indexOf("no GPS") >= 0);
  const gpsSess = Object.assign({}, runSess, { distanceSource: "gps" });
  eq("gps-sourced distance has no warning", ShareCards.composeCard(gpsSess, {}).provenance, null);

  const strSess = { sport: "strength", title: "Push + Squat", startedAt: "2026-10-12T17:00:00Z", durationSec: 3000,
    exercises: [
      { name: "Bench Press", sets: [{ reps: 5, load: 80, done: true }, { reps: 5, load: 80, done: true }, { reps: 5, load: 85, done: true }] },
      { name: "Pull-Up", sets: [{ reps: 6, load: 0, done: true }, { reps: 6, load: 0, done: false }] }
    ] };
  const strCard = ShareCards.composeCard(strSess, { unit: "metric", isPR: true });
  eq("strength card volume = 80*5*2 + 85*5", strCard.stats[0].value, "1,225 kg");
  eq("strength card counts only done sets", strCard.stats[1].value, "4");
  ok("PR flag carried onto card", strCard.isPR === true);

  // Honesty: without stored coordinates, the card must not contain a route path
  const noRouteSVG = ShareCards.toSVG(runCard, {});
  ok("no route in SVG when session has none", noRouteSVG.indexOf("<path") < 0);
  ok("wordmark present", noRouteSVG.indexOf("LMTLSS") >= 0);
  ok("provenance text appears in SVG", noRouteSVG.indexOf("no GPS connected") >= 0);

  // Security: user-controlled strings must be escaped, never raw HTML/SVG
  const evil = ShareCards.composeCard({ sport: "running", title: "<script>alert(1)</script>", startedAt: "2026-10-10T07:00:00Z", durationSec: 1800, distanceM: 5000 }, {});
  const evilSVG = ShareCards.toSVG(evil, {});
  ok("title is XML-escaped", evilSVG.indexOf("&lt;script&gt;") >= 0 && evilSVG.indexOf("<script>") < 0);
  eq("escapeXML ampersand", ShareCards.escapeXML("a & b"), "a &amp; b");
  eq("escapeXML quotes", ShareCards.escapeXML("say \"hi\""), "say &quot;hi&quot;");

  // Route machinery: tested with synthetic fixtures (inert until real GPS exists)
  const mkPt = function (lat, lon) { return { lat: lat, lon: lon }; };
  const loop = [];
  for (let i = 0; i <= 40; i++) loop.push(mkPt(19.43 + i * 0.0005, -99.13 + (i % 20) * 0.0005));
  const trimmed = ShareCards.trimRoute(loop, 200);
  ok("trimRoute shortens the polyline", trimmed && trimmed.length < loop.length && trimmed.length > 2, String(trimmed && trimmed.length));
  eq("trimRoute null for tiny routes", ShareCards.trimRoute([mkPt(1, 1), mkPt(1.0001, 1.0001)], 200), null);
  eq("trimRoute null for missing coords", ShareCards.trimRoute(null, 200), null);
  const proj = ShareCards.projectRoute(loop, 1000, 600, 40);
  ok("projection produces a path and markers", !!proj.path && !!proj.start && !!proj.end);
  ok("projected points stay inside the box", [proj.start, proj.end].every(function (p) { return p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 600; }));
  const routeCard = ShareCards.composeCard(Object.assign({}, runSess, { route: loop }), {});
  const routeSVG = ShareCards.toSVG(routeCard, {});
  ok("SVG renders route path when coords exist", routeSVG.indexOf("<path") >= 0);
  const hdist = ShareCards.haversineM(mkPt(19.4326, -99.1332), mkPt(19.4426, -99.1332));
  ok("haversine 0.01 lat ≈ 1112 m", hdist > 1100 && hdist < 1125, String(Math.round(hdist)));

  /* ---------- recovery & fueling pillars ---------- */

  /* Fixture dates are relative to the local calendar (never hardcoded), so the
     suite does not rot and so "today" means the athlete's local day. */
  const dayBack = function (days, hour, min) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    if (typeof hour === "number") d.setHours(hour, min || 0, 0, 0);
    return d;
  };
  const dayISO = function (days) { return Store.todayISO(dayBack(days)); };

  const recState = {
    log: [
      { sport: "strength", startedAt: dayBack(6, 18).toISOString() },
      { sport: "strength", startedAt: dayBack(5, 18).toISOString() },
      { sport: "strength", startedAt: dayBack(4, 18).toISOString() },
      { sport: "strength", startedAt: dayBack(3, 18).toISOString() },
      { sport: "strength", startedAt: dayBack(2, 18).toISOString() },
      { sport: "strength", startedAt: dayBack(1, 18).toISOString() }
    ],
    readiness: [
      { date: dayISO(4), energy: 2, soreness: 3 },
      { date: dayISO(1), energy: 2, soreness: 4 }
    ],
    hydration: [
      { date: dayISO(6), ml: 1000 },
      { date: dayISO(5), ml: 1100 },
      { date: dayISO(4), ml: 900 },
      { date: dayISO(3), ml: 1200 },
      { date: dayISO(2), ml: 1000 },
      { date: dayISO(1), ml: 1100 },
      { date: dayISO(0), ml: 1300 }
    ],
    meals: [
      { id: "m1", date: dayISO(0), kind: "breakfast", calories: 400, proteinG: 20, time: dayBack(0, 8).toISOString() },
      { id: "m2", date: dayISO(0), kind: "lunch", calories: 650, proteinG: 35, time: dayBack(0, 13).toISOString() }
    ]
  };

  /* ---------- local-day boundary (regression: UTC "today" blanked evening entries) ---------- */

  eq("todayISO uses the local calendar day, not the UTC slice",
    Store.todayISO(new Date(2026, 9, 18, 23, 30)), "2026-10-18");
  eq("todayISO keeps local midnight on its own day",
    Store.todayISO(new Date(2026, 9, 18, 0, 5)), "2026-10-18");
  const localFuel = Domain.fuelSummary({
    hydration: [{ date: dayISO(0), ml: 500 }],
    meals: [{ id: "late", kind: "dinner", calories: 300, proteinG: 12, time: dayBack(0, 23, 30).toISOString() }]
  });
  eq("fuelSummary finds today's hydration in local time", localFuel.hydrationMl, 500);
  eq("an 11:30 pm local meal counts on the local day", localFuel.mealCalories, 300);
  const lateSeries = Domain.recoverySeries({ log: [], readiness: [], hydration: [], meals: [
    { id: "late2", kind: "dinner", calories: 1, proteinG: 1, time: dayBack(0, 23, 30).toISOString() }
  ] }, 1);
  // The grid runs Mon–Sun and includes days later this week, so locate today
  // explicitly instead of assuming today is the last cell.
  const lateSeriesToday = lateSeries.filter(function (d) { return d.date === Store.todayISO(); })[0];
  eq("recoverySeries counts a late-evening meal on the local day",
    lateSeriesToday && lateSeriesToday.meals, 1);

  const recSeries = Domain.recoverySeries(recState, 2);
  ok("recoverySeries produces a 7-day-per-week grid", recSeries.length === 14);
  ok("recoverySeries labels weekdays", recSeries.every(function (d) { return d.weekday && d.weekday.length === 3; }));
  ok("recoverySeries reads hydration", recSeries.some(function (d) { return d.hydration === 1000; }));
  ok("recoverySeries counts meals per day", recSeries.some(function (d) { return d.meals === 2; }));
  ok("recoverySeries marks rest vs training days", recSeries.every(function (d) { return typeof d.rest === "boolean"; }));

  const rec = Domain.restDayRecommendation(recState);
  eq("restDayRecommendation computes training days", rec.trainingDaysLast7, 6);
  eq("restDayRecommendation computes low-energy days", rec.lowEnergyDaysLast7, 2);
  ok("restDayRecommendation suggests a rest day when training 6d + 2 low-energy",
    rec.suggestion.indexOf("rest day") >= 0);
  ok("restDayRecommendation source names the data origin",
    rec.source.indexOf("own data") >= 0);
  ok("restDayRecommendation keeps a suggestion even when derived",
    typeof rec.suggestion === "string" && rec.suggestion.length > 0);
  ok("restDayRecommendation source is non-empty",
    rec.source.length > 20);

  const fuel = Domain.fuelSummary(recState);
  eq("fuelSummary reads today's hydration", fuel.hydrationMl, 1300);
  eq("fuelSummary reads hydrationLogged flag", fuel.hydrationLogged, true);
  eq("fuelSummary sums meal calories", fuel.mealCalories, 1050);
  eq("fuelSummary sums meal protein", fuel.mealProteinG, 55);
  ok("fuelSummary labels meal estimates honestly",
    fuel.mealEstimateLabel.indexOf("estimate") >= 0);

  const noFuel = Domain.fuelSummary({ log: [], readiness: [], hydration: [], meals: [] });
  eq("fuelSummary without data returns zeros", noFuel.hydrationMl, 0);
  eq("fuelSummary without data marks not logged", noFuel.hydrationLogged, false);
  eq("fuelSummary without meals labels empty state",
    noFuel.mealEstimateLabel.indexOf("No meals logged") >= 0, true);

  ok("mealEstimateLabel names user-entered estimate status",
    Domain.mealEstimateLabel([{ id: "x", kind: "lunch", calories: 500 }]).indexOf("user-entered") >= 0);

  /* ---------- adaptive calendar (explainable weekly rebalancing) ---------- */

  const mkPlanS = function (id, day, sport, title, rpe) {
    return {
      id: id, day: day, sport: sport, title: title,
      exercises: sport === "strength" ? [{ name: "Back Squat", targetSets: 3, targetReps: 5 }] : [],
      estMinutes: 40, targetRPE: rpe || 7
    };
  };
  // Fixed instants (local calendar time) so weekday math is deterministic on any machine.
  const wWed = new Date(2026, 9, 14, 9, 0, 0).getTime();   // Wed 2026-10-14, week of Mon 2026-10-12
  const wThu = new Date(2026, 9, 15, 9, 0, 0).getTime();    // Thu 2026-10-15
  const wMonAM = new Date(2026, 9, 12, 7, 0, 0).getTime();  // Mon 2026-10-12 07:00
  const wSun = new Date(2026, 9, 18, 9, 0, 0).getTime();    // Sun 2026-10-18
  const rcPlanA = { sessions: [
    mkPlanS("ra", "Mon", "strength", "Push + Squat", 8),
    mkPlanS("rb", "Tue", "running", "Easy Run", 7),
    mkPlanS("rc", "Thu", "strength", "Pull + Hinge", 8),
    mkPlanS("rd", "Fri", "running", "Long Run", 7)
  ] };
  const readyNow = Store.todayISO(new Date(wWed));

  const ra1 = Domain.rebalanceWeek({ plan: rcPlanA, log: [], readiness: [] }, wWed);
  eq("missed sessions move onto open days (2 moves)", Object.keys(ra1.moves).length, 2);
  eq("missed strength skips adjacency (Wed sits next to Thu's strength) → Sat", ra1.moves.ra, "Sat");
  eq("missed run fills the earliest open day (today, Wed)", ra1.moves.rb, "Wed");
  ok("moves never land on days a pending session occupies",
    Object.keys(ra1.moves).every(function (k) { return ra1.moves[k] !== "Thu" && ra1.moves[k] !== "Fri"; }));
  ok("every change explains its why and source",
    ra1.changes.every(function (c) { return c.text && c.why && c.why.length > 30 && c.source && c.source.length > 20; }));
  ok("missed-session reasons name the planned day and the log basis",
    ra1.changes.every(function (c) { return c.trigger !== "missed" || (c.why.indexOf(c.fromDay) >= 0 && c.source.indexOf("log") >= 0); }));

  // A session finished from the plan carries planId → recognized as done.
  const ra2 = Domain.rebalanceWeek({
    plan: rcPlanA,
    log: [{ planId: "ra", sport: "strength", startedAt: new Date(2026, 9, 12, 17, 0, 0).toISOString() }],
    readiness: []
  }, wWed);
  ok("logged plan session (planId) is never moved", !ra2.moves.ra);
  eq("remaining missed session fills the now-first open day", ra2.moves.rb, "Wed");

  // Legacy logs carry no planId: same sport on that planned weekday covers it.
  const ra3 = Domain.rebalanceWeek({
    plan: rcPlanA,
    log: [{ sport: "strength", title: "Strength — Push + Squat", startedAt: new Date(2026, 9, 12, 17, 0, 0).toISOString() }],
    readiness: []
  }, wWed);
  ok("legacy sport+weekday log covers the planned day (no false 'missed')", !ra3.moves.ra);

  const clean = Domain.rebalanceWeek({ plan: rcPlanA, log: [], readiness: [] }, wMonAM);
  eq("fresh Monday with nothing missed → no changes", clean.changes.length, 0);
  ok("untouched week summarizes as on track", clean.summary.indexOf("on track") >= 0);

  // Low readiness: today's hard session shifts a day, explainably.
  const rbPlan = { sessions: [mkPlanS("wb", "Wed", "strength", "Push + Squat", 8)] };
  const lowRow = [{ date: readyNow, energy: 2, soreness: 2 }];
  const rr = Domain.rebalanceWeek({ plan: rbPlan, log: [], readiness: lowRow }, wWed);
  eq("low readiness moves today's hard session one day", rr.moves.wb, "Thu");
  eq("readiness change is tagged by its trigger",
    rr.changes.filter(function (c) { return c.trigger === "readiness" && c.kind === "move"; }).length, 1);
  ok("readiness reason quotes the check-in numbers", rr.changes[0].why.indexOf("energy 2/5") >= 0);
  ok("readiness source stays a self-rating, not a measurement",
    rr.changes[0].source.indexOf("not a measured") >= 0);

  const rdPlan = { sessions: [
    mkPlanS("dm", "Mon", "strength", "Push + Squat", 8),
    mkPlanS("ep", "Wed", "running", "Easy Run", 7)
  ] };
  const rr2 = Domain.rebalanceWeek({ plan: rdPlan, log: [], readiness: lowRow }, wWed);
  eq("low readiness keeps makeup sessions off today (→ Thu, not Wed)", rr2.moves.dm, "Thu");
  eq("low readiness alone moves nothing when today's session is easy",
    rr2.changes.filter(function (c) { return c.trigger === "readiness"; }).length, 0);
  ok("today's easy run stays put", !rr2.moves.ep);

  // Rest-gap preference: strength makeup skipped past an occupied neighbor.
  const spPlan = { sessions: [
    mkPlanS("es", "Mon", "strength", "Push + Squat", 8),
    mkPlanS("fs", "Fri", "strength", "Pull + Hinge", 8)
  ] };
  const sp = Domain.rebalanceWeek({ plan: spPlan, log: [], readiness: [] }, wThu);
  eq("strength makeup prefers a non-adjacent open day", sp.moves.es, "Sun");
  ok("rest-gap choice is named in the reason",
    sp.changes[0].why.indexOf("back-to-back") >= 0);
  ok("pending Friday strength is not relocated", !sp.moves.fs);

  // No room left: defer with an explanation instead of silently dropping.
  const fullPlan = { sessions: [
    mkPlanS("f1", "Mon", "strength", "Push + Squat", 8),
    mkPlanS("f2", "Tue", "running", "Easy Run", 7),
    mkPlanS("f3", "Wed", "strength", "Pull + Hinge", 8),
    mkPlanS("f4", "Thu", "running", "Easy Run", 7),
    mkPlanS("f5", "Fri", "strength", "Full Body", 8),
    mkPlanS("f6", "Sat", "running", "Long Run", 7)
  ] };
  const full = Domain.rebalanceWeek({ plan: fullPlan, log: [], readiness: [] }, wSun);
  eq("full week: the single open day (today) is used", Object.keys(full.moves).length, 1);
  eq("full week: the rest are deferred, listed explicitly", full.dropped.length, 5);
  ok("deferrals explain that the week is full",
    full.changes.filter(function (c) { return c.kind === "defer"; }).every(function (c) { return c.why.indexOf("every remaining day") >= 0; }));

  eq("weekStartISO rolls back to Monday (midweek)", Domain.weekStartISO(wWed), "2026-10-12");
  eq("weekStartISO rolls back to Monday (from Sunday)", Domain.weekStartISO(wSun), "2026-10-12");

  const wpState = { plan: rcPlanA, weekPlan: { weekStart: Domain.weekStartISO(wWed), moves: { ra: "Thu" } } };
  eq("effectivePlanDay honors a current-week override",
    Domain.effectivePlanDay(rcPlanA.sessions[0], wpState, wWed), "Thu");
  const staleState = { plan: rcPlanA, weekPlan: { weekStart: "2026-01-05", moves: { ra: "Sat" } } };
  eq("effectivePlanDay ignores overrides from another week",
    Domain.effectivePlanDay(rcPlanA.sessions[0], staleState, wWed), "Mon");

  eq("nextPlannedSession skips sessions deferred this week",
    Domain.nextPlannedSession({ plan: rcPlanA, weekPlan: { weekStart: Domain.weekStartISO(wWed), dropped: ["rc"] } }, wWed).id, "rd");
  eq("nextPlannedSession offers a moved session on its new day",
    Domain.nextPlannedSession({ plan: rcPlanA, weekPlan: { weekStart: Domain.weekStartISO(wWed), moves: { rc: "Wed" } } }, wWed).id, "rc");

  // Persistence + additive-field recovery (old payloads simply miss the key).
  const savedBeforeAdapt = localStorage.getItem(KEY);
  Store.saveWeekPlan({ weekStart: "2026-10-12", moves: { ra: "Wed" }, dropped: [], changes: [], summary: "test" });
  Store.reload();
  ok("weekPlan persists across reload",
    !!Store.get().weekPlan && Store.get().weekPlan.weekStart === "2026-10-12" && Store.get().weekPlan.moves.ra === "Wed");
  localStorage.setItem(KEY, JSON.stringify({ version: 1, profile: null, plan: { sessions: [] }, log: [] }));
  Store.reload();
  eq("payload without weekPlan loads with weekPlan null (no schema bump needed)", Store.get().weekPlan, null);
  if (savedBeforeAdapt === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, savedBeforeAdapt);
  Store.reload();

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
