#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createAiProvider, fixExistingDeck, generateWithFixLoop } from './ai/index.js';
import type { ProviderName } from './config.js';
import { loadDotEnv } from './config.js';
import { checkRenderedDeck } from './check/index.js';
import { exportDeck } from './export/index.js';
import { buildAndCheck, buildDeck, DeckValidationError, outputName, readDeckFile } from './pipeline.js';
import { deckJsonSchema } from './schema/index.js';
import { startServer } from './server.js';
import { startMcpServer } from './mcp.js';

interface ParsedArgs {
  positional: string[];
  options: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq >= 0) {
      options[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      options[arg.slice(2)] = argv[index + 1];
      index += 1;
    } else {
      options[arg.slice(2)] = true;
    }
  }
  return { positional, options };
}

function optionString(options: ParsedArgs['options'], name: string): string | undefined {
  const value = options[name];
  return typeof value === 'string' ? value : undefined;
}

function optionNumber(options: ParsedArgs['options'], name: string): number | undefined {
  const value = optionString(options, name);
  return value === undefined ? undefined : Number(value);
}

function providerOption(options: ParsedArgs['options']): ProviderName | undefined {
  if (options.mock) return 'mock';
  const value = optionString(options, 'provider');
  if (value === 'mock' || value === 'vertex-gemini' || value === 'vertex-claude') return value;
  return undefined;
}

function printUsage(): void {
  console.log(`Usage:
  urushi generate "<概要>" [--out out/deck] [--provider vertex-gemini|vertex-claude|mock] [--max-iterations 3]
  urushi build <deck.yaml> [--out out/deck]
  urushi check <deck.yaml|index.html> [--out out/deck] [--json]
  urushi fix <deck.yaml> [--overview "<概要>"] [--out out/fix] [--provider ...] [--max-iterations 3]
  urushi export <deck.yaml|index.html> [--out out/deck] [--pdf] [--pptx]
  urushi serve [--port 3333]
  urushi mcp
  urushi schema [--out schema/deck.schema.json]
`);
}

function printError(error: unknown): void {
  if (error instanceof DeckValidationError) {
    console.error(JSON.stringify({ ok: false, errors: error.errors }, null, 2));
    return;
  }
  console.error(error instanceof Error ? error.message : String(error));
}

async function commandBuild(args: ParsedArgs): Promise<number> {
  const input = args.positional[0];
  if (!input) throw new Error('build には deck.yaml を指定してください');
  const build = await buildDeck(input, optionString(args.options, 'out'));
  for (const warning of build.warnings) console.warn(`warning: ${warning}`);
  console.log(JSON.stringify({ ok: build.semanticErrors.length === 0, htmlPath: build.htmlPath, errors: build.semanticErrors }, null, 2));
  return build.semanticErrors.length ? 1 : 0;
}

async function commandCheck(args: ParsedArgs): Promise<number> {
  const input = args.positional[0];
  if (!input) throw new Error('check には deck.yaml または index.html を指定してください');
  let result;
  let htmlPath = resolve(input);
  if (/\.ya?ml$/i.test(input)) {
    const checked = await buildAndCheck(input, optionString(args.options, 'out'));
    result = checked.check;
    htmlPath = checked.build.htmlPath;
    for (const warning of checked.build.warnings) console.warn(`warning: ${warning}`);
  } else {
    const screenshotsDir = optionString(args.options, 'screenshots') ?? join(resolve(optionString(args.options, 'out') ?? join('out', outputName(input))), 'screenshots');
    result = await checkRenderedDeck(htmlPath, { screenshotsDir });
  }
  const output = { ok: result.ok, htmlPath, errors: result.errors, screenshots: result.screenshots };
  if (args.options.json) console.log(JSON.stringify(output));
  else console.log(JSON.stringify(output, null, 2));
  return result.ok ? 0 : 1;
}

async function commandGenerate(args: ParsedArgs): Promise<number> {
  const overview = args.positional.join(' ').trim();
  if (!overview) throw new Error('generate には概要を指定してください');
  const provider = createAiProvider(providerOption(args.options));
  const outDir = optionString(args.options, 'out') ?? join('out', `generated-${Date.now()}`);
  const result = await generateWithFixLoop({
    overview,
    outDir,
    provider,
    maxIterations: optionNumber(args.options, 'max-iterations') ?? 3,
  });
  console.log(JSON.stringify({
    ok: result.ok,
    provider: result.provider,
    model: result.model,
    deckPath: result.deckPath,
    htmlPath: result.htmlPath,
    iterations: result.iterations.map((iteration) => ({ iteration: iteration.iteration, errors: iteration.errors.length, screenshots: iteration.screenshots.length })),
    errors: result.finalErrors,
  }, null, 2));
  return result.ok ? 0 : 1;
}

async function commandFix(args: ParsedArgs): Promise<number> {
  const input = args.positional[0];
  if (!input) throw new Error('fix には deck.yaml を指定してください');
  const provider = createAiProvider(providerOption(args.options));
  const result = await fixExistingDeck({
    deckPath: input,
    overview: optionString(args.options, 'overview'),
    outDir: optionString(args.options, 'out'),
    provider,
    maxIterations: optionNumber(args.options, 'max-iterations') ?? 3,
  });
  console.log(JSON.stringify({
    ok: result.ok,
    provider: result.provider,
    model: result.model,
    deckPath: result.deckPath,
    htmlPath: result.htmlPath,
    iterations: result.iterations.map((iteration) => ({ iteration: iteration.iteration, errors: iteration.errors.length })),
    errors: result.finalErrors,
  }, null, 2));
  return result.ok ? 0 : 1;
}

async function commandExport(args: ParsedArgs): Promise<number> {
  const input = args.positional[0];
  if (!input) throw new Error('export には deck.yaml または index.html を指定してください');
  const pdf = Boolean(args.options.pdf) || !args.options.pptx;
  const pptx = Boolean(args.options.pptx) || !args.options.pdf;
  let htmlPath = resolve(input);
  let deck;
  let outDir = optionString(args.options, 'out');
  if (/\.ya?ml$/i.test(input)) {
    const build = await buildDeck(input, outDir);
    htmlPath = build.htmlPath;
    deck = build.deck;
    outDir = build.outDir;
  } else {
    try {
      deck = await readDeckFile(join(resolve(input, '..'), 'deck.yaml'));
    } catch {
      deck = undefined;
    }
    outDir = resolve(outDir ?? resolve(input, '..'));
  }
  const result = await exportDeck(htmlPath, outDir, { pdf, pptx, deck });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  return 0;
}

async function commandSchema(args: ParsedArgs): Promise<number> {
  const json = `${JSON.stringify(deckJsonSchema, null, 2)}\n`;
  const out = optionString(args.options, 'out');
  if (out) {
    await mkdir(resolve(out, '..'), { recursive: true });
    await writeFile(out, json, 'utf8');
    console.log(out);
  } else {
    process.stdout.write(json);
  }
  return 0;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  loadDotEnv();
  const [command, ...rest] = argv;
  const args = parseArgs(rest);
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    return 0;
  }
  if (command === 'build') return commandBuild(args);
  if (command === 'check') return commandCheck(args);
  if (command === 'generate') return commandGenerate(args);
  if (command === 'fix') return commandFix(args);
  if (command === 'export') return commandExport(args);
  if (command === 'schema') return commandSchema(args);
  if (command === 'serve') {
    await startServer(optionNumber(args.options, 'port') ?? Number(process.env.PORT ?? 3333), providerOption(args.options));
    return 0;
  }
  if (command === 'mcp') {
    await startMcpServer();
    return 0;
  }
  throw new Error(`不明なコマンドです: ${command}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    printError(error);
    process.exitCode = 1;
  });
}
