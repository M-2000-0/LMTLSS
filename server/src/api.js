/* API entry point.
 *
 * Request pipeline, in order:
 *   1. parse the request (JSON body bounded to 64 KiB)
 *   2. resolve the caller from the bearer token (auth.js) — never from a body field
 *   3. match the route and reject anything unlisted
 *   4. enforce the route's auth requirement
 *   5. run the handler, which authorizes against the database
 *   6. map errors to one JSON shape; unexpected errors become a bare 500 that
 *      leaks no stack trace, SQL or provider message to the client
 *
 * CORS: the web app is served from the same origin in production (the Worker
 * serves it). Cross-origin requests are only answered when an explicit origin
 * is configured in ALLOWED_ORIGIN — no wildcard, no credentials by default.
 */

import { HttpError, badRequest, json, nowIso, matchRoute, slugify } from "./http.js";
import { resolveUser } from "./auth.js";
import { dbFromEnv } from "./db.js";
import { ensureSchema } from "./migrate.js";

import communities from "./routes/communities.js";
import events from "./routes/events.js";
import identity from "./routes/identity.js";

const ROUTES = [].concat(communities.routes, events.routes, identity.routes);

const MAX_BODY_BYTES = 64 * 1024;

/* Schema is ensured once per database connection, not once per module.
   A module-level flag would leave any *other* binding unmigrated — the API
   must be correct for whatever database it is handed, including a second
   environment or a fresh test database in the same process. */
const schemaReady = new WeakMap();

export async function ensureSchemaOnce(db) {
  let pending = schemaReady.get(db);
  if (!pending) {
    pending = ensureSchema(db).catch(function (err) {
      schemaReady.delete(db); // a failed migration must be retried, not cached
      throw err;
    });
    schemaReady.set(db, pending);
  }
  return pending;
}

export function routes() {
  return ROUTES.slice();
}

async function readJsonBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw badRequest("body_too_large", "Request body is too large.");
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw badRequest("invalid_body", "Request body must be a JSON object.");
    }
    return parsed;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw badRequest("invalid_json", "Request body must be valid JSON.");
  }
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  const allowed = env && env.ALLOWED_ORIGIN;
  if (!origin || !allowed || origin !== allowed) return {};
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "vary": "origin"
  };
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const cors = corsHeaders(request, env);

  if (method === "OPTIONS") {
    return { status: 204, body: null, headers: Object.assign({ "access-control-max-age": "600" }, cors) };
  }

  const db = dbFromEnv(env);
  const nowMs = env && typeof env.__nowMs === "number" ? env.__nowMs : Date.now();
  const clock = env && typeof env.__now === "function" ? env.__now : function () { return nowMs; };

  try {
    await ensureSchemaOnce(db);

    const matched = matchRoute(ROUTES, method, url.pathname);
    if (!matched) {
      return Object.assign(json({ error: { code: "not_found", message: "No such endpoint." } }, 404), { headers: Object.assign({}, cors) });
    }

    let user = null;
    try {
      user = await resolveUser(db, env, request, clock());
    } catch (err) {
      if (err instanceof HttpError && err.code === "auth_not_configured") {
        // Only routes that need identity are blocked; public reads still work.
        if (matched.route.auth) throw err;
      } else {
        throw err;
      }
    }
    if (matched.route.auth && !user) {
      throw new HttpError(401, "unauthorized", "Sign in required.");
    }

    const nowValue = clock();
    const ctx = {
      db: db,
      env: env,
      request: request,
      user: user,
      params: matched.params,
      query: url.searchParams,
      body: await readJsonBody(request),
      nowMs: typeof nowValue === "number" ? nowValue : Date.parse(nowValue),
      nowIso: function () { return nowIso(clock()); },
      clientIp: request.headers.get("cf-connecting-ip") || null,
      newId: function (prefix) { return prefix + "_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20); },
      slugify: slugify
    };

    const result = await matched.route.handler(ctx);
    const out = result && result.body !== undefined ? result : json(result || null);
    return Object.assign(out, { headers: Object.assign({}, out.headers || {}, cors) });
  } catch (err) {
    if (err instanceof HttpError) {
      return Object.assign(
        json({ error: { code: err.code, message: err.message, details: err.details || null } }, err.status),
        { headers: Object.assign({}, cors) }
      );
    }
    // Log server-side, tell the client nothing it should not know.
    if (env && env.LOG_ERRORS !== "off") {
      console.error("api_error", method, url.pathname, err && err.stack ? err.stack : err);
    }
    return Object.assign(
      json({ error: { code: "server_error", message: "Something went wrong on the server." } }, 500),
      { headers: Object.assign({}, cors) }
    );
  }
}
