/* LMTLSS Progress — records, trends, history, and explanations of what changed. */

(function () {
  "use strict";

  const el = UI.el;

  function render(container, ctx) {
    const state = Store.get();
    const unit = state.settings.unit;
    UI.clear(container);
    const screen = el("div", { class: "screen" });

    screen.appendChild(el("div", { class: "screen-head" }, [
      el("div", {}, [
        el("h1", { class: "screen-title", text: "Progress" }),
        el("p", { class: "screen-sub", text: "Your records and trends — measured from what you logged." })
      ])
    ]));

    const log = state.log || [];
    if (!log.length) {
      screen.appendChild(el("div", { class: "empty-state" }, [
        UI.icon("progress"),
        el("h3", { text: "Nothing to show yet" }),
        el("p", { text: "Complete a session on the Train tab and your records and trends appear here." }),
        el("button", { class: "btn btn-primary", text: "Start a session", onclick: function () { ctx.go("train"); } })
      ]));
      container.appendChild(screen);
      return;
    }

    /* Trend charts */
    const series = Domain.weeklyVolumeSeries(state, 8);

    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-title", text: "Weekly strength volume" }),
        el("span", { class: "micro muted-2", text: "load × reps" })
      ]),
      el("div", { class: "card" }, [
        UI.lineChart(series.map(function (w, i) { return { label: "W" + (i + 1), value: w.vol }; }), {
          height: 130,
          formatValue: function (v) { return Domain.fmt(v) + " kg"; },
          a11yLabel: "Weekly strength volume trend, last " + series.length + " weeks"
        }),
        el("p", { class: "micro muted-2 mt-3", text: "Sum of load × reps across completed sets each week. Source: your manual logs." })
      ])
    ]));

    const runSeries = series.filter(function (w) { return w.runM > 0; });
    if (runSeries.length >= 2) {
      screen.appendChild(el("div", { class: "section" }, [
        el("div", { class: "section-head" }, [
          el("h2", { class: "section-title", text: "Weekly running distance" })
        ]),
        el("div", { class: "card" }, [
          UI.lineChart(series.map(function (w) { return { value: w.runM }; }), {
            height: 130,
            formatValue: function (v) { return Domain.fmtDist(v, unit); },
            a11yLabel: "Weekly running distance trend"
          }),
          el("p", { class: "micro muted-2 mt-3", text: "Distances are manually entered or estimated from time × pace — no GPS is connected. Labeled as such on every run." })
        ])
      ]));
    }

    /* Personal records */
    const strPRs = Domain.strengthPRs(state);
    const runPRs = Domain.runningPRs(state);
    const prNames = Object.keys(strPRs).sort(function (a, b) { return strPRs[b].e1rm - strPRs[a].e1rm; });

    if (prNames.length || Object.keys(runPRs).length) {
      const body = el("div", { class: "panel" });
      prNames.slice(0, 6).forEach(function (name) {
        const pr = strPRs[name];
        body.appendChild(el("div", { class: "panel-row panel-row-static" }, [
          el("div", {}, [
            el("div", { style: "font-weight:650", text: name }),
            el("div", { class: "micro muted-2 mt-2", text: pr.reps + " reps @ " + pr.load + " kg · " + Domain.relDay(pr.date) })
          ]),
          el("div", { class: "center" }, [
            el("div", { class: "pr-row-value", text: Domain.fmt(pr.e1rm) + " kg" }),
            el("div", { class: "micro muted-2", text: "est. 1RM" })
          ])
        ]));
      });
      Object.keys(runPRs).forEach(function (k) {
        const pr = runPRs[k];
        body.appendChild(el("div", { class: "panel-row panel-row-static" }, [
          el("div", {}, [
            el("div", { style: "font-weight:650", text: k }),
            el("div", { class: "micro muted-2 mt-2", text: Domain.fmtDist(pr.distanceM, unit) + " · " + Domain.relDay(pr.date) })
          ]),
          el("div", { class: "center" }, [
            el("div", { class: "pr-row-value", text: Domain.fmtPace(pr.paceSec) }),
            el("div", { class: "micro muted-2", text: "best pace /km" })
          ])
        ]));
      });
      screen.appendChild(el("div", { class: "section" }, [
        el("div", { class: "section-head" }, [
          el("h2", { class: "section-title", text: "Personal records" }),
          el("span", { class: "badge badge-est", text: "1RM estimated (Epley)" })
        ]),
        body
      ]));
    }

    /* Insights */
    const ins = Domain.insights(state);
    if (ins.length) {
      screen.appendChild(el("div", { class: "section" }, [
        el("div", { class: "section-head" }, [
          el("h2", { class: "section-title", text: "What changed" })
        ]),
        el("div", { class: "stack" }, ins.map(function (i) { return insightCard(i); }))
      ]));
    }

    /* History */
    const sorted = log.slice().sort(function (a, b) { return a.startedAt < b.startedAt ? 1 : -1; });
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-title", text: "History" }),
        el("span", { class: "micro muted-2", text: sorted.length + " sessions" })
      ]),
      el("div", { class: "panel" }, sorted.map(function (s) {
        return el("button", {
          class: "history-item",
          onclick: function () { showSession(s, unit); }
        }, [
          el("div", {}, [
            el("div", { class: "history-title", text: s.title }),
            el("div", { class: "history-meta", text: sessionSummary(s, unit) })
          ]),
          el("div", { class: "center" }, [
            el("div", { class: "history-date", text: Domain.relDay(s.startedAt) }),
            el("span", { class: "muted-2", style: "display:inline-block;margin-top:6px" }, [UI.icon("chevron")])
          ])
        ]);
      }))
    ]));

    container.appendChild(screen);
  }

  function sessionSummary(s, unit) {
    if (s.sport === "strength") {
      const sets = (s.exercises || []).reduce(function (a, e) { return a + (e.sets || []).filter(function (st) { return st.done !== false; }).length; }, 0);
      return UI.plural((s.exercises || []).length, "exercise") + " · " + UI.plural(sets, "set") + " · " + Domain.fmtDurHuman(s.durationSec || 0);
    }
    if (s.sport === "running") {
      const pace = s.distanceM ? Domain.fmtPace(s.durationSec / (s.distanceM / 1000)) + "/km · " : "";
      return pace + Domain.fmtDur(s.durationSec) + (s.distanceSource === "manual-estimate" ? " · est. distance" : "");
    }
    // Every other sport renders the metrics it actually recorded.
    const metrics = Domain.activityMetrics(s, unit).filter(function (m) { return m.key !== "durationSec"; });
    const head = Domain.sportById(s.sport) ? Domain.sportById(s.sport).label : (s.sport || "Activity");
    if (!metrics.length) return head + " · " + Domain.fmtDurHuman(s.durationSec || 0);
    return metrics.slice(0, 2).map(function (m) { return m.label + " " + m.value; }).join(" · ") +
      " · " + Domain.fmtDurHuman(s.durationSec || 0);
  }

  function insightCard(i) {
    return el("div", { class: "insight-line" }, [
      el("span", { class: "il-icon" }, [UI.icon(i.kind === "warning" ? "warning" : i.kind === "positive" ? "spark" : "info")]),
      el("div", {}, [
        el("p", { class: "il-text", text: i.text }),
        i.source ? el("p", { class: "micro muted-2 mt-2", text: i.source }) : null
      ])
    ]);
  }

  function showSession(s, unit) {
    const nodes = [];
    nodes.push(el("p", { class: "small muted mb-4", text: Domain.fmtDateFull(s.startedAt) + " · " + sessionSummary(s, unit) }));
    if (s.sport === "strength") {
      (s.exercises || []).forEach(function (ex) {
        nodes.push(el("div", { class: "mb-4" }, [
          el("div", { class: "eyebrow mb-2", text: ex.name }),
          el("div", { class: "chip-row" }, (ex.sets || []).filter(function (st) { return st.done !== false; }).map(function (st, i) {
            return el("span", { class: "chip chip-static num", text: (i + 1) + ": " + st.reps + " × " + (st.load ? st.load + " kg" : "BW") });
          }))
        ]));
      });
    } else if (s.sport === "running") {
      nodes.push(el("div", { class: "stat-pair" }, [
        el("div", {}, [el("div", { class: "metric-label", text: "Distance" }), el("div", { class: "metric-small num", style: "font-weight:700", text: Domain.fmtDist(s.distanceM, unit) })]),
        el("div", {}, [el("div", { class: "metric-label", text: "Time" }), el("div", { class: "metric-small num", style: "font-weight:700", text: Domain.fmtDur(s.durationSec) })]),
        el("div", {}, [el("div", { class: "metric-label", text: "Pace" }), el("div", { class: "metric-small num", style: "font-weight:700", text: s.distanceM ? Domain.fmtPace(s.durationSec / (s.distanceM / 1000)) : "—" })])
      ]));
      nodes.push(el("p", { class: "micro muted-2 mt-3", text: "Provenance: " + (s.distanceSource === "manual-estimate" ? "distance estimated from time × self-reported pace, no GPS" : "manually entered") }));
    } else {
      // Sports outside strength/running: show the metrics this entry recorded.
      const metrics = Domain.activityMetrics(s, unit);
      if (metrics.length) {
        nodes.push(el("div", { class: "stat-pair" }, metrics.map(function (m) {
          return el("div", {}, [
            el("div", { class: "metric-label", text: m.label }),
            el("div", { class: "metric-small num", style: "font-weight:700", text: m.value })
          ]);
        })));
        nodes.push(el("p", { class: "micro muted-2 mt-3", text: "Provenance: entered manually — this sport is not measured automatically." }));
      }
    }
    if (s.notes) nodes.push(el("p", { class: "small muted mt-4", text: "“" + s.notes + "”" }));
    nodes.push(el("div", { class: "mt-6" }, [
      el("button", {
        class: "btn btn-danger btn-block btn-sm",
        onclick: function () {
          UI.confirmSheet("Delete session?", "This removes it from your history and records. This can't be undone.", "Delete", function () {
            Store.deleteSession(s.id);
            UI.toast("Session deleted.");
            UI.closeSheet();
            window.App.rerender();
          }, true);
        }
      }, [UI.icon("trash"), "Delete session"])
    ]));
    UI.sheet(s.title, nodes);
  }

  window.ProgressScreen = { render: render };
})();
