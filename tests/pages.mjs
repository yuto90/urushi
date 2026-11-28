import assert from 'node:assert/strict';
import test from 'node:test';
import { preview } from 'vite';
import { launchChromium } from '../dist/check/chromium.js';

test('Pages keeps the public editor open and carries the outline through the Access login navigation', async (t) => {
  const server = await preview({ mode: 'pages', preview: { host: '127.0.0.1', port: 0 } });
  t.after(() => server.close());
  const browser = await launchChromium();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const api = [];
  let authenticated = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    api.push(path);
    if (path === '/api/config') return route.fulfill(authenticated
      ? { json: { provider: 'vertex-gemini', expires: Math.floor(Date.now() / 1000) + 3600 } }
      : { status: 401, json: { error: 'sign in' } });
    if (path === '/api/login') {
      authenticated = true;
      return route.fulfill({ status: 303, headers: { location: '/' } });
    }
    return route.abort();
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('button', { name: '年間売上を3つの節目で' }).click();
  const input = page.getByRole('textbox', { name: '資料の要望' });
  assert.equal(await input.inputValue(), '年間売上を3つの節目で');
  await input.fill('来期の計画を説明したい');
  await input.press('Enter');
  await page.getByRole('button', { name: 'ログアウト' }).waitFor();
  assert.equal(await input.inputValue(), '来期の計画を説明したい');
  assert.equal(await page.getByRole('button', { name: '送信' }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: 'JSON を読み込む' }).isEnabled(), true);
  assert.ok(api.includes('/api/login'));
  assert.ok(!api.includes('/api/generate'));
});
