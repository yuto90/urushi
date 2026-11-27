import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { buildDeck } from '../dist/pipeline.js';
import { captureSlideScreenshots } from '../dist/check/index.js';

const samples = [
  ['planning-proposal', '営業支援AIの導入企画', '企画書の要旨を題材にした5枚構成'],
  ['product-review', 'モバイルアプリ改善レビュー', '比較と手順を中心にした3枚構成'],
  ['custom-and-flow', 'データ基盤の流れ', '自由HTMLの逃げ道を含む3枚構成'],
];

const root = resolve('dist-pages');
const decksRoot = join(root, 'decks');
const assetsRoot = join(root, 'assets');
await mkdir(decksRoot, { recursive: true });
await mkdir(assetsRoot, { recursive: true });

const cards = [];
for (const [name, title, description] of samples) {
  const yamlPath = join('examples', `${name}.yaml`);
  const outDir = join(decksRoot, name);
  const built = await buildDeck(yamlPath, outDir);
  let image = '';
  try {
    const screenshots = await captureSlideScreenshots(built.htmlPath, join(outDir, 'screenshots'));
    if (screenshots[0]) {
      const imageName = `${name}-slide-01.png`;
      await copyFile(screenshots[0], join(assetsRoot, imageName));
      image = `assets/${imageName}`;
    }
  } catch (error) {
    console.warn(`screenshot skipped for ${name}: ${error instanceof Error ? error.message : error}`);
  }
  cards.push({ name, title, description, image });
}

const cardHtml = cards.map((card) => `
  <article class="card">
    <a class="thumb" href="decks/${card.name}/" aria-label="${card.title} を開く">
      ${card.image ? `<img src="${card.image}" alt="${card.title} の1枚目">` : '<div class="fallback">Urushi deck</div>'}
    </a>
    <div class="card-body">
      <h2>${card.title}</h2>
      <p>${card.description}</p>
      <div class="links">
        <a href="decks/${card.name}/">デッキを開く</a>
        <a href="decks/${card.name}/deck.yaml">deck.yaml</a>
      </div>
    </div>
  </article>`).join('\n');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Urushi sample gallery</title>
<style>
:root{color-scheme:dark;--bg:#101319;--panel:#202735;--text:#f5f1e8;--muted:#aeb7c7;--line:rgba(245,241,232,.14);--accent:#d6a84f;font-family:"Hiragino Sans","Yu Gothic","Noto Sans JP",system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0%,rgba(214,168,79,.14),transparent 34rem),var(--bg);color:var(--text)}main{max-width:1180px;margin:0 auto;padding:54px 24px 70px}.eyebrow{color:#f0c568;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{font-size:52px;letter-spacing:-.05em;margin:6px 0 10px}.lead{color:var(--muted);font-size:18px;line-height:1.7;max-width:780px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:38px}.card{overflow:hidden;border:1px solid var(--line);border-radius:24px;background:rgba(32,39,53,.88);box-shadow:0 24px 70px rgba(0,0,0,.3)}.thumb{display:block;aspect-ratio:16/9;background:#070a0f}.thumb img{width:100%;height:100%;object-fit:cover;display:block}.fallback{height:100%;display:grid;place-items:center;color:var(--muted)}.card-body{padding:18px}h2{font-size:20px;margin:0 0 8px}p{color:var(--muted);line-height:1.6;margin:0}.links{display:flex;gap:10px;margin-top:16px}.links a{color:#171006;background:var(--accent);border-radius:999px;padding:8px 12px;font-size:13px;font-weight:800;text-decoration:none}.links a+a{color:var(--text);background:rgba(255,255,255,.08);border:1px solid var(--line)}footer{margin-top:34px;color:var(--muted);font-size:13px}@media(max-width:900px){.grid{grid-template-columns:1fr}h1{font-size:40px}}
</style>
</head>
<body>
<main>
  <div class="eyebrow">Urushi sample gallery</div>
  <h1>AI生成スライドの叩き台</h1>
  <p class="lead">Urushi のスキーマ駆動パイプラインで生成した静的サンプルです。ブラウザから Vertex AI を呼ぶ必要はなく、生成済みの1ファイルHTMLデッキを閲覧できます。</p>
  <section class="grid">
${cardHtml}
  </section>
  <footer>このページはレビュー用の一時公開です。サンプル内容はダミーデータです。</footer>
</main>
</body>
</html>`;

await writeFile(join(root, 'index.html'), html, 'utf8');
console.log(`built ${root}`);
