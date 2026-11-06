import { performance } from "node:perf_hooks";
import { match } from "../src/retrieval.ts";
import { RetrievalIndex } from "../src/retrieval-index.ts";
const filler =
  "Distributed systems store records across many servers and coordinate concurrent operations reliably. ".repeat(
    65,
  );
const books = Array.from({ length: 15 }, (_, i) => ({
  id: String(i),
  title: "Technical volume " + i,
  author: "Benchmark",
  subjects: ["Computer Science"],
  fiction: false,
  color: "#fff",
  design: 0,
  pages: 100,
  added: 0,
  texts: Array.from(
    { length: 100 },
    (_, p) =>
      filler +
      (p % 20 === 0
        ? " Neural networks use machine learning and model training."
        : ""),
  ),
}));
const query = "show everything about machine learning";
let start = performance.now();
const old = books.map((b) => match(b, query)).filter((r) => r.score > 0);
const scan = performance.now() - start;
start = performance.now();
const index = new RetrievalIndex();
books.forEach((b) => index.upsert(b));
const build = performance.now() - start;
start = performance.now();
const indexed = index.search(query);
const first = performance.now() - start;
start = performance.now();
for (let i = 0; i < 1000; i++) index.search(query);
const cached = (performance.now() - start) / 1000;
console.log(
  JSON.stringify(
    {
      pages: 1500,
      characters: books.reduce((n, b) => n + b.texts.join("").length, 0),
      legacySingleScanMs: +scan.toFixed(2),
      indexBuildMs: +build.toFixed(2),
      indexedQueryMs: +first.toFixed(2),
      cachedQueryAverageMs: +cached.toFixed(4),
      speedup: +(scan / first).toFixed(1),
      sameMatchCount: old.length === indexed.length,
      stats: index.stats,
    },
    null,
    2,
  ),
);
