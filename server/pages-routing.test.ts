import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { hashPassword, randomToken } from './password';

// Exercise the generated Pages router and Worker WebCrypto, not just handlers in Node.
let runtime: Miniflare;
let directory: string;
const password = randomToken();
const origin = 'https://preview.example.test';
function request(path: string, body: unknown = {}, cookie?: string) {
  return runtime.dispatchFetch(origin + path, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'epb-pages-regression-'));
  await promisify(execFile)(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'pages', 'functions', 'build', '--outdir', directory, '--project-directory', process.cwd()], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: join(directory, 'wrangler.log') },
  });
  runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: await readFile(join(directory, 'index.js'), 'utf8'),
    compatibilityDate: '2026-08-01',
    d1Databases: ['DB'],
    bindings: { PUBLIC_DATA_ENABLED: 'false' },
    serviceBindings: { ASSETS: async () => new Response('<!doctype html><title>SPA shell</title>', { headers: { 'Content-Type': 'text/html' } }) },
  }));
  const db = await runtime.getD1Database('DB');
  for (const file of ['0001_initial.sql', '0002_seed_original.sql', '0003_admin_auth.sql']) {
    for (const sql of unstable_splitSqlQuery(await readFile(join('migrations', file), 'utf8'))) await db.prepare(sql).run();
  }
  await db.prepare('INSERT INTO admin_users (id,email,password_hash) VALUES (?,?,?)')
    .bind('synthetic-routing-user', 'synthetic@example.test', await hashPassword(password)).run();
}, 30000);
afterAll(async () => {
  await runtime?.dispose();
  if (directory) await rm(directory, { recursive: true, force: true });
});
it('canonical login accepts anonymous requests and returns JSON validation, never the SPA shell', async () => {
  for (const path of ['/api/auth/login', '/api/auth/login/']) {
    const response = await request(path);
    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')?.startsWith('application/json')).toBe(true);
    expect((await response.json() as {error:string}).error).toBe('E-mel atau kata laluan tidak sah.');
  }
});
it('admin namespace including the non-login route remains protected without a session', async () => {
  for (const path of ['/api/admin/login', '/api/admin/schedules', '/api/admin/announcements', '/api/admin/audit', '/api/admin/status']) {
    const response = await request(path);
    expect(response.status).toBe(401);
    expect((await response.json() as {error:string}).error).toBe('Sesi tidak sah. Sila log masuk.');
  }
});
it('Pages login page is public while private pages redirect and session check stays private', async () => {
  const login = await runtime.dispatchFetch(origin + '/admin/login');
  expect(login.status).toBe(200);
  expect((await login.text()).includes('SPA shell')).toBe(true);
  for (const path of ['/admin', '/admin/settings']) {
    const response = await runtime.dispatchFetch(origin + path, { redirect: 'manual' });
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/admin/login');
  }
  expect((await runtime.dispatchFetch(origin + '/api/auth/session')).status).toBe(401);
});
it('real Worker login can verify the CLI-compatible PBKDF2 verifier and establish a protected session', async () => {
  const login = await request('/api/auth/login', { email: 'synthetic@example.test', password });
  expect(login.status).toBe(200);
  const cookie = (login.headers.get('Set-Cookie') ?? '').split(';')[0];
  const status = await runtime.dispatchFetch(origin + '/api/admin/status', { headers: { Cookie: cookie } });
  expect(status.status).toBe(200);
  expect((await status.json() as {actor:string}).actor === 'synthetic@example.test').toBe(true);
  // A session does not bypass CSRF on writes.
  expect((await request('/api/admin/announcements', { title: 'Synthetic', body: 'Text', status: 'draft' }, cookie)).status).toBe(403);
});
it('missing auth schema produces the reported 503, not a session or SPA-routing error', async () => {
  const db = await runtime.getD1Database('DB');
  await db.prepare('DROP TABLE login_rate_limits').run(); // Isolated, disposable test DB only.
  const response = await request('/api/auth/login', { email: 'synthetic@example.test', password });
  expect(response.status).toBe(503);
  expect((await response.json() as {error:string}).error).toBe('Perkhidmatan pengesahan tidak tersedia.');
  // HTTP input validation still runs before any auth database work.
  expect((await request('/api/auth/login')).status).toBe(400);
});
