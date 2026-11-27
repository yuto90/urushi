import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToString } from 'preact-render-to-string';
import type { AnimationSpec } from '../animations/index.js';
import type { Deck, Slide } from '../schema/index.js';
import { SlideTemplate } from '../templates/index.js';
import { slideCss, tokenCss } from '../tokens/theme.js';
import { deckRuntimeJs } from './runtime.js';

const require = createRequire(import.meta.url);

function inlineSafe(text: string): string {
  return text.replaceAll('</script', '<\\/script');
}

function renderSlide(slide: Slide, index: number): string {
  const body = renderToString(SlideTemplate({ slide, index }));
  const notes = slide.notes ? `<aside class="speaker-notes" hidden>${escapeHtml(slide.notes)}</aside>` : '';
  return `<section class="slide slide-${slide.type}" data-slide="${index + 1}" data-type="${slide.type}">${body}${notes}</section>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function serializableSpecs(specs: AnimationSpec[]): Record<string, AnimationSpec> {
  return Object.fromEntries(specs.map((spec) => [spec.name, spec]));
}

export function renderDeckHtml(deck: Deck, animationSpecs: AnimationSpec[]): string {
  let gsap = '';
  try {
    gsap = readFileSync(require.resolve('gsap/dist/gsap.min.js'), 'utf8');
  } catch {
    gsap = 'window.gsap=undefined;';
  }

  const slides = deck.slides.map(renderSlide).join('\n');
  const title = escapeHtml(deck.meta.title);
  const specJson = inlineSafe(JSON.stringify(serializableSpecs(animationSpecs)));
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${tokenCss}\n${slideCss}</style>
</head>
<body>
<div class="urushi-stage">
  <main class="urushi-deck" aria-label="${title}">
${slides}
  </main>
</div>
<div class="deck-footer" aria-live="polite"></div>
<script>${inlineSafe(gsap)}</script>
<script>window.__URUSHI_ANIMATIONS__=${specJson};</script>
<script>${inlineSafe(deckRuntimeJs)}</script>
</body>
</html>`;
}
