import type { EditRequest } from './revision.js';

export interface AiImageInput {
  path: string;
  mimeType: 'image/png' | 'image/jpeg';
  dataBase64: string;
}

export interface AiCompleteRequest {
  prompt: string;
  edit?: EditRequest;
  onText?: (chunk: string) => void;
  images?: AiImageInput[];
  maxOutputTokens?: number;
  temperature?: number;
}

export interface AiProvider {
  name: 'vertex-gemini' | 'vertex-claude' | 'mock';
  model: string;
  complete(request: AiCompleteRequest): Promise<string>;
}
