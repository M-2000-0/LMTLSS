/* Authorization helpers — every route body goes through these.
 *
 * The rule this file enforces: a membership row is the only thing that grants
 * access to a community's private data. Client-supplied ids and roles are never
 * trusted; the role always comes from the database row.
 */

import { forbidden, notFound, conflict } from "./http.js";

export async function getCommunity(db, id) {
  const row = await db.get(
    "SELECT * FROM communities WHERE id = ? OR slug = ?", id, id
  );
  if (!row || row.archived_at) throw notFound("Community");
  return row;
}

export async function getMembership(db, communityId, userId) {
  if (!userId) return null;
  return await db.get(
    "SELECT * FROM community_members WHERE community_id = ? AND user_id = ?",
    communityId, userId
  );
}

export function isAdminRole(role) {
  return role === "owner" || role === "admin";
}

/** Membership required (active, not pending/banned). */
export async function requireActiveMember(db, communityId, user) {
  if (!user) throw forbidden("Join this community to see its content.");
  const m = await getMembership(db, communityId, user.id);
  if (!m || m.status !== "active") throw forbidden("Join this community to see its content.");
  return m;
}

/** Admin/owner required. */
export async function requireCommunityAdmin(db, communityId, user) {
  const m = await requireActiveMember(db, communityId, user);
  if (!isAdminRole(m.role)) throw forbidden("Only community admins can do that.");
  return m;
}

/** True when the viewer may read community content (posts, member list). */
export async function canReadCommunityContent(db, community, userId) {
  if (community.visibility === "public" && community.join_policy === "open") {
    // Public + open: everyone can read the feed. The member LIST stays
    // members-only (see routes/communities.js), because a public feed should
    // not become a directory of people.
    return true;
  }
  if (!userId) return false;
  const m = await getMembership(db, community.id, userId);
  return !!m && m.status === "active";
}

/** Announcement rights are a moderator tool, not a member tool. */
export function requireAnnouncementRights(membership) {
  if (!membership || !isAdminRole(membership.role)) {
    throw forbidden("Only community admins can post announcements.");
  }
}

export async function requireEventOrganizer(db, event, user) {
  if (!user) throw forbidden("Only the organizer can manage this event.");
  if (event.organizer_id === user.id) return true;
  if (event.community_id) {
    const m = await getMembership(db, event.community_id, user.id);
    if (m && m.status === "active" && isAdminRole(m.role)) return true;
  }
  throw forbidden("Only the organizer can manage this event.");
}

/** Guard against a user creating a community they would not be able to join. */
export function uniqueError(constraintText, code, message) {
  const err = conflict(code, message);
  err.cause = constraintText;
  return err;
}

export async function notify(db, userId, kind, title, body, data, now) {
  if (!userId) return;
  await db.run(
    "INSERT INTO notifications (id, user_id, kind, title, body, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    "ntf_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20),
    userId, kind, title, body || "", JSON.stringify(data || {}), now
  );
}
