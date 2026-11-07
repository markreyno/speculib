import { _electron as electron } from "playwright";
import electronPath from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.cwd();
const profile = path.join(root, ".qa", `pdf-scroll-${Date.now()}`);
await mkdir(profile, { recursive: true });
const count = 80,
  font = 3 + count * 2,
  info = font + 1;
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  `<< /Type /Pages /Kids [${Array.from({ length: count }, (_, i) => `${3 + 2 * i} 0 R`).join(" ")}] /Count ${count} >>`,
];
for (let i = 0; i < count; i++) {
  const content = `BT /F1 18 Tf 40 500 Td (Physics reference page ${i + 1}) Tj ET`;
  const box = i === 19 ? "0 0 792 612" : "0 0 612 792";
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [${box}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  );
}
objects.push(
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  "<< /Title (Physics reference) /Author (Test fixture) >>",
);
let pdf = "%PDF-1.4\n";
const offsets = [0];
objects.forEach((obj, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
  .slice(1)
  .map((n) => String(n).padStart(10, "0") + " 00000 n ")
  .join(
    "\n",
  )}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
const fixture = path.join(profile, "long.pdf");
await writeFile(fixture, pdf);
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
  await page.locator("input[type=file]").setInputFiles(fixture);
  await page
    .getByRole("button", { name: "Open Physics reference", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Open Physics reference", exact: true })
    .click();
  await page.waitForSelector(".pdf-page-frame canvas");
  assert.equal(await page.locator(".pdf-page-frame").count(), 80);
  const initial = await page.locator(".paper-area canvas").count();
  assert.ok(initial < 8, "Only nearby pages have canvases");
  await page.getByRole("button", { name: "Fullscreen PDF" }).click();
  await page.waitForFunction(() =>
    document.fullscreenElement?.matches(".reader"),
  );
  await page.getByRole("button", { name: "Exit fullscreen" }).press("Escape");
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.getByRole("button", { name: "Scroll down", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector(".paper-area").scrollTop > 100,
  );
  const number = page.getByRole("spinbutton", {
    name: "Page number",
    exact: true,
  });
  await number.fill("20");
  await page
    .getByRole("img", { name: "PDF page 20", exact: true })
    .waitFor({ state: "visible" });
  assert.equal(await number.inputValue(), "20");
  const ratio = await page
    .locator('.pdf-page-frame[data-page="20"]')
    .evaluate(
      (el) =>
        el.getBoundingClientRect().width / el.getBoundingClientRect().height,
    );
  assert.ok(ratio > 1, "Landscape page retains its real aspect ratio");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page
    .getByRole("img", { name: "PDF page 21", exact: true })
    .waitFor({ state: "visible" });
  assert.equal(await number.inputValue(), "21");
  await number.fill("1");
  await page
    .getByRole("img", { name: "PDF page 1", exact: true })
    .waitFor({ state: "visible" });
  assert.equal(await number.inputValue(), "1");
  const final = await page.locator(".paper-area canvas").count();
  assert.ok(final < 8, "Offscreen canvases are released");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        pages: count,
        initialCanvasCount: initial,
        finalCanvasCount: final,
        scrollDown: true,
        pageJump: true,
        landscapePage: true,
        rendererErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
