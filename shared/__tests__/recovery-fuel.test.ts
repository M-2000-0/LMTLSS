/* Headless port of the recovery & fueling assertions in js/tests.js, plus the
   local-day boundary cases for fuel and recovery. Fixture dates are built
   relative to the local calendar, exactly like the browser suite, so these do
   not rot and "today" means the athlete's local day. */

import { fuelSummary, mealEstimateLabel, recoverySeries, restDayRecommendation } from "../src/domain";
import type { AppState } from "../src/types";

function dayBack(days: number, hour?: number, min = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  if (typeof hour === "number") date.setHours(hour, min, 0, 0);
  return date;
}

/** Local calendar day, matching Store.todayISO in js/store.js. */
function dayISO(days: number): string {
  const date = dayBack(days);
  const pad = (n: number) => (n < 10 ? "0" : "") + n;
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

const recState: AppState = {
  log: [6, 5, 4, 3, 2, 1].map((days) => ({
    sport: "strength",
    startedAt: dayBack(days, 18).toISOString()
  })),
  readiness: [
    { date: dayISO(4), energy: 2, soreness: 3 },
    { date: dayISO(1), energy: 2, soreness: 4 }
  ],
  hydration: [6, 5, 4, 3, 2, 1, 0].map((days, index) => ({
    date: dayISO(days),
    ml: [1000, 1100, 900, 1200, 1000, 1100, 1300][index]
  })),
  meals: [
    { id: "m1", date: dayISO(0), kind: "breakfast", calories: 400, proteinG: 20, time: dayBack(0, 8).toISOString() },
    { id: "m2", date: dayISO(0), kind: "lunch", calories: 650, proteinG: 35, time: dayBack(0, 13).toISOString() }
  ]
};

describe("recovery series", () => {
  it("produces a labelled 7-day-per-week grid from logged data", () => {
    const series = recoverySeries(recState, 2);

    expect(series).toHaveLength(14);
    expect(series.every((day) => day.weekday.length === 3)).toBe(true);
    expect(series.some((day) => day.hydration === 1000)).toBe(true);
    expect(series.some((day) => day.meals === 2)).toBe(true);
    expect(series.every((day) => typeof day.rest === "boolean")).toBe(true);
  });

  it("counts an 11:30 pm local meal on the local day", () => {
    const series = recoverySeries(
      {
        log: [],
        readiness: [],
        hydration: [],
        meals: [
          {
            id: "late2",
            kind: "dinner",
            calories: 1,
            proteinG: 1,
            time: dayBack(0, 23, 30).toISOString()
          }
        ]
      },
      1
    );

    // The grid includes days later this week, so find today's row explicitly.
    const todayRow = series.find((day) => day.date === dayISO(0));
    expect(todayRow?.meals).toBe(1);
  });
});

describe("rest-day recommendation", () => {
  it("counts training and low-energy days and explains itself", () => {
    const rec = restDayRecommendation(recState);

    expect(rec.trainingDaysLast7).toBe(6);
    expect(rec.lowEnergyDaysLast7).toBe(2);
    expect(rec.suggestion).toContain("rest day");
    expect(rec.source).toContain("own data");
    expect(typeof rec.suggestion).toBe("string");
    expect(rec.source.length).toBeGreaterThan(20);
  });
});

describe("fuel summary", () => {
  it("reads today's hydration and sums meal estimates", () => {
    const fuel = fuelSummary(recState);

    expect(fuel.hydrationMl).toBe(1300);
    expect(fuel.hydrationLogged).toBe(true);
    expect(fuel.mealCalories).toBe(1050);
    expect(fuel.mealProteinG).toBe(55);
    expect(fuel.mealEstimateLabel).toContain("estimate");
  });

  it("finds today's hydration and a late meal in local time", () => {
    const fuel = fuelSummary({
      hydration: [{ date: dayISO(0), ml: 500 }],
      meals: [
        {
          id: "late",
          kind: "dinner",
          calories: 300,
          proteinG: 12,
          time: dayBack(0, 23, 30).toISOString()
        }
      ]
    });

    expect(fuel.hydrationMl).toBe(500);
    expect(fuel.mealCalories).toBe(300);
  });

  it("returns honest zeros and an empty-state label without data", () => {
    const fuel = fuelSummary({ log: [], readiness: [], hydration: [], meals: [] });

    expect(fuel.hydrationMl).toBe(0);
    expect(fuel.hydrationLogged).toBe(false);
    expect(fuel.mealEstimateLabel).toContain("No meals logged");
    expect(
      mealEstimateLabel([
        { id: "x", kind: "lunch", calories: 500, time: dayBack(0, 12).toISOString() }
      ])
    ).toContain("user-entered");
  });
});
