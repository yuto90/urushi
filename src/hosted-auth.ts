import type { IncomingMessage } from 'node:http';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export class AccessError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export interface AccessSettings {
  issuer?: string;
  audience?: string;
  ownerEmail?: string;
}

export class HostedAuth {
  private readonly keys?: JWTVerifyGetKey;

  constructor(private readonly settings: AccessSettings, keys?: JWTVerifyGetKey) {
    if (settings.issuer && /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(settings.issuer)) {
      this.keys = keys ?? createRemoteJWKSet(new URL(settings.issuer + '/cdn-cgi/access/certs'));
    }
  }

  async authenticate(request: IncomingMessage) {
    const { issuer, audience, ownerEmail } = this.settings;
    if (!this.keys || !issuer || !audience || !ownerEmail?.trim()) {
      throw new AccessError(503, '現在、資料の生成は停止しています');
    }
    const token = request.headers['cf-access-jwt-assertion'];
    if (typeof token !== 'string') throw new AccessError(401, 'メールでログインしてください');
    const { payload } = await jwtVerify(token, this.keys, {
      algorithms: ['RS256'], issuer, audience, requiredClaims: ['exp', 'iat', 'sub', 'email', 'type'],
    }).catch(() => { throw new AccessError(401, 'ログインの有効期限が切れました。もう一度ログインしてください'); });
    if (!payload.sub || payload.type !== 'app' || typeof payload.email !== 'string' ||
        payload.email.trim().toLowerCase() !== ownerEmail.trim().toLowerCase()) {
      throw new AccessError(403, 'このアカウントには生成が許可されていません');
    }
    if (request.method === 'POST' && (request.headers.origin !== 'https://urushi-demo.pages.dev' ||
        request.headers['content-type']?.split(';')[0].trim() !== 'application/json')) {
      throw new AccessError(403, '公開版 Urushi の編集画面から送信してください');
    }
    return { uid: payload.sub, expires: payload.exp! };
  }

  static fromEnvironment() {
    return new HostedAuth({ issuer: process.env.URUSHI_ACCESS_ISSUER, audience: process.env.URUSHI_ACCESS_AUD,
      ownerEmail: process.env.URUSHI_OWNER_EMAIL });
  }
}
