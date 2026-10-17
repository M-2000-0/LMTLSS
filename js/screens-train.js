/* LMTLSS Train — fast logging for strength, live timer for runs.
   Session state persists locally, so a refresh never loses a workout. */

(function () {
  "use strict";

  const el = UI.el;

  let session = null;      // active session object
  let tick = null;         // timer interval id
  let restState = null;    // {endsAt, interval}

  /* ---------- Entry point ---------- */

  function render(container, ctx, params) {
    const state = Store.get();

    // Resume an in-flight session (e.g. after refresh). If the page was left
    // open longer than 10 minutes, freeze the clock so idle time isn't counted.
    if (state.activeSession && (!session || session.id !== state.activeSession.id)) {
      session = state.activeSession;
      const updated = session.updatedAt || 0;
      const gap = Date.now() - updated;
      if (updated && gap > 10 * 60 * 1000) {
        if (!session.paused) {
          session.elapsedBase += Math.max(0, updated - session.startMs);
          session.paused = true;
        }
        session.startMs = Date.now();
        Store.saveActive(session);
        UI.toast("Session resumed paused — the clock stopped while the app was closed.");
      }
    }

    if (session) {
      session.sport === "running" ? renderRunning(container, ctx) : renderStrength(container, ctx);
      startTicker();
      return;
    }

    // No active session: picker
    UI.clear(container);
    const screen = el("div", { class: "screen" });
    screen.appendChild(el("div", { class: "screen-head" }, [
      el("div", {}, [
        el("h1", { class: "screen-title", text: "Train" }),
        el("p", { class: "screen-sub", text: "Start a planned session or log one freehand." })
      ])
    ]));

    const plan = (state.plan && state.plan.sessions) || [];
    const today = todayName();

    if (plan.length) {
      screen.appendChild(el("div", { class: "section-head" }, [el("h2", { class: "section-title", text: "Your week" })]));
      const panel = el("div", { class: "panel" });
      // Put today's session first
      const ordered = plan.slice().sort(function (a, b) {
        return (a.day === today ? 0 : 1) - (b.day === today ? 0 : 1);
      });
      ordered.forEach(function (s) {
        const isToday = s.day === today;
        panel.appendChild(el("button", {
          class: "panel-row",
          onclick: function () { startPlanSession(s, ctx); }
        }, [
          el("div", { class: "row" }, [
            el("span", { class: "badge" + (isToday ? " badge-accent" : ""), text: isToday ? "TODAY" : s.day }),
            el("div", {}, [
              el("div", { style: "font-weight:650", text: s.title }),
              el("div", { class: "micro muted-2 mt-2", text: s.sport === "running"
                ? (s.estMinutes || 30) + " min run"
                : UI.plural((s.exercises || []).length, "exercise") + " · ~" + (s.estMinutes || 50) + " min" })
            ])
          ]),
          UI.icon("play")
        ]));
      });
      screen.appendChild(panel);
    } else {
      screen.appendChild(el("div", { class: "empty-state" }, [
        UI.icon("train"),
        el("h3", { text: "No weekly plan" }),
        el("p", { text: "Generate one from your profile, or log a freeform session below." }),
        el("button", { class: "btn btn-secondary", text: "Open Profile", onclick: function () { ctx.go("profile"); } })
      ]));
    }

    /* Quick starts */
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [el("h2", { class: "section-title", text: "Quick start" })]),
      el("div", { class: "grid-2" }, [
        el("button", {
          class: "btn btn-secondary", style: "min-height:64px",
          onclick: function () { startFreeSession("strength", ctx); }
        }, [UI.icon("dumbbell"), "Free strength"]),
        el("button", {
          class: "btn btn-secondary", style: "min-height:64px",
          onclick: function () { startFreeSession("running", ctx); }
        }, [UI.icon("run"), "Free run"])
      ])
    ]));

    /* Recent sessions */
    const log = (state.log || []).slice().sort(function (a, b) { return a.startedAt < b.startedAt ? 1 : -1; }).slice(0, 5);
    if (log.length) {
      screen.appendChild(el("div", { class: "section" }, [
        el("div", { class: "section-head" }, [
          el("h2", { class: "section-title", text: "Recent" }),
          el("button", { class: "btn btn-ghost btn-sm", text: "All history", onclick: function () { ctx.go("progress"); } })
        ]),
        el("div", { class: "panel" }, log.map(function (s) {
          return el("div", { class: "panel-row panel-row-static" }, [
            el("div", {}, [
              el("div", { style: "font-weight:600", text: s.title }),
              el("div", { class: "micro muted-2 mt-2", text: Domain.relDay(s.startedAt) + " · " + Domain.fmtDurHuman(s.durationSec || 0) })
            ]),
            el("span", { class: "badge", text: s.sport === "running" ? "RUN" : "STR" })
          ]);
        }))
      ]));
    }

    container.appendChild(screen);
  }

  function todayName() {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
  }

  /* ---------- Session creation ---------- */

  function startPlanSession(tpl, ctx) {
    const state = Store.get();
    const profile = state.profile || {};
    session = {
      id: Store.uid("live"),
      sport: tpl.sport,
      title: tpl.title,
      startedAt: new Date().toISOString(),
      startMs: Date.now(),
      elapsedBase: 0,
      paused: false,
      exercises: [],
      distanceM: null,
      distanceSource: null,
      plannedMinutes: tpl.estMinutes || null
    };
    if (tpl.sport === "strength") {
      session.exercises = (tpl.exercises || []).map(function (e) {
        const last = Domain.recentTopSets(state, e.name, 1)[0] || null;
        return {
          name: e.name,
          targetSets: e.targetSets || 3,
          targetReps: e.targetReps || 5,
          lastLoad: last,
          sets: Array.from({ length: e.targetSets || 3 }, function () {
            return { reps: e.targetReps || 5, load: last || null, done: false };
          })
        };
      });
    }
    Store.saveActive(session);
    window.App.rerender();
  }

  function startFreeSession(sport, ctx) {
    session = {
      id: Store.uid("live"),
      sport: sport,
      title: sport === "running" ? "Free Run" : "Free Strength",
      startedAt: new Date().toISOString(),
      startMs: Date.now(),
      elapsedBase: 0,
      paused: false,
      exercises: [],
      distanceM: null,
      distanceSource: null,
      plannedMinutes: null
    };
    Store.saveActive(session);
    window.App.rerender();
  }

  /* ---------- Strength session UI ---------- */

  function renderStrength(container, ctx) {
    UI.clear(container);
    const wrap = el("div", { class: "session-live" });
    const inner = el("div", { class: "session-live-inner" });

    /* Header with live timer */
    inner.appendChild(el("div", { class: "row-between mb-4" }, [
      el("div", {}, [
        el("div", { class: "eyebrow", text: session.title }),
        el("div", { class: "session-timer num" + (session.paused ? " paused" : ""), id: "live-timer", text: "0:00" })
      ]),
      el("button", {
        class: "icon-btn",
        "aria-label": session.paused ? "Resume session" : "Pause session",
        onclick: function () {
          if (session.paused) {
            session.startMs = Date.now();
            session.paused = false;
          } else {
            session.elapsedBase += Date.now() - session.startMs;
            session.paused = true;
          }
          Store.saveActive(session);
          window.App.rerender();
        }
      }, [UI.icon(session.paused ? "play" : "pause")])
    ]));

    /* Rest banner */
    inner.appendChild(restBanner());

    /* Exercise blocks */
    if (!session.exercises.length) {
      inner.appendChild(el("div", { class: "empty-state mb-4" }, [
        UI.icon("dumbbell"),
        el("h3", { text: "No exercises yet" }),
        el("p", { text: "Add your first exercise — loads are prefilled from your history when you have one." })
      ]));
    }
    session.exercises.forEach(function (ex, ei) {
      inner.appendChild(exerciseBlock(ex, ei));
    });

    /* Add exercise */
    inner.appendChild(el("button", {
      class: "btn btn-secondary btn-block mt-4",
      onclick: function () { pickExercise(); }
    }, [UI.icon("plus"), "Add exercise"]));

    container.appendChild(wrap);
    wrap.appendChild(inner);
    wrap.appendChild(dock([
      el("button", {
        class: "btn btn-primary btn-lg btn-block",
        onclick: function () { finishStrength(ctx); }
      }, [UI.icon("check"), "Finish session"])
    ]));
  }

  function exerciseBlock(ex, ei) {
    const state = Store.get();
    const prev = lastPerformed(ex.name);
    const pr = Domain.strengthPRs(state)[ex.name];
    const doneCount = ex.sets.filter(function (s) { return s.done; }).length;

    const head = el("div", { class: "exercise-head" }, [
      el("div", {}, [
        el("div", { class: "exercise-name", text: ex.name || "New exercise" }),
        el("div", { class: "exercise-ctx", text: (prev ? "Last: " + prev : "No history") + " · " + doneCount + "/" + ex.sets.length + " sets done" })
      ]),
      el("div", { class: "row", style: "gap:6px" }, [
        pr && doneCount === ex.sets.length ? el("span", { class: "badge badge-accent" }, [UI.icon("trophy"), "PR"]) : null,
        el("button", {
          class: "icon-btn", "aria-label": "Options for " + ex.name,
          onclick: function () { exerciseOptions(ei); }
        }, [el("span", { text: "···", style: "letter-spacing:2px;font-weight:700" })])
      ])
    ]);

    const table = el("table", { class: "set-table" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "#", scope: "col" }),
        el("th", { text: "Reps", scope: "col" }),
        el("th", { text: "kg", scope: "col" }),
        el("th", { text: "Done", scope: "col" })
      ])]),
      el("tbody", {}, ex.sets.map(function (st, si) {
        return el("tr", { class: st.done ? "done" : "" }, [
          el("td", {}, [el("span", { class: "num muted-2", text: String(si + 1) })]),
          el("td", {}, [numInput(st.reps, 1, 999, function (v) { st.reps = v; save(); }, "reps for set " + (si + 1))]),
          el("td", {}, [numInput(st.load, 0, 999, function (v) { st.load = v; save(); }, "load in kg for set " + (si + 1))]),
          el("td", {}, [
            el("button", {
              class: "set-check", "aria-pressed": String(!!st.done),
              "aria-label": (st.done ? "Mark set " + (si + 1) + " as not done" : "Mark set " + (si + 1) + " as done"),
              onclick: function () {
                st.done = !st.done;
                save();
                if (st.done) startRest();
                window.App.rerender();
              }
            }, [UI.icon("check")])
          ])
        ]);
      }))
    ]);

    function save() { Store.saveActive(session); }

    return el("div", { class: "exercise-block mb-3" }, [head, table]);
  }

  function numInput(value, min, max, onChange, label) {
    const input = el("input", {
      class: "set-input", type: "number", inputmode: "numeric",
      min: String(min), max: String(max),
      "aria-label": label,
      value: value === null || value === undefined ? "" : String(value)
    });
    input.addEventListener("change", function () {
      const v = parseFloat(input.value);
      onChange(isNaN(v) ? null : Math.min(max, Math.max(min, v)));
    });
    return input;
  }

  function lastPerformed(name) {
    const state = Store.get();
    const done = state.log.filter(function (s) { return s.sport === "strength"; })
      .sort(function (a, b) { return a.startedAt < b.startedAt ? 1 : -1; });
    for (let i = 0; i < done.length; i++) {
      const ex = (done[i].exercises || []).find(function (e) { return e.name === name; });
      if (ex && ex.sets && ex.sets.length) {
        const top = ex.sets.reduce(function (m, st) { return (st.load || 0) > (m.load || 0) ? st : m; }, ex.sets[0]);
        return ex.sets.length + "×" + top.reps + (top.load ? " @ " + top.load + " kg" : " BW");
      }
    }
    return null;
  }

  function exerciseOptions(ei) {
    const ex = session.exercises[ei];
    const body = [
      el("button", {
        class: "panel-row", onclick: function () { UI.closeSheet(); substituteExercise(ei); }
      }, [el("span", { style: "font-weight:600", text: "Substitute exercise" }), UI.icon("swap")]),
      el("button", {
        class: "panel-row", onclick: function () {
          ex.sets.push({ reps: ex.targetReps || 8, load: ex.lastLoad || null, done: false });
          Store.saveActive(session); UI.closeSheet(); window.App.rerender();
        }
      }, [el("span", { style: "font-weight:600", text: "Add a set" }), UI.icon("plus")]),
      el("button", {
        class: "panel-row", style: "color:var(--danger)",
        onclick: function () {
          session.exercises.splice(ei, 1);
          Store.saveActive(session); UI.closeSheet(); window.App.rerender();
        }
      }, [el("span", { style: "font-weight:600", text: "Remove exercise" }), UI.icon("trash")])
    ];
    UI.sheet(ex.name || "Exercise", body);
  }

  function substituteExercise(ei) {
    const profile = Store.get().profile || {};
    const avail = Domain.availableExercises(profile.equipment);
    const current = session.exercises[ei].name;
    const chips = el("div", { class: "chip-row" }, avail.filter(function (e) { return e.name !== current; }).map(function (e) {
      const last = Domain.recentTopSets(Store.get(), e.name, 1)[0] || null;
      return el("button", {
        class: "chip", text: e.name + (last ? " · " + last + " kg" : ""),
        "aria-label": "Substitute " + current + " with " + e.name,
        onclick: function () {
          const old = session.exercises[ei];
          session.exercises[ei] = {
            name: e.name,
            targetSets: old.sets.length,
            targetReps: old.targetReps,
            lastLoad: last,
            sets: old.sets.map(function (s) { return { reps: s.reps, load: last, done: false }; })
          };
          Store.saveActive(session);
          UI.toast("Swapped to " + e.name + (last ? " — loads prefilled from your history." : "."));
          UI.closeSheet();
          window.App.rerender();
        }
      });
    }));
    UI.sheet("Substitute " + current, [
      el("p", { class: "small muted mb-3", text: "Filtered to equipment you told us you have." }),
      chips
    ]);
  }

  function pickExercise() {
    const profile = Store.get().profile || {};
    const avail = Domain.availableExercises(profile.equipment);
    const chips = el("div", { class: "chip-row" }, avail.map(function (e) {
      const last = Domain.recentTopSets(Store.get(), e.name, 1)[0] || null;
      return el("button", {
        class: "chip", text: e.name + (last ? " · " + last + " kg" : ""),
        onclick: function () {
          session.exercises.push({
            name: e.name,
            targetSets: 3,
            targetReps: 8,
            lastLoad: last,
            sets: Array.from({ length: 3 }, function () { return { reps: 8, load: last, done: false }; })
          });
          Store.saveActive(session);
          UI.closeSheet();
          window.App.rerender();
        }
      });
    }));
    UI.sheet("Add exercise", [chips]);
  }

  /* ---------- Rest timer ---------- */

  function startRest() {
    const secs = (Store.get().settings || {}).restSeconds || 90;
    stopRest();
    restState = { endsAt: Date.now() + secs * 1000, interval: null };
    restState.interval = setInterval(updateRestBanner, 1000);
  }

  function stopRest() {
    if (restState && restState.interval) clearInterval(restState.interval);
    restState = null;
  }

  function restBanner() {
    const wrap = el("div", { id: "rest-banner" });
    if (!restState) return wrap;
    const remaining = Math.max(0, Math.round((restState.endsAt - Date.now()) / 1000));
    if (remaining <= 0) { stopRest(); return wrap; }
    wrap.appendChild(el("div", { class: "rest-banner", role: "status" }, [
      el("div", {}, [
        el("div", { class: "eyebrow accent", text: "Resting" }),
        el("div", { class: "small muted", text: "Next set starts when you're ready" })
      ]),
      el("div", { class: "row", style: "gap:8px" }, [
        el("span", { class: "rest-time", id: "rest-time", text: fmtClock(remaining) }),
        el("button", {
          class: "btn btn-ghost btn-sm", text: "Skip",
          onclick: function () { stopRest(); window.App.rerender(); }
        })
      ])
    ]));
    return wrap;
  }

  function updateRestBanner() {
    const node = document.getElementById("rest-time");
    if (!restState || !node) { stopRest(); return; }
    const remaining = Math.max(0, Math.round((restState.endsAt - Date.now()) / 1000));
    if (remaining <= 0) {
      stopRest();
      UI.toast("Rest done — next set.");
      window.App.rerender();
      return;
    }
    node.textContent = fmtClock(remaining);
  }

  /* ---------- Running session UI ---------- */

  function renderRunning(container, ctx) {
    UI.clear(container);
    const wrap = el("div", { class: "session-live" });
    const inner = el("div", { class: "session-live-inner" });

    inner.appendChild(el("div", { class: "row-between mb-6" }, [
      el("div", { class: "eyebrow", text: session.title }),
      el("button", {
        class: "icon-btn", "aria-label": session.paused ? "Resume run" : "Pause run",
        onclick: function () {
          if (session.paused) { session.startMs = Date.now(); session.paused = false; }
          else { session.elapsedBase += Date.now() - session.startMs; session.paused = true; }
          Store.saveActive(session);
          window.App.rerender();
        }
      }, [UI.icon(session.paused ? "play" : "pause")])
    ]));

    inner.appendChild(el("div", { class: "timer-big num" + (session.paused ? " muted-2" : ""), id: "live-timer", text: "0:00" }));

    /* Live pace — only meaningful once a distance exists */
    const elapsedSec = liveElapsed();
    const pace = session.distanceM ? elapsedSec / (session.distanceM / 1000) : null;
    inner.appendChild(el("div", { class: "row mt-6", style: "justify-content:center;gap:32px" }, [
      el("div", { class: "center" }, [
        el("div", { class: "metric-label", text: "Distance" }),
        el("div", { class: "metric-small num", style: "font-weight:700", id: "live-dist", text: Domain.fmtDist(session.distanceM, (Store.get().settings || {}).unit) })
      ]),
      el("div", { class: "center" }, [
        el("div", { class: "metric-label", text: "Avg pace" }),
        el("div", { class: "metric-small num", style: "font-weight:700", id: "live-pace", text: pace ? Domain.fmtPace(pace) : "—" })
      ])
    ]));

    /* Distance entry — manual, honestly labeled */
    inner.appendChild(el("div", { class: "card mt-6" }, [
      el("div", { class: "eyebrow mb-2", text: "Distance" }),
      el("p", { class: "small muted mb-3", text: "No GPS is connected. Enter distance now or when you finish — it will be labeled as manually entered." }),
      el("div", { class: "row" }, [
        el("input", {
          class: "input input-num", type: "number", step: "0.1", min: "0",
          inputmode: "decimal",
          "aria-label": "Distance in kilometers",
          value: session.distanceM ? (session.distanceM / 1000).toFixed(2) : "",
          oninput: function (e) {
            const v = parseFloat(e.target.value);
            session.distanceM = isNaN(v) ? null : v * 1000;
            session.distanceSource = "manual";
            Store.saveActive(session);
            updateRunStats();
          }
        }),
        el("span", { class: "muted", style: "font-weight:600", text: "km" })
      ])
    ]));

    /* Structured targets for planned runs */
    if (session.plannedMinutes && session.title === "Long Run") {
      inner.appendChild(el("div", { class: "insight-line mt-4" }, [
        el("span", { class: "il-icon" }, [UI.icon("info")]),
        el("div", {}, [el("p", { class: "il-text", text: "Target: " + session.plannedMinutes + " minutes at a pace you could hold a conversation at. Time matters more than speed on this one." })])
      ]));
    }

    container.appendChild(wrap);
    wrap.appendChild(inner);
    wrap.appendChild(dock([
      el("button", {
        class: "btn btn-primary btn-lg btn-block",
        onclick: function () { finishRunning(ctx); }
      }, [UI.icon("check"), "Finish run"])
    ]));
  }

  /* ---------- Shared live-session chrome ---------- */

  function dock(buttons) {
    return el("div", { class: "session-dock" }, [el("div", { class: "session-dock-inner" }, buttons)]);
  }

  function liveElapsed() {
    return Math.floor((session.elapsedBase + (session.paused ? 0 : Date.now() - session.startMs)) / 1000);
  }

  function startTicker() {
    stopTicker();
    tick = setInterval(function () {
      const node = document.getElementById("live-timer");
      if (node) node.textContent = fmtClock(liveElapsed());
      updateRunStats();
    }, 1000);
    const node = document.getElementById("live-timer");
    if (node) node.textContent = fmtClock(liveElapsed());
  }

  /* Live distance/pace display for running — updates without re-rendering the input */
  function updateRunStats() {
    const distNode = document.getElementById("live-dist");
    if (!distNode || !session || session.sport !== "running") return;
    const unit = (Store.get().settings || {}).unit;
    distNode.textContent = Domain.fmtDist(session.distanceM, unit);
    const paceNode = document.getElementById("live-pace");
    if (paceNode) {
      const elapsed = liveElapsed();
      paceNode.textContent = session.distanceM && elapsed > 5
        ? Domain.fmtPace(elapsed / (session.distanceM / 1000))
        : "—";
    }
  }

  function stopTicker() {
    if (tick) { clearInterval(tick); tick = null; }
  }

  function fmtClock(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }

  /* ---------- Finishing ---------- */

  function finishStrength(ctx) {
    const named = session.exercises.filter(function (e) { return e.name; });
    const doneSets = named.reduce(function (a, e) { return a + e.sets.filter(function (s) { return s.done; }).length; }, 0);
    if (!doneSets) {
      UI.toast("Mark at least one set done before finishing.", { error: true });
      return;
    }
    const elapsed = liveElapsed();
    const body = [
      el("div", { class: "card mb-4" }, [
        el("div", { class: "metric-label", text: "Duration" }),
        el("div", { class: "metric-small num", style: "font-weight:700", text: Domain.fmtDurHuman(elapsed) }),
        el("div", { class: "small muted mt-2", text: UI.plural(doneSets, "working set") + " · " + UI.plural(session.exercises.filter(function (e) { return e.name; }).length, "exercise") })
      ])
    ];

    const notes = el("textarea", { class: "input", placeholder: "How did it feel? Anything to remember next time?", "aria-label": "Session notes" });
    body.push(el("label", { class: "field" }, [el("span", { class: "field-label", text: "Notes (optional)" }), notes]));

    body.push(el("button", {
      class: "btn btn-primary btn-lg btn-block mt-6",
      onclick: function () {
        completeSession({
          sport: "strength",
          title: session.title,
          startedAt: session.startedAt,
          durationSec: elapsed,
          notes: notes.value || "",
          exercises: session.exercises.filter(function (e) { return e.name && e.sets.some(function (s) { return s.done; }); }).map(function (e) {
            return { name: e.name, sets: e.sets.filter(function (s) { return s.done; }).map(function (s) { return { reps: s.reps, load: s.load || 0, done: true }; }) };
          }),
          provenance: "manual"
        }, ctx, doneSets);
      }
    }, [UI.icon("check"), "Save session"]));

    body.push(el("button", { class: "btn btn-ghost btn-block mt-3", text: "Keep logging", onclick: UI.closeSheet }));

    UI.sheet("Finish session", body);
  }

  function finishRunning(ctx) {
    const elapsed = liveElapsed();
    if (elapsed < 30) {
      UI.toast("Run is under 30 seconds — keep going or discard.", { error: true });
      return;
    }
    const body = [];
    if (!session.distanceM) {
      body.push(el("label", { class: "field mb-4" }, [
        el("span", { class: "field-label", text: "Distance (km) — optional" }),
        (function () {
          const i = el("input", { class: "input input-num", type: "number", step: "0.1", min: "0", inputmode: "decimal", "aria-label": "Final distance in kilometers" });
          i.addEventListener("change", function () {
            const v = parseFloat(i.value);
            session.distanceM = isNaN(v) ? null : v * 1000;
            session.distanceSource = "manual";
          });
          return i;
        })()
      ]));
    }
    body.push(el("div", { class: "card mb-4" }, [
      el("div", { class: "stat-pair" }, [
        el("div", {}, [el("div", { class: "metric-label", text: "Time" }), el("div", { class: "metric-small num", style: "font-weight:700", text: Domain.fmtDur(elapsed) })]),
        el("div", {}, [el("div", { class: "metric-label", text: "Distance" }), el("div", { class: "metric-small num", style: "font-weight:700", text: session.distanceM ? Domain.fmtDist(session.distanceM, (Store.get().settings || {}).unit) : "—" })]),
        el("div", {}, [el("div", { class: "metric-label", text: "Pace" }), el("div", { class: "metric-small num", style: "font-weight:700", text: session.distanceM ? Domain.fmtPace(elapsed / (session.distanceM / 1000)) : "—" })])
      ]),
      el("p", { class: "micro muted-2 mt-3", text: session.distanceM ? "Distance source: manually entered (no GPS connected)." : "No distance recorded — the run will be saved as time only." })
    ]));

    const notes = el("textarea", { class: "input", placeholder: "Route, conditions, how it felt…", "aria-label": "Run notes" });
    body.push(el("label", { class: "field" }, [el("span", { class: "field-label", text: "Notes (optional)" }), notes]));

    body.push(el("button", {
      class: "btn btn-primary btn-lg btn-block mt-6",
      onclick: function () {
        completeSession({
          sport: "running",
          title: session.title === "Free Run" ? (session.distanceM && session.distanceM >= 8000 ? "Long Run" : "Easy Run") : session.title,
          startedAt: session.startedAt,
          durationSec: elapsed,
          distanceM: session.distanceM,
          distanceSource: session.distanceM ? "manual" : null,
          notes: notes.value || "",
          exercises: [],
          provenance: "manual"
        }, ctx, 1);
      }
    }, [UI.icon("check"), "Save run"]));

    body.push(el("button", { class: "btn btn-ghost btn-block mt-3", text: "Keep running", onclick: UI.closeSheet }));

    UI.sheet("Finish run", body);
  }

  function completeSession(record, ctx, doneSets) {
    const s = Object.assign({ id: Store.uid("sess") }, record);
    Store.addSession(s);
    Store.clearActive();
    stopTicker();
    stopRest();
    session = null;
    UI.closeSheet();
    UI.toast("Session saved to your history.");

    // Post-workout summary
    setTimeout(function () { showSummary(s, ctx, doneSets); }, 250);
  }

  function showSummary(s, ctx, doneSets) {
    const state = Store.get();
    const unit = state.settings.unit;
    const nodes = [];

    if (s.sport === "strength") {
      const vol = (s.exercises || []).reduce(function (a, e) {
        return a + e.sets.reduce(function (b, st) { return b + (st.load || 0) * (st.reps || 0); }, 0);
      }, 0);
      const prs = Domain.strengthPRs(state);
      const newPRs = (s.exercises || []).filter(function (e) {
        const pr = prs[e.name];
        return pr && pr.sessionId === s.id;
      }).map(function (e) { return e.name; });

      nodes.push(el("div", { class: "stat-pair mb-4" }, [
        el("div", {}, [el("div", { class: "metric-label", text: "Volume" }), el("div", { class: "metric-small num", style: "font-weight:700", text: Domain.fmt(vol) + " kg" })]),
        el("div", {}, [el("div", { class: "metric-label", text: "Sets" }), el("div", { class: "metric-small num", style: "font-weight:700", text: String(doneSets) })])
      ]));
      if (newPRs.length) {
        nodes.push(el("div", { class: "insight-line mb-4" }, [
          el("span", { class: "il-icon" }, [UI.icon("trophy")]),
          el("div", {}, [el("p", { class: "il-text" }, [
            el("strong", { text: "Estimated 1RM record: " }),
            newPRs.join(", ") + ". Based on your best set today (Epley formula — an estimate, not a tested max)."
          ])])
        ]));
      }
    } else if (s.sport === "running") {
      nodes.push(el("div", { class: "stat-pair mb-4" }, [
        el("div", {}, [el("div", { class: "metric-label", text: "Time" }), el("div", { class: "metric-small num", style: "font-weight:700", text: Domain.fmtDur(s.durationSec) })]),
        el("div", {}, [el("div", { class: "metric-label", text: "Distance" }), el("div", { class: "metric-small num", style: "font-weight:700", text: s.distanceM ? Domain.fmtDist(s.distanceM, unit) : "—" })]),
        el("div", {}, [el("div", { class: "metric-label", text: "Pace" }), el("div", { class: "metric-small num", style: "font-weight:700", text: s.distanceM ? Domain.fmtPace(s.durationSec / (s.distanceM / 1000)) : "—" })])
      ]));
    }

    if (s.notes) nodes.push(el("p", { class: "small muted mb-4", text: "“" + s.notes + "”" }));

    nodes.push(el("div", { class: "stack mt-4" }, [
      el("button", {
        class: "btn btn-secondary btn-block",
        onclick: function () { UI.closeSheet(); ctx.go("progress"); }
      }, [UI.icon("progress"), "See progress"]),
      el("button", { class: "btn btn-ghost btn-block", text: "Done", onclick: function () { UI.closeSheet(); ctx.go("home"); } })
    ]));

    UI.sheet("Session complete", nodes);
  }

  /* ---------- Teardown ---------- */

  function teardown() {
    stopTicker();
  }

  window.TrainScreen = { render: render, teardown: teardown };
})();
