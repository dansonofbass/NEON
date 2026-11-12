export type Quality = 'standard' | 'low';
export type Settings = { quality: Quality; sound: boolean; recoil: boolean };
export type Status = 'start' | 'loading' | 'ready' | 'intro' | 'playing' | 'paused' | 'dead' | 'error';
export type Hud = { introTime: number; survival: number; population: number; target: number; bossHealth: number; bossPending: boolean; bossAlert: string; bossDistance: number | null; bossDirection: string; health: number; bullets: number; kills: number; grenades: number; recharge: number; hit: boolean; hurt: boolean; district: string; x: number; z: number; adaptive: boolean; diagnostics: string };
export type Callbacks = { hud: (hud: Hud) => void; status: (status: Status, message?: string) => void };
