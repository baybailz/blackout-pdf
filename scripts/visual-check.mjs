// Visual spot-check: screenshots the editor with all redactions applied, then
// re-opens the exported PDF in the app and screenshots that too, so a human
// (or agent) can confirm the black boxes cover the right content.
// Usage: node scripts/visual-check.mjs <test-pdf> <out-dir>

import { launch } from "puppeteer-core";
import { preview } from "vite";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

const TEST_PDF = process.argv[2] ?? "/mnt/d/claude/output/blackout-test.pdf";
const OUT_DIR = process.argv[3] ?? ".";
const CHROME_BIN =
  process.env.CHROME_BIN ??
  join(
    homedir(),
    ".cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell",
  );

const server = await preview({ preview: { port: 4174, host: "127.0.0.1" } });
const browser = await launch({
  executablePath: CHROME_BIN,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1400,1800"],
  defaultViewport: { width: 1400, height: 1800 },
});

async function openAndRedactAll(page, pdfPath) {
  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle0" });
  const input = await page.$("input[type=file]");
  await input.uploadFile(pdfPath);
  await page.waitForSelector(".editor", { timeout: 15000 });
  await page.waitForFunction(
    () => !document.querySelector(".meta")?.textContent?.includes("scanning"),
    { timeout: 20000 },
  );
  for (const b of await page.$$(".category .mini-btn")) {
    if (/Redact all/.test(await b.evaluate((el) => el.textContent))) {
      await b.click();
    }
  }
}

const page = await browser.newPage();
await openAndRedactAll(page, TEST_PDF);
await new Promise((r) => setTimeout(r, 800));
await (await page.$(".page")).screenshot({
  path: join(OUT_DIR, "editor-redacted.png"),
});
console.log("saved editor-redacted.png");

// Export, then reopen the exported file and screenshot it.
const dlDir = mkdtempSync(join(tmpdir(), "blackout-vis-"));
const cdp = await page.createCDPSession();
await cdp.send("Page.setDownloadBehavior", {
  behavior: "allow",
  downloadPath: dlDir,
});
await page.click(".export-btn");
let file = null;
for (let i = 0; i < 60 && !file; i++) {
  await new Promise((r) => setTimeout(r, 500));
  file = readdirSync(dlDir).find(
    (f) => f.endsWith(".pdf") && !f.endsWith(".crdownload"),
  );
}
if (!file) throw new Error("no export");

const page2 = await browser.newPage();
await page2.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle0" });
const input2 = await page2.$("input[type=file]");
await input2.uploadFile(join(dlDir, file));
await page2.waitForSelector(".editor", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1500));
await (await page2.$(".page")).screenshot({
  path: join(OUT_DIR, "exported-result.png"),
});
console.log("saved exported-result.png");

await browser.close();
await server.close();
