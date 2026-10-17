/* LMTLSS Coach — explainable recommendations + rule-based Q&A.
   Every recommendation carries its reasoning and a confidence level.
   Nothing here fabricates data or claims medical validity. */

(function () {
  "use strict";

  const el = UI.el;

  const QUICK_QS = [
    "What should I do today?",
    "Why is my squat not improving?",
    "Should I train if I feel sore?",
    "How do I progress my runs?"
  ];

  function render(container, ctx) {
    const state = Store.get();
    UI.clear(container);
    const screen = el("div", { class: "screen" });

    screen.appendChild(el("div", { class: "screen-head" }, [
      el("div", {}, [
        el("h1", { class: "screen-title", text: "Coach" }),
        el("p", { class: "screen-sub", text: "Recommendations derived only from your logged data." })
      ])
    ]));

    /* Recommendations */
    const recs = Domain.coachRecommendations(state);
    if (recs.length) {
      recs.forEach(function (r) { screen.appendChild(recCard(r, ctx)); });
    }

    /* Chat */
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-title", text: "Ask about your training" }),
        state.coachThread && state.coachThread.length ? el("button", {
          class: "btn btn-ghost btn-sm", text: "Clear",
          onclick: function () { Store.clearCoach(); window.App.rerender(); }
        }) : null
      ])
    ]));

    const thread = el("div", { id: "coach-thread" });
    (state.coachThread || []).forEach(function (m) {
      thread.appendChild(el("div", { class: "coach-msg" + (m.role === "user" ? " coach-msg-user" : "") }, [
        el("div", { class: "coach-bubble" }, [el("span", { text: m.text })])
      ]));
    });
    if (!(state.coachThread || []).length) {
      thread.appendChild(el("div", { class: "empty-state" }, [
        UI.icon("coach"),
        el("h3", { text: "Ask a training question" }),
        el("p", { text: "Answers are rule-based and cite your own history. The coach says \"I don't know\" rather than guessing." })
      ]));
    }
    screen.appendChild(thread);

    /* Quick questions */
    screen.appendChild(el("div", { class: "chip-row mt-4" },
      QUICK_QS.map(function (q) {
        return el("button", {
          class: "chip", text: q,
          onclick: function () { answer(q, ctx); }
        });
      })
    ));

    /* Input */
    const input = el("input", { class: "input mt-4", type: "text", placeholder: "Ask about technique, programming, or your progress…", "aria-label": "Question for the coach" });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && input.value.trim()) { const q = input.value.trim(); input.value = ""; answer(q, ctx); }
    });
    screen.appendChild(input);

    container.appendChild(screen);
    container.scrollTop = 0;
  }

  function recCard(r, ctx) {
    const card = el("div", { class: "recommend-card mb-3" }, [
      el("div", { class: "row-between mb-2" }, [
        el("h3", { style: "font-weight:700;font-size:1.0625rem", text: r.title }),
        confidence(r.confidence)
      ]),
      el("p", { class: "small", text: r.text }),
      el("div", { class: "rec-why" }, [
        el("span", { class: "why-label", text: "Why this is suggested" }),
        el("span", { text: r.why })
      ]),
      r.action ? el("button", {
        class: "btn btn-secondary btn-sm",
        text: r.action.label,
        onclick: function () { ctx.go(r.action.tab); }
      }) : null
    ]);
    return card;
  }

  function confidence(level) {
    const dots = el("span", { class: "conf-dots", "aria-hidden": "true" });
    for (let i = 1; i <= 3; i++) dots.appendChild(el("span", { class: "conf-dot" + (i <= level ? " on" : "") }));
    const label = level >= 3 ? "Strong" : level === 2 ? "Moderate" : "Weak";
    return el("span", { class: "confidence", title: "Confidence: " + label }, [dots, label]);
  }

  /* ---------- Rule-based answers ---------- */

  function answer(question, ctx) {
    Store.pushCoach({ role: "user", text: question, ts: Date.now() });
    const reply = respond(question.toLowerCase(), Store.get());
    Store.pushCoach({ role: "coach", text: reply, ts: Date.now() });
    window.App.rerender();
    setTimeout(function () {
      const t = document.getElementById("coach-thread");
      if (t) t.lastElementChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  }

  function respond(q, state) {
    const log = state.log || [];

    if (/today|next|do (now|first)|what.*session/.test(q)) {
      const next = Domain.nextPlannedSession(state);
      if (!next) return "You don't have a plan yet. Set one up from Profile → Training plan, or log a session manually from Train.";
      if (next.sport === "running") {
        return "Today's plan is " + next.title + " — about " + (next.estMinutes || 30) + " minutes at a conversational effort. " +
          (next.title === "Long Run" ? "Keep it genuinely easy; the point is time on feet, not pace." : "If the last runs felt hard, slow down rather than cutting it short.");
      }
      const detail = next.exercises.slice(0, 3).map(function (e) {
        const last = Domain.recentTopSets(state, e.name, 1)[0];
        return e.name + (last ? " (last time: " + last + " kg top set)" : " (no history yet — pick a conservative load)");
      }).join("; ");
      return "Planned: " + next.title + ", roughly " + (next.estMinutes || 50) + " minutes. " + detail + ".";
    }

    if (/squat|bench|deadlift|plateau|stuck|not improv|progress/.test(q) && /squat|bench|deadlift|lift|strength|weight/.test(q)) {
      const lifts = ["Back Squat", "Bench Press", "Deadlift"];
      const lines = [];
      lifts.forEach(function (lift) {
        const h = Domain.recentTopSets(state, lift, 3);
        if (h.length >= 2) {
          const flat = h.every(function (x) { return x === h[0]; });
          lines.push(lift + ": last top sets " + h.join(", ") + " kg" + (flat ? " — flat, so add reps before adding load." : " — still moving, keep the current progression."));
        }
      });
      if (!lines.length) return "I don't have enough " + "logged sets on your main lifts to say why they're stalling. Log 2–3 more sessions on each lift and ask again — I won't guess.";
      return "From your logged top sets:\n" + lines.join("\n") + "\n\nIf a lift has been flat for 3+ sessions, add reps at the same load before increasing weight. That raises volume first, which is what breaks plateaus.";
    }

    if (/sore|tired|fatigue|rest|recover|sleep|readiness/.test(q)) {
      const avg = Domain.readinessAverage(state, 7);
      const base = "Soreness and fatigue are normal; sharp or worsening pain isn't. If in doubt, take the rest day — adaptation happens during recovery, not in the session.";
      const r = avg !== null
        ? " Your own readiness ratings average " + avg.toFixed(1) + "/5 this week" + (avg <= 2.5 ? ", which is on the low side — I'd swap today's hard session for easy aerobic work or mobility." : ", so you're reporting decent energy.") 
        : " You haven't logged readiness recently, so I'm giving general guidance only.";
      return base + r + "\n\nThis is general training guidance, not medical advice.";
    }

    if (/run|pace|endurance|5k|10k|distance/.test(q)) {
      const runs = log.filter(function (s) { return s.sport === "running" && s.distanceM; });
      if (runs.length < 2) return "You've logged " + runs.length + " run" + (runs.length === 1 ? "" : "s") + " so far. I can give pace guidance once there's a history to compare against — for now, run at a pace where you could hold a conversation.";
      const last = runs[runs.length - 1];
      const pace = Domain.fmtPace(last.durationSec / (last.distanceM / 1000));
      return "Your last run: " + Domain.fmtDist(last.distanceM, state.settings.unit) + " in " + Domain.fmtDur(last.durationSec) + " (" + pace + "/km). " +
        "Progress here comes from consistency first: keep most runs easy, add one longer run weekly, and only add fast work once you have 3+ weeks of steady mileage. " +
        "See the Progress tab for your pace trend.";
    }

    if (/technique|form|how do i (do|perform)|substitute|alternative|equipment/.test(q)) {
      return "Technique cues I can give at a general level: brace before every heavy rep, control the eccentric, and stop sets 1–2 reps shy of failure while you learn a movement. " +
        "For exercise substitutions based on your equipment, open a session on the Train tab — the substitute button filters to what you actually have. " +
        "For anything injury-specific, a qualified coach watching you in person beats any app, including this one.";
    }

    if (/plan|program|schedule|week/.test(q)) {
      const plan = (state.plan && state.plan.sessions) || [];
      if (!plan.length) return "No plan set yet. Run the onboarding from Profile to generate a starting week based on your goal, experience, and equipment.";
      const p = state.profile || {};
      return "Your week: " + plan.map(function (s) { return s.day + " " + s.title; }).join(", ") + ". " +
        (p.daysPerWeek ? p.daysPerWeek + " sessions per week, " : "") + "sequenced so hard days don't stack. Edit it in Profile → Training plan.";
    }

    if (/volume|how much|tonnage/.test(q)) {
      const series = Domain.weeklyVolumeSeries(state, 4);
      const cur = series[series.length - 1];
      if (!cur || !cur.vol) return "No strength volume logged this week yet. Log a session and I can compare it to your recent weeks.";
      return "This week: " + Domain.fmt(cur.vol) + " kg of total tonnage across " + UI.plural(cur.sets, "set") + ". " +
        "Prior weeks: " + series.slice(0, 3).map(function (w) { return Domain.fmt(w.vol); }).join(", ") + " kg. " +
        "Gradual increases (roughly 2–5% weekly on working volume) are the sustainable range.";
    }

    return "I can answer from your logged training: what's planned today, main-lift trends, running progress, weekly volume, plan structure, and recovery guidance. " +
      "Try one of those — and if your question needs a real physio or a coach watching your form, I'll say so rather than pretend.";
  }

  window.CoachScreen = { render: render };
})();
