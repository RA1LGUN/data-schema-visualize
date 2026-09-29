import http from 'node:http';
import path from 'node:path';
import { open, realpath, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultPublicDir = fileURLToPath(new URL('./public/', import.meta.url));
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function isInside(root, filename) {
  const relative = path.relative(root, filename);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function requestedPath(target) {
  // Inspect the raw target before URL normalization can erase dot segments.
  if (!target?.startsWith('/') || target.startsWith('//')) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(target.split('?')[0]);
  } catch {
    return null;
  }
  // Percent signs prevent double-encoding; colons block Windows alternate streams.
  if (/[\\%:#\u0000-\u001f\u007f]/u.test(pathname)) return null;
  const segments = pathname.split('/').slice(1);
  if (segments.some(segment => segment.startsWith('.') || /[. ]$/u.test(segment) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu.test(segment))) return null;
  if (pathname !== '/' && segments.some(segment => segment === '')) return null;
  return pathname === '/' ? 'index.html' : segments.join('/');
}

function send(req, res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  const bytes = Buffer.from(body);
  res.writeHead(status, {
    ...securityHeaders,
    'Content-Type': type,
    'Content-Length': bytes.length,
    'Cache-Control': 'no-cache',
    ...extra,
  });
  res.end(req.method === 'HEAD' ? undefined : bytes);
}

export async function createStaticServer({ publicDir = defaultPublicDir } = {}) {
  const publicRoot = await realpath(publicDir);
  const entrypoint = await realpath(path.join(publicRoot, 'index.html'));
  if (!isInside(publicRoot, entrypoint) || !(await stat(entrypoint)).isFile()) {
    throw new Error('public/index.html must be a regular file inside public.');
  }

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(req, res, 405, 'Method Not Allowed\n', undefined, { Allow: 'GET, HEAD' });
      return;
    }

    const relativePath = requestedPath(req.url);
    if (relativePath === null) {
      send(req, res, 400, 'Bad Request\n');
      return;
    }
    if (relativePath === 'healthz') {
      send(req, res, 200, JSON.stringify({ status: 'ok' }), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
      return;
    }

    const contentType = mimeTypes.get(path.extname(relativePath).toLowerCase());
    const candidate = path.resolve(publicRoot, relativePath);
    if (!contentType || !isInside(publicRoot, candidate)) {
      send(req, res, 404, 'Not Found\n');
      return;
    }

    let file;
    try {
      const canonical = await realpath(candidate);
      if (!isInside(publicRoot, canonical)) {
        send(req, res, 404, 'Not Found\n');
        return;
      }
      file = await open(canonical, 'r');
      const info = await file.stat();
      if (!info.isFile()) {
        send(req, res, 404, 'Not Found\n');
        return;
      }
      res.writeHead(200, {
        ...securityHeaders,
        'Content-Type': contentType,
        'Content-Length': info.size,
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const stream = file.createReadStream({ autoClose: true });
      file = undefined;
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
      } else if (['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'ELOOP'].includes(error.code)) {
        send(req, res, 404, 'Not Found\n');
      } else {
        console.error('Static file request failed:', error.code ?? error.name);
        send(req, res, 500, 'Internal Server Error\n');
      }
    } finally {
      await file?.close();
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

export function readPort(value = process.env.PORT ?? '4177') {
  if (!/^\d+$/u.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return Number(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = readPort();
  const server = await createStaticServer();
  server.listen(port, '0.0.0.0', () => console.log(`Schema Atlas listening on 0.0.0.0:${port}`));
  server.on('error', error => {
    console.error(`Unable to start Schema Atlas: ${error.code ?? error.message}`);
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 5_000).unref();
    });
  }
}
