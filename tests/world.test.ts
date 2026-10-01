import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutFor, overlaps } from '../game/world.ts';

test('coordinates regenerate identically without stored history', () => {
  for (const [x, z] of [[0, 0], [-801, 190], [1000000, -1000000], [1, 2]]) {
    const before = JSON.stringify(layoutFor(x, z));
    for (let i = 0; i < 100; i++) layoutFor(i * 13, -i * 7);
    assert.equal(JSON.stringify(layoutFor(x, z)), before);
  }
});
test('all layouts preserve connected streets and safe spawn across 1681 chunks', () => {
  const templates = new Set();
  for (let cx = -20; cx <= 20; cx++) for (let cz = -20; cz <= 20; cz++) {
    const layout = layoutFor(cx, cz); templates.add(layout.name);
    assert.ok(layout.boxes.length <= 8);
    for (let p = 0; p <= 40; p += .5) for (const b of layout.boxes) {
      assert.equal(overlaps(20, p, .65, b), false);
      assert.equal(overlaps(p, 20, .65, b), false);
      assert.ok(b.x - b.w / 2 >= 0 && b.x + b.w / 2 <= 40);
      assert.ok(b.z - b.d / 2 >= 0 && b.z + b.d / 2 <= 40);
    }
  }
  assert.equal(templates.size, 5);
});
