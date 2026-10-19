/* LIMITLESS EVENTS — discovery, registration, capacity, waitlist.
 *
 * Capacity is the part that must never be wrong, so a seat is claimed with a
 * single conditional INSERT: the row is created only if the live registration
 * count is still below capacity. Concurrent requests cannot both take the last
 * seat, and the same statement is what makes duplicate registration a no-op.
 * That is SQLite doing the concurrency control, so it holds on D1 too.
 *
 * Locations are stored generalized (venue name + area, optionally a coarse
 * centre). An organizer's or attendee's precise position is never part of an
 * event record.
 */

import {
  badRequest, cleanText, conflict, forbidden, instant, int, json,
  notFound, pageParams, str
} from "../http.js";
import { getCommunity, getMembership, isAdminRole, notify, requireEventOrganizer } from "../access.js";
import { rateLimit, userKey } from "../rate.js";

const LIVE_STATUSES = ["registered", "checked_in"];

function eventView(row, extra) {
  return Object.assign({
    id: row.id,
    communityId: row.community_id,
    organizerId: row.organizer_id,
    title: row.title,
    sport: row.sport,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timeZone: row.time_zone,
    venueName: row.venue_name,
    venueArea: row.venue_area,
    lat: row.area_lat,
    lon: row.area_lon,
    capacity: row.capacity,
    registrationDeadline: row.registration_deadline,
    costMinor: row.cost_minor,
    currency: row.currency,
    visibility: row.visibility,
    status: row.status,
    rules: row.rules,
    cancellationPolicy: row.cancellation_policy,
    contact: row.contact,
    createdAt: row.created_at
  }, extra || {});
}

async function seatCounts(db, eventId) {
  const rows = await db.all(
    "SELECT status, COUNT(*) AS n FROM event_registrations WHERE event_id = ? GROUP BY status",
    eventId
  );
  const counts = { registered: 0, waitlist: 0, cancelled: 0, checked_in: 0 };
  rows.forEach(function (r) { counts[r.status] = Number(r.n); });
  counts.seatsTaken = counts.registered + counts.checked_in;
  return counts;
}

async function myRegistration(db, eventId, userId) {
  if (!userId) return null;
  const row = await db.get(
    "SELECT status, position, created_at FROM event_registrations WHERE event_id = ? AND user_id = ?",
    eventId, userId
  );
  return row || null;
}

async function visibleEvent(db, id, user) {
  const row = await db.get("SELECT * FROM events WHERE id = ?", id);
  if (!row) throw notFound("Event");
  if (row.visibility === "public" && row.status !== "draft") return row;
  if (user) {
    if (row.organizer_id === user.id) return row;
    if (row.community_id) {
      const m = await getMembership(db, row.community_id, user.id);
      if (m && m.status === "active") return row;
    }
  }
  throw notFound("Event");
}

const routes = [
  {
    method: "GET",
    path: "/api/events",
    handler: async function (ctx) {
      const page = pageParams(ctx.query, { defaultLimit: 20, maxLimit: 50 });
      const where = ["status = 'published'"];
      const args = [];
      const scope = str({ scope: ctx.query.get("scope") }, "scope", { oneOf: ["public", "community"], default: "public" });
      if (scope === "community") {
        if (!ctx.user) return json({ items: [], limit: page.limit, offset: page.offset, hasMore: false });
        where.push("community_id IN (SELECT community_id FROM community_members WHERE user_id = ? AND status = 'active')");
        args.push(ctx.user.id);
      } else {
        where.push("visibility = 'public'");
      }
      const sport = cleanText(ctx.query.get("sport") || "", 40);
      const city = cleanText(ctx.query.get("city") || "", 80);
      const from = instant({ from: ctx.query.get("from") }, "from");
      const to = instant({ to: ctx.query.get("to") }, "to");
      if (sport) { where.push("sport = ?"); args.push(sport); }
      if (city) { where.push("venue_area LIKE ?"); args.push("%" + city + "%"); }
      if (from) { where.push("starts_at >= ?"); args.push(from); }
      if (to) { where.push("starts_at <= ?"); args.push(to); }
      const rows = await ctx.db.all(
        "SELECT * FROM events WHERE " + where.join(" AND ") + " ORDER BY starts_at LIMIT ? OFFSET ?",
        ...args.concat([page.limit + 1, page.offset])
      );
      const hasMore = rows.length > page.limit;
      const items = [];
      for (const row of rows.slice(0, page.limit)) {
        const counts = await seatCounts(ctx.db, row.id);
        items.push(eventView(row, {
          seatsTaken: counts.seatsTaken,
          waitlistCount: counts.waitlist,
          myStatus: (await myRegistration(ctx.db, row.id, ctx.user && ctx.user.id) || {}).status || null
        }));
      }
      return json({ items: items, limit: page.limit, offset: page.offset, hasMore: hasMore });
    }
  },

  {
    method: "POST",
    path: "/api/events",
    auth: true,
    handler: async function (ctx) {
      await rateLimit(ctx.db, {
        key: userKey(ctx, "event.create"), limit: 10, windowSec: 86400, now: ctx.nowMs,
        action: "event creations"
      });
      const body = ctx.body;
      const title = cleanText(str(body, "title", { required: true, min: 3, max: 120 }), 120);
      const sport = cleanText(str(body, "sport", { required: true, max: 40 }), 40);
      const description = cleanText(str(body, "description", { max: 4000 }) || "", 4000);
      const startsAt = instant(body, "startsAt", { required: true });
      const endsAt = instant(body, "endsAt");
      const timeZone = cleanText(str(body, "timeZone", { required: true, max: 60 }), 60);
      const venueName = cleanText(str(body, "venueName", { max: 120 }) || "", 120);
      const venueArea = cleanText(str(body, "venueArea", { max: 160 }) || "", 160);
      const capacity = int(body, "capacity", { min: 1, max: 100000 });
      const deadline = instant(body, "registrationDeadline");
      const costMinor = int(body, "costMinor", { min: 0, max: 100000000, default: 0 });
      const currency = cleanText(str(body, "currency", { max: 3, default: "MXN" }) || "MXN", 3).toUpperCase();
      const visibility = str(body, "visibility", { oneOf: ["public", "community", "private"], default: "public" });
      const rules = cleanText(str(body, "rules", { max: 2000 }) || "", 2000);
      const cancellationPolicy = cleanText(str(body, "cancellationPolicy", { max: 2000 }) || "", 2000);
      const contact = cleanText(str(body, "contact", { max: 200 }) || "", 200);
      let communityId = cleanText(str(body, "communityId", { max: 80 }) || "", 80) || null;

      if (endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
        throw badRequest("invalid_endsAt", "endsAt cannot be before startsAt.");
      }
      if (deadline && Date.parse(deadline) > Date.parse(startsAt)) {
        throw badRequest("invalid_registrationDeadline", "The registration deadline cannot be after the start time.");
      }
      if (costMinor > 0) {
        // Paid registration needs a verified payment path; that is not built yet,
        // so a priced event cannot be published rather than pretending to charge.
        throw badRequest("payments_not_configured",
          "Paid events are not available yet: no payment provider is configured on this server. Publish the event free, or wait for the payment integration.");
      }
      if (visibility === "community" && !communityId) {
        throw badRequest("invalid_visibility", "A community-only event must belong to a community.");
      }
      if (communityId) {
        const community = await getCommunity(ctx.db, communityId);
        const membership = await getMembership(ctx.db, community.id, ctx.user.id);
        if (!membership || membership.status !== "active" || !isAdminRole(membership.role)) {
          throw forbidden("Only community admins can organize events for a community.");
        }
        communityId = community.id;
      }

      const id = ctx.newId("evt");
      const at = ctx.nowIso();
      await ctx.db.run(
        "INSERT INTO events (id, community_id, organizer_id, title, sport, description, starts_at, ends_at, time_zone, " +
        "venue_name, venue_area, capacity, registration_deadline, cost_minor, currency, visibility, status, rules, " +
        "cancellation_policy, contact, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)",
        id, communityId, ctx.user.id, title, sport, description, startsAt, endsAt, timeZone,
        venueName, venueArea, capacity, deadline, costMinor, currency, visibility, rules, cancellationPolicy, contact, at
      );
      if (communityId) {
        await ctx.db.run(
          "INSERT INTO community_sessions (id, community_id, event_id, created_at) VALUES (?, ?, ?, ?)",
          ctx.newId("ses"), communityId, id, at
        );
      }
      const row = await ctx.db.get("SELECT * FROM events WHERE id = ?", id);
      return json(eventView(row, { seatsTaken: 0, waitlistCount: 0, myStatus: null }), 201);
    }
  },

  {
    method: "GET",
    path: "/api/events/:id",
    handler: async function (ctx) {
      const row = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      const counts = await seatCounts(ctx.db, row.id);
      const likes = await ctx.db.get(
        "SELECT COUNT(*) AS n FROM event_registrations WHERE event_id = ?", row.id
      );
      return json(eventView(row, {
        seatsTaken: counts.seatsTaken,
        seatsRemaining: row.capacity === null ? null : Math.max(row.capacity - counts.seatsTaken, 0),
        waitlistCount: counts.waitlist,
        totalRegistrations: likes ? Number(likes.n) : 0,
        myStatus: (await myRegistration(ctx.db, row.id, ctx.user && ctx.user.id) || {}).status || null,
        isOrganizer: !!ctx.user && row.organizer_id === ctx.user.id
      }));
    }
  },

  {
    method: "POST",
    path: "/api/events/:id/register",
    auth: true,
    handler: async function (ctx) {
      const event = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      if (event.status !== "published") throw conflict("event_not_open", "This event is not open for registration.");
      // Start time first: once an event has begun, "it already started" is the
      // honest reason, even though the deadline has also passed by then.
      if (ctx.nowMs > Date.parse(event.starts_at)) {
        throw conflict("event_started", "This event has already started.");
      }
      if (event.registration_deadline && ctx.nowMs > Date.parse(event.registration_deadline)) {
        throw conflict("registration_closed", "Registration for this event has closed.");
      }
      await rateLimit(ctx.db, {
        key: userKey(ctx, "event.register"), limit: 60, windowSec: 3600, now: ctx.nowMs,
        action: "registrations"
      });

      const existing = await ctx.db.get(
        "SELECT status FROM event_registrations WHERE event_id = ? AND user_id = ?",
        event.id, ctx.user.id
      );
      if (existing && existing.status !== "cancelled") {
        // Duplicate registration is a no-op, never a second seat.
        return json({ status: existing.status, changed: false, waitlistCount: (await seatCounts(ctx.db, event.id)).waitlist });
      }

      const id = ctx.newId("reg");
      const at = ctx.nowIso();
      // Atomic seat claim: inserts only while a seat is still free.
      const claim = await ctx.db.run(
        "INSERT INTO event_registrations (id, event_id, user_id, status, position, created_at, updated_at) " +
        "SELECT ?, ?, ?, 'registered', NULL, ?, ? " +
        "WHERE (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = ? AND r.status IN ('registered', 'checked_in')) " +
        "      < COALESCE((SELECT capacity FROM events WHERE id = ?), 9223372036854775807) " +
        "ON CONFLICT(event_id, user_id) DO UPDATE SET status = 'registered', position = NULL, updated_at = excluded.updated_at",
        id, event.id, ctx.user.id, at, at, event.id, event.id
      );

      if (claim.changes === 0) {
        // Full: join the waitlist with a server-assigned position.
        const next = await ctx.db.get(
          "SELECT COALESCE(MAX(position), 0) + 1 AS p FROM event_registrations WHERE event_id = ? AND status = 'waitlist'",
          event.id
        );
        const position = next ? Number(next.p) : 1;
        await ctx.db.run(
          "INSERT INTO event_registrations (id, event_id, user_id, status, position, created_at, updated_at) " +
          "VALUES (?, ?, ?, 'waitlist', ?, ?, ?) " +
          "ON CONFLICT(event_id, user_id) DO UPDATE SET status = 'waitlist', position = excluded.position, updated_at = excluded.updated_at",
          id, event.id, ctx.user.id, position, at, at
        );
        await notify(ctx.db, ctx.user.id, "event.waitlisted",
          "Waitlisted for " + event.title, "Position " + position + ". We'll tell you if a seat opens.",
          { eventId: event.id, position: position }, at);
        return json({ status: "waitlist", position: position, changed: true }, 201);
      }

      await notify(ctx.db, ctx.user.id, "event.registered",
        "You're registered for " + event.title, "", { eventId: event.id }, at);
      return json({ status: "registered", changed: true }, 201);
    }
  },

  {
    method: "POST",
    path: "/api/events/:id/cancel-registration",
    auth: true,
    handler: async function (ctx) {
      const event = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      const existing = await ctx.db.get(
        "SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?", event.id, ctx.user.id
      );
      if (!existing || existing.status === "cancelled") {
        return json({ status: "not_registered", changed: false });
      }
      const at = ctx.nowIso();
      await ctx.db.run(
        "UPDATE event_registrations SET status = 'cancelled', position = NULL, updated_at = ? WHERE id = ?",
        at, existing.id
      );
      const promotion = await promoteFromWaitlist(ctx, event, at);
      await writeAudit(ctx, "registration.cancel", "event", event.id, "");
      return json({ status: "cancelled", changed: true, promoted: promotion });
    }
  },

  {
    method: "GET",
    path: "/api/events/:id/registrations",
    auth: true,
    handler: async function (ctx) {
      const event = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      await requireEventOrganizer(ctx.db, event, ctx.user);
      const page = pageParams(ctx.query, { defaultLimit: 50, maxLimit: 200 });
      const rows = await ctx.db.all(
        "SELECT r.user_id, r.status, r.position, r.created_at, p.display_name FROM event_registrations r " +
        "LEFT JOIN profiles p ON p.user_id = r.user_id " +
        "WHERE r.event_id = ? AND r.status IN ('registered', 'waitlist', 'checked_in') " +
        "ORDER BY r.status, r.position, r.created_at LIMIT ? OFFSET ?",
        event.id, page.limit, page.offset
      );
      // Attendee lists show the display name only — never contact details,
      // location or other profile data.
      return json({
        items: rows.map(function (r) {
          return { userId: r.user_id, displayName: r.display_name || "", status: r.status, position: r.position, registeredAt: r.created_at };
        }),
        limit: page.limit, offset: page.offset
      });
    }
  },

  {
    method: "POST",
    path: "/api/events/:id/check-in",
    auth: true,
    handler: async function (ctx) {
      const event = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      await requireEventOrganizer(ctx.db, event, ctx.user);
      const userId = cleanText(str(ctx.body, "userId", { required: true, max: 80 }), 80);
      const row = await ctx.db.get(
        "SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?", event.id, userId
      );
      if (!row || LIVE_STATUSES.indexOf(row.status) < 0) throw notFound("Registration");
      await ctx.db.run(
        "UPDATE event_registrations SET status = 'checked_in', updated_at = ? WHERE id = ?", ctx.nowIso(), row.id
      );
      return json({ userId: userId, status: "checked_in" });
    }
  },

  {
    method: "POST",
    path: "/api/events/:id/cancel",
    auth: true,
    handler: async function (ctx) {
      const event = await visibleEvent(ctx.db, ctx.params.id, ctx.user);
      await requireEventOrganizer(ctx.db, event, ctx.user);
      if (event.status === "cancelled") return json({ status: "cancelled", changed: false });
      const at = ctx.nowIso();
      await ctx.db.run("UPDATE events SET status = 'cancelled' WHERE id = ?", event.id);
      await writeAudit(ctx, "event.cancel", "event", event.id, cleanText(str(ctx.body, "reason", { max: 300 }) || "", 300));
      const rows = await ctx.db.all(
        "SELECT user_id FROM event_registrations WHERE event_id = ? AND status IN ('registered', 'waitlist', 'checked_in')",
        event.id
      );
      for (const r of rows) {
        await notify(ctx.db, r.user_id, "event.cancelled", "Cancelled: " + event.title, "", { eventId: event.id }, at);
      }
      return json({ status: "cancelled", changed: true, notified: rows.length });
    }
  }
];

/** First waitlisted athlete takes a freed seat; everyone behind keeps their order. */
async function promoteFromWaitlist(ctx, event, at) {
  if (event.capacity === null) return null;
  const counts = await seatCounts(ctx.db, event.id);
  if (counts.seatsTaken >= event.capacity) return null;
  const next = await ctx.db.get(
    "SELECT * FROM event_registrations WHERE event_id = ? AND status = 'waitlist' ORDER BY position LIMIT 1",
    event.id
  );
  if (!next) return null;
  await ctx.db.run(
    "UPDATE event_registrations SET status = 'registered', position = NULL, updated_at = ? WHERE id = ?",
    at, next.id
  );
  await notify(ctx.db, next.user_id, "event.promoted",
    "A seat opened for " + event.title, "You are registered — the waitlist moved you up.", { eventId: event.id }, at);
  return next.user_id;
}

async function writeAudit(ctx, action, targetType, targetId, reason) {
  await ctx.db.run(
    "INSERT INTO moderation_actions (id, actor_id, action, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ctx.newId("mod"), ctx.user.id, action, targetType, targetId, reason || "", ctx.nowIso()
  );
}

export default { routes: routes };
export { eventView, seatCounts };
