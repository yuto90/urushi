import { configuredModel, configuredProvider, type ProviderName } from '../config.js';
import { MockProvider } from './mock.js';
import type { AiProvider } from './types.js';
import { VertexClaudeProvider } from './vertex-claude.js';
import { VertexGeminiProvider } from './vertex-gemini.js';

export function createAiProvider(name?: ProviderName): AiProvider {
  const provider = name ?? configuredProvider();
  const model = configuredModel(provider);
  if (provider === 'mock') return new MockProvider();
  if (provider === 'vertex-claude') return new VertexClaudeProvider(model);
  return new VertexGeminiProvider(model);
}

export { extractYamlText } from './extract.js';
export { fixPrompt, generationPrompt } from './prompts.js';
export type { AiCompleteRequest, AiImageInput, AiProvider } from './types.js';
export { deckFromYamlText, fixExistingDeck, generateWithFixLoop } from './loop.js';
export type { GenerationResult, LoopIteration } from './loop.js';
