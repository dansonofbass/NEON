'use client';
import { useEffect, useRef } from 'react';
import type { Engine } from '../../game/engine';
import { TouchControls } from '../../game/touch';

export default function MobileControls({ engine }: { engine: Engine }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const controls = new TouchControls(root.current, engine);
    return () => controls.dispose();
  }, [engine]);
  return <div className="touch-controls" ref={root} aria-label="Touch game controls">
    <div className="touch-look" data-control="look" aria-label="Drag to aim"><span>DRAG TO LOOK</span></div>
    <div className="touch-stick" data-control="move" role="group" aria-label="Movement joystick; push forward to the edge to sprint">
      <span className="stick-sprint">SPRINT ↑</span><div className="stick-ring" /><div className="stick-thumb" data-thumb><i /></div><span className="stick-label">MOVE</span>
    </div>
    <button className="touch-button touch-fire" data-control="fire" aria-label="Hold to fire; drag to aim"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="9"/><path d="M16 2v8m0 12v8M2 16h8m12 0h8"/><circle cx="16" cy="16" r="2"/></svg><span>FIRE</span></button>
    <button className="touch-button touch-jump" data-control="jump" aria-label="Jump"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m8 17 8-9 8 9M16 8v19M7 4h18"/></svg><span>JUMP</span></button>
    <button className="touch-button touch-grenade" data-control="grenade" aria-label="Throw grenade"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 10V5h8l4 7M12 6H9"/><ellipse cx="16" cy="21" rx="8" ry="9"/><path d="M10 18h12m-12 6h12M16 12v17"/></svg><span>GRENADE</span></button>
    <button className="touch-pause" onClick={() => engine.pause()} aria-label="Pause game">Ⅱ</button>
    <div className="rotate-hint">↻ LANDSCAPE RECOMMENDED</div>
  </div>;
}
