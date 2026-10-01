'use client';
import { useEffect, useRef, useState } from 'react';
import type { Engine } from '../../game/engine';
import type { Hud, Settings, Status } from '../../game/types';
import MobileControls from './MobileControls';

const initial: Hud = { health: 200, kills: 0, grenades: 3, recharge: 0, hit: false, hurt: false, district: 'CROSSROADS', x: 20, z: 20, adaptive: false, diagnostics: '' };
export default function Game() {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const alive = useRef(false);
  const busy = useRef(false);
  const [status, setStatus] = useState<Status>('start');
  const [message, setMessage] = useState('');
  const [hud, setHud] = useState(initial);
  const [best, setBest] = useState(0);
  const [touch, setTouch] = useState(false);
  const [settings, setSettings] = useState<Settings>({ quality: 'standard', sound: true, recoil: true });
  const latestSettings = useRef(settings);
  latestSettings.current = settings;

  useEffect(() => {
    alive.current = true;
    // Use the primary input, not any touch hardware attached to a desktop.
    const touchDevice = matchMedia('(hover: none) and (pointer: coarse)');
    const mobile = touchDevice.matches;
    setTouch(mobile);
    const inputChanged = (event: MediaQueryListEvent) => {
      engine.current?.pause();
      setTouch(event.matches);
    };
    touchDevice.addEventListener('change', inputChanged);
    if (mobile) setSettings(s => ({ ...s, quality: 'low' }));
    try {
      const data = JSON.parse(localStorage.getItem('neon-drift-v1') || '{}');
      if (Number.isFinite(data.best)) setBest(Math.max(0, data.best));
      setSettings({ quality: data.quality === 'low' || (!data.quality && mobile) ? 'low' : 'standard', sound: data.sound !== false, recoil: data.recoil !== false });
    } catch { /* Storage is optional. */ }
    return () => { alive.current = false; touchDevice.removeEventListener('change', inputChanged); engine.current?.dispose(); engine.current = null; };
  }, []);

  useEffect(() => { engine.current?.configure(settings); }, [settings]);
  useEffect(() => { engine.current?.setTouchMode(touch); }, [touch]);
  useEffect(() => {
    if (hud.kills > best) setBest(hud.kills);
  }, [hud.kills, best]);
  useEffect(() => {
    try { localStorage.setItem('neon-drift-v1', JSON.stringify({ ...settings, best })); } catch { /* Private browsing can deny storage. */ }
  }, [settings, best]);

  async function play() {
    if (engine.current) { engine.current.resume(); return; }
    if (busy.current || !host.current) return;
    busy.current = true; setStatus('loading'); setMessage('');
    // Request from this click, before import yields and transient activation expires.
    if (!touch) try { void Promise.resolve(host.current.requestPointerLock()).catch(() => {}); } catch { /* Explicit Enter button below retries. */ }
    try {
      const { Engine } = await import('../../game/engine');
      if (!alive.current || !host.current) return;
      const instance = new Engine(host.current, latestSettings.current, {
        hud: value => { if (alive.current) setHud(value); },
        status: (value, detail) => { if (alive.current) { setStatus(value); setMessage(detail || ''); } }
      });
      engine.current = instance;
      instance.setTouchMode(touch);
      instance.start();
    } catch (error) {
      document.exitPointerLock?.();
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'WebGL could not start. Try a browser with hardware acceleration enabled.');
    } finally { busy.current = false; }
  }
  function restart() { engine.current?.reset(); engine.current?.resume(); }
  const menu = status !== 'playing';
  const started = !['start', 'loading', 'error'].includes(status);
  return <main className={`app${started ? ' in-game' : ''}${touch ? ' touch-mode' : ''}${menu ? ' menu-open' : ''}`}>
    <div className="world" ref={host} aria-label="NEON DRIFT game viewport" />
    {!started && <div className="city-art" aria-hidden="true"><div className="moon" /><div className="horizon" />{Array.from({ length: 13 }, (_, i) => <div className={`tower tower-${i}`} key={i}><span /><i /><b /></div>)}<div className="road" /><div className="road-line" /></div>}
    <div className="grain" aria-hidden="true" />
    <header className="topbar"><a className="wordmark" href="./"><span className="brand-icon">N</span> NEON DRIFT<span className="edition"> / SOLO OPS</span></a><span className="system-status"><i /> {status === 'playing' ? 'LINK ACTIVE' : 'SYSTEM ONLINE'}<span className="version">V.01</span></span></header>

    {started && <div className={`hud ${hud.hurt ? 'hurt' : ''}`}>
      <div className="district"><span className="eyebrow">SECTOR // {hud.district}</span><small>{String(Math.floor(hud.x)).padStart(4, '0')} : {String(Math.floor(hud.z)).padStart(4, '0')}</small></div>
      {status === 'playing' && <div className={`crosshair ${hud.hit ? 'hit' : ''}`}><i /><b /><span /></div>}
      <div className="health"><span className="eyebrow">VITALS</span><div><span className="plus">+</span><strong>{hud.health}</strong><small>/ 200</small></div><div className="health-track"><i style={{ width: `${hud.health / 2}%` }} /></div></div>
      <div className="weapon-info"><span className="eyebrow">DRIFT / AUTOMATIC</span><div><strong>∞</strong><span>AMMO<br /><b>ONE HIT. LIGHTS OUT.</b></span></div></div>
      <div className="combat-stats"><div><span className="eyebrow">ELIMINATIONS</span><strong>{String(hud.kills).padStart(3, '0')}</strong></div><div><span className="eyebrow">{touch ? 'GRENADES' : 'G / GRENADES'}</span><p>{[0, 1, 2].map(i => <i className={i < hud.grenades ? 'charged' : ''} key={i} />)}</p><small>{hud.grenades < 3 ? `+1 IN ${Math.ceil(hud.recharge)}s` : 'FULLY CHARGED'}</small></div></div>
      {hud.adaptive && <div className="adaptive">ADAPTIVE RESOLUTION ACTIVE</div>}
      {hud.diagnostics && <pre className="diagnostics">{hud.diagnostics}</pre>}
    </div>}
    {touch && status === 'playing' && engine.current && <MobileControls engine={engine.current} />}

    {menu && <div className={`menu ${started ? 'overlay' : ''}`}>
      <section className="menu-content">
        <div className="eyebrow intro-kicker"><span /> {status === 'dead' ? 'SIGNAL LOST' : status === 'paused' ? 'CONNECTION ON HOLD' : 'ENDLESS CITY. ONE OPERATIVE.'}</div>
        <h1>{status === 'dead' ? <>RUN<br /><em>COMPLETE.</em></> : status === 'paused' ? <>TAKE A<br /><em>BREATHER.</em></> : <>NEON<br /><em>DRIFT</em><span className="title-dot">®</span></>}</h1>
        <p className="tagline">{status === 'dead' ? `${hud.kills} robots offline. The city is still waiting.` : status === 'paused' ? 'Your city. Your pace. Jump back into the grid.' : 'After hours. No limits.'}</p>
        <p className="description">{status === 'error' ? message : status === 'loading' ? 'Initializing your neighborhood…' : status === 'start' ? <>A city without an edge. Robots with one weakness.<br />Keep moving. Make every shot count.</> : message || (status === 'ready' ? (touch ? 'Your district is ready. Tap below to play.' : 'Your district is ready. Click below to capture your mouse.') : 'Unlimited ammo. One-shot enemies. Endless streets.')}</p>
        <div className="actions">
          <button className="primary" disabled={status === 'loading'} onClick={status === 'dead' ? restart : status === 'error' ? () => location.reload() : play}><span>{status === 'loading' ? 'INITIALIZING' : status === 'error' ? 'RELOAD & RETRY' : status === 'dead' ? 'TRY AGAIN' : status === 'paused' ? 'RESUME RUN' : status === 'ready' ? 'ENTER THE GRID' : 'ENTER THE GRID'}</span><span>{status === 'loading' ? '···' : '↗'}</span></button>
          {status === 'paused' && <button className="restart" onClick={restart}>RESTART</button>}
          <div className="play-note">{touch ? 'TOUCH CONTROLS' : status === 'start' ? 'SINGLE PLAYER' : 'MOUSE + KEYBOARD'}<span />{touch ? 'LANDSCAPE RECOMMENDED' : status === 'start' ? 'NO DOWNLOADS' : 'ESC TO PAUSE'}</div>
        </div>
        <div className="settings"><label>QUALITY<select value={settings.quality} onChange={e => setSettings(s => ({ ...s, quality: e.target.value as Settings['quality'] }))}><option value="standard">Standard</option><option value="low">Low</option></select></label><button aria-pressed={settings.sound} onClick={() => setSettings(s => ({ ...s, sound: !s.sound }))}>SOUND <span>{settings.sound ? 'ON' : 'OFF'}</span></button><button aria-pressed={settings.recoil} onClick={() => setSettings(s => ({ ...s, recoil: !s.recoil }))}>RECOIL <span>{settings.recoil ? 'ON' : 'OFF'}</span></button></div>
      </section>
      {!started && <aside className="scene-label"><span className="eyebrow">WELCOME TO THE AFTERLIGHT</span><span className="scene-rule" /><p>PROCEDURAL DISTRICTS<br />UNLIMITED POSSIBILITIES</p><strong>夜の街</strong></aside>}
      <div className="controls"><span className="eyebrow">THE BASICS</span>{touch ? <div><span><kbd>LEFT STICK</kbd> Move / sprint</span><span><kbd>RIGHT SWIPE</kbd> Aim</span><span><kbd>HOLD FIRE</kbd> Shoot / aim</span><span><kbd>BUTTONS</kbd> Jump / grenade</span></div> : <div><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Aim / fire</span><span><kbd>SHIFT</kbd> Sprint</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>G</kbd> Grenade</span><span><kbd>ESC</kbd> Pause</span></div>}</div>
    </div>}
    {menu && <footer><span><i /> BUILT FOR THE NIGHT</span><span>PERSONAL BEST <b>{String(best).padStart(3, '0')}</b></span><span className="footer-end">NO END. JUST ANOTHER BLOCK. <b>↗</b></span></footer>}
  </main>;
}
