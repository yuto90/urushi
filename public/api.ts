import type { Preview, JobEvent } from '../src/editor-protocol';
export type { Preview, JobEvent };
export type Provider = 'mock' | 'vertex-gemini' | 'vertex-claude';

export async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function asset(preview: Preview, action: 'html' | 'thumb', slide?: number) {
  const url = new URL(`/api/jobs/${preview.id}/${action}`, location.origin);
  if (preview.snapshot) url.searchParams.set('snapshot', String(preview.snapshot));
  if (slide !== undefined) url.searchParams.set('slide', String(slide));
  return url.href;
}

export async function generate(body: unknown, receive: (event: JobEvent) => void) {
  const { id } = await request<{ id: string }>('/api/generate', body);
  const done = await new Promise<Extract<JobEvent, { type: 'done' }>>((resolve, reject) => {
    const events = new EventSource(`/api/jobs/${id}/events`);
    events.onmessage = ({ data }) => {
      const event: JobEvent = JSON.parse(data);
      receive(event);
      if (event.type === 'done') { events.close(); resolve(event); }
      if (event.type === 'failed') { events.close(); reject(new Error(event.error)); }
    };
    events.onerror = () => {
      if (events.readyState === EventSource.CLOSED) reject(new Error('生成ジョブに接続できません。もう一度送信してください'));
    };
  });
  const res = await fetch(`/api/jobs/${id}/yaml`);
  if (!res.ok) throw new Error('完成した YAML を取得できません');
  return { ...done, yaml: await res.text() };
}

export function download(href: string, name: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
}
