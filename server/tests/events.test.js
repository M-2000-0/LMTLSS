/* LIMITLESS EVENTS — capacity, waitlist, deadlines, organizer authority.
 *
 * Capacity correctness is the reason these tests exist: a full event must
 * never take a 21st registration, and a freed seat must move to the front of
 * the waitlist in one step.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, call, newAthlete } from "./helper.js";

const START = "2026-11-01T14:00:00.000Z";

async function makeEvent(h, athlete, overrides) {
  return await call(h, "POST", "/api/events", {
    token: athlete.token,
    body: Object.assign({
      title: "Sunday Track Meet",
      sport: "running",
      description: "1200 m time trial, all levels.",
      startsAt: START,
      timeZone: "America/Mexico_City",
      venueName: "Estadio Olímpico",
      venueArea: "Mexico City",
      capacity: 2,
      registrationDeadline: "2026-10-31T23:00:00.000Z",
      visibility: "public"
    }, overrides || {})
  });
}

test("an organizer can publish a free event and registrations fill seats", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const created = await makeEvent(h, ana);
  assert.equal(created.status, 201);
  assert.equal(created.body.seatsTaken, 0);
  assert.equal(created.body.capacity, 2);

  const luis = await newAthlete(h, "Luis");
  const first = await call(h, "POST", "/api/events/" + created.body.id + "/register", { token: luis.token });
  assert.equal(first.body.status, "registered");
  const detail = await call(h, "GET", "/api/events/" + created.body.id);
  assert.equal(detail.body.seatsTaken, 1);
  assert.equal(detail.body.seatsRemaining, 1);
});

test("registering twice never takes a second seat", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const event = await makeEvent(h, ana);
  const luis = await newAthlete(h, "Luis");
  await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: luis.token });
  const again = await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: luis.token });
  assert.equal(again.body.changed, false);
  const seats = await h.db.get(
    "SELECT COUNT(*) AS n FROM event_registrations WHERE event_id = ? AND status IN ('registered','checked_in')",
    event.body.id
  );
  assert.equal(Number(seats.n), 1);
});

test("a full event waitlists the next athlete with a position", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const event = await makeEvent(h, ana);
  const luis = await newAthlete(h, "Luis");
  const marta = await newAthlete(h, "Marta");
  const sara = await newAthlete(h, "Sara");

  assert.equal((await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: luis.token })).body.status, "registered");
  assert.equal((await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: marta.token })).body.status, "registered");

  const waitlisted = await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: sara.token });
  assert.equal(waitlisted.status, 201);
  assert.equal(waitlisted.body.status, "waitlist");
  assert.equal(waitlisted.body.position, 1);

  const inbox = await call(h, "GET", "/api/notifications", { token: sara.token });
  assert.ok(inbox.body.items.some(function (n) { return n.kind === "event.waitlisted"; }));

  const detail = await call(h, "GET", "/api/events/" + event.body.id);
  assert.equal(detail.body.seatsTaken, 2);
  assert.equal(detail.body.waitlistCount, 1);
});

test("cancelling frees the seat and promotes the first athlete on the waitlist", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const event = await makeEvent(h, ana, { capacity: 1 });
  const luis = await newAthlete(h, "Luis");
  const marta = await newAthlete(h, "Marta");
  await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: luis.token });
  await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: marta.token });

  const cancelled = await call(h, "POST", "/api/events/" + event.body.id + "/cancel-registration", { token: luis.token });
  assert.equal(cancelled.body.changed, true);
  assert.equal(cancelled.body.promoted, marta.id);

  const detail = await call(h, "GET", "/api/events/" + event.body.id);
  assert.equal(detail.body.seatsTaken, 1, "the promoted athlete holds the seat");
  const mine = await call(h, "GET", "/api/events/" + event.body.id, { token: marta.token });
  assert.equal(mine.body.myStatus, "registered");
  const inbox = await call(h, "GET", "/api/notifications", { token: marta.token });
  assert.ok(inbox.body.items.some(function (n) { return n.kind === "event.promoted"; }));
});

test("a cancelled athlete can register again while a seat is free", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const event = await makeEvent(h, ana, { capacity: 3 });
  const luis = await newAthlete(h, "Luis");
  await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: luis.token });
  await call(h, "POST", "/api/events/" + event.body.id + "/cancel-registration", { token: luis.token });
  const again = await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: luis.token });
  assert.equal(again.body.status, "registered");
  const rows = await h.db.all("SELECT status FROM event_registrations WHERE event_id = ?", event.body.id);
  assert.equal(rows.length, 1, "re-registering reuses the row instead of duplicating it");
});

test("registration closes at the deadline and after the start time", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const event = await makeEvent(h, ana, { registrationDeadline: "2026-10-19T00:00:00.000Z" });
  const luis = await newAthlete(h, "Luis");

  // Move the server clock forward, and mint a token valid at that new time
  // (the old token expiring is a different check, tested in auth.test.js).
  h.clock.nowMs = Date.parse("2026-10-20T00:00:00.000Z"); // past the deadline
  const afterDeadline = await newAthlete(h, "Luis", { sub: luis.sub, now: h.clock.nowMs });
  const late = await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: afterDeadline.token });
  assert.equal(late.status, 409);
  assert.equal(late.body.error.code, "registration_closed");

  h.clock.nowMs = Date.parse("2026-11-02T00:00:00.000Z"); // after the start
  const afterStart = await newAthlete(h, "Luis", { sub: luis.sub, now: h.clock.nowMs });
  const after = await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: afterStart.token });
  assert.equal(after.status, 409);
  assert.equal(after.body.error.code, "event_started");
});

test("the registration deadline cannot be after the start, nor ends before starts", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const deadline = await makeEvent(h, ana, { registrationDeadline: "2026-11-02T00:00:00.000Z" });
  assert.equal(deadline.status, 400);
  assert.equal(deadline.body.error.code, "invalid_registrationDeadline");
  const backwards = await makeEvent(h, ana, { endsAt: "2026-10-31T00:00:00.000Z" });
  assert.equal(backwards.status, 400);
  assert.equal(backwards.body.error.code, "invalid_endsAt");
});

test("a paid event is refused until a payment provider exists", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const paid = await makeEvent(h, ana, { costMinor: 25000, currency: "MXN" });
  assert.equal(paid.status, 400);
  assert.equal(paid.body.error.code, "payments_not_configured");
  assert.ok(paid.body.error.message.indexOf("not available yet") >= 0);
});

test("community events need community admin rights", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const community = await call(h, "POST", "/api/communities", {
    token: ana.token,
    body: { name: "Boxing CDMX", sport: "boxing", visibility: "public", joinPolicy: "open" }
  });
  const luis = await newAthlete(h, "Luis");
  await call(h, "POST", "/api/communities/" + community.body.id + "/join", { token: luis.token });

  const denied = await makeEvent(h, luis, { communityId: community.body.id });
  assert.equal(denied.status, 403);

  const allowed = await makeEvent(h, ana, {
    communityId: community.body.id, title: "Pad work night", sport: "boxing", visibility: "community"
  });
  assert.equal(allowed.status, 201);

  const stranger = await newAthlete(h, "Stranger");
  const hidden = await call(h, "GET", "/api/events/" + allowed.body.id, { token: stranger.token });
  assert.equal(hidden.status, 404, "community-only events stay inside the community");
  const visible = await call(h, "GET", "/api/events/" + allowed.body.id, { token: luis.token });
  assert.equal(visible.status, 200);

  const communityEvents = await call(h, "GET", "/api/communities/" + community.body.id + "/events", { token: luis.token });
  assert.equal(communityEvents.body.items.length, 1);
  assert.equal(communityEvents.body.items[0].title, "Pad work night");
});

test("a community-only event must belong to a community", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const orphan = await makeEvent(h, ana, { visibility: "community" });
  assert.equal(orphan.status, 400);
  assert.equal(orphan.body.error.code, "invalid_visibility");
});

test("only organizers see the attendee list, and it carries no contact data", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const event = await makeEvent(h, ana);
  const luis = await newAthlete(h, "Luis");
  await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: luis.token });

  const denied = await call(h, "GET", "/api/events/" + event.body.id + "/registrations", { token: luis.token });
  assert.equal(denied.status, 403);

  const list = await call(h, "GET", "/api/events/" + event.body.id + "/registrations", { token: ana.token });
  assert.equal(list.status, 200);
  assert.deepEqual(Object.keys(list.body.items[0]).sort(), ["displayName", "position", "registeredAt", "status", "userId"]);

  const checked = await call(h, "POST", "/api/events/" + event.body.id + "/check-in", {
    token: ana.token, body: { userId: luis.id }
  });
  assert.equal(checked.body.status, "checked_in");
  const strangerCheckIn = await call(h, "POST", "/api/events/" + event.body.id + "/check-in", {
    token: luis.token, body: { userId: ana.id }
  });
  assert.equal(strangerCheckIn.status, 403);
});

test("cancelling an event notifies every registrant", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const event = await makeEvent(h, ana);
  const luis = await newAthlete(h, "Luis");
  await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: luis.token });
  const cancelled = await call(h, "POST", "/api/events/" + event.body.id + "/cancel", {
    token: ana.token, body: { reason: "Venue flooded" }
  });
  assert.equal(cancelled.body.notified, 1);
  const inbox = await call(h, "GET", "/api/notifications", { token: luis.token });
  assert.ok(inbox.body.items.some(function (n) { return n.kind === "event.cancelled"; }));
  const register = await call(h, "POST", "/api/events/" + event.body.id + "/register", { token: luis.token });
  assert.equal(register.status, 409);
  assert.equal(register.body.error.code, "event_not_open");
});

test("event discovery filters by sport and date window, and hides drafts", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  await makeEvent(h, ana, { title: "Run 1", sport: "running" });
  await makeEvent(h, ana, { title: "Tennis 1", sport: "tennis", startsAt: "2026-12-05T14:00:00.000Z" });
  await h.db.run("UPDATE events SET status = 'draft' WHERE title = 'Tennis 1'");

  const all = await call(h, "GET", "/api/events");
  assert.equal(all.body.items.length, 1);
  const tennis = await call(h, "GET", "/api/events?sport=tennis");
  assert.equal(tennis.body.items.length, 0, "a draft is not discoverable");
  const windowed = await call(h, "GET", "/api/events?from=2026-12-01T00:00:00.000Z");
  assert.equal(windowed.body.items.length, 0);
  const running = await call(h, "GET", "/api/events?sport=running&from=2026-10-01T00:00:00.000Z");
  assert.equal(running.body.items.length, 1);
  const anonymous = await call(h, "GET", "/api/events?scope=community");
  assert.deepEqual(anonymous.body.items, [], "community scope needs an account and shows nothing otherwise");
});

test("organizing is rate limited per athlete per day", async () => {
  const h = await makeEnv();
  const ana = await newAthlete(h, "Ana");
  const codes = [];
  for (let i = 0; i < 11; i++) {
    const res = await makeEvent(h, ana, { title: "Event " + i });
    codes.push(res.status);
  }
  assert.equal(codes[9], 201);
  assert.equal(codes[10], 429);
});
