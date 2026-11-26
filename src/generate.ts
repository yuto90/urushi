import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createAnthropicMessage } from "./anthropic.js";
import { getConfig } from "./config.js";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt.js";
import { extractHtmlDocument } from "./postprocess.js";

export interface GenerationResult {
  html: string;
  model: string;
  usedMock: boolean;
}

function sampleDeckPath(): string {
  return fileURLToPath(new URL("../examples/sample.html", import.meta.url));
}

export async function readSampleDeck(): Promise<string> {
  return readFile(sampleDeckPath(), "utf8");
}

export async function generateDeck(brief: string, options: { forceSample?: boolean } = {}): Promise<GenerationResult> {
  const trimmed = brief.trim();
  if (!trimmed) throw new Error("スライドの概要が空です");

  const config = getConfig();
  if (options.forceSample || !config.apiKey) {
    return {
      html: await readSampleDeck(),
      model: "sample-mock",
      usedMock: true,
    };
  }

  const completion = await createAnthropicMessage({
    apiKey: config.apiKey,
    model: config.model,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(trimmed),
  });

  return {
    html: extractHtmlDocument(completion),
    model: config.model,
    usedMock: false,
  };
}
