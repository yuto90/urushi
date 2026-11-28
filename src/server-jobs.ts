import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { createAiProvider, fixExistingDeck, generateWithFixLoop, type GenerationResult, type LoopIteration } from './ai/index.js';
import { VertexGeminiProvider } from './ai/vertex-gemini.js';
import { canReplay, type Revision } from './ai/revision.js';
import type { ProviderName } from './config.js';
import type { JobEvent, Preview } from './editor-protocol.js';
import type { ExportResult } from './export/exporter.js';
import { buildDeck, readDeckFile } from './pipeline.js';
import { renderSlide } from './render/html.js';
import type { Deck } from './schema/index.js';

export interface Job {
  id: string;
  owner?: string;
  status: 'running' | 'done' | 'failed';
  provider: ProviderName;
  overview: string;
  outDir: string;
  createdAt: string;
  iterations: LoopIteration[];
  events: JobEvent[];
  subscribers: Set<ServerResponse>;
  snapshots: Deck[];
  deck?: Deck;
  result?: GenerationResult;
  error?: string;
  exports?: ExportResult;
  exporting?: Promise<ExportResult>;
}
export const jobs = new Map<string, Job>();
export function newJob(overview: string, provider: ProviderName, owner?: string) {
  const id = randomUUID();
  const job: Job = { id, overview, provider, owner, status: 'running', createdAt: new Date().toISOString(),
    outDir: resolve('out', 'web', id), iterations: [], events: [], subscribers: new Set(), snapshots: [] };
  jobs.set(id, job);
  return job;
}

export function previewInfo(id: string, deck: Deck, snapshot?: number): Preview {
  return { id, title: deck.meta.title, snapshot, slides: deck.slides.map((slide, i) =>
    ({ name: slide.title ?? `${i + 1}枚目`, interval: canReplay(deck, i) })) };
}

function packet(event: JobEvent, id: number) { return `id: ${id}\ndata: ${JSON.stringify(event)}\n\n`; }
function publish(job: Job, event: JobEvent) {
  const id = job.events.push(event);
  for (const client of job.subscribers) client.write(packet(event, id));
  if (event.type === 'done' || event.type === 'failed') {
    for (const client of job.subscribers) client.end();
    job.subscribers.clear();
  }
}

export function subscribe(job: Job, response: ServerResponse, after: number) {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'private, no-store, no-transform', 'x-accel-buffering': 'no' });
  response.write(': connected\n\n');
  job.events.forEach((event, i) => { if (i + 1 > after) response.write(packet(event, i + 1)); });
  if (job.status !== 'running') { response.end(); return; }
  job.subscribers.add(response);
  const heartbeat = setInterval(() => response.write(': keep-alive\n\n'), 15_000);
  response.on('close', () => { clearInterval(heartbeat); job.subscribers.delete(response); });
}

export async function runGenerationJob(job: Job, revision?: Revision) {
  try {
    let previousCount = 0;
    let previousIteration = 0;
    const options: Parameters<typeof generateWithFixLoop>[0] = {
      overview: job.overview, provider: job.owner ? new VertexGeminiProvider('gemini-4-neon') : createAiProvider(job.provider), outDir: job.outDir,
      onIteration: (item) => job.iterations.push(item),
      onPhase: (phase, iteration) => publish(job, { type: 'phase', phase, iteration }),
      onText: (chars) => publish(job, { type: 'text', chars }),
      onPreview: (deck, iteration) => {
        const snapshot = job.snapshots.push(deck);
        const from = iteration === previousIteration ? previousCount : 0;
        const markup = deck.slides.slice(from).map((slide, offset) => renderSlide(deck, slide, from + offset));
        publish(job, { type: 'preview', preview: previewInfo(job.id, deck, snapshot), from, markup });
        previousCount = deck.slides.length;
        previousIteration = iteration;
      },
    };
    if (revision) {
      await mkdir(job.outDir, { recursive: true });
      const deckPath = join(job.outDir, 'source.yaml');
      await writeFile(deckPath, revision.yaml);
      job.result = await fixExistingDeck({ ...options, deckPath, target: revision.target });
    } else job.result = await generateWithFixLoop(options);
    if (!job.result.ok) throw new Error(job.result.finalErrors.map((e) => `${e.slide}枚目 ${e.path} ${e.hint}`).join('\n'));
    job.deck = await readDeckFile(job.result.deckPath);
    job.status = 'done';
    publish(job, { type: 'done', preview: previewInfo(job.id, job.deck), provider: job.result.provider, model: job.result.model });
  } catch (error) {
    job.status = 'failed';
    job.error = job.owner && !job.result
      ? '生成を完了できませんでした。時間をおいてもう一度お試しください'
      : error instanceof Error ? error.message : String(error);
    publish(job, { type: 'failed', error: job.error });
  }
}

export async function openYaml(yaml: string, provider: ProviderName, owner?: string) {
  const job = newJob('', provider, owner);
  try {
    await mkdir(job.outDir, { recursive: true });
    const deckPath = join(job.outDir, 'deck.yaml');
    await writeFile(deckPath, yaml);
    const build = await buildDeck(deckPath, job.outDir);
    job.deck = build.deck;
    job.result = { provider: 'manual', model: 'yaml', outDir: job.outDir, deckPath, htmlPath: build.htmlPath,
      ok: !build.semanticErrors.length, iterations: [], finalErrors: build.semanticErrors };
    job.status = 'done';
    return previewInfo(job.id, build.deck);
  } catch (error) {
    jobs.delete(job.id);
    throw error;
  }
}

// Hosted job URLs are temporary. The local editor keeps its existing output files.
export async function pruneHostedJobs(now = Date.now()) {
  for (const job of jobs.values()) {
    if (!job.owner || job.status === 'running' || job.exporting || now - Date.parse(job.createdAt) < 3_600_000) continue;
    jobs.delete(job.id);
    await rm(job.outDir, { recursive: true, force: true }).catch(() => {});
  }
}
