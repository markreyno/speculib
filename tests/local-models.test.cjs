const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { LocalModelService } = require("../electron/local-models.cjs");
const response = (value) => ({ ok: true, json: async () => value });
function mock(chat) {
  return async (url, options) => {
    assert.ok(url.startsWith("http://127.0.0.1:11434/"));
    const body = options.body ? JSON.parse(options.body) : null;
    if (url.endsWith("/api/tags"))
      return response({
        models: [
          { name: "chat", size: 123, details: { parameter_size: "1B" } },
          { name: "embed" },
          { name: "remote:cloud" },
        ],
      });
    if (url.endsWith("/api/show"))
      return response({
        capabilities:
          body.model === "embed" ? ["embedding"] : ["completion", "tools"],
      });
    if (url.endsWith("/api/chat"))
      return response({ message: { content: JSON.stringify(chat) } });
    throw Error(url);
  };
}
test("model settings list local chat models and persist independent choices", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "speculib-model-"));
  const service = new LocalModelService(directory, { fetchImpl: mock({}) });
  const list = await service.list();
  assert.deepEqual(
    list.models.map((m) => m.name),
    ["chat"],
  );
  await service.save({ librarianModel: "chat", categorizerModel: "" });
  const fresh = new LocalModelService(directory, { fetchImpl: mock({}) });
  assert.deepEqual(await fresh.init(), {
    librarianModel: "chat",
    categorizerModel: "",
  });
  await assert.rejects(
    service.save({ librarianModel: "embed", categorizerModel: "" }),
  );
});
test("categorization requires actual source quotes and asks user on insufficient evidence", async () => {
  const output = {
    subjects: ["Cooking"],
    keywords: ["food"],
    summary: "Cooking guide",
    domain: "Food",
    documentType: "Book",
    fiction: "nonfiction",
    needsUser: false,
    evidence: [{ page: 2, quote: "Preheat the oven" }],
  };
  const service = new LocalModelService("", { fetchImpl: mock(output) });
  service.settings.categorizerModel = "chat";
  let result = await service.classify(
    {
      title: "Notes",
      pages: [{ page: 2, text: "Preheat the oven to bake bread." }],
    },
    "1",
  );
  assert.deepEqual(result.subjects, ["Cooking"]);
  result = await service.classify(
    {
      title: "Notes",
      pages: [{ page: 2, text: "Distributed systems replicate data." }],
    },
    "2",
  );
  assert.equal(result.needsUser, true);
  assert.deepEqual(result.subjects, []);
});
test("librarian takes priority over categorization without running both at once", async () => {
  const service = new LocalModelService("");
  let running = 0,
    max = 0;
  const category = service.schedule(
    "categorizer",
    "c",
    (signal) =>
      new Promise((resolve, reject) => {
        running++;
        max = Math.max(max, running);
        signal.addEventListener("abort", () => {
          running--;
          reject(Error("aborted"));
        });
      }),
  );
  const rejected = assert.rejects(category, /paused for librarian/);
  const librarian = service.schedule("librarian", "l", async () => {
    running++;
    max = Math.max(max, running);
    running--;
    return "done";
  });
  await rejected;
  assert.equal(await librarian, "done");
  assert.equal(max, 1);
});
test("answers reject made-up resource IDs and page citations", async () => {
  const service = new LocalModelService("", {
    fetchImpl: mock({
      answer: "Unsupported",
      resourceIds: ["made-up"],
      sources: [{ id: "made-up", page: 900 }],
    }),
  });
  service.settings.librarianModel = "chat";
  const result = await service.answer(
    {
      question: "What is a proton?",
      candidates: [
        {
          id: "real",
          title: "Physics",
          subjects: ["Physics"],
          passages: [{ page: 2, excerpt: "A proton has positive charge." }],
        },
      ],
    },
    "a",
  );
  assert.deepEqual(result.resourceIds, []);
  assert.deepEqual(result.sources, []);
});

test("structured tool adapter is used when native tool calls are missing", async () => {
  const fetchImpl = async (url, options) => {
    if (url.endsWith("/api/show"))
      return response({ capabilities: ["completion", "tools"] });
    const body = JSON.parse(options.body);
    if (body.format)
      return response({
        message: {
          content: JSON.stringify({
            tool: "search_library",
            arguments: { query: "cooking", genre: "nonfiction" },
          }),
        },
      });
    return response({ message: { content: "I can help." } });
  };
  const service = new LocalModelService("", { fetchImpl });
  service.settings.librarianModel = "chat";
  const result = await service.agentStep(
    { messages: [{ role: "user", content: "Find cooking books" }] },
    "s",
  );
  assert.equal(result.tool_calls[0].function.name, "search_library");
  assert.equal(result.tool_calls[0].function.arguments.query, "cooking");
});
