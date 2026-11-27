import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { stringify } from 'yaml';
import type { AnimationSpec } from './animations/index.js';
import { loadAnimationCatalog } from './animations/index.js';
import { checkOutputName, checkRenderedDeck, type CheckError, type CheckResult } from './check/index.js';
import { renderDeckHtml } from './render/index.js';
import { parseDeckYaml, validateDeck, type Deck, zodIssuePath } from './schema/index.js';

export interface BuildResult {
  outDir: string;
  htmlPath: string;
  deckPath: string;
  deck: Deck;
  animations: AnimationSpec[];
  warnings: string[];
  semanticErrors: CheckError[];
}

export class DeckValidationError extends Error {
  constructor(public readonly errors: CheckError[]) {
    super(`deck.yaml の検証に失敗しました (${errors.length}件)`);
  }
}

function formatPath(parts: Array<string | number>): string {
  let out = '';
  for (const part of parts) {
    if (typeof part === 'number') out += `[${part}]`;
    else out += out ? `.${part}` : part;
  }
  return out;
}

export function schemaIssueToCheckError(issuePath: string, message: string): CheckError {
  const rawParts = issuePath ? issuePath.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part)) : [];
  let slide = 0;
  let rest: Array<string | number> = rawParts;
  if (rawParts[0] === 'slides' && typeof rawParts[1] === 'number') {
    slide = Number(rawParts[1]) + 1;
    rest = rawParts.slice(2);
  } else if (rawParts[0] === 'meta') {
    rest = rawParts;
  }
  return {
    slide,
    path: formatPath(rest) || 'deck',
    rule: message.includes('too_big') || message.includes('Too big') ? 'text-volume' : 'schema',
    measured: 1,
    limit: 1,
    unit: 'schema',
    hint: message,
  };
}

export function schemaErrorsFromZod(errors: Array<{ path: Array<string | number | symbol>; message: string }>): CheckError[] {
  return errors.map((issue) => schemaIssueToCheckError(zodIssuePath(issue as never), issue.message));
}

export async function readDeckFile(deckPath: string): Promise<Deck> {
  const text = await readFile(deckPath, 'utf8');
  const parsed = parseDeckYaml(text);
  if (!parsed.ok) throw new DeckValidationError(schemaErrorsFromZod(parsed.errors as never));
  return parsed.deck;
}

export function validateDeckOrThrow(input: unknown): Deck {
  const parsed = validateDeck(input);
  if (!parsed.ok) throw new DeckValidationError(schemaErrorsFromZod(parsed.errors as never));
  return parsed.deck;
}

function slidePath(slideIndex: number, path: string): Pick<CheckError, 'slide' | 'path'> {
  return { slide: slideIndex + 1, path };
}

export function semanticErrors(deck: Deck, animations: AnimationSpec[]): CheckError[] {
  const names = new Set(animations.map((spec) => spec.name));
  const errors: CheckError[] = [];
  deck.slides.forEach((slide, index) => {
    if (slide.animation && !names.has(slide.animation)) {
      errors.push({
        ...slidePath(index, 'animation'),
        rule: 'animation',
        measured: 1,
        limit: 0,
        unit: 'name',
        hint: `animation はカタログ内の名前にしてください: ${[...names].join(', ')}`,
      });
    }
  });
  return errors;
}

export function customHtmlWarnings(deck: Deck): string[] {
  const warnings: string[] = [];
  deck.slides.forEach((slide, index) => {
    if (slide.type !== 'custom') return;
    const rawColor = slide.html.match(/#[0-9a-fA-F]{3,8}|rgba?\(/);
    if (rawColor) {
      warnings.push(`slide ${index + 1}: custom HTML に生の色指定があります。CSSカスタムプロパティを使ってください`);
    }
    const hardCodedStyle = slide.html.match(/style="[^"]*(color|background|font-family|border-radius)[^"]*"/);
    if (hardCodedStyle && !hardCodedStyle[0].includes('var(--urushi-')) {
      warnings.push(`slide ${index + 1}: custom HTML の見た目指定はトークン参照に寄せてください`);
    }
  });
  return warnings;
}

export async function buildDeck(deckPath: string, outDir?: string): Promise<BuildResult> {
  const absoluteDeckPath = resolve(deckPath);
  const deck = await readDeckFile(absoluteDeckPath);
  const animations = await loadAnimationCatalog(process.cwd());
  const errors = semanticErrors(deck, animations);
  const outputDirectory = resolve(outDir ?? join('out', checkOutputName(absoluteDeckPath)));
  await mkdir(outputDirectory, { recursive: true });
  const html = renderDeckHtml(deck, animations);
  const htmlPath = join(outputDirectory, 'index.html');
  const copiedDeckPath = join(outputDirectory, 'deck.yaml');
  await writeFile(htmlPath, html, 'utf8');
  await copyFile(absoluteDeckPath, copiedDeckPath);
  return {
    outDir: outputDirectory,
    htmlPath,
    deckPath: copiedDeckPath,
    deck,
    animations,
    warnings: customHtmlWarnings(deck),
    semanticErrors: errors,
  };
}

export async function writeDeckFile(deck: Deck, deckPath: string): Promise<void> {
  await mkdir(resolve(deckPath, '..'), { recursive: true });
  await writeFile(deckPath, stringify(deck), 'utf8');
}

export async function buildAndCheck(deckPath: string, outDir?: string): Promise<{ build: BuildResult; check: CheckResult }> {
  const build = await buildDeck(deckPath, outDir);
  const check = await checkRenderedDeck(build.htmlPath, { screenshotsDir: join(build.outDir, 'screenshots') });
  check.errors.unshift(...build.semanticErrors);
  check.ok = check.errors.length === 0;
  return { build, check };
}

export function outputName(input: string): string {
  return basename(input).replace(/\.(ya?ml|html)$/i, '') || 'deck';
}
