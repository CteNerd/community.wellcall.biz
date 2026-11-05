import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessRelationship } from "./authorization.ts";

const mentor = { userId: "mentor-a", active: true, approved: true };
const assignment = { mentorId: "mentor-a", participantId: "participant-a", programId: "adult-tech", active: true };
const resource = { participantId: "participant-a", programId: "adult-tech" };

test("only an approved active mentor can access an active assigned relationship", () => {
  assert.equal(canAccessRelationship(mentor, assignment, resource), true);
  assert.equal(canAccessRelationship(null, assignment, resource), false);
  assert.equal(canAccessRelationship({ ...mentor, approved: false }, assignment, resource), false);
  assert.equal(canAccessRelationship({ ...mentor, active: false }, assignment, resource), false);
  assert.equal(canAccessRelationship(mentor, { ...assignment, active: false }, resource), false);
});

test("changing mentor, participant or program IDs never expands assignment access", () => {
  assert.equal(canAccessRelationship({ ...mentor, userId: "mentor-b" }, assignment, resource), false);
  assert.equal(canAccessRelationship(mentor, assignment, { ...resource, participantId: "other" }), false);
  assert.equal(canAccessRelationship(mentor, assignment, { ...resource, programId: "other" }), false);
});
