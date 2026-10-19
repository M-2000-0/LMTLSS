/* LIMITLESS CLUBS — communities, membership, posts, moderation.
 *
 * Free by design: nothing here is behind a subscription. Visibility rules:
 *   public + open   → anyone reads the feed; anyone can join instantly.
 *   public + approval → feed readable; joining creates a pending request.
 *   private         → nothing is readable or joinable without an approved
 *                     membership; the community does not appear in discovery.
 * The member list is members-only in every case, and `REPORTS` is open to any
 * signed-in athlete.
 */

import {
  badRequest, cleanText, conflict, forbidden, int, json, newId, notFound,
  pageParams, str
} from "../http.js";
import {
  canReadCommunityContent, getCommunity, getMembership, isAdminRole, notify,
  requireActiveMember, requireAnnouncementRights, requireCommunityAdmin
} from "../access.js";
import { rateLimit, userKey } from "../rate.js";

function communityView(row, extra) {
  return Object.assign({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sport: row.sport,
    city: row.city,
    areaLabel: row.area_label,
    lat: row.lat,
    lon: row.lon,
    visibility: row.visibility,
    joinPolicy: row.join_policy,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    createdAt: row.created_at
  }, extra || {});
}

function memberView(row) {
  return {
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    displayName: row.display_name || "",
    city: row.city || ""
  };
}

async function memberCount(db, communityId) {
  const row = await db.get(
    "SELECT COUNT(*) AS n FROM community_members WHERE community_id = ? AND status = 'active'",
    communityId
  );
  return row ? Number(row.n) : 0;
}

async function slugTaken(db, slug) {
  const row = await db.get("SELECT id FROM communities WHERE slug = ?", slug);
  return !!row;
}

const routes = [
  {
    method: "GET",
    path: "/api/communities",
    handler: async function (ctx) {
      const q = ctx.query;
      const page = pageParams(q, { defaultLimit: 20, maxLimit: 50 });
      const where = ["archived_at IS NULL", "visibility = 'public'"];
      const args = [];
      const sport = str({ sport: q.get("sport") }, "sport", { max: 40 });
      const city = str({ city: q.get("city") }, "city", { max: 80 });
      const text = str({ q: q.get("q") }, "q", { max: 60 });
      if (sport) { where.push("sport = ?"); args.push(sport); }
      if (city) { where.push("city = ?"); args.push(city); }
      if (text) { where.push("(name LIKE ? OR description LIKE ?)"); args.push("%" + text + "%", "%" + text + "%"); }
      const rows = await ctx.db.all(
        "SELECT * FROM communities WHERE " + where.join(" AND ") +
        " ORDER BY created_at DESC LIMIT ? OFFSET ?",
        ...args.concat([page.limit + 1, page.offset])
      );
      const hasMore = rows.length > page.limit;
      const pageRows = rows.slice(0, page.limit);
      const items = [];
      for (const row of pageRows) {
        items.push(communityView(row, {
          memberCount: await memberCount(ctx.db, row.id),
          membership: await membershipState(ctx.db, row.id, ctx.user)
        }));
      }
      return json({ items: items, limit: page.limit, offset: page.offset, hasMore: hasMore });
    }
  },

  {
    method: "POST",
    path: "/api/communities",
    auth: true,
    handler: async function (ctx) {
      const user = ctx.user;
      await rateLimit(ctx.db, {
        key: userKey(ctx, "community.create"), limit: 3, windowSec: 86400, now: ctx.nowMs,
        action: "community creations"
      });
      const body = ctx.body;
      const name = cleanText(str(body, "name", { required: true, min: 3, max: 60 }), 60);
      const sport = cleanText(str(body, "sport", { required: true, max: 40 }), 40);
      const description = cleanText(str(body, "description", { max: 600 }) || "", 600);
      const city = cleanText(str(body, "city", { max: 80 }) || "", 80);
      const areaLabel = cleanText(str(body, "areaLabel", { max: 120 }) || "", 120);
      const visibility = str(body, "visibility", { oneOf: ["public", "private"], default: "public" });
      const joinPolicy = str(body, "joinPolicy", { oneOf: ["open", "approval"], default: "open" });
      if (visibility === "private" && joinPolicy === "open") {
        throw badRequest("invalid_joinPolicy", "A private community must use an approval join policy.");
      }

      const base = ctx.slugify(name);
      let slug = base;
      for (let i = 2; await slugTaken(ctx.db, slug); i++) {
        slug = base + "-" + i;
        if (i > 50) { slug = base + "-" + ctx.newId("x").slice(-4); break; }
      }

      const id = ctx.newId("com");
      const at = ctx.nowIso();
      await ctx.db.batch([
        {
          sql: "INSERT INTO communities (id, slug, name, description, sport, city, area_label, lat, lon, " +
               "visibility, join_policy, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          params: [id, slug, name, description, sport, city, areaLabel, null, null, visibility, joinPolicy, user.id, at]
        },
        {
          // The creator is the owner and an active member from the first moment.
          sql: "INSERT INTO community_members (community_id, user_id, role, status, joined_at) VALUES (?, ?, 'owner', 'active', ?)",
          params: [id, user.id, at]
        }
      ]);
      const row = await getCommunity(ctx.db, id);
      return json(communityView(row, { memberCount: 1, membership: { status: "active", role: "owner" } }), 201);
    }
  },

  {
    method: "GET",
    path: "/api/communities/:id",
    handler: async function (ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const membership = await getMembership(ctx.db, row.id, ctx.user && ctx.user.id);
      if (row.visibility !== "public") {
        if (!membership || (membership.status !== "active" && membership.status !== "pending")) {
          // Do not confirm the existence of a private community to outsiders.
          throw notFound("Community");
        }
      }
      const canRead = await canReadCommunityContent(ctx.db, row, ctx.user && ctx.user.id);
      return json(communityView(row, {
        memberCount: await memberCount(ctx.db, row.id),
        membership: membership ? { status: membership.status, role: membership.role } : null,
        canReadFeed: canRead,
        canPost: !!membership && membership.status === "active",
        canModerate: !!membership && membership.status === "active" && isAdminRole(membership.role)
      }));
    }
  },

  {
    method: "POST",
    path: "/api/communities/:id/join",
    auth: true,
    handler: async function (ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const existing = await getMembership(ctx.db, row.id, ctx.user.id);
      if (existing && existing.status === "banned") throw forbidden("You cannot join this community.");
      if (existing && existing.status === "active") {
        return json({ status: "active", role: existing.role, changed: false });
      }
      if (existing && existing.status === "pending") {
        return json({ status: "pending", role: existing.role, changed: false });
      }
      await rateLimit(ctx.db, {
        key: userKey(ctx, "community.join"), limit: 30, windowSec: 3600, now: ctx.nowMs,
        action: "join requests"
      });
      const needsApproval = row.join_policy === "approval";
      const status = needsApproval ? "pending" : "active";
      await ctx.db.run(
        "INSERT INTO community_members (community_id, user_id, role, status, joined_at) VALUES (?, ?, 'member', ?, ?) " +
        "ON CONFLICT(community_id, user_id) DO UPDATE SET status = excluded.status",
        row.id, ctx.user.id, status, ctx.nowIso()
      );
      if (needsApproval) {
        await notifyAdminTeam(ctx, row, ctx.user, "join_request");
      }
      return json({ status: status, role: "member", changed: true });
    }
  },

  {
    method: "POST",
    path: "/api/communities/:id/leave",
    auth: true,
    handler: async function (ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const existing = await getMembership(ctx.db, row.id, ctx.user.id);
      if (!existing) return json({ status: "none", changed: false });
      if (existing.role === "owner") {
        const others = await ctx.db.get(
          "SELECT COUNT(*) AS n FROM community_members WHERE community_id = ? AND role = 'owner' AND status = 'active'",
          row.id
        );
        if (others && Number(others.n) <= 1) {
          throw conflict("last_owner", "Transfer ownership before leaving — a community cannot be left without an owner.");
        }
      }
      await ctx.db.run("DELETE FROM community_members WHERE community_id = ? AND user_id = ?", row.id, ctx.user.id);
      return json({ status: "left", changed: true });
    }
  },

  {
    method: "GET",
    path: "/api/communities/:id/members",
    auth: true,
    handler: async function (ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      await requireActiveMember(ctx.db, row.id, ctx.user);
      const page = pageParams(ctx.query, { defaultLimit: 50, maxLimit: 100 });
      const status = str({ status: ctx.query.get("status") }, "status", { oneOf: ["active", "pending"], default: "active" });
      const rows = await ctx.db.all(
        "SELECT m.*, p.display_name, p.city FROM community_members m " +
        "LEFT JOIN profiles p ON p.user_id = m.user_id " +
        "WHERE m.community_id = ? AND m.status = ? ORDER BY m.joined_at LIMIT ? OFFSET ?",
        row.id, status, page.limit, page.offset
      );
      return json({ items: rows.map(memberView), limit: page.limit, offset: page.offset });
    }
  },

  {
    method: "POST",
    path: "/api/communities/:id/members/:userId/approve",
    auth: true,
    handler: async function (ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      await requireCommunityAdmin(ctx.db, row.id, ctx.user);
      const target = await getMembership(ctx.db, row.id, ctx.params.userId);
      if (!target) throw notFound("Join request");
      await ctx.db.run(
        "UPDATE community_members SET status = 'active' WHERE community_id = ? AND user_id = ?",
        row.id, ctx.params.userId
      );
      await writeModeration(ctx, "membership.approve", "user", ctx.params.userId, "approved join request", row.id);
      await notify(ctx.db, ctx.params.userId, "community.join.approved",
        "Your request to join " + row.name + " was approved.", "", { communityId: row.id }, ctx.nowIso());
      return json({ status: "active" });
    }
  },

  {
    method: "POST",
    path: "/api/communities/:id/members/:userId/role",
    auth: true,
    handler: async function (ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const me = await requireCommunityAdmin(ctx.db, row.id, ctx.user);
      if (me.role !== "owner") throw forbidden("Only the owner can change admin roles.");
      const role = str(ctx.body, "role", { required: true, oneOf: ["admin", "member"] });
      const target = await getMembership(ctx.db, row.id, ctx.params.userId);
      if (!target) throw notFound("Member");
      if (target.role === "owner") throw forbidden("The owner's role cannot be changed.");
      await ctx.db.run(
        "UPDATE community_members SET role = ? WHERE community_id = ? AND user_id = ?",
        role, row.id, ctx.params.userId
      );
      return json({ userId: ctx.params.userId, role: role });
    }
  },

  {
    method: "POST",
    path: "/api/communities/:id/members/:userId/ban",
    auth: true,
    handler: async function (ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const me = await requireCommunityAdmin(ctx.db, row.id, ctx.user);
      const target = await getMembership(ctx.db, row.id, ctx.params.userId);
      if (!target) throw notFound("Member");
      if (target.role === "owner") throw forbidden("The owner cannot be banned.");
      if (target.role === "admin" && me.role !== "owner") throw forbidden("Only the owner can ban an admin.");
      const reason = cleanText(str(ctx.body, "reason", { max: 300 }) || "", 300);
      await ctx.db.run(
        "UPDATE community_members SET status = 'banned' WHERE community_id = ? AND user_id = ?",
        row.id, ctx.params.userId
      );
      await writeModeration(ctx, "membership.ban", "user", ctx.params.userId, reason, row.id);
      return json({ userId: ctx.params.userId, status: "banned" });
    }
  },

  {
    method: "GET",
    path: "/api/communities/:id/posts",
    handler: async function (ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const allowed = await canReadCommunityContent(ctx.db, row, ctx.user && ctx.user.id);
      if (!allowed) throw forbidden("Join this community to read its feed.");
      const page = pageParams(ctx.query, { defaultLimit: 20, maxLimit: 50 });
      const rows = await ctx.db.all(
        "SELECT p.*, pr.display_name FROM community_posts p " +
        "LEFT JOIN profiles pr ON pr.user_id = p.author_id " +
        "WHERE p.community_id = ? AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT ? OFFSET ?",
        row.id, page.limit, page.offset
      );
      return json({
        items: rows.map(function (r) {
          return {
            id: r.id, kind: r.kind, body: r.body, authorId: r.author_id,
            authorName: r.display_name || "", createdAt: r.created_at, editedAt: r.edited_at
          };
        }),
        limit: page.limit, offset: page.offset
      });
    }
  },

  {
    method: "POST",
    path: "/api/communities/:id/posts",
    auth: true,
    handler: async function (ctx) {
      const row = await getCommunity(ctx.db, ctx.params.id);
      const membership = await requireActiveMember(ctx.db, row.id, ctx.user);
      const kind = str(ctx.body, "kind", { oneOf: ["post", "announcement"], default: "post" });
      if (kind === "announcement") requireAnnouncementRights(membership);
      const body = cleanText(str(ctx.body, "body", { required: true, min: 1, max: 4000 }), 4000);
      await rateLimit(ctx.db, {
        key: userKey(ctx, "community.post"), limit: 20, windowSec: 3600, now: ctx.nowMs,
        action: "posts"
      });
      const id = ctx.newId("pst");
      const at = ctx.nowIso();
      await ctx.db.run(
        "INSERT INTO community_posts (id, community_id, author_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        id, row.id, ctx.user.id, kind, body, at
      );
      return json({ id: id, kind: kind, body: body, authorId: ctx.user.id, createdAt: at }, 201);
    }
  },

  {
    method: "DELETE",
    path: "/api/posts/:postId",
    auth: true,
    handler: async function (ctx) {
      const post = await ctx.db.get("SELECT * FROM community_posts WHERE id = ?", ctx.params.postId);
      if (!post || post.deleted_at) throw notFound("Post");
      const membership = await getMembership(ctx.db, post.community_id, ctx.user.id);
      const isAuthor = post.author_id === ctx.user.id;
      const isModerator = !!membership && membership.status === "active" && isAdminRole(membership.role);
      if (!isAuthor && !isModerator) throw forbidden("Only the author or a community admin can delete a post.");
      await ctx.db.run(
        "UPDATE community_posts SET deleted_at = ? WHERE id = ?", ctx.nowIso(), post.id
      );
      if (!isAuthor) await writeModeration(ctx, "post.delete", "post", post.id, "moderator removal", post.community_id);
      return json({ id: post.id, deleted: true });
    }
  },

  {
    method: "GET",
    path: "/api/me/communities",
    auth: true,
    handler: async function (ctx) {
      const rows = await ctx.db.all(
        "SELECT c.*, m.role, m.status FROM community_members m JOIN communities c ON c.id = m.community_id " +
        "WHERE m.user_id = ? AND c.archived_at IS NULL ORDER BY m.joined_at DESC LIMIT 100",
        ctx.user.id
      );
      const items = [];
      for (const row of rows) {
        items.push(communityView(row, {
          memberCount: await memberCount(ctx.db, row.id),
          membership: { status: row.status, role: row.role }
        }));
      }
      return json({ items: items });
    }
  },

  {
    method: "POST",
    path: "/api/reports",
    auth: true,
    handler: async function (ctx) {
      await rateLimit(ctx.db, {
        key: userKey(ctx, "report"), limit: 10, windowSec: 3600, now: ctx.nowMs,
        action: "reports"
      });
      const targetType = str(ctx.body, "targetType", { required: true, oneOf: ["community", "post", "user", "event"] });
      const targetId = cleanText(str(ctx.body, "targetId", { required: true, max: 80 }), 80);
      const reason = cleanText(str(ctx.body, "reason", { required: true, max: 60 }), 60);
      const details = cleanText(str(ctx.body, "details", { max: 1000 }) || "", 1000);
      const id = ctx.newId("rpt");
      await ctx.db.run(
        "INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, 'open', ?)",
        id, ctx.user.id, targetType, targetId, reason, details, ctx.nowIso()
      );
      // Reports are a queue for moderators; the reporter gets no private data back.
      return json({ id: id, status: "open" }, 201);
    }
  }
];

async function membershipState(db, communityId, user) {
  if (!user) return null;
  const m = await getMembership(db, communityId, user.id);
  return m ? { status: m.status, role: m.role } : null;
}

async function notifyAdminTeam(ctx, community, requester, kind) {
  const admins = await ctx.db.all(
    "SELECT user_id FROM community_members WHERE community_id = ? AND status = 'active' AND role IN ('owner', 'admin')",
    community.id
  );
  for (const admin of admins) {
    await notify(ctx.db, admin.user_id, "community." + kind,
      "New join request in " + community.name, "", { communityId: community.id, userId: requester.id }, ctx.nowIso());
  }
}

async function writeModeration(ctx, action, targetType, targetId, reason, communityId) {
  await ctx.db.run(
    "INSERT INTO moderation_actions (id, actor_id, action, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ctx.newId("mod"), ctx.user.id, action, targetType, targetId, (reason || "") + (communityId ? " [" + communityId + "]" : ""), ctx.nowIso()
  );
}

export default { routes: routes };
export { communityView };
