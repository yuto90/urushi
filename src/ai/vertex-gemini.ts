import { GoogleGenAI } from '@google/genai';
import { googleCloudLocation, googleCloudProject } from '../config.js';
import type { AiCompleteRequest, AiProvider } from './types.js';

export class VertexGeminiProvider implements AiProvider {
  name = 'vertex-gemini' as const;
  private client: GoogleGenAI;

  constructor(public model: string) {
    const project = googleCloudProject();
    if (!project) throw new Error('GOOGLE_CLOUD_PROJECT が未設定で、gcloud config からも取得できません');
    this.client = new GoogleGenAI({ vertexai: true, project, location: googleCloudLocation('vertex-gemini') });
  }

  async complete(request: AiCompleteRequest): Promise<string> {
    const parts: unknown[] = [{ text: request.prompt }];
    for (const image of request.images ?? []) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.dataBase64 } });
    }
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: parts as never }],
      config: {
        maxOutputTokens: request.maxOutputTokens ?? 8192,
        temperature: request.temperature ?? 0.2,
        thinkingConfig: { thinkingLevel: 'LOW' as never },
      },
    });
    if (response.text) return response.text;
    const partsOut = response.candidates?.[0]?.content?.parts ?? [];
    return partsOut.map((part) => ('text' in part && typeof part.text === 'string' ? part.text : '')).join('\n');
  }
}
