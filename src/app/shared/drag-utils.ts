// Utilidades de arrastre del Dock/Launchpad (port de lib/dragImage.ts y
// lib/useTouchDrag.ts del front React — lógica framework-agnóstica).

/**
 * Fija una imagen de arrastre propia a partir de un CLON del elemento: la
 * imagen por defecto se dibuja semitransparente y, con transforms de la
 * magnificación, Chrome la captura EN BLANCO.
 */
export function setCloneDragImage(e: DragEvent, node: HTMLElement): void {
  if (!e.dataTransfer) return;
  const rect = node.getBoundingClientRect();
  const clone = node.cloneNode(true) as HTMLElement;

  const deAlpha = (el: HTMLElement) => {
    el.style.transform = 'none';
    const bg = el.style.background || el.style.backgroundImage;
    if (bg && bg.includes('gradient')) {
      const m = bg.match(/#[0-9a-fA-F]{6,8}|rgba?\([^)]+\)/);
      if (m) {
        el.style.backgroundColor = m[0].length === 9 ? m[0].slice(0, 7) : m[0];
      }
    }
  };
  clone.style.transform = 'none';
  deAlpha(clone);
  clone.querySelectorAll<HTMLElement>('*').forEach(deAlpha);

  Object.assign(clone.style, {
    position: 'absolute',
    top: '-9999px',
    left: '0px',
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    opacity: '1',
    pointerEvents: 'none',
  });

  document.body.appendChild(clone);
  e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top);
  setTimeout(() => clone.remove(), 0);
}

interface TouchDragOpts {
  onStart: (id: string) => void;
  onOver: (overId: string, after: boolean) => void;
  onEnd: (x: number, y: number) => void;
  longPressMs?: number;
}

/**
 * Arrastre por TÁCTIL (HTML5 drag-and-drop no funciona en pantallas táctiles).
 * Se activa con pulsación sostenida; un CLON sigue al dedo y el ícono debajo se
 * detecta con elementFromPoint por su [data-drag-id].
 */
export class TouchDrag {
  private s: {
    id: string;
    node: HTMLElement;
    clone?: HTMLElement;
    active: boolean;
    timer: number;
    ox: number;
    oy: number;
    x: number;
    y: number;
    move: (e: TouchEvent) => void;
    end: () => void;
  } | null = null;

  constructor(private readonly opts: TouchDragOpts) {}

  private place(x: number, y: number): void {
    const st = this.s;
    if (!st?.clone) return;
    st.clone.style.transform = `translate(${x - st.ox}px, ${y - st.oy}px) scale(1.1)`;
  }

  private cleanup(): void {
    const st = this.s;
    if (!st) return;
    clearTimeout(st.timer);
    st.clone?.remove();
    window.removeEventListener('touchmove', st.move);
    window.removeEventListener('touchend', st.end);
    window.removeEventListener('touchcancel', st.end);
    this.s = null;
  }

  private activate(): void {
    const st = this.s;
    if (!st) return;
    st.active = true;
    const r = st.node.getBoundingClientRect();
    const clone = st.node.cloneNode(true) as HTMLElement;
    Object.assign(clone.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: `${r.width}px`,
      height: `${r.height}px`,
      margin: '0',
      pointerEvents: 'none',
      zIndex: '9999',
      opacity: '0.92',
      transition: 'none',
    });
    document.body.appendChild(clone);
    st.clone = clone;
    this.place(st.x, st.y);
    if (navigator.vibrate) navigator.vibrate(10);
    this.opts.onStart(st.id);
  }

  begin(e: TouchEvent, id: string): void {
    if (this.s) this.cleanup();
    const t = e.touches[0];
    const node = e.currentTarget as HTMLElement;
    const r = node.getBoundingClientRect();

    const move = (ev: TouchEvent) => {
      const st = this.s;
      if (!st) return;
      const p = ev.touches[0];
      if (!p) return;
      if (!st.active) {
        if (Math.hypot(p.clientX - st.x, p.clientY - st.y) > 12) this.cleanup();
        return;
      }
      ev.preventDefault();
      st.x = p.clientX;
      st.y = p.clientY;
      this.place(p.clientX, p.clientY);
      if (st.clone) st.clone.style.visibility = 'hidden';
      const under = document.elementFromPoint(p.clientX, p.clientY);
      if (st.clone) st.clone.style.visibility = 'visible';
      const tile = under?.closest?.('[data-drag-id]') as HTMLElement | null;
      const overId = tile?.getAttribute('data-drag-id');
      if (overId && overId !== st.id) {
        const tr = tile!.getBoundingClientRect();
        this.opts.onOver(overId, p.clientX > tr.left + tr.width / 2);
      }
    };
    const end = () => {
      const st = this.s;
      if (!st) return;
      const wasActive = st.active;
      const x = st.x;
      const y = st.y;
      this.cleanup();
      if (wasActive) this.opts.onEnd(x, y);
    };

    this.s = {
      id,
      node,
      active: false,
      timer: window.setTimeout(() => this.activate(), this.opts.longPressMs ?? 200),
      ox: t.clientX - r.left,
      oy: t.clientY - r.top,
      x: t.clientX,
      y: t.clientY,
      move,
      end,
    };
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
  }
}
