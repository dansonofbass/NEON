import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const mime = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

export function createStaticServer(directory = 'out') {
  const root = resolve(directory);
  return http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let path = resolve(root, '.' + pathname);
      if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      let info;
      try {
        info = await stat(path);
        if (info.isDirectory()) { path = resolve(path, 'index.html'); info = await stat(path); }
      } catch { if (!extname(path)) path += '.html'; info = await stat(path); }
      if (!info.isFile()) { res.writeHead(404).end(); return; }
      const headers = { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
      let start = 0, end = info.size - 1, status = 200;
      // Native audio can request only the bytes needed for buffering or seeking.
      // Ignore If-Range requests and return the full current representation.
      if (req.headers.range && !req.headers['if-range'] && req.method === 'GET') {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (match && (match[1] || match[2])) {
          start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
          end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
            res.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }).end(); return;
          }
          status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
        }
      }
      headers['Content-Length'] = Math.max(0, end - start + 1);
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || info.size === 0) { res.end(); return; }
      const stream = createReadStream(path, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found. Run npm run build first.'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createStaticServer().listen(port, '127.0.0.1', () => console.log(`NEON DRIFT static preview: http://127.0.0.1:${port}`));
}
