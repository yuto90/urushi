import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(projectRoot, "dist-pages");
const assetsDir = path.join(outDir, "assets");
const pagesAssetsDir = path.join(assetsDir, "pages");

await rm(outDir, { recursive: true, force: true });
await mkdir(pagesAssetsDir, { recursive: true });

await cp(path.join(projectRoot, "pages", "index.html"), path.join(outDir, "index.html"));
await cp(path.join(projectRoot, "pages", "styles.css"), path.join(outDir, "styles.css"));
await cp(path.join(projectRoot, "examples", "sample.html"), path.join(outDir, "sample.html"));

for (const moduleName of ["anthropic.js", "postprocess.js", "prompt.js", "shared.js"]) {
  await cp(path.join(projectRoot, "dist", moduleName), path.join(assetsDir, moduleName));
}
await cp(path.join(projectRoot, "dist", "pages", "app.js"), path.join(pagesAssetsDir, "app.js"));
await writeFile(path.join(outDir, ".nojekyll"), "");

console.log(`Pages build written to ${outDir}`);
