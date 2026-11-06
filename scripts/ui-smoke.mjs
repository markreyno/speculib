import { _electron as electron } from "playwright";
import electronPath from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.cwd();
const profile = path.join(root, ".qa", `profile-${Date.now()}`);
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
  await page.evaluate(() => document.fonts.ready);
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setContentSize(1440, 900);
  });
  await page.locator(".app").evaluate((el) => {
    el.dataset.qa = "true";
  });
  for (const side of ["library navigation", "librarian"]) {
    const expand = page.getByRole("button", {
      name: "Expand " + side,
      exact: true,
    });
    if (await expand.isVisible()) await expand.click();
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: ".impeccable/review/desktop.png" });
  const measure = () =>
    page.evaluate(() => ({
      width: innerWidth,
      body: document.body.scrollWidth,
      page: document.documentElement.scrollHeight,
      height: innerHeight,
      main: document.querySelector(".main").getBoundingClientRect().width,
      resources: document
        .querySelector(".resource-scroll")
        .getBoundingClientRect().height,
    }));
  const initial = await measure();
  assert.equal(initial.body, initial.width, "No horizontal document overflow");
  assert.equal(initial.page, initial.height, "No vertical document overflow");
  assert.ok(initial.resources > 200, "Scrollable resource area remains usable");
  await page
    .getByRole("button", { name: "Collapse library navigation", exact: true })
    .click();
  const left = await measure();
  assert.ok(left.main > initial.main, "Left collapse expands center");
  await page
    .getByRole("button", { name: "Collapse librarian", exact: true })
    .click();
  const both = await measure();
  assert.ok(both.main > left.main, "Right collapse expands center");
  await page.screenshot({ path: ".impeccable/review/collapsed.png" });
  await page
    .getByRole("button", { name: "Expand library navigation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand librarian", exact: true })
    .click();
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await page.waitForSelector(".list-view");
  await page.getByRole("button", { name: "Grid view", exact: true }).click();
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Fiction", exact: true })
    .click();
  assert.equal(await page.locator(".book").count(), 1, "Fiction filtering");
  await page.getByRole("button", { name: "All", exact: true }).click();
  const search = page.getByRole("textbox", {
    name: "Search library",
    exact: true,
  });
  await search.fill("machine learning");
  await search.press("Enter");
  await page.waitForFunction(
    () => document.querySelectorAll(".match-info").length > 0,
  );
  assert.ok((await page.locator(".book").count()) > 0, "Library search");
  await page
    .getByRole("button", { name: "Clear search", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Explore in 3D", exact: true })
    .click();
  await page.waitForSelector(".app.exploring");
  await page.waitForTimeout(400);
  await page.screenshot({ path: ".impeccable/review/explore.png" });
  await page
    .getByRole("button", { name: "Return to library", exact: true })
    .click();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1000, 720),
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: ".impeccable/review/compact.png" });
  const narrow = await measure();
  assert.equal(
    narrow.body,
    narrow.width,
    "Compact layout has no horizontal overflow",
  );
  assert.equal(narrow.page, narrow.height, "Compact layout has no page scroll");

  const streams = [
    "BT /F1 24 Tf 60 700 Td (Everyday Cooking) Tj ET",
    "BT /F1 16 Tf 60 700 Td (Cooking: preheat the oven and combine flour and ingredients.) Tj ET",
  ];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${streams[0].length} >>\nstream\n${streams[0]}\nendstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    `<< /Length ${streams[1].length} >>\nstream\n${streams[1]}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Title (Everyday Cooking) /Author (UI test fixture) >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 9\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<< /Size 9 /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const fixture = path.join(root, ".qa/two-page.pdf");
  await writeFile(fixture, pdf);
  await page.locator("input[type=file]").setInputFiles(fixture);
  await page.waitForFunction(
    () =>
      document.querySelector(".book-title")?.textContent === "Everyday Cooking",
  );
  await page.locator("input[type=file]").setInputFiles(fixture);
  await page.waitForFunction(() =>
    document
      .querySelector(".toast")
      ?.textContent?.includes("already in your library"),
  );
  assert.equal(
    await page.locator(".book").count(),
    1,
    "Duplicate import rejected",
  );
  await search.fill("show passages about cooking oven");
  await search.press("Enter");
  await page.locator(".match-info button").filter({ hasText: "p. 2" }).click();
  await page.waitForSelector(".paper-area canvas");
  assert.equal(
    await page.getByRole("spinbutton", { name: "Page number" }).inputValue(),
    "2",
    "Passage opens physical page two",
  );
  await page.waitForFunction(
    () => document.querySelector(".paper-area canvas")?.width > 0,
  );
  await page
    .getByRole("button", { name: "Library", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Open Everyday Cooking", exact: true })
    .click();
  assert.equal(
    await page.getByRole("spinbutton", { name: "Page number" }).inputValue(),
    "1",
    "Whole-resource cover opens page one",
  );
  await page.reload();
  await page.waitForSelector(".book-title");
  assert.equal(
    await page.locator(".book-title").textContent(),
    "Everyday Cooking",
    "Imported library persists after reload",
  );

  const unknown = path.join(root, ".qa/unknown.pdf");
  const unknown2 = path.join(root, ".qa/unknown2.pdf");
  await writeFile(
    unknown,
    pdf.replaceAll("Everyday Cooking", "Untitled Journal"),
  );
  await writeFile(
    unknown2,
    pdf.replaceAll("Everyday Cooking", "Unsorted Journal"),
  );
  await page.locator("input[type=file]").setInputFiles([unknown, unknown2]);
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.ok(
    await dialog.getByText("Untitled Journal", { exact: true }).isVisible(),
    "Uncategorized import prompts for subjects",
  );
  assert.equal(
    await dialog
      .getByRole("button", { name: "Save subjects", exact: true })
      .isDisabled(),
    true,
    "No empty subject can be saved",
  );
  await page.screenshot({ path: ".impeccable/review/category.png" });
  await dialog
    .getByLabel("Add subjects", { exact: true })
    .fill("Gardening, Botany");
  await dialog
    .getByRole("button", { name: "Save subjects", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector(".category-resource strong")?.textContent ===
      "Unsorted Journal",
  );
  await dialog.getByRole("button", { name: "Not now", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("dialog"));
  await page.reload();
  await dialog.waitFor();
  assert.ok(
    await dialog.getByText("Unsorted Journal", { exact: true }).isVisible(),
    "Deferred resource is prompted on restart",
  );
  await dialog.getByRole("button", { name: "Gardening", exact: true }).click();
  await dialog
    .getByLabel("Classification", { exact: true })
    .selectOption("fiction");
  await dialog
    .getByRole("button", { name: "Save subjects", exact: true })
    .click();
  await page.waitForFunction(() => !document.querySelector("dialog"));
  await page.reload();
  await page.waitForSelector(".book-grid");
  assert.equal(
    await page.locator("dialog").count(),
    0,
    "Saved choices persist and stop prompts",
  );
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Fiction", exact: true })
    .click();
  assert.equal(
    await page.locator(".book-title").textContent(),
    "Unsorted Journal",
    "Manual classification affects retrieval filters",
  );
  assert.deepEqual(errors, [], "No renderer exceptions");
  console.log(
    JSON.stringify(
      {
        status: "passed",
        initial,
        leftCollapsed: left,
        bothCollapsed: both,
        compact: narrow,
        rendererErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
