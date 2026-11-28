import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { launchChromium } from '../dist/check/chromium.js';

async function localApi(t) {
  if (process.env.URUSHI_TEST_URL) return process.env.URUSHI_TEST_URL;
  const child = spawn(process.execPath, ['dist/cli.js', 'serve', '--port', '0', '--provider', 'mock'], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill();
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    try { await exited; } finally { clearTimeout(timer); }
  });
  const [start] = await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('Server failed to start'); })]);
  return start.toString().match(/http:\/\/localhost:(\d+)/)[0].replace('localhost', '127.0.0.1');
}

function observeReplay() {
  window.streamPaints = [];
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'test:paint' && event.source === document.querySelector('.stream-frame')?.contentWindow) {
      window.streamPaints.push({ ...event.data, duringGeneration: !!document.querySelector('.progress') });
    }
    if (event.data?.type === 'urushi:partial') {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const slide = document.querySelector('.slide.active');
        if (slide) parent.postMessage({ type: 'test:paint', title: slide.querySelector('h1')?.textContent,
          position: document.querySelector('.deck-footer')?.textContent }, '*');
      }));
    }
  });
  window.addEventListener('message', (e) => {
    if (e.data?.type !== 'urushi:replay') return;
    queueMicrotask(() => {
      const chart = document.querySelector('.slide.active .shared-chart');
      if (chart) window.replayStart = {
        headline: chart.querySelector('h1').textContent,
        opacity: [...chart.querySelectorAll('.chart-bar')].map((bar) => getComputedStyle(bar).opacity),
        values: [...chart.querySelectorAll('.chart-bar')].map((bar) => bar.dataset.value),
      };
    });
  });
}

test('edit, compare, present, restore, export and resume through the editor', { timeout: 240000 }, async (t) => {
  const base = await localApi(t);
  const evidence = process.env.URUSHI_EVIDENCE;
  const files = evidence ? resolve(evidence) : await mkdtemp(join(tmpdir(), 'urushi-editor-'));
  await mkdir(files, { recursive: true });
  const browser = await launchChromium();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(observeReplay);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const events = [];
  cdp.on('Network.eventSourceMessageReceived', (e) => events.push(JSON.parse(e.data)));
  const shot = async (name) => { if (evidence) await page.screenshot({ path: join(files, name + '.png') }); };
  const frame = () => page.frameLocator('.deck-frame');
  const active = () => frame().locator('.slide.active');
  const thumb = (n) => page.locator('.thumb').nth(n - 1);
  const headline = async (expected) => {
    await active().locator('.chart-headline').filter({ hasText: expected }).waitFor();
  };
  const version = async (n, target = page) => {
    await target.waitForFunction((v) => document.querySelector('[aria-label="表示する版"]')?.value === String(v), n);
  };
  const submit = async (instruction, n) => {
    const field = page.getByRole('textbox', { name: '修正の依頼' });
    await field.fill(instruction); await field.press('Enter'); await version(n);
  };
  await page.goto(base);
  assert.equal(await page.getByRole('heading', { name: '最近の資料' }).count(), 0);
  await page.getByRole('button', { name: '年間売上を3つの節目で' }).click();
  const intro = page.getByRole('textbox', { name: '資料の要望' });
  await intro.press('Shift+Enter');
  assert.equal(await intro.inputValue(), '年間売上を3つの節目で\n');
  await page.getByLabel('生成モデル').selectOption('mock');
  await shot('home');
  await intro.press('Enter');
  await page.waitForFunction(() => window.streamPaints.some((paint) =>
    paint.title === '今年の売上はどう伸びたか' && paint.position === '1 / 1' && paint.duringGeneration));
  await shot('stream');
  await version(1);
  const paints = await page.evaluate(() => window.streamPaints);
  await headline('今年の売上はどう伸びたか');
  assert.deepEqual(events.filter((e) => e.type === 'preview').map((e) => e.preview.slides.length), [1,2,3]);
  assert.deepEqual(events.filter((e) => e.type === 'phase').map((e) => e.phase), ['yaml','build','check']);

  // Hold the actual node while using presentation keys. Endpoint seeking via the filmstrip
  // must produce the same opacity, heading and data as the end of the timed transition.
  const graph = await active().locator('.shared-chart').elementHandle();
  const barState = () => active().locator('.chart-bar').evaluateAll((bars) => bars.map((bar) => [bar.dataset.value, getComputedStyle(bar).opacity]));
  const assertIdentity = () => graph.evaluate((node) => node === document.querySelector('.slide.active .shared-chart')).then((same) => assert.ok(same));
  await active().locator('.chart-headline').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('ArrowRight');
  await headline('成長は下半期に集中');
  const half = await barState();
  assert.deepEqual(half.map(([,a]) => a), [...Array(6).fill('0.28'), ...Array(6).fill('1')]);
  await assertIdentity();
  await page.getByRole('button', { name: '全画面で発表' }).click();
  await page.waitForFunction(() => document.fullscreenElement?.matches('.deck-frame'));
  await page.keyboard.press('ArrowRight');
  await active().locator('.chart-annotation').filter({ hasText: '法人契約が増加' }).waitFor();
  await assertIdentity();
  await page.keyboard.press('ArrowLeft'); await headline('成長は下半期に集中');
  await page.evaluate(() => document.exitFullscreen());
  await thumb(1).click(); await headline('今年の売上はどう伸びたか');
  await thumb(2).click(); await headline('成長は下半期に集中');
  assert.deepEqual(await barState(), half); await assertIdentity();

  await page.getByRole('button', { name: 'この区間を修正' }).click();
  assert.match(await page.locator('.scope').innerText(), /年間売上 → 下半期の切り替え/);
  await page.getByRole('textbox', { name: '修正の依頼' }).fill('グラフは残して、見出しをもう少し遅く出して');
  await shot('target');
  await page.getByRole('button', { name: '送信' }).click(); await version(2);
  async function replay(before) {
    await page.getByRole('button', { name: before ? '変更前 v1' : '変更後 v2' }).click();
    await headline('今年の売上はどう伸びたか');
    const beginning = await active().evaluate(() => window.replayStart);
    await headline('成長は下半期に集中');
    return beginning;
  }
  const before = await replay(true);
  const after = await replay(false);
  assert.deepEqual(before, after);
  assert.equal(after.headline, '今年の売上はどう伸びたか');
  assert.deepEqual(after.opacity, Array(12).fill('1'));
  await shot('compare');

  await thumb(3).click(); await page.getByRole('button', { name: 'この1枚を修正' }).click();
  assert.match(await page.locator('.scope').innerText(), /対象：3枚目/);
  await submit('見出しを「法人向けの伸び」に変更', 3);
  await headline('法人向けの伸び');
  await page.getByRole('button', { name: 'この1枚を修正' }).click(); await page.locator('.scope').click();
  await submit('資料全体のタイトルを「年度レビュー」に変更', 4);
  await page.getByLabel('表示する版').selectOption('1'); await version(1);
  await thumb(3).click();
  await headline('10月の成長を支えた契約');
  await shot('history');
  await page.getByRole('button', { name: 'この版を復元' }).click(); await version(5);

  async function download(label, file) {
    await page.getByLabel('書き出し', { exact: true }).click();
    const [downloaded] = await Promise.all([
      page.waitForEvent('download', { timeout: 90000 }),
      page.getByRole('button', { name: label, exact: true }).click(),
    ]); await downloaded.saveAs(join(files, file));
    assert.equal(await downloaded.failure(), null);
  }
  for (const [label,file] of [['単体 HTML','deck.html'],['PDF','deck.pdf'],['PowerPoint（PPTX）','deck.pptx'],['バックアップ JSON','backup.json']]) {
    await download(label, file);
  }
  const backup = JSON.parse(await readFile(join(files, 'backup.json'), 'utf8'));
  assert.equal(backup.versions.length, 5); assert.equal(backup.messages.length, 9);
  const [a,b,c,d,r] = backup.versions.map((v) => parse(v.yaml));
  assert.deepEqual(r,a); assert.equal(backup.versions[0].yaml, backup.versions[4].yaml);
  const timing = b.slides[1].transition;
  assert.ok(timing.headlineDelay > a.slides[1].transition.headlineDelay);
  const patched = structuredClone(a); patched.slides[1].transition = timing;
  assert.deepEqual(patched, b);
  assert.deepEqual(c.slides.slice(0,2), b.slides.slice(0,2)); assert.deepEqual(c.charts,b.charts);
  assert.equal(c.slides[2].headline,'法人向けの伸び'); assert.equal(d.meta.title,'年度レビュー');
  assert.deepEqual(d.slides[2], c.slides[2]); assert.equal(d.slides[0].headline,'年度レビュー');

  await page.reload();
  await page.getByRole('heading', { name: '最近の資料' }).waitFor();
  await page.locator('.recent button').first().click(); await version(5);
  assert.equal(await page.locator('.message').count(), backup.messages.length);
  await headline('今年の売上はどう伸びたか');
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const imported = await fresh.newPage(); await imported.goto(base);
  await imported.locator('input[type=file]').setInputFiles(join(files,'backup.json'));
  await version(5, imported);
  for (const n of [2,3,4,1]) {
    await imported.getByLabel('表示する版').selectOption(String(n)); await version(n, imported);
    assert.equal(await imported.locator('.thumb').count(), 3);
  }
  const restored = await imported.evaluate(async () => {
    const req = indexedDB.open('urushi-editor');
    const db = await new Promise((resolve) => req.onsuccess = () => resolve(req.result));
    const all = db.transaction('projects').objectStore('projects').getAll();
    return new Promise((resolve) => all.onsuccess = () => resolve(all.result[0]));
  });
  assert.deepEqual(restored.messages, backup.messages); assert.deepEqual(restored.versions, backup.versions);
  await fresh.close();

  const offline = await context.newPage();
  await offline.route(/^https?:/, (route) => route.abort());
  await offline.goto(pathToFileURL(join(files, 'deck.html')).href);
  const node = await offline.locator('.slide.active .shared-chart').elementHandle();
  for (const [key,heading] of [['ArrowRight','成長は下半期に集中'],['ArrowRight','10月の成長を支えた契約'],['ArrowLeft','成長は下半期に集中']]) {
    await offline.keyboard.press(key);
    await offline.locator('.slide.active .chart-headline').filter({ hasText: heading }).waitFor();
    assert.ok(await node.evaluate((el) => el === document.querySelector('.slide.active .shared-chart')));
    if (heading.startsWith('10月')) {
      await offline.waitForFunction(() => getComputedStyle(document.querySelector('.slide.active .chart-annotation')).opacity === '1');
      assert.match(await offline.locator('.slide.active .chart-breakdown').textContent(), /法人契約68個人契約28/);
      assert.equal(await offline.locator('.slide.active .chart-annotation').innerText(), '法人契約が増加');
      await offline.waitForTimeout(300);
      assert.match(await offline.locator('.slide.active .chart-header').innerText(), /10月/);
    }
  }
  if (evidence) await writeFile(join(files,'mock.json'), JSON.stringify({
    stream: events.filter((e) => e.type === 'preview').slice(0,3).map((e) => e.preview.slides.length),
    paints,
    versions: backup.versions.length, messages: backup.messages.length,
    headlineDelay: [a.slides[1].transition.headlineDelay, timing.headlineDelay],
    sameReplayStart: before, browser: browser.version(),
  }, null, 2));
  assert.deepEqual(errors, []);
});
