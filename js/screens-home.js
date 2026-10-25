/* LMTLSS Home — today's priority, next session, readiness, compact progress. */

(function () {
  "use strict";

  const el = UI.el;

  function render(container, ctx) {
    const state = Store.get();
    const profile = state.profile;
    UI.clear(container);

    const screen = el("div", { class: "screen" });

    /* Header */
    const hour = new Date().getHours();
    const greet = hour < 5 ? "Training late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    screen.appendChild(el("div", { class: "screen-head" }, [
      el("div", { class: "brand-group" }, [
        el("h1", { class: "screen-title", text: greet + (profile && profile.name ? ", " + profile.name : "") }),
        el("p", { class: "screen-sub", text: Domain.fmtDateFull(new Date().toISOString()) })
      ]),
      UI.logo(40)
    ]));

    /* 0. Adaptive week — explainable suggestions or applied changes */
    const adapt = adaptiveCard(state, ctx);
    if (adapt) screen.appendChild(adapt);

    /* 1. Next session — the one clear priority */
    const next = Domain.nextPlannedSession(state);
    if (next) {
      const isRun = next.sport === "running";
      const card = el("div", { class: "today-card" }, [
        el("div", { class: "row-between" }, [
          el("span", { class: "eyebrow", text: "Today's session" }),
          el("span", { class: "badge badge-accent" }, [UI.icon(isRun ? "run" : "dumbbell"), isRun ? "RUN" : "STRENGTH"])
        ]),
        el("h2", { class: "next-session-title", text: next.title }),
        el("p", { class: "next-session-meta", text: next.sport === "running"
          ? (next.estMinutes || 30) + " min · " + (next.title === "Long Run" ? "conversational pace, longer distance" : "easy aerobic effort")
          : UI.plural(next.exercises.length, "exercise") + " · about " + (next.estMinutes || 50) + " min · RPE " + (next.targetRPE || 7)
        }),
        next.exercises && next.exercises.length ? el("div", { class: "chip-row mt-4" },
          next.exercises.slice(0, 4).map(function (e) {
            return el("span", { class: "chip chip-static", text: e.name });
          })
        ) : null,
        el("button", {
          class: "btn btn-primary btn-lg btn-block mt-6",
          onclick: function () { ctx.go("train", { startPlanSession: next.id }); }
        }, [UI.icon("play"), "Start session"])
      ]);
      screen.appendChild(card);
    } else {
      screen.appendChild(el("div", { class: "empty-state" }, [
        UI.icon("train"),
        el("h3", { text: "No plan yet" }),
        el("p", { text: "Run onboarding from the Profile tab to generate a starting week." }),
        el("button", { class: "btn btn-secondary", text: "Open Profile", onclick: function () { ctx.go("profile"); } })
      ]));
    }

    /* 2. Readiness check-in — one tap */
    const today = Store.todayISO();
    const hasToday = (state.readiness || []).some(function (r) { return r.date === today; });
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-title", text: "Readiness" }),
        hasToday ? el("span", { class: "badge badge-accent" }, [UI.icon("check"), "Logged today"]) : null
      ]),
      hasToday ? readinessSummary(state) : readinessPicker()
    ]));

    /* 3. Compact progress — three sparks, not a wall of stats */
    const log = state.log || [];
    if (log.length) {
      const series = Domain.weeklyVolumeSeries(state, 6);
      const thisWeek = series[series.length - 1] || { sets: 0, runM: 0 };
      const lastWeek = series[series.length - 2] || { sets: 0, runM: 0 };

      // Use the same Mon-based week basis as the weeklyVolumeSeries sparkline,
      // so the headline number and the sparkline agree.
      const ws = Domain.weekStartISO();
      const wsMs = new Date(ws + "T00:00:00").getTime();
      const prevWsMs = wsMs - 7 * 86400000;
      const sessionsThisWeek = log.filter(function (s) {
        const t = new Date(s.startedAt).getTime();
        return t >= wsMs && t < wsMs + 7 * 86400000;
      }).length;
      const sessionsLastWeek = log.filter(function (s) {
        const t = new Date(s.startedAt).getTime();
        return t >= prevWsMs && t < wsMs;
      }).length;

      screen.appendChild(el("div", { class: "section" }, [
        el("div", { class: "section-head" }, [
          el("h2", { class: "section-title", text: "This week" }),
          el("button", { class: "btn btn-ghost btn-sm", text: "Progress", onclick: function () { ctx.go("progress"); } })
        ]),
        el("div", { class: "spark-row" }, [
          sparkCard("Sessions", String(sessionsThisWeek), weekSessionCounts(state), deltaBadge(sessionsThisWeek, sessionsLastWeek, true)),
          sparkCard("Strength volume", Domain.fmt(thisWeek.vol) + " kg", series.map(function (w, i) { return { value: w.vol }; }), deltaBadge(thisWeek.vol, lastWeek.vol, true)),
          sparkCard("Distance", Domain.fmtDist(thisWeek.runM, state.settings.unit), series.map(function (w) { return { value: w.runM }; }), deltaBadge(thisWeek.runM, lastWeek.runM, true))
        ])
      ]));
    }

    /* 4. One insight — explainable, sourced */
    const all = Domain.insights(state);
    if (all.length) {
      const top = all[0];
      screen.appendChild(el("div", { class: "section" }, [
        el("div", { class: "section-head" }, [
          el("h2", { class: "section-title", text: "Insight" }),
          all.length > 1 ? el("button", { class: "btn btn-ghost btn-sm", text: "All", onclick: function () { ctx.go("progress"); } }) : null
        ]),
        insightCard(top)
      ]));
    }

    container.appendChild(screen);
  }

  function weekSessionCounts(state) {
    const series = Domain.weeklyVolumeSeries(state, 6);
    return series.map(function (w) { return { value: (w.sets > 0 ? 1 : 0) + w.runs }; });
  }

  function sparkCard(label, value, data, deltaHTML) {
    return el("div", { class: "spark" }, [
      el("div", { class: "metric-label", text: label }),
      el("div", { class: "metric-small", style: "font-weight:700;font-variant-numeric:tabular-nums;margin:4px 0 6px" }, [
        el("span", { text: String(value).split(" ")[0] }),
        String(value).indexOf(" ") > 0 ? el("span", { class: "unit", text: String(value).split(" ").slice(1).join(" ") }) : null
      ]),
      data.length >= 2 ? UI.sparkline(data) : el("div", { class: "micro muted-2", text: "Not enough data" }),
      deltaHTML || null
    ]);
  }

  function deltaBadge(cur, prev, inverse) {
    if (!prev) return null;
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (Math.abs(pct) < 2) return el("span", { class: "delta delta-flat micro", text: "— steady" });
    return el("span", { class: "delta " + (pct > 0 ? "delta-up" : "delta-down") + " micro", text: (pct > 0 ? "▲ " : "▼ ") + Math.abs(pct) + "% vs last wk" });
  }

  function readinessPicker() {
    const wrap = el("div", { class: "card" });
    wrap.appendChild(el("p", { class: "small muted mb-3", text: "How's your energy today? This adjusts coaching suggestions — it's your own rating, not a measured physiological value." }));
    const row = el("div", { class: "row", style: "gap:8px" });
    ["1", "2", "3", "4", "5"].forEach(function (n) {
      row.appendChild(el("button", {
        class: "chip", style: "flex:1;justify-content:center;min-height:48px", text: n,
        "aria-label": "Energy " + n + " out of 5",
        onclick: function () {
          Store.logReadiness({ date: Store.todayISO(), energy: parseInt(n, 10), soreness: 2, note: "" });
          UI.toast("Readiness logged. Noted in coaching.");
          Store.set(function () {}, { notify: false });
          window.App.rerender();
        }
      }));
    });
    wrap.appendChild(row);
    return wrap;
  }

  function readinessSummary(state) {
    const r = state.readiness.find(function (x) { return x.date === Store.todayISO(); });
    const avg = Domain.readinessAverage(state, 7);
    return el("div", { class: "card" }, [
      el("div", { class: "row-between" }, [
        el("div", {}, [
          el("div", { class: "metric-label", text: "Today's energy" }),
          el("div", { class: "metric-small", style: "font-weight:700" }, [
            el("span", { text: String(r ? r.energy : "—") }),
            el("span", { class: "unit", text: "/ 5" })
          ])
        ]),
        avg !== null ? el("div", { class: "small muted center" }, [
          el("div", { class: "metric-label", text: "7-day avg" }),
          el("div", { class: "num", style: "font-weight:650", text: avg.toFixed(1) })
        ]) : null
      ]),
      r && r.energy <= 2 ? el("p", { class: "small accent mt-3", text: "Low energy flagged — coaching will suggest an easier session today." }) : null
    ]);
  }

  function currentWeekPlan(state) {
    const wp = state.weekPlan;
    if (!wp || wp.weekStart !== Domain.weekStartISO()) return null;
    return wp;
  }

  function changeRow(c) {
    return el("div", { class: "insight-line mb-3" }, [
      el("span", { class: "il-icon" }, [UI.icon(c.trigger === "readiness" ? "heart" : c.kind === "defer" ? "clock" : "swap")]),
      el("div", {}, [
        el("p", { class: "il-text" }, [el("strong", { text: c.text + ". " }), c.why]),
        el("p", { class: "micro muted-2 mt-2", text: c.source })
      ])
    ]);
  }

  function adaptiveCard(state, ctx) {
    const wp = currentWeekPlan(state);
    if (wp && wp.dismissed) return null; // user kept their plan this week
    const proposal = Domain.rebalanceWeek(state);
    if (proposal.changes.length) return proposalCard(proposal, wp, ctx);
    if (wp && ((wp.changes && wp.changes.length) || (wp.dropped && wp.dropped.length))) return appliedCard(wp, ctx);
    return null;
  }

  function proposalCard(proposal, prior, ctx) {
    const ws = Domain.weekStartISO();
    const n = proposal.changes.length;
    const label = n === 1 ? "1 suggested change" : n + " suggested changes";
    return el("div", { class: "card mb-4" }, [
      el("div", { class: "row-between" }, [
        el("span", { class: "eyebrow", text: prior ? "Adaptive week · additions" : "Adaptive week" }),
        el("span", { class: "badge" }, [UI.icon("swap"), "SUGGESTED"])
      ]),
      el("p", { class: "small mt-4", text: proposal.summary }),
      el("p", { class: "micro muted-2 mt-2", text: "Nothing changes until you apply it — your generated template stays intact, and this only affects this week." }),
      el("button", {
        class: "btn btn-secondary btn-block mt-4",
        onclick: function () {
          const body = [el("p", { class: "small muted mb-4", text: proposal.summary })]
            .concat(proposal.changes.map(changeRow))
            .concat([
              el("button", {
                class: "btn btn-primary btn-lg btn-block mt-4",
                onclick: function () { applyProposal(proposal, prior, ws); }
              }, [UI.icon("check"), "Apply to this week"]),
              el("button", {
                class: "btn btn-ghost btn-block mt-3",
                text: "Keep my plan as is",
                onclick: function () {
                  dismissWeek(ws, "No changes applied — suggestions stay off for this week.");
                }
              })
            ]);
          UI.sheet("Review changes for this week", body);
        }
      }, [UI.icon("swap"), "Review changes (" + n + ")"])
    ]);
  }

  function applyProposal(proposal, prior, ws) {
    const keep = prior && !prior.dismissed ? prior : null;
    const moves = Object.assign({}, (keep && keep.moves) || {}, proposal.moves);
    const dropped = ((keep && keep.dropped) || []).slice();
    proposal.dropped.forEach(function (id) { if (dropped.indexOf(id) < 0) dropped.push(id); });
    const changes = ((keep && keep.changes) || []).slice().concat(proposal.changes);
    Store.saveWeekPlan({
      weekStart: ws,
      moves: moves,
      dropped: dropped,
      changes: changes,
      summary: proposal.summary,
      appliedAt: new Date().toISOString()
    });
    UI.closeSheet();
    UI.toast((proposal.changes.length === 1 ? "1 change" : proposal.changes.length + " changes") + " applied to this week. Your template is unchanged.");
    window.App.rerender();
  }

  function dismissWeek(ws, msg) {
    Store.saveWeekPlan({ weekStart: ws, dismissed: true, dismissedAt: new Date().toISOString() });
    UI.closeSheet();
    UI.toast(msg || "Kept as is.");
    window.App.rerender();
  }

  function appliedCard(wp, ctx) {
    const n = (wp.changes || []).length;
    return el("div", { class: "card mb-4" }, [
      el("div", { class: "row-between" }, [
        el("span", { class: "eyebrow", text: "This week, adapted" }),
        el("span", { class: "badge badge-accent" }, [UI.icon("check"), "APPLIED"])
      ]),
      el("p", { class: "small mt-4", text: wp.summary || ((n === 1 ? "1 change" : n + " changes") + " applied this week.") }),
      el("p", { class: "micro muted-2 mt-2", text: "This week only — next week returns to your generated template." }),
      el("div", { class: "row mt-4", style: "gap:8px" }, [
        el("button", {
          class: "btn btn-ghost btn-sm",
          onclick: function () { showReasons(wp); }
        }, [UI.icon("info"), "Why?"]),
        el("button", {
          class: "btn btn-ghost btn-sm",
          text: "Revert to template",
          onclick: function () {
            UI.confirmSheet(
              "Revert this week?",
              "Restore the generated template for this week. Adaptive suggestions stay off until next week.",
              "Revert",
              function () { dismissWeek(Domain.weekStartISO(), "Template restored for this week."); }
            );
          }
        })
      ])
    ]);
  }

  function showReasons(wp) {
    const rows = (wp.changes || []).map(changeRow);
    if (!rows.length) rows.push(el("p", { class: "small muted", text: "No recorded changes." }));
    UI.sheet("Why this week changed", [
      el("p", { class: "small muted mb-4", text: wp.summary || "" }),
      el("p", { class: "micro muted-2 mb-4", text: wp.appliedAt ? "Applied " + Domain.relDay(wp.appliedAt) + "." : "" })
    ].concat(rows));
  }

  function insightCard(insight) {
    return el("div", { class: "insight-line" }, [
      el("span", { class: "il-icon" }, [UI.icon(insight.kind === "warning" ? "warning" : "spark")]),
      el("div", {}, [
        el("p", { class: "il-text" }, [el("strong", { text: insight.text.split(".")[0] + ". " }), insight.text.split(".").slice(1).join(".").trim()]),
        insight.source ? el("p", { class: "micro muted-2 mt-2", text: insight.source }) : null
      ])
    ]);
  }

  window.HomeScreen = { render: render };
})();
