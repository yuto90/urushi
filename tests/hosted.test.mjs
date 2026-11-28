import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { readFile, rm } from 'node:fs/promises';
import { generateKeyPair, SignJWT } from 'jose';
import { HostedAuth } from '../dist/hosted-auth.js';
import { createEditorServer } from '../dist/server.js';
import { jobs } from '../dist/server-jobs.js';

const origin = 'https://urushi-demo.pages.dev';
const issuer = 'https://example.cloudflareaccess.com';
const audience = 'test-application';
const email = 'owner@example.test';

test('hosted API verifies Access and job ownership before accessing data or starting a provider', async (t) => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const settings = { issuer, audience, ownerEmail: email };
  const server = await createEditorServer('vertex-gemini', new HostedAuth(settings, async () => publicKey));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  t.after(async () => {
    for (const job of jobs.values()) { await rm(job.outDir, { force: true, recursive: true }); }
  });
  const url = 'http://127.0.0.1:' + server.address().port;
  const token = (fields = {}, key = privateKey) => new SignJWT({
    iss: issuer, aud: [audience], sub: 'owner-identity', email, type: 'app',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...fields,
  }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(key);
  const access = await token();
  function call(path, assertion, body, headers = {}) {
    return fetch(url + path, { method: body ? 'POST' : 'GET', redirect: 'manual', headers: {
      ...(assertion && { 'cf-access-jwt-assertion': assertion }), ...(body && { 'content-type': 'application/json', origin }), ...headers,
    }, body: body && JSON.stringify(body) });
  }
  const input = { overview: '公開テスト用の一枚' };
  const gen = (assertion, body = input, headers) => call('/api/generate', assertion, body, headers);
  await t.test('anonymous, expired, unauthorized, forged and misconfigured calls never create jobs', async () => {
    for (const assertion of [undefined, 'invalid', await token({ exp: 1 }), await token({ iss: 'https://other.example' }),
      await token({ aud: ['another-app'] }), await token({}, (await generateKeyPair('RS256')).privateKey)]) {
      assert.equal((await gen(assertion)).status, 401);
    }
    assert.equal((await gen(undefined, input, { 'cf-access-authenticated-user-email': email })).status, 401);
    assert.equal((await gen(await token({ email: 'other@example.test' }))).status, 403);
    assert.equal((await gen(await token({ type: 'org' }))).status, 403);
    assert.equal((await gen(access, input, { origin: 'https://other.example' })).status, 403);
    assert.equal((await gen(access, { ...input, provider: 'mock' })).status, 400);
    settings.ownerEmail = '';
    assert.equal((await gen(access)).status, 503);
    settings.ownerEmail = email;
    assert.equal(jobs.size, 0);
  });
  await t.test('the owner can render private files, every job route enforces the same identity', async () => {
    assert.equal((await call('/api/login', access)).headers.get('location'), origin + '/');
    const res = await call('/api/render', access, { yaml: await readFile('examples/product-review.yaml', 'utf8') });
    assert.equal(res.status, 201);
    const { id } = await res.json();
    const job = '/api/jobs/' + id;
    assert.equal((await call(job, access)).status, 200);
    assert.equal((await call(job + '/yaml', access)).status, 200);
    assert.match((await call(job + '/html', access)).headers.get('cache-control'), /no-store/);
    const unknown = await token({ sub: 'different-principal' });
    for (const [suffix, body] of [[''], ['/events'], ['/html'], ['/html?snapshot=1'], ['/yaml'], ['/thumb?slide=0'],
      ['/download-pdf'], ['/download-pptx'], ['/rebuild', { yaml: 'unused' }], ['/export', {}]]) {
      assert.equal((await call(job + suffix, undefined, body)).status, 401, suffix);
      assert.equal((await call(job + suffix, unknown, body)).status, 404, suffix);
    }
    settings.ownerEmail = undefined;
    assert.equal((await call(job + '/yaml', access)).status, 503);
  });
});
