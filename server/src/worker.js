/* Cloudflare Worker entry.
 *
 *   /api/*  → the LMTLSS API (server/src/api.js)
 *   else    → the static web app, served from the ASSETS binding
 *
 * The static app is exactly the files in `public/` — no build step, no
 * framework, same code that runs from index.html locally. Serving both from one
 * origin is what makes the API reachable without CORS and keeps cookies and
 * tokens on a single host.
 *
 * Bindings expected in production (see server/wrangler.toml):
 *   DB              D1 database (required)
 *   ASSETS          static assets (optional; API-only if absent)
 *   AUTH_JWT_SECRET / AUTH_ISSUER / AUTH_AUDIENCE   auth seam (see auth.js)
 *   ALLOWED_ORIGIN  only for a separate web origin; unset = same-origin only
 *   STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY        payments (not implemented yet)
 */

import { handleApi } from "./api.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.indexOf("/api/") === 0) {
      const result = await handleApi(request, env);
      const headers = new Headers(result.headers || {});
      const body = result.body === null || result.body === undefined
        ? null
        : (typeof result.body === "string" ? result.body : JSON.stringify(result.body));
      return new Response(result.status === 204 ? null : body, { status: result.status, headers: headers });
    }
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  }
};
