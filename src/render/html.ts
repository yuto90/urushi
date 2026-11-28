import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToString } from 'preact-render-to-string';
import type { AnimationSpec } from '../animations/index.js';
import type { Deck, Slide } from '../schema/index.js';
import { ChartSlide, chartCss } from '../templates/chart.js';
import { SlideTemplate } from '../templates/index.js';
import { slideCss, tokenCss } from '../tokens/theme.js';
import { deckRuntimeJs } from './runtime.js';

const require = createRequire(import.meta.url);

function inlineSafe(text: string): string {
  return text.replace(/<\/script/gi, '<\\/script');
}

export function renderSlide(deck: Deck, slide: Slide, index: number): string {
  const body = renderToString(slide.type === 'chart'
    ? ChartSlide({ chart: deck.charts!.find((chart) => chart.id === slide.chartId)!, slide, index })
    : SlideTemplate({ slide, index }));
  const notes = slide.notes ? `<aside class="speaker-notes" hidden>${escapeHtml(slide.notes)}</aside>` : '';
  return `<section class="slide slide-${slide.type}" data-slide="${index + 1}" data-type="${slide.type}">${body}${notes}</section>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function serializableSpecs(specs: AnimationSpec[]): Record<string, AnimationSpec> {
  return Object.fromEntries(specs.map((spec) => [spec.name, spec]));
}

function policy(nonce?: string) {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${nonce ? "'nonce-" + nonce + "'" : "'none'"}; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'">`;
}

// The editor loads this frame while the provider is still writing its first page.
// Reuse its browsing context for each complete slide, including scoped custom markup.
export function renderStreamFrame() {
  const nonce = randomBytes(18).toString('base64');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">${policy(nonce)}
    <style>${tokenCss}${slideCss}${chartCss}</style></head><body>
    <div class="urushi-stage"><main class="urushi-deck"></main></div><div class="deck-footer"></div>
    <script nonce="${nonce}">
      const deck = document.querySelector('.urushi-deck');
      function scale() { deck.style.transform = 'translate(-50%,-50%) scale(' + Math.min(innerWidth / 1920, innerHeight / 1080) + ')'; }
      addEventListener('resize', scale);
      addEventListener('message', (event) => {
        if (event.source !== parent || parent === window || event.data?.type !== 'urushi:partial') return;
        deck.innerHTML = event.data.html;
        deck.firstElementChild?.classList.add('active');
        document.querySelector('.deck-footer').textContent = event.data.position;
        scale();
      });
      scale();
    </script></body></html>`;
}

export function renderThumbnail(deck: Deck, index: number) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">${policy()}<style>${tokenCss}${slideCss}${chartCss}
  svg.thumbnail{display:block;width:100vw;height:100vh}.thumbnail .slide{display:block}
  </style></head><body><svg class="thumbnail" viewBox="0 0 1920 1080"><foreignObject width="1920" height="1080"><div xmlns="http://www.w3.org/1999/xhtml">${renderSlide(deck, deck.slides[index], index)}</div></foreignObject></svg></body></html>`;
}

export function renderDeckHtml(deck: Deck, animationSpecs: AnimationSpec[]): string {
  let gsap = '';
  try {
    gsap = readFileSync(require.resolve('gsap/dist/gsap.min.js'), 'utf8');
  } catch {
    gsap = 'window.gsap=undefined;';
  }

  const slides = deck.slides.map((slide, index) => renderSlide(deck, slide, index)).join('\n');
  const nonce = randomBytes(18).toString('base64');
  const title = escapeHtml(deck.meta.title);
  const specJson = inlineSafe(JSON.stringify(serializableSpecs(animationSpecs)));
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
${policy(nonce)}
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${tokenCss}\n${slideCss}\n${chartCss}</style>
</head>
<body>
<div class="urushi-stage">
  <main class="urushi-deck" aria-label="${title}">
${slides}
  </main>
</div>
<div class="deck-footer" aria-live="polite"></div>
<script nonce="${nonce}">${inlineSafe(gsap)}</script>
<script nonce="${nonce}">window.__URUSHI_ANIMATIONS__=${specJson};</script>
<script nonce="${nonce}">${inlineSafe(deckRuntimeJs)}</script>
</body>
</html>`;
}
