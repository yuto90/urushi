import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { loadAnimationCatalog } from '../animations/index.js';
import { checkRenderedDeck, type CheckError } from '../check/index.js';
import { buildDeck, schemaErrorsFromZod, schemaIssueToCheckError } from '../pipeline.js';
import { parseDeckYaml, type Deck } from '../schema/index.js';
import { createAiProvider, extractYamlText, fixPrompt, generationPrompt } from './index.js';
import { applyReply, prepareEdit, revisionPrompt, type Revision } from './revision.js';
import { SlideStream } from './stream.js';
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

export type Phase = 'yaml' | 'build' | 'check' | 'fix';
interface Options {
  overview: string;
  outDir: string;
  provider?: AiProvider;
  maxIterations?: number;
  onIteration?: (iteration: LoopIteration) => void;
  onText?: (chars: number) => void;
  onPhase?: (phase: Phase, iteration: number) => void;
  onPreview?: (deck: Deck, iteration: number) => void;
}

async function screenshotInputs(paths: string[], errors: CheckError[]): Promise<AiImageInput[]> {
  const slides = [...new Set(errors.map((error) => error.slide).filter((i) => paths[i - 1]))].slice(0, 2);
  return Promise.all(slides.map(async (i) => ({
    path: paths[i - 1], mimeType: 'image/png' as const, dataBase64: await readFile(paths[i - 1], 'base64'),
  })));
}

async function runLoop(options: Options, original?: string, revision?: Revision): Promise<GenerationResult> {
  const outDir = resolve(options.outDir);
  await mkdir(outDir, { recursive: true });
  const animations = await loadAnimationCatalog(process.cwd());
  const provider = options.provider ?? createAiProvider();
  const edit = revision && prepareEdit(revision, options.overview);
  const iterations: LoopIteration[] = [];
  const deckPath = join(outDir, 'deck.yaml');
  let yaml = original ?? '';
  let lastReply = '';
  let htmlPath: string | undefined;
  let errors: CheckError[] = [];
  let screenshots: string[] = [];
  const attempts = options.maxIterations ?? 3;
  if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error('maxIterations は1以上の整数を指定してください');
  for (let iteration = 1; iteration <= attempts; iteration++) {
    let patchError: CheckError | undefined;
    if (!original || iteration > 1 || revision) {
      options.onPhase?.(iteration === 1 ? 'yaml' : 'fix', iteration);
      const scoped = edit && edit.target.kind !== 'deck';
      const stream = options.onPreview && !scoped
        ? new SlideStream((deck) => options.onPreview!(deck, iteration)) : undefined;
      let prompt: string;
      if (edit && revision && (iteration === 1 || scoped)) {
        prompt = revisionPrompt(edit, revision.yaml);
        if (iteration > 1) prompt += `\n前回の出力:\n${lastReply}\n同じ対象範囲で検証エラーを直してください:\n${JSON.stringify(errors)}`;
      } else if (iteration > 1) {
        prompt = fixPrompt({ overview: options.overview, currentYaml: yaml, animations, errors });
      } else prompt = generationPrompt(options.overview, animations);
      let chars = 0;
      let reportedAt = 0;
      const raw = await provider.complete({
        prompt, edit: iteration === 1 || scoped ? edit : undefined,
        images: await screenshotInputs(screenshots, errors),
        onText: options.onText || stream ? (chunk) => {
          stream?.push(chunk);
          chars += chunk.length;
          if (Date.now() - reportedAt > 100) { options.onText?.(chars); reportedAt = Date.now(); }
        } : undefined,
      });
      if (chars) options.onText?.(chars);
      lastReply = scoped ? raw.trim().replace(/^```(?:yaml|yml)?\s*|\s*```$/gi, '') : extractYamlText(raw);
      try {
        yaml = revision ? applyReply(revision, lastReply) : lastReply;
        stream?.finish(yaml);
      } catch (error) {
        patchError = schemaIssueToCheckError('slides', String(error));
      }
    }
    const parsed = parseDeckYaml(yaml);
    errors = patchError ? [patchError] : parsed.ok ? [] : schemaErrorsFromZod(parsed.errors);
    screenshots = [];
    htmlPath = undefined;
    if (parsed.ok && !patchError) {
      options.onPhase?.('build', iteration);
      const directory = iteration === 1 ? outDir : join(outDir, `iteration-${iteration}`);
      await mkdir(directory, { recursive: true });
      const candidatePath = join(directory, 'deck.yaml');
      await writeFile(candidatePath, yaml);
      const build = await buildDeck(candidatePath, directory);
      htmlPath = build.htmlPath;
      options.onPhase?.('check', iteration);
      const check = await checkRenderedDeck(htmlPath, { screenshotsDir: join(directory, 'screenshots') });
      errors = [...build.semanticErrors, ...check.errors];
      screenshots = check.screenshots;
    }
    const record = { iteration, yaml, errors, screenshots, validSchema: parsed.ok && !patchError };
    iterations.push(record);
    options.onIteration?.(record);
    if (!errors.length) break;
  }
  await writeFile(deckPath, yaml);
  if (htmlPath && htmlPath !== join(outDir, 'index.html')) {
    await copyFile(htmlPath, join(outDir, 'index.html'));
    htmlPath = join(outDir, 'index.html');
  }
  return { provider: provider.name, model: provider.model, outDir, deckPath, htmlPath,
    ok: !errors.length, iterations, finalErrors: errors };
}

export function generateWithFixLoop(options: Options) {
  return runLoop(options);
}

export async function fixExistingDeck(options: Omit<Options, 'overview' | 'outDir'> & {
  deckPath: string; overview?: string; outDir?: string; target?: Revision['target'];
}) {
  const original = await readFile(options.deckPath, 'utf8');
  const result = await runLoop({ ...options, overview: options.overview ?? '既存 deck.yaml の修正',
    outDir: options.outDir ?? join('out', 'fix') }, original,
    options.target ? { yaml: original, target: options.target } : undefined);
  const fixed = join(result.outDir, 'deck.fixed.yaml');
  await writeFile(fixed, await readFile(result.deckPath));
  return { ...result, deckPath: fixed };
}

export function deckFromYamlText(yamlText: string): Deck | undefined {
  const parsed = parseDeckYaml(yamlText);
  return parsed.ok ? parsed.deck : undefined;
}
export function parseLenientYaml(yamlText: string): unknown { return parseYaml(yamlText); }
