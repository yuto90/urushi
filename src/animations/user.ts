import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { builtInAnimations } from './catalog.js';
import { animationSpecSchema, type AnimationSpec } from './types.js';

export async function loadAnimationCatalog(baseDir = process.cwd()): Promise<AnimationSpec[]> {
  const specs = new Map<string, AnimationSpec>();
  for (const spec of builtInAnimations) specs.set(spec.name, spec);

  const directory = resolve(baseDir, 'urushi.components');
  let entries: string[] = [];
  try {
    entries = await readdir(directory);
  } catch {
    return [...specs.values()];
  }

  for (const entry of entries.filter((name) => name.endsWith('.mjs')).sort()) {
    const moduleUrl = pathToFileURL(join(directory, entry)).href;
    const loaded = (await import(moduleUrl)) as { default?: unknown };
    const parsed = animationSpecSchema.safeParse(loaded.default);
    if (!parsed.success) {
      throw new Error(`urushi.components/${entry} が部品の決まりを満たしていません: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`);
    }
    specs.set(parsed.data.name, parsed.data);
  }
  return [...specs.values()];
}
