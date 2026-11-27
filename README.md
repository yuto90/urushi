# Urushi

Urushi は、AI が「作る・見る・直す」を回せるスライド生成基盤の叩き台です。自然言語の概要から `deck.yaml` を生成し、型付きスキーマ、デザイントークン、JSX テンプレート、Playwright による実測検証、自己修正ループ、PDF/PPTX 書き出しまでを一連のパイプラインで実行します。

AI 呼び出しは GCP / Vertex AI 経由です。ブラウザの BYOK 版は廃止し、GitHub Pages は生成済みサンプルの静的ギャラリーです。

## パイプライン

```text
概要
  → AI (Vertex AI / Gemini または Claude)
  → deck.yaml
  → Zod schema validation
  → JSX template + design tokens
  → 1-file HTML (vanilla runtime + GSAP)
  → Playwright check + slide PNG
  → AI fix loop (既定3回まで)
  → PDF / PPTX export
```

主な構成:

```text
src/schema/       deck.yaml の Zod スキーマと JSON Schema 生成
src/tokens/       CSS カスタムプロパティの1テーマ
src/templates/    5型 + custom の JSX 型紙 (Preact render-to-string)
src/animations/   アニメーション部品カタログとユーザー部品ローダー
src/render/       1ファイルHTML、ページ送り、1920x1080スケーリング
src/check/        Playwright 実測、構造化エラー、スライドPNG
src/ai/           Vertex AI provider abstraction と自己修正ループ
src/export/       PDF / PPTX 書き出し
src/server.ts     Web UI / ローカルジョブ API
src/mcp.ts        MCP stdio server
examples/         サンプル deck.yaml
urushi.components/ ユーザーアニメーション部品の例
```

## 必要なもの

- Node.js 20以上（22推奨）
- Chromium 系ブラウザ（Playwright 実測用。通常はインストール済みの Chrome を自動検出）
- GCP プロジェクトと ADC（実 AI を使う場合）

ADC の設定:

```sh
gcloud auth application-default login
gcloud config set project <PROJECT_ID>
```

Vertex AI API が無効な場合は、オーナー権限のある人が有効化してください（このリポジトリのコードは GCP 設定を変更しません）。

```sh
gcloud services enable aiplatform.googleapis.com
```

Claude on Vertex AI を使う場合は、さらに Model Garden で対象モデルの有効化と、リージョン/グローバル online prediction quota の確保が必要です。Gemini 3.x 系は `global` / `us` / `eu` など、モデルが提供されているロケーションを選んでください。

## セットアップ

```sh
npm install
cp .env.example .env
```

`.env` の例:

```sh
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=global
URUSHI_PROVIDER=vertex-gemini
URUSHI_MODEL=gemini-3.8-flash
PORT=3333
```

秘密情報やトークンはコミットしないでください。`.env` は `.gitignore` 済みです。

### Provider

| Provider | 実装 | 既定モデル |
| --- | --- | --- |
| `vertex-gemini` | `@google/genai` の Vertex AI mode | `gemini-3.8-flash` |
| `vertex-claude` | `@anthropic-ai/vertex-sdk` | `claude-sonnet-5-5` |
| `mock` | 外部APIを呼ばない決定的モック | `mock` |

`URUSHI_PROVIDER`、CLI の `--provider`、Web UI の選択で切り替えられます。

## CLI

```sh
npm run build

# 概要から生成し、check + スクショ + AI修正ループまで実行
node dist/cli.js generate "営業支援AIの導入企画を5枚で" --out out/demo

# モックで全工程を確認
node dist/cli.js generate "営業支援AIの導入企画を5枚で" --provider mock --out out/mock

# YAMLから1ファイルHTMLを構築
node dist/cli.js build examples/planning-proposal.yaml --out out/planning

# Playwright実測。構造化エラーJSONを返す
node dist/cli.js check examples/planning-proposal.yaml --out out/planning --json

# 既存YAMLをAI修正。モックでも確認できる
node dist/cli.js fix examples/overflow.yaml --provider mock --out out/fixed

# PDF / PPTX
node dist/cli.js export examples/planning-proposal.yaml --out out/planning --pdf --pptx

# JSON Schema を生成
node dist/cli.js schema --out schema/deck.schema.json
```

`check` のエラーは次の形です。

```json
{
  "slide": 1,
  "path": "left.points[0]",
  "rule": "text-overflow",
  "measured": 296,
  "limit": 8,
  "unit": "px",
  "hint": "文字を40〜60%に縮めるか、項目を分割してください"
}
```

## Web UI

```sh
npm run dev
```

<http://localhost:3333> を開きます。

- 概要入力
- Provider 選択
- 生成・自己修正ループの進行表示
- デッキプレビュー
- 検証エラー一覧
- `deck.yaml` の直接編集と再ビルド
- PDF / PPTX ダウンロード

## MCP server

```sh
node dist/cli.js mcp
```

stdio MCP サーバーとして、同じ中核を包んだ `generate` / `render` / `check` / `export` ツールを提供します。クライアント設定例:

```json
{
  "mcpServers": {
    "urushi": {
      "command": "node",
      "args": ["/path/to/urushi/dist/cli.js", "mcp"]
    }
  }
}
```

## deck.yaml の型

5つの意味型に加えて、逃げ道として `custom` があります。

- `conclusion`: 結論
- `comparison`: 比較
- `causal`: 因果
- `process`: 手順
- `list`: 一覧
- `custom`: 自由HTML（トークン逸脱は警告）

例は [`examples/planning-proposal.yaml`](examples/planning-proposal.yaml) を参照してください。JSON Schema は `npm run schema` で再生成できます。

## アニメーション部品

AI は `animation: <name>` でカタログ内の部品を選ぶだけです。標準部品:

- `assemble`
- `bar-grow`
- `count-up`
- `step-in`
- `morph-compare`
- `balance`
- `data-flow`

各部品は名前・パラメータ・所要時間・発火条件・PDF用の静止状態を持ちます。PDF/静止モードでは最終状態で描画します。

`urushi.components/*.mjs` に同じ契約の部品を置くとカタログへ追加できます。例: [`urushi.components/fade-rise.mjs`](urushi.components/fade-rise.mjs)。

## GitHub Pages（一時公開）

Pages は生成済みサンプル3本の静的ギャラリーです。ブラウザから Vertex AI を呼ぶ機能はありません。

```sh
npm run build:pages
```

`dist-pages/` が出力されます。公開内容はダミーのサンプルデッキだけにしてください。実案件の情報を含むデッキは公開しないでください。

## 検証

```sh
npm run typecheck
npm run build
npm run schema
node dist/cli.js check examples/planning-proposal.yaml --out out/check-ok --json
node dist/cli.js check examples/overflow.yaml --out out/check-ng --json
node dist/cli.js fix examples/overflow.yaml --provider mock --out out/fix-mock
node dist/cli.js export examples/planning-proposal.yaml --out out/export --pdf --pptx
npm run build:pages
```

CI は typecheck と build を実行します。Playwright が必要な実測検証はローカルの Chromium で行います。
