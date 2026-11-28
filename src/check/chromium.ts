import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';

function firstExisting(paths: Array<string | undefined>): string | undefined {
  return paths.find((path): path is string => !!path && existsSync(path));
}

export function findChromiumExecutable(): string | undefined {
  const playwrightCached = (() => {
    try {
      const candidate = chromium.executablePath();
      return existsSync(candidate) ? candidate : undefined;
    } catch {
      return undefined;
    }
  })();

  return firstExisting([
    process.env.URUSHI_CHROMIUM_PATH,
    process.env.CHROME_PATH,
    playwrightCached,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]);
}

export async function launchChromium(): Promise<Browser> {
  const executablePath = findChromiumExecutable();
  if (!executablePath) {
    throw new Error('Chromium が見つかりません。Google Chrome をインストールするか、URUSHI_CHROMIUM_PATH を指定してください。');
  }
  return chromium.launch({ headless: true, executablePath });
}

// A hosted deck is self-contained. Give Chromium only this document, without file or network access.
export async function openDeckDocument(browser: Browser, htmlPath: string, query: string): Promise<Page> {
  const hosted = Boolean(process.env.K_SERVICE || process.env.URUSHI_HOSTED === '1');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
    serviceWorkers: 'block', acceptDownloads: false });
  let url = pathToFileURL(resolve(htmlPath)).href + query;
  if (hosted) {
    url = 'https://render.invalid/deck.html' + query;
    const html = await readFile(htmlPath);
    await page.context().route('**/*', async (route) => {
      if (route.request().url() === url && route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()) {
        await route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
      } else await route.abort();
    });
    await page.context().setOffline(true);
  }
  await page.goto(url, { waitUntil: 'load' });
  return page;
}
