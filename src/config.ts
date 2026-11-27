import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_MODEL } from "./shared.js";

let dotEnvLoaded = false;

function parseDotEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const separatorIndex = normalized.indexOf("=");
  if (separatorIndex <= 0) return null;

  const key = normalized.slice(0, separatorIndex).trim();
  let value = normalized.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return key ? [key, value] : null;
}

export function loadDotEnv(cwd = process.cwd()): void {
  if (dotEnvLoaded) return;
  dotEnvLoaded = true;

  const envPath = path.join(cwd, ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const parsed = parseDotEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export interface UrushiConfig {
  apiKey?: string;
  model: string;
  port: number;
}

export function getConfig(): UrushiConfig {
  loadDotEnv();

  const parsedPort = Number.parseInt(process.env.PORT ?? "3333", 10);
  return {
    apiKey: process.env.ANTHROPIC_API_KEY?.trim() || undefined,
    model: process.env.URUSHI_MODEL?.trim() || DEFAULT_MODEL,
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3333,
  };
}
