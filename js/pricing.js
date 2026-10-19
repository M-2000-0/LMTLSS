/* LMTLSS pricing engine — plans, price book, custom offers, discounts,
   subscriptions, entitlements, audit trail.

   PURE module (no DOM, no localStorage) — same portability rule as domain.js.
   This engine is the reference implementation for the future server-side
   pricing service: resolve* functions must run unchanged (or be ported 1:1)
   on the backend, where entitlements are actually enforced.

   Core invariants:
   - All money is integer minor units + explicit ISO currency. Never floats.
   - PRICE NEVER DETERMINES PERMISSIONS. Entitlements are resolved only from
     subscription/offer/plan relationships. `resolveEntitlements` must not
     read any price field.
   - Price precedence is deterministic:
       1. active custom offer for the subject (grandfathered, net price,
          discounts do NOT stack on negotiated offers)
       2. regional price-book row (specific region beats "ANY")
       3. plan default price-book row (region "ANY")
     then an explicit coupon may reduce 2/3 (never 1).
   - Every catalog mutation records an audit entry (who/what/when/before/after). */

(function () {
  "use strict";

  /* ---------- Feature catalog (capability ids, not prices) ---------- */

  const FEATURES = [
    { key: "ai_coach", name: "AI coaching", limitType: "quota", unit: "messages/mo" },
    { key: "advanced_analytics", name: "Advanced analytics", limitType: "boolean", unit: null },
    { key: "gps_recording", name: "GPS recording", limitType: "boolean", unit: null },
    { key: "share_studio", name: "Share Studio exports", limitType: "quota", unit: "exports/mo" },
    { key: "club_tools", name: "Club tools", limitType: "quota", unit: "members" },
    { key: "org_dashboard", name: "Organization dashboard", limitType: "boolean", unit: null }
  ];

  const FEATURE_BY_KEY = {};
  FEATURES.forEach(function (f) { FEATURE_BY_KEY[f.key] = f; });

  const INTERVALS = ["monthly", "annual", "once"];
  const SUBJECT_TYPES = ["user", "club", "org"];
  const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled", "expired"];

  /* Access policy per subscription status. "canceled" keeps access until the
     period ends (checked against currentPeriodEnd). */
  const STATUS_POLICY = {
    trialing: "full",
    active: "full",
    past_due: "limited",   // payment required — no paid features
    canceled: "until-period-end",
    expired: "none"
  };

  const ZERO_DECIMAL = { JPY: 1, KRW: 1, VND: 1 }; // currencies without minor units

  function minorDigits(currency) {
    return ZERO_DECIMAL[currency] ? 0 : 2;
  }

  /* Decimal string/number -> integer minor units (deterministic, no floats kept). */
  function toMinor(amount, currency) {
    const digits = minorDigits(currency);
    const str = String(amount).trim();
    if (!/^\d+(\.\d+)?$/.test(str)) return null;
    const parts = str.split(".");
    const whole = parseInt(parts[0], 10);
    const frac = parts[1] || "";
    if (digits === 0) return whole;
    const fracPadded = (frac + "00").slice(0, 2);
    return whole * 100 + parseInt(fracPadded, 10);
  }

  /* Integer minor units -> display string. No Intl (locale-deterministic). */
  function formatMinor(amountMinor, currency) {
    if (amountMinor === null || amountMinor === undefined || isNaN(amountMinor)) return "—";
    const digits = minorDigits(currency);
    const sign = amountMinor < 0 ? "-" : "";
    const abs = Math.abs(amountMinor);
    if (digits === 0) return sign + abs + " " + currency;
    const whole = Math.floor(abs / 100);
    const frac = String(abs % 100).padStart(2, "0");
    const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
    if (symbol) return sign + symbol + whole + "." + frac;
    return sign + whole + "." + frac + " " + currency;
  }

  /* ---------- Catalog ---------- */

  function emptyCatalog() {
    return {
      version: 1,
      plans: [],
      priceBook: [],   // {planId, currency, region: "ANY"|code, interval, amountMinor}
      offers: [],
      discounts: [],   // {id, code, type: "percent"|"fixed", bps|amountMinor, currency?, expiresAt?, status}
      subscriptions: [],
      audit: []
    };
  }

  /* Prototype seed — clearly labeled demo configuration, replaceable in the
     admin UI. NOT real prices of anything. */
  function seedCatalog() {
    const c = emptyCatalog();
    c.plans = [
      {
        id: "plan_free", key: "free", name: "Free", status: "published",
        features: {
          gps_recording: { enabled: true, limit: null },
          share_studio: { enabled: true, limit: 3 }
        }
      },
      {
        id: "plan_premium", key: "premium", name: "Premium", status: "published",
        features: {
          gps_recording: { enabled: true, limit: null },
          advanced_analytics: { enabled: true, limit: null },
          share_studio: { enabled: true, limit: 50 },
          ai_coach: { enabled: true, limit: 200 }
        }
      },
      {
        id: "plan_club", key: "club", name: "Club", status: "published",
        features: {
          gps_recording: { enabled: true, limit: null },
          advanced_analytics: { enabled: true, limit: null },
          share_studio: { enabled: true, limit: 100 },
          club_tools: { enabled: true, limit: 150 }
        }
      }
    ];
    c.priceBook = [
      { planId: "plan_free", currency: "USD", region: "ANY", interval: "monthly", amountMinor: 0 },
      { planId: "plan_premium", currency: "USD", region: "ANY", interval: "monthly", amountMinor: 1299 },
      { planId: "plan_premium", currency: "USD", region: "ANY", interval: "annual", amountMinor: 11900 },
      { planId: "plan_premium", currency: "EUR", region: "ANY", interval: "monthly", amountMinor: 1199 },
      { planId: "plan_premium", currency: "EUR", region: "EU", interval: "monthly", amountMinor: 1099 },
      { planId: "plan_club", currency: "USD", region: "ANY", interval: "monthly", amountMinor: 49900 }
    ];
    c.discounts = [
      { id: "disc_launch", code: "LAUNCH20", type: "percent", bps: 2000, currency: null, expiresAt: null, status: "active" }
    ];
    c.subscriptions = [];
    c.offers = [];
    return c;
  }

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }

  /* ---------- Audit ---------- */

  function audit(catalog, actor, action, entityType, entityId, before, after) {
    const entry = {
      id: uid("aud"),
      atMs: Date.now(),
      actor: actor || "local-admin",
      action: action,
      entityType: entityType,
      entityId: entityId,
      before: before === undefined ? null : before,
      after: after === undefined ? null : after
    };
    catalog.audit.push(entry);
    return entry;
  }

  /* ---------- Validation (boundaries — the server will re-run these) ---------- */

  function validatePlan(plan) {
    const errors = [];
    if (!plan || !plan.name) errors.push("plan needs a name");
    if (plan && plan.features) {
      Object.keys(plan.features).forEach(function (k) {
        if (!FEATURE_BY_KEY[k]) errors.push("unknown feature: " + k);
        const limit = plan.features[k].limit;
        if (limit !== null && (typeof limit !== "number" || limit < 0)) errors.push("invalid limit for " + k);
      });
    }
    return errors;
  }

  function validatePriceRow(row) {
    const errors = [];
    if (!row) return ["missing row"];
    if (!row.planId) errors.push("price row needs planId");
    if (!/^[A-Z]{3}$/.test(row.currency || "")) errors.push("currency must be ISO-4217 (e.g. USD)");
    if (INTERVALS.indexOf(row.interval) < 0) errors.push("interval must be one of " + INTERVALS.join("/"));
    if (typeof row.amountMinor !== "number" || row.amountMinor < 0 || row.amountMinor % 1 !== 0) {
      errors.push("amountMinor must be a non-negative integer (minor units)");
    }
    return errors;
  }

  /* ---------- Catalog mutators (each records an audit entry) ---------- */

  function createPlan(catalog, actor, input) {
    const plan = {
      id: uid("plan"),
      key: (input.key || input.name || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      name: input.name,
      status: "draft",
      features: input.features || {}
    };
    const errors = validatePlan(plan);
    if (errors.length) return { errors: errors };
    catalog.plans.push(plan);
    audit(catalog, actor, "plan.created", "plan", plan.id, null, { name: plan.name, features: plan.features });
    return { plan: plan, errors: [] };
  }

  function setPlanStatus(catalog, actor, planId, status) {
    if (["draft", "published", "archived"].indexOf(status) < 0) return { errors: ["invalid status"] };
    const plan = catalog.plans.find(function (p) { return p.id === planId; });
    if (!plan) return { errors: ["plan not found"] };
    const before = plan.status;
    plan.status = status;
    audit(catalog, actor, "plan.status", "plan", planId, before, status);
    return { errors: [] };
  }

  function updatePlanFeatures(catalog, actor, planId, features) {
    const plan = catalog.plans.find(function (p) { return p.id === planId; });
    if (!plan) return { errors: ["plan not found"] };
    const errors = validatePlan({ name: plan.name, features: features });
    if (errors.length) return { errors: errors };
    const before = plan.features;
    plan.features = features;
    audit(catalog, actor, "plan.features", "plan", planId, before, features);
    return { errors: [] };
  }

  function upsertPrice(catalog, actor, row) {
    const errors = validatePriceRow(row);
    if (errors.length) return { errors: errors };
    const i = catalog.priceBook.findIndex(function (r) {
      return r.planId === row.planId && r.currency === row.currency &&
        r.region === row.region && r.interval === row.interval;
    });
    const before = i >= 0 ? catalog.priceBook[i] : null;
    if (i >= 0) catalog.priceBook[i] = row; else catalog.priceBook.push(row);
    audit(catalog, actor, i >= 0 ? "price.updated" : "price.created", "price",
      [row.planId, row.currency, row.region, row.interval].join("|"), before, row);
    return { errors: [] };
  }

  function createOffer(catalog, actor, input) {
    const errors = [];
    if (SUBJECT_TYPES.indexOf(input.subjectType) < 0) errors.push("subjectType must be " + SUBJECT_TYPES.join("/"));
    if (!input.subjectId) errors.push("offer needs a subjectId");
    if (!catalog.plans.some(function (p) { return p.id === input.planId; })) errors.push("unknown planId");
    if (input.billingModel !== "flat" && input.billingModel !== "per-member") errors.push("billingModel must be flat or per-member");
    if (!input.price && !input.featureOverrides) errors.push("offer needs a price override or feature overrides");
    if (input.price) {
      if (!/^[A-Z]{3}$/.test(input.price.currency || "")) errors.push("offer price currency must be ISO-4217");
      if (typeof input.price.amountMinor !== "number" || input.price.amountMinor < 0) errors.push("offer amountMinor must be a non-negative integer");
    }
    if (errors.length) return { errors: errors };
    const offer = {
      id: uid("off"),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      planId: input.planId,
      billingModel: input.billingModel,
      price: input.price || null,                       // null = book price, overrides still apply
      unitPrice: input.unitPrice || null,                // per-member unit amount
      volumeTiers: input.volumeTiers || null,            // [{upTo: n|null, unitAmountMinor}]
      featureOverrides: input.featureOverrides || null,
      validFrom: typeof input.validFrom === "number" ? input.validFrom : Date.now(),
      validUntil: typeof input.validUntil === "number" ? input.validUntil : null,
      status: "active",
      note: input.note || ""
    };
    catalog.offers.push(offer);
    audit(catalog, actor, "offer.created", "offer", offer.id, null, offer);
    return { offer: offer, errors: [] };
  }

  function revokeOffer(catalog, actor, offerId) {
    const offer = catalog.offers.find(function (o) { return o.id === offerId; });
    if (!offer) return { errors: ["offer not found"] };
    const before = offer.status;
    offer.status = "revoked";
    audit(catalog, actor, "offer.revoked", "offer", offerId, before, "revoked");
    return { errors: [] };
  }

  function createDiscount(catalog, actor, input) {
    const errors = [];
    if (!input.code) errors.push("discount needs a code");
    if (input.type === "percent") {
      if (typeof input.bps !== "number" || input.bps <= 0 || input.bps > 10000) errors.push("percent discounts need bps in 1..10000");
    } else if (input.type === "fixed") {
      if (typeof input.amountMinor !== "number" || input.amountMinor <= 0) errors.push("fixed discounts need amountMinor > 0");
      if (!/^[A-Z]{3}$/.test(input.currency || "")) errors.push("fixed discounts need a currency");
    } else {
      errors.push("type must be percent or fixed");
    }
    if (errors.length) return { errors: errors };
    const discount = {
      id: uid("disc"),
      code: input.code.toUpperCase(),
      type: input.type,
      bps: input.bps || null,
      amountMinor: input.amountMinor || null,
      currency: input.currency || null,
      expiresAt: input.expiresAt || null,
      status: "active"
    };
    catalog.discounts.push(discount);
    audit(catalog, actor, "discount.created", "discount", discount.id, null, discount);
    return { discount: discount, errors: [] };
  }

  function removeDiscount(catalog, actor, discountId) {
    const i = catalog.discounts.findIndex(function (d) { return d.id === discountId; });
    if (i < 0) return { errors: ["discount not found"] };
    const before = catalog.discounts[i];
    catalog.discounts.splice(i, 1);
    audit(catalog, actor, "discount.removed", "discount", discountId, before, null);
    return { errors: [] };
  }

  function subscribe(catalog, actor, input) {
    const errors = [];
    const plan = catalog.plans.find(function (p) { return p.id === input.planId; });
    if (!plan) errors.push("unknown planId");
    if (!input.subjectId) errors.push("subscription needs a subjectId");
    if (errors.length) return { errors: errors };
    const now = typeof input.nowMs === "number" ? input.nowMs : Date.now();
    const offer = input.offerId ? catalog.offers.find(function (o) { return o.id === input.offerId; }) : null;
    if (input.offerId && !offer) errors.push("unknown offerId");
    if (errors.length) return { errors: errors };
    const sub = {
      id: uid("sub"),
      subjectType: input.subjectType || "user",
      subjectId: input.subjectId,
      planId: input.planId,
      offerId: offer ? offer.id : null,
      status: offer ? "trialing" : "active",
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: now + (planIntervalMonths(catalog, input.planId, offer) * 30 * 86400000),
      canceledAt: null,
      /* Prototype only: the price the customer actually pays, snapshotted for
         display. In production this comes from the payment provider / store
         receipt — never from the client. */
      priceSnapshot: input.priceSnapshot || null
    };
    catalog.subscriptions.push(sub);
    audit(catalog, actor, "subscription.created", "subscription", sub.id, null, sub);
    return { subscription: sub, errors: [] };
  }

  function planIntervalMonths(catalog, planId, offer) {
    const interval = offer && offer.price && offer.price.interval ? offer.price.interval
      : (catalog.priceBook.find(function (r) { return r.planId === planId && r.currency === "USD"; }) || {}).interval;
    return interval === "annual" ? 12 : 1;
  }

  function setSubscriptionStatus(catalog, actor, subId, status) {
    if (SUBSCRIPTION_STATUSES.indexOf(status) < 0) return { errors: ["invalid status"] };
    const sub = catalog.subscriptions.find(function (s) { return s.id === subId; });
    if (!sub) return { errors: ["subscription not found"] };
    const before = sub.status;
    sub.status = status;
    if (status === "canceled") sub.canceledAt = Date.now();
    audit(catalog, actor, "subscription.status", "subscription", subId, before, status);
    return { errors: [] };
  }

  function changeSubscriptionPlan(catalog, actor, subId, planId) {
    const sub = catalog.subscriptions.find(function (s) { return s.id === subId; });
    if (!sub) return { errors: ["subscription not found"] };
    const plan = catalog.plans.find(function (p) { return p.id === planId; });
    if (!plan) return { errors: ["unknown planId"] };
    const before = sub.planId;
    sub.planId = planId;
    audit(catalog, actor, "subscription.plan", "subscription", subId, before, planId);
    return { errors: [] };
  }

  /* ---------- Offers ---------- */

  function isOfferActive(offer, nowMs) {
    if (offer.status !== "active") return false;
    if (offer.validFrom && nowMs < offer.validFrom) return false;
    if (offer.validUntil && nowMs > offer.validUntil) return false;
    return true;
  }

  function activeOfferFor(catalog, subjectId, nowMs) {
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    return catalog.offers.find(function (o) {
      return o.subjectId === subjectId && isOfferActive(o, now);
    }) || null;
  }

  /* Per-member amount with optional volume tiers (piecewise bands). */
  function memberAmount(unitPriceMinor, tiers, memberCount) {
    const n = Math.max(0, Math.floor(memberCount || 0));
    if (!tiers || !tiers.length) return unitPriceMinor * n;
    const sorted = tiers.slice().sort(function (a, b) {
      const au = a.upTo === null || a.upTo === undefined ? Infinity : a.upTo;
      const bu = b.upTo === null || b.upTo === undefined ? Infinity : b.upTo;
      return au - bu;
    });
    let total = 0, prev = 0;
    for (let i = 0; i < sorted.length; i++) {
      const cap = sorted[i].upTo === null || sorted[i].upTo === undefined ? Infinity : sorted[i].upTo;
      const band = Math.max(0, Math.min(n, cap) - prev);
      total += band * sorted[i].unitAmountMinor;
      prev = cap;
      if (prev >= n) break;
    }
    return total;
  }

  /* ---------- Price resolution (deterministic precedence) ---------- */

  /* Returns { amountMinor, currency, interval, source, trace, offerId, discountId }
     source: "custom-offer" | "regional" | "plan-default" | "discounted"
     Discounts never stack on custom offers (negotiated price is net). */
  function resolvePrice(catalog, ctx) {
    const now = typeof ctx.nowMs === "number" ? ctx.nowMs : Date.now();
    const currency = ctx.currency || "USD";
    const interval = ctx.interval || "monthly";
    const region = ctx.region || "ANY";
    const trace = [];

    // 1. Active custom offer for the subject, matching plan
    const offer = ctx.subjectId ? activeOfferFor(catalog, ctx.subjectId, now) : null;
    if (offer && offer.planId === ctx.planId) {
      let amount = null, model = null;
      if (offer.billingModel === "per-member") {
        const unit = offer.unitPrice || offer.price;
        if (unit && unit.currency === currency) {
          amount = memberAmount(unit.amountMinor, offer.volumeTiers, ctx.memberCount);
          model = "per-member × " + (ctx.memberCount || 0);
        }
      } else if (offer.price && offer.price.currency === currency) {
        amount = offer.price.amountMinor;
        if (offer.price.interval) { /* interval honored from offer */ }
        model = "negotiated " + (offer.price.interval || interval);
      }
      if (amount !== null) {
        trace.push("custom offer " + offer.id + " (" + model + ", net price — coupons do not stack)");
        return {
          amountMinor: amount,
          currency: currency,
          interval: (offer.price && offer.price.interval) || interval,
          source: "custom-offer",
          trace: trace,
          offerId: offer.id,
          discountId: null
        };
      }
      trace.push("custom offer " + offer.id + " has no " + currency + " price — falling through to price book");
    }

    // 2/3. Price book: specific region beats "ANY"
    const rows = catalog.priceBook.filter(function (r) {
      return r.planId === ctx.planId && r.currency === currency && r.interval === interval;
    });
    let row = rows.find(function (r) { return r.region === region; });
    if (row) trace.push("price book: region " + region);
    if (!row) {
      row = rows.find(function (r) { return r.region === "ANY"; });
      if (row) trace.push("price book: default region ANY");
    }
    if (!row) {
      return { amountMinor: null, currency: currency, interval: interval, source: "none", trace: trace.concat(["no price found"]), offerId: offer ? offer.id : null, discountId: null };
    }

    let amount = row.amountMinor;
    let source = region !== "ANY" && row.region === region ? "regional" : "plan-default";

    // 4. Coupon on book prices only
    if (ctx.discountCode) {
      const d = catalog.discounts.find(function (x) { return x.code === String(ctx.discountCode).toUpperCase(); });
      if (d && d.status === "active" && (!d.expiresAt || now <= d.expiresAt) && (!d.currency || d.currency === currency)) {
        const off = d.type === "percent" ? Math.round(amount * d.bps / 10000) : d.amountMinor;
        amount = Math.max(0, amount - off);
        source = "discounted";
        trace.push("discount " + d.code + " (−" + formatMinor(off, currency) + ")");
      } else if (d) {
        trace.push("discount " + String(ctx.discountCode).toUpperCase() + " not applicable (expired/inactive/currency)");
      } else {
        trace.push("unknown discount code ignored");
      }
    }

    return { amountMinor: amount, currency: currency, interval: interval, source: source, trace: trace, offerId: offer ? offer.id : null, discountId: null };
  }

  /* ---------- Entitlement resolution (never reads price) ---------- */

  /* Resolves what a subject may actually use.
     Returns { status, planId, offerId, features: {key: {enabled, limit, source}} } */
  function resolveEntitlements(catalog, ctx) {
    const now = typeof ctx.nowMs === "number" ? ctx.nowMs : Date.now();
    const sub = catalog.subscriptions
      .filter(function (s) { return s.subjectId === ctx.subjectId; })
      .sort(function (a, b) { return b.startedAt - a.startedAt; })[0];

    if (!sub) return { status: "none", planId: null, offerId: null, features: {} };

    const policy = STATUS_POLICY[sub.status] || "none";
    if (policy === "none") return { status: sub.status, planId: sub.planId, offerId: sub.offerId, features: {} };
    if (policy === "limited") return { status: sub.status, planId: sub.planId, offerId: sub.offerId, features: {} };
    if (policy === "until-period-end" && now > sub.currentPeriodEnd) {
      return { status: "expired", planId: sub.planId, offerId: sub.offerId, features: {} };
    }

    const plan = catalog.plans.find(function (p) { return p.id === sub.planId; });
    const features = {};
    if (plan && plan.status === "published") {
      Object.keys(plan.features).forEach(function (k) {
        if (plan.features[k].enabled) {
          features[k] = { enabled: true, limit: plan.features[k].limit === undefined ? null : plan.features[k].limit, source: "plan:" + plan.id };
        }
      });
    }

    // Offer feature overrides (may add or restrict) — still no price involved.
    const offer = sub.offerId ? catalog.offers.find(function (o) { return o.id === sub.offerId; }) : null;
    if (offer && isOfferActive(offer, now)) {
      const ov = offer.featureOverrides || {};
      Object.keys(ov).forEach(function (k) {
        if (ov[k] && ov[k].enabled) features[k] = { enabled: true, limit: ov[k].limit === undefined ? null : ov[k].limit, source: "offer:" + offer.id };
        else delete features[k];
      });
    }

    return { status: sub.status, planId: sub.planId, offerId: sub.offerId, features: features };
  }

  /* Usage check against resolved entitlements. */
  function checkEntitlement(entitlements, featureKey, usageCount) {
    const f = entitlements.features[featureKey];
    if (!f || !f.enabled) {
      return { allowed: false, remaining: 0, reason: entitlements.status === "none" ? "no_subscription" : "not_in_plan" };
    }
    if (f.limit === null || f.limit === undefined) return { allowed: true, remaining: Infinity, reason: null };
    const used = usageCount || 0;
    if (used >= f.limit) return { allowed: false, remaining: 0, reason: "quota_exhausted" };
    return { allowed: true, remaining: f.limit - used, reason: null };
  }

  window.Pricing = {
    FEATURES: FEATURES,
    INTERVALS: INTERVALS,
    SUBJECT_TYPES: SUBJECT_TYPES,
    SUBSCRIPTION_STATUSES: SUBSCRIPTION_STATUSES,
    emptyCatalog: emptyCatalog,
    seedCatalog: seedCatalog,
    uid: uid,
    audit: audit,
    toMinor: toMinor,
    formatMinor: formatMinor,
    validatePlan: validatePlan,
    validatePriceRow: validatePriceRow,
    createPlan: createPlan,
    setPlanStatus: setPlanStatus,
    updatePlanFeatures: updatePlanFeatures,
    upsertPrice: upsertPrice,
    createOffer: createOffer,
    revokeOffer: revokeOffer,
    createDiscount: createDiscount,
    removeDiscount: removeDiscount,
    subscribe: subscribe,
    setSubscriptionStatus: setSubscriptionStatus,
    changeSubscriptionPlan: changeSubscriptionPlan,
    isOfferActive: isOfferActive,
    activeOfferFor: activeOfferFor,
    memberAmount: memberAmount,
    resolvePrice: resolvePrice,
    resolveEntitlements: resolveEntitlements,
    checkEntitlement: checkEntitlement
  };
})();
