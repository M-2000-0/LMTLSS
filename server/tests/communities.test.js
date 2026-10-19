/* LIMITLESS CLUBS — membership, visibility, posts, moderation.
 *
 * These tests are the permission matrix from the specification: what a
 * stranger, a pending member, a member, an admin and the owner can each do.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, call, newAthlete } from "./helper.js";

async function makeCommunity(h, athlete, overrides) {
  const res = await call(h, "POST", "/api/communities", {
    token: athlete.token,
    body: Object.assign({
      name: "Running Mexico City",
      sport: "running",
      description: "Weekend long runs around Chapultepec.",
      city: "Mexico City",
      visibility: "public",
      joinPolicy: "open"
    }, overrides || {})
  });
  return res;
}

test("creating a community makes the creator an active owner", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const created = await makeCommunity(h, ana);
  assert.equal(created.status, 201);
  assert.equal(created.body.membership.role, "owner");
  assert.equal(created.body.membership.status, "active");
  assert.equal(created.body.slug, "running-mexico-city");
  assert.equal(created.body.memberCount, 1, "creation is not fake popularity");
});

test("slug collisions get a distinct suffix", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const first = await makeCommunity(h, ana);
  const second = await makeCommunity(h, ana, { city: "Guadalajara" });
  assert.equal(first.body.slug, "running-mexico-city");
  assert.equal(second.body.slug, "running-mexico-city-2");
});

test("a private community cannot use an open join policy", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const res = await makeCommunity(h, ana, { visibility: "private", joinPolicy: "open" });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "invalid_joinPolicy");
});

test("private communities are absent from discovery and hidden from outsiders", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const open = await makeCommunity(h, ana, { name: "Open Track Club" });
  const closed = await makeCommunity(h, ana, { name: "Invite Only Crew", visibility: "private", joinPolicy: "approval" });
  const stranger = await newAthlete(h, "Stranger");

  const discovery = await call(h, "GET", "/api/communities", { token: stranger.token });
  const ids = discovery.body.items.map(function (c) { return c.id; });
  assert.deepEqual(ids, [open.body.id]);

  const hidden = await call(h, "GET", "/api/communities/" + closed.body.id, { token: stranger.token });
  assert.equal(hidden.status, 404, "a private community's detail is not readable, and its existence is not confirmed");

  // Asking to join is allowed — with approval it becomes a request, not a
  // membership, and the response reveals nothing about the community.
  const request = await call(h, "POST", "/api/communities/" + closed.body.id + "/join", { token: stranger.token });
  assert.equal(request.status, 200);
  assert.equal(request.body.status, "pending");
  const stillHidden = await call(h, "GET", "/api/communities/" + closed.body.id + "/posts", { token: stranger.token });
  assert.equal(stillHidden.status, 403, "a pending member reads nothing");
  const notInDiscovery = await call(h, "GET", "/api/communities", { token: stranger.token });
  assert.equal(notInDiscovery.body.items.length, 1, "even a pending request does not surface the community");
});

test("discovery filters by sport and city and caps the page size", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  await makeCommunity(h, ana, { name: "Boxing CDMX", sport: "boxing" });
  await makeCommunity(h, ana, { name: "Tennis CDMX", sport: "tennis" });
  await makeCommunity(h, ana, { name: "Tennis Guadalajara", sport: "tennis", city: "Guadalajara" });

  const boxing = await call(h, "GET", "/api/communities?sport=boxing");
  assert.equal(boxing.body.items.length, 1);
  const tennisCdmx = await call(h, "GET", "/api/communities?sport=tennis&city=Mexico%20City");
  assert.equal(tennisCdmx.body.items.length, 1);
  const huge = await call(h, "GET", "/api/communities?limit=1000");
  assert.equal(huge.body.limit, 50, "page size is bounded server-side");
});

test("joining a public open community is immediate; posts need membership", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await makeCommunity(h, ana);
  const luis = await newAthlete(h, "Luis");

  const before = await call(h, "POST", "/api/communities/" + community.body.id + "/posts", {
    token: luis.token, body: { body: "Can I post before joining?" }
  });
  assert.equal(before.status, 403);

  const join = await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: luis.token });
  assert.equal(join.status, 200);
  assert.equal(join.body.status, "active");
  assert.equal(join.body.changed, true);

  const again = await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: luis.token });
  assert.equal(again.body.changed, false, "joining twice changes nothing");

  const post = await call(h, "POST", "/api/communities/" + community.body.id + "/posts", {
    token: luis.token, body: { body: "Saturday long run at 7:00, 18 km." }
  });
  assert.equal(post.status, 201);
  const feed = await call(h, "GET", "/api/communities/" + community.body.id + "/posts");
  assert.equal(feed.body.items.length, 1);
  assert.equal(feed.body.items[0].body, "Saturday long run at 7:00, 18 km.");
  assert.equal(feed.body.items[0].authorName, "Luis");
});

test("announcements are an admin tool, not a member tool", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await makeCommunity(h, ana);
  const luis = await newAthlete(h, "Luis");
  await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: luis.token });

  const denied = await call(h, "POST", "/api/communities/" + community.body.id + "/posts", {
    token: luis.token, body: { kind: "announcement", body: "Everyone must…" }
  });
  assert.equal(denied.status, 403);

  const owner = await call(h, "POST", "/api/communities/" + community.body.id + "/posts", {
    token: ana.token, body: { kind: "announcement", body: "Track closed on Sunday." }
  });
  assert.equal(owner.status, 201);
  assert.equal(owner.body.kind, "announcement");
});

test("approval communities hold members as pending until an admin approves", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await makeCommunity(h, ana, { joinPolicy: "approval" });
  const luis = await newAthlete(h, "Luis");

  const join = await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: luis.token });
  assert.equal(join.body.status, "pending");

  const pendingFeed = await call(h, "GET", "/api/communities/" + community.body.id + "/posts", { token: luis.token });
  assert.equal(pendingFeed.status, 403, "a pending member reads nothing yet");

  const strangerApprove = await call(h, "POST", "/api/communities/" + community.body.id + "/members/" + luis.id + "/approve", {
    token: luis.token
  });
  assert.equal(strangerApprove.status, 403);

  const queue = await call(h, "GET", "/api/communities/" + community.body.id + "/members?status=pending", { token: ana.token });
  assert.equal(queue.body.items.length, 1);
  assert.equal(queue.body.items[0].userId, luis.id);

  const approved = await call(h, "POST", "/api/communities/" + community.body.id + "/members/" + luis.id + "/approve", {
    token: ana.token
  });
  assert.equal(approved.status, 200);
  const feed = await call(h, "GET", "/api/communities/" + community.body.id + "/posts", { token: luis.token });
  assert.equal(feed.status, 200);

  const inbox = await call(h, "GET", "/api/notifications", { token: luis.token });
  assert.ok(inbox.body.items.some(function (n) { return n.kind === "community.join.approved"; }));
});

test("the member list is members-only even in a public community", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await makeCommunity(h, ana);
  const stranger = await newAthlete(h, "Stranger");
  const denied = await call(h, "GET", "/api/communities/" + community.body.id + "/members", { token: stranger.token });
  assert.equal(denied.status, 403);
  const member = await call(h, "GET", "/api/communities/" + community.body.id + "/members", { token: ana.token });
  assert.equal(member.status, 200);
  assert.equal(member.body.items[0].displayName, "Ana");
});

test("the owner can promote an admin, who can moderate but not mint admins", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await makeCommunity(h, ana);
  const luis = await newAthlete(h, "Luis");
  const marta = await newAthlete(h, "Marta");
  for (const who of [luis, marta]) {
    await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: who.token });
  }
  const promoted = await call(h, "POST", "/api/communities/" + community.body.id + "/members/" + luis.id + "/role", {
    token: ana.token, body: { role: "admin" }
  });
  assert.equal(promoted.body.role, "admin");

  const adminPromotes = await call(h, "POST", "/api/communities/" + community.body.id + "/members/" + marta.id + "/role", {
    token: luis.token, body: { role: "admin" }
  });
  assert.equal(adminPromotes.status, 403, "only the owner changes roles");

  const banned = await call(h, "POST", "/api/communities/" + community.body.id + "/members/" + marta.id + "/ban", {
    token: luis.token, body: { reason: "spam" }
  });
  assert.equal(banned.status, 200);
  const rejoin = await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: marta.token });
  assert.equal(rejoin.status, 403, "a banned athlete cannot re-join");
});

test("post deletion is limited to the author and moderators", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await makeCommunity(h, ana);
  const luis = await newAthlete(h, "Luis");
  const marta = await newAthlete(h, "Marta");
  for (const who of [luis, marta]) {
    await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: who.token });
  }
  const post = await call(h, "POST", "/api/communities/" + community.body.id + "/posts", {
    token: luis.token, body: { body: "Route idea: circuito in Reforma." }
  });
  const byOtherMember = await call(h, "DELETE", "/api/posts/" + post.body.id, { token: marta.token });
  assert.equal(byOtherMember.status, 403);
  const byAuthor = await call(h, "DELETE", "/api/posts/" + post.body.id, { token: luis.token });
  assert.equal(byAuthor.body.deleted, true);
  const feed = await call(h, "GET", "/api/communities/" + community.body.id + "/posts");
  assert.equal(feed.body.items.length, 0);
});

test("leaving works for members, and a sole owner must hand over first", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await makeCommunity(h, ana);
  const luis = await newAthlete(h, "Luis");
  await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: luis.token });
  const left = await call(h, "POST", "/api/communities/" + community.body.id + "/leave", { token: luis.token });
  assert.equal(left.body.status, "left");

  const ownerLeaves = await call(h, "POST", "/api/communities/" + community.body.id + "/leave", { token: ana.token });
  assert.equal(ownerLeaves.status, 409);
  assert.equal(ownerLeaves.body.error.code, "last_owner");
});

test("community creation is rate limited per athlete per day", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const codes = [];
  for (let i = 0; i < 4; i++) {
    const res = await makeCommunity(h, ana, { name: "Club " + i });
    codes.push(res.status);
  }
  assert.deepEqual(codes, [201, 201, 201, 429]);
  assert.equal(codes[codes.length - 1], 429);
});

test("posts are rate limited per athlete per hour", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await makeCommunity(h, ana);
  let last = null;
  for (let i = 0; i < 21; i++) {
    last = await call(h, "POST", "/api/communities/" + community.body.id + "/posts", {
      token: ana.token, body: { body: "Post number " + i }
    });
  }
  assert.equal(last.status, 429);
  assert.equal(last.body.error.code, "rate_limited");
});

test("reports are accepted from any athlete and stored for moderators", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await makeCommunity(h, ana);
  const luis = await newAthlete(h, "Luis");
  const res = await call(h, "POST", "/api/reports", {
    token: luis.token,
    body: { targetType: "community", targetId: community.body.id, reason: "spam", details: "Repeated promotions." }
  });
  assert.equal(res.status, 201);
  const stored = await h.db.get("SELECT * FROM reports WHERE id = ?", res.body.id);
  assert.equal(stored.status, "open");
  assert.equal(stored.reporter_id, luis.id);
  const anon = await call(h, "POST", "/api/reports", { body: { targetType: "community", targetId: "x", reason: "spam" } });
  assert.equal(anon.status, 401, "reporting requires an account");
});

test("my communities list carries my role and status, not other people's data", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await makeCommunity(h, ana, { joinPolicy: "approval" });
  const luis = await newAthlete(h, "Luis");
  await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: luis.token });
  const mine = await call(h, "GET", "/api/me/communities", { token: luis.token });
  assert.equal(mine.body.items.length, 1);
  assert.equal(mine.body.items[0].membership.status, "pending");
  assert.equal(mine.body.items[0].membership.role, "member");
});

test("text fields are trimmed and length-bounded", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const tooShort = await call(h, "POST", "/api/communities", { token: ana.token, body: { name: "x", sport: "running" } });
  assert.equal(tooShort.status, 400);
  const long = await makeCommunity(h, ana, { description: "d".repeat(900) });
  assert.equal(long.status, 400);
  const ok = await makeCommunity(h, ana, { name: "  Trail CDMX  " });
  assert.equal(ok.body.name, "Trail CDMX", "surrounding whitespace is trimmed");
});
