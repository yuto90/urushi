import type { AnimationSpec } from '../animations/index.js';
import { animationCatalogText } from '../animations/index.js';
import { deckJsonSchema } from '../schema/index.js';

const commonRules = `
あなたはスライド基盤 Urushi の構成ライターです。出力は必ず YAML 本文だけにしてください。説明文、コードフェンス、HTML全文は出力しないでください。

目的: 1920x1080の日本語ビジネススライドを作る。座標、font-size、色、装飾、レイアウト指定は書かない。意味だけを書く。

利用できる type:
- conclusion: title, conclusion, evidence(任意), callToAction(任意)
- comparison: title, left/right(label, summary任意, points, score任意), verdict任意
- causal: title, cause, mechanism(1〜4件), effect, implication任意
- process: title, steps(2〜6件, title/description), outcome任意
- list: title, items(2〜6件, title/description), takeaway任意
- custom: title任意, html。どうしても型に収まらないときだけ使う

制約:
- version: 1 と meta.title を必ず付ける
- 3〜6枚程度。各文字列はスキーマの上限より十分短くする
- 箇条書きは1行で読める長さにする。長い英数字の連続は避ける
- animation には次のカタログ名だけを使う。効果はスライド単位で1つ
`;

export function generationPrompt(overview: string, animations: AnimationSpec[]): string {
  return `${commonRules}

アニメーションカタログ:
${animationCatalogText(animations)}

deck.yaml の JSON Schema:
${JSON.stringify(deckJsonSchema)}

作成してほしいスライド概要:
${overview}
`;
}

export function fixPrompt(input: {
  overview: string;
  currentYaml: string;
  errors: unknown;
  animations: AnimationSpec[];
}): string {
  return `${commonRules}

アニメーションカタログ:
${animationCatalogText(input.animations)}

元の概要:
${input.overview}

現在のdeck.yaml:
---CURRENT-YAML---
${input.currentYaml}
---END-CURRENT-YAML---

検証エラーJSONとスクリーンショットを見て、エラーだけを最小修正した完全なdeck.yamlを返してください。文言の意図は保ち、はみ出しは短く、要素が重なる場合は項目を減らすか分割してください。custom HTMLは最後の手段です。

検証エラーJSON:
${JSON.stringify(input.errors, null, 2)}
`;
}
