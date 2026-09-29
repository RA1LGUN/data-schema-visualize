import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { after, before, test } from 'node:test';
import { createStaticServer, readPort } from '../server.mjs';

let fixture;
let publicDir;
let server;
let port;
let linkError;

before(async () => {
  fixture = await mkdtemp(path.join(os.tmpdir(), 'schema-atlas-test-'));
  publicDir = path.join(fixture, 'public');
  await mkdir(path.join(publicDir, 'docs'), { recursive: true });
  await mkdir(path.join(fixture, 'private'));
  await Promise.all([
    writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>Schema Atlas</title>'),
    writeFile(path.join(publicDir, 'app.mjs'), 'export const ready = true;'),
    writeFile(path.join(publicDir, 'styles.css'), 'body { color: #111; }'),
    writeFile(path.join(publicDir, 'data.json'), '{"ready":true}'),
    writeFile(path.join(publicDir, 'docs', 'schema.md'), '# Schema'),
    writeFile(path.join(publicDir, '.hidden.json'), '{"secret":true}'),
    writeFile(path.join(publicDir, 'script.ps1'), 'private script'),
    writeFile(path.join(fixture, 'README.md'), 'private README marker'),
    writeFile(path.join(fixture, 'server.mjs'), 'private server marker'),
    writeFile(path.join(fixture, 'private', 'secret.json'), '{"private":"marker"}'),
  ]);
  try {
    await symlink(await realpath(path.join(fixture, 'private')), path.join(publicDir, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    linkError = error;
  }
  server = await createStaticServer({ publicDir });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  port = server.address().port;
});

after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  if (fixture) await rm(fixture, { recursive: true, force: true });
});

function get(target, method = 'GET') {
  return new Promise((resolve, reject) => {
    // Keep raw paths intact: URL/fetch would normalize some traversal attempts.
    const req = request({ host: '127.0.0.1', port, path: target, method, agent: false }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves the entrypoint and GET-equivalent HEAD with security headers', async () => {
  const page = await get('/?view=graph');
  assert.equal(page.status, 200);
  assert.match(page.body, /Schema Atlas/u);
  assert.match(page.headers['content-type'], /^text\/html/u);
  assert.equal(page.headers['x-content-type-options'], 'nosniff');
  assert.equal(page.headers['x-frame-options'], 'DENY');
  assert.match(page.headers['content-security-policy'], /script-src 'self'/u);
  const head = await get('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], page.headers['content-length']);
});

test('serves local modules, styles, JSON and Markdown with explicit MIME types', async () => {
  for (const [target, type] of [['/app.mjs', 'text/javascript'], ['/styles.css', 'text/css'], ['/data.json', 'application/json'], ['/docs/schema.md', 'text/markdown']]) {
    const response = await get(target);
    assert.equal(response.status, 200, target);
    assert.ok(response.headers['content-type'].startsWith(type), target);
  }
});

test('healthcheck supports GET and HEAD and bypasses cache', async () => {
  const response = await get('/healthz');
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
  assert.equal(response.headers['cache-control'], 'no-store');
  const head = await get('/healthz', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});

test('unknown routes and directories are real 404s, not the index page', async () => {
  for (const target of ['/missing', '/missing.html', '/docs', '/data.json/missing.html']) {
    const response = await get(target);
    assert.equal(response.status, 404, target);
    assert.equal(response.body, 'Not Found\n');
  }
});

test('rejects mutation methods with a correct Allow header', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await get('/', method);
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.allow, 'GET, HEAD');
  }
});

test('blocks raw, encoded and Windows-style traversal without leaking files', async () => {
  const targets = ['/../README.md', '/%2e%2e/README.md', '/%252e%252e/README.md', '/..%2fREADME.md', '/..\\README.md', '/%2e%2e%5cREADME.md', '//README.md', '/C:%5cREADME.md', '/index.html::$DATA', '/%00index.html', '/%zz', '/index.html.', '/index.html%20', '/CON.json'];
  for (const target of targets) {
    const response = await get(target);
    assert.equal(response.status, 400, target);
    assert.equal(response.body, 'Bad Request\n', target);
  }
});

test('does not expose files outside public, hidden files, scripts or escaping symlinks', async t => {
  for (const target of ['/README.md', '/server.mjs', '/package.json', '/script.ps1', '/escape/secret.json']) {
    const response = await get(target);
    assert.equal(response.status, 404, target);
    assert.equal(response.body, 'Not Found\n', target);
  }
  assert.equal((await get('/.hidden.json')).status, 400);
  if (linkError) t.diagnostic(`Symlink creation unavailable (${linkError.code}); outside-root realpath branch was not exercised.`);
  else assert.equal((await get('/escape/secret.json')).status, 404);
});

test('validates deployment PORT and refuses missing entrypoints at startup', async () => {
  assert.equal(readPort('4177'), 4177);
  assert.equal(readPort('8080'), 8080);
  for (const value of ['', '0', '65536', 'abc', '80junk', '-1']) assert.throws(() => readPort(value));
  await assert.rejects(createStaticServer({ publicDir: path.join(fixture, 'private') }), { code: 'ENOENT' });
});
