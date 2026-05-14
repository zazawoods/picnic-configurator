// Tiny static file server for Railway. Zero npm deps. With gzip + cache.
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

function safeJoin(rel) {
  const decoded = decodeURIComponent(rel.split('?')[0]);
  const target  = path.normalize(path.join(root, decoded));
  if (!target.startsWith(root)) return null;
  return target;
}

http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  let target  = safeJoin(urlPath);
  if (!target) { res.writeHead(400); res.end('bad path'); return; }

  fs.stat(target, (err, st) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    if (st.isDirectory()) target = path.join(target, 'index.html');
    fs.readFile(target, (err2, data) => {
      if (err2) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(target).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      const headers = {
        'Content-Type': mime,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      };
      const acceptEnc = (req.headers['accept-encoding'] || '').toLowerCase();
      if (COMPRESSIBLE.has(ext) && acceptEnc.includes('gzip')) {
        zlib.gzip(data, (gerr, gz) => {
          if (gerr) { res.writeHead(200, headers); res.end(data); return; }
          headers['Content-Encoding'] = 'gzip';
          res.writeHead(200, headers);
          res.end(gz);
        });
      } else {
        res.writeHead(200, headers);
        res.end(data);
      }
    });
  });
}).listen(port, () => {
  console.log(`Picnic configurator listening on :${port}`);
});
