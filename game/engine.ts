import * as THREE from 'three';
import { CHUNK, layoutFor, overlaps, type Box } from './world';
import type { Callbacks, Settings } from './types';

type Chunk = { cx: number; cz: number; group: THREE.Group; boxes: Box[]; name: string };
type Enemy = { mesh: THREE.Group; eye: THREE.Mesh; x: number; z: number; health: number; boss: boolean; state: 'idle' | 'detect' | 'chase' | 'attack' | 'dead'; timer: number; check: number; sees: boolean; angle: number };
type Effect = { mesh: THREE.Mesh; life: number; max: number; size: number; explosion: boolean };
type Grenade = { mesh: THREE.Mesh; velocity: THREE.Vector3; fuse: number };
const INTRO_SECONDS = 8;
const STEP = 1 / 60, RADIUS = .38, EYE = 1.65;
const COLORS = [0x38e8eb, 0xf454b8, 0xffbf60];

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(78, 1, .08, 180);
  private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
  private materials: THREE.Material[] = [];
  private building = this.material(0x101c30);
  private trim = this.material(0x23364b);
  private ground = this.material(0x091420);
  private pavement = this.material(0x152335);
  private neon = COLORS.map(c => this.material(c, true));
  private enemyMaterial = this.material(0x566580);
  private dark = this.material(0x0c1424);
  private chunks: Chunk[] = [];
  private queue: { cx: number; cz: number }[] = [];
  private originX = 0;
  private originZ = 0;
  private player = new THREE.Vector3(20, EYE, 20);
  private yaw = 0;
  private pitch = 0;
  private vertical = 0;
  private grounded = true;
  private keys = new Set<string>();
  private firing = false;
  private touchMode = false;
  private touchRight = 0;
  private touchForward = 0;
  private touchSprint = false;
  private touchJumpQueued = false;
  private shootCooldown = 0;
  private health = 200;
  private kills = 0;
  private damageAgo = 10;
  private hitTime = 0;
  private hurtTime = 0;
  private ammo = 3;
  private bullets = 200;
  private recharge = 0;
  private grenadeLatch = false;
  private enemies: Enemy[] = [];
  private effects: Effect[] = [];
  private grenades: Grenade[] = [];
  private gun = new THREE.Group();
  private muzzle: THREE.Mesh;
  private recoil = 0;
  private flash = 0;
  private running = false;
  private disposed = false;
  private failed = false;
  private raf = 0;
  private loopStarted = false;
  private preview = false;
  private previewTime = 0;
  private readonly reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private aerialOffset = new THREE.Vector3();
  private lastTime = 0;
  private accumulator = 0;
  private hudClock = 0;
  private spawnClock = 0;
  private navClock = 0;
  private elapsed = 0;
  private introTime = 0;
  private introStarted = false;
  private survival = 0;
  private nextBoss = 180;
  private bossDue = false;
  private bossPending = false;
  private bossBreather = 0;
  private bossAlert = 0;
  private bossAlertMessage = 'BOSS INCOMING';
  private clockScale = 1;
  private readonly visibility = 156;
  private frameMs = 16.67;
  private slowTime = 0;
  private adaptive = false;
  private diagnostics = false;
  private audio: AudioContext | null = null;
  private audioVoices = new Set<OscillatorNode>();
  private cleanup: (() => void)[] = [];
  private ray = new THREE.Ray();
  private rayBox = new THREE.Box3();
  private direction = new THREE.Vector3();
  private scratch = new THREE.Vector3();
  private intersection = new THREE.Vector3();
  private matrix = new THREE.Matrix4();
  private quaternion = new THREE.Quaternion();
  private scale = new THREE.Vector3();
  private nav = new Int16Array(900);
  private navQueue = new Int16Array(900);
  private navX = 0;
  private navZ = 0;
  private settings: Settings;

  constructor(private host: HTMLDivElement, settings: Settings, private callbacks: Callbacks) {
    this.settings = { ...settings };
    try { this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' }); }
    catch { this.boxGeometry.dispose(); this.sphereGeometry.dispose(); this.materials.forEach(m => m.dispose()); throw new Error('WebGL is unavailable. Enable hardware acceleration or try a recent desktop Chrome, Edge, or Firefox.'); }
    this.renderer.setClearColor(0x070e1b);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.fog = new THREE.Fog(0x070e1b, 35, this.visibility);
    this.scene.add(new THREE.HemisphereLight(0xaccafa, 0x24364c, 2.1));
    const light = new THREE.DirectionalLight(0x96bafa, 1.5); light.position.set(-10, 30, 8); this.scene.add(light);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.buildWeapon();
    this.muzzle = new THREE.Mesh(this.boxGeometry, this.neon[2]);
    this.muzzle.scale.set(.09, .09, .18); this.muzzle.position.set(.25, -.24, -.88); this.muzzle.visible = false; this.camera.add(this.muzzle);
    for (let i = 0; i < 41; i++) this.enemies.push(this.buildEnemy(i));
    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(this.sphereGeometry, this.neon[i % 3]); mesh.visible = false; this.scene.add(mesh);
      this.effects.push({ mesh, life: 0, max: 1, size: 1, explosion: false });
    }
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(this.sphereGeometry, this.neon[2]); mesh.scale.setScalar(.14); mesh.visible = false; this.scene.add(mesh);
      this.grenades.push({ mesh, velocity: new THREE.Vector3(), fuse: 0 });
    }
    this.host.appendChild(this.renderer.domElement);
    this.listen(document, 'pointerlockchange', () => {
      if (this.touchMode || this.preview) return;
      if (document.pointerLockElement === this.host && !this.failed && this.health > 0) { this.activate(); }
      else { this.pause(); }
    });
    this.listen(document, 'pointerlockerror', () => { if (!this.preview && !this.running && !this.touchMode) this.callbacks.status('ready', 'Mouse capture was blocked. Click Enter again, or allow pointer lock in your browser.'); });
    this.listen(document, 'mousemove', ((event: MouseEvent) => {
      if (!this.running || this.touchMode || this.introTime < INTRO_SECONDS) return;
      this.yaw -= event.movementX * .0021;
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * .0021, -1.48, 1.48);
    }) as EventListener);
    this.listen(document, 'keydown', ((event: KeyboardEvent) => {
      if (event.code === 'F3' && process.env.NODE_ENV === 'development') { event.preventDefault(); this.diagnostics = !this.diagnostics; }
      if (!this.running) return;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyG', 'Escape'].includes(event.code)) event.preventDefault();
      if (event.code === 'Escape') { this.pause(); return; }
      if (this.introTime < INTRO_SECONDS) return;
      this.keys.add(event.code);
    }) as EventListener);
    this.listen(document, 'keyup', ((event: KeyboardEvent) => { this.keys.delete(event.code); }) as EventListener);
    this.listen(this.host, 'mousedown', ((event: MouseEvent) => { if (event.button === 0 && this.running && !this.touchMode && this.introTime >= INTRO_SECONDS) this.firing = true; }) as EventListener);
    this.listen(document, 'mouseup', () => { if (!this.touchMode) this.firing = false; });
    this.listen(this.host, 'contextmenu', event => event.preventDefault());
    this.listen(window, 'blur', () => { this.pause(); if (document.pointerLockElement === this.host) document.exitPointerLock(); });
    this.listen(document, 'visibilitychange', () => { if (document.hidden) { this.pause(); if (document.pointerLockElement === this.host) document.exitPointerLock(); } });
    this.listen(window, 'resize', () => this.resize());
    this.listen(this.renderer.domElement, 'webglcontextlost', event => {
      event.preventDefault(); this.failed = true; this.running = false; this.keys.clear(); document.exitPointerLock?.();
      this.callbacks.status('error', 'The graphics context was lost. Reload to create a fresh renderer. Low quality may help on this device.');
    });
    if (process.env.NODE_ENV === 'development' && typeof location !== 'undefined') {
      this.clockScale = Math.min(60, Math.max(1, Number(new URLSearchParams(location.search).get('survivalSpeed')) || 1));
    }
    this.configure(settings);
    this.reset();
  }

  private material(color: number, basic = false) {
    const m = basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color, flatShading: true });
    this.materials.push(m); return m;
  }
  private listen(target: EventTarget, name: string, handler: EventListener) { target.addEventListener(name, handler); this.cleanup.push(() => target.removeEventListener(name, handler)); }
  private mesh(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = new THREE.Mesh(this.boxGeometry, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh); return mesh;
  }
  private buildWeapon() {
    this.mesh(this.gun, this.dark, .26, -.26, -.51, .17, .16, .53);
    this.mesh(this.gun, this.trim, .26, -.19, -.55, .19, .06, .36);
    this.mesh(this.gun, this.neon[0], .16, -.25, -.53, .014, .024, .34);
    this.mesh(this.gun, this.neon[0], .26, -.143, -.64, .025, .018, .06);
    this.mesh(this.gun, this.dark, .26, -.36, -.35, .13, .24, .12);
    this.mesh(this.gun, this.trim, .26, -.245, -.81, .11, .1, .18);
    // Forearm and glove, built from the same shared cube.
    this.mesh(this.gun, this.dark, .29, -.43, -.15, .17, .18, .42);
    this.mesh(this.gun, this.trim, .26, -.32, -.32, .18, .14, .16);
    this.camera.add(this.gun);
  }
  private buildEnemy(i: number): Enemy {
    const group = new THREE.Group();
    this.mesh(group, this.enemyMaterial, 0, 1.05, 0, .63, .66, .39);
    this.mesh(group, this.dark, 0, 1.55, 0, .5, .34, .4);
    const eye = this.mesh(group, this.neon[i % 2], 0, 1.58, -.211, .37, .055, .025);
    this.mesh(group, this.neon[0], 0, 1.08, -.21, .1, .17, .02);
    this.mesh(group, this.trim, -.22, .36, 0, .19, .64, .23);
    this.mesh(group, this.trim, .22, .36, 0, .19, .64, .23);
    this.mesh(group, this.dark, -.43, .98, 0, .18, .51, .22);
    this.mesh(group, this.dark, .43, .98, 0, .18, .51, .22);
    if (i === 40) {
      this.mesh(group, this.neon[2], 0, 1.85, 0, .75, .16, .5);
      this.mesh(group, this.neon[2], -.48, 1.25, 0, .18, .25, .5);
      this.mesh(group, this.neon[2], .48, 1.25, 0, .18, .25, .5);
    }
    group.visible = false; this.scene.add(group);
    return { mesh: group, eye, x: 0, z: 0, health: 0, boss: i === 40, state: 'dead', timer: 0, check: i * .045, sees: false, angle: i * 2.4 };
  }

  // Preview and gameplay share one canvas, bounded chunk set and RAF owner.
  showMenu() {
    if (this.disposed || this.failed) return;
    this.preview = true;
    this.reset();
    this.updateMenuPatrols();
    if (document.pointerLockElement === this.host) document.exitPointerLock?.();
    this.updateCamera();
    this.ensureLoop();
  }
  beginRun() {
    if (!this.preview || this.disposed || this.failed) return;
    this.aerialOffset.copy(this.camera.position).sub(this.scratch.set(42, 58, 50));
    this.preview = false;
    this.resume();
  }
  // Reuse ordinary robot meshes for quiet street patrols. Combat stays frozen
  // until the prologue ends; these same robots then join normal enemy AI.
  private updateMenuPatrols() {
    for (let i = 0; i < 16; i++) {
      const robot = this.enemies[i];
      const lane = Math.floor(i / 4), phase = this.previewTime * .13 + i * 1.7;
      const along = -30 + Math.sin(phase) * 18;
      const cross = lane % 2 === 0 ? 20 : 60;
      const x = lane < 2 ? cross : along;
      const z = lane < 2 ? along : cross;
      const visible = this.loaded(x, z);
      robot.mesh.visible = visible;
      robot.health = visible ? 1 : 0;
      robot.x = x; robot.z = z;
      robot.state = 'idle'; robot.sees = false; robot.timer = 1.5;
      robot.eye.material = this.neon[1];
      robot.mesh.position.set(x, 0, z);
      const forward = Math.cos(phase) >= 0;
      robot.mesh.rotation.y = lane < 2 ? (forward ? Math.PI : 0) : (forward ? -Math.PI / 2 : Math.PI / 2);
    }
  }
  private ensureLoop() {
    if (this.loopStarted) return;
    this.loopStarted = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }
  start() {
    if (this.disposed) return;
    if (this.touchMode || document.pointerLockElement === this.host) { this.activate(); }
    else this.callbacks.status('ready');
    this.ensureLoop();
  }
  resume() {
    if (this.disposed || this.failed || this.health <= 0) return;
    this.initAudio();
    if (this.touchMode) { this.activate(); return; }
    try {
      void Promise.resolve(this.host.requestPointerLock()).catch(() => this.callbacks.status('ready', 'Click Enter to capture your mouse. If capture stays blocked, check browser permissions.'));
    } catch { this.callbacks.status('ready', 'This browser did not allow mouse capture. Try a current desktop browser.'); }
  }
  private activate() {
    this.running = true; this.lastTime = performance.now(); this.accumulator = 0;
    if (this.introTime >= INTRO_SECONDS) this.callbacks.status('playing');
    else if (this.introStarted) this.callbacks.status('intro');
    else this.callbacks.status('loading', 'Preparing the city flyover...');
  }
  private advanceIntro(dt: number) {
    if (!this.running || document.hidden || this.introTime >= INTRO_SECONDS) return;
    // Start the eight-second shot only after all nearby chunks are ready.
    if (!this.introStarted) {
      if (this.queue.length || this.chunks.length < 25) return;
      this.introStarted = true; this.callbacks.status('intro'); this.syncHud(); return;
    }
    this.introTime = Math.min(INTRO_SECONDS, this.introTime + dt);
    if (this.introTime >= INTRO_SECONDS) {
      this.keys.clear(); this.clearTouchInput(); this.accumulator = 0;
      this.updateCamera(); this.syncHud(); this.callbacks.status('playing');
    }
  }
  pause() {
    if (this.preview || this.disposed) return;
    this.running = false; this.clearTouchInput(); this.keys.clear(); this.accumulator = 0;
    if (document.pointerLockElement === this.host) document.exitPointerLock?.();
    if (!this.failed && this.health > 0) this.callbacks.status('paused');
  }
  setTouchMode(enabled: boolean) {
    this.touchMode = enabled; this.clearTouchInput(); this.resize();
    if (enabled && document.pointerLockElement === this.host) document.exitPointerLock?.();
  }
  clearTouchInput() {
    this.touchRight = 0; this.touchForward = 0; this.touchSprint = false; this.touchJumpQueued = false; this.firing = false;
  }
  touchMove(right: number, forward: number, sprint: boolean) {
    if (!this.running || !this.touchMode || this.introTime < INTRO_SECONDS) return;
    const length = Math.max(1, Math.hypot(right, forward));
    this.touchRight = right / length; this.touchForward = forward / length; this.touchSprint = sprint;
  }
  touchLook(dx: number, dy: number) {
    if (!this.running || !this.touchMode || this.introTime < INTRO_SECONDS) return;
    const sensitivity = THREE.MathUtils.clamp(2.4 / Math.max(1, Math.min(this.host.clientWidth, this.host.clientHeight)), .002, .008);
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -1.48, 1.48);
  }
  touchFire(held: boolean) {
    if (!this.running || !this.touchMode || this.introTime < INTRO_SECONDS) return;
    this.firing = held;
    if (held) { this.initAudio(); if (this.shootCooldown <= 0) this.shoot(); }
  }
  touchAction(action: 'jump' | 'grenade') {
    if (!this.running || !this.touchMode || this.introTime < INTRO_SECONDS) return;
    this.initAudio();
    if (action === 'jump') this.touchJumpQueued = true; else this.throwGrenade();
  }
  configure(settings: Settings) {
    const qualityChanged = this.settings.quality !== settings.quality;
    this.settings = { ...settings };
    if (qualityChanged) { this.adaptive = false; this.slowTime = 0; }
    this.resize();
    if (!settings.sound) void this.audio?.suspend().catch(() => {});
    else if (this.audio) void this.audio.resume().catch(() => {});
  }
  private resize() {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.settings.quality === 'low' ? .8 : this.adaptive ? .85 : this.touchMode ? 1 : 1.25));
    this.renderer.setSize(this.host.clientWidth, this.host.clientHeight);
    this.camera.aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight); this.camera.updateProjectionMatrix();
  }
  reset() {
    this.introTime = 0; this.introStarted = false; this.aerialOffset.set(0, 0, 0);
    this.clearTouchInput();
    this.running = false; this.keys.clear(); this.firing = false; this.health = 200; this.kills = 0; this.bullets = 200; this.ammo = 3; this.recharge = 0;
    this.damageAgo = 10; this.hurtTime = 0; this.hitTime = 0; this.shootCooldown = 0; this.grenadeLatch = false;
    this.flash = 0; this.recoil = 0;
    this.survival = 0; this.nextBoss = 180; this.bossDue = false; this.bossPending = false;
    this.bossBreather = 0; this.bossAlert = 0; this.bossAlertMessage = 'BOSS INCOMING'; this.hudClock = 0;
    this.vertical = 0; this.grounded = true; this.yaw = 0; this.pitch = 0; this.elapsed = 0; this.accumulator = 0;
    this.originX = 0; this.originZ = 0; this.player.set(20, EYE, 20);
    // Keep the already-warmed origin city when returning to the menu.
    for (const c of [...this.chunks]) {
      if (c.cx < -2 || c.cx > 2 || c.cz < -2 || c.cz > 2) { this.removeChunk(c); this.chunks.splice(this.chunks.indexOf(c), 1); }
      else c.group.position.set(c.cx * CHUNK, 0, c.cz * CHUNK);
    }
    this.queue.length = 0;
    for (const e of this.enemies) this.despawn(e);
    for (const e of this.effects) { e.life = 0; e.mesh.visible = false; }
    for (const g of this.grenades) { g.fuse = 0; g.mesh.visible = false; }
    if (!this.chunks.some(c => c.cx === 0 && c.cz === 0)) this.addChunk(0, 0); this.updateStreaming(); this.navClock = 0; this.spawnClock = 0;
    this.updateCamera(); this.syncHud();
  }

  private addChunk(cx: number, cz: number) {
    const layout = layoutFor(cx, cz), group = new THREE.Group();
    group.position.set((cx - this.originX) * CHUNK, 0, (cz - this.originZ) * CHUNK);
    const chunk: Chunk = { cx, cz, group, boxes: layout.boxes, name: layout.name };
    this.mesh(group, this.ground, 20, -.13, 20, 40, .25, 40);
    // Batch all repeated geometry by material, with a single shared cube.
    const batches = new Map<THREE.Material, number[][]>();
    const add = (mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
      let batch = batches.get(mat); if (!batch) { batch = []; batches.set(mat, batch); } batch.push([x, y, z, w, h, d]);
    };
    for (const b of layout.boxes) {
      add(this.pavement, b.x, .02, b.z, b.w + .7, .1, b.d + .7);
      add(this.building, b.x, b.h / 2, b.z, b.w, b.h, b.d);
      add(this.trim, b.x, b.h, b.z, b.w + .12, .18, b.d + .12);
      const signZ = b.z + (b.z < 20 ? 1 : -1) * (b.d / 2 + .04);
      add(this.dark, b.x, 3.7, signZ, b.w * .67, 1.2, .15);
      add(this.neon[b.accent], b.x, 3.7, signZ + (b.z < 20 ? .09 : -.09), b.w * .58, .11, .02);
      // Sign glyphs and sparse windows are geometry, no downloaded textures.
      for (let j = 0; j < 4; j++) add(this.neon[b.accent], b.x - 1.8 + j * 1.15, 4, signZ + (b.z < 20 ? .1 : -.1), .12, .35 + j % 2 * .2, .03);
      for (let floor = 6; floor < b.h - 1; floor += 3.8) {
        for (let j = -1; j <= 1; j++) add(floor % 3 < 1 ? this.neon[b.accent] : this.trim, b.x + j * b.w * .27, floor, signZ, .7, .32, .06);
      }
      add(this.neon[b.accent], b.x + b.w / 2 + .02, b.h * .42, b.z, .045, b.h * .55, .16);
      add(this.trim, b.x, b.h + .5, b.z, b.w * .4, 1, b.d * .35);
    }
    for (let j = 0; j < 5; j++) {
      add(this.trim, 20, .015, j * 8 + 2, .12, .02, 2.5);
      add(this.trim, j * 8 + 2, .015, 20, 2.5, .02, .12);
    }
    // Low cyan curb markers keep the connected street grid readable.
    for (const n of [3, 37]) { add(this.neon[0], 16, .03, n, .07, .03, 2); add(this.neon[1], 24, .03, n, .07, .03, 2); }
    for (const [mat, batch] of batches) {
      const mesh = new THREE.InstancedMesh(this.boxGeometry, mat, batch.length);
      for (let i = 0; i < batch.length; i++) { const p = batch[i]; this.scratch.set(p[0], p[1], p[2]); this.scale.set(p[3], p[4], p[5]); this.matrix.compose(this.scratch, this.quaternion, this.scale); mesh.setMatrixAt(i, this.matrix); }
      mesh.computeBoundingSphere(); group.add(mesh);
    }
    this.chunks.push(chunk); this.scene.add(group);
  }
  private removeChunk(chunk: Chunk) {
    this.scene.remove(chunk.group);
    chunk.group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    chunk.group.clear();
  }
  private updateStreaming() {
    const cx = Math.floor(this.player.x / CHUNK) + this.originX, cz = Math.floor(this.player.z / CHUNK) + this.originZ;
    if (cx !== this.originX || cz !== this.originZ) {
      const dx = (cx - this.originX) * CHUNK, dz = (cz - this.originZ) * CHUNK;
      this.originX = cx; this.originZ = cz; this.player.x -= dx; this.player.z -= dz;
      for (const c of this.chunks) { c.group.position.x -= dx; c.group.position.z -= dz; }
      for (const e of this.enemies) { e.x -= dx; e.z -= dz; e.mesh.position.x -= dx; e.mesh.position.z -= dz; }
      for (const e of this.effects) { e.mesh.position.x -= dx; e.mesh.position.z -= dz; }
      for (const g of this.grenades) { g.mesh.position.x -= dx; g.mesh.position.z -= dz; }
      this.navClock = 0;
    }
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i]; if (Math.abs(c.cx - cx) > 2 || Math.abs(c.cz - cz) > 2) { this.removeChunk(c); this.chunks.splice(i, 1); }
    }
    this.queue.length = 0;
    for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) {
      if (!this.chunks.some(c => c.cx === x && c.cz === z)) this.queue.push({ cx: x, cz: z });
    }
    const tx = this.player.x - Math.sin(this.yaw) * 16, tz = this.player.z - Math.cos(this.yaw) * 16;
    this.queue.sort((a, b) => ((a.cx - cx) * 40 + 20 - tx) ** 2 + ((a.cz - cz) * 40 + 20 - tz) ** 2 - (((b.cx - cx) * 40 + 20 - tx) ** 2 + ((b.cz - cz) * 40 + 20 - tz) ** 2));
  }
  private loaded(x: number, z: number) {
    const cx = Math.floor(x / CHUNK) + this.originX, cz = Math.floor(z / CHUNK) + this.originZ;
    return this.chunks.some(c => c.cx === cx && c.cz === cz);
  }
  private blocked(x: number, z: number, radius: number) {
    if (!this.loaded(x - radius, z - radius) || !this.loaded(x + radius, z + radius) || !this.loaded(x - radius, z + radius) || !this.loaded(x + radius, z - radius)) return true;
    for (const c of this.chunks) {
      const lx = x - c.group.position.x, lz = z - c.group.position.z;
      if (lx < -radius || lx > 40 + radius || lz < -radius || lz > 40 + radius) continue;
      for (const b of c.boxes) if (overlaps(lx, lz, radius, b)) return true;
    }
    return false;
  }
  private wallDistance(origin: THREE.Vector3, direction: THREE.Vector3, max: number) {
    this.ray.set(origin, direction);
    let closest = max;
    for (const c of this.chunks) {
      const ox = c.group.position.x, oz = c.group.position.z;
      if (Math.hypot(ox + 20 - origin.x, oz + 20 - origin.z) > max + 29) continue;
      for (const b of c.boxes) {
        this.rayBox.min.set(ox + b.x - b.w / 2, 0, oz + b.z - b.d / 2);
        this.rayBox.max.set(ox + b.x + b.w / 2, b.h, oz + b.z + b.d / 2);
        if (this.ray.intersectBox(this.rayBox, this.intersection)) closest = Math.min(closest, origin.distanceTo(this.intersection));
      }
    }
    return closest;
  }
  private lineOfSight(x: number, y: number, z: number, tx: number, ty: number, tz: number) {
    this.scratch.set(x, y, z); this.direction.set(tx - x, ty - y, tz - z);
    const length = this.direction.length(); this.direction.normalize();
    return this.wallDistance(this.scratch, this.direction, length) >= length - .05;
  }

  private frame = (now: number) => {
    if (this.disposed || this.failed) return;
    this.raf = requestAnimationFrame(this.frame);
    const raw = Math.max(0, (now - this.lastTime) / 1000); this.lastTime = now;
    const delta = Math.min(.1, raw);
    if (!document.hidden) {
      // Hard work budget: at most one small chunk (4–8 buildings) per rendered frame.
      if (this.queue.length) { const next = this.queue.shift()!; this.addChunk(next.cx, next.cz); this.navClock = 0; }
      this.frameMs += (Math.min(raw, .1) * 1000 - this.frameMs) * .025;
      this.slowTime = this.frameMs > 27 ? this.slowTime + delta : Math.max(0, this.slowTime - delta);
      if (this.slowTime > 6 && !this.adaptive && this.settings.quality === 'standard') { this.adaptive = true; this.resize(); }
      if (this.preview) {
        this.previewTime += delta;
        this.updateMenuPatrols();
      } else if (this.running && this.introTime < INTRO_SECONDS) {
        this.advanceIntro(raw);
      } else if (this.running) {
        this.accumulator += delta;
        let steps = 0;
        while (this.accumulator >= STEP && steps < 5) { this.simulate(STEP); this.accumulator -= STEP; steps++; if (!this.running) break; }
        if (steps === 5) this.accumulator = 0;
      }
      this.updateCamera(); this.renderer.render(this.scene, this.camera);
      this.hudClock += delta; if (!this.preview && this.hudClock >= .1) { this.hudClock = 0; this.syncHud(); }
    }
  };
  private simulate(dt: number) {
    if (!this.running || document.hidden || this.introTime < INTRO_SECONDS) return;
    this.survival += dt * this.clockScale;
    this.bossAlert = Math.max(0, this.bossAlert - dt);
    this.bossBreather = Math.max(0, this.bossBreather - dt);
    if (this.survival >= this.nextBoss) {
      this.nextBoss = (Math.floor(this.survival / 180) + 1) * 180;
      if (this.enemies[40].health || this.bossDue) this.bossPending = true;
      else { this.bossDue = true; this.bossAlert = 4; }
    }
    this.elapsed += dt; this.damageAgo += dt; this.hitTime -= dt; this.hurtTime -= dt;
    if (this.damageAgo >= 5) this.health = Math.min(200, this.health + dt * 8);
    let f = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')) + this.touchForward;
    let r = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) + this.touchRight;
    const length = Math.hypot(f, r); if (length > 1) { f /= length; r /= length; }
    const speed = this.touchSprint || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 10 : 6;
    const dx = (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * r) * speed * dt;
    const dz = (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * r) * speed * dt;
    if (!this.blocked(this.player.x + dx, this.player.z, RADIUS)) this.player.x += dx;
    if (!this.blocked(this.player.x, this.player.z + dz, RADIUS)) this.player.z += dz;
    if ((this.keys.has('Space') || this.touchJumpQueued) && this.grounded) { this.vertical = 7; this.grounded = false; }
    this.touchJumpQueued = false;
    this.vertical -= 20 * dt; this.player.y += this.vertical * dt;
    if (this.player.y <= EYE) { this.player.y = EYE; this.vertical = 0; this.grounded = true; }
    if (this.player.x < 0 || this.player.x >= CHUNK || this.player.z < 0 || this.player.z >= CHUNK) this.updateStreaming();
    this.shootCooldown -= dt; this.flash -= dt; this.recoil *= Math.exp(-dt * 15);
    if (this.firing && this.shootCooldown <= 0) this.shoot();
    if (this.keys.has('KeyG') && !this.grenadeLatch) { this.throwGrenade(); this.grenadeLatch = true; }
    if (!this.keys.has('KeyG')) this.grenadeLatch = false;
    if (this.ammo < 3) { this.recharge -= dt; if (this.recharge <= 0) { this.ammo++; this.recharge = this.ammo < 3 ? 4 : 0; } }
    this.updateGrenades(dt); this.updateEffects(dt);
    this.navClock -= dt; if (this.navClock <= 0) { this.rebuildNavigation(); this.navClock = .7; }
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) { this.spawnEnemy(); this.updateBoss(); this.spawnClock = .5; }
    for (const e of this.enemies) if (e.health && this.running) this.updateEnemy(e, dt);
  }
  private updateCamera() {
    const fog = this.scene.fog as THREE.Fog;
    if (this.preview) {
      const motion = this.reducedMotion ? 0 : this.previewTime;
      this.camera.position.set(42 + Math.sin(motion * .09) * 13, 48 + Math.sin(motion * .12) * 3, 50 + Math.sin(motion * .075) * 14);
      this.camera.lookAt(20, EYE, 0);
      this.camera.fov = 54; this.camera.updateProjectionMatrix();
      fog.near = 55; fog.far = 110;
      this.gun.visible = false; this.muzzle.visible = false;
      return;
    }
    if (this.introTime < INTRO_SECONDS) {
      // Aerial orbit, then a descent along the clear center street. No extra world,
      // camera, render loop, models or postprocessing are allocated for this shot.
      const t = this.introTime / INTRO_SECONDS;
      const ease = (v: number) => v * v * (3 - 2 * v);
      const orbit = ease(Math.min(1, t / .4));
      const descent = ease(Math.max(0, (t - .4) / .6));
      this.camera.position.set(20 + 22 * (1 - orbit), 58 - 16 * orbit - (42 - EYE) * descent, 50 - 16 * orbit - 14 * descent);
      this.camera.position.addScaledVector(this.aerialOffset, 1 - orbit);
      this.camera.lookAt(20, EYE, 0);
      this.camera.fov = 54 + 24 * descent; this.camera.updateProjectionMatrix();
      fog.near = 55 - 20 * descent; fog.far = 110 - (110 - this.visibility) * descent;
      this.gun.visible = false; this.muzzle.visible = false;
      return;
    }
    if (this.camera.fov !== 78) { this.camera.fov = 78; this.camera.updateProjectionMatrix(); }
    fog.near = 35; fog.far = this.visibility; this.gun.visible = true;
    this.camera.position.copy(this.player); this.camera.rotation.set(this.pitch, this.yaw, 0);
    const moving = this.running && (this.touchForward !== 0 || this.touchRight !== 0 || this.keys.has('KeyW') || this.keys.has('KeyA') || this.keys.has('KeyS') || this.keys.has('KeyD'));
    this.gun.position.y = moving && this.grounded ? Math.sin(this.elapsed * 10) * .008 : 0;
    this.gun.position.z = this.settings.recoil ? this.recoil : 0;
    this.muzzle.visible = this.flash > 0;
  }
  private shoot() {
    if (this.bullets <= 0) return;
    this.bullets--;
    this.shootCooldown = .13; this.recoil = .055; this.flash = .045;
    this.updateCamera(); this.camera.updateMatrixWorld(true);
    this.camera.getWorldDirection(this.direction);
    const range = this.shotRange(this.player, this.direction);
    let distance = this.wallDistance(this.player, this.direction, range), victim: Enemy | null = null;
    this.ray.set(this.player, this.direction);
    for (const e of this.enemies) if (e.health && e.mesh.visible && this.loaded(e.x, e.z) && Math.hypot(e.x - this.player.x, e.z - this.player.z) <= range + 2) {
      const scale = e.boss ? 2 : 1;
      this.rayBox.min.set(e.x - .52 * scale, .06, e.z - .4 * scale); this.rayBox.max.set(e.x + .52 * scale, 1.75 * scale, e.z + .4 * scale);
      if (this.ray.intersectBox(this.rayBox, this.intersection)) { const d = this.player.distanceTo(this.intersection); if (d < distance) { distance = d; victim = e; } }
    }
    if (victim) { this.damageEnemy(victim, 1); this.hitTime = .18; }
    else if (distance < range) { this.intersection.copy(this.direction).multiplyScalar(distance).add(this.player); this.effect(this.intersection.x, this.intersection.y, this.intersection.z, .15, false); }
    this.tone(130, .055, .045, 'sawtooth', 42);
  }
  private shotRange(origin: THREE.Vector3, direction: THREE.Vector3) {
    // Stop at the first unloaded terrain; never grow the streaming footprint for shots.
    for (let d = 1; d <= this.visibility; d++) if (!this.loaded(origin.x + direction.x * d, origin.z + direction.z * d)) return d - 1;
    return this.visibility;
  }
  private damageEnemy(e: Enemy, damage: number) {
    if (!e.health) return;
    e.health = Math.max(0, e.health - damage);
    if (!e.health) this.kill(e);
  }
  private kill(e: Enemy) {
    if (e.boss && this.bossPending) { this.bossPending = false; this.bossDue = true; this.bossBreather = 5; }
    this.effect(e.x, 1, e.z, .65, false); this.despawn(e); this.kills++; this.bullets += 20; this.tone(760, .055, .025, 'sine', 1100);
  }
  private despawn(e: Enemy) { e.health = 0; e.state = 'dead'; e.mesh.visible = false; e.sees = false; e.timer = 0; e.check = 0; e.mesh.scale.setScalar(e.boss ? 2 : 1); }
  private effect(x: number, y: number, z: number, size: number, explosion: boolean) {
    const cap = this.settings.quality === 'low' ? 16 : 32;
    for (let i = 0; i < cap; i++) {
      const e = this.effects[i]; if (e.life > 0) continue;
      e.life = e.max = explosion ? .38 : .18; e.size = size; e.explosion = explosion; e.mesh.material = this.neon[explosion ? 2 : i % 2];
      e.mesh.position.set(x, y, z); e.mesh.scale.setScalar(explosion ? .2 : size); e.mesh.visible = true; return;
    }
  }
  private updateEffects(dt: number) {
    for (const e of this.effects) if (e.life > 0) {
      e.life -= dt; e.mesh.visible = e.life > 0;
      const t = Math.max(0, e.life / e.max);
      e.mesh.scale.setScalar(e.explosion ? e.size * Math.sin(t * Math.PI) : e.size * t);
      e.mesh.rotation.y += dt * 8;
    }
  }
  private throwGrenade() {
    if (this.ammo <= 0) return;
    const g = this.grenades.find(item => item.fuse <= 0); if (!g) return;
    this.ammo--; if (this.recharge <= 0) this.recharge = 4;
    g.mesh.position.copy(this.player); g.velocity.set(-Math.sin(this.yaw) * 13, 5 + Math.sin(this.pitch) * 7, -Math.cos(this.yaw) * 13);
    g.fuse = 1.65; g.mesh.visible = true; this.tone(350, .08, .03, 'triangle', 170);
  }
  private updateGrenades(dt: number) {
    for (const g of this.grenades) if (g.fuse > 0) {
      g.fuse -= dt; g.velocity.y -= 16 * dt;
      const p = g.mesh.position;
      if (this.blocked(p.x + g.velocity.x * dt, p.z, .15)) g.velocity.x *= -.5; else p.x += g.velocity.x * dt;
      if (this.blocked(p.x, p.z + g.velocity.z * dt, .15)) g.velocity.z *= -.5; else p.z += g.velocity.z * dt;
      p.y += g.velocity.y * dt;
      if (p.y < .15) { p.y = .15; g.velocity.y = Math.abs(g.velocity.y) * .4; g.velocity.x *= .94; g.velocity.z *= .94; }
      g.mesh.rotation.x += dt * 6;
      g.mesh.scale.setScalar(.14 + (g.fuse < .5 ? Math.sin(g.fuse * 50) * .035 : 0));
      if (g.fuse <= 0) {
        g.mesh.visible = false; this.effect(p.x, p.y, p.z, 3.2, true); this.tone(90, .25, .12, 'sawtooth', 24);
        for (const e of this.enemies) if (e.health && e.mesh.visible && this.loaded(e.x, e.z) && Math.hypot(e.x - p.x, e.z - p.z, 1 - p.y) < 8 && this.lineOfSight(p.x, p.y, p.z, e.x, 1, e.z)) this.damageEnemy(e, 5);
      }
    }
  }

  private populationTarget() {
    // Use world coordinates so streaming across chunks preserves distance from spawn.
    const distance = Math.hypot(this.originX * CHUNK + this.player.x - 20, this.originZ * CHUNK + this.player.z - 20);
    return Math.ceil(20 * (1 + distance / 500) * 1.2 ** Math.floor(this.survival / 180));
  }
  private placeEnemy(e: Enemy, relocate = false) {
    for (let attempt = 0; attempt < 64; attempt++) {
      const c = this.chunks[Math.floor(Math.random() * this.chunks.length)];
      const vertical = Math.random() > .5;
      const x = c.group.position.x + (vertical ? 20 : 2 + Math.random() * 36);
      const z = c.group.position.z + (vertical ? 2 + Math.random() * 36 : 20);
      const dx = x - this.player.x, dz = z - this.player.z, d = Math.hypot(dx, dz);
      if (d < 25 || d > (e.boss ? 45 : 65) || this.blocked(x, z, e.boss ? 1.05 : .55)) continue;
      const gx = Math.floor((x - this.navX) / 4), gz = Math.floor((z - this.navZ) / 4);
      if (gx < 0 || gx >= 30 || gz < 0 || gz >= 30 || this.nav[gz * 30 + gx] < 0) continue;
      const facing = (-Math.sin(this.yaw) * dx - Math.cos(this.yaw) * dz) / d;
      if (e.boss && !relocate) {
        if (facing < -.15 || !this.lineOfSight(x, 2.5, z, this.player.x, this.player.y, this.player.z)) continue;
      }
      if (this.enemies.some(other => other !== e && other.health && other.mesh.visible && Math.hypot(other.x - x, other.z - z) < 3)) continue;
      e.x = x; e.z = z; e.health = relocate ? e.health : e.boss ? 20 : 1;
      e.state = 'chase'; e.timer = 1.5; e.check = Math.random() * .35; e.sees = false; e.angle = Math.random() * Math.PI * 2;
      e.mesh.scale.setScalar(e.boss ? 2 : 1); e.eye.material = this.neon[e.boss ? 0 : 1];
      e.mesh.visible = true; e.mesh.position.set(x, 0, z);
      return true;
    }
    return false;
  }
  private spawnEnemy() {
    // Synchronous placement has no outstanding reservations. One attempt per half second;
    // failures retain the deficit and retry against the player's next location.
    const ordinary = this.enemies.filter(e => !e.boss && e.health);
    if (ordinary.length >= this.populationTarget()) return;
    let e = this.enemies.find(e => !e.boss && !e.health);
    if (!e) { e = this.buildEnemy(this.enemies.length); this.enemies.push(e); }
    this.placeEnemy(e);
  }
  private updateBoss() {
    const boss = this.enemies[40];
    if (boss.health) {
      if (!boss.mesh.visible || !this.loaded(boss.x, boss.z) || Math.hypot(boss.x - this.player.x, boss.z - this.player.z) > 70) {
        boss.mesh.visible = false;
        if (this.placeEnemy(boss, true)) { this.bossAlert = 3; this.bossAlertMessage = 'BOSS APPROACHING'; }
      }
    } else if (this.bossDue && this.bossBreather <= 0) {
      this.bossAlert = 4; this.bossAlertMessage = 'BOSS INCOMING';
      if (this.placeEnemy(boss)) this.bossDue = false;
    }
  }
  private rebuildNavigation() {
    // One shared 30×30 street flow field, refreshed infrequently; no retained history.
    this.navX = -40; this.navZ = -40; this.nav.fill(-1);
    for (let z = 0; z < 30; z++) for (let x = 0; x < 30; x++) if (this.blocked(this.navX + x * 4 + 2, this.navZ + z * 4 + 2, 1.05)) this.nav[z * 30 + x] = -2;
    const px = Math.floor((this.player.x - this.navX) / 4), pz = Math.floor((this.player.z - this.navZ) / 4);
    const start = pz * 30 + px; if (start < 0 || start >= 900) return;
    this.nav[start] = 0; let head = 0, tail = 1; this.navQueue[0] = start;
    while (head < tail) {
      const index = this.navQueue[head++], x = index % 30, z = Math.floor(index / 30);
      for (let n = 0; n < 4; n++) {
        const nx = x + (n === 0 ? 1 : n === 1 ? -1 : 0), nz = z + (n === 2 ? 1 : n === 3 ? -1 : 0);
        if (nx < 0 || nx >= 30 || nz < 0 || nz >= 30) continue;
        const next = nz * 30 + nx; if (this.nav[next] !== -1) continue;
        this.nav[next] = this.nav[index] + 1; this.navQueue[tail++] = next;
      }
    }
  }
  private updateEnemy(e: Enemy, dt: number) {
    const dx = this.player.x - e.x, dz = this.player.z - e.z, distance = Math.hypot(dx, dz);
    if (distance > this.visibility || !this.loaded(e.x, e.z) || !e.mesh.visible) {
      if (e.boss) e.mesh.visible = false; else this.despawn(e);
      return;
    }
    e.check -= dt;
    if (e.check <= 0) { e.check = .35; e.sees = distance < 30 && this.lineOfSight(e.x, 1.45, e.z, this.player.x, this.player.y, this.player.z); }
    e.timer -= dt;
    if (e.state === 'attack') {
      e.eye.material = this.neon[2]; e.mesh.scale.setScalar((e.boss ? 2 : 1) * (1 + Math.sin(e.timer * 25) * .025));
      if (e.timer <= 0) {
        if (distance < 20 && this.lineOfSight(e.x, 1.45, e.z, this.player.x, this.player.y, this.player.z)) {
          this.health = Math.max(0, this.health - (e.boss ? 50 : 10)); this.damageAgo = 0; this.hurtTime = .18;
          this.effect(this.player.x + dx / Math.max(distance, 1) * -.7, this.player.y - .3, this.player.z + dz / Math.max(distance, 1) * -.7, .08, false);
          this.tone(65, .06, .035, 'triangle', 40);
          if (this.health <= 0) { this.running = false; this.keys.clear(); this.firing = false; document.exitPointerLock?.(); this.syncHud(); this.callbacks.status('dead'); return; }
        }
        e.state = 'chase'; e.timer = e.boss ? 3 : 2.4;
      }
    } else {
      e.mesh.scale.setScalar(e.boss ? 2 : 1); e.eye.material = this.neon[e.boss ? 0 : 1];
      if (e.sees && e.state === 'idle') { e.state = 'detect'; e.timer = .35; }
      if (e.state === 'detect' && e.timer <= 0) e.state = 'chase';
      if (e.state === 'chase' && e.sees && distance < 19 && e.timer <= 0) { e.state = 'attack'; e.timer = e.boss ? 1.1 : .75; }
      let tx = e.x, tz = e.z, speed = 2.5;
      if (e.state === 'chase') {
        if (e.sees) { if (distance > 9) { tx = this.player.x; tz = this.player.z; } }
        else {
          const gx = Math.floor((e.x - this.navX) / 4), gz = Math.floor((e.z - this.navZ) / 4);
          let best = 32767;
          for (let n = 0; n < 4; n++) {
            const x = gx + (n === 0 ? 1 : n === 1 ? -1 : 0), z = gz + (n === 2 ? 1 : n === 3 ? -1 : 0);
            if (x < 0 || x >= 30 || z < 0 || z >= 30) continue;
            const value = this.nav[z * 30 + x]; if (value >= 0 && value < best) { best = value; tx = this.navX + x * 4 + 2; tz = this.navZ + z * 4 + 2; }
          }
        }
      } else if (e.state === 'idle') {
        speed = .8; tx += Math.sin(e.angle); tz += Math.cos(e.angle);
        if (e.timer <= 0) { e.angle += 1.57; e.timer = 3; }
      }
      const length = Math.hypot(tx - e.x, tz - e.z);
      if (length > .15) {
        const mx = (tx - e.x) / length * speed * dt, mz = (tz - e.z) / length * speed * dt;
        if (!this.blocked(e.x + mx, e.z, e.boss ? 1.05 : .46)) e.x += mx; else e.angle += dt;
        if (!this.blocked(e.x, e.z + mz, e.boss ? 1.05 : .46)) e.z += mz; else e.angle += dt;
      }
    }
    e.mesh.position.set(e.x, Math.sin(this.elapsed * 5 + e.angle) * .025, e.z);
    e.mesh.rotation.y = Math.atan2(-dx, -dz);
  }

  private initAudio() {
    if (!this.settings.sound) return;
    try { if (!this.audio) this.audio = new AudioContext(); if (this.audio.state === 'suspended') void this.audio.resume().catch(() => {}); } catch { /* Audio is optional. */ }
  }
  private tone(frequency: number, duration: number, volume: number, type: OscillatorType, end: number) {
    if (!this.settings.sound) return;
    this.initAudio(); const audio = this.audio; if (!audio || audio.state !== 'running' || this.audioVoices.size >= 12) return;
    try {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type; osc.frequency.setValueAtTime(frequency, audio.currentTime); osc.frequency.exponentialRampToValueAtTime(end, audio.currentTime + duration);
      gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      osc.connect(gain); gain.connect(audio.destination); this.audioVoices.add(osc);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); this.audioVoices.delete(osc); };
      osc.start(); osc.stop(audio.currentTime + duration);
    } catch { /* Audio failure cannot interrupt simulation. */ }
  }
  private syncHud() {
    const info = this.renderer.info;
    let activeEnemies = 0, activeEffects = 0; for (const e of this.enemies) if (e.health && !e.boss) activeEnemies++; for (const e of this.effects) if (e.life > 0) activeEffects++;
    const boss = this.enemies[40];
    const dx = boss.x - this.player.x, dz = boss.z - this.player.z;
    const angle = Math.atan2(dx, -dz) + this.yaw;
    const bearing = Math.atan2(Math.sin(angle), Math.cos(angle));
    this.scratch.set(boss.x, 2, boss.z).project(this.camera);
    const offscreen = !boss.mesh.visible || this.scratch.z > 1 || Math.abs(this.scratch.x) > 1 || Math.abs(this.scratch.y) > 1;
    this.callbacks.hud({ introTime: this.introTime, survival: this.survival, population: activeEnemies, target: this.populationTarget(),
      bossHealth: boss.health, bossPending: this.bossPending || (this.bossDue && this.bossBreather > 0),
      bossAlert: this.bossDue && this.bossBreather <= 0 ? 'BOSS INCOMING' : this.bossAlert > 0 ? this.bossAlertMessage : '',
      bossDistance: boss.health && boss.mesh.visible ? Math.round(Math.hypot(dx, dz)) : null,
      bossDirection: boss.health && offscreen ? (Math.abs(bearing) > 2.4 ? 'BEHIND' : bearing > 0 ? 'RIGHT >' : '< LEFT') : '',
      health: Math.ceil(this.health), bullets: this.bullets, kills: this.kills, grenades: this.ammo, recharge: this.recharge, hit: this.hitTime > 0, hurt: this.hurtTime > 0,
      district: this.chunks.find(c => c.cx === this.originX && c.cz === this.originZ)?.name || 'TRANSIT', x: this.originX * 40 + this.player.x, z: this.originZ * 40 + this.player.z, adaptive: this.adaptive,
      diagnostics: this.diagnostics ? `FPS ${(1000 / Math.max(1, this.frameMs)).toFixed(0)} / ${this.frameMs.toFixed(1)} ms\nCalls ${info.render.calls} / Triangles ${info.render.triangles}\nChunks ${this.chunks.length}/25 / Pending ${this.queue.length}\nEnemies ${activeEnemies}/${this.populationTarget()} + boss ${boss.health > 0 ? 1 : 0} / Effects ${activeEffects}/32\nGPU geometry ${info.memory.geometries} / textures ${info.memory.textures}\nOrigin ${this.originX}, ${this.originZ}` : '' });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.running = false; cancelAnimationFrame(this.raf);
    for (const fn of this.cleanup) fn(); this.cleanup.length = 0;
    if (document.pointerLockElement === this.host) document.exitPointerLock();
    for (const voice of this.audioVoices) { try { voice.stop(); } catch { /* Already ended. */ } } this.audioVoices.clear();
    if (this.audio) void this.audio.close().catch(() => {});
    for (const c of this.chunks) this.removeChunk(c); this.chunks.length = 0; this.queue.length = 0;
    this.boxGeometry.dispose(); this.sphereGeometry.dispose(); this.materials.forEach(m => m.dispose()); this.scene.clear();
    this.renderer.dispose(); this.renderer.domElement.remove(); this.keys.clear();
  }
}
