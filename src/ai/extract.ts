export function extractYamlText(text: string): string {
  let value = text.trim();
  const fence = value.match(/```(?:yaml|yml)?\s*([\s\S]*?)```/i);
  if (fence) value = fence[1].trim();
  const startCandidates = [value.indexOf('version:'), value.indexOf('meta:')].filter((index) => index >= 0);
  if (startCandidates.length) value = value.slice(Math.min(...startCandidates));
  return value.trim();
}
