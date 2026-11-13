'use client';
import { useEffect, useRef, useState } from 'react';
import type { Engine } from '../../game/engine';
import type { Hud, Settings, Status } from '../../game/types';
import MobileControls from './MobileControls';
import { GameMusic } from '../../game/music';

const initial: Hud = { introTime: 0, survival: 0, population: 0, target: 20, bossHealth: 0, bossPending: false, bossAlert: "", bossDistance: null, bossDirection: "", health: 200, bullets: 200, magazine: 50, reloadTime: 0, kills: 0, grenades: 3, recharge: 0, hit: false, hurt: false, district: 'CROSSROADS', x: 20, z: 20, adaptive: false, diagnostics: '' };
export default function Game() {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const music = useRef<GameMusic | null>(null);
  const alive = useRef(false);
  const [status, setStatus] = useState<Status>('start');
  const [sceneReady, setSceneReady] = useState(false);
  const [message, setMessage] = useState('');
  const [hud, setHud] = useState(initial);
  const [best, setBest] = useState(0);
  const [touch, setTouch] = useState(false);
  const [settings, setSettings] = useState<Settings>({ quality: 'standard', sound: true, recoil: true });
  const latestSettings = useRef(settings);
  latestSettings.current = settings;

  useEffect(() => {
    alive.current = true;
    music.current = new GameMusic();
    // Use the primary input, not any touch hardware attached to a desktop.
    const touchDevice = matchMedia('(hover: none) and (pointer: coarse)');
    const mobile = touchDevice.matches;
    setTouch(mobile);
    const inputChanged = (event: MediaQueryListEvent) => {
      engine.current?.pause();
      setTouch(event.matches);
    };
    touchDevice.addEventListener('change', inputChanged);

    try {
      const data = JSON.parse(localStorage.getItem('neon-drift-v1') || '{}');
      if (Number.isFinite(data.best)) setBest(Math.max(0, data.best));
      setSettings({ quality: 'standard', sound: data.sound !== false, recoil: data.recoil !== false });
    } catch { /* Storage is optional. */ }
    let cancelled = false;
    void import('../../game/engine').then(({ Engine }) => {
      if (cancelled || !host.current) return;
      const instance = new Engine(host.current, latestSettings.current, {
        hud: value => { if (!cancelled) setHud(value); },
        status: (value, detail) => { if (!cancelled) { setStatus(value); setMessage(detail || ''); } }
      });
      engine.current = instance;
      instance.setTouchMode(touchDevice.matches);
      instance.showMenu();
      setSceneReady(true);
    }).catch(error => { if (!cancelled) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'WebGL could not start.'); } });
    return () => { cancelled = true; music.current?.dispose(); music.current = null; alive.current = false; touchDevice.removeEventListener('change', inputChanged); engine.current?.dispose(); engine.current = null; };
  }, []);

  useEffect(() => { engine.current?.configure(settings); }, [settings]);
  useEffect(() => { music.current?.setPlaying(status === 'playing' || status === 'intro', settings.sound); }, [status, settings.sound]);
  useEffect(() => { engine.current?.setTouchMode(touch); }, [touch]);
  useEffect(() => {
    if (hud.kills > best) setBest(hud.kills);
  }, [hud.kills, best]);
  useEffect(() => {
    try { localStorage.setItem('neon-drift-v1', JSON.stringify({ ...settings, best })); } catch { /* Private browsing can deny storage. */ }
  }, [settings, best]);

  function play() {
    music.current?.unlock(latestSettings.current.sound);
    if (!engine.current) return;
    if (status === 'start') engine.current.beginRun();
    else engine.current.resume();
  }
  function restart() { music.current?.reset(); music.current?.unlock(latestSettings.current.sound); engine.current?.reset(); engine.current?.resume(); }
  function mainMenu() {
    music.current?.reset();
    engine.current?.showMenu();
    setHud(initial); setMessage(''); setStatus('start');
  }
  const landing = ['start', 'loading', 'error'].includes(status);
  const intro = status === 'intro';
  const menu = status !== 'playing' && !intro;
  const started = !['start', 'loading', 'error', 'paused'].includes(status);
  return <main className={`app${started ? ' in-game' : ''}${touch ? ' touch-mode' : ''}${menu ? ' menu-open' : ''}${status === 'dead' ? ' game-over' : ''}${intro ? ' intro-scene' : ''}${landing ? ' cinematic-menu' : ''}`}>
    <div className="world" ref={host} aria-label="NEON DRIFT game viewport" />
    {status === 'dead' && <div className="death-wash" aria-hidden="true" />}
    <div className="grain" aria-hidden="true" />
    <header className="topbar"><a className="wordmark" href="./"><span className="brand-icon">N</span> NEON DRIFT<span className="edition"> / SOLO OPS</span></a><span className="system-status"><i /> {status === 'playing' ? 'LINK ACTIVE' : 'SYSTEM ONLINE'}<span className="version">V.01</span></span></header>

    {status === 'playing' && <div className={`hud ${hud.hurt ? 'hurt' : ''}`}>
      <div className="district"><span className="eyebrow">SECTOR // {hud.district}</span><small>{String(Math.floor(hud.x)).padStart(4, '0')} : {String(Math.floor(hud.z)).padStart(4, '0')}</small></div>
      <div className="survival-status"><strong>{Math.floor(hud.survival / 60).toString().padStart(2, '0')}:{Math.floor(hud.survival % 60).toString().padStart(2, '0')}</strong><span>SURVIVAL / HOSTILES {hud.population}/{hud.target}</span></div>
      {(hud.bossHealth > 0 || hud.bossAlert || hud.bossPending) && <div className="boss-status">
        <strong>{hud.bossAlert || (hud.bossHealth > 0 ? 'ENFORCER' : 'NEXT ENFORCER APPROACHING')}</strong>
        {hud.bossHealth > 0 && <><progress aria-label="Boss health" max={20} value={hud.bossHealth} /><span>{hud.bossHealth}/20 / {hud.bossDistance === null ? 'RELOCATING' : `${hud.bossDistance} m`} {hud.bossDirection}</span></>}
        {hud.bossPending && <small>ANOTHER ENCOUNTER PENDING</small>}
      </div>}
      {status === 'playing' && <div className={`crosshair ${hud.hit ? 'hit' : ''}`}><i /><b /><span /></div>}
      <div className="health"><span className="eyebrow">VITALS</span><div><span className="plus">+</span><strong>{hud.health}</strong><small>/ 200</small></div><div className="health-track"><i style={{ width: `${hud.health / 2}%` }} /></div></div>
      <div className="weapon-info"><span className="eyebrow">DRIFT / AUTOMATIC</span><div aria-label={`${hud.magazine} loaded, ${hud.bullets} total rounds`}><strong>{hud.magazine}</strong><span>/{hud.bullets}</span></div></div>
      <div className="combat-stats"><div><span className="eyebrow">ELIMINATIONS</span><strong>{String(hud.kills).padStart(3, '0')}</strong></div><div><span className="eyebrow">{touch ? 'GRENADES' : 'G / GRENADES'}</span><p>{[0, 1, 2].map(i => <i className={i < hud.grenades ? 'charged' : ''} key={i} />)}</p><small>{hud.grenades < 3 ? `+1 IN ${Math.ceil(hud.recharge)}s` : 'FULLY CHARGED'}</small></div></div>
      {hud.adaptive && <div className="adaptive">ADAPTIVE RESOLUTION ACTIVE</div>}
      {hud.diagnostics && <pre className="diagnostics">{hud.diagnostics}</pre>}
    </div>}
    {status === 'playing' && <div className={`reload-status${hud.magazine <= 10 ? ' low-ammo' : ''}`}>
      <span className="compact-ammo" aria-label={`${hud.magazine} loaded, ${hud.bullets} total rounds`}>{hud.magazine}<small>/{hud.bullets}</small></span>
      {(hud.magazine <= 10 || hud.reloadTime > 0 || touch) && <button
        disabled={hud.reloadTime > 0 || hud.magazine === 50 || hud.bullets <= hud.magazine}
        onPointerDown={event => event.stopPropagation()}
        onClick={() => engine.current?.reload()}
        aria-label={hud.reloadTime > 0 ? 'Reloading' : 'Reload weapon'}>
        {hud.reloadTime > 0 ? `RELOADING ${hud.reloadTime.toFixed(1)}s` : hud.bullets <= hud.magazine ? 'NO RESERVE' : `${touch ? '' : 'R / '}RELOAD`}
      </button>}
    </div>}
    {touch && status === 'playing' && engine.current && <MobileControls engine={engine.current} />}
    {intro && <div className="cinematic" aria-label="City introduction">
      <div className="cinematic-frame" />
      <div className="cinematic-meta"><span>NEON DRIFT / PROLOGUE</span><span>AFTERLIGHT DISTRICT</span></div>
      <div className="cinematic-copy" key={hud.introTime < 4 ? 'city' : 'time'}>
        <span className="cinematic-kicker">{hud.introTime < 4 ? 'ONE CITY. ONE LAST CHANCE.' : 'REWIND THE NIGHT'}</span>
        <h2>{hud.introTime < 4 ? <>READY TO SAVE<br />THE CITY<span>?</span></> : <>WAY BACK,<br /><span>BACK INTO TIME ...</span></>}</h2>
        <i />
      </div>
      <div className="cinematic-bottom"><span>THE NIGHT IS NOT OVER YET</span><div className="cinematic-progress"><i style={{ transform: `scaleX(${hud.introTime / 8})` }} /></div><span>{Math.max(0, 8 - hud.introTime).toFixed(1)} s</span></div>
      <button className="cinematic-pause" onClick={() => engine.current?.pause()}>PAUSE {touch ? '' : '/ ESC'}</button>
    </div>}


    {menu && <>
      {landing && <div className="menu-shade" aria-hidden="true" />}
      <section className={landing ? 'landing-menu' : 'menu overlay'} aria-label={landing ? 'Main menu' : 'Run menu'}>
        <div className="menu-content">
          <h1>{status === 'dead' ? <>GAME<br /><em>OVER</em></> : <>NEON<br /><em>DRIFT</em></>}</h1>
          <p className="tagline">{landing ? 'SURVIVE THE GRID.' : status === 'dead' ? `${hud.kills} robots offline.` : status === 'paused' ? 'RUN PAUSED' : 'READY TO ENTER'}</p>
          {(status === 'error' || status === 'ready') && <p className="description" role="status">{message}</p>}
          <div className="actions">
            <button className="primary" disabled={status === 'loading' || (status === 'start' && !sceneReady)} onClick={status === 'dead' ? restart : status === 'error' ? () => location.reload() : play}><span>{status === 'loading' ? 'PREPARING' : status === 'error' ? 'RETRY' : status === 'dead' ? 'RESTART' : status === 'paused' ? 'RESUME' : 'PLAY'}</span><span aria-hidden="true">&#8599;</span></button>
            {status === 'paused' && <button className="restart" onClick={restart}>RESTART</button>}
            {!landing && <button className="restart" onClick={mainMenu}>MAIN MENU</button>}
          </div>
        </div>
      </section>
      <button className="sound-toggle" aria-label={`Sound ${settings.sound ? 'on' : 'off'}`} aria-pressed={settings.sound} onClick={() => {
        const sound = !settings.sound;
        music.current?.unlock(sound);
        setSettings(s => ({ ...s, sound }));
      }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z" />{settings.sound ? <path d="M15 8q4 4 0 8m3-11q7 7 0 14" /> : <path d="m16 9 6 6m0-6-6 6" />}</svg><span>SOUND {settings.sound ? 'ON' : 'OFF'}</span></button>
    </>}

  </main>;
}
