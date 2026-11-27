import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ProviderName } from './config.js';
import { createAiProvider, generateWithFixLoop, type GenerationResult, type LoopIteration } from './ai/index.js';
import { buildAndCheck, DeckValidationError, readDeckFile } from './pipeline.js';
import { exportDeck } from './export/index.js';

interface Job {
  id: string;
  status: 'running' | 'done' | 'failed';
  overview: string;
  provider: ProviderName;
  outDir: string;
  createdAt: string;
  iterations: LoopIteration[];
  result?: GenerationResult;
  error?: string;
  exports?: { pdfPath?: string; pptxPath?: string; screenshots?: string[] };
}

const jobs = new Map<string, Job>();
const publicDir = resolve('public');
const outRoot = resolve('out', 'web');

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function sendText(response: ServerResponse, status: number, value: string, contentType = 'text/plain; charset=utf-8'): void {
  response.writeHead(status, { 'content-type': contentType });
  response.end(value);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function jobSummary(job: Job) {
  return {
    id: job.id,
    status: job.status,
    overview: job.overview,
    provider: job.provider,
    createdAt: job.createdAt,
    iterations: job.iterations.map((iteration) => ({
      iteration: iteration.iteration,
      errors: iteration.errors.length,
      validSchema: iteration.validSchema,
      screenshots: iteration.screenshots.length,
    })),
    result: job.result
      ? {
          ok: job.result.ok,
          provider: job.result.provider,
          model: job.result.model,
          deckPath: job.result.deckPath,
          htmlPath: job.result.htmlPath,
          finalErrors: job.result.finalErrors,
        }
      : undefined,
    exports: job.exports,
    error: job.error,
  };
}

async function runGenerationJob(job: Job): Promise<void> {
  try {
    job.result = await generateWithFixLoop({
      overview: job.overview,
      provider: createAiProvider(job.provider),
      outDir: job.outDir,
      maxIterations: 3,
      onIteration: (iteration) => job.iterations.push(iteration),
    });
    job.status = 'done';
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
  }
}

async function serveFile(response: ServerResponse, path: string, downloadName?: string): Promise<void> {
  if (!existsSync(path)) {
    sendText(response, 404, 'not found');
    return;
  }
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8',
    '.pdf': 'application/pdf',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.png': 'image/png',
  };
  const headers: Record<string, string> = { 'content-type': types[extname(path)] ?? 'application/octet-stream' };
  if (downloadName) headers['content-disposition'] = `attachment; filename="${encodeURIComponent(downloadName)}"`;
  response.writeHead(200, headers);
  response.end(await readFile(path));
}

async function serveStatic(response: ServerResponse, pathname: string): Promise<void> {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const path = normalize(join(publicDir, relative));
  if (!(path === publicDir || path.startsWith(`${publicDir}/`)) || !existsSync(path)) {
    sendText(response, 404, 'not found');
    return;
  }
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
  };
  response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
  response.end(await readFile(path));
}

function getJob(id: string | undefined): Job | undefined {
  return id ? jobs.get(id) : undefined;
}

export async function startServer(port = 3333): Promise<void> {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;

      if (request.method === 'POST' && pathname === '/api/generate') {
        const body = (await readBody(request)) as { overview?: string; provider?: ProviderName; mock?: boolean };
        const overview = body.overview?.trim();
        if (!overview) {
          sendJson(response, 400, { error: 'overview is required' });
          return;
        }
        const provider: ProviderName = body.mock ? 'mock' : body.provider ?? 'vertex-gemini';
        const id = randomUUID();
        const job: Job = {
          id,
          status: 'running',
          overview,
          provider,
          outDir: join(outRoot, id),
          createdAt: new Date().toISOString(),
          iterations: [],
        };
        jobs.set(id, job);
        void runGenerationJob(job);
        sendJson(response, 202, { id, status: job.status });
        return;
      }

      const jobMatch = pathname.match(/^\/api\/jobs\/([a-f0-9-]+)(?:\/(html|yaml|export|download-pdf|download-pptx|rebuild))?$/);
      if (jobMatch) {
        const job = getJob(jobMatch[1]);
        if (!job) {
          sendJson(response, 404, { error: 'job not found' });
          return;
        }
        const action = jobMatch[2];
        if (request.method === 'GET' && !action) {
          sendJson(response, 200, jobSummary(job));
          return;
        }
        if (request.method === 'GET' && action === 'html') {
          await serveFile(response, job.result?.htmlPath ?? join(job.outDir, 'index.html'));
          return;
        }
        if (request.method === 'GET' && action === 'yaml') {
          await serveFile(response, job.result?.deckPath ?? join(job.outDir, 'deck.yaml'));
          return;
        }
        if (request.method === 'POST' && action === 'export') {
          if (!job.result?.htmlPath) {
            sendJson(response, 409, { error: 'HTML is not ready' });
            return;
          }
          const builtYaml = join(job.outDir, 'deck.yaml');
          let deck;
          try {
            deck = await readDeckFile(join(job.outDir, 'deck.yaml'));
          } catch {
            deck = undefined;
          }
          job.exports = await exportDeck(job.result.htmlPath, job.outDir, { pdf: true, pptx: true, deck });
          sendJson(response, 200, { ok: true, exports: job.exports, yaml: existsSync(builtYaml) });
          return;
        }
        if (request.method === 'GET' && action === 'download-pdf') {
          await serveFile(response, job.exports?.pdfPath ?? join(job.outDir, 'deck.pdf'), `${job.id}.pdf`);
          return;
        }
        if (request.method === 'GET' && action === 'download-pptx') {
          await serveFile(response, job.exports?.pptxPath ?? join(job.outDir, 'deck.pptx'), `${job.id}.pptx`);
          return;
        }
        if (request.method === 'POST' && action === 'rebuild') {
          const body = (await readBody(request)) as { yaml?: string };
          if (!body.yaml) {
            sendJson(response, 400, { error: 'yaml is required' });
            return;
          }
          const deckPath = join(job.outDir, 'deck.yaml');
          await writeFile(deckPath, body.yaml, 'utf8');
          try {
            const rebuilt = await buildAndCheck(deckPath, job.outDir);
            job.result = {
              provider: job.result?.provider ?? 'manual',
              model: job.result?.model ?? 'yaml-edit',
              outDir: job.outDir,
              deckPath,
              htmlPath: rebuilt.build.htmlPath,
              ok: rebuilt.check.ok,
              iterations: job.result?.iterations ?? [],
              finalErrors: rebuilt.check.errors,
            };
            sendJson(response, 200, { ok: rebuilt.check.ok, errors: rebuilt.check.errors, warnings: rebuilt.build.warnings });
          } catch (error) {
            if (error instanceof DeckValidationError) {
              sendJson(response, 422, { ok: false, errors: error.errors, warnings: [] });
            } else {
              throw error;
            }
          }
          return;
        }
      }

      if (request.method === 'GET') {
        await serveStatic(response, pathname);
        return;
      }
      sendText(response, 404, 'not found');
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(port, () => resolvePromise());
  });
  console.log(`Urushi Web UI: http://localhost:${port}`);
}
