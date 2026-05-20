import type { Browser } from "puppeteer";

declare global {
  // eslint-disable-next-line no-var
  var __puppeteerBrowser: Browser | undefined;
}

export async function getBrowser(): Promise<Browser> {
  if (global.__puppeteerBrowser) {
    try {
      const v = await global.__puppeteerBrowser.version();
      if (v) return global.__puppeteerBrowser;
    } catch {
      global.__puppeteerBrowser = undefined;
    }
  }
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
  global.__puppeteerBrowser = browser;
  return browser;
}
