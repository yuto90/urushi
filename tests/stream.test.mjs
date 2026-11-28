import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { SlideStream } from '../dist/ai/stream.js';
import { applyReply, prepareEdit } from '../dist/ai/revision.js';
import { parseDeckYaml } from '../dist/schema/index.js';

test('complete block entries only, across arbitrary chunks, nested lists and multiline text', () => {
  const prefix = 'version: 1\nmeta: { title: Stream }\nslides:\n';
  const first = '  - type: conclusion\n    title: One\n    conclusion: |-\n      第一段落\n      - 本文中の箇条書き\n    evidence:\n      - 根拠\n';
  const second = '  - type: conclusion\n    title: Two\n    conclusion: 完成\n';
  const seen = [];
  const stream = new SlideStream((deck) => seen.push(deck.slides.map((s) => s.title)));
  const feed = (text) => { for (const c of text) stream.push(c); };
  feed('```yaml\n' + prefix + first); assert.deepEqual(seen, []);
  feed(second); assert.deepEqual(seen, [['One']]);
  stream.finish(prefix + first + second);
  assert.deepEqual(seen, [['One'], ['One', 'Two']]);
});

test('scoped edits validate the addressed interval and preserve adjacent data', async () => {
  const yaml = await readFile('examples/annual-sales.yaml', 'utf8');
  const base = parse(yaml);
  const request = { yaml, target: { kind: 'transition', index: 1 } };
  assert.throws(() => prepareEdit({ yaml, target: { kind: 'slide', index: 9 } }, '編集'));
  const timing = { ...base.slides[1].transition, headlineDelay: 2 };
  assert.throws(() => applyReply(request, JSON.stringify({ ...timing, other: true })));
  const edited = parse(applyReply(request, JSON.stringify(timing)));
  base.slides[1].transition = timing;
  assert.deepEqual(edited, base);
  assert.equal(parseDeckYaml(yaml.replace('chartId: monthly-sales', 'chartId: missing')).ok, false);
});
