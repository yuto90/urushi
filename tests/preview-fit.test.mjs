import assert from 'node:assert/strict';
import test from 'node:test';
import { launchChromium } from '../dist/check/chromium.js';
import { renderDeckHtml } from '../dist/render/html.js';

test('a finished slide fills its sandbox after an initially zero-sized frame is revealed', async (t) => {
  const browser = await launchChromium();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const html = renderDeckHtml({ version: 1, meta: { title: 'Preview' },
    slides: [{ type: 'conclusion', title: 'First slide', conclusion: 'Visible after loading' }] }, []);
  await page.route('https://editor.test/deck', route => route.fulfill({ contentType: 'text/html', body: html }));
  // The production frame completed loading at zero size, without a subsequent window resize notification.
  await page.addInitScript(() => window.addEventListener('resize', event => event.stopImmediatePropagation(), true));
  await page.setContent('<iframe title="preview" style="border:0;width:0;height:0" sandbox="allow-scripts" src="https://editor.test/deck"></iframe>');
  const slide = page.frameLocator('iframe').locator('.slide.active');
  await slide.waitFor({ state: 'attached' });
  assert.equal((await slide.boundingBox()).width, 0);
  await page.locator('iframe').evaluate(frame => { frame.style.width = '640px'; frame.style.height = '360px'; });
  await slide.waitFor({ state: 'visible', timeout: 3000 });
  const box = await slide.boundingBox();
  assert.ok(Math.abs(box.width - 640) < 1 && Math.abs(box.height - 360) < 1);
});

test('process step numbers leave the headings fully visible in a finished preview', async (t) => {
  const browser = await launchChromium();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 746, height: 420 } });
  const html = renderDeckHtml({ version: 1, meta: { title: '図書館' }, slides: [{
    type: 'process', title: '本の借り方', steps: [{ title: '探す' }, { title: '借りる' }, { title: '返す' }],
  }] }, []);
  await page.setContent(html);

  const steps = await page.locator('.process-step').all();
  assert.equal(steps.length, 3);
  for (const step of steps) {
    const badge = await step.locator('.step-index').boundingBox();
    const heading = await step.getByRole('heading').boundingBox();
    assert.ok(heading.y > badge.y + badge.height, 'the step heading must begin below its number');
  }
});
