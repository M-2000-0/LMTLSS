/* Anti-drift guard: js/domain.js (browser IIFE) and src/domain.ts (mobile port)
   are maintained in parallel. This fails whenever one side adds or removes a
   public export without the other.

   js/domain.js exposes its API in three shapes: the main `window.Domain = {...}`
   literal, an `Object.assign(window.Domain, {...})` block for the equipment
   catalogue, and individual `window.Domain.x = ...` assignments. All three are
   part of the public surface, so all three are collected here. */

import * as fs from "fs";
import * as path from "path";
import * as domain from "../src/domain";

function collectKeys(src: string): string[] {
  const keys: string[] = [];

  const literal = src.match(/window\.Domain\s*=\s*\{([^}]*)\}/);
  if (!literal) {
    throw new Error("window.Domain assignment not found in js/domain.js");
  }
  keys.push(
    ...literal[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split(":")[0].trim())
  );

  const assigned = src.match(/Object\.assign\(window\.Domain,\s*\{([\s\S]*?)\n {2}\}\);/);
  if (assigned) {
    keys.push(
      ...assigned[1]
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^[A-Za-z0-9_]+\s*:/.test(line))
        .map((line) => line.split(":")[0].trim())
    );
  }

  for (const match of src.matchAll(/window\.Domain\.([A-Za-z0-9_]+)\s*=/g)) {
    keys.push(match[1]);
  }

  return [...new Set(keys)].sort();
}

describe("js/domain.js ↔ shared/domain.ts parity", () => {
  it("exports the exact same public API surface", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "..", "js", "domain.js"),
      "utf8"
    );
    expect(collectKeys(src)).toEqual(Object.keys(domain).sort());
  });
});
