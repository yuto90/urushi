import { existsSync } from 'node:fs';
import { chromium, type Browser } from 'playwright-core';

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
