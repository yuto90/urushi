# Urushi 設計メモ

## 1. 目的

AI エージェントが「作る・見る・直す」を回せるスライド基盤を作る。AI の認知特性に道具を合わせる。

## 2. 5つの柱

1. 型付きの意味スキーマ
2. デザイントークンの強制
3. 機械可読なレイアウト検証
4. スクリーンショット自己修正ループ
5. PDF・PPTX 書き出し

## 3. 全体の流れ

```text
deck.yaml
  → schema（型と制約の検証）
  → render（トークン準拠の HTML）
  → check（ヘッドレス Chromium で実測）
  → 構造化エラー JSON
  → エージェントが直す
  → export（PDF、Phase 1 で PPTX・スクショ）
```

## 4. 合意した方針

### 言語

TypeScript / Node。

### 入力

`deck.yaml`（YAML）。`slides` の配列で、各スライドは `type` と型ごとの項目を持つ。座標や見た目は書かせない。

### スキーマ

結論・比較・因果・手順・一覧の5型を Zod で定義する。JSON Schema も同じ定義から出し、MCP の入力スキーマにも使う。

### トークン

色・書体・余白・角丸を CSS カスタムプロパティで1テーマにまとめる。テンプレートは変数しか参照しない。

### 出力デッキ

素の HTML/CSS、小さな自前ランタイム（ページ送り・スケーリング）、GSAP で構成する。React は出力に入れない。1ファイル完結、1920x1080 固定キャンバス。

理由:

- 開いた時点で描画済みなので、検証・スクショ・PDF が安定する
- HTML の diff で直せる
- ビルド不要

### 内部テンプレート

型ごとの型紙を JSX で書き、HTML 文字列に変換するだけにする。Hono JSX か Preact render-to-string のどちらにするかは未決。ランタイムは出力に入らない。

将来の編集 GUI を作る場合は React を使ってよい（人向けなので）。

### アニメーション

アニメーションは部品カタログにし、AI は名前で選ぶだけにする。

```yaml
animation: balance
```

```html
<div data-anim="bar-grow">
```

各部品は、名前・パラメータ・所要時間・発火条件・PDF 用の静止状態を持ち、トークンのみ使う。二段構えにし、標準部品は Urushi が提供し、ユーザー（その AI）も同じ「部品の決まり」で追加できるようにする。追加の開放は Phase 2。

初期候補:

- 組み上がる図
- 伸びるバー／カウントアップ
- ステップ出現
- モーフィング比較
- 天秤・対比
- データの流れ込み

### 検証

Playwright で DOM を実測する。Phase 0 は文字のはみ出しのみ。

エラー例:

```json
{"slide":3,"path":"right.points[1]","rule":"text-overflow","measured":412,"limit":360,"unit":"px","hint":"40字以内に縮めるか、項目を分けてください"}
```

### 書き出し

Phase 0 は Playwright の `page.pdf()`。PPTX は Phase 1。

### 呼び出し口

CLI（`urushi check` / `build` / `export`）。MCP は同じ中核を包んで Phase 2。

### 型に収まらない自由 HTML

逃げ道は Phase 1 以降。

## 5. フェーズ

| Phase | 内容 |
| --- | --- |
| Phase 0 | 自分用。5型・1テーマ・はみ出し検証・PDF。自分の企画資料を3本作る |
| Phase 1 | 自己修正ループ、アニメーション第1弾、PPTX |
| Phase 2 | MCP・CLI 公開、他者利用、ユーザー部品の開放 |
| Phase 3 | Google スライド受け渡し、AI 回答のスワイプ図解へ転用 |

## 6. ディレクトリ構成の案（Phase 0）

```text
src/
  schema/
  tokens/
  templates/
  render/
  check/
  export/
  cli/
```

## 7. 未決事項

- JSX の実装（Hono JSX / Preact）
- PPTX の方式
- PR #1 のプロトタイプを本構成へどう寄せるか
