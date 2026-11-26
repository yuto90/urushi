import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config.js";
import { generateDeck } from "./generate.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(projectRoot, "public");

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("リクエストが大きすぎます");
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function serveFile(response: ServerResponse, filePath: string): Promise<void> {
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
}

function resolvePublicFile(pathname: string): string | null {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const normalized = path.normalize(requested).replace(/^([/\\])+/, "");
  const filePath = path.join(publicRoot, normalized);
  const relative = path.relative(publicRoot, filePath);
  const contained = relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
  return contained ? filePath : null;
}

async function handleGenerate(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const rawBody = await readRequestBody(request);
    const body = JSON.parse(rawBody) as { prompt?: unknown; sample?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      sendJson(response, 400, { error: "prompt は必須です" });
      return;
    }
    if (prompt.length > 12_000) {
      sendJson(response, 400, { error: "prompt は12000文字以内にしてください" });
      return;
    }

    const result = await generateDeck(prompt, { forceSample: body.sample === true });
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startServer(): void {
  const config = getConfig();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "POST" && url.pathname === "/api/generate") {
      await handleGenerate(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("method not allowed");
      return;
    }

    if (url.pathname === "/examples/sample.html") {
      await serveFile(response, path.join(projectRoot, "examples", "sample.html"));
      return;
    }

    const filePath = resolvePublicFile(url.pathname);
    if (!filePath) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("forbidden");
      return;
    }
    await serveFile(response, filePath);
  });

  server.listen(config.port, () => {
    console.log(`Urushi Web UI: http://localhost:${config.port}`);
    if (!config.apiKey) {
      console.log("ANTHROPIC_API_KEY が未設定のため、生成はサンプルHTMLを返すモックモードです。");
    }
  });
}

startServer();
