import assert from 'node:assert/strict';
import test from 'node:test';
import { preview } from 'vite';
import { launchChromium } from '../dist/check/chromium.js';

test('the standalone Pages editor accepts outlines without calling an API', async (t) => {
  let url = process.env.URUSHI_PAGES_URL;
  if (!url) {
    const server = await preview({ mode: 'pages', preview: { host: '127.0.0.1', port: 0 } });
    t.after(() => server.close());
    url = server.resolvedUrls.local[0];
  }
  const browser = await launchChromium();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const requests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.method() + ' ' + request.url());
  });

  await page.goto(url);
  await page.getByRole('button', { name: '年間売上を3つの節目で' }).click();
  const input = page.getByRole('textbox', { name: '資料の要望' });
  assert.equal(await input.inputValue(), '年間売上を3つの節目で');
  await input.fill('来期の計画を説明したい');
  await input.press('Enter');
  assert.equal(await input.inputValue(), '来期の計画を説明したい');
  assert.equal(await page.getByRole('button', { name: '送信' }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'JSON を読み込む' }).isDisabled(), true);
  assert.deepEqual(requests, []);
});
