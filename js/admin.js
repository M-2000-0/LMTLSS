/* LMTLSS admin — Pricing & Plans (LOCAL PROTOTYPE).

   Honest-status rules for this screen:
   - No payment processing is integrated. Nothing here charges anyone.
   - Data lives in this browser only (localStorage key below), separate from
     the athlete's `lmtlss:v1` data.
   - Entitlement enforcement here is a SIMULATION of the server-side rules
     the production backend must apply. In production the client never
     decides access; the server resolves entitlements from its own database.

   Every mutation goes through js/pricing.js mutators, which append audit
   entries (who/what/when/before/after). */

(function () {
  "use strict";

  const el = UI.el;
  const STORAGE_KEY = "lmtlss:pricing:v1";
  const ACTOR = "local-admin"; // production: authenticated admin identity

  let catalog = null;

  /* ---------- Persistence (prototype only) ---------- */

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        catalog = Pricing.seedCatalog();
        Pricing.audit(catalog, ACTOR, "catalog.seeded", "catalog", "pricing", null, "prototype seed");
        save();
        return;
      }
      catalog = JSON.parse(raw);
    } catch (e) {
      console.error("LMTLSS admin: failed to load pricing catalog", e);
      catalog = Pricing.seedCatalog();
      UI.toast("Pricing data was unreadable — a fresh prototype catalog was created.", { error: true });
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
    } catch (e) {
      console.error("LMTLSS admin: failed to persist pricing catalog", e);
      UI.toast("Couldn't save pricing data locally.", { error: true });
    }
  }

  /* Run a mutator, persist, re-render, surface validation errors. */
  function commit(fn) {
    const result = fn();
    if (result && result.errors && result.errors.length) {
      UI.toast(result.errors.join("; "), { error: true });
      return false;
    }
    save();
    render();
    return true;
  }

  /* ---------- Helpers ---------- */

  function planName(planId) {
    const p = (catalog.plans || []).find(function (x) { return x.id === planId; });
    return p ? p.name : "—";
  }

  function statusBadge(status) {
    const cls = status === "published" || status === "active" ? " badge-accent" : "";
    return el("span", { class: "badge" + cls, text: String(status || "—").toUpperCase() });
  }

  function money(amountMinor, currency) {
    return amountMinor === null || amountMinor === undefined ? "—" : Pricing.formatMinor(amountMinor, currency);
  }

  function fmtTime(ms) {
    return ms ? new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  }

  function textInput(value, label, attrs) {
    const a = Object.assign({
      class: "input",
      "aria-label": label,
      value: value === null || value === undefined ? "" : String(value)
    }, attrs || {});
    return el("input", a);
  }

  /* ---------- Sections ---------- */

  function billingNotice() {
    return el("div", { class: "insight-line mb-6" }, [
      el("span", { class: "il-icon" }, [UI.icon("info")]),
      el("div", {}, [
        el("p", { class: "il-text" }, [
          el("strong", { text: "Local prototype — no billing is connected. " }),
          "Prices, offers, and subscriptions below are records in this browser. No payment processor, app-store billing, or webhook is integrated. In production, entitlements and billing status are resolved server-side; this screen demonstrates the resolution logic (",
          el("code", { text: "js/pricing.js" }),
          " that the backend will run."
        ])
      ])
    ]);
  }

  function plansSection() {
    const body = el("div", { class: "panel" });
    (catalog.plans || []).forEach(function (p) {
      const prices = (catalog.priceBook || []).filter(function (r) { return r.planId === p.id; });
      body.appendChild(el("div", { class: "panel-row panel-row-static" }, [
        el("div", {}, [
          el("div", { style: "font-weight:650", text: p.name }),
          el("div", { class: "micro muted-2 mt-2", text: UI.plural(Object.keys(p.features || {}).length, "feature") + " · " +
            (prices.length ? prices.map(function (r) { return money(r.amountMinor, r.currency) + "/" + r.interval + " (" + r.region + ")"; }).join(" · ") : "no prices") })
        ]),
        el("div", { class: "row", style: "gap:8px" }, [
          statusBadge(p.status),
          el("button", { class: "btn btn-ghost btn-sm", text: "Edit", onclick: function () { editPlan(p); } }),
          el("button", {
            class: "btn btn-ghost btn-sm",
            text: p.status === "published" ? "Archive" : "Publish",
            onclick: function () {
              commit(function () { return Pricing.setPlanStatus(catalog, ACTOR, p.id, p.status === "published" ? "archived" : "published"); });
              UI.toast("Plan " + (p.status === "published" ? "archived" : "published") + ".");
            }
          })
        ])
      ]));
    });
    return section("Plans", "Reusable product tiers with explicit feature entitlements", body, [
      el("button", { class: "btn btn-secondary btn-sm", text: "New plan", onclick: newPlan })
    ]);
  }

  function priceBookSection() {
    const body = el("div", { class: "panel" });
    (catalog.priceBook || []).forEach(function (r) {
      body.appendChild(el("div", { class: "panel-row panel-row-static" }, [
        el("div", {}, [
          el("div", { style: "font-weight:600", text: planName(r.planId) + " — " + money(r.amountMinor, r.currency) }),
          el("div", { class: "micro muted-2 mt-2", text: r.currency + " · " + r.interval + " · region " + r.region + " · integer minor units (" + r.amountMinor + ")" })
        ]),
        el("button", { class: "btn btn-ghost btn-sm", text: "Edit", onclick: function () { editPrice(r); } })
      ]));
    });
    if (!(catalog.priceBook || []).length) {
      body.appendChild(el("div", { class: "panel-row panel-row-static" }, [el("span", { class: "muted small", text: "No prices yet." })]));
    }
    return section("Price book", "Prices by plan, currency, region, and billing interval. Region-specific rows beat the default (ANY).", body, [
      el("button", { class: "btn btn-secondary btn-sm", text: "Add price", onclick: function () { editPrice(null); } })
    ]);
  }

  function offersSection() {
    const body = el("div", { class: "panel" });
    (catalog.offers || []).forEach(function (o) {
      const active = Pricing.isOfferActive(o, Date.now());
      body.appendChild(el("div", { class: "panel-row panel-row-static" }, [
        el("div", {}, [
          el("div", { style: "font-weight:600", text: o.subjectType + " “" + o.subjectId + "” → " + planName(o.planId) }),
          el("div", { class: "micro muted-2 mt-2", text: (o.price ? money(o.price.amountMinor, o.price.currency) + "/" + (o.price.interval || "monthly") + " (negotiated)"
            : "book price") + " · " + o.billingModel + " · valid " + fmtTime(o.validFrom) + " → " + (o.validUntil ? fmtTime(o.validUntil) : "no end") })
        ]),
        el("div", { class: "row", style: "gap:8px" }, [
          statusBadge(active ? "active" : o.status),
          o.status === "active" ? el("button", {
            class: "btn btn-ghost btn-sm", text: "Revoke",
            onclick: function () {
              UI.confirmSheet("Revoke offer?", "The subject falls back to standard/regional pricing at their next resolution.", "Revoke", function () {
                commit(function () { return Pricing.revokeOffer(catalog, ACTOR, o.id); });
              }, true);
            }
          }) : null
        ])
      ]));
    });
    if (!(catalog.offers || []).length) {
      body.appendChild(el("div", { class: "panel-row panel-row-static" }, [el("span", { class: "muted small", text: "No custom offers. Standard pricing applies to everyone." })]));
    }
    return section("Custom offers", "Negotiated terms for a specific user, club, or organization. Offers take precedence over the price book and are not stacked with coupons.", body, [
      el("button", { class: "btn btn-secondary btn-sm", text: "New offer", onclick: newOffer })
    ]);
  }

  function discountsSection() {
    const body = el("div", { class: "panel" });
    (catalog.discounts || []).forEach(function (d) {
      body.appendChild(el("div", { class: "panel-row panel-row-static" }, [
        el("div", {}, [
          el("div", { style: "font-weight:600", text: d.code }),
          el("div", { class: "micro muted-2 mt-2", text: d.type === "percent" ? (d.bps / 100) + "% off" : money(d.amountMinor, d.currency) + " off" +
            (d.currency ? "" : "") + (d.expiresAt ? " · expires " + fmtTime(d.expiresAt) : " · no expiry") })
        ]),
        el("button", {
          class: "btn btn-ghost btn-sm", text: "Remove",
          onclick: function () {
            UI.confirmSheet("Remove coupon?", "Codes already redeemed are not retroactively changed.", "Remove", function () {
              commit(function () { return Pricing.removeDiscount(catalog, ACTOR, d.id); });
            }, true);
          }
        })
      ]));
    });
    if (!(catalog.discounts || []).length) {
      body.appendChild(el("div", { class: "panel-row panel-row-static" }, [el("span", { class: "muted small", text: "No coupons." })]));
    }
    return section("Discounts", "Coupons and promotional campaigns. Apply to price-book prices only — never to negotiated offers.", body, [
      el("button", { class: "btn btn-secondary btn-sm", text: "New coupon", onclick: newDiscount })
    ]);
  }

  function subscriptionsSection() {
    const body = el("div", { class: "panel" });
    (catalog.subscriptions || []).forEach(function (s) {
      body.appendChild(el("div", { class: "panel-row panel-row-static" }, [
        el("div", {}, [
          el("div", { style: "font-weight:600", text: s.subjectType + " “" + s.subjectId + "” — " + planName(s.planId) }),
          el("div", { class: "micro muted-2 mt-2", text: "period ends " + fmtTime(s.currentPeriodEnd) + (s.priceSnapshot ? " · pays " + money(s.priceSnapshot.amountMinor, s.priceSnapshot.currency) + " (provider record)" : "") })
        ]),
        el("div", { class: "row", style: "gap:8px" }, [
          statusBadge(s.status),
          el("button", { class: "btn btn-ghost btn-sm", text: "Manage", onclick: function () { manageSubscription(s); } })
        ])
      ]));
    });
    if (!(catalog.subscriptions || []).length) {
      body.appendChild(el("div", { class: "panel-row panel-row-static" }, [el("span", { class: "muted small", text: "No subscriptions yet." })]));
    }
    return section("Subscriptions", "Simulated commercial agreements. Status changes here model provider webhooks (payment failed, canceled, renewed).", body);
  }

  function simulatorSection() {
    const subjectInput = textInput("club_rivercity", "Subject id for simulation", { style: "max-width:220px" });
    const currencySel = (function () {
      const s = el("select", { class: "input", "aria-label": "Currency" }, ["USD", "EUR", "GBP"].map(function (c) {
        return el("option", { value: c, text: c });
      }));
      return s;
    })();
    const regionInput = textInput("EU", "Region code", { style: "max-width:90px" });
    const codeInput = textInput("", "Discount code", { style: "max-width:140px" });
    const membersInput = textInput("30", "Member count", { style: "max-width:90px", type: "number", min: "0" });
    const out = el("div", { class: "mt-4" });

    function run() {
      UI.clear(out);
      const subject = subjectInput.value.trim();
      if (!subject) { out.appendChild(el("p", { class: "small muted", text: "Enter a subject id." })); return; }
      const now = Date.now();
      const subs = (catalog.subscriptions || []).filter(function (s) { return s.subjectId === subject; });
      if (!subs.length) {
        out.appendChild(el("p", { class: "small muted", text: "No subscription for “" + subject + "”. Subscribe one above to simulate." }));
      }
      subs.forEach(function (s) {
        const ent = Pricing.resolveEntitlements(catalog, { subjectId: subject, nowMs: now });
        const price = Pricing.resolvePrice(catalog, {
          planId: s.planId,
          subjectId: subject,
          currency: currencySel.value,
          region: regionInput.value.trim() || "ANY",
          interval: "monthly",
          discountCode: codeInput.value.trim() || null,
          memberCount: parseInt(membersInput.value, 10) || 0,
          nowMs: now
        });
        out.appendChild(el("div", { class: "card mb-3" }, [
          el("div", { class: "eyebrow mb-2", text: planName(s.planId) + " · resolved for “" + subject + "”" }),
          el("div", { class: "small", text: "Price: " + money(price.amountMinor, price.currency) + "/" + price.interval + "  (source: " + price.source + ")" }),
          el("ul", { class: "small muted", style: "margin:8px 0 0;padding-left:18px" }, price.trace.map(function (t) { return el("li", { text: t }); })),
          el("div", { class: "small mt-3", text: "Entitlements (status: " + ent.status + "):" }),
          Object.keys(ent.features).length
            ? el("ul", { class: "small muted", style: "margin:4px 0 0;padding-left:18px" }, Object.keys(ent.features).map(function (k) {
                return el("li", { text: (FEATURE_NAME(k) || k) + " — " + (ent.features[k].limit === null ? "unlimited" : "limit " + ent.features[k].limit) + " [" + ent.features[k].source + "]" });
              }))
            : el("p", { class: "small muted", text: " none — no paid features at this status" })
        ]));
      });
    }

    function FEATURE_NAME(k) {
      const f = Pricing.FEATURES.find(function (x) { return x.key === k; });
      return f ? f.name : k;
    }

    const controls = el("div", { class: "row", style: "gap:8px;flex-wrap:wrap" }, [
      subjectInput, currencySel, regionInput, membersInput, codeInput,
      el("button", { class: "btn btn-secondary btn-sm", text: "Resolve", onclick: run })
    ]);

    return section("Entitlement simulator", "Demonstrates the deterministic server-side resolution: price precedence (offer → region → default → coupon) and entitlements resolved independently of price.", el("div", {}, [controls, out]));
  }

  function auditSection() {
    const rows = (catalog.audit || []).slice().reverse().slice(0, 25);
    const body = el("div", { class: "panel" });
    rows.forEach(function (a) {
      body.appendChild(el("div", { class: "panel-row panel-row-static" }, [
        el("div", {}, [
          el("div", { style: "font-weight:600", text: a.action + " · " + a.entityType }),
          el("div", { class: "micro muted-2 mt-2", text: fmtTime(a.atMs) + " · by " + a.actor + " · " + a.entityId })
        ]),
        el("button", {
          class: "btn btn-ghost btn-sm", text: "Detail",
          onclick: function () {
            UI.sheet("Audit entry", [
              el("pre", { class: "small", style: "white-space:pre-wrap;word-break:break-word", text:
                "action: " + a.action + "\nentity: " + a.entityType + " " + a.entityId + "\nactor: " + a.actor +
                "\nat: " + new Date(a.atMs).toISOString() + "\n\nbefore: " + JSON.stringify(a.before, null, 2) +
                "\n\nafter: " + JSON.stringify(a.after, null, 2) })
            ]);
          }
        })
      ]));
    });
    if (!rows.length) body.appendChild(el("div", { class: "panel-row panel-row-static" }, [el("span", { class: "muted small", text: "No changes recorded yet." })]));
    return section("Audit history", "Every price, plan, offer, discount, and subscription change — who, what, when, before/after. Last 25 shown.", body, [
      el("button", {
        class: "btn btn-ghost btn-sm", text: "Export JSON",
        onclick: function () { downloadJSON(); }
      })
    ]);
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lmtlss-pricing-prototype.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function section(title, sub, body, actions) {
    return el("div", { class: "section" }, [
      el("div", { class: "section-head" }, [
        el("div", {}, [el("h2", { class: "section-title", text: title }), sub ? el("p", { class: "screen-sub", text: sub }) : null]),
        actions ? el("div", { class: "row", style: "gap:8px" }, actions) : null
      ]),
      body
    ]);
  }

  /* ---------- Forms (sheets) ---------- */

  function newPlan() {
    const name = textInput("", "Plan name");
    const featureRows = Pricing.FEATURES.map(function (f) {
      const enabled = el("input", { type: "checkbox", "aria-label": "Enable " + f.name });
      const limit = textInput("", "Limit for " + f.name, { type: "number", min: "0", placeholder: "unlimited", style: "max-width:110px" });
      return { f: f, enabled: enabled, limit: limit };
    });
    UI.sheet("New plan", [
      el("label", { class: "field mb-4" }, [el("span", { class: "field-label", text: "Name" }), name]),
      el("div", { class: "eyebrow mb-2", text: "Features (entitlements)" }),
      el("div", { class: "panel mb-4" }, featureRows.map(function (r) {
        return el("div", { class: "panel-row panel-row-static" }, [
          el("label", { class: "row", style: "gap:8px" }, [r.enabled, el("span", { text: r.f.name })]),
          r.f.limitType === "quota" ? r.limit : el("span", { class: "micro muted-2", text: "unlimited when enabled" })
        ]);
      })),
      el("button", {
        class: "btn btn-primary btn-block",
        onclick: function () {
          const features = {};
          featureRows.forEach(function (r) {
            if (r.enabled.checked) {
              const v = r.f.limitType === "quota" ? parseInt(r.limit.value, 10) : NaN;
              features[r.f.key] = { enabled: true, limit: isNaN(v) ? null : v };
            }
          });
          let created = null;
          const ok = commit(function () {
            const res = Pricing.createPlan(catalog, ACTOR, { name: name.value.trim(), features: features });
            created = res.plan;
            return res;
          });
          if (ok && created) {
            UI.closeSheet();
            UI.toast("Plan created as draft — publish it to make it eligible.");
          }
        }
      }, ["Create plan"])
    ]);
  }

  function editPlan(plan) {
    const rows = Pricing.FEATURES.map(function (f) {
      const current = (plan.features || {})[f.key];
      const enabled = el("input", { type: "checkbox", "aria-label": "Enable " + f.name });
      enabled.checked = !!(current && current.enabled);
      const limit = textInput(current && current.limit !== null ? current.limit : "", "Limit", { type: "number", min: "0", placeholder: "unlimited", style: "max-width:110px" });
      return { f: f, enabled: enabled, limit: limit };
    });
    UI.sheet("Edit " + plan.name, [
      el("div", { class: "panel mb-4" }, rows.map(function (r) {
        return el("div", { class: "panel-row panel-row-static" }, [
          el("label", { class: "row", style: "gap:8px" }, [r.enabled, el("span", { text: r.f.name })]),
          r.f.limitType === "quota" ? r.limit : el("span", { class: "micro muted-2", text: "unlimited when enabled" })
        ]);
      })),
      el("button", {
        class: "btn btn-primary btn-block",
        onclick: function () {
          const features = {};
          rows.forEach(function (r) {
            if (r.enabled.checked) {
              const v = r.f.limitType === "quota" ? parseInt(r.limit.value, 10) : NaN;
              features[r.f.key] = { enabled: true, limit: isNaN(v) ? null : v };
            }
          });
          if (commit(function () { return Pricing.updatePlanFeatures(catalog, ACTOR, plan.id, features); })) {
            UI.closeSheet();
            UI.toast("Plan features updated.");
          }
        }
      }, ["Save features"])
    ]);
  }

  function editPrice(existing) {
    const planSel = el("select", { class: "input", "aria-label": "Plan" }, catalog.plans.map(function (p) {
      const o = el("option", { value: p.id, text: p.name });
      if (existing && existing.planId === p.id) o.selected = true;
      return o;
    }));
    const currency = textInput(existing ? existing.currency : "USD", "Currency", { style: "max-width:90px" });
    const region = textInput(existing ? existing.region : "ANY", "Region", { style: "max-width:90px" });
    const interval = el("select", { class: "input", "aria-label": "Interval" }, Pricing.INTERVALS.map(function (i) {
      const o = el("option", { value: i, text: i });
      if (existing && existing.interval === i) o.selected = true;
      return o;
    }));
    const amount = textInput(existing ? (existing.amountMinor / 100).toFixed(2) : "", "Amount", { style: "max-width:120px", inputmode: "decimal", placeholder: "12.99" });
    UI.sheet(existing ? "Edit price" : "Add price", [
      el("label", { class: "field mb-3" }, [el("span", { class: "field-label", text: "Plan" }), planSel]),
      el("div", { class: "row mb-3", style: "gap:8px" }, [currency, region, interval]),
      el("label", { class: "field mb-4" }, [el("span", { class: "field-label", text: "Amount (major units, e.g. 12.99 — stored as integer cents)" }), amount]),
      el("button", {
        class: "btn btn-primary btn-block",
        onclick: function () {
          const cur = currency.value.trim().toUpperCase();
          const minor = Pricing.toMinor(amount.value.trim(), cur);
          if (minor === null) { UI.toast("Enter a valid amount, e.g. 12.99", { error: true }); return; }
          const row = {
            planId: planSel.value, currency: cur,
            region: region.value.trim().toUpperCase() || "ANY",
            interval: interval.value, amountMinor: minor
          };
          if (commit(function () { return Pricing.upsertPrice(catalog, ACTOR, row); })) {
            UI.closeSheet();
            UI.toast("Price saved (" + minor + " minor units " + cur + ").");
          }
        }
      }, [existing ? "Save price" : "Add price"])
    ]);
  }

  function newOffer() {
    if (!catalog.plans.length) { UI.toast("Create a plan first.", { error: true }); return; }
    const subjectType = el("select", { class: "input", "aria-label": "Subject type" }, Pricing.SUBJECT_TYPES.map(function (t) {
      return el("option", { value: t, text: t });
    }));
    const subjectId = textInput("", "Subject id", { placeholder: "e.g. club_rivercity" });
    const planSel = el("select", { class: "input", "aria-label": "Plan" }, catalog.plans.map(function (p) {
      return el("option", { value: p.id, text: p.name });
    }));
    const model = el("select", { class: "input", "aria-label": "Billing model" }, [
      el("option", { value: "flat", text: "flat fee" }),
      el("option", { value: "per-member", text: "per-member" })
    ]);
    const currency = textInput("USD", "Currency", { style: "max-width:90px" });
    const amount = textInput("", "Negotiated amount", { style: "max-width:120px", inputmode: "decimal", placeholder: "999.00" });
    const months = textInput("12", "Valid for months", { type: "number", min: "1", style: "max-width:110px" });
    const note = textInput("", "Contract note", { placeholder: "e.g. annual contract, negotiated 2026-10" });

    UI.sheet("New custom offer", [
      el("div", { class: "row mb-3", style: "gap:8px" }, [subjectType, subjectId]),
      el("label", { class: "field mb-3" }, [el("span", { class: "field-label", text: "Plan" }), planSel]),
      el("label", { class: "field mb-3" }, [el("span", { class: "field-label", text: "Billing model" }), model]),
      el("div", { class: "row mb-3", style: "gap:8px" }, [currency, amount]),
      el("label", { class: "field mb-4" }, [el("span", { class: "field-label", text: "Valid for (months)" }), months]),
      el("label", { class: "field mb-4" }, [el("span", { class: "field-label", text: "Note" }), note]),
      el("p", { class: "micro muted-2 mb-4", text: "Negotiated price is net — coupons will not stack on it. Grandfathering: the price book can change without affecting this offer." }),
      el("button", {
        class: "btn btn-primary btn-block",
        onclick: function () {
          const cur = currency.value.trim().toUpperCase();
          const minor = amount.value.trim() === "" ? null : Pricing.toMinor(amount.value.trim(), cur);
          if (amount.value.trim() !== "" && minor === null) { UI.toast("Enter a valid amount, e.g. 999.00", { error: true }); return; }
          const now = Date.now();
          const res = Pricing.createOffer(catalog, ACTOR, {
            subjectType: subjectType.value,
            subjectId: subjectId.value.trim(),
            planId: planSel.value,
            billingModel: model.value,
            price: minor === null ? null : { currency: cur, amountMinor: minor, interval: "annual" },
            validFrom: now,
            validUntil: now + (parseInt(months.value, 10) || 12) * 30 * 86400000,
            note: note.value.trim()
          });
          if (res.errors && res.errors.length) { UI.toast(res.errors.join("; "), { error: true }); return; }
          save(); render(); UI.closeSheet();
          UI.toast("Offer created. It now takes precedence over the price book for this subject.");
        }
      }, ["Create offer"])
    ]);
  }

  function newDiscount() {
    const code = textInput("", "Code", { placeholder: "SUMMER26" });
    const type = el("select", { class: "input", "aria-label": "Type" }, [
      el("option", { value: "percent", text: "percent off" }),
      el("option", { value: "fixed", text: "fixed amount off" })
    ]);
    const value = textInput("", "Value (percent or amount)", { style: "max-width:140px", inputmode: "decimal", placeholder: "20" });
    const currency = textInput("USD", "Currency (fixed only)", { style: "max-width:130px" });
    const days = textInput("", "Expires in days (blank = never)", { type: "number", min: "1", style: "max-width:150px" });
    UI.sheet("New coupon", [
      el("label", { class: "field mb-3" }, [el("span", { class: "field-label", text: "Code" }), code]),
      el("label", { class: "field mb-3" }, [el("span", { class: "field-label", text: "Type" }), type]),
      el("label", { class: "field mb-3" }, [el("span", { class: "field-label", text: "Value" }), value]),
      el("label", { class: "field mb-3" }, [el("span", { class: "field-label", text: "Currency" }), currency]),
      el("label", { class: "field mb-4" }, [el("span", { class: "field-label", text: "Expires" }), days]),
      el("button", {
        class: "btn btn-primary btn-block",
        onclick: function () {
          const v = parseFloat(value.value);
          const input = {
            code: code.value.trim(),
            type: type.value,
            expiresAt: days.value.trim() ? Date.now() + (parseInt(days.value, 10) * 86400000) : null
          };
          if (type.value === "percent") input.bps = Math.round(v * 100);
          else { input.amountMinor = Pricing.toMinor(value.value.trim() || "0", currency.value.trim().toUpperCase()); input.currency = currency.value.trim().toUpperCase(); }
          if (commit(function () { return Pricing.createDiscount(catalog, ACTOR, input); })) {
            UI.closeSheet();
            UI.toast("Coupon created.");
          }
        }
      }, ["Create coupon"])
    ]);
  }

  function manageSubscription(sub) {
    const statusSel = el("select", { class: "input", "aria-label": "Status" }, Pricing.SUBSCRIPTION_STATUSES.map(function (st) {
      const o = el("option", { value: st, text: st });
      if (sub.status === st) o.selected = true;
      return o;
    }));
    const planSel = el("select", { class: "input", "aria-label": "Plan" }, catalog.plans.map(function (p) {
      const o = el("option", { value: p.id, text: p.name });
      if (sub.planId === p.id) o.selected = true;
      return o;
    }));
    UI.sheet("Manage subscription", [
      el("p", { class: "small muted mb-4", text: "Status models provider events: past_due = failed payment (features drop), canceled = access until period end." }),
      el("label", { class: "field mb-3" }, [el("span", { class: "field-label", text: "Status" }), statusSel]),
      el("label", { class: "field mb-4" }, [el("span", { class: "field-label", text: "Plan" }), planSel]),
      el("button", {
        class: "btn btn-primary btn-block",
        onclick: function () {
          if (statusSel.value !== sub.status) {
            const r = Pricing.setSubscriptionStatus(catalog, ACTOR, sub.id, statusSel.value);
            if (r.errors.length) { UI.toast(r.errors.join("; "), { error: true }); return; }
          }
          if (planSel.value !== sub.planId) {
            const r = Pricing.changeSubscriptionPlan(catalog, ACTOR, sub.id, planSel.value);
            if (r.errors.length) { UI.toast(r.errors.join("; "), { error: true }); return; }
          }
          save(); render(); UI.closeSheet();
          UI.toast("Subscription updated.");
        }
      }, ["Save"])
    ]);
  }

  /* ---------- Render ---------- */

  function render() {
    const main = document.getElementById("main");
    UI.clear(main);
    const screen = el("div", { class: "screen" });
    screen.appendChild(el("div", { class: "screen-head" }, [
      el("div", {}, [
        el("h1", { class: "screen-title", text: "Pricing & Plans" }),
        el("p", { class: "screen-sub", text: "Admin prototype · local data · no payment processing" })
      ]),
      el("div", { class: "row", style: "gap:8px" }, [
        el("button", { class: "btn btn-ghost btn-sm", text: "← App", onclick: function () { window.location.href = "index.html"; } }),
        el("button", {
          class: "btn btn-ghost btn-sm", text: "Reset prototype data",
          onclick: function () {
            UI.confirmSheet("Reset pricing prototype?", "Deletes all local pricing data (plans, offers, subscriptions, audit) and re-seeds the prototype catalog. Athlete data is untouched.", "Reset", function () {
              catalog = Pricing.seedCatalog();
              Pricing.audit(catalog, ACTOR, "catalog.seeded", "catalog", "pricing", null, "reset to prototype seed");
              save(); render();
              UI.toast("Prototype pricing data reset.");
            }, true);
          }
        })
      ])
    ]));
    screen.appendChild(billingNotice());
    screen.appendChild(plansSection());
    screen.appendChild(priceBookSection());
    screen.appendChild(offersSection());
    screen.appendChild(discountsSection());
    screen.appendChild(subscriptionsSection());
    screen.appendChild(simulatorSection());
    screen.appendChild(auditSection());
    main.appendChild(screen);
  }

  load();
  render();
  window.LmtlssAdmin = { getCatalog: function () { return catalog; } };
})();
