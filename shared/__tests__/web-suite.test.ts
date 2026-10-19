/* Drift guard: runs js/tests.js — all 214 browser assertions — inside the VM
   sandbox with a minimal document stub. The ported suites above assert the
   same behaviour test-by-test; this one guarantees a newly added browser-only
   assertion cannot silently rot outside `npm test`.

   It is not a replacement for tests.html: that remains the interactive page
   people open in a real browser. */

import { createBrowserSandbox } from "../test-support/browser";

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

interface SuiteResult {
  passed: number;
  failed: number;
  results: TestResult[];
}

/** Enough DOM for tests.js to print its report; assertions never use it. */
function stubElement() {
  return {
    className: "",
    textContent: "",
    style: {} as Record<string, string>,
    appendChild() {
      /* no-op: the report has nowhere to render in Node */
    }
  };
}

describe("browser suite (js/tests.js)", () => {
  it("executes every browser assertion with zero failures", () => {
    const sandbox = createBrowserSandbox(
      ["js/store.js", "js/domain.js", "js/pricing.js", "js/sharecards.js", "js/ui.js", "js/tests.js"],
      {
        document: {
          title: "",
          activeElement: null,
          getElementById: stubElement,
          createElement: stubElement,
          createElementNS: stubElement,
          createDocumentFragment: stubElement,
          createTextNode: stubElement
        }
      }
    );

    const suite = sandbox.api<SuiteResult>("__TESTS__");
    const failures = suite.results
      .filter((result) => !result.pass)
      .map((result) => result.name + " — " + result.detail);

    expect(failures).toEqual([]);
    expect(suite.failed).toBe(0);
    // Floor, not an exact count: new browser assertions are welcome; losing
    // coverage silently is what this guards against.
    expect(suite.passed).toBeGreaterThanOrEqual(214);
  });
});
