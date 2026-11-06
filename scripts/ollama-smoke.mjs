import { createRequire } from "node:module";
import { runLibrarianAgent } from "../src/librarian-agent.ts";
import { RetrievalIndex } from "../src/retrieval-index.ts";
const { LocalModelService } = createRequire(import.meta.url)(
  "../electron/local-models.cjs",
);
const service = new LocalModelService(".qa/ollama-smoke");
const connection = await service.list();
const model =
  process.argv[2] ||
  connection.models.find((m) => m.capabilities.includes("tools"))?.name;
if (!model) throw new Error("No local tool-capable model installed");
service.settings.librarianModel = model;
const books = [
  {
    id: "cook",
    title: "Everyday Cooking",
    author: "Example",
    subjects: ["Cooking"],
    fiction: false,
    pages: 2,
    texts: [
      "Everyday Cooking",
      "Bread recipes: preheat the oven. Mix flour, water and yeast. Bake the bread.",
    ],
  },
  {
    id: "code",
    title: "Designing Data-Intensive Applications",
    author: "Example",
    subjects: ["Computer Science"],
    fiction: false,
    pages: 2,
    texts: [
      "Software architecture and databases.",
      "Recipes for replication: partition data and coordinate writes.",
    ],
  },
].map((b) => ({ ...b, color: "#fff", design: 0, added: 0 }));
const index = new RetrievalIndex();
books.forEach((b) => index.upsert(b));
const traces = [];
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 100000);
try {
  const result = await runLibrarianAgent({
    api: {
      agentStep: (input, key) => {
        return service.agentStep(input, key).then((r) => {
          traces.push((r.tool_calls || []).map((c) => c.function.name));
          return r;
        });
      },
      answer: (input, key) => service.answer(input, key),
      cancel: async (key) => service.cancel(key),
    },
    question: "Do I have any cooking books?",
    history: [],
    books,
    search: async (q) => index.search(q),
    key: "smoke",
    signal: controller.signal,
    onActivity: () => {},
    onShow: () => {},
    onOpen: () => {},
  });
  console.log(JSON.stringify({ model, traces, result }, null, 2));
  if (result.hits.some((h) => h.id === "code"))
    throw new Error("Unrelated software resource selected");
} finally {
  clearTimeout(timer);
}
