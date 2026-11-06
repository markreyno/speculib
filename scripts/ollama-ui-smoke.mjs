import { _electron as electron } from "playwright";
import electronPath from "electron";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.cwd();
const profile = path.join(root, ".qa", `models-ui-${Date.now()}`);
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
  await page
    .getByRole("button", { name: "Model settings", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const librarian = dialog.getByLabel("Librarian model", { exact: true });
  await page.waitForFunction(
    () => document.querySelectorAll("#librarian-model option").length > 1,
  );
  const options = await librarian
    .locator("option")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ value: n.value, label: n.textContent })),
    );
  assert.ok(
    !options.some((o) => o.value.includes("minilm")),
    "Embedding-only model is excluded",
  );
  const model = options.find((o) => o.value)?.value;
  assert.ok(model);
  await librarian.selectOption(model);
  await dialog
    .getByLabel("Categorization model", { exact: true })
    .selectOption(model);
  await page.screenshot({ path: ".impeccable/review/model-settings.png" });
  await dialog
    .getByRole("button", { name: "Save models", exact: true })
    .click();
  await page.waitForFunction(() => !document.querySelector(".model-settings"));
  await page.reload();
  await page.waitForFunction(
    (model) => document.querySelector(".model-identity")?.textContent === model,
    model,
  );
  const settings = await page.evaluate(() => window.localModels.settings());
  assert.deepEqual(settings, {
    librarianModel: model,
    categorizerModel: model,
  });
  await page.evaluate(async () => {
    const req = indexedDB.open("speculib", 1);
    const db = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction("books", "readwrite");
    for (const book of [
      {
        id: "cook",
        title: "Everyday Cooking",
        subjects: ["Cooking"],
        texts: [
          "Everyday Cooking",
          "Bread recipes: preheat the oven. Mix flour, water and yeast. Bake the bread.",
        ],
      },
      {
        id: "code",
        title: "Designing Data-Intensive Applications",
        subjects: ["Computer Science"],
        texts: [
          "Distributed systems and programming.",
          "Recipes for replication: partition data and coordinate writes.",
        ],
      },
    ])
      tx.objectStore("books").put({
        ...book,
        author: "Example",
        fiction: false,
        subjectsEdited: true,
        catalogVersion: 2,
        color: "#acc",
        design: 0,
        pages: 2,
        added: 0,
      });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".book").length === 2,
  );
  await page
    .getByRole("textbox", { name: "Ask your librarian", exact: true })
    .fill("Do I have any cooking books?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.waitForSelector(".message.assistant", { timeout: 120000 });
  assert.equal(
    await page
      .locator(".book-title")
      .allTextContents()
      .then((t) => t.join(",")),
    "Everyday Cooking",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        model,
        settingsPersisted: true,
        embeddingExcluded: true,
        correctResourceSelected: true,
        rendererErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
