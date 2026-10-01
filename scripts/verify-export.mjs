import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:3001';
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(path)); else result.push(path);
  }
  return result;
}
let count = 0;
for (const path of await files('out')) {
  const route = relative('out', path).replaceAll('\\', '/');
  const response = await fetch(`${base}/${route}`);
  assert.equal(response.status, 200, route);
  assert.ok((await response.arrayBuffer()).byteLength > 0, route);
  if (route.endsWith('.js')) assert.match(response.headers.get('content-type'), /javascript/);
  count++;
}
const home = await fetch(base);
assert.equal(home.status, 200);
const html = await home.text();
assert.match(html, /ENTER THE GRID/);
assert.match(html, /favicon\.svg/);
assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:\/\//);
console.log(`Static HTTP check passed: root HTML + ${count} exported files return 200; JS MIME types correct; no external script/style links. This is not a browser/hydration test.`);
