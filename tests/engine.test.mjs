// Real engine + real Three.js scene/math; fake DOM, audio, RAF and renderer only.
// These validate simulation/lifecycle, not browser input or GPU behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

class Target extends EventTarget {
  listeners = 0;
  clientWidth = 1280;
  clientHeight = 720;
  addEventListener(...args) { super.addEventListener(...args); this.listeners++; }
  removeEventListener(...args) { super.removeEventListener(...args); this.listeners--; }
  appendChild(child) { this.child = child; }
  remove() {}
  requestPointerLock() { document.pointerLockElement = this; document.dispatchEvent(new Event('pointerlockchange')); return Promise.resolve(); }
}
globalThis.window = new Target(); globalThis.document = new Target();
document.hidden = false; document.pointerLockElement = null;
document.exitPointerLock = () => { document.pointerLockElement = null; document.dispatchEvent(new Event('pointerlockchange')); };
globalThis.devicePixelRatio = 1;
let rafCount = 0;
globalThis.requestAnimationFrame = () => { rafCount++; return rafCount; };
globalThis.cancelAnimationFrame = () => { rafCount--; };
globalThis.__TestTarget = Target;
const threeUrl = pathToFileURL(new URL('../node_modules/three/build/three.module.js', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')).href;
const rendererModule = `export * from ${JSON.stringify(threeUrl)};
export class WebGLRenderer {
  domElement = new globalThis.__TestTarget(); info = {render:{calls:0, triangles:0}, memory:{geometries:0,textures:0}};
  setClearColor(){} setPixelRatio(){} setSize(){} render(){} dispose(){this.disposed=true;}
}`;
const rendererUrl = 'data:text/javascript;base64,' + Buffer.from(rendererModule).toString('base64');
let source = readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8');
source = source.replace("from 'three'", `from '${rendererUrl}'`).replace("from './world'", `from '${new URL('../game/world.ts', import.meta.url).href}'`);
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { Engine } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const settings = { quality: 'standard', sound: false, recoil: true };
function create(intro = false) { const host = new Target(); const statuses = []; const engine = new Engine(host, settings, { hud() {}, status(s) { statuses.push(s); } }); if (!intro) { engine.introTime = 8; engine.updateCamera(); } return { engine, host, statuses }; }
function fill(engine) { while (engine.queue.length) { const next = engine.queue.shift(); engine.addChunk(next.cx, next.cz); } }
function enemyAt(engine, x, z) { const e = engine.enemies.find(e => !e.health); Object.assign(e, { x, z, health: 1, state: 'idle', sees: false }); e.mesh.visible = true; e.mesh.position.set(x, 0, z); return e; }

test('one bullet kills a robot; buildings block bullets and body movement', () => {
  const { engine: e } = create(); fill(e);
  const robot = enemyAt(e, 20, 10); e.shoot(); assert.equal(robot.health, 0); assert.equal(e.kills, 1);
  const b = e.chunks[0].boxes[0];
  e.player.set(b.x, 1.65, b.z + b.d / 2 + 2); e.yaw = 0; e.pitch = 0;
  const behind = enemyAt(e, b.x, b.z - b.d / 2 - 1); e.shoot(); assert.equal(behind.health, 1); assert.equal(e.kills, 1);
  assert.equal(e.blocked(b.x, b.z, .38), true);
  e.running = true; e.keys.add('KeyW');
  for (let i = 0; i < 90; i++) e.simulate(1 / 60);
  assert.ok(e.player.z >= b.z + b.d / 2 + .37);
  e.dispose();
});

test('grenade fuse, radius, wall obstruction, cap and recharge', () => {
  const { engine: e } = create(); fill(e);
  const robot = enemyAt(e, 20, 17);
  const g = e.grenades[0]; g.fuse = .001; g.mesh.position.set(20, .2, 20); g.velocity.set(0, 0, 0);
  e.updateGrenades(1 / 60); assert.equal(robot.health, 0); assert.equal(e.health, 200);
  const b = e.chunks[0].boxes[0];
  // Explosion on one side, target inside the radius but occluded by the building.
  const protectedRobot = enemyAt(e, b.x, b.z + b.d / 2 - 1);
  g.fuse = .001; g.mesh.position.set(b.x, .2, b.z + b.d / 2 + 1);
  e.updateGrenades(1 / 60); assert.equal(protectedRobot.health, 1);
  e.throwGrenade(); e.throwGrenade(); e.throwGrenade(); e.throwGrenade();
  assert.equal(e.ammo, 0); assert.equal(e.grenades.filter(g => g.fuse > 0).length, 3);
  e.running = true; for (let i = 0; i < 250; i++) e.simulate(1 / 60);
  assert.equal(e.ammo, 1); e.dispose();
});

test('200-health reset, grounded jumping, regeneration, damage telegraph, and death', () => {
  const { engine: e, statuses } = create(); fill(e); e.running = true;
  e.keys.add('Space'); e.simulate(1 / 60); assert.ok(e.player.y > 1.65); e.keys.clear();
  for (let i = 0; i < 90; i++) e.simulate(1 / 60);
  assert.equal(e.player.y, 1.65);
  for (const robot of e.enemies) e.despawn(robot);
  const attacker = enemyAt(e, 20, 15); attacker.state = 'chase'; attacker.timer = 0; attacker.sees = true;
  e.updateEnemy(attacker, .01); assert.equal(attacker.state, 'attack'); assert.equal(e.health, 200);
  e.updateEnemy(attacker, .5); assert.equal(e.health, 200);
  e.updateEnemy(attacker, .3); assert.equal(e.health, 190);
  e.damageAgo = 5; e.simulate(1 / 60); assert.ok(e.health > 190);
  e.health = 4; attacker.state = 'attack'; attacker.timer = .001; e.updateEnemy(attacker, .02);
  assert.equal(e.health, 0); assert.equal(e.running, false); assert.equal(statuses.at(-1), 'dead');
  e.reset(); assert.equal(e.health, 200); assert.equal(e.kills, 0); assert.equal(e.ammo, 3); e.dispose();
});

test('10 km of streaming keeps nine chunks, fixed pools and bounded scene objects', () => {
  const { engine: e } = create(); fill(e);
  let maxObjects = 0;
  const original = JSON.stringify(e.chunks.find(c => c.cx === 0 && c.cz === 0).boxes);
  for (let i = 0; i < 250; i++) {
    e.player.x = 40.01; e.updateStreaming();
    assert.ok(e.chunks.length <= 9); assert.ok(e.queue.length <= 5);
    fill(e); assert.equal(e.chunks.length, 9); assert.ok(e.player.x < 40);
    let objects = 0; e.scene.traverse(() => objects++); maxObjects = Math.max(maxObjects, objects);
  }
  assert.equal(e.originX, 250); assert.ok(maxObjects < 650);
  assert.equal(e.enemies.length, 41); assert.equal(e.effects.length, 32); assert.equal(e.grenades.length, 3);
  e.player.x = -10000 + 20; e.updateStreaming(); fill(e);
  assert.equal(e.originX, 0); assert.equal(JSON.stringify(e.chunks.find(c => c.cx === 0 && c.cz === 0).boxes), original);
  assert.equal(e.blocked(80, 20, .38), true, 'unloaded boundary is solid');
  console.log(`Streaming observation: 250 transitions / 10 km; max ${maxObjects} scene objects; 9 chunks; fixed 40 ordinary enemies + 1 boss, 32 effects, 3 grenades. GPU not measured.`);
  e.dispose();
});

test('pause/resume and twenty restarts do not add listeners or loops; dispose is idempotent', () => {
  const { engine: e, host, statuses } = create(); e.start(); e.resume();
  assert.equal(e.running, true); assert.equal(statuses.at(-1), 'playing');
  const listeners = document.listeners + window.listeners + host.listeners;
  const frames = rafCount;
  for (let i = 0; i < 20; i++) { e.reset(); e.resume(); assert.equal(e.running, true); }
  assert.equal(document.listeners + window.listeners + host.listeners, listeners); assert.equal(rafCount, frames);
  e.keys.add('KeyW'); document.exitPointerLock(); assert.equal(e.running, false); assert.equal(e.keys.size, 0); assert.equal(statuses.at(-1), 'paused');
  e.resume(); window.dispatchEvent(new Event('blur')); assert.equal(e.running, false);
  e.dispose(); e.dispose(); assert.equal(document.listeners + window.listeners + host.listeners, 0); assert.equal(rafCount, frames - 1); assert.equal(e.renderer.disposed, true);
});

test('low quality preserves difficulty and allocation stays inside effect pool', () => {
  const { engine: e } = create(); fill(e);
  for (let i = 0; i < 40; i++) enemyAt(e, 20, i * 2);
  e.configure({ ...settings, quality: 'low' }); assert.equal(e.enemies.filter(e => e.health).length, 40);
  for (let i = 0; i < 100; i++) e.effect(20, 1, 20, 1, false);
  assert.equal(e.effects.filter(e => e.life > 0).length, 16); e.dispose();
});

test('touch mode starts without pointer lock; analog movement, aim, fire and actions work', () => {
  const { engine: e, host, statuses } = create(); fill(e);
  host.requestPointerLock = () => { throw new Error('Pointer lock must never be requested on mobile'); };
  e.setTouchMode(true); e.start();
  assert.equal(e.running, true); assert.equal(statuses.at(-1), 'playing');
  const startZ = e.player.z;
  e.touchMove(0, .5, false); e.simulate(1 / 60);
  assert.ok(Math.abs(e.player.z - (startZ - .05)) < .0001, 'analog half-speed is preserved');
  e.touchMove(0, 1, true); const sprintZ = e.player.z; e.simulate(1 / 60);
  assert.ok(Math.abs(e.player.z - (sprintZ - 10 / 60)) < .0001);
  e.touchLook(50, -20); assert.ok(e.yaw < 0); assert.ok(e.pitch > 0);
  e.touchLook(0, -100000); assert.equal(e.pitch, 1.48);
  e.pitch = 0; e.yaw = 0; const robot = enemyAt(e, 20, 10);
  e.touchFire(true); assert.equal(robot.health, 0); assert.equal(e.firing, true);
  e.touchFire(false); assert.equal(e.firing, false);
  e.touchAction('jump'); e.simulate(1 / 60); assert.ok(e.player.y > 1.65);
  e.touchAction('grenade'); assert.equal(e.ammo, 2);
  e.pause(); assert.equal(e.touchForward, 0); assert.equal(e.touchSprint, false);
  e.touchMove(1, 1, true); e.touchFire(true); e.touchAction('grenade');
  assert.equal(e.touchRight, 0); assert.equal(e.firing, false); assert.equal(e.ammo, 2);
  e.resume(); assert.equal(e.running, true);
  e.touchMove(1, 0, false); e.touchFire(true); e.reset();
  assert.equal(e.touchRight, 0); assert.equal(e.firing, false); assert.equal(e.touchJumpQueued, false);
  e.dispose();
});

test('touch focus/visibility loss clears all held controls and pauses', () => {
  const { engine: e } = create(); e.setTouchMode(true); e.start();
  e.touchMove(1, 0, true); e.touchFire(true); e.touchAction('jump');
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(e.running, false); assert.equal(e.touchRight, 0); assert.equal(e.firing, false); assert.equal(e.touchJumpQueued, false);
  document.hidden = false; e.resume(); e.touchMove(0, 1, true);
  window.dispatchEvent(new Event('blur')); assert.equal(e.running, false); assert.equal(e.touchForward, 0);
  e.dispose();
});

test('three-minute targets, distance, pause and full schedule reset', () => {
  const { engine: e } = create(); fill(e);
  for (const [seconds, target] of [[0,20],[179.99,20],[180,24],[300,24],[360,29]]) {
    e.survival = seconds; assert.equal(e.populationTarget(), target);
  }
  e.configure({...settings, quality:'low'}); assert.equal(e.populationTarget(),29);
  e.survival=0; e.player.x=120; assert.equal(e.populationTarget(),24);
  e.updateStreaming(); fill(e); assert.equal(e.populationTarget(),24);
  e.pause(); const time = e.survival; e.simulate(1); assert.equal(e.survival,time);
  e.bossDue = e.bossPending = true; e.bossBreather = 4; e.reset();
  assert.equal(e.survival,0); assert.equal(e.nextBoss,180); assert.equal(e.bossDue,false);
  assert.equal(e.bossPending,false); assert.equal(e.bossBreather,0); e.dispose();
});

test('boss takes exactly 20 bullets, five equivalents per grenade, and deals 50 once', () => {
  const { engine:e } = create(); fill(e); e.running = true;
  const boss=e.enemies[40]; Object.assign(boss,{x:20,z:10,health:20,state:'chase'}); boss.mesh.visible=true;
  for(let i=0;i<19;i++) e.shoot(); assert.equal(boss.health,1); assert.equal(e.kills,0);
  e.shoot(); assert.equal(boss.health,0); assert.equal(e.kills,1);
  Object.assign(boss,{x:20,z:15,health:20,state:'attack',timer:0}); boss.mesh.visible=true;
  e.updateEnemy(boss,.01); assert.equal(e.health,150);
  e.updateEnemy(boss,.01); assert.equal(e.health,150);
  const g=e.grenades[0]; g.fuse=.001; g.mesh.position.set(20,.2,20); g.velocity.set(0,0,0);
  e.updateGrenades(.01); assert.equal(boss.health,15); e.updateGrenades(.01); assert.equal(boss.health,15);
  const b=e.chunks[0].boxes[0]; e.player.set(b.x,1.65,b.z+b.d/2+1);
  Object.assign(boss,{x:b.x,z:b.z-b.d/2-1,state:'attack',timer:0});
  e.updateEnemy(boss,.01); assert.equal(e.health,150,'wall blocks enemy hit'); e.dispose();
});

test('long-range center-camera aim, pitch, nearest obstruction and floating origin', () => {
  const {engine:e}=create(); fill(e);
  e.player.set(20,1.65,35); const robot=enemyAt(e,20,-35); e.shoot(); assert.equal(robot.health,0,'70 meter hit');
  const elevated=enemyAt(e,20,-30); e.player.y=5; e.pitch=-Math.atan2(5-1,65); e.shoot(); assert.equal(elevated.health,0,'downward camera ray');
  e.player.set(20,1.65,40.1); e.pitch=0; const shifted=enemyAt(e,20,20); e.updateStreaming(); fill(e); e.shoot(); assert.equal(shifted.health,0);
  e.dispose();
});

test('continuous replacements, bounded rate and population after repeated travel', () => {
  const {engine:e}=create(); fill(e); e.running=true;
  // Deterministic placement randomness, restored even on assertion failure.
  const random=Math.random; let seed=123; Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  try {
    e.survival=2400;
    for(let travel=0;travel<35;travel++) {
      if(travel) {e.player.x=60; e.updateStreaming(); fill(e);}
      e.rebuildNavigation();
      for(const robot of e.enemies) if(!robot.boss) e.despawn(robot);
      e.spawnClock=0; e.simulate(1/60); assert.ok(e.enemies.filter(r=>r.health&&!r.boss).length<=1);
      for(let i=0;i<45;i++) e.spawnEnemy();
      assert.ok(e.enemies.filter(r=>r.health&&!r.boss).length>=12,'placement retries recover pressure');
      assert.ok(e.enemies.filter(r=>r.health&&!r.boss).length<=e.populationTarget());
      for(const robot of e.enemies) if(!robot.boss&&robot.health) e.damageEnemy(robot,1);
    }
  } finally { Math.random=random; e.dispose(); }
});

test('boss milestones queue only one, breathe five seconds and preserve identity during travel', () => {
  const {engine:e}=create(); fill(e); e.running=true; e.rebuildNavigation();
  e.survival=179.99; e.simulate(.02); assert.equal(e.nextBoss,360);
  for(let i=0;i<100 && !e.enemies[40].health;i++) e.updateBoss();
  const boss=e.enemies[40]; assert.equal(boss.health,20); assert.ok(Math.hypot(boss.x-e.player.x,boss.z-e.player.z)<=45);
  for(const time of [360,540,720]) {e.survival=time;e.simulate(.01);assert.equal(e.bossPending,true);}
  e.damageEnemy(boss,7); e.player.x=420; e.updateStreaming(); fill(e); e.rebuildNavigation();
  for(let i=0;i<100;i++) e.updateBoss();
  assert.equal(e.enemies[40],boss); assert.equal(boss.health,13); assert.equal(boss.mesh.visible,true);
  assert.ok(Math.hypot(boss.x-e.player.x,boss.z-e.player.z)<=45);
  e.damageEnemy(boss,13); assert.equal(e.bossBreather,5); e.updateBoss(); assert.equal(boss.health,0);
  e.simulate(4.9); e.updateBoss(); assert.equal(boss.health,0);
  e.simulate(.11); for(let i=0;i<100&&!boss.health;i++)e.updateBoss(); assert.equal(boss.health,20);
  assert.equal(e.bossPending,false); e.dispose();
});

test('failed placements retry, unloaded bosses stay reserved, regeneration waits five seconds', () => {
  const {engine:e}=create(); fill(e); e.running=true;
  e.health=100; e.damageAgo=4; e.simulate(.1); assert.equal(e.health,100);
  e.damageAgo=5; e.simulate(.1); assert.equal(e.health,100.8);
  for(const robot of e.enemies) e.despawn(robot);
  e.rebuildNavigation(); e.bossDue=true;
  e.nav.fill(-2); e.updateBoss(); assert.equal(e.bossDue,true); assert.equal(e.enemies[40].health,0);
  e.spawnEnemy(); assert.equal(e.enemies.filter(r=>r.health).length,0);
  e.rebuildNavigation(); for(let i=0;i<100&&!e.enemies[40].health;i++)e.updateBoss();
  const boss=e.enemies[40]; assert.equal(boss.health,20);
  boss.x=500; e.nav.fill(-2); e.updateBoss(); assert.equal(boss.health,20); assert.equal(boss.mesh.visible,false);
  assert.equal(e.bossDue,false); e.rebuildNavigation();
  for(let i=0;i<100&&!boss.mesh.visible;i++)e.updateBoss();
  assert.equal(boss.mesh.visible,true); assert.equal(boss.health,20); e.dispose();
});

test('cinematic waits for streaming, lasts eight active seconds and hands off without survival advance', () => {
  const {engine:e,statuses}=create(true); e.setTouchMode(true); e.start();
  assert.equal(statuses.at(-1),'loading');
  e.advanceIntro(20); assert.equal(e.introTime,0); assert.equal(e.introStarted,false);
  fill(e); e.advanceIntro(0); assert.equal(statuses.at(-1),'intro');
  const before=e.player.clone(); e.clockScale=60;
  e.touchMove(1,1,true); e.touchLook(100,100); e.touchFire(true); e.touchAction('grenade'); e.touchAction('jump');
  e.simulate(1); assert.equal(e.survival,0); assert.equal(e.ammo,3); assert.equal(e.firing,false);
  assert.equal(e.yaw,0); assert.equal(e.pitch,0); assert.ok(e.player.equals(before));
  e.advanceIntro(7.999); assert.equal(statuses.at(-1),'intro'); assert.equal(e.survival,0);
  e.advanceIntro(.001); assert.equal(e.introTime,8); assert.equal(statuses.at(-1),'playing');
  assert.equal(e.gun.visible,true); assert.equal(e.camera.fov,78); assert.ok(e.camera.position.equals(e.player));
  assert.equal(e.survival,0); e.simulate(1/60); assert.ok(e.survival>0);
  assert.equal(e.chunks.length,9); e.dispose();
});

test('cinematic pauses on focus loss, resumes remaining time and restarts cleanly', () => {
  const {engine:e,statuses}=create(true); fill(e); e.setTouchMode(true); e.start(); e.advanceIntro(0); e.advanceIntro(3);
  window.dispatchEvent(new Event('blur')); e.advanceIntro(50); assert.equal(e.introTime,3); assert.equal(statuses.at(-1),'paused');
  e.resume(); assert.equal(statuses.at(-1),'intro');
  document.hidden=true; e.advanceIntro(50); assert.equal(e.introTime,3); document.hidden=false;
  e.advanceIntro(5); assert.equal(statuses.at(-1),'playing');
  e.reset(); assert.equal(e.introTime,0); assert.equal(e.introStarted,false); assert.equal(e.gun.visible,false);
  e.dispose();
});

test('aerial path stays above buildings, descends in a clear street and joins player view smoothly', () => {
  const {engine:e}=create(true); fill(e);
  for(let i=0;i<800;i++) {
    e.introTime=i/100; e.updateCamera();
    const p=e.camera.position;
    assert.equal(e.gun.visible,false); assert.ok(p.y>=1.65);
    for(const c of e.chunks) for(const b of c.boxes) {
      if(Math.abs(p.x-c.group.position.x-b.x)<b.w/2+.3 && Math.abs(p.z-c.group.position.z-b.z)<b.d/2+.3) assert.ok(p.y>b.h+.3,'camera clears roofs');
    }
  }
  e.introTime=7.9999; e.updateCamera(); assert.ok(e.camera.position.distanceTo(e.player)<.001);
  e.camera.getWorldDirection(e.direction); assert.ok(e.direction.distanceTo({x:0,y:0,z:-1})<.001);
  e.dispose();
});

 test('finite bullets, empty fire, kill rewards, HUD and restart', () => {
  const {engine:e}=create(); fill(e);
  assert.equal(e.bullets,200); e.shoot(); assert.equal(e.bullets,199);
  e.bullets=1; e.shoot(); assert.equal(e.bullets,0);
  const robot=enemyAt(e,20,10); e.flash=0; e.shoot();
  assert.equal(robot.health,1); assert.equal(e.flash,0); assert.equal(e.bullets,0);
  e.damageEnemy(robot,1); assert.equal(e.bullets,20);
  e.damageEnemy(robot,1); assert.equal(e.bullets,20);
  e.bullets=200; e.damageEnemy(enemyAt(e,20,10),1); assert.equal(e.bullets,220);
  let hud; e.callbacks.hud=value=>{hud=value;}; e.syncHud(); assert.equal(hud.bullets,220);
  e.reset(); assert.equal(e.bullets,200); e.dispose();
});
 test('enemy pool grows past forty ordinary robots without replacing boss', () => {
  const {engine:e}=create(); fill(e); const boss=e.enemies[40];
  for(const robot of e.enemies) if(!robot.boss) robot.health=1;
  e.survival=900; e.placeEnemy=robot=>{robot.health=1;return true;}; e.spawnEnemy();
  assert.equal(e.enemies.length,42); assert.equal(e.enemies[40],boss);
  assert.equal(e.enemies[41].boss,false); e.dispose();
});
