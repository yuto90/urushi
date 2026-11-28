import { parse, stringify } from 'yaml';
import { z } from 'zod';
import { deckJsonSchema, parseDeckYaml, transitionSchema, type Deck } from '../schema/index.js';

export const targetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('deck') }),
  z.object({ kind: z.literal('slide'), index: z.number().int().nonnegative() }),
  z.object({ kind: z.literal('transition'), index: z.number().int().positive() }),
]);
export type Target = z.infer<typeof targetSchema>;
export interface Revision { yaml: string; target: Target }
export interface EditRequest { base: Deck; target: Target; instruction: string }

export function canReplay(deck: Deck, index: number) {
  const end = deck.slides[index];
  const start = deck.slides[index - 1];
  return start?.type === 'chart' && end?.type === 'chart' && start.chartId === end.chartId;
}

export function prepareEdit(revision: Revision, instruction: string): EditRequest {
  const parsed = parseDeckYaml(revision.yaml);
  if (!parsed.ok) throw new Error('修正元の YAML を読み込めません');
  const { target } = revision;
  if (target.kind !== 'deck' && !parsed.deck.slides[target.index]) throw new Error('対象のスライドがありません');
  if (target.kind === 'transition' && !canReplay(parsed.deck, target.index)) throw new Error('再生できる区間を指定してください');
  return { base: parsed.deck, target, instruction };
}

export function revisionPrompt(edit: EditRequest, yaml: string) {
  const { base, target, instruction } = edit;
  let scope = '資料全体を指示に沿って編集し、完全な deck.yaml を返してください。棒グラフなど同一の要素の識別子と元のデータは指示がない限り保ってください。';
  if (target.kind === 'slide') scope = `${target.index + 1}枚目のみを編集し、1枚分の YAML マッピング（type を含む）だけを返してください。`;
  if (target.kind === 'transition') {
    const from = base.slides[target.index - 1].title;
    const to = base.slides[target.index].title;
    scope = `「${from} → ${to}」の動きだけを編集し、時間（秒）の YAML マッピングだけを返してください。形式: ${JSON.stringify(z.toJSONSchema(transitionSchema))}`;
  }
  return `Urushi のスライド編集。出力は YAML 本文のみ。\n${scope}\nスキーマ: ${JSON.stringify(deckJsonSchema)}\n元の版:\n${yaml}\n修正依頼:\n${instruction}`;
}

export function applyReply(revision: Revision, text: string) {
  const { target } = revision;
  if (target.kind === 'deck') return text;
  const base = parse(revision.yaml) as Deck;
  const reply = parse(text);
  if (target.kind === 'slide') base.slides[target.index] = reply;
  else {
    const slide = base.slides[target.index];
    if (slide.type !== 'chart') throw new Error('区間の終了状態がありません');
    slide.transition = transitionSchema.parse(reply);
  }
  return stringify(base);
}
