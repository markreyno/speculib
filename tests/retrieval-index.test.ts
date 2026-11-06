import test from "node:test";
import assert from "node:assert/strict";
import { RetrievalIndex } from "../src/retrieval-index.ts";
import { match } from "../src/retrieval.ts";
const technical = {
  id: "tech",
  title: "Designing Data-Intensive Applications",
  author: "Martin Kleppmann",
  subjects: ["Computer Science", "Cooking"],
  fiction: false,
  texts: [
    "This book includes a recipe for replication.",
    "Ingredients for software architecture.",
  ],
};
const medical = {
  id: "med",
  title: "Medical handbook",
  author: "A",
  subjects: ["Medicine"],
  fiction: false,
  texts: [
    "Clinical diagnosis.",
    "Neural networks support diagnosis.",
    "Machine learning uses neural networks and model training.",
  ],
};
test("indexed search preserves relevant rankings and physical pages", () => {
  const index = new RetrievalIndex();
  index.upsert(medical);
  const expected = match(
    { ...medical, color: "#fff", design: 0, pages: 3, added: 0 },
    "machine learning",
  );
  const [result] = index.search("machine learning");
  assert.equal(result.page, expected.page);
  assert.equal(result.score, expected.score);
  assert.deepEqual(result.passages, expected.passages);
});
test("cooking intent still excludes engineering metaphors", () => {
  const index = new RetrievalIndex();
  index.upsert(technical);
  assert.deepEqual(index.search("I want a cooking book"), []);
});
test("phrase candidates must have the right word order and boundaries", () => {
  const index = new RetrievalIndex();
  index.upsert({
    ...medical,
    texts: ["The prices are high. Networks can be neural."],
  });
  assert.deepEqual(index.search("rice"), []);
  assert.deepEqual(index.search("machine learning"), []);
});
test("cache is reused and invalidated on edits and removal", () => {
  const index = new RetrievalIndex();
  index.upsert(medical);
  const first = index.search("machine learning");
  assert.equal(index.search("machine learning"), first);
  index.upsert({
    ...medical,
    title: "Plants",
    subjects: ["Botany"],
    texts: ["Gardens grow."],
  });
  assert.deepEqual(index.search("machine learning"), []);
  assert.equal(index.search("gardens").length, 1);
  index.remove("med");
  assert.deepEqual(index.search("gardens"), []);
  assert.equal(index.stats.pages, 0);
  assert.equal(index.stats.tokens, 0);
});
test("query cache stays bounded", () => {
  const index = new RetrievalIndex();
  index.upsert(medical);
  for (let i = 0; i < 100; i++) index.search("query" + i);
  assert.ok(index.stats.cachedQueries <= 24);
});
test("author names are searchable without scanning pages", () => {
  const index = new RetrievalIndex();
  index.upsert(technical);
  assert.equal(index.search("Kleppmann")[0].id, "tech");
});
test("metadata-only edits preserve indexed pages and invalidate result cache", () => {
  const index = new RetrievalIndex();
  index.upsert(medical);
  const old = index.search("machine learning");
  index.upsert({
    ...medical,
    title: "Clinical reference",
    subjects: ["Clinical"],
    texts: undefined,
  });
  const result = index.search("machine learning");
  assert.equal(result[0].page, 3);
  assert.notEqual(result, old);
  assert.equal(index.search("Clinical reference")[0].whole, true);
  assert.equal(index.stats.pages, 3);
});
