/* LMTLSS Profile — goals, plan editing, settings, data export and deletion. */

(function () {
  "use strict";

  const el = UI.el;

  function render(container, ctx) {
    const state = Store.get();
    const profile = state.profile || {};
    UI.clear(container);
    const screen = el("div", { class: "screen" });

    screen.appendChild(el("div", { class: "screen-head" }, [
      el("div", {}, [
        el("h1", { class: "screen-title", text: profile.name || "Profile" }),
        el("p", { class: "screen-sub", text: Domain.GOAL_LABELS[profile.goal] || "No goal set" })
      ])
    ]));

    /* Athlete summary — the unified profile across sports */
    screen.appendChild(el("div", { class: "card" }, [
      el("div", { class: "eyebrow mb-3", text: "Athlete profile" }),
      el("div", { class: "chip-row" }, [
        el("span", { class: "chip chip-static", text: Domain.EXPERIENCE_LABELS[profile.experience] || "—" }),
        el("span", { class: "chip chip-static", text: (profile.daysPerWeek || 4) + " days/week" })
      ].concat((profile.sports || []).map(function (s) {
        return el("span", { class: "chip chip-static", text: s.charAt(0).toUpperCase() + s.slice(1) });
      }))),
      profile.limitations ? el("p", { class: "small muted mt-4" }, [
        el("strong", { text: "Working around: " }), profile.limitations
      ]) : null,
      el("button", {
        class: "btn btn-secondary btn-sm mt-4",
        onclick: function () { editProfile(profile); }
      }, [UI.icon("swap"), "Edit profile"])
    ]));

    /* Weekly plan */
    const plan = (state.plan && state.plan.sessions) || [];
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-title", text: "Weekly plan" }),
        el("button", { class: "btn btn-ghost btn-sm", text: "Regenerate", onclick: function () { regenerate(profile); } })
      ]),
      plan.length ? el("div", { class: "panel" }, plan.map(function (s, i) {
        return el("button", {
          class: "panel-row",
          onclick: function () { editPlanSession(i); }
        }, [
          el("div", { class: "row" }, [
            el("span", { class: "badge", text: s.day }),
            el("div", {}, [
              el("div", { style: "font-weight:650", text: s.title }),
              el("div", { class: "micro muted-2 mt-2", text: s.sport === "running" ? (s.estMinutes || 30) + " min run" : UI.plural((s.exercises || []).length, "exercise") + " · ~" + (s.estMinutes || 50) + " min" })
            ])
          ]),
          UI.icon("chevron")
        ]);
      })) : el("div", { class: "empty-state" }, [
        el("h3", { text: "No plan" }),
        el("p", { text: "Regenerate from your profile." }),
        el("button", { class: "btn btn-secondary", text: "Generate", onclick: function () { regenerate(profile); } })
      ])
    ]));

    if (state.plan && state.plan.rationale) {
      screen.appendChild(el("div", { class: "card mt-3" }, [
        el("div", { class: "eyebrow mb-2", text: "Why your plan looks like this" }),
        el("ul", { class: "small muted", style: "margin:0;padding-left:18px" },
          state.plan.rationale.map(function (r) { return el("li", { text: r, style: "margin-bottom:6px" }); })
        )
      ]));
    }

    /* Units & session settings */
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [el("h2", { class: "section-title", text: "Settings" })]),
      el("div", { class: "panel" }, [
        el("div", { class: "panel-row panel-row-static" }, [
          el("div", {}, [
            el("div", { style: "font-weight:600", text: "Units" }),
            el("div", { class: "micro muted-2 mt-2", text: "Affects distance display" })
          ]),
          segmented(["metric", "imperial"], state.settings.unit, "km / kg vs mi / lb", function (v) {
            Store.updateSettings({ unit: v }); window.App.rerender();
          })
        ]),
        el("div", { class: "panel-row panel-row-static" }, [
          el("div", {}, [
            el("div", { style: "font-weight:600", text: "Default rest timer" }),
            el("div", { class: "micro muted-2 mt-2", text: "Starts after each completed set" })
          ]),
          segmented([60, 90, 120, 180], state.settings.restSeconds, "seconds", function (v) {
            Store.updateSettings({ restSeconds: v }); UI.toast("Rest timer set to " + v + "s.");
          }, function (v) { return v + "s"; })
        ])
      ])
    ]));

    /* Integrations — honest about what exists */
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [el("h2", { class: "section-title", text: "Integrations" })]),
      el("div", { class: "panel" }, [
        integrationRow("GPS / route tracking", "Not connected — distances are manual or estimated", false),
        integrationRow("Wearables (Garmin, Apple Watch, WHOOP)", "Coming in Phase 3 — not implemented yet", false),
        integrationRow("Health platforms (HealthKit, Health Connect)", "Coming in Phase 3 — not implemented yet", false)
      ]),
      el("p", { class: "micro muted-2 mt-3", text: "LMTLSS never shows a capability as working before it is implemented and tested." })
    ]));

    /* Data */
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [el("h2", { class: "section-title", text: "Your data" })]),
      el("div", { class: "panel" }, [
        el("button", {
          class: "panel-row",
          onclick: function () { exportData(); }
        }, [
          el("div", { class: "row" }, [UI.icon("download"), el("span", { style: "font-weight:600", text: "Export everything (JSON)" })]),
          UI.icon("chevron")
        ]),
        el("button", {
          class: "panel-row",
          onclick: function () {
            UI.confirmSheet("Delete all data?", "This erases your profile, plan, history, and settings from this device. Export first if you want a copy.", "Delete everything", function () {
              Store.resetAll();
              UI.toast("All data deleted.");
              window.App.rerender();
            }, true);
          }
        }, [
          el("div", { class: "row", style: "color:var(--danger)" }, [UI.icon("trash"), el("span", { style: "font-weight:600", text: "Delete account & all data" })]),
          UI.icon("chevron")
        ])
      ])
    ]));

    screen.appendChild(el("p", { class: "micro muted-2 center mt-8", text: "LMTLSS v1 · Training tool, not a medical device · Data stays on this device" }));

    container.appendChild(screen);
  }

  function integrationRow(name, status, connected) {
    return el("div", { class: "panel-row panel-row-static" }, [
      el("div", {}, [
        el("div", { style: "font-weight:600", text: name }),
        el("div", { class: "micro muted-2 mt-2", text: status })
      ]),
      el("span", { class: "badge", text: connected ? "Connected" : "Unavailable" })
    ]);
  }

  function segmented(values, current, label, onPick, fmt) {
    const row = el("div", { class: "chip-row" }, values.map(function (v) {
      return el("button", {
        class: "chip" + (v === current ? " selected" : ""),
        text: fmt ? fmt(v) : String(v).charAt(0).toUpperCase() + String(v).slice(1),
        "aria-pressed": String(v === current),
        "aria-label": (fmt ? fmt(v) : v) + " " + label,
        onclick: function () { onPick(v); }
      });
    }));
    return row;
  }

  /* ---------- Edit profile sheet ---------- */

  function editProfile(profile) {
    const draft = JSON.parse(JSON.stringify(profile));
    const body = [];

    body.push(el("label", { class: "field mb-4" }, [
      el("span", { class: "field-label", text: "Name" }),
      el("input", {
        class: "input", type: "text", value: draft.name || "",
        oninput: function (e) { draft.name = e.target.value; }
      })
    ]));

    body.push(el("div", { class: "field mb-4" }, [
      el("span", { class: "field-label", text: "Goal" }),
      segmented(Object.keys(Domain.GOAL_LABELS), draft.goal, "goal", function (v) {
        draft.goal = v;
        UI.closeSheet(); editProfile(draft);
      })
    ]));

    body.push(el("div", { class: "field mb-4" }, [
      el("span", { class: "field-label", text: "Experience" }),
      segmented(Object.keys(Domain.EXPERIENCE_LABELS), draft.experience, "experience", function (v) {
        draft.experience = v;
        UI.closeSheet(); editProfile(draft);
      })
    ]));

    body.push(el("div", { class: "field mb-4" }, [
      el("span", { class: "field-label", text: "Days per week" }),
      segmented([2, 3, 4, 5, 6], draft.daysPerWeek, "days per week", function (v) {
        draft.daysPerWeek = v;
        UI.closeSheet(); editProfile(draft);
      }, function (v) { return v + "d"; })
    ]));

    const limitsArea = el("textarea", { class: "input", placeholder: "Optional" });
    limitsArea.value = draft.limitations || "";
    limitsArea.addEventListener("input", function () { draft.limitations = limitsArea.value; });
    body.push(el("label", { class: "field mb-4" }, [
      el("span", { class: "field-label", text: "Limitations / accessibility needs" }),
      limitsArea
    ]));

    body.push(el("button", {
      class: "btn btn-primary btn-lg btn-block mt-4",
      onclick: function () {
        Store.setProfile(draft);
        UI.closeSheet();
        UI.toast("Profile updated.");
        window.App.rerender();
      }
    }, [UI.icon("check"), "Save profile"]));

    UI.sheet("Edit profile", body);
  }

  /* ---------- Plan editing ---------- */

  function regenerate(profile) {
    UI.confirmSheet("Regenerate your week?",
      "This rebuilds the weekly template from your current profile. Your logged history is untouched.",
      "Regenerate", function () {
        const plan = Domain.planFor(Store.get().profile || {});
        Store.savePlan(plan.sessions);
        Store.set(function (s) { s.plan.rationale = plan.rationale; });
        UI.toast("Plan regenerated.");
        window.App.rerender();
      });
  }

  function editPlanSession(index) {
    const state = Store.get();
    const session = state.plan.sessions[index];
    if (!session) return;
    const body = [];

    if (session.sport === "running") {
      body.push(el("div", { class: "field mb-4" }, [
        el("span", { class: "field-label", text: "Target duration" }),
        segmented([20, 30, 45, 60], session.estMinutes, "minutes", function (v) {
          Store.set(function (s) { s.plan.sessions[index].estMinutes = v; });
          UI.closeSheet(); editPlanSession(index); window.App.rerender();
        }, function (v) { return v + "m"; })
      ]));
    } else {
      const avail = Domain.availableExercises((Store.get().profile || {}).equipment);
      const chips = el("div", { class: "chip-row" }, avail.map(function (ex) {
        const on = (session.exercises || []).some(function (e) { return e.name === ex.name; });
        return el("button", {
          class: "chip" + (on ? " selected" : ""), text: ex.name,
          "aria-pressed": String(on),
          onclick: function () {
            Store.set(function (s) {
              const exs = s.plan.sessions[index].exercises;
              const i = exs.findIndex(function (e) { return e.name === ex.name; });
              if (i >= 0) exs.splice(i, 1);
              else exs.push({ name: ex.name, targetSets: 3, targetReps: 8, targetLoad: null, restSec: 90 });
            });
            UI.closeSheet(); editPlanSession(index); window.App.rerender();
          }
        });
      }));
      body.push(el("div", { class: "field mb-4" }, [
        el("span", { class: "field-label", text: "Exercises (tap to add/remove)" }),
        chips
      ]));
    }

    body.push(el("button", { class: "btn btn-secondary btn-block mt-4", text: "Done", onclick: function () { UI.closeSheet(); window.App.rerender(); } }));
    UI.sheet(session.day + " · " + session.title, body);
  }

  /* ---------- Export ---------- */

  function exportData() {
    const json = Store.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: "lmtlss-export-" + Store.todayISO() + ".json" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    UI.toast("Export downloaded.");
  }

  window.ProfileScreen = { render: render };
})();
