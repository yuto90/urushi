import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { generateWithFixLoop } from './ai/index.js';
import { checkRenderedDeck } from './check/index.js';
import { exportDeck } from './export/index.js';
import { buildAndCheck, buildDeck, writeDeckFile } from './pipeline.js';
import { deckSchema, type Deck } from './schema/index.js';

function jsonResult(value: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    isError,
  };
}

async function materializeDeck(input: { deckPath?: string; deck?: Deck; outDir?: string }): Promise<string> {
  if (input.deckPath) return input.deckPath;
  if (!input.deck) throw new Error('deckPath または deck が必要です');
  const outDir = input.outDir ?? 'out/mcp-input';
  const deckPath = `${outDir}/deck.yaml`;
  await writeDeckFile(input.deck, deckPath);
  return deckPath;
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({ name: 'urushi', version: '0.1.0' });

  server.registerTool('generate', {
    description: '概要から deck.yaml を生成し、schema/render/check/fix ループを実行する',
    inputSchema: z.object({
      overview: z.string().min(1),
      outDir: z.string().default('out/mcp-generate'),
      maxIterations: z.number().int().min(1).max(5).default(3),
    }),
  }, async ({ overview, outDir, maxIterations }) => {
    const result = await generateWithFixLoop({ overview, outDir, maxIterations });
    return jsonResult(result, !result.ok);
  });

  server.registerTool('render', {
    description: 'deck.yaml を検証して1ファイルHTMLへレンダリングする',
    inputSchema: z.object({
      deckPath: z.string().min(1).optional(),
      deck: deckSchema.optional(),
      outDir: z.string().optional(),
    }),
  }, async ({ deckPath, deck, outDir }) => {
    const result = await buildDeck(await materializeDeck({ deckPath, deck, outDir }), outDir);
    return jsonResult({ htmlPath: result.htmlPath, warnings: result.warnings, errors: result.semanticErrors }, result.semanticErrors.length > 0);
  });

  server.registerTool('check', {
    description: 'deck.yaml または生成HTMLを Playwright で実測し、構造化エラーを返す',
    inputSchema: z.object({
      path: z.string().min(1).optional(),
      deck: deckSchema.optional(),
      outDir: z.string().optional(),
    }),
  }, async ({ path, deck, outDir }) => {
    const inputPath = await materializeDeck({ deckPath: path, deck, outDir });
    if (/\.ya?ml$/i.test(inputPath)) {
      const result = await buildAndCheck(inputPath, outDir);
      return jsonResult(result.check, !result.check.ok);
    }
    const result = await checkRenderedDeck(inputPath, { screenshotsDir: outDir ? `${outDir}/screenshots` : undefined });
    return jsonResult(result, !result.ok);
  });

  server.registerTool('export', {
    description: '生成HTMLまたはdeck.yamlをPDF/PPTXへ書き出す',
    inputSchema: z.object({
      path: z.string().min(1).optional(),
      deck: deckSchema.optional(),
      outDir: z.string().default('out/mcp-export'),
      pdf: z.boolean().default(true),
      pptx: z.boolean().default(true),
    }),
  }, async ({ path, deck: inputDeck, outDir, pdf, pptx }) => {
    const inputPath = await materializeDeck({ deckPath: path, deck: inputDeck, outDir });
    let htmlPath = inputPath;
    let deck;
    if (/\.ya?ml$/i.test(inputPath)) {
      const built = await buildDeck(inputPath, outDir);
      htmlPath = built.htmlPath;
      deck = built.deck;
    }
    const result = await exportDeck(htmlPath, outDir, { pdf, pptx, deck });
    return jsonResult(result);
  });

  await server.connect(new StdioServerTransport());
}
