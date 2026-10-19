/* Headless port of the browser store assertions in js/tests.js (schema
   migration, quarantine preservation, weekPlan persistence). The real
   js/store.js runs inside the sandbox; only the test body is new. */

import { createBrowserSandbox } from "../test-support/browser";

const KEY = "lmtlss:v1";
const QUARANTINE_KEY = KEY + ":quarantine";

interface StoredState {
  profile: { name?: string } | null;
  settings: { unit?: string; restSeconds?: number };
  weekPlan: { weekStart?: string; moves?: Record<string, string> } | null;
}

interface StoreApi {
  migrate(payload: unknown): { state: StoredState; quarantine?: string };
  reload(): StoredState;
  get(): StoredState;
  saveWeekPlan(entry: unknown): void;
}

function loadStore() {
  const sandbox = createBrowserSandbox();
  return { sandbox, Store: sandbox.api<StoreApi>("Store") };
}

describe("browser store (js/store.js)", () => {
  it("migrates a v1 payload without quarantining it, preserving user data", () => {
    const { Store } = loadStore();
    const result = Store.migrate({
      version: 1,
      profile: { name: "X" },
      settings: { unit: "imperial" }
    });

    expect(result.quarantine).toBeUndefined();
    expect(result.state.profile?.name).toBe("X");
    expect(result.state.settings.unit).toBe("imperial");
    // Missing settings keys are filled from defaults.
    expect(result.state.settings.restSeconds).toBe(90);
  });

  it("quarantines payloads it cannot use instead of accepting them", () => {
    const { Store } = loadStore();

    expect(Store.migrate({ version: 99 }).quarantine).toBeTruthy();
    expect(Store.migrate({ version: 0 }).quarantine).toBeTruthy();
    expect(Store.migrate(null).quarantine).toBeTruthy();
    expect(Store.migrate("junk").quarantine).toBeTruthy();
  });

  it("preserves unreadable payloads under the quarantine key, never losing them", () => {
    const { sandbox, Store } = loadStore();

    // A payload written by a newer app version.
    sandbox.localStorage.setItem(
      KEY,
      JSON.stringify({ version: 99, profile: { name: "Future Athlete" } })
    );
    Store.reload();

    expect(Store.get().profile).toBeNull();
    const newer = JSON.parse(sandbox.localStorage.getItem(QUARANTINE_KEY) ?? "{}");
    expect(newer.payload).toContain("Future Athlete");

    // Corrupt JSON from any source.
    sandbox.localStorage.setItem(KEY, "{not json");
    Store.reload();

    const corrupt = JSON.parse(sandbox.localStorage.getItem(QUARANTINE_KEY) ?? "{}");
    expect(corrupt.reason).toBe("unparseable JSON");
    expect(corrupt.payload).toBe("{not json");
  });

  it("persists weekPlan across reload and tolerates old payloads without it", () => {
    const { sandbox, Store } = loadStore();

    Store.saveWeekPlan({
      weekStart: "2026-10-12",
      moves: { ra: "Wed" },
      dropped: [],
      changes: [],
      summary: "test"
    });
    Store.reload();

    const persisted = Store.get().weekPlan;
    expect(persisted?.weekStart).toBe("2026-10-12");
    expect(persisted?.moves?.ra).toBe("Wed");

    // Additive field: an older payload simply lacks it, and that is not an error.
    sandbox.localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, profile: null, plan: { sessions: [] }, log: [] })
    );
    Store.reload();

    expect(Store.get().weekPlan).toBeNull();
  });
});
