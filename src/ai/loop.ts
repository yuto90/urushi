import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stringify, parse as parseYaml } from 'yaml';
import { loadAnimationCatalog, type AnimationSpec } from '../animations/index.js';
import { checkRenderedDeck } from '../check/index.js';
import type { CheckError, CheckResult } from '../check/index.js';
import { buildDeck, DeckValidationError, schemaErrorsFromZod, writeDeckFile } from '../pipeline.js';
import { parseDeckYaml, type Deck } from '../schema/index.js';
import { createAiProvider, extractYamlText, fixPrompt, generationPrompt } from './index.js';
import type { AiImageInput, AiProvider } from './types.js';

export interface LoopIteration {
  iteration: number;
  yaml: string;
  errors: CheckError[];
  screenshots: string[];
  validSchema: boolean;
}

export interface GenerationResult {
  provider: string;
  model: string;
  outDir: string;
  deckPath: string;
  htmlPath?: string;
  ok: boolean;
  iterations: LoopIteration[];
  finalErrors: CheckError[];
}

async function loadScreenshotInputs(paths: string[], slideNumbers: number[]): Promise<AiImageInput[]> {
  const selected = new Set<number>();
  for (const slide of slideNumbers) {
    if (slide > 0) selected.add(slide);
    if (selected.size >= 2) break;
  }
  const images: AiImageInput[] = [];
  for (const slide of selected) {
    const path = paths[slide - 1];
    if (!path) continue;
    images.push({ path, mimeType: 'image/png', dataBase64: await readFile(path, 'base64') });
  }
  return images;
}

function validationErrors(yamlText: string): CheckError[] | null {
  const parsed = parseDeckYaml(yamlText);
  if (parsed.ok) return null;
  return schemaErrorsFromZod(parsed.errors as never);
}

async function evaluateYaml(yamlText: string, outDir: string): Promise<{ deck?: Deck; errors: CheckError[]; screenshots: string[]; htmlPath?: string; validSchema: boolean }> {
  const schemaErrors = validationErrors(yamlText);
  if (schemaErrors) return { errors: schemaErrors, screenshots: [], validSchema: false };
  const deckPath = join(outDir, 'deck.yaml');
  await writeFile(deckPath, yamlText, 'utf8');
  try {
    const build = await buildDeck(deckPath, outDir);
    const check: CheckResult = await checkRenderedDeck(build.htmlPath, { screenshotsDir: join(outDir, 'screenshots') });
    const errors = [...build.semanticErrors, ...check.errors];
    return { deck: build.deck, errors, screenshots: check.screenshots, htmlPath: build.htmlPath, validSchema: true };
  } catch (error) {
    if (error instanceof DeckValidationError) return { errors: error.errors, screenshots: [], validSchema: false };
    throw error;
  }
}

export async function generateWithFixLoop(options: {
  overview: string;
  outDir: string;
  provider?: AiProvider;
  maxIterations?: number;
  onIteration?: (iteration: LoopIteration) => void;
}): Promise<GenerationResult> {
  const outDir = resolve(options.outDir);
  await mkdir(outDir, { recursive: true });
  const animations = await loadAnimationCatalog(process.cwd());
  const provider = options.provider ?? createAiProvider();
  const maxIterations = options.maxIterations ?? 3;
  const iterations: LoopIteration[] = [];

  let yaml = extractYamlText(await provider.complete({ prompt: generationPrompt(options.overview, animations), maxOutputTokens: 8192 }));
  let finalErrors: CheckError[] = [];
  let htmlPath: string | undefined;
  let ok = false;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const iterationDir = iteration === 1 ? outDir : join(outDir, `iteration-${iteration}`);
    await mkdir(iterationDir, { recursive: true });
    const evaluated = await evaluateYaml(yaml, iterationDir);
    finalErrors = evaluated.errors;
    htmlPath = evaluated.htmlPath;
    const record = {
      iteration,
      yaml,
      errors: evaluated.errors,
      screenshots: evaluated.screenshots,
      validSchema: evaluated.validSchema,
    };
    iterations.push(record);
    options.onIteration?.(record);
    if (evaluated.errors.length === 0) {
      ok = true;
      if (iterationDir !== outDir) {
        await writeFile(join(outDir, 'deck.yaml'), yaml, 'utf8');
        const finalBuild = await buildDeck(join(outDir, 'deck.yaml'), outDir);
        htmlPath = finalBuild.htmlPath;
      }
      break;
    }
    if (iteration === maxIterations) break;
    const images = await loadScreenshotInputs(evaluated.screenshots, evaluated.errors.map((error) => error.slide));
    yaml = extractYamlText(await provider.complete({
      prompt: fixPrompt({ overview: options.overview, currentYaml: yaml, errors: evaluated.errors, animations }),
      images,
      maxOutputTokens: 8192,
    }));
  }

  const deckPath = join(outDir, 'deck.yaml');
  await writeFile(deckPath, yaml, 'utf8');
  return {
    provider: provider.name,
    model: provider.model,
    outDir,
    deckPath,
    htmlPath,
    ok,
    iterations,
    finalErrors,
  };
}

export async function fixExistingDeck(options: {
  deckPath: string;
  overview?: string;
  outDir?: string;
  provider?: AiProvider;
  maxIterations?: number;
  onIteration?: (iteration: LoopIteration) => void;
}): Promise<GenerationResult> {
  const originalYaml = await readFile(options.deckPath, 'utf8');
  const outDir = resolve(options.outDir ?? join('out', 'fix'));
  await mkdir(outDir, { recursive: true });
  const animations: AnimationSpec[] = await loadAnimationCatalog(process.cwd());
  const provider = options.provider ?? createAiProvider();
  const maxIterations = options.maxIterations ?? 3;
  const overview = options.overview ?? '既存 deck.yaml の修正';
  const iterations: LoopIteration[] = [];
  let yaml = originalYaml;
  let finalErrors: CheckError[] = [];
  let htmlPath: string | undefined;
  let ok = false;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const evaluated = await evaluateYaml(yaml, outDir);
    finalErrors = evaluated.errors;
    htmlPath = evaluated.htmlPath;
    const record = { iteration, yaml, errors: evaluated.errors, screenshots: evaluated.screenshots, validSchema: evaluated.validSchema };
    iterations.push(record);
    options.onIteration?.(record);
    if (!evaluated.errors.length) {
      ok = true;
      break;
    }
    if (iteration === maxIterations) break;
    const images = await loadScreenshotInputs(evaluated.screenshots, evaluated.errors.map((error) => error.slide));
    yaml = extractYamlText(await provider.complete({
      prompt: fixPrompt({ overview, currentYaml: yaml, errors: evaluated.errors, animations }),
      images,
      maxOutputTokens: 8192,
    }));
  }

  const fixedDeckPath = join(outDir, 'deck.fixed.yaml');
  await writeFile(fixedDeckPath, yaml, 'utf8');
  return { provider: provider.name, model: provider.model, outDir, deckPath: fixedDeckPath, htmlPath, ok, iterations, finalErrors };
}

export function deckFromYamlText(yamlText: string): Deck | undefined {
  try {
    const parsed = parseDeckYaml(yamlText);
    return parsed.ok ? parsed.deck : undefined;
  } catch {
    return undefined;
  }
}

export function parseLenientYaml(yamlText: string): unknown {
  return parseYaml(yamlText);
}
