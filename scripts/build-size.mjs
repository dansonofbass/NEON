import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path)); else files.push(path);
  }
  return files;
}
const rows = [];
for (const path of await walk('out')) {
  const buffer = await readFile(path);
  rows.push({ path: relative('out', path), raw: buffer.length, gzip: gzipSync(buffer, { level: 9 }).length, brotli: brotliCompressSync(buffer).length });
}
const sum = group => group.reduce((s, r) => ({ raw: s.raw + r.raw, gzip: s.gzip + r.gzip, brotli: s.brotli + r.brotli }), { raw: 0, gzip: 0, brotli: 0 });
const html = await readFile('out/index.html', 'utf8');
const initial = rows.filter(r => r.path === 'index.html' || html.includes(r.path.replaceAll('\\', '/')));
console.log(JSON.stringify({ unit: 'bytes; individually compressed files, gzip level 9', initialHtmlAndReferencedAssets: sum(initial), allJavaScript: sum(rows.filter(r => extname(r.path) === '.js')), entireExport: sum(rows), largestJS: rows.filter(r => extname(r.path) === '.js').sort((a, b) => b.raw - a.raw).slice(0, 8) }, null, 2));
