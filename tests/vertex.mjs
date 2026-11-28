// Opt-in live acceptance check; the local server needs Vertex AI credentials.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchChromium } from '../dist/check/chromium.js';
import { parse } from 'yaml';

const base = process.env.URUSHI_TEST_URL ?? 'http://127.0.0.1:3333';
const evidence = process.env.URUSHI_EVIDENCE ?? 'out/vertex-evidence';
await mkdir(evidence, { recursive: true });
const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const jobs = [];
  page.on('response', async (response) => {
    if (response.url().endsWith('/api/generate') && response.status() === 202) jobs.push((await response.json()).id);
  });
  await page.goto(base);
  await page.getByLabel('生成モデル').selectOption('vertex-gemini');
  const outline = '年次売上報告。共有の月別棒グラフを保つ3枚の節目「年間売上」「下半期」「10月の内訳」を作ってください。1月からの12本の売上は順に42,45,48,46,52,50,64,69,76,96,92,104百万円。下半期を強調してから見出しを変え、最後は10月の法人68、個人28と「法人契約が増加」を表示。各節目はtype: chartで同じchartIdを使い、後ろ2枚にはtransitionを記載してください。';
  const form = page.getByRole('textbox', { name: '資料の要望' });
  await form.fill(outline); await form.press('Enter');
  async function version(n) {
    await Promise.race([
      page.waitForFunction((v) => document.querySelector('select[aria-label="表示する版"]')?.value === v, String(n), { timeout: 210000 }),
      page.getByRole('alert').waitFor({ timeout: 210000 }).then(async () => { throw new Error(await page.getByRole('alert').innerText()); }),
    ]);
  }
  await version(1);
  await page.locator('.thumb').nth(1).click();
  await page.getByRole('button', { name: 'この区間を修正' }).click();
  await page.getByRole('textbox', { name: '修正の依頼' }).fill('グラフは残して、見出しの表示を今より1秒遅くしてください。');
  await page.getByRole('button', { name: '送信' }).click();
  await version(2);
  const summaries = [];
  for (const id of jobs) {
    const job = await (await page.request.get(base + '/api/jobs/' + id)).json();
    assert.equal(job.result.model, 'gemini-4-neon'); assert.equal(job.result.provider, 'vertex-gemini');
    assert.equal(job.result.ok, true);
    summaries.push({ model: job.result.model, provider: job.result.provider, iterations: job.iterations });
  }
  assert.equal(jobs.length, 2);
  const [a,b] = await Promise.all(jobs.map(async (id) => parse(await (await page.request.get(base + '/api/jobs/' + id + '/yaml')).text())));
  assert.ok(b.slides[1].transition.headlineDelay > a.slides[1].transition.headlineDelay);
  const delay = [a.slides[1].transition.headlineDelay, b.slides[1].transition.headlineDelay];
  b.slides[1].transition = a.slides[1].transition;
  assert.deepEqual(b, a);
  await page.getByRole('button', { name: '変更後 v2' }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: evidence + '/vertex.png' });
  await writeFile(evidence + '/vertex.json', JSON.stringify({ jobs: summaries, delay }, null, 2));
  console.log(JSON.stringify({ jobs: summaries, delay }));
} finally { await browser.close(); }
