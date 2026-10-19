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
      const resumed = Domain.resumeSession(state.activeSession, Date.now());
      session = resumed.session;
      if (resumed.frozen) {
        Store.saveActive(session);
        UI.toast("Session resumed paused — the clock stopped while the app was closed.");
      }
    }

    if (session) {
      isTimedSession(session) ? renderRunning(container, ctx) : renderStrength(container, ctx);
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
      // This week's live adjustment (missed/readiness moves), if applied
      const wp = state.weekPlan && !state.weekPlan.dismissed && state.weekPlan.weekStart === Domain.weekStartISO() ? state.weekPlan : null;
      const effOf = function (s) { return Domain.effectivePlanDay(s, state); };
      const droppedOf = function (s) { return !!(wp && wp.dropped && wp.dropped.indexOf(s.id) >= 0); };
      // Put today's session first (adjustment-aware)
      const ordered = plan.slice().sort(function (a, b) {
        const rank = function (s) { return droppedOf(s) ? 1 : (effOf(s) === today ? 0 : 1); };
        return rank(a) - rank(b);
      });
      ordered.forEach(function (s) {
        const isDropped = droppedOf(s);
        const eff = isDropped ? s.day : effOf(s);
        const isToday = !isDropped && eff === today;
        const moved = !isDropped && eff !== s.day;
        panel.appendChild(el("button", {
          class: "panel-row",
          onclick: function () { startPlanSession(s, ctx); }
        }, [
          el("div", { class: "row" }, [
            el("span", { class: "badge" + (isToday ? " badge-accent" : ""), text: isDropped ? "SKIPPED" : isToday ? "TODAY" : eff }),
            el("div", {}, [
              el("div", { style: "font-weight:650", text: s.title }),
              el("div", { class: "micro muted-2 mt-2", text: (s.sport === "running"
                ? (s.estMinutes || 30) + " min run"
                : UI.plural((s.exercises || []).length, "exercise") + " · ~" + (s.estMinutes || 50) + " min") +
                (isDropped ? " · out of this week — next week's template returns" : moved ? " · moved from " + s.day : "") })
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
          onclick: function () { startSport("strength", ctx); }
        }, [UI.icon("dumbbell"), "Strength"]),
        el("button", {
          class: "btn btn-secondary", style: "min-height:64px",
          onclick: function () { startSport("running", ctx); }
        }, [UI.icon("run"), "Run"])
      ]),
      el("button", {
        class: "btn btn-ghost btn-block mt-3",
        onclick: function () { pickSport(ctx); }
      }, [UI.icon("plus"), "All " + Domain.SPORTS.length + " sports"])
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
    const idx = new Date().getDay();
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx];
  }

  /* ---------- Session start ---------- */

  function startPlanSession(tpl, ctx) {
    const state = Store.get();
    const profile = state.profile || {};
    session = {
      id: Store.uid("live"),
      sport: tpl.sport,
      title: tpl.title,
      planId: tpl.id || null, // links the finished log entry to this plan item
      startedAt: new Date().toISOString(),
      startMs: Date.now(),
      elapsedBase: 0,
      paused: false,
      exercises: [],
      distanceM: null,
      distanceSource: null,
      plannedMinutes: tpl.estMinutes || null,
      intervalTemplate: tpl.intervalTemplate ? {
        name: tpl.intervalTemplate.name,
        segments: tpl.intervalTemplate.segments.map(function (seg, i) {
          return { index: i, segmentType: seg.segmentType, targetDurationSec: seg.targetDurationSec, durationSec: null, done: false };
        })
      } : null,
      intervalSegments: (tpl.intervalTemplate && tpl.intervalTemplate.segments.length) ? [] : []
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

  /* ---------- Sport picker (every sport is startable) ---------- */

  function pickSport(ctx) {
    const groups = [
      ["endurance", "Endurance"], ["strength", "Strength"], ["combat", "Combat"],
      ["racket", "Racket"], ["precision", "Precision"], ["team", "Team"], ["other", "Other"]
    ];
    const body = [el("p", { class: "small muted mb-3", text: "Pick a sport. Timed sports start a live clock; the rest take a short manual entry — nothing is measured for you." })];
    groups.forEach(function (g) {
      const sports = Domain.sportsInGroup(g[0]);
      if (!sports.length) return;
      body.push(el("div", { class: "eyebrow mt-4 mb-2", text: g[1] }));
      body.push(el("div", { class: "chip-row" }, sports.map(function (s) {
        return el("button", {
          class: "chip", text: s.label,
          onclick: function () { UI.closeSheet(); startSport(s.id, ctx); }
        });
      })));
    });
    UI.sheet("Choose a sport", body);
  }

  /* Timed sports get the live clock; the rest are entered after the fact. */
  const TIMED_SPORTS = ["running", "cycling", "swimming"];

  /* A live session is timed when its sport runs on a clock. Older saved
     sessions predate the sport model but only ever used strength/running. */
  function isTimedSession(s) {
    if (!s) return false;
    return TIMED_SPORTS.indexOf(s.sport) >= 0;
  }

  function startSport(sportId, ctx) {
    const sport = Domain.sportById(sportId);
    if (!sport) { UI.toast("That sport isn't available.", { error: true }); return; }
    if (sport.id === "strength") { startFreeSession("strength", ctx); return; }
    if (TIMED_SPORTS.indexOf(sport.id) >= 0) { startTimedSport(sport, ctx); return; }
    manualSportEntry(sport, ctx);
  }

  function startTimedSport(sport, ctx) {
    session = {
      id: Store.uid("live"),
      sport: sport.id,
      title: sport.label,
      startedAt: new Date().toISOString(),
      startMs: Date.now(),
      elapsedBase: 0,
      paused: false,
      exercises: [],
      distanceM: null,
      distanceSource: null,
      plannedMinutes: null,
      intervalTemplate: null,
      intervalSegments: []
    };
    Store.saveActive(session);
    window.App.rerender();
  }

  /* Manual entry for sports the app cannot observe: the athlete types what
     happened, and only the metrics their sport actually records are offered. */
  function manualSportEntry(sport, ctx) {
    const defs = Domain.metricDefs(sport.id).filter(function (d) {
      return ["durationSec", "pace", "speed"].indexOf(d.key) < 0;
    });
    const fields = {};
    const body = [
      el("p", { class: "small muted mb-3", text: "Nothing is measured automatically for " + sport.label + ". Enter what you did — blank fields stay blank." })
    ];

    function addField(def) {
      const isText = def.kind === "text";
      const isDuration = def.kind === "duration";
      const input = el("input", {
        class: "input" + (isText ? "" : " input-num"),
        type: isText ? "text" : "number",
        inputmode: isText ? "text" : "numeric",
        min: "0",
        step: isDuration ? "1" : "1",
        placeholder: isText ? "Optional" : (isDuration ? "Minutes" : "Optional"),
        "aria-label": def.label
      });
      fields[def.key] = { def: def, input: input };
      body.push(el("label", { class: "field mb-3" }, [
        el("span", { class: "field-label", text: def.label + (isDuration ? " (minutes)" : "") }),
        input
      ]));
    }

    addField({ key: "durationSec", label: "Duration", kind: "duration" });
    defs.forEach(addField);

    body.push(el("button", {
      class: "btn btn-primary btn-lg btn-block mt-4",
      onclick: function () {
        const activity = { sport: sport.id };
        Object.keys(fields).forEach(function (key) {
          const f = fields[key];
          const raw = String(f.input.value || "").trim();
          if (!raw) return;
          if (f.def.kind === "text") { activity[key] = raw; return; }
          const n = parseFloat(raw);
          if (isNaN(n)) return;
          activity[key] = f.def.kind === "duration" ? Math.round(n * 60) : n;
        });
        const check = Domain.validateActivity(activity);
        if (!check.ok) {
          UI.toast(check.errors[0].message, { error: true });
          return;
        }
        if (!activity.durationSec && activity.durationSec !== 0) {
          UI.toast("Add how long the session lasted.", { error: true });
          return;
        }
        const record = { sport: sport.id, title: sport.label, startedAt: new Date().toISOString(), provenance: "manual", exercises: [] };
        Object.keys(activity).forEach(function (k) { if (k !== "sport") record[k] = activity[k]; });
        UI.closeSheet();
        completeSession(record, ctx, 1);
      }
    }, [UI.icon("check"), "Save " + sport.label.toLowerCase()]));

    body.push(el("button", { class: "btn btn-ghost btn-block mt-3", text: "Cancel", onclick: UI.closeSheet }));
    UI.sheet(sport.label, body);
  }

  function startFreeSession(sport, ctx) {
    session = {
      id: Store.uid("live"),
      sport: sport,
      title: sport === "running" ? "Run" : "Strength",
      startedAt: new Date().toISOString(),
      startMs: Date.now(),
      elapsedBase: 0,
      paused: false,
      exercises: [],
      distanceM: null,
      distanceSource: null,
      plannedMinutes: null,
      intervalTemplate: null,
      intervalSegments: []
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
              }
            }, [UI.icon("check")])
          ])
        ]);
      }))
    ]);

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

  function save() {
    Store.saveActive(session);
    window.App.rerender();
  }

  function lastPerformed(name) {
    const state = Store.get();
    const sessions = (state.log || []).filter(function (s) {
      return s.sport === "strength" && s.exercises;
    }).sort(function (a, b) { return a.startedAt > b.startedAt ? -1 : 1; });
    for (let i = 0; i < sessions.length; i++) {
      const ex = (sessions[i].exercises || []).find(function (e) { return e.name === name; });
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

    const toggleRun = function () {
      if (session.paused) {
        session.startMs = Date.now();
        session.paused = false;
      } else {
        session.elapsedBase += Date.now() - session.startMs;
        session.paused = true;
      }
      Store.saveActive(session);
      window.App.rerender();
    };

    inner.appendChild(el("div", { class: "row-between mb-6" }, [
      el("div", { class: "eyebrow", text: session.title }),
      el("button", {
        class: "icon-btn", "aria-label": session.paused ? "Resume run" : "Pause run",
        onclick: toggleRun
      }, [UI.icon(session.paused ? "play" : "pause")])
    ]));

    /* Record segments whose target time has elapsed, so the summary only ever
       reports work the runner actually did. */
    syncIntervalProgress();

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
        el("div", { class: "metric-label", text: session.sport === "cycling" ? "Avg speed" : "Avg pace" }),
        el("div", { class: "metric-small num", style: "font-weight:700", id: "live-pace", text: paceValue(elapsedSec, session.distanceM, session.sport) })
      ])
    ]));
    if (session.intervalTemplate && session.intervalTemplate.segments.length) {
      inner.appendChild(el("div", { class: "row mt-4", style: "justify-content:center;gap:32px" }, [
        el("div", { class: "center" }, [
          el("div", { class: "metric-label", text: "This segment" }),
          el("div", { class: "metric-small num", style: "font-weight:700", id: "interval-seg-time", text: "—" })
        ])
      ]));
    }

    /* Current interval segment card */
    (function () {
      if (!session.intervalTemplate || !session.intervalTemplate.segments.length) return;
      const idx = currentSegmentIndex();
      const tmpl = session.intervalTemplate.segments;
      if (idx < tmpl.length) {
        const seg = tmpl[idx];
        const remaining = Math.max(0, seg.targetDurationSec - elapsedInSegment(idx));
        inner.appendChild(el("div", { class: "card mt-4" }, [
          el("div", { class: "eyebrow mb-2", text: "Current segment" }),
          el("div", { class: "row-between" }, [
            el("div", {}, [
              el("div", { class: "metric-label", text: seg.segmentType === "work" ? "Work" : "Rest" }),
              el("div", { class: "metric-small num", style: "font-weight:700", text: (idx + 1) + "/" + tmpl.length })
            ]),
            el("div", { class: "center" }, [
              el("div", { class: "metric-label", text: "Remaining" }),
              el("div", { class: "metric-small num", style: "font-weight:700", text: Domain.fmtDur(remaining) })
            ])
          ]),
          el("p", { class: "small muted mt-2", text: seg.segmentType === "work"
            ? "Run the target, or tap done when you cut it short — only recorded segments count."
            : "Recover here; the next segment starts after this timer clears." }),
          el("button", {
            class: "btn btn-ghost btn-sm btn-block mt-3", text: "Segment done",
            onclick: function () {
              if (recordIntervalSegment()) window.App.rerender();
            }
          })
        ]));
      } else {
        inner.appendChild(el("div", { class: "card mt-4" }, [
          el("p", { class: "small muted", text: "All " + tmpl.length + " segments recorded. Finish the run when you're ready." })
        ]));
      }
    })();

    /* Structured targets for planned runs */
    if (session.plannedMinutes && session.title === "Long Run" && !(session.intervalTemplate && session.intervalTemplate.segments.length)) {
      inner.appendChild(el("div", { class: "insight-line mt-4" }, [
        el("span", { class: "il-icon" }, [UI.icon("info")]),
        el("div", {}, [el("p", { class: "il-text", text: "Target: " + session.plannedMinutes + " minutes at a pace you could hold a conversation at. Time matters more than speed on this one." })])
      ]));
    }

    /* Structured targets for interval runs */
    if (session.intervalTemplate && session.intervalTemplate.segments.length) {
      inner.appendChild(el("div", { class: "insight-line mt-4" }, [
        el("span", { class: "il-icon" }, [UI.icon("info")]),
        el("div", {}, [el("p", { class: "il-text", text: "Intervals: " + session.intervalTemplate.name + ". Run the work segments, recover in the rest segments, then finish when the session is done." })])
      ]));
      const currentIdx = currentSegmentIndex();
      if (currentIdx < session.intervalTemplate.segments.length) {
        const nextSeg = session.intervalTemplate.segments[currentIdx];
        const cue = nextSeg.segmentType === "work"
          ? "Next up: work segment " + (currentIdx + 1) + " of " + session.intervalTemplate.segments.length + "."
          : "Next up: rest segment " + (currentIdx + 1) + " of " + session.intervalTemplate.segments.length + ".";
        inner.appendChild(el("div", { class: "insight-line mt-3" }, [
          el("span", { class: "il-icon" }, [UI.icon(nextSeg.segmentType === "work" ? "bolt" : "clock")]),
          el("div", {}, [el("p", { class: "il-text", text: cue })])
        ]));
      }
    }

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
    return Domain.elapsedSec(session);
  }

  /* Pace for runners and swimmers, speed for cyclists — both derived from the
     same two inputs, and "—" when either is missing. */
  function paceValue(durationSec, distanceM, sportId) {
    if (!durationSec || !distanceM) return "—";
    if (sportId === "cycling") {
      return ((distanceM / 1000) / (durationSec / 3600)).toFixed(1) + " km/h";
    }
    return Domain.fmtPace(durationSec / (distanceM / 1000));
  }

  function startTicker() {
    stopTicker();
    tick = setInterval(function () {
      const node = document.getElementById("live-timer");
    if (node) node.textContent = fmtClock(liveElapsed());
    if (syncIntervalProgress()) { window.App.rerender(); return; }
      updateRunStats();
    }, 1000);
    const node = document.getElementById("live-timer");
    if (node) node.textContent = fmtClock(liveElapsed());
  }

  function updateRunStats() {
    const distNode = document.getElementById("live-dist");
    if (!distNode || !session || !isTimedSession(session)) return;
    const unit = (Store.get().settings || {}).unit;
    distNode.textContent = Domain.fmtDist(session.distanceM, unit);
    const paceNode = document.getElementById("live-pace");
    if (paceNode) {
      const elapsed = liveElapsed();
      paceNode.textContent = session.distanceM && elapsed > 5
        ? Domain.fmtPace(elapsed / (session.distanceM / 1000))
        : "—";
    }
    if (session.intervalTemplate && session.intervalTemplate.segments.length) {
      const segTimeNode = document.getElementById("interval-seg-time");
      if (segTimeNode) {
        const tmpl = session.intervalTemplate.segments;
        const idx = currentSegmentIndex();
        if (idx < tmpl.length) {
          const remaining = Math.max(0, tmpl[idx].targetDurationSec - elapsedInSegment(idx));
          segTimeNode.textContent = Domain.fmtDur(remaining);
        } else {
          segTimeNode.textContent = "—";
        }
      }
    }
  }

  /* ---------- Interval segment recording ----------
     Segments are only written when they finish (by target time or an explicit
     "done" tap), so the post-run summary reports completed work, never plan. */

  function currentSegmentIndex() {
    const segs = session.intervalSegments || [];
    let i = 0;
    while (i < segs.length && segs[i].done) i++;
    return i;
  }

  function recordedSeconds() {
    return (session.intervalSegments || []).reduce(function (a, s) { return a + (s.durationSec || 0); }, 0);
  }

  function elapsedInSegment(idx) {
    return Math.max(0, Domain.elapsedSec(session) - recordedSeconds());
  }

  function recordIntervalSegment() {
    if (!session || !isTimedSession(session) || !session.intervalTemplate) return false;
    const tmpl = session.intervalTemplate.segments;
    const idx = currentSegmentIndex();
    if (idx >= tmpl.length) return false;
    const segs = session.intervalSegments || (session.intervalSegments = []);
    segs.push({
      index: idx,
      segmentType: tmpl[idx].segmentType,
      targetDurationSec: tmpl[idx].targetDurationSec,
      durationSec: elapsedInSegment(idx),
      done: true
    });
    Store.saveActive(session);
    return true;
  }

  function syncIntervalProgress() {
    if (!session || !isTimedSession(session) || !session.intervalTemplate) return false;
    const tmpl = session.intervalTemplate.segments;
    let changed = false;
    for (let guard = 0; guard < tmpl.length; guard++) {
      const idx = currentSegmentIndex();
      if (idx >= tmpl.length) break;
      if (elapsedInSegment(idx) < tmpl[idx].targetDurationSec) break;
      if (!recordIntervalSegment()) break;
      changed = true;
    }
    return changed;
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
          planId: session.planId || undefined,
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
        el("div", {}, [el("div", { class: "metric-label", text: session.sport === "cycling" ? "Speed" : "Pace" }), el("div", { class: "metric-small num", style: "font-weight:700", text: paceValue(elapsed, session.distanceM, session.sport) })])
      ]),
      el("p", { class: "micro muted-2 mt-3", text: session.distanceM ? "Distance source: manually entered (no GPS connected)." : "No distance recorded — it will be saved as time only." })
    ]));

    if (session.intervalTemplate && session.intervalTemplate.segments.length) {
      const summary = Domain.runningIntervalSummary(session);
      const splitRows = (session.intervalSegments || []).map(function (seg, i) {
        if (!seg.done) return null;
        const label = (seg.segmentType === "work" ? "Work " : "Rest ") + (i + 1);
        return el("tr", {}, [
          el("td", {}, [el("span", { text: label })]),
          el("td", {}, [el("span", { class: "num", text: Domain.fmtDur(seg.durationSec) })]),
          el("td", {}, [el("span", { class: "num muted-2", text: Domain.fmtDur(summary.template && summary.template.segments[i] ? summary.template.segments[i].targetDurationSec : null) })])
        ]);
      }).filter(Boolean);
      if (splitRows.length) {
        body.push(el("div", { class: "card mb-4" }, [
          el("div", { class: "eyebrow mb-2", text: "Interval segments you recorded" }),
          el("p", { class: "small muted mb-3", text: "Time is what the clock recorded for each segment you completed. Target is the plan. Segments you skipped aren't listed." }),
          el("table", { class: "set-table" }, [
            el("thead", {}, [el("tr", {}, [
              el("th", { text: "Segment", scope: "col" }),
              el("th", { text: "Time", scope: "col" }),
              el("th", { text: "Target", scope: "col" })
            ])]),
            el("tbody", {}, splitRows)
          ])
        ]));
      }
    }

    const notes = el("textarea", { class: "input", placeholder: "Route, conditions, how it felt…", "aria-label": "Run notes" });
    body.push(el("label", { class: "field" }, [el("span", { class: "field-label", text: "Notes (optional)" }), notes]));

    body.push(el("button", {
      class: "btn btn-primary btn-lg btn-block mt-6",
      onclick: function () {
        const segs = (session.intervalSegments || []).slice();
        completeSession({
          sport: session.sport,
          title: session.title,
          planId: session.planId || undefined,
          startedAt: session.startedAt,
          durationSec: elapsed,
          distanceM: session.distanceM,
          distanceSource: session.distanceM ? "manual" : null,
          notes: notes.value || "",
          exercises: [],
          provenance: "manual",
          intervalTemplate: session.intervalTemplate || null,
          intervalSegments: segs
        }, ctx, 1);
      }
    }, [UI.icon("check"), "Save " + session.title.toLowerCase()]));

    body.push(el("button", { class: "btn btn-ghost btn-block mt-3", text: "Keep going", onclick: UI.closeSheet }));

    UI.sheet("Finish " + session.title.toLowerCase(), body);
  }

  /* Share card for a just-finished session. The card renders only recorded
     values, and keeps its provenance line (manual distance, manual entry). */
  function openShareCard(s) {
    const unit = (Store.get().settings || {}).unit || "metric";
    const card = ShareCards.composeCard(s, { unit: unit });
    const svg = ShareCards.toSVG(card, {});
    const preview = el("div", { class: "mb-4" });
    ShareCards.renderPreview(preview, svg);
    const filename = "lmtlss-" + (s.sport || "activity") + "-" +
      String(s.id || Date.now()).replace(/[^a-z0-9]/gi, "").slice(0, 12) + ".png";

    UI.sheet("Share " + (s.title || "activity").toLowerCase(), [
      preview,
      el("p", { class: "micro muted-2 mb-4", text: card.provenance || "Rendered from what this session recorded — nothing added." }),
      el("button", {
        class: "btn btn-primary btn-block",
        onclick: function () { ShareCards.shareCard(svg, (s.title || "Activity") + " · LMTLSS", filename); }
      }, [UI.icon("share"), "Share"]),
      el("button", {
        class: "btn btn-secondary btn-block mt-3",
        onclick: function () { ShareCards.exportPNG(svg, filename); }
      }, [UI.icon("download"), "Save image"]),
      el("button", { class: "btn btn-ghost btn-block mt-3", text: "Close", onclick: UI.closeSheet })
    ]);
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
      if (s.intervalTemplate && s.intervalTemplate.segments.length && s.intervalSegments && s.intervalSegments.length) {
        const summary = Domain.runningIntervalSummary(s);
        nodes.push(el("div", { class: "stat-pair mb-4" }, [
          el("div", {}, [el("div", { class: "metric-label", text: "Work time" }), el("div", { class: "metric-small num", style: "font-weight:700", text: Domain.fmtDur(summary.totalWorkSec) })]),
          el("div", {}, [el("div", { class: "metric-label", text: "Rest time" }), el("div", { class: "metric-small num", style: "font-weight:700", text: Domain.fmtDur(summary.totalRestSec) })]),
          el("div", {}, [el("div", { class: "metric-label", text: "Segments done" }), el("div", { class: "metric-small num", style: "font-weight:700", text: String(summary.completedSegments) + "/" + s.intervalTemplate.segments.length })])
        ]));
        const workCount = s.intervalSegments.filter(function (g) { return g.segmentType === "work"; }).length;
        nodes.push(el("div", { class: "panel-row panel-row-static" }, [
          el("div", {}, [
            el("div", { style: "font-weight:650", text: s.title || "Run" }),
            el("div", { class: "micro muted-2 mt-2", text: Domain.relDay(s.startedAt) + " · " + s.intervalTemplate.name })
          ]),
          el("div", { class: "center" }, [
            el("div", { class: "pr-row-value", text: workCount + "× work" }),
            el("div", { class: "micro muted-2", text: summary.completedSegments + "/" + s.intervalTemplate.segments.length + " segments recorded" })
          ])
        ]));
        nodes.push(el("p", { class: "small muted mb-4", text: "Interval splits come from the segments you completed during this run. Plan time is total target across all segments." }));
      }
    } else {
      /* Every other sport renders exactly the metrics it recorded — nothing
         is defaulted in to fill the row. */
      const metrics = Domain.activityMetrics(s, unit);
      if (metrics.length) {
        nodes.push(el("div", { class: "stat-pair mb-4" }, metrics.slice(0, 3).map(function (m) {
          return el("div", {}, [
            el("div", { class: "metric-label", text: m.label }),
            el("div", { class: "metric-small num", style: "font-weight:700", text: m.value })
          ]);
        })));
      }
      if (metrics.length > 3) {
        nodes.push(el("div", { class: "stat-pair mb-4" }, metrics.slice(3).map(function (m) {
          return el("div", {}, [
            el("div", { class: "metric-label", text: m.label }),
            el("div", { class: "metric-small num", style: "font-weight:700", text: m.value })
          ]);
        })));
      }
      nodes.push(el("p", { class: "micro muted-2 mb-4", text: "Entered manually — LMTLSS does not measure this sport." }));
    }

    if (s.notes) nodes.push(el("p", { class: "small muted mb-4", text: "“" + s.notes + "”" }));

    nodes.push(el("div", { class: "stack mt-4" }, [
      el("button", {
        class: "btn btn-secondary btn-block",
        onclick: function () { openShareCard(s); }
      }, [UI.icon("share"), "Share this activity"]),
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
