import type { Project } from './backup';
export type { Project, Message, Target } from './backup';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('urushi-editor', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const storage = {
  async list(): Promise<Project[]> {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects');
      const req = tx.objectStore('projects').getAll();
      tx.oncomplete = () => { db.close(); resolve((req.result as Project[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  },
  async save(project: Project, expectedVersions: number) {
    const db = await database();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const table = tx.objectStore('projects');
      const existing = table.get(project.id);
      existing.onsuccess = () => {
        if ((existing.result?.versions.length ?? 0) !== expectedVersions) { tx.abort(); return; }
        table.put(project);
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error('別のタブで更新されました。「最近の資料」から開き直してください')); };
    });
  },
};
