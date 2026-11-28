import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import type { EditRequest } from './revision.js';
import { parse, stringify } from 'yaml';
import type { Deck } from '../schema/index.js';
import type { AiCompleteRequest, AiProvider } from './types.js';

function sampleDeck(overview: string): Deck {
  const short = overview.replace(/\s+/g, ' ').slice(0, 24) || '提案テーマ';
  return {
    version: 1,
    meta: { title: `${short}の叩き台`, subtitle: 'AI生成モック', author: 'Urushi mock' },
    slides: [
      {
        type: 'conclusion',
        title: '結論',
        conclusion: `${short}は小規模検証から始め、効果を測って拡大する`,
        evidence: ['初期費用を抑えられる', '効果を数値で判断できる', '現場負荷を限定できる'],
        callToAction: '2週間の検証計画を作る',
        animation: 'assemble',
      },
      {
        type: 'comparison',
        title: '進め方の比較',
        left: { label: '一括導入', points: ['初期構築が重い', '失敗時の損失が大きい'], score: 38 },
        right: { label: '段階導入', points: ['小さく検証できる', '学びを次に反映できる'], score: 76 },
        verdict: '段階導入でリスクを抑える',
        animation: 'balance',
      },
      {
        type: 'process',
        title: '検証の手順',
        steps: [
          { title: '目的設定', description: '測る指標を1つ決める' },
          { title: '試行', description: '小さい範囲で2週間試す' },
          { title: '判断', description: '結果を見て拡大可否を決める' },
        ],
        outcome: '学びの速さを優先する',
        animation: 'step-in',
      },
    ],
  };
}

function parsePath(path: string): Array<string | number> {
  const parts: Array<string | number> = [];
  for (const segment of path.split('.')) {
    const match = segment.match(/^([^[\]]+)((\[\d+\])*)$/);
    if (!match) {
      parts.push(segment);
      continue;
    }
    parts.push(match[1]);
    for (const index of segment.matchAll(/\[(\d+)\]/g)) parts.push(Number(index[1]));
  }
  return parts.filter((part) => part !== '');
}

function getAtPath(value: unknown, path: Array<string | number>): unknown {
  let node = value as never;
  for (const part of path) node = node?.[part as keyof typeof node] as never;
  return node;
}

function setAtPath(value: unknown, path: Array<string | number>, next: unknown): void {
  let node = value as never;
  for (const part of path.slice(0, -1)) node = node?.[part as keyof typeof node] as never;
  const last = path[path.length - 1];
  if (node && last !== undefined) node[last as keyof typeof node] = next as never;
}

function mutateStrings(value: unknown, mutate: (text: string) => string): void {
  if (typeof value === 'string') return;
  if (Array.isArray(value)) {
    value.forEach((item) => mutateStrings(item, mutate));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'string') (value as Record<string, unknown>)[key] = mutate(child);
      else mutateStrings(child, mutate);
    }
  }
}

function fixMockYaml(currentYaml: string, errorsJson: string): string {
  let deck: unknown;
  try {
    deck = parse(currentYaml);
  } catch {
    return stringify(sampleDeck('修正後の deck'));
  }
  let errors: Array<{ slide?: number; path?: string; rule?: string }> = [];
  try {
    errors = JSON.parse(errorsJson) as typeof errors;
  } catch {
    errors = [];
  }
  for (const error of errors) {
    if (!error.slide || !error.path) continue;
    const slides = (deck as { slides?: unknown[] }).slides;
    const slide = slides?.[error.slide - 1];
    if (!slide) continue;
    const path = parsePath(error.path);
    const value = getAtPath(slide, path);
    if (typeof value === 'string') {
      const ascii = value.match(/[A-Za-z0-9]{20,}/);
      const shortened = ascii ? '長い英字列を短くした項目' : `${value.slice(0, Math.max(12, Math.floor(value.length * 0.45)))}…`;
      setAtPath(slide, path, shortened);
    }
  }
  mutateStrings(deck, (text) => {
    const ascii = text.match(/[A-Za-z0-9]{20,}/);
    if (ascii) return '短い項目';
    return text.length > 70 ? `${text.slice(0, 48)}…` : text;
  });
  return stringify(deck);
}

function mockEdit({ base, target, instruction }: EditRequest) {
  const copy = structuredClone(base);
  const text = (instruction.match(/[「『](.+?)[」』]/)?.[1] ?? instruction).slice(0, 26);
  if (target.kind === 'transition') {
    const slide = copy.slides[target.index];
    if (slide.type !== 'chart') throw new Error('対象がグラフではありません');
    const timing = slide.transition ?? { emphasisDuration: 0.55, headlineDelay: 0.65, detailDuration: 0.65 };
    return stringify({ ...timing, headlineDelay: /早|速/.test(instruction)
      ? Math.max(0, timing.headlineDelay - 0.65) : Math.min(6, Math.round((timing.headlineDelay + 0.85) * 100) / 100) });
  }
  const slide = copy.slides[target.kind === 'slide' ? target.index : 0];
  if (slide.type === 'chart') slide.headline = text;
  else slide.title = text;
  if (target.kind === 'slide') return stringify(slide);
  copy.meta.title = text;
  return stringify(copy);
}

export class MockProvider implements AiProvider {
  name = 'mock' as const;
  model = 'mock';

  async complete(request: AiCompleteRequest): Promise<string> {
    const text = request.edit ? mockEdit(request.edit) : await this.generate(request);
    if (request.onText) {
      for (let offset = 0; offset < text.length; offset += 32) {
        request.onText(text.slice(offset, offset + 32));
        await delay(65);
      }
    }
    return text;
  }

  private async generate(request: AiCompleteRequest) {
    const current = request.prompt.match(/---CURRENT-YAML---\n([\s\S]*?)\n---END-CURRENT-YAML---/);
    if (current) {
      const errors = request.prompt.match(/検証エラーJSON:\n([\s\S]*)$/);
      return fixMockYaml(current[1], errors?.[1]?.trim() || '[]');
    }
    const overview = request.prompt.match(/作成してほしいスライド概要:\n([\s\S]*)$/)?.[1] ?? 'サンプル';
    if (/売上|年間グラフ/.test(overview)) {
      return readFile(new URL('../../examples/annual-sales.yaml', import.meta.url), 'utf8');
    }
    const deck = sampleDeck(overview);
    const requested = Number(overview.match(/(\d+)枚/)?.[1] ?? deck.slides.length);
    const originals = deck.slides;
    deck.slides = Array.from({ length: Math.min(20, Math.max(1, requested)) }, (_, i) => originals[i % originals.length]);
    return stringify(deck, { aliasDuplicateObjects: false });
  }
}
