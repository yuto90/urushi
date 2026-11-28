import { z } from 'zod';
import { parseDeckYaml } from '../src/schema/deck';
import { canReplay, targetSchema, type Target } from '../src/ai/revision';

const versionSchema = z.object({
  yaml: z.string().min(1), parent: z.number().int().nonnegative(), target: targetSchema,
  restored: z.number().int().positive().optional(),
});
const projectSchema = z.object({
  format: z.literal(1), id: z.string().min(1), title: z.string().min(1),
  updatedAt: z.iso.datetime(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string(), version: z.number().int().positive(), scope: z.string().optional() })),
  versions: z.array(versionSchema).min(1),
});
export type Project = z.infer<typeof projectSchema>;
export type { Target };
export type Message = Project['messages'][number];

export function readBackup(text: string): Project {
  const data = projectSchema.parse(JSON.parse(text));
  const decks = data.versions.map((version, i) => {
    const parsed = parseDeckYaml(version.yaml);
    if (!parsed.ok) throw new Error(`v${i + 1} の YAML を読み込めません`);
    return parsed.deck;
  });
  data.versions.forEach(({ parent, target, restored }, i) => {
    const source = decks[parent - 1];
    if ((i > 0 && !source) || parent > i || (restored ?? 0) > i ||
        (target.kind !== 'deck' && !source?.slides[target.index]) ||
        (target.kind === 'transition' && (!canReplay(source, target.index) || !canReplay(decks[i], target.index)))) {
      throw new Error(`v${i + 1} の参照先が見つかりません`);
    }
  });
  if (data.messages.some((message) => message.version > data.versions.length)) throw new Error('会話の参照先がありません');
  return data;
}
