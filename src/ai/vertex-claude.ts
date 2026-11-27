import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { googleCloudLocation, googleCloudProject } from '../config.js';
import type { AiCompleteRequest, AiProvider } from './types.js';

export class VertexClaudeProvider implements AiProvider {
  name = 'vertex-claude' as const;
  private client: AnthropicVertex;

  constructor(public model: string) {
    const projectId = googleCloudProject();
    if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT が未設定で、gcloud config からも取得できません');
    this.client = new AnthropicVertex({ projectId, region: googleCloudLocation('vertex-claude') });
  }

  async complete(request: AiCompleteRequest): Promise<string> {
    const content: unknown[] = [];
    for (const image of request.images ?? []) {
      content.push({ type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.dataBase64 } });
    }
    content.push({ type: 'text', text: request.prompt });
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxOutputTokens ?? 8192,
      messages: [{ role: 'user', content: content as never }],
    });
    return response.content.map((block) => (block.type === 'text' ? block.text : '')).join('\n');
  }
}
