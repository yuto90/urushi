import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let dotenvLoaded = false;

export function loadDotEnv(path = '.env'): void {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function googleCloudProject(): string | undefined {
  loadDotEnv();
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const value = execFileSync('gcloud', ['config', 'get-value', 'project'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return value && value !== '(unset)' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function googleCloudLocation(provider: 'vertex-gemini' | 'vertex-claude'): string {
  loadDotEnv();
  return process.env.GOOGLE_CLOUD_LOCATION || (provider === 'vertex-gemini' ? 'global' : 'global');
}

export type ProviderName = 'vertex-gemini' | 'vertex-claude' | 'mock';

export function configuredProvider(): ProviderName {
  loadDotEnv();
  const value = process.env.URUSHI_PROVIDER;
  if (value === 'vertex-claude' || value === 'vertex-gemini' || value === 'mock') return value;
  return 'vertex-gemini';
}

export function configuredModel(provider: ProviderName): string {
  loadDotEnv();
  if (process.env.URUSHI_MODEL) return process.env.URUSHI_MODEL;
  if (provider === 'vertex-claude') return 'claude-sonnet-5-5';
  if (provider === 'vertex-gemini') return 'gemini-4-neon';
  return 'mock';
}
