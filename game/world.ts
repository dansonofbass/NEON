export const CHUNK = 40;
export const SEED = 73129;
export type Box = { x: number; z: number; w: number; d: number; h: number; accent: number };
export type Layout = 'CROSSROADS' | 'AVENUE' | 'BACK ALLEY' | 'PLAZA' | 'WORKS';
export function randomFor(cx: number, cz: number) {
  let a = (Math.imul(cx, 374761393) ^ Math.imul(cz, 668265263) ^ SEED) >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function layoutFor(cx: number, cz: number): { name: Layout; boxes: Box[] } {
  const rand = randomFor(cx, cz);
  const kind = Math.floor(rand() * 5);
  const names: Layout[] = ['CROSSROADS', 'AVENUE', 'BACK ALLEY', 'PLAZA', 'WORKS'];
  const boxes: Box[] = [];
  // Every template reserves the same eight-meter cross, including at chunk seams.
  for (let q = 0; q < 4; q++) {
    if (kind === 3 && q === 0) continue;
    const sx = q % 2 ? 1 : -1, sz = q < 2 ? -1 : 1;
    const w = kind === 2 ? 8 : kind === 1 ? 10 : 12 + rand() * 2;
    const d = kind === 4 ? 11 : 12 + rand() * 2;
    boxes.push({ x: 20 + sx * 12, z: 20 + sz * 12, w, d, h: kind === 4 ? 5 + rand() * 6 : 9 + rand() * 23, accent: Math.floor(rand() * 3) });
    if (kind === 2) boxes.push({ x: 20 + sx * 5.8, z: 20 + sz * 12, w: 2, d: 10, h: 4 + rand() * 4, accent: q % 3 });
  }
  return { name: names[kind], boxes };
}
export function overlaps(x: number, z: number, radius: number, b: Box) {
  return x + radius > b.x - b.w / 2 && x - radius < b.x + b.w / 2 && z + radius > b.z - b.d / 2 && z - radius < b.z + b.d / 2;
}
