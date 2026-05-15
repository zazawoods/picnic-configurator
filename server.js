// Tiny static file server for Railway. Zero npm deps. Streams files; gzip text only.
const http = require('http');
const fs   = require('fs');
const zlib = require('zlib');
const path = require('path');

const port = process.env.PORT || 3000;
const root = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
  '.txt':  'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.gltf']);

// Files in the project root that must NEVER be served (server source, package metadata,
// dotfiles, version-control). Only the public-facing assets below this set are exposed.
const PUBLIC_ALLOW = new Set([
  '/', '/index.html',
  '/angle.glb', '/xset.glb', '/wood.jpg',
  '/favicon.ico',
]);

function safeJoin(rel) {
  const decoded = decodeURIComponent(rel.split('?')[0]);
  const target  = path.normalize(path.join(root, decoded));
  if (!target.startsWith(root)) return null;
  return target;
}

http.createServer((req, res) => {
  // Strip query string for allow-list match; normalize trailing slashes
  const rawPath = req.url.split('?')[0];
  const cleanPath = rawPath === '/' ? '/' : rawPath.replace(/\/+$/, '');
  if (!PUBLIC_ALLOW.has(cleanPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
    res.end('not found');
    return;
  }
  let urlPath = cleanPath === '/' ? '/index.html' : cleanPath;
  let target  = safeJoin(urlPath);
  if (!target) { res.writeHead(400); res.end('bad path'); return; }

  fs.stat(target, (err, st) => {
    if (err)            { res.writeHead(404); res.end('not found'); return; }
    if (st.isDirectory()) target = path.join(target, 'index.html');

    const ext  = path.extname(target).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const acceptEnc = (req.headers['accept-encoding'] || '').toLowerCase();
    const useGzip   = COMPRESSIBLE.has(ext) && acceptEnc.includes('gzip');

    const headers = {
      'Content-Type': mime,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // No X-Frame-Options (legacy); use CSP frame-ancestors instead, which supports a list.
      'Referrer-Policy': 'no-referrer-when-downgrade',
      'Permissions-Policy': 'interest-cohort=()',
      'Access-Control-Allow-Origin': '*',
      // Defense-in-depth CSP. Allows the CDNs we actually use (unpkg, gstatic, raw.github),
      // and lets the configurator be embedded as an iframe from the Shopify storefront,
      // Shopify admin preview and the myshopify.com staging domains.
      'Content-Security-Policy': ext === '.html'
        ? "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://raw.githubusercontent.com; connect-src 'self' https://unpkg.com https://www.gstatic.com https://raw.githubusercontent.com; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com https://zazawoods.de https://*.zazawoods.de https://zazawoods.com https://*.zazawoods.com; base-uri 'self'"
        : undefined,
    };
    // Drop undefined CSP for non-HTML
    if (headers['Content-Security-Policy'] === undefined) delete headers['Content-Security-Policy'];

    const stream = fs.createReadStream(target);
    stream.on('error', () => { try { res.writeHead(500); res.end('read err'); } catch(_){} });

    if (useGzip) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      stream.pipe(zlib.createGzip()).pipe(res);
    } else {
      headers['Content-Length'] = st.size;
      res.writeHead(200, headers);
      stream.pipe(res);
    }
  });
}).listen(port, () => {
  console.log(`Picnic configurator listening on :${port}`);
});
