export type Quality = 'standard' | 'low';
export type Settings = { quality: Quality; sound: boolean; recoil: boolean };
export type Status = 'start' | 'loading' | 'ready' | 'playing' | 'paused' | 'dead' | 'error';
export type Hud = { health: number; kills: number; grenades: number; recharge: number; hit: boolean; hurt: boolean; district: string; x: number; z: number; adaptive: boolean; diagnostics: string };
export type Callbacks = { hud: (hud: Hud) => void; status: (status: Status, message?: string) => void };
