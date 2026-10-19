/* Headless port of the pricing-engine assertions in js/tests.js. The real
   js/pricing.js runs in the sandbox; the cases and expected values are the
   browser suite's, kept 1:1 so both harnesses agree. */

import { createBrowserSandbox } from "../test-support/browser";

interface AuditEntry {
  actor?: string;
  action?: string;
  before?: { amountMinor?: number } | null;
  after?: { amountMinor?: number } | null;
}

interface Catalog {
  audit: AuditEntry[];
}

interface PriceResult {
  amountMinor: number;
  source: string;
}

interface Feature {
  limit?: number | null;
  source?: string;
}

interface Entitlements {
  features: Record<string, Feature | undefined>;
}

interface Errors {
  errors: unknown[];
}

interface PricingApi {
  toMinor(value: string, currency: string): number | null;
  formatMinor(amountMinor: number, currency: string): string;
  seedCatalog(): Catalog;
  resolvePrice(catalog: Catalog, query: Record<string, unknown>): PriceResult;
  createOffer(catalog: Catalog, actor: string, offer: Record<string, unknown>): Errors & {
    offer: { id: string };
  };
  upsertPrice(catalog: Catalog, actor: string, row: Record<string, unknown>): Errors;
  createPlan(catalog: Catalog, actor: string, plan: Record<string, unknown>): Errors;
  memberAmount(unitAmountMinor: number, tiers: unknown, members: number): number;
  subscribe(catalog: Catalog, actor: string, input: Record<string, unknown>): Errors & {
    subscription: { id: string };
  };
  resolveEntitlements(
    catalog: Catalog,
    query: { subjectId: string; nowMs: number }
  ): Entitlements;
  checkEntitlement(
    entitlements: Entitlements,
    key: string,
    used: number
  ): { remaining?: number | null; allowed: boolean };
  setSubscriptionStatus(catalog: Catalog, actor: string, id: string, status: string): unknown;
}

function loadPricing() {
  const sandbox = createBrowserSandbox();
  return { sandbox, Pricing: sandbox.api<PricingApi>("Pricing") };
}

const OFFER = {
  subjectType: "club",
  subjectId: "club_rivercity",
  planId: "plan_premium",
  billingModel: "flat",
  price: { currency: "EUR", amountMinor: 799, interval: "annual" },
  featureOverrides: { share_studio: { enabled: true, limit: 999 } },
  validFrom: 0, // replaced per test with pNow - 1000
  validUntil: 0
};

describe("pricing engine (js/pricing.js)", () => {
  it("keeps money in integer minor units with explicit currencies", () => {
    const { Pricing } = loadPricing();

    expect(Pricing.toMinor("12.99", "USD")).toBe(1299);
    expect(Pricing.toMinor("5", "USD")).toBe(500);
    expect(Pricing.toMinor("1200", "JPY")).toBe(1200); // no minor units
    expect(Pricing.toMinor("12,99", "USD")).toBeNull(); // garbage is rejected
    expect(Pricing.formatMinor(1299, "USD")).toBe("$12.99");
  });

  it("resolves the price book by region and applies coupons without stacking rules", () => {
    const { Pricing } = loadPricing();
    const catalog = Pricing.seedCatalog();
    const nowMs = Date.now();
    const base = { planId: "plan_premium", interval: "monthly", nowMs };

    const regional = Pricing.resolvePrice(catalog, {
      ...base,
      currency: "EUR",
      region: "EU"
    });
    expect(regional.amountMinor).toBe(1099);
    expect(regional.source).toBe("regional");

    const fallback = Pricing.resolvePrice(catalog, {
      ...base,
      currency: "EUR",
      region: "US"
    });
    expect(fallback.amountMinor).toBe(1199);
    expect(fallback.source).toBe("plan-default");

    const discounted = Pricing.resolvePrice(catalog, {
      ...base,
      currency: "USD",
      region: "ANY",
      discountCode: "LAUNCH20"
    });
    expect(discounted.amountMinor).toBe(1039); // round(1299 * 0.2) = 260
    expect(discounted.source).toBe("discounted");

    const unknownCode = Pricing.resolvePrice(catalog, {
      ...base,
      currency: "USD",
      region: "ANY",
      discountCode: "NOPE"
    });
    expect(unknownCode.amountMinor).toBe(1299);
  });

  it("lets negotiated offers win, stay grandfathered, and price seats in tiers", () => {
    const { Pricing } = loadPricing();
    const catalog = Pricing.seedCatalog();
    const nowMs = Date.now();

    const created = Pricing.createOffer(catalog, "test", {
      ...OFFER,
      validFrom: nowMs - 1000,
      validUntil: nowMs + 30 * 86400000
    });
    expect(created.errors).toHaveLength(0);

    const query = {
      planId: "plan_premium",
      subjectId: "club_rivercity",
      currency: "EUR",
      region: "EU",
      interval: "monthly",
      nowMs
    };

    const offered = Pricing.resolvePrice(catalog, query);
    expect(offered.amountMinor).toBe(799);
    expect(offered.source).toBe("custom-offer");

    // Coupons never stack on a negotiated price.
    const withCoupon = Pricing.resolvePrice(catalog, { ...query, discountCode: "LAUNCH20" });
    expect(withCoupon.amountMinor).toBe(799);

    // Raising the book price must not move the negotiated price…
    Pricing.upsertPrice(catalog, "test", {
      planId: "plan_premium",
      currency: "EUR",
      region: "ANY",
      interval: "monthly",
      amountMinor: 1599
    });
    expect(Pricing.resolvePrice(catalog, query).amountMinor).toBe(799);

    // …while everyone else sees the new book price.
    const withoutSubject = { ...query } as Record<string, unknown>;
    delete withoutSubject.subjectId;
    expect(Pricing.resolvePrice(catalog, withoutSubject).amountMinor).toBe(1099);

    // Per-member pricing: flat, or piecewise volume bands.
    expect(Pricing.memberAmount(500, null, 30)).toBe(15000);
    const tiers = [
      { upTo: 25, unitAmountMinor: 400 },
      { upTo: null, unitAmountMinor: 300 }
    ];
    expect(Pricing.memberAmount(500, tiers, 40)).toBe(25 * 400 + 15 * 300);
  });

  it("resolves entitlements from relationships, never from price", () => {
    const { Pricing } = loadPricing();
    const catalog = Pricing.seedCatalog();
    const nowMs = Date.now();

    const offer = Pricing.createOffer(catalog, "test", {
      ...OFFER,
      validFrom: nowMs - 1000,
      validUntil: nowMs + 30 * 86400000
    });
    Pricing.upsertPrice(catalog, "test", {
      planId: "plan_premium",
      currency: "EUR",
      region: "ANY",
      interval: "monthly",
      amountMinor: 1599
    });
    const subscription = Pricing.subscribe(catalog, "test", {
      subjectId: "club_rivercity",
      subjectType: "club",
      planId: "plan_premium",
      offerId: offer.offer.id,
      nowMs
    });
    expect(subscription.errors).toHaveLength(0);

    const entitlements = Pricing.resolveEntitlements(catalog, {
      subjectId: "club_rivercity",
      nowMs
    });
    expect(entitlements.features.ai_coach).toBeDefined();
    expect(entitlements.features.ai_coach?.limit).toBe(200);
    expect(entitlements.features.share_studio?.source).toBe("offer:" + offer.offer.id);
    expect(entitlements.features.share_studio?.limit).toBe(999);
    expect(entitlements.features.ai_coach?.source).toBe("plan:plan_premium");

    // Quotas
    expect(Pricing.checkEntitlement(entitlements, "ai_coach", 150).remaining).toBe(50);
    expect(Pricing.checkEntitlement(entitlements, "ai_coach", 200).allowed).toBe(false);
    expect(Pricing.checkEntitlement(entitlements, "org_dashboard", 0).allowed).toBe(false);

    // past_due drops access but leaves pricing alone: price ≠ permissions.
    Pricing.setSubscriptionStatus(catalog, "test", subscription.subscription.id, "past_due");
    const pastDue = Pricing.resolveEntitlements(catalog, { subjectId: "club_rivercity", nowMs });
    expect(Object.keys(pastDue.features)).toHaveLength(0);

    const stillPriced = Pricing.resolvePrice(catalog, {
      planId: "plan_premium",
      subjectId: "club_rivercity",
      currency: "EUR",
      region: "EU",
      interval: "monthly",
      nowMs
    });
    expect(stillPriced.amountMinor).toBe(799);

    // canceled keeps access until the period ends, then expires.
    Pricing.setSubscriptionStatus(catalog, "test", subscription.subscription.id, "canceled");
    const canceledNow = Pricing.resolveEntitlements(catalog, { subjectId: "club_rivercity", nowMs });
    expect(Object.keys(canceledNow.features).length).toBeGreaterThan(0);

    const expired = Pricing.resolveEntitlements(catalog, {
      subjectId: "club_rivercity",
      nowMs: nowMs + 400 * 86400000
    });
    expect(Object.keys(expired.features)).toHaveLength(0);

    expect(
      Object.keys(Pricing.resolveEntitlements(catalog, { subjectId: "nobody", nowMs }).features)
    ).toHaveLength(0);

    // Audit trail: offer + price + subscribe + 2 status changes.
    expect(catalog.audit.length).toBeGreaterThanOrEqual(5);
    const last = catalog.audit[catalog.audit.length - 1];
    expect(last.actor).toBeTruthy();
    expect(last.action).toBeTruthy();

    const priceChange = catalog.audit.find(
      (entry) => entry.action === "price.updated" && entry.before?.amountMinor === 1199
    );
    expect(priceChange).toBeDefined();
    expect(priceChange?.after?.amountMinor).toBe(1599);
  });

  it("rejects invalid rows at the boundary instead of accepting them", () => {
    const { Pricing } = loadPricing();
    const catalog = Pricing.seedCatalog();

    expect(
      Pricing.upsertPrice(catalog, "t", {
        planId: "plan_premium",
        currency: "USD",
        region: "ANY",
        interval: "monthly",
        amountMinor: 12.99
      }).errors.length
    ).toBeGreaterThan(0);

    expect(
      Pricing.upsertPrice(catalog, "t", {
        planId: "plan_premium",
        currency: "dollars",
        region: "ANY",
        interval: "monthly",
        amountMinor: 1299
      }).errors.length
    ).toBeGreaterThan(0);

    expect(
      Pricing.createPlan(catalog, "t", {
        name: "Bad",
        features: { teleportation: { enabled: true, limit: null } }
      }).errors.length
    ).toBeGreaterThan(0);
  });
});
