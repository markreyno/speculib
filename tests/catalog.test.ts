import test from "node:test";
import assert from "node:assert/strict";
import { catalogSubjects, refreshCatalog } from "../src/catalog.ts";
import { wantsFiction } from "../src/retrieval.ts";
test("software metaphors do not classify as Cooking", () =>
  assert.deepEqual(
    catalogSubjects("Designing Data-Intensive Applications", [
      "Software recipes for replication.",
      "Ingredients for a distributed system.",
    ]),
    ["Computer Science"],
  ));
test("isolated topic mentions do not categorize an entire book", () =>
  assert.ok(
    !catalogSubjects("Technical guide", [
      "Cooking is an analogy here.",
      ...Array(50).fill("Software architecture."),
    ]).includes("Cooking"),
  ));
test("title provides strong subject context", () =>
  assert.ok(catalogSubjects("Everyday Cooking", []).includes("Cooking")));
test("fiction intent respects nonfiction wording", () => {
  assert.equal(wantsFiction("Find nonfiction books about cooking"), false);
  assert.equal(wantsFiction("What stories have cooking in the plot?"), true);
});
test("catalog refresh preserves explicit subject edits", () => {
  const b = {
    id: "1",
    title: "Systems",
    author: "A",
    subjects: ["My shelf"],
    subjectsEdited: true,
    fiction: false,
    pages: 1,
    color: "#fff",
    design: 0,
    added: 0,
  };
  assert.equal(refreshCatalog(b), b);
});
test("older imports are reclassified without losing custom shelves", () => {
  const b = {
    id: "1",
    title: "Designing Data-Intensive Applications",
    author: "A",
    subjects: ["Cooking", "Work reading"],
    fiction: false,
    pages: 2,
    color: "#fff",
    design: 0,
    added: 0,
    texts: ["Software recipe.", "Database architecture."],
  };
  const result = refreshCatalog(b);
  assert.ok(!result.subjects.includes("Cooking"));
  assert.ok(result.subjects.includes("Work reading"));
  assert.ok(result.subjects.includes("Computer Science"));
  assert.equal(refreshCatalog(result), result);
});

import { cleanSubjects, needsCategory } from "../src/catalog.ts";
test("uncategorized documents require a user category", () => {
  const b = {
    id: "u",
    title: "Notes",
    author: "A",
    subjects: ["Uncategorized"],
    fiction: false,
    pages: 1,
    color: "#fff",
    design: 0,
    added: 0,
  };
  assert.equal(needsCategory(b), true);
  assert.equal(needsCategory({ ...b, subjects: [] }), true);
  assert.equal(needsCategory({ ...b, subjects: ["Gardening"] }), false);
});
test("manual subjects reject placeholder and deduplicate case-insensitively", () =>
  assert.deepEqual(
    cleanSubjects(["  Gardening ", "", "gardening", "Uncategorized", "Botany"]),
    ["Gardening", "Botany"],
  ));

test("generic wording and duplicated pages do not establish book subjects", () => {
  assert.deepEqual(
    catalogSubjects(
      "Design Patterns in Distributed Systems",
      Array(20).fill("A note about Gardening."),
    ),
    ["Computer Science", "Distributed Systems"],
  );
});
