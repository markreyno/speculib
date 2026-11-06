import test from "node:test";
import assert from "node:assert/strict";
import { match, terms } from "../src/retrieval.ts";
import { inferSubjects } from "../src/data.ts";
const book = {
  id: "test",
  title: "Medical handbook",
  author: "A",
  subjects: ["Medicine"],
  fiction: false,
  color: "#fff",
  design: 0,
  pages: 3,
  added: 0,
  texts: [
    "Clinical diagnosis.",
    "Neural networks support medical diagnosis.",
    "Machine learning uses neural networks and model training.",
  ],
};
test("related vocabulary finds a passage without the exact query", () => {
  const result = match(
    { ...book, texts: book.texts.slice(0, 2) },
    "machine learning",
  );
  assert.ok(result.score > 0);
  assert.equal(result.page, 2);
  assert.equal(result.whole, false);
});
test("retrieval ranks passages and preserves physical PDF pages", () => {
  const result = match(book, "machine learning");
  assert.equal(result.page, 3);
  assert.deepEqual(
    result.passages.map((p) => p.page),
    [3, 2],
  );
  assert.match(result.excerpt, /model training/);
});
test("unrelated resources do not match", () =>
  assert.equal(match(book, "cooking").score, 0));
test("natural language removes request filler", () =>
  assert.deepEqual(terms("show me everything about"), []));
test("one document can receive multiple subjects", () =>
  assert.deepEqual(inferSubjects("Machine learning algorithms in statistics"), [
    "Machine Learning",
    "Computer Science",
    "Mathematics",
  ]));

test("cooking request rejects software recipes and generic book words", () => {
  const technical = {
    ...book,
    title: "Designing Data-Intensive Applications",
    subjects: ["Computer Science", "Cooking"],
    texts: [
      "This book describes databases. Here is a recipe for replication.",
      "The ingredients of a reliable software system.",
    ],
  };
  for (const query of [
    "I want a cooking book",
    "Do I have any cooking books?",
    "Can you find me a book about cooking?",
  ])
    assert.equal(match(technical, query).score, 0, query);
});
test("AI expansion uses token boundaries rather than matching explain", () =>
  assert.equal(
    match(
      { ...book, texts: ["A neural network introduction"] },
      "explain cooking",
    ).score,
    0,
  ));
test("real cookbook matches ordinary natural language", () => {
  const result = match(
    {
      ...book,
      title: "The Home Cookbook",
      subjects: ["Cooking"],
      texts: ["Preheat the oven. Mix flour and ingredients."],
    },
    "Do I have any cooking books?",
  );
  assert.ok(result.score > 0);
  assert.equal(result.whole, true);
});
test("a useful cooking passage in another subject stays a passage", () => {
  const resource = {
    ...book,
    title: "Travels around Italy",
    subjects: ["Travel"],
    texts: [
      "Arrival in Rome",
      "Cooking: preheat the oven and combine flour and ingredients.",
      ...Array(30).fill("Travel notes from the coast."),
    ],
  };
  assert.equal(match(resource, "Find me a cooking book").score, 0);
  const result = match(resource, "Show passages about cooking");
  assert.ok(result.score > 0);
  assert.equal(result.page, 2);
  assert.equal(result.whole, false);
});
test("word matching does not find rice inside prices", () =>
  assert.equal(
    match(
      {
        ...book,
        title: "Pricing systems",
        subjects: [],
        texts: ["Market prices change."],
      },
      "rice",
    ).score,
    0,
  ));
