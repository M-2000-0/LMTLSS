/* The platform seam is what makes shared/ portable: the same pure domain code
   runs on web (Store/UI globals behind it), mobile (persisted state) and Jest
   (defaults). These tests pin the shim behavior to its js/store.js + js/ui.js
   originals and prove injected state actually flows into domain output. */

import * as Domain from "../src/domain";
import {
  emptyState,
  getPlatformBindings,
  plural,
  resetPlatformBindings,
  setPlatformBindings,
  todayISO
} from "../src/platform";
import type { Profile } from "../src/types";

afterEach(() => {
  resetPlatformBindings();
});

const testProfile: Profile = {
  goal: "strength",
  sports: ["strength"],
  experience: "intermediate",
  daysPerWeek: 3,
  equipment: ["full-gym"]
};

describe("platform seam (storage shim)", () => {
  it("plural matches js/ui.js: 1 singular, n+1 plural", () => {
    expect(plural(1, "exercise")).toBe("1 exercise");
    expect(plural(3, "set")).toBe("3 sets");
  });

  it("todayISO is the local calendar day, YYYY-MM-DD (js/store.js contract)", () => {
    // Local-midday and local-late-evening stay on their own local day even when
    // the UTC text has already rolled over (the 7 pm UTC-6 data-loss bug).
    expect(todayISO(new Date(2026, 9, 17, 12, 34))).toBe("2026-10-17");
    expect(todayISO(new Date(2026, 9, 17, 23, 30))).toBe("2026-10-17");
    expect(todayISO(new Date(2026, 9, 17, 0, 5))).toBe("2026-10-17");
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("default bindings expose an empty state like a fresh js/store.js", () => {
    const s = getPlatformBindings().getState();
    expect(s.log).toEqual([]);
    expect(s.readiness).toEqual([]);
    expect(s.profile).toBeNull();
    expect(emptyState().settings).toEqual({
      unit: "metric",
      restSeconds: 90,
      weekStart: "mon"
    });
  });

  it("injected state flows into plan prefill (lastExerciseData reads bindings)", () => {
    setPlatformBindings({
      getState: () => ({
        ...emptyState(),
        log: [
          {
            id: "s1",
            sport: "strength",
            startedAt: "2026-10-01T17:00:00Z",
            exercises: [
              { name: "Back Squat", sets: [{ reps: 5, load: 100, done: true }] }
            ]
          }
        ]
      })
    });
    const plan = Domain.planFor({ ...testProfile });
    const push = plan.sessions.find((s) => s.title.indexOf("Push") >= 0);
    expect(push).toBeDefined();
    const squat = (push?.exercises || []).find((e) => e.name === "Back Squat");
    expect(squat?.targetLoad).toBe(100);
    expect(squat?.lastLoad).toBe(100);
    expect(squat?.lastReps).toBe(5);
  });

  it("resetPlatformBindings restores defaults after injection", () => {
    setPlatformBindings({ plural: () => "injected" });
    expect(getPlatformBindings().plural(2, "set")).toBe("injected");
    resetPlatformBindings();
    expect(getPlatformBindings().plural(2, "set")).toBe("2 sets");
  });
});