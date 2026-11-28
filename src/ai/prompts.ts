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
- chart: 共通の棒グラフを複数の節目で使う。charts に一度だけ id, unit, bars（label/value）、任意の breakdown（bar と items）を定義。各節目は同じ chartId を参照し、title（節目名）, headline, highlight（棒の名前の配列）, showBreakdown, annotation で到達状態を記録。隣の節目への時間は到着側の transition で指定。工程図を残す場合は charts の共有要素を kind: flow, id, nodes（label, description）で定義し、同様に chartId と highlight を使う。
- custom: title任意, html。どうしても型に収まらないときだけ使う

制約:
- version: 1 と meta.title を必ず付ける
- キーは version, meta, charts（必要時）, slides の順。slides はブロック形式の配列で、各スライドを新しい行のハイフンで始める。
- 枚数はユーザー指定を優先。指定がない場合は3〜6枚程度。各文字列はスキーマの上限より十分短くする
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
