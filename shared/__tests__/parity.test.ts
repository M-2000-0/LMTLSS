/* Anti-drift guard: js/domain.js (browser IIFE) and src/domain.ts (mobile port)
   are maintained in parallel. This fails whenever one side adds or removes a
   public export without the other. */

import * as fs from "fs";
import * as path from "path";
import * as domain from "../src/domain";

describe("js/domain.js ↔ shared/domain.ts parity", () => {
  it("exports the exact same public API surface", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "..", "js", "domain.js"),
      "utf8"
    );
    const match = src.match(/window\.Domain\s*=\s*\{([^}]*)\}/);
    if (!match) {
      throw new Error("window.Domain assignment not found in js/domain.js");
    }
    const keys = match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split(":")[0].trim())
      .sort();
    expect(keys).toEqual(Object.keys(domain).sort());
  });
});