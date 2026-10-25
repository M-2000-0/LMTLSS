/* LMTLSS Recover — readiness trends, rest-day planning, recovery actions.
   Purely derived from the user's own logs and check-ins; not a medical device. */

(function () {
  "use strict";

  const el = UI.el;

  function render(container, ctx) {
    const state = Store.get();
    UI.clear(container);
    const screen = el("div", { class: "screen" });

    screen.appendChild(el("div", { class: "screen-head" }, [
      el("div", {}, [
        el("h1", { class: "screen-title", text: "Recover" }),
        el("p", { class: "screen-sub", text: "Rest planning from your own week — not a measured recovery score." })
      ])
    ]));

    const series = Domain.recoverySeries(state, 4);
    const todayIdx = series.length - 1;

    /* 1. 7-day rest planner */
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-title", text: "This week so far" }),
        el("button", { class: "btn btn-ghost btn-sm", text: "Plan rest", onclick: function () { restPlannerSheet(series, state, ctx); } })
      ]),
      restPlanCard(series[todayIdx], series, state)
    ]));

    /* 2. Readiness trend chart */
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-title", text: "Readiness trend" }),
        el("span", { class: "micro muted-2", text: "Self-rating, 1–5" })
      ]),
      el("div", { class: "card" }, [
        UI.lineChart(series.map(function (d) { return { label: d.weekday, value: d.readiness ? d.readiness.energy : null }; }), {
          height: 120,
          emptyText: "No check-ins yet — log readiness on Home to see a trend.",
          formatValue: function (v) { return v == null ? "—" : v.toFixed(1); },
          a11yLabel: "Readiness energy trend, last 4 weeks"
        }),
        el("p", { class: "micro muted-2 mt-3", text: Domain.readinessAverage(state, 7) !== null
          ? ("7-day average: " + Domain.readinessAverage(state, 7).toFixed(1) + "/5 — your own ratings, not a measured value.")
          : "No ratings logged yet." })
      ])
    ]));

    /* 3. Recovery actions this week */
    const actionsThisWeek = (state.recoveryActions || []).filter(function (a) {
      return a.date >= series[0].date;
    });
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-title", text: "Recovery log" }),
        el("button", { class: "btn btn-ghost btn-sm", text: "Log action", onclick: function () { logActionSheet(state); } })
      ]),
      actionsThisWeek.length
        ? el("div", { class: "panel" }, actionsThisWeek.map(function (a) {
            return el("div", { class: "panel-row panel-row-static" }, [
              el("div", {}, [
                el("div", { style: "font-weight:650", text: kindLabel(a.kind) }),
                el("div", { class: "micro muted-2 mt-2", text: a.note || kindLabel(a.kind) })
              ]),
              el("div", { class: "micro muted-2", text: Domain.relDay(a.time) })
            ]);
          }))
        : el("div", { class: "empty-state" }, [
            UI.icon("heart"),
            el("h3", { text: "Nothing logged yet" }),
            el("p", { text: "Add rest, mobility, or sleep notes when you take them — they help explain the week." })
          ])
    ]));

    container.appendChild(screen);
  }

  const KIND_LABELS = {
    rest: "Rest day",
    mobility: "Mobility / stretching",
    sleep: "Extra sleep",
    massage: "Massage / bodywork",
    ice: "Ice / cold exposure",
    heat: "Heat / sauna",
    other: "Other recovery"
  };

  function kindLabel(k) { return KIND_LABELS[k] || k; }

  function restPlanCard(today, series, state) {
    const rec = Domain.restDayRecommendation(state);
    const trainDays = series.slice(-7).filter(function (d) { return !d.rest && d.date <= today.date; }).length;
    return el("div", { class: "card" }, [
      el("div", { class: "row-between mb-3" }, [
        el("div", {}, [
          el("div", { class: "metric-label", text: "Training days this week" }),
          el("div", { class: "metric-small num", style: "font-weight:700", text: String(trainDays) })
        ]),
        el("div", {}, [
          el("div", { class: "metric-label", text: "Rest days so far" }),
          el("div", { class: "metric-small num", style: "font-weight:700", text: String(7 - trainDays - (today.rest ? 0 : 0)) })
        ])
      ]),
      el("div", { class: "divider my-3" }),
      el("div", { class: "row-between mb-3" }, [
        el("div", {}, [
          el("div", { class: "metric-label", text: "Energy today" }),
          today.readiness
            ? el("div", { class: "metric-small num", style: "font-weight:700", text: today.readiness.energy.toFixed(1) + " / 5" })
            : el("div", { class: "metric-small num muted-2", text: "— not logged" })
        ]),
        el("div", {}, [
          el("div", { class: "metric-label", text: "Soreness today" }),
          today.readiness && typeof today.readiness.soreness === "number"
            ? el("div", { class: "metric-small num", style: "font-weight:700", text: today.readiness.soreness.toFixed(1) + " / 5" })
            : el("div", { class: "metric-small num muted-2", text: "— not logged" })
        ])
      ]),
      el("p", { class: "micro muted-2 mt-2", text: "Self-rated, not a measured value." }),
      el("p", { class: "small muted mt-4", text: rec.suggestion }),
      el("p", { class: "micro muted-2 mt-2", text: rec.why }),
      el("p", { class: "micro muted-2 mt-2", text: rec.source })
    ]);
  }

  function restPlannerSheet(series, state, ctx) {
    const today = Store.todayISO();
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weekStart = Domain.weekStartISO();
    const body = [];

    body.push(el("p", { class: "small muted mb-4", text: "Mark one or two days this week as intended rest. This is a plan, not a commitment — it won't block sessions on the Train tab." }));

    const week = [];
    const start = new Date(weekStart + "T00:00:00");
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const date = Store.todayISO(d); // local calendar day — see store.js todayISO
      const hasSession = state.log.some(function (s) { return s.startedAt && Store.todayISO(s.startedAt) === date; });
      week.push({ date: date, label: weekdays[i], hasSession: hasSession });
    }

    const weekRows = week.map(function (day) {
      const on = state.recoveryActions && state.recoveryActions.some(function (a) { return a.date === day.date && a.kind === "rest"; });
      return el("button", {
        class: "chip" + (on ? " selected" : ""),
        text: day.label + (day.hasSession ? " · session logged" : ""),
        "aria-pressed": String(on),
        onclick: function () {
          if ((state.recoveryActions || []).some(function (a) { return a.date === day.date && a.kind === "rest"; })) {
            Store.logRecoveryAction({ kind: "rest", date: day.date, note: "Rest day", time: day.date + "T00:00:00" });
          } else {
            Store.logRecoveryAction({ kind: "rest", date: day.date, note: "Rest day", time: day.date + "T00:00:00" });
          }
          UI.closeSheet();
          window.App.rerender();
        }
      });
    });
    body.push(el("div", { class: "stack mb-4" }, weekRows));

    body.push(el("button", {
      class: "btn btn-secondary btn-block mt-4",
      text: "Done"
    }, [UI.icon("check")]));

    UI.sheet("Plan rest days this week", body);
  }

  function logActionSheet(state) {
    const kinds = Object.keys(KIND_LABELS);
    const body = [];
    body.push(el("label", { class: "field mb-4" }, [
      el("span", { class: "field-label", text: "What did you do?" }),
      el("select", { class: "input", id: "rec-kind", "aria-label": "Recovery action type" }, [
        el("option", { value: "" }, [el("span", { text: "Choose one" })]),
        kinds.map(function (k) { return el("option", { value: k }, [el("span", { text: KIND_LABELS[k] })]); })
      ])
    ]));
    const noteArea = el("textarea", { class: "input", placeholder: "Optional detail — e.g. 20 min hip mobility" });
    body.push(el("label", { class: "field mb-4" }, [
      el("span", { class: "field-label", text: "Note (optional)" }), noteArea
    ]));
    body.push(el("button", {
      class: "btn btn-primary btn-lg btn-block mt-4",
      onclick: function () {
        const kind = document.getElementById("rec-kind").value;
        if (!kind) { UI.toast("Pick a recovery type first.", { error: true }); return; }
        Store.logRecoveryAction({ kind: kind, note: noteArea.value.trim(), time: new Date().toISOString() });
        UI.closeSheet();
        UI.toast("Recovery action logged.");
        window.App.rerender();
      }
    }, [UI.icon("check"), "Log it"]));
    UI.sheet("Log a recovery action", body);
  }

  window.RecoverScreen = { render: render };
})();
