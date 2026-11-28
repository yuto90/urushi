import { mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Page } from 'playwright-core';
import { launchChromium, openDeckDocument } from './chromium.js';
import type { CheckError, CheckResult } from './types.js';

interface BrowserCheckPayload {
  overflow: CheckError[];
  overlap: CheckError[];
  contrast: CheckError[];
  volume: CheckError[];
}

async function openDeckPage(htmlPath: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const browser = await launchChromium();
  try {
    const page = await openDeckDocument(browser, htmlPath, '?static=1');
    await page.waitForFunction(() => Boolean((window as unknown as { __urushi?: unknown }).__urushi));
    return { page, close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function gotoSlide(page: Page, index: number): Promise<void> {
  await page.evaluate((slideIndex) => {
    const runtime = (window as unknown as { __urushi: { go: (index: number, options?: object) => void } }).__urushi;
    runtime.go(slideIndex, { animate: false, hash: false });
  }, index);
  await page.waitForTimeout(30);
}

async function measureSlide(page: Page, slideNumber: number): Promise<CheckError[]> {
  const payload = await page.evaluate((slide): BrowserCheckPayload => {
    const active = document.querySelector('.slide.active') as HTMLElement | null;
    const empty: BrowserCheckPayload = { overflow: [], overlap: [], contrast: [], volume: [] };
    if (!active) return empty;

    const pathOf = (el: Element) => el.getAttribute('data-check-path') || el.tagName.toLowerCase();
    const visible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const push = (target: CheckError[], entry: Omit<CheckError, 'slide'>) => {
      target.push({ slide, ...entry });
    };

    const textElements = Array.from(active.querySelectorAll('[data-check-text]')).filter(visible);
    for (const el of textElements) {
      const rect = el.getBoundingClientRect();
      const container = (el.closest('.u-card') || el.closest('.comparison-panel') || el.closest('.slide-body') || active) as HTMLElement;
      const bounds = container.getBoundingClientRect();
      const horizontal = Math.max(el.scrollWidth - el.clientWidth, rect.right - bounds.right);
      const vertical = Math.max(el.scrollHeight - el.clientHeight, rect.bottom - bounds.bottom);
      if (horizontal > 8 || vertical > 8) {
        const measured = Math.ceil(Math.max(horizontal, vertical));
        push(empty.overflow, {
          path: pathOf(el),
          rule: 'text-overflow',
          measured,
          limit: 8,
          unit: 'px',
          hint: '文字を40〜60%に縮めるか、項目を分割してください',
        });
      }
    }

    for (const el of textElements) {
      const maxChars = Number(el.getAttribute('data-max-chars') || '0');
      const length = (el.textContent || '').trim().length;
      if (maxChars > 0 && length > maxChars) {
        push(empty.volume, {
          path: pathOf(el),
          rule: 'text-volume',
          measured: length,
          limit: maxChars,
          unit: 'chars',
          hint: '表示用の文字量を超えています。文言を短くするか項目を分けてください',
        });
      }
    }

    const candidates = Array.from(active.querySelectorAll('.u-card, .comparison-panel, .verdict-strip, .outcome-strip, .takeaway-strip, .implication-strip')).filter(visible);
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const a = candidates[i];
        const b = candidates[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        const width = Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.left, br.left));
        const height = Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));
        const intersection = width * height;
        const smaller = Math.min(ar.width * ar.height, br.width * br.height);
        if (smaller > 0 && intersection / smaller > 0.08) {
          push(empty.overlap, {
            path: 'layout',
            rule: 'element-overlap',
            measured: Math.round((intersection / smaller) * 100),
            limit: 8,
            unit: '%',
            hint: '要素数を減らすか、文字を短くしてカードの高さを抑えてください',
          });
        }
      }
    }

    const parseColor = (value: string): [number, number, number, number] | null => {
      const rgb = value.match(/rgba?\(([^)]+)\)/);
      if (rgb) {
        const parts = rgb[1].split(',').map((part) => Number(part.trim()));
        return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts.length > 3 ? parts[3] : 1];
      }
      const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
      if (hex) {
        const n = Number.parseInt(hex[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
      }
      return null;
    };
    const luminance = (color: [number, number, number, number]) => {
      const convert = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * convert(color[0]) + 0.7152 * convert(color[1]) + 0.0722 * convert(color[2]);
    };
    const contrastRatio = (fg: [number, number, number, number], bg: [number, number, number, number]) => {
      const a = luminance(fg);
      const b = luminance(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const tokenColor = (name: string) => parseColor(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
    const fallbackBg = tokenColor('--urushi-color-bg') || ([16, 19, 25, 1] as [number, number, number, number]);
    const panelBg = tokenColor('--urushi-color-panel') || fallbackBg;
    const effectiveBg = (el: Element): [number, number, number, number] => {
      let node: Element | null = el;
      while (node && node !== active) {
        const bg = parseColor(getComputedStyle(node).backgroundColor);
        if (bg && bg[3] > 0.1) {
          const base = el.closest('.u-card, .comparison-panel') ? panelBg : fallbackBg;
          const alpha = Math.min(1, Math.max(0, bg[3]));
          return [
            Math.round(bg[0] * alpha + base[0] * (1 - alpha)),
            Math.round(bg[1] * alpha + base[1] * (1 - alpha)),
            Math.round(bg[2] * alpha + base[2] * (1 - alpha)),
            1,
          ];
        }
        node = node.parentElement;
      }
      return el.closest('.u-card, .comparison-panel') ? panelBg : fallbackBg;
    };

    for (const el of textElements) {
      const style = getComputedStyle(el);
      const fg = parseColor(style.color);
      if (!fg) continue;
      const ratio = contrastRatio(fg, effectiveBg(el));
      const fontSize = Number.parseFloat(style.fontSize || '20');
      const limit = fontSize >= 30 || Number.parseInt(style.fontWeight || '400', 10) >= 700 ? 3 : 4.5;
      if (ratio < limit) {
        push(empty.contrast, {
          path: pathOf(el),
          rule: 'contrast',
          measured: Math.round(ratio * 100) / 100,
          limit,
          unit: 'ratio',
          hint: 'テーマの前景色か背景色を調整してください',
        });
      }
    }

    return empty;
  }, slideNumber);

  return [...payload.overflow, ...payload.overlap, ...payload.volume, ...payload.contrast];
}

export async function captureSlideScreenshots(htmlPath: string, outputDir: string): Promise<string[]> {
  await mkdir(outputDir, { recursive: true });
  const { page, close } = await openDeckPage(htmlPath);
  try {
    const count = await page.evaluate(() => (window as unknown as { __urushi: { count: () => number } }).__urushi.count());
    const screenshots: string[] = [];
    for (let index = 0; index < count; index += 1) {
      await gotoSlide(page, index);
      const file = join(outputDir, `slide-${String(index + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: file, fullPage: false });
      screenshots.push(file);
    }
    return screenshots;
  } finally {
    await close();
  }
}

export async function checkRenderedDeck(htmlPath: string, options: { screenshotsDir?: string } = {}): Promise<CheckResult> {
  const { page, close } = await openDeckPage(htmlPath);
  const errors: CheckError[] = [];
  const screenshots: string[] = [];
  try {
    const count = await page.evaluate(() => (window as unknown as { __urushi: { count: () => number } }).__urushi.count());
    if (options.screenshotsDir) await mkdir(options.screenshotsDir, { recursive: true });
    for (let index = 0; index < count; index += 1) {
      await gotoSlide(page, index);
      errors.push(...(await measureSlide(page, index + 1)));
      if (options.screenshotsDir) {
        const file = join(options.screenshotsDir, `slide-${String(index + 1).padStart(2, '0')}.png`);
        await page.screenshot({ path: file, fullPage: false });
        screenshots.push(file);
      }
    }
    return { ok: errors.length === 0, errors, screenshots };
  } finally {
    await close();
  }
}

export function checkOutputName(deckPath: string): string {
  return basename(deckPath).replace(/\.(ya?ml)$/i, '');
}
