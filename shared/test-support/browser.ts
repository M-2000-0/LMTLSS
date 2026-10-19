/* Loads the legacy browser modules (js/*.js) into a Node VM sandbox so their
   real code — not a re-implementation — can be asserted headlessly.

   Why a sandbox instead of importing them: these files are IIFEs that publish
   `window.Store` / `window.Pricing` / `window.ShareCards` and expect browser
   globals. The VM gives them exactly the surface tests.html gives them, minus
   the DOM they do not need for logic tests. Nothing is bundled or rewritten,
   so a fix in js/ is picked up here on the next run.

   This lives outside __tests__ on purpose: shared/jest treats every file under
   __tests__ as a suite, and this file only provides helpers. */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

/** Repo root: shared/test-support -> shared -> repo. */
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** Same order as tests.html, where dependencies load before dependents. */
export const DEFAULT_FILES = [
  "js/store.js",
  "js/domain.js",
  "js/pricing.js",
  "js/sharecards.js"
] as const;

export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  readonly length: number;
  key(index: number): string | null;
}

export interface BrowserSandbox {
  /** Backing store the modules write through, exposed for assertions. */
  localStorage: LocalStorageLike;
  /** Typed access to a `window.*` export; throws if the module did not load. */
  api<T>(name: string): T;
  /** Load another js/ file into the same context. */
  run(file: string): void;
}

function memoryStorage(data: Map<string, string>): LocalStorageLike {
  return {
    getItem: (key) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    get length() {
      return data.size;
    },
    key: (index) => Array.from(data.keys())[index] ?? null
  };
}

/**
 * A fresh browser-like global per call: no state leaks between tests, which is
 * what a clean page load gives tests.html.
 */
export function createBrowserSandbox(
  files: readonly string[] = DEFAULT_FILES,
  extraGlobals: Record<string, unknown> = {}
): BrowserSandbox {
  const data = new Map<string, string>();
  const storage = memoryStorage(data);

  const globalObject: Record<string, unknown> = {
    console,
    localStorage: storage,
    setTimeout,
    clearTimeout,
    ...extraGlobals
  };
  // Modules publish on `window`; a self-reference makes `window` and the
  // global object the same thing, exactly as in a browser.
  globalObject.window = globalObject;

  const context = vm.createContext(globalObject);

  function run(file: string): void {
    const absolute = path.join(REPO_ROOT, file);
    const source = fs.readFileSync(absolute, "utf8");
    vm.runInContext(source, context, { filename: absolute });
  }

  for (const file of files) run(file);

  return {
    localStorage: storage,
    run,
    api<T>(name: string): T {
      const value = globalObject[name];
      if (value === undefined) {
        throw new Error(`${name} was not published by the loaded modules`);
      }
      return value as T;
    }
  };
}
