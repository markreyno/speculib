import { _electron as electron } from "playwright";
import electronPath from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.cwd();
const profile = path.join(root, ".qa", `retrieval-${Date.now()}`);
await mkdir(profile, { recursive: true });
const app = await electron.launch({
  executablePath: electronPath,
  args: ["."],
  cwd: root,
  env: { ...process.env, SPECULIB_TEST_PROFILE: profile, SPECULIB_DEV: "0" },
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForSelector(".book-grid");
  await page.evaluate(async () => {
    const req = indexedDB.open("speculib", 1);
    const database = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = database.transaction("books", "readwrite");
    const filler =
      "Distributed systems store records across many servers and coordinate concurrent operations reliably. ".repeat(
        65,
      );
    for (let i = 0; i < 15; i++)
      tx.objectStore("books").put({
        id: "perf-" + i,
        title: "Technical volume " + i,
        author: "Benchmark",
        subjects: ["Computer Science"],
        fiction: false,
        catalogVersion: 2,
        color: "#9cadb5",
        design: i % 6,
        pages: 100,
        added: i,
        texts: Array.from(
          { length: 100 },
          (_, p) =>
            filler +
            (p % 20 === 0
              ? " Neural networks use machine learning and model training."
              : ""),
        ),
      });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    database.close();
  });
  await page.addInitScript(() => {
    window.__searchMessages = [];
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, ...rest) {
      if (message.type === "search")
        window.__searchMessages.push(message.query);
      return original.call(this, message, ...rest);
    };
    window.__longTasks = [];
    new PerformanceObserver((list) =>
      window.__longTasks.push(
        ...list
          .getEntries()
          .map((e) => ({ start: e.startTime, duration: e.duration })),
      ),
    ).observe({ type: "longtask", buffered: true });
    window.__ticks = 0;
    setInterval(() => window.__ticks++, 16);
  });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".book").length === 15,
  );
  const before = await page.evaluate(() => ({
    time: performance.now(),
    ticks: window.__ticks,
  }));
  const search = page.getByRole("textbox", {
    name: "Search library",
    exact: true,
  });
  await search.fill("machine learning");
  await search.press("Enter");
  await page.waitForFunction(
    () => document.querySelectorAll(".match-info").length === 15,
  );
  const after = await page.evaluate(() => ({
    time: performance.now(),
    ticks: window.__ticks,
    messages: window.__searchMessages.length,
    longTasks: window.__longTasks,
  }));
  const messagesBefore = after.messages;
  const input = page.getByRole("textbox", {
    name: "Ask your librarian",
    exact: true,
  });
  await input.fill("I want to learn about machine learning");
  await input.fill("I want to learn about machine learning and statistics");
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await page.waitForTimeout(70);
  assert.equal(
    await page.evaluate(() => window.__searchMessages.length),
    messagesBefore,
    "Typing and changing views do not resubmit retrieval",
  );
  await input.fill("What is machine learning?");
  await input.press("Enter");
  await page.waitForFunction(
    () => !!document.querySelector(".message.assistant"),
  );
  assert.equal(await page.locator(".book").count(), 15);
  assert.deepEqual(errors, []);
  const report = {
    pages: 1500,
    characters: 9851775,
    firstQueryIncludingAnyIndexWaitMs: Math.round(after.time - before.time),
    uiTimerTicksDuringQuery: after.ticks - before.ticks,
    mainThreadLongTasksDuringQuery: after.longTasks.filter(
      (e) => e.start >= before.time,
    ),
    searchRequestsOnTypingAndViewChange: 0,
    results: 15,
    rendererErrors: errors,
  };
  await writeFile(
    ".qa/retrieval-ui-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await app.close();
}
