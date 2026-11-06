import test from "node:test";
import assert from "node:assert/strict";
import { runLibrarianAgent } from "../src/librarian-agent.ts";
const book = {
  id: "cook",
  title: "Bread recipes",
  author: "A",
  subjects: ["Cooking"],
  fiction: false,
  color: "#fff",
  design: 0,
  pages: 2,
  added: 0,
  texts: ["Bread recipes", "Preheat the oven to bake bread."],
};
const hit = {
  id: "cook",
  score: 5,
  page: 2,
  excerpt: book.texts[1],
  whole: true,
  reason: "Cooking",
  passages: [{ page: 2, excerpt: book.texts[1], hits: 1 }],
};
const call = (name, args) => ({
  role: "assistant",
  content: "",
  tool_calls: [{ type: "function", function: { name, arguments: args } }],
});
test("agent can search, inspect pages, and finish with verified citations", async () => {
  const steps = [
    call("search_library", { query: "bread", genre: "nonfiction" }),
    call("read_pages", { id: "cook", pages: [2] }),
    call("show_resources", { ids: ["cook"] }),
    call("finish", {
      answer: "Preheat the oven.",
      resourceIds: ["cook"],
      sources: [
        { id: "cook", page: 2 },
        { id: "fake", page: 7 },
      ],
    }),
  ];
  let shown = [];
  const api = { agentStep: async () => steps.shift(), cancel: async () => {} };
  const result = await runLibrarianAgent({
    api,
    question: "How do I bake bread?",
    history: [],
    books: [book],
    search: async () => [hit],
    key: "1",
    signal: new AbortController().signal,
    onActivity: () => {},
    onShow: (h) => (shown = h),
    onOpen: () => assert.fail("Should not open a PDF"),
  });
  assert.equal(result.hits[0].id, "cook");
  assert.deepEqual(result.sources, [{ id: "cook", page: 2 }]);
  assert.equal(shown.length, 1);
});
test("agent cannot open PDFs without an explicit open request and cannot invent sources", async () => {
  const steps = [
    call("open_resource", { id: "cook", page: 2 }),
    call("finish", {
      answer: "No evidence",
      resourceIds: ["fake"],
      sources: [{ id: "fake", page: 9 }],
    }),
  ];
  let message;
  const api = {
    agentStep: async (input) => {
      message = input.messages.at(-1);
      return steps.shift();
    },
    cancel: async () => {},
  };
  const result = await runLibrarianAgent({
    api,
    question: "Find a cooking book",
    history: [],
    books: [book],
    search: async () => [],
    key: "2",
    signal: new AbortController().signal,
    onActivity: () => {},
    onShow: () => {},
    onOpen: () => assert.fail("Must not open"),
  });
  assert.match(message.content, /explicitly ask/);
  assert.deepEqual(result.hits, []);
  assert.deepEqual(result.sources, []);
});
test("agent stops repeated tool loops at its bounded reasoning budget", async () => {
  const api = {
    agentStep: async () => call("get_resource", { id: "cook" }),
    cancel: async () => {},
  };
  await assert.rejects(
    runLibrarianAgent({
      api,
      question: "Find a book",
      history: [],
      books: [book],
      search: async () => [],
      key: "3",
      signal: new AbortController().signal,
      onActivity: () => {},
      onShow: () => {},
      onOpen: () => {},
    }),
    /reasoning limit/,
  );
});

test("explicit cooking request cannot be broadened into software results by the model", async () => {
  const technical = {
    ...book,
    id: "code",
    title: "Data Systems",
    subjects: ["Computer Science"],
    texts: ["Software recipes", "Replication recipes"],
  };
  const technicalHit = {
    ...hit,
    id: "code",
    reason: "Programming",
    excerpt: "Replication recipes",
  };
  const steps = [
    call("search_library", { query: "recipes", genre: "nonfiction" }),
    call("finish", {
      answer: "Both are food books.",
      resourceIds: ["code", "cook"],
      sources: [],
    }),
  ];
  const result = await runLibrarianAgent({
    api: { agentStep: async () => steps.shift(), cancel: async () => {} },
    question: "Find a cooking book",
    history: [],
    books: [book, technical],
    search: async (q) => (q.includes("cooking") ? [hit] : [hit, technicalHit]),
    key: "4",
    signal: new AbortController().signal,
    onActivity: () => {},
    onShow: () => {},
    onOpen: () => {},
  });
  assert.deepEqual(
    result.hits.map((h) => h.id),
    ["cook"],
  );
  assert.equal(result.answer, "Found 1 matching resource in your library.");
});
