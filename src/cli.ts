#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateDeck } from "./generate.js";

function usage(): string {
  return `使い方:
  node dist/cli.js "作りたいスライドの概要"
  node dist/cli.js --sample "任意の概要"

オプション:
  --sample   Anthropic APIを呼ばず examples/sample.html を出力
  --help     このヘルプを表示`;
}

function timestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage());
    return;
  }

  const forceSample = args.includes("--sample");
  const brief = args.filter((arg) => arg !== "--sample").join(" ").trim();
  if (!brief) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const result = await generateDeck(brief, { forceSample });
  const outDir = path.resolve(process.cwd(), "out");
  await mkdir(outDir, { recursive: true });

  const outputPath = path.join(outDir, `${timestamp()}.html`);
  await writeFile(outputPath, result.html, "utf8");

  console.log(`スライドを書き出しました: ${outputPath}`);
  if (result.usedMock) {
    console.log("ANTHROPIC_API_KEY 未設定または --sample のため、サンプルHTMLを使用しました。");
  } else {
    console.log(`モデル: ${result.model}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
