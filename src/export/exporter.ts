import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pptxgen from 'pptxgenjs';
import { captureSlideScreenshots, launchChromium } from '../check/index.js';
import type { Deck } from '../schema/index.js';

export interface ExportResult {
  pdfPath?: string;
  pptxPath?: string;
  screenshots: string[];
}

export async function exportPdf(htmlPath: string, pdfPath: string): Promise<string> {
  const browser = await launchChromium();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(`${pathToFileURL(resolve(htmlPath)).href}?print=1&static=1`, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: pdfPath,
      width: '1920px',
      height: '1080px',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return pdfPath;
  } finally {
    await browser.close();
  }
}

export async function exportPptx(screenshots: string[], pptxPath: string, deck?: Deck): Promise<string> {
  const PptxGen = pptxgen as unknown as new () => any;
  const pptx = new PptxGen();
  pptx.defineLayout({ name: 'URUSHI_WIDE', width: 13.333, height: 7.5 });
  pptx.layout = 'URUSHI_WIDE';
  pptx.author = deck?.meta.author ?? 'Urushi';
  pptx.title = deck?.meta.title ?? 'Urushi deck';
  screenshots.forEach((screenshot, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: '101319' };
    slide.addImage({ path: screenshot, x: 0, y: 0, w: 13.333, h: 7.5 });
    const notes = deck?.slides[index]?.notes;
    if (notes) slide.addNotes(notes);
  });
  await pptx.writeFile({ fileName: pptxPath });
  return pptxPath;
}

export async function exportDeck(
  htmlPath: string,
  outputDir: string,
  options: { pdf?: boolean; pptx?: boolean; deck?: Deck } = {},
): Promise<ExportResult> {
  await mkdir(outputDir, { recursive: true });
  const screenshotsDir = join(outputDir, 'screenshots');
  const screenshots = await captureSlideScreenshots(htmlPath, screenshotsDir);
  const result: ExportResult = { screenshots };
  if (options.pdf) result.pdfPath = await exportPdf(htmlPath, join(outputDir, 'deck.pdf'));
  if (options.pptx) result.pptxPath = await exportPptx(screenshots, join(outputDir, 'deck.pptx'), options.deck);
  return result;
}
