import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { z } from 'zod';
import { configuredProvider, type ProviderName } from './config.js';
import { loadAnimationCatalog } from './animations/index.js';
import { prepareEdit, targetSchema } from './ai/revision.js';
import { parseDeckYaml } from './schema/index.js';
import { renderDeckHtml, renderStreamFrame, renderThumbnail } from './render/html.js';
import { buildAndCheck, DeckValidationError } from './pipeline.js';
import { exportDeck } from './export/index.js';
import { jobs, newJob, openYaml, runGenerationJob, subscribe, type Job } from './server-jobs.js';

const publicDir = resolve('dist', 'editor');
const providerSchema = z.enum(['mock', 'vertex-gemini', 'vertex-claude']);
const generateBody = z.object({
  overview: z.string().trim().min(1).max(16000),
  provider: providerSchema.optional(), mock: z.boolean().optional(),
  yaml: z.string().min(1).optional(), target: targetSchema.optional(),
});

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
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 4_000_000) throw new Error('入力は4 MB以内にしてください');
    chunks.push(Buffer.from(chunk));
  }
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
  if (extname(path) === '.html') headers['content-security-policy'] = 'sandbox allow-scripts';
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

export async function startServer(port = 3333, defaultProvider = configuredProvider()): Promise<void> {
  const animations = await loadAnimationCatalog(process.cwd());
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;

      if (request.method === 'POST' && pathname.startsWith('/api/') &&
          !request.headers['content-type']?.includes('application/json') &&
          request.headers.origin && request.headers.origin !== url.origin) {
        sendJson(response, 403, { error: 'ローカル編集画面から送信してください' });
        return;
      }
      if (request.method === 'GET' && pathname === '/api/preview-frame') {
        response.setHeader('content-security-policy', 'sandbox allow-scripts');
        sendText(response, 200, renderStreamFrame(), 'text/html; charset=utf-8');
        return;
      }
      if (request.method === 'GET' && pathname === '/api/config') {
        sendJson(response, 200, { provider: defaultProvider });
        return;
      }
      if (request.method === 'POST' && pathname === '/api/generate') {
        const body = generateBody.parse(await readBody(request));
        const provider: ProviderName = body.mock ? 'mock' : body.provider ?? defaultProvider;
        if (body.target && !body.yaml) { sendJson(response, 400, { error: '修正元の YAML が必要です' }); return; }
        const revision = body.yaml ? { yaml: body.yaml, target: body.target ?? { kind: 'deck' as const } } : undefined;
        if (revision) {
          try { prepareEdit(revision, body.overview); }
          catch (error) { sendJson(response, 422, { error: String(error) }); return; }
        }
        const job = newJob(body.overview, provider);
        void runGenerationJob(job, revision);
        sendJson(response, 202, { id: job.id, status: job.status });
        return;
      }
      if (request.method === 'POST' && pathname === '/api/render') {
        const { yaml } = z.object({ yaml: z.string().min(1) }).parse(await readBody(request));
        if (!parseDeckYaml(yaml).ok) { sendJson(response, 422, { error: '保存版の YAML を読み込めません' }); return; }
        sendJson(response, 201, await openYaml(yaml, defaultProvider));
        return;
      }

      const jobMatch = pathname.match(/^\/api\/jobs\/([a-f0-9-]+)(?:\/(events|thumb|html|yaml|export|download-pdf|download-pptx|rebuild))?$/);
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
        if (request.method === 'GET' && action === 'events') {
          subscribe(job, response, Number(request.headers['last-event-id']) || 0);
          return;
        }
        if (request.method === 'GET' && (action === 'thumb' || (action === 'html' && url.searchParams.has('snapshot')))) {
          const deck = url.searchParams.has('snapshot')
            ? job.snapshots[Number(url.searchParams.get('snapshot')) - 1] : job.deck;
          if (!deck) { sendText(response, 404, 'プレビューがありません'); return; }
          const index = Number(url.searchParams.get('slide'));
          if (action === 'thumb' && !deck.slides[index]) { sendText(response, 404, '枚数を確認してください'); return; }
          response.setHeader('content-security-policy', 'sandbox allow-scripts');
          sendText(response, 200, action === 'thumb' ? renderThumbnail(deck, index) : renderDeckHtml(deck, animations), 'text/html; charset=utf-8');
          return;
        }
        if (request.method === 'GET' && action === 'html') {
          await serveFile(response, job.result?.htmlPath ?? join(job.outDir, 'index.html'),
            url.searchParams.has('download') ? 'urushi.html' : undefined);
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
          if (!job.exports) {
            const source = job.result;
            const pending = job.exporting ??= exportDeck(job.result.htmlPath, source.outDir, { pdf: true, pptx: true, deck: job.deck });
            try {
              const files = await pending;
              if (job.result !== source) { sendJson(response, 409, { error: '書き出し中に資料が更新されました' }); return; }
              job.exports = files;
            } finally { if (job.exporting === pending) job.exporting = undefined; }
          }
          sendJson(response, 200, { ok: true, exports: job.exports, yaml: true });
          return;
        }
        if (request.method === 'GET' && action === 'download-pdf') {
          await serveFile(response, job.exports?.pdfPath ?? join(job.result?.outDir ?? job.outDir, 'deck.pdf'), `${job.id}.pdf`);
          return;
        }
        if (request.method === 'GET' && action === 'download-pptx') {
          await serveFile(response, job.exports?.pptxPath ?? join(job.result?.outDir ?? job.outDir, 'deck.pptx'), `${job.id}.pptx`);
          return;
        }
        if (request.method === 'POST' && action === 'rebuild') {
          const body = (await readBody(request)) as { yaml?: string };
          if (!body.yaml) {
            sendJson(response, 400, { error: 'yaml is required' });
            return;
          }
          if (job.status === 'running') { sendJson(response, 409, { error: '生成中です' }); return; }
          const directory = await mkdtemp(join(job.outDir, 'rebuild-'));
          const deckPath = join(directory, 'deck.yaml');
          await writeFile(deckPath, body.yaml, 'utf8');
          try {
            const rebuilt = await buildAndCheck(deckPath, directory);
            job.deck = rebuilt.build.deck;
            job.exports = undefined;
            job.exporting = undefined;
            job.result = {
              provider: job.result?.provider ?? 'manual',
              model: job.result?.model ?? 'yaml-edit',
              outDir: directory,
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
      sendJson(response, error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once('error', (error) => rejectPromise(error));
    server.listen(port, '127.0.0.1', () => resolvePromise());
  });
  const address = server.address();
  console.log(`Urushi Web UI: http://localhost:${typeof address === 'object' ? address?.port : port}`);
}
