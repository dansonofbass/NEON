import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

class Surface extends EventTarget {
  listeners = 0;
  addEventListener(...args) { super.addEventListener(...args); this.listeners++; }
  removeEventListener(...args) { super.removeEventListener(...args); this.listeners--; }
}
globalThis.window = new Surface(); globalThis.document = new Surface();
const compiled = ts.transpileModule(readFileSync(new URL('../game/touch.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { TouchControls } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
function setup() {
  const root = new Surface(), thumb = { style: { transform: '' } }, captures = new Set();
  const elements = Object.fromEntries(['move', 'look', 'fire', 'jump', 'grenade'].map(name => [name, {
    dataset: { control: name }, classList: new Set(), closest() { return this; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 140, height: 140 }; }
  }]));
  for (const el of Object.values(elements)) el.classList.remove = el.classList.delete;
  root.querySelector = () => thumb;
  root.contains = el => Object.values(elements).includes(el);
  root.setPointerCapture = id => captures.add(id);
  root.hasPointerCapture = id => captures.has(id);
  root.releasePointerCapture = id => { captures.delete(id); pointer('lostpointercapture', id, 'move'); };
  function pointer(type, id, control, x = 70, y = 70) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'target', { value: elements[control] });
    Object.assign(event, { pointerId: id, clientX: x, clientY: y, button: 0 }); root.dispatchEvent(event);
  }
  const state = { right: 0, forward: 0, sprint: false, firing: false, dx: 0, dy: 0, actions: [] };
  const target = {
    touchMove(right, forward, sprint) { Object.assign(state, { right, forward, sprint }); },
    touchLook(dx, dy) { state.dx += dx; state.dy += dy; },
    touchFire(held) { state.firing = held; },
    touchAction(action) { state.actions.push(action); },
    clearTouchInput() { Object.assign(state, { right: 0, forward: 0, sprint: false, firing: false }); }
  };
  return { root, thumb, captures, elements, pointer, state, controls: new TouchControls(root, target) };
}
test('independent fingers can move, aim, hold fire, jump and throw simultaneously', () => {
  const { controls, pointer, state, captures } = setup();
  pointer('pointerdown', 1, 'move', 70, 25); assert.ok(state.forward > .9); assert.equal(state.sprint, true);
  pointer('pointerdown', 2, 'look', 200, 100); pointer('pointermove', 2, 'look', 230, 110);
  pointer('pointerdown', 3, 'fire', 300, 200); assert.equal(state.firing, true);
  pointer('pointermove', 3, 'fire', 315, 195); assert.equal(state.dx, 45); assert.equal(state.dy, 5);
  pointer('pointerdown', 4, 'jump'); pointer('pointerdown', 5, 'grenade');
  assert.deepEqual(state.actions, ['jump', 'grenade']); assert.equal(captures.size, 5);
  pointer('pointerup', 2, 'look'); assert.equal(state.firing, true); assert.ok(state.forward > .9);
  pointer('pointerup', 1, 'move'); assert.equal(state.forward, 0); assert.equal(state.firing, true);
  pointer('pointercancel', 3, 'fire'); assert.equal(state.firing, false);
  controls.dispose(); assert.equal(captures.size, 0);
});
test('joystick dead zone, clamping, ownership, capture loss and resize reset', () => {
  const { controls, pointer, state, thumb, captures } = setup();
  pointer('pointerdown', 1, 'move', 72, 70); assert.equal(state.right, 0);
  pointer('pointermove', 1, 'move', 1000, 70); assert.equal(state.right, 1); assert.equal(state.sprint, false);
  pointer('pointerdown', 2, 'move', 0, 70); assert.equal(state.right, 1); assert.equal(captures.size, 1);
  pointer('pointerup', 2, 'move'); assert.equal(state.right, 1);
  pointer('lostpointercapture', 1, 'move'); assert.equal(state.right, 0); assert.equal(thumb.style.transform, '');
  pointer('pointerdown', 3, 'fire'); pointer('pointerdown', 4, 'move', 70, 0);
  window.dispatchEvent(new Event('resize')); assert.equal(state.firing, false); assert.equal(state.forward, 0); assert.equal(captures.size, 0);
  controls.dispose();
});
test('mount/unmount clears captures and listeners without stale fire input', () => {
  for (let i = 0; i < 20; i++) {
    const { root, pointer, state, controls, captures } = setup();
    pointer('pointerdown', 1, 'fire'); controls.dispose();
    assert.equal(root.listeners, 0); assert.equal(window.listeners, 0); assert.equal(document.listeners, 0);
    assert.equal(captures.size, 0); assert.equal(state.firing, false);
  }
});
