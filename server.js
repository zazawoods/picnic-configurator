// Tiny static file server for Railway. Zero npm deps.
const http = require('http');
const fs   = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const root = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
};

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
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(data);
    });
  });
}).listen(port, () => {
  console.log(`Picnic configurator listening on :${port}`);
});
