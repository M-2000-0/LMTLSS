/* LMTLSS Fuel — hydration and meal logging with honest estimate labels.
   Entries are user-entered estimates, never measured intake. */

(function () {
  "use strict";

  const el = UI.el;

  function render(container, ctx) {
    const state = Store.get();
    UI.clear(container);
    const screen = el("div", { class: "screen" });

    screen.appendChild(el("div", { class: "screen-head" }, [
      el("div", {}, [
        el("h1", { class: "screen-title", text: "Fuel" }),
        el("p", { class: "screen-sub", text: "Hydration and meals — your own entries, labeled as estimates." })
      ])
    ]));

    const today = Store.todayISO();
    const hRow = (state.hydration || []).find(function (h) { return h.date === today; });
    const meals = (state.meals || []).filter(function (m) { return m.date === today; });

    /* 1. Hydration today */
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-title", text: "Hydration" }),
        hRow ? el("span", { class: "badge badge-accent" }, [UI.icon("check"), "Logged today"]) : null
      ]),
      el("div", { class: "card" }, [
        el("div", { class: "row-between mb-4" }, [
          el("div", {}, [
            el("div", { class: "metric-label", text: "Today" }),
            el("div", { class: "metric-small num", style: "font-weight:700", text: (hRow ? hRow.ml : 0) + " ml" })
          ]),
          el("div", {}, [
            el("div", { class: "metric-label", text: "Weekly avg" }),
            el("div", { class: "metric-small num", style: "font-weight:650", text: avgHydration(state).toFixed(0) + " ml/day" })
          ])
        ]),
        el("div", { class: "chip-row" }, [
          ["100 ml", 100], ["250 ml", 250], ["500 ml", 500]
        ].map(function (pair) {
          return el("button", {
            class: "chip chip-static",
            text: pair[0],
            onclick: function () { Store.addHydration(pair[1]); UI.toast("+" + pair[1] + " ml water"); window.App.rerender(); }
          });
        })),
        el("div", { class: "row mt-4", style: "gap:8px" }, [
          el("input", {
            class: "input input-num fuel-hydration-input",
            type: "number",
            placeholder: "ml",
            min: 1,
            onkeydown: function (e) { if (e.key === "Enter") { quickHydration(state, e); } }
          }),
          el("button", {
            class: "btn btn-secondary",
            text: "Add",
            onclick: function () {
              const input = document.querySelector(".fuel-hydration-input");
              quickHydration(state, { target: { value: input && input.value } });
            }
          })
        ]),
        el("p", { class: "micro muted-2 mt-3", text: "This is a simple counter, not a measurement. No source is attached." })
      ])
    ]));

    /* 2. Meals today */
    screen.appendChild(el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("h2", { class: "section-title", text: "Meals" }),
        meals.length ? el("span", { class: "badge badge-accent" }, [UI.icon("check"), meals.length + " today"]) : null
      ]),
      el("div", { class: "card" }, [
        el("div", { class: "row-between mb-3" }, [
          el("div", {}, [
            el("div", { class: "metric-label", text: "Meals logged" }),
            el("div", { class: "metric-small num", style: "font-weight:700", text: String(meals.length) })
          ]),
          el("div", {}, [
            el("div", { class: "metric-label", text: "Estimated kcal" }),
            el("div", { class: "metric-small num", style: "font-weight:650", text: Domain.fmt(meals.reduce(function (a, m) { return a + (typeof m.calories === "number" ? m.calories : 0); }, 0)) })
          ])
        ]),
        meals.length ? el("p", { class: "micro muted-2", text: Domain.mealEstimateLabel(meals) }) : el("p", { class: "micro muted-2", text: "No meals logged \u2014 shown values are estimates only." }),
        el("div", { class: "stack mt-4", style: "border-top:1px solid var(--border);padding-top:var(--sp-4)" }, meals.map(function (m) {
          return el("div", { class: "panel-row panel-row-static" }, [
            el("div", {}, [
              el("div", { style: "font-weight:650", text: mealKind(m.kind) + (m.name ? " · " + m.name : "") }),
              el("div", { class: "micro muted-2 mt-2", text: mealStats(m) })
            ]),
            el("button", {
              class: "btn btn-ghost btn-sm",
              text: "Remove",
              onclick: function () { Store.deleteMeal(m.id); UI.toast("Meal removed."); window.App.rerender(); }
            })
          ]);
        })),
        el("button", {
          class: "btn btn-secondary btn-block mt-4",
          text: "Log a meal",
          onclick: function () { logMealSheet(state); }
        })
      ])
    ]));

    container.appendChild(screen);
  }

  const MEAL_KINDS = ["breakfast", "lunch", "dinner", "snack", "post-workout", "other"];

  function mealKind(k) {
    if (!k) return "Meal";
    return k.charAt(0).toUpperCase() + k.slice(1).replace("-", " ");
  }

  function mealStats(m) {
    const bits = [];
    if (typeof m.calories === "number" && m.calories > 0) bits.push(Domain.fmt(m.calories) + " kcal");
    if (typeof m.proteinG === "number" && m.proteinG > 0) bits.push(m.proteinG + "g protein");
    if (typeof m.carbsG === "number" && m.carbsG > 0) bits.push(m.carbsG + "g carbs");
    if (typeof m.fatG === "number" && m.fatG > 0) bits.push(m.fatG + "g fat");
    if (!bits.length) bits.push("no values entered");
    return bits.join(" · ");
  }

  function quickHydration(state, e) {
    const input = e && e.target ? e.target : document.querySelector(".fuel-hydration-input");
    if (!input) return;
    let ml = parseInt(input.value, 10);
    if (!ml || ml < 1) { UI.toast("Enter a positive number.", { error: true }); return; }
    Store.addHydration(ml);
    input.value = "";
    UI.toast("+" + ml + " ml water");
    window.App.rerender();
    setTimeout(function () {
      try {
        const inputs = document.querySelectorAll(".fuel-hydration-input");
        const focusIdx = Math.max(0, inputs.length - 1);
        const last = inputs[focusIdx];
        if (last) { last.focus(); last.select(); }
      } catch (e) {}
    }, 0);
  }

  function logMealSheet(state) {
    const body = [];
    body.push(el("label", { class: "field mb-4" }, [
      el("span", { class: "field-label", text: "Type" }),
      segmented(MEAL_KINDS, null, "meal type", function (v) {
        const sel = document.getElementById("meal-kind");
        if (sel) sel.value = v;
      }, function (v) { return mealKind(v); })
    ]));
    const kindSelect = el("select", { class: "input", id: "meal-kind" }, [
      el("option", { value: "" }, [el("span", { text: "Choose one" })]),
      MEAL_KINDS.map(function (k) { return el("option", { value: k }, [el("span", { text: mealKind(k) })]); })
    ]);
    body.push(el("label", { class: "field mb-4" }, [el("span", { class: "field-label", text: "Meal type" }), kindSelect]));

    body.push(el("label", { class: "field mb-4" }, [
      el("span", { class: "field-label", text: "Name (optional)" }),
      el("input", { class: "input", placeholder: "e.g. chicken & rice bowl" })
    ]));

    body.push(el("div", { class: "grid-2", style: "margin-bottom:var(--sp-4)" }, [
      el("label", { class: "field" }, [
        el("span", { class: "field-label", text: "kcal (estimate)" }),
        el("input", { class: "input input-num", type: "number", placeholder: "kcal", min: 0, id: "meal-kcal" })
      ]),
      el("label", { class: "field" }, [
        el("span", { class: "field-label", text: "Protein (g)" }),
        el("input", { class: "input input-num", type: "number", placeholder: "g", min: 0, id: "meal-protein" })
      ])
    ]));

    body.push(el("div", { class: "grid-2", style: "margin-bottom:var(--sp-4)" }, [
      el("label", { class: "field" }, [
        el("span", { class: "field-label", text: "Carbs (g)" }),
        el("input", { class: "input input-num", type: "number", placeholder: "g", min: 0, id: "meal-carbs" })
      ]),
      el("label", { class: "field" }, [
        el("span", { class: "field-label", text: "Fat (g)" }),
        el("input", { class: "input input-num", type: "number", placeholder: "g", min: 0, id: "meal-fat" })
      ])
    ]));

    body.push(el("label", { class: "field mb-4" }, [
      el("span", { class: "field-label", text: "Estimate quality" }),
      segmented(["rough", "fair", "educated"], "rough", "estimate quality", function (v) {
        const sel = document.getElementById("meal-confidence");
        if (sel) sel.value = v;
      }, function (v) { return v; })
    ]));

    body.push(el("button", {
      class: "btn btn-primary btn-lg btn-block mt-4",
      onclick: function () {
        const kind = document.getElementById("meal-kind").value;
        if (!kind) { UI.toast("Pick a meal type.", { error: true }); return; }
        const kcal = parseInt(document.getElementById("meal-kcal").value, 10);
        const protein = parseInt(document.getElementById("meal-protein").value, 10);
        const carbs = parseInt(document.getElementById("meal-carbs").value, 10);
        const fat = parseInt(document.getElementById("meal-fat").value, 10);
        const name = document.querySelector('input[placeholder="e.g. chicken & rice bowl"]').value.trim();
        const confidence = document.getElementById("meal-confidence").value;
        Store.logMeal({
          kind: kind,
          name: name,
          calories: kcal && kcal > 0 ? kcal : null,
          proteinG: protein && protein > 0 ? protein : null,
          carbsG: carbs && carbs > 0 ? carbs : null,
          fatG: fat && fat > 0 ? fat : null,
          confidence: confidence,
          time: new Date().toISOString()
        });
        UI.closeSheet();
        UI.toast("Meal logged — it's an estimate, not a measurement.");
        window.App.rerender();
      }
    }, [UI.icon("check"), "Log meal"]));

    UI.sheet("Log a meal", body);
  }

  function segmented(values, current, label, onPick, fmt) {
    const row = el("div", { class: "chip-row segmented" }, values.map(function (v, idx) {
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

  function avgHydration(state) {
    const hist = (state.hydration || []).slice(-14);
    if (!hist.length) return 0;
    return hist.reduce(function (a, h) { return a + h.ml; }, 0) / hist.length;
  }

  window.FuelScreen = { render: render };
})();
