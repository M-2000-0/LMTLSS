/* Athlete identity — one account, one profile.
 *
 * The same row serves an athlete and (later) the same person as a coach: there
 * is no second identity to keep in sync. Visibility is per element and defaults
 * to private, so nothing an athlete has not chosen to publish is returned on a
 * public profile.
 */

import {
  badRequest, bool, cleanText, forbidden, json, notFound, pageParams, str
} from "../http.js";
import { requireUser } from "../auth.js";
import { getCommunity } from "../access.js";
import { rateLimit, userKey } from "../rate.js";

const SPORT_VISIBILITIES = ["private", "community", "public"];

async function loadProfile(db, userId) {
  const row = await db.get("SELECT * FROM profiles WHERE user_id = ?", userId);
  if (!row) throw notFound("Profile");
  return row;
}

function profileView(row, sports, extra) {
  return Object.assign({
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    city: row.city,
    areaLabel: row.area_label,
    experience: row.experience,
    avatarUrl: row.avatar_url,
    publicWorkouts: !!row.public_workouts,
    showCommunities: !!row.show_communities,
    showEvents: !!row.show_events,
    sports: sports || []
  }, extra || {});
}

const routes = [
  {
    method: "GET",
    path: "/api/me",
    auth: true,
    handler: async function (ctx) {
      const profile = await loadProfile(ctx.db, ctx.user.id);
      const sports = await ctx.db.all(
        "SELECT sport, level, visibility FROM athlete_sports WHERE user_id = ? ORDER BY sport", ctx.user.id
      );
      const counts = await ctx.db.get(
        "SELECT (SELECT COUNT(*) FROM community_members WHERE user_id = ? AND status = 'active') AS communities, " +
        "(SELECT COUNT(*) FROM event_registrations WHERE user_id = ? AND status IN ('registered', 'waitlist', 'checked_in')) AS events",
        ctx.user.id, ctx.user.id
      );
      const sub = await ctx.db.get(
        "SELECT product, status, current_period_end FROM subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
        ctx.user.id
      );
      return json(profileView(profile, sports.map(function (s) {
        return { sport: s.sport, level: s.level, visibility: s.visibility };
      }), {
        platformRole: ctx.user.role,
        unreadNotifications: await unreadCount(ctx.db, ctx.user.id),
        counts: counts ? { communities: Number(counts.communities), events: Number(counts.events) } : { communities: 0, events: 0 },
        // Entitlement is server-confirmed state, never a client flag.
        entitlement: sub ? {
          product: sub.product,
          active: sub.status === "active" || sub.status === "trialing",
          status: sub.status,
          currentPeriodEnd: sub.current_period_end
        } : null
      }));
    }
  },

  {
    method: "PATCH",
    path: "/api/me",
    auth: true,
    handler: async function (ctx) {
      const body = ctx.body;
      const displayName = cleanText(str(body, "displayName", { max: 80 }) || "", 80);
      const bio = cleanText(str(body, "bio", { max: 600 }) || "", 600);
      const city = cleanText(str(body, "city", { max: 80 }) || "", 80);
      const areaLabel = cleanText(str(body, "areaLabel", { max: 120 }) || "", 120);
      const experience = cleanText(str(body, "experience", { max: 40 }) || "", 40) || null;
      const avatarUrl = cleanText(str(body, "avatarUrl", { max: 400 }) || "", 400);
      const publicWorkouts = bool(body, "publicWorkouts", false);
      const showCommunities = bool(body, "showCommunities", false);
      const showEvents = bool(body, "showEvents", false);
      await ctx.db.run(
        "UPDATE profiles SET display_name = ?, bio = ?, city = ?, area_label = ?, experience = ?, avatar_url = ?, " +
        "public_workouts = ?, show_communities = ?, show_events = ?, updated_at = ? WHERE user_id = ?",
        displayName, bio, city, areaLabel, experience, avatarUrl,
        publicWorkouts ? 1 : 0, showCommunities ? 1 : 0, showEvents ? 1 : 0, ctx.nowIso(), ctx.user.id
      );
      const row = await loadProfile(ctx.db, ctx.user.id);
      return json(profileView(row, []));
    }
  },

  {
    method: "POST",
    path: "/api/me/sports",
    auth: true,
    handler: async function (ctx) {
      const sport = cleanText(str(ctx.body, "sport", { required: true, max: 40 }), 40);
      const level = cleanText(str(ctx.body, "level", { max: 40 }) || "", 40) || null;
      const visibility = str(ctx.body, "visibility", { oneOf: SPORT_VISIBILITIES, default: "private" });
      const max = await ctx.db.get("SELECT COUNT(*) AS n FROM athlete_sports WHERE user_id = ?", ctx.user.id);
      if (max && Number(max.n) >= 20 && !(await ctx.db.get("SELECT 1 AS x FROM athlete_sports WHERE user_id = ? AND sport = ?", ctx.user.id, sport))) {
        throw badRequest("too_many_sports", "A profile can list up to 20 sports.");
      }
      await ctx.db.run(
        "INSERT INTO athlete_sports (user_id, sport, level, visibility) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(user_id, sport) DO UPDATE SET level = excluded.level, visibility = excluded.visibility",
        ctx.user.id, sport, level, visibility
      );
      return json({ sport: sport, level: level, visibility: visibility }, 201);
    }
  },

  {
    method: "DELETE",
    path: "/api/me/sports/:sport",
    auth: true,
    handler: async function (ctx) {
      await ctx.db.run("DELETE FROM athlete_sports WHERE user_id = ? AND sport = ?", ctx.user.id, ctx.params.sport);
      return json({ sport: ctx.params.sport, removed: true });
    }
  },

  {
    method: "GET",
    path: "/api/athletes/:id",
    handler: async function (ctx) {
      const row = await ctx.db.get("SELECT * FROM profiles WHERE user_id = ?", ctx.params.id);
      if (!row) throw notFound("Athlete");
      const isSelf = !!ctx.user && ctx.user.id === row.user_id;
      const sports = await ctx.db.all(
        "SELECT sport, level, visibility FROM athlete_sports WHERE user_id = ? ORDER BY sport", row.user_id
      );
      const visible = sports
        .filter(function (s) { return isSelf || s.visibility === "public" || s.visibility === "community"; })
        .map(function (s) { return { sport: s.sport, level: s.level, visibility: s.visibility }; });
      const extra = { isSelf: isSelf };
      if (isSelf || row.show_communities) {
        extra.communities = (await ctx.db.all(
          "SELECT c.id, c.name, c.sport FROM community_members m JOIN communities c ON c.id = m.community_id " +
          "WHERE m.user_id = ? AND m.status = 'active' AND c.visibility = 'public' AND c.archived_at IS NULL LIMIT 20",
          row.user_id
        )).map(function (c) { return { id: c.id, name: c.name, sport: c.sport }; });
      }
      if (isSelf || row.show_events) {
        extra.upcomingEvents = (await ctx.db.all(
          "SELECT e.id, e.title, e.starts_at FROM event_registrations r JOIN events e ON e.id = r.event_id " +
          "WHERE r.user_id = ? AND r.status IN ('registered', 'checked_in') AND e.status = 'published' " +
          "AND e.visibility = 'public' ORDER BY e.starts_at LIMIT 20",
          row.user_id
        )).map(function (e) { return { id: e.id, title: e.title, startsAt: e.starts_at }; });
      }
      const coach = await ctx.db.get("SELECT status FROM coaches WHERE user_id = ?", row.user_id);
      extra.isCoach = !!(coach && coach.status === "published");
      // A public profile never exposes email, exact location or workout data.
      return json(profileView(row, visible, extra));
    }
  },

  {
    method: "GET",
    path: "/api/athletes/:id/workouts",
    handler: async function (ctx) {
      const row = await ctx.db.get("SELECT * FROM profiles WHERE user_id = ?", ctx.params.id);
      if (!row) throw notFound("Athlete");
      const isSelf = !!ctx.user && ctx.user.id === row.user_id;
      if (!isSelf && !row.public_workouts) return json({ items: [] });
      const page = pageParams(ctx.query, { defaultLimit: 20, maxLimit: 50 });
      const rows = await ctx.db.all(
        "SELECT id, sport, title, started_at, duration_sec, distance_m, metrics_json FROM activities " +
        "WHERE user_id = ? AND visibility IN ('community', 'public') ORDER BY started_at DESC LIMIT ? OFFSET ?",
        row.user_id, page.limit, page.offset
      );
      return json({
        items: rows.map(function (a) {
          return {
            id: a.id, sport: a.sport, title: a.title, startedAt: a.started_at,
            durationSec: a.duration_sec, distanceM: a.distance_m,
            metrics: JSON.parse(a.metrics_json || "{}")
          };
        }),
        limit: page.limit, offset: page.offset
      });
    }
  },

  {
    method: "GET",
    path: "/api/notifications",
    auth: true,
    handler: async function (ctx) {
      const page = pageParams(ctx.query, { defaultLimit: 20, maxLimit: 50 });
      const rows = await ctx.db.all(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        ctx.user.id, page.limit, page.offset
      );
      return json({
        items: rows.map(function (n) {
          return { id: n.id, kind: n.kind, title: n.title, body: n.body, data: JSON.parse(n.data_json || "{}"), createdAt: n.created_at, readAt: n.read_at };
        }),
        unread: await unreadCount(ctx.db, ctx.user.id),
        limit: page.limit, offset: page.offset
      });
    }
  },

  {
    method: "POST",
    path: "/api/notifications/read",
    auth: true,
    handler: async function (ctx) {
      const id = cleanText(str(ctx.body, "id", { max: 80 }) || "", 80);
      if (id) {
        await ctx.db.run("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?", ctx.nowIso(), id, ctx.user.id);
      } else {
        await ctx.db.run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", ctx.nowIso(), ctx.user.id);
      }
      return json({ unread: await unreadCount(ctx.db, ctx.user.id) });
    }
  },

  {
    method: "GET",
    path: "/api/me/export",
    auth: true,
    handler: async function (ctx) {
      // Data export: everything this account owns, in one JSON document.
      const userId = ctx.user.id;
      const [profile, sports, memberships, registrations, activities, notifications] = await Promise.all([
        ctx.db.get("SELECT * FROM profiles WHERE user_id = ?", userId),
        ctx.db.all("SELECT sport, level, visibility FROM athlete_sports WHERE user_id = ?", userId),
        ctx.db.all("SELECT community_id, role, status, joined_at FROM community_members WHERE user_id = ?", userId),
        ctx.db.all("SELECT event_id, status, position, created_at FROM event_registrations WHERE user_id = ?", userId),
        ctx.db.all("SELECT id, sport, title, started_at, duration_sec, distance_m, metrics_json, visibility FROM activities WHERE user_id = ?", userId),
        ctx.db.all("SELECT id, kind, title, body, created_at, read_at FROM notifications WHERE user_id = ?", userId)
      ]);
      return json({
        exportedAt: ctx.nowIso(),
        account: { id: userId, createdVia: "auth" },
        profile: profile ? profileView(profile, []) : null,
        sports: sports,
        communities: memberships,
        eventRegistrations: registrations,
        activities: activities.map(function (a) { return Object.assign({}, a, { metrics: JSON.parse(a.metrics_json || "{}") }); }),
        notifications: notifications
      });
    }
  },

  {
    method: "DELETE",
    path: "/api/me",
    auth: true,
    handler: async function (ctx) {
      // Destructive and irreversible: an explicit confirmation string is required
      // in the body, never a bare DELETE from a stray fetch.
      const confirm = str(ctx.body, "confirm", { required: true, max: 20 });
      if (confirm !== "delete") throw badRequest("confirmation_required", 'Send { "confirm": "delete" } to delete the account.');
      await rateLimit(ctx.db, {
        key: userKey(ctx, "account.delete"), limit: 3, windowSec: 3600, now: ctx.nowMs, action: "deletion attempts"
      });
      const userId = ctx.user.id;
      const owned = await ctx.db.get(
        "SELECT COUNT(*) AS n FROM communities c WHERE c.created_by = ? AND c.archived_at IS NULL AND " +
        "(SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id AND m.role = 'owner' AND m.status = 'active' AND m.user_id <> c.created_by) = 0",
        userId
      );
      if (owned && Number(owned.n) > 0) {
        throw forbidden("Transfer or archive the communities you own before deleting your account.");
      }
      const at = ctx.nowIso();
      await ctx.db.batch([
        { sql: "DELETE FROM location_shares WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM location_prefs WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM athlete_sports WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM notifications WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM carts WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM sessions WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM auth_identities WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM consents WHERE user_id = ?", params: [userId] },
        { sql: "DELETE FROM email_codes WHERE email = ?", params: [ctx.user.email || ""] },
        { sql: "UPDATE community_members SET status = 'banned' WHERE user_id = ?", params: [userId] },
        { sql: "UPDATE profiles SET display_name = '', bio = '', city = '', area_label = '', avatar_url = '', " +
               "public_workouts = 0, show_communities = 0, show_events = 0, updated_at = ? WHERE user_id = ?", params: [at, userId] },
        { sql: "UPDATE activities SET visibility = 'private', notes = '' WHERE user_id = ?", params: [userId] },
        { sql: "UPDATE users SET deleted_at = ?, email = NULL, password_hash = NULL WHERE id = ?", params: [at, userId] }
      ]);
      return json({ deleted: true, deletedAt: at });
    }
  },

  {
    method: "GET",
    path: "/api/communities/:id/events",
    handler: async function (ctx) {
      const community = await getCommunity(ctx.db, ctx.params.id);
      if (community.visibility !== "public") {
        const m = ctx.user ? await ctx.db.get(
          "SELECT status FROM community_members WHERE community_id = ? AND user_id = ?", community.id, ctx.user.id
        ) : null;
        if (!m || m.status !== "active") throw notFound("Community");
      }
      const rows = await ctx.db.all(
        "SELECT * FROM events WHERE community_id = ? AND status = 'published' ORDER BY starts_at LIMIT 50",
        community.id
      );
      return json({
        items: rows.map(function (e) {
          return {
            id: e.id, title: e.title, sport: e.sport, startsAt: e.starts_at, venueName: e.venue_name,
            venueArea: e.venue_area, capacity: e.capacity, visibility: e.visibility, costMinor: e.cost_minor
          };
        })
      });
    }
  },

  {
    method: "GET",
    path: "/api/health",
    handler: async function (ctx) {
      // Safe, non-revealing readiness probe: names no provider, returns no config.
      const row = await ctx.db.get("SELECT COUNT(*) AS n FROM schema_migrations");
      return json({
        ok: true,
        schemaMigrations: row ? Number(row.n) : 0,
        time: ctx.nowIso()
      });
    }
  }
];

async function unreadCount(db, userId) {
  const row = await db.get("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL", userId);
  return row ? Number(row.n) : 0;
}

export default { routes: routes };
