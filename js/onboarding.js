/* LMTLSS onboarding — short, skippable, and it explains what it generates. */

(function () {
  "use strict";

  const el = UI.el;

  const STEPS = ["goal", "sports", "experience", "availability", "equipment", "limitations", "plan"];

  function run(container, onDone) {
    let idx = 0;
    const answers = {
      name: "",
      goal: "general",
      sports: ["strength"],
      experience: "beginner",
      daysPerWeek: 4,
      equipment: ["full-gym"],
      limitations: ""
    };

    function render() {
      UI.clear(container);
      const step = STEPS[idx];
      const wrap = el("div", { class: "onboarding" }, [
        el("div", { class: "onboarding-top" }, [
          el("span", { class: "wordmark" }, [
            "LMTLSS", el("span", { class: "dot", text: "." })
          ]),
          idx < STEPS.length - 1 ? el("div", { class: "step-dots", "aria-hidden": "true" },
            STEPS.map(function (_, i) {
              return el("span", { class: "step-dot" + (i === idx ? " active" : i < idx ? " done" : "") });
            })
          ) : null
        ]),
        el("div", { class: "onboarding-body", id: "ob-body" })
      ]);
      container.appendChild(wrap);
      const body = wrap.querySelector("#ob-body");
      const builders = { goal: stepGoal, sports: stepSports, experience: stepExperience, availability: stepAvailability, equipment: stepEquipment, limitations: stepLimitations, plan: stepPlan };
      builders[step](body);
    }

    function next() { if (idx < STEPS.length - 1) { idx++; render(); } }
    function back() { if (idx > 0) { idx--; render(); } }

    function navBar(backable, nextLabel, nextEnabled, onNext, skipLabel, onSkip) {
      return el("div", { class: "onboarding-actions" }, [
        el("button", {
          class: "btn btn-primary btn-lg btn-block", text: nextLabel,
          disabled: nextEnabled === false,
          onclick: onNext
        }),
        skipLabel ? el("button", { class: "btn btn-ghost btn-block", text: skipLabel, onclick: onSkip }) : null,
        backable ? el("button", { class: "btn btn-ghost btn-block", text: "Back", onclick: back }) : null
      ]);
    }

    /* ---- Step builders ---- */

    function stepGoal(body) {
      body.appendChild(el("h1", { text: "What are you training for?" }));
      body.appendChild(el("p", { class: "lede", text: "This shapes your plan's focus. You can change it any time." }));
      const opts = [
        ["strength", "Build strength", "Get stronger on the main lifts"],
        ["hypertrophy", "Build muscle", "Increase size and training volume"],
        ["endurance", "Improve endurance", "Run longer and faster"],
        ["general", "General fitness", "Stay strong, healthy, and consistent"],
        ["weight", "Body composition", "Train alongside nutrition goals"]
      ];
      const list = el("div", { class: "stack" });
      opts.forEach(function (o) {
        list.appendChild(el("button", {
          class: "option-card", type: "button",
          "aria-pressed": String(answers.goal === o[0]),
          onclick: function () { answers.goal = o[0]; render(); }
        }, [
          el("span", {}, [el("span", { class: "oc-title", text: o[1] }), el("span", { class: "oc-sub", style: "display:block", text: o[2] })]),
          UI.icon("check", "oc-check")
        ]));
      });
      body.appendChild(list);
      body.appendChild(navBar(false, "Continue", true, next));
    }

    function stepSports(body) {
      body.appendChild(el("h1", { text: "Which sports do you do?" }));
      body.appendChild(el("p", { class: "lede", text: "Pick everything that applies. Workouts will use the right metrics for each." }));
      const opts = [
        ["strength", "Strength training", "dumbbell"],
        ["running", "Running", "run"],
        ["cycling", "Cycling", "run"],
        ["swimming", "Swimming", "run"],
        ["mobility", "Mobility & yoga", "heart"],
        ["team", "Team sports", "bolt"],
        ["combat", "Combat sports", "bolt"],
        ["racket", "Racket sports", "bolt"]
      ];
      const list = el("div", { class: "stack" });
      opts.forEach(function (o) {
        const on = answers.sports.indexOf(o[0]) >= 0;
        list.appendChild(el("button", {
          class: "option-card", type: "button",
          "aria-pressed": String(on),
          onclick: function () {
            const i = answers.sports.indexOf(o[0]);
            if (i >= 0) { if (answers.sports.length > 1) answers.sports.splice(i, 1); }
            else answers.sports.push(o[0]);
            render();
          }
        }, [
          el("span", { class: "row" }, [UI.icon(o[2]), el("span", { class: "oc-title", text: o[1] })]),
          UI.icon("check", "oc-check")
        ]));
      });
      body.appendChild(list);
      body.appendChild(el("p", { class: "field-hint mt-3", text: "Phase 1 ships full experiences for strength and running. Other sports are recorded in the modular activity model and light workflows; we won't pretend they have depth they don't." }));
      body.appendChild(navBar(true, "Continue", true, next));
    }

    function stepExperience(body) {
      body.appendChild(el("h1", { text: "How experienced are you?" }));
      body.appendChild(el("p", { class: "lede", text: "This sets starting volume. Ambition doesn't set training load — your history does." }));
      const opts = [
        ["beginner", "New or returning", "Less than a year of consistent training"],
        ["intermediate", "Intermediate", "1–3 years of consistent training"],
        ["advanced", "Advanced", "3+ years with structured programming"]
      ];
      const list = el("div", { class: "stack" });
      opts.forEach(function (o) {
        list.appendChild(el("button", {
          class: "option-card", type: "button",
          "aria-pressed": String(answers.experience === o[0]),
          onclick: function () { answers.experience = o[0]; render(); }
        }, [
          el("span", {}, [el("span", { class: "oc-title", text: o[1] }), el("span", { class: "oc-sub", style: "display:block", text: o[2] })]),
          UI.icon("check", "oc-check")
        ]));
      });
      body.appendChild(list);
      body.appendChild(navBar(true, "Continue", true, next));
    }

    function stepAvailability(body) {
      body.appendChild(el("h1", { text: "How often can you train?" }));
      body.appendChild(el("p", { class: "lede", text: "Days per week you can realistically commit to. Honest beats ambitious." }));
      const row = el("div", { class: "card center" }, [
        el("div", { class: "metric-value metric-accent num", id: "ob-days", text: String(answers.daysPerWeek) }),
        el("div", { class: "metric-label mt-2", text: "days per week" })
      ]);
      body.appendChild(row);
      const controls = el("div", { class: "row mt-4", style: "justify-content:center" }, [
        el("button", {
          class: "icon-btn", "aria-label": "Fewer days", text: "−",
          onclick: function () { if (answers.daysPerWeek > 2) { answers.daysPerWeek--; render(); } }
        }),
        el("button", {
          class: "icon-btn", "aria-label": "More days", text: "+",
          onclick: function () { if (answers.daysPerWeek < 6) { answers.daysPerWeek++; render(); } }
        })
      ]);
      body.appendChild(controls);
      body.appendChild(el("p", { class: "field-hint mt-4 center", text: "2–6 days. Rest days are part of the plan, not a failure." }));
      body.appendChild(navBar(true, "Continue", true, next));
    }

    function stepEquipment(body) {
      body.appendChild(el("h1", { text: "What equipment do you have?" }));
      body.appendChild(el("p", { class: "lede", text: "Sessions only suggest exercises you can actually do." }));
      const opts = [
        ["full-gym", "Full gym", "Everything: racks, cables, machines"],
        ["rack", "Squat rack"],
        ["barbell", "Barbell"],
        ["dumbbells", "Dumbbells"],
        ["bench", "Bench"],
        ["bar", "Pull-up bar"],
        ["bodyweight", "Bodyweight only"],
        ["outdoor", "Outdoor space for running"]
      ];
      const list = el("div", { class: "stack" });
      opts.forEach(function (o) {
        const on = answers.equipment.indexOf(o[0]) >= 0;
        list.appendChild(el("button", {
          class: "option-card", type: "button",
          "aria-pressed": String(on),
          onclick: function () {
            const i = answers.equipment.indexOf(o[0]);
            if (i >= 0) { if (answers.equipment.length > 1) answers.equipment.splice(i, 1); }
            else {
              if (o[0] === "full-gym") answers.equipment = ["full-gym"];
              else { answers.equipment = answers.equipment.filter(function (e) { return e !== "full-gym"; }); answers.equipment.push(o[0]); }
            }
            render();
          }
        }, [
          el("span", { class: "oc-title", text: o[1] }),
          UI.icon("check", "oc-check")
        ]));
      });
      body.appendChild(list);
      body.appendChild(navBar(true, "Continue", true, next));
    }

    function stepLimitations(body) {
      body.appendChild(el("h1", { text: "Anything we should work around?" }));
      body.appendChild(el("p", { class: "lede", text: "Injuries, accessibility needs, or exercises to avoid. Optional." }));
      const ta = el("textarea", {
        class: "input", id: "ob-limits",
        placeholder: "e.g., right knee — avoid deep squatting for now",
        "aria-label": "Limitations or accessibility needs"
      });
      ta.value = answers.limitations;
      ta.addEventListener("input", function () { answers.limitations = ta.value; });
      body.appendChild(el("label", { class: "field" }, [
        el("span", { class: "field-label", text: "Limitations (optional)" }), ta
      ]));
      body.appendChild(el("p", { class: "field-hint mt-3", text: "LMTLSS is a training tool, not a medical device. If something hurts, see a professional." }));
      body.appendChild(navBar(true, "Build my plan", true, next, "Skip", function () { answers.limitations = ""; next(); }));
    }

    /* ---- Final: generated plan review ---- */

    function stepPlan(body) {
      // generate plan + profile now
      answers.name = answers.name || "Athlete";
      const plan = Domain.planFor(answers);

      body.appendChild(el("h1", { text: "Your starting week" }));
      body.appendChild(el("p", { class: "lede", text: "Generated from your answers. Every assumption below is editable." }));

      const list = el("div", { class: "stack" });
      plan.sessions.forEach(function (s) {
        const meta = s.sport === "running"
          ? "Run · " + (s.estMinutes || 30) + " min"
          : UI.plural(s.exercises.length, "exercise") + " · ~" + (s.estMinutes || 50) + " min";
        list.appendChild(el("div", { class: "card card-tight" }, [
          el("div", { class: "row-between" }, [
            el("div", {}, [
              el("div", { class: "eyebrow", text: s.day }),
              el("div", { style: "font-weight:650;margin-top:2px", text: s.title }),
              el("div", { class: "small muted mt-2", text: meta })
            ]),
            el("span", { class: "badge badge-accent", text: s.sport === "running" ? "RUN" : "STR" })
          ]),
          s.exercises && s.exercises.length ? el("div", { class: "small muted-2 mt-2", text: s.exercises.map(function (e) { return e.name; }).join(" · ") }) : null
        ]));
      });
      body.appendChild(list);

      body.appendChild(el("div", { class: "card mt-6" }, [
        el("div", { class: "eyebrow mb-2", text: "Why this plan" }),
        el("ul", { class: "small muted", style: "margin:0;padding-left:18px" },
          plan.rationale.map(function (r) { return el("li", { text: r, style: "margin-bottom:6px" }); })
        )
      ]));

      body.appendChild(el("div", { class: "onboarding-actions" }, [
        el("button", {
          class: "btn btn-primary btn-lg btn-block", text: "Start using LMTLSS",
          onclick: function () {
            Store.setProfile(answers);
            Store.savePlan(plan.sessions);
            Store.set(function (s) { s.plan.rationale = plan.rationale; });
            UI.toast("Plan created. Edit it any time in Profile.");
            onDone();
          }
        }),
        el("button", { class: "btn btn-ghost btn-block", text: "Back", onclick: back })
      ]));
    }

    render();
  }

  window.Onboarding = { run: run };
})();
