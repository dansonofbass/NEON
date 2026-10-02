import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createStaticServer } from '../scripts/serve.mjs';

test('static preview streams byte ranges, suffixes and HEAD for large media', async () => {
  const root = await mkdtemp(join(tmpdir(), 'neon-audio-'));
  const bytes = Buffer.alloc(1024 * 1024, 37);
  await writeFile(join(root, 'track.mp3'), bytes);
  const server = createStaticServer(root);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/track.mp3`;
  try {
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), String(bytes.length));
    assert.equal(head.headers.get('accept-ranges'), 'bytes');
    assert.equal(head.headers.get('content-type'), 'audio/mpeg');
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    for (const [range, start, end] of [['bytes=0-1023', 0, 1023], ['bytes=-128', bytes.length - 128, bytes.length - 1], [`bytes=${bytes.length-64}-`, bytes.length-64, bytes.length-1]]) {
      const response = await fetch(url, { headers: { Range: range } });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
    }
    const invalid = await fetch(url, { headers: { Range: 'bytes=9999999-' } });
    assert.equal(invalid.status, 416);
    const full = await fetch(url); assert.equal(full.status, 200);
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true });
  }
});
