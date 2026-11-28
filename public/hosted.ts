const draftKey = 'urushi-login-draft';

export function login(draft: string) {
  sessionStorage.setItem(draftKey, draft);
  location.assign('/api/login');
}

export function takeDraft() {
  const draft = sessionStorage.getItem(draftKey) ?? '';
  sessionStorage.removeItem(draftKey);
  return draft;
}

export async function accessSession(): Promise<number | undefined> {
  const response = await fetch('/api/config', { redirect: 'manual', cache: 'no-store' });
  if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) return;
  if (!response.ok) throw new Error('生成サーバーに接続できません。時間をおいて再度お試しください');
  const config = await response.json();
  if (typeof config.expires !== 'number' || config.expires <= Date.now() / 1000) return;
  return config.expires;
}
