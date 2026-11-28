import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';
import { fixExistingDeck } from '../dist/ai/loop.js';
import { launchChromium } from '../dist/check/chromium.js';

test('a layout repair stays inside the selected slide and a flowchart keeps its nodes', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'urushi-scope-'));
  const source = { meta: { title: '工程' }, charts: [{ id: 'process', kind: 'flow', nodes: [{ label: '調査' },{ label: '開発' }] }],
    slides: [
      { type: 'chart', chartId: 'process', title: '全体', headline: '調査から開発へ' },
      { type: 'chart', chartId: 'process', title: '開発', headline: '実装を進める', highlight: ['開発'] },
    ] };
  const deckPath = join(dir, 'source.yaml');
  await writeFile(deckPath, stringify(source));
  const phases = [];
  let calls = 0;
  const fix = { ...source.slides[1], headline: '小さく試す' };
  const result = await fixExistingDeck({ deckPath, outDir: dir, overview: '2枚目を簡潔に', target: { kind: 'slide', index: 1 },
    onPhase: (phase, attempt) => phases.push([phase, attempt]),
    provider: { name: 'mock', model: 'scoped-test', async complete(request) {
      assert.deepEqual(request.edit.target, { kind: 'slide', index: 1 });
      if (calls++ === 0) return stringify({ type: 'conclusion', title: '結論', conclusion: '長'.repeat(100) });
      assert.ok(request.images.length); assert.match(request.prompt, /text-volume/);
      return stringify(fix);
    } },
  });
  assert.equal(result.ok, true); assert.equal(result.iterations.length, 2);
  assert.deepEqual(phases, [['yaml',1],['build',1],['check',1],['fix',2],['build',2],['check',2]]);
  assert.deepEqual(parse(await readFile(result.deckPath, 'utf8')), { ...source, slides: [source.slides[0],fix] });
  const browser = await launchChromium();
  t.after(() => browser.close());
  const page = await browser.newPage(); await page.goto(pathToFileURL(result.htmlPath).href);
  const node = await page.locator('.slide.active .flow-node').first().elementHandle();
  await page.keyboard.press('ArrowRight');
  await page.locator('.slide.active h1').filter({ hasText: '小さく試す' }).waitFor();
  assert.ok(await node.evaluate((el) => el === document.querySelector('.slide.active .flow-node')));
  assert.equal(await node.evaluate((el) => getComputedStyle(el).opacity), '0.28');
});
