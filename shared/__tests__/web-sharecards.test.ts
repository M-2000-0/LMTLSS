/* Headless port of the share-card assertions in js/tests.js: composition,
   provenance honesty, XML escaping, and the route machinery that must stay
   inert without real coordinates. Real js/sharecards.js in the sandbox. */

import { createBrowserSandbox } from "../test-support/browser";

interface CardStat {
  label: string;
  value: string;
}

interface Card {
  kind: string;
  stats: CardStat[];
  provenance: string | null;
  isPR?: boolean;
}

interface Point {
  lat: number;
  lon: number;
}

interface Projection {
  path: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface ShareCardsApi {
  composeCard(session: Record<string, unknown>, opts: Record<string, unknown>): Card;
  toSVG(card: Card, opts: Record<string, unknown>): string;
  escapeXML(value: string): string;
  trimRoute(points: Point[] | null, maxPoints: number): Point[] | null;
  projectRoute(points: Point[], width: number, height: number, maxPoints: number): Projection;
  haversineM(a: Point, b: Point): number;
}

function loadShareCards() {
  const sandbox = createBrowserSandbox();
  return sandbox.api<ShareCardsApi>("ShareCards");
}

const RUN = {
  sport: "running",
  title: "Long Run",
  startedAt: "2026-10-10T07:00:00Z",
  durationSec: 2700,
  distanceM: 7500,
  distanceSource: "manual"
};

const STRENGTH = {
  sport: "strength",
  title: "Push + Squat",
  startedAt: "2026-10-12T17:00:00Z",
  durationSec: 3000,
  exercises: [
    {
      name: "Bench Press",
      sets: [
        { reps: 5, load: 80, done: true },
        { reps: 5, load: 80, done: true },
        { reps: 5, load: 85, done: true }
      ]
    },
    {
      name: "Pull-Up",
      sets: [
        { reps: 6, load: 0, done: true },
        { reps: 6, load: 0, done: false }
      ]
    }
  ]
};

describe("share cards (js/sharecards.js)", () => {
  it("composes a run card with pace and keeps manual-distance provenance", () => {
    const ShareCards = loadShareCards();

    const card = ShareCards.composeCard(RUN, { unit: "metric" });
    expect(card.kind).toBe("run");
    expect(card.stats).toHaveLength(3);
    expect(card.stats[2].value).toBe("6:00/km");
    expect(card.provenance).toContain("no GPS");

    // A GPS-sourced distance carries no warning.
    const gps = ShareCards.composeCard({ ...RUN, distanceSource: "gps" }, {});
    expect(gps.provenance).toBeNull();
  });

  it("counts only completed sets and total volume on the strength card", () => {
    const ShareCards = loadShareCards();

    const card = ShareCards.composeCard(STRENGTH, { unit: "metric", isPR: true });
    expect(card.stats[0].value).toBe("1,225 kg"); // 80*5*2 + 85*5
    expect(card.stats[1].value).toBe("4"); // the failed set is excluded
    expect(card.isPR).toBe(true);
  });

  it("renders SVG only from recorded data and escapes user strings", () => {
    const ShareCards = loadShareCards();
    const runCard = ShareCards.composeCard(RUN, { unit: "metric" });
    const svg = ShareCards.toSVG(runCard, {});

    // Honesty: no coordinates means no fabricated route line.
    // The logo pill on the card header is static brand SVG with its own
    // decorative <path> (pill end cap), so check for the route path
    // signature specifically — not for any <path> at all.
    expect(svg).not.toContain('stroke="#61EB1A" stroke-width="10"');
    expect(svg).toContain("LMTLSS");
    expect(svg).toContain("no GPS connected");
    expect(svg).toContain('<g transform="translate(940,118)"');
    expect(svg).toContain('id="pillBody"');

    // Security: titles are XML-escaped, never injected as markup.
    const evil = ShareCards.composeCard(
      {
        sport: "running",
        title: "<script>alert(1)</script>",
        startedAt: "2026-10-10T07:00:00Z",
        durationSec: 1800,
        distanceM: 5000
      },
      {}
    );
    const evilSvg = ShareCards.toSVG(evil, {});
    expect(evilSvg).toContain("&lt;script&gt;");
    expect(evilSvg).not.toContain("<script>");

    expect(ShareCards.escapeXML("a & b")).toBe("a &amp; b");
    expect(ShareCards.escapeXML('say "hi"')).toBe("say &quot;hi&quot;");
  });

  it("keeps route machinery inert until real coordinates exist", () => {
    const ShareCards = loadShareCards();

    const loop: Point[] = [];
    for (let i = 0; i <= 40; i++) {
      loop.push({ lat: 19.43 + i * 0.0005, lon: -99.13 + (i % 20) * 0.0005 });
    }

    const trimmed = ShareCards.trimRoute(loop, 200);
    expect(trimmed).not.toBeNull();
    expect(trimmed && trimmed.length).toBeLessThan(loop.length);
    expect(trimmed && trimmed.length).toBeGreaterThan(2);

    expect(ShareCards.trimRoute([{ lat: 1, lon: 1 }, { lat: 1.0001, lon: 1.0001 }], 200)).toBeNull();
    expect(ShareCards.trimRoute(null, 200)).toBeNull();

    const projection = ShareCards.projectRoute(loop, 1000, 600, 40);
    expect(projection.path).toBeTruthy();
    expect(projection.start).toBeTruthy();
    expect(projection.end).toBeTruthy();
    for (const point of [projection.start, projection.end]) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1000);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(600);
    }

    // With stored coordinates the card *does* render the route.
    const routeCard = ShareCards.composeCard({ ...RUN, route: loop }, {});
    expect(ShareCards.toSVG(routeCard, {})).toContain("<path");

    // 0.01° of latitude ≈ 1112 m.
    const distance = ShareCards.haversineM(
      { lat: 19.4326, lon: -99.1332 },
      { lat: 19.4426, lon: -99.1332 }
    );
    expect(distance).toBeGreaterThan(1100);
    expect(distance).toBeLessThan(1125);
  });
});
