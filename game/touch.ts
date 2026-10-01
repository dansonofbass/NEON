export interface TouchTarget {
  touchMove(right: number, forward: number, sprint: boolean): void;
  touchLook(dx: number, dy: number): void;
  touchFire(held: boolean): void;
  touchAction(action: 'jump' | 'grenade'): void;
  clearTouchInput(): void;
}
type Control = 'move' | 'look' | 'fire' | 'jump' | 'grenade';
type Finger = { control: Control; x: number; y: number; centerX: number; centerY: number; radius: number; element: HTMLElement };

/** Pointer ownership keeps movement, aiming and fire independent under multitouch. */
export class TouchControls {
  private fingers = new Map<number, Finger>();
  private thumb: HTMLElement | null;
  constructor(private root: HTMLElement, private target: TouchTarget) {
    this.thumb = root.querySelector('[data-thumb]');
    root.addEventListener('pointerdown', this.down);
    root.addEventListener('pointermove', this.move);
    root.addEventListener('pointerup', this.up);
    root.addEventListener('pointercancel', this.up);
    root.addEventListener('lostpointercapture', this.up);
    window.addEventListener('blur', this.clear);
    window.addEventListener('resize', this.clear);
    document.addEventListener('visibilitychange', this.visibility);
  }
  private down = (event: PointerEvent) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-control]');
    if (!element || !this.root.contains(element) || event.button > 0) return;
    const control = element.dataset.control as Control;
    // One finger per control; spare contacts never replace the current owner.
    if ([...this.fingers.values()].some(f => f.control === control)) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const finger: Finger = { control, x: event.clientX, y: event.clientY, centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2, radius: rect.width * .34, element };
    this.fingers.set(event.pointerId, finger);
    this.root.setPointerCapture(event.pointerId);
    element.classList.add('pressed');
    if (control === 'move') this.joystick(finger, event);
    if (control === 'fire') this.target.touchFire(true);
    if (control === 'jump' || control === 'grenade') this.target.touchAction(control);
  };
  private move = (event: PointerEvent) => {
    const finger = this.fingers.get(event.pointerId); if (!finger) return;
    event.preventDefault();
    if (finger.control === 'move') this.joystick(finger, event);
    // Fire can also aim by dragging, for familiar two-thumb FPS control.
    if (finger.control === 'look' || finger.control === 'fire') this.target.touchLook(event.clientX - finger.x, event.clientY - finger.y);
    finger.x = event.clientX; finger.y = event.clientY;
  };
  private joystick(finger: Finger, event: PointerEvent) {
    let x = (event.clientX - finger.centerX) / finger.radius;
    let y = (event.clientY - finger.centerY) / finger.radius;
    const distance = Math.hypot(x, y);
    if (distance > 1) { x /= distance; y /= distance; }
    if (this.thumb) this.thumb.style.transform = `translate(${x * finger.radius}px, ${y * finger.radius}px)`;
    const amount = Math.min(1, Math.max(0, (distance - .12) / .88));
    const magnitude = Math.hypot(x, y) || 1;
    this.target.touchMove(x / magnitude * amount, -y / magnitude * amount, distance > .88 && -y > .45);
  }
  private up = (event: PointerEvent) => {
    const finger = this.fingers.get(event.pointerId); if (!finger) return;
    this.fingers.delete(event.pointerId); finger.element.classList.remove('pressed');
    if (this.root.hasPointerCapture(event.pointerId)) this.root.releasePointerCapture(event.pointerId);
    if (finger.control === 'move') { this.target.touchMove(0, 0, false); if (this.thumb) this.thumb.style.transform = ''; }
    if (finger.control === 'fire') this.target.touchFire(false);
  };
  private visibility = () => { if (document.hidden) this.clear(); };
  clear = () => {
    const fingers = [...this.fingers]; this.fingers.clear();
    for (const [id, finger] of fingers) {
      finger.element.classList.remove('pressed');
      if (this.root.hasPointerCapture(id)) this.root.releasePointerCapture(id);
    }
    if (this.thumb) this.thumb.style.transform = '';
    this.target.clearTouchInput();
  };
  dispose() {
    this.clear();
    this.root.removeEventListener('pointerdown', this.down);
    this.root.removeEventListener('pointermove', this.move);
    this.root.removeEventListener('pointerup', this.up);
    this.root.removeEventListener('pointercancel', this.up);
    this.root.removeEventListener('lostpointercapture', this.up);
    window.removeEventListener('blur', this.clear);
    window.removeEventListener('resize', this.clear);
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
