// Pila de nova-dialogs abiertos.
//
// - Profundidad: con el primer diálogo, la app ([data-nova-fondo], el shell en
//   app.component) se hunde (escala + esquinas redondeadas); con el último que
//   se cierra, vuelve. Los diálogos viven en <body>, fuera del fondo, así que el
//   transform no los atrapa.
// - `inert` en el fondo mientras haya diálogos: el foco y los clics no se
//   escapan a la página de atrás.
// - Solo el diálogo de ARRIBA responde a Esc.

import { Injectable } from '@angular/core';
import { SpringParams, animateSpring } from '../../motion/spring';

export type Profundidad = 'dialog' | 'sheet' | 'side';

const HUNDIDO: Record<Profundidad, { escala: number; y: number; radio: number }> = {
  dialog: { escala: 0.97, y: 0, radio: 14 },
  sheet: { escala: 0.94, y: 10, radio: 18 },
  side: { escala: 0.97, y: 0, radio: 14 },
};

@Injectable({ providedIn: 'root' })
export class NovaDialogStack {
  private readonly pila: object[] = [];
  private profundidad: Profundidad = 'dialog';

  entrar(id: object, profundidad: Profundidad, spring: SpringParams): void {
    if (this.pila.includes(id)) return;
    this.pila.push(id);
    if (this.pila.length !== 1) return;
    this.profundidad = profundidad;
    const f = this.fondo();
    if (!f) return;
    const r = f.getBoundingClientRect();
    f.style.transformOrigin = `50% ${innerHeight / 2 - r.top}px`;
    f.style.overflow = 'clip';
    f.inert = true;
    animateSpring(f, [this.keyframe(1)], { ...spring, bounce: 0 });
  }

  salir(id: object, spring: SpringParams, velocidad = 0): void {
    const i = this.pila.indexOf(id);
    if (i < 0) return;
    this.pila.splice(i, 1);
    if (this.pila.length) return;
    const f = this.fondo();
    if (!f) return;
    f.inert = false;
    const anim = animateSpring(f, [this.keyframe(0)], { ...spring, bounce: 0 }, { velocity: velocidad });
    anim.finished
      .then(() => {
        if (this.pila.length) return; // se abrió otro mientras volvía
        // Sin transform residual: aunque sea scale(1), convertiría al fondo en
        // contenedor de los position: fixed de la app.
        f.style.transform = '';
        f.style.borderRadius = '';
        f.style.overflow = '';
        f.style.transformOrigin = '';
      })
      .catch(() => {});
  }

  /** Progreso 0 (reposo) … 1 (hundido) sin animar, mientras se arrastra un sheet. */
  seguirGesto(id: object, p: number): void {
    if (this.pila.length !== 1 || this.pila[0] !== id) return;
    const f = this.fondo();
    if (!f) return;
    f.getAnimations().forEach((a) => a.cancel());
    const k = this.keyframe(p);
    f.style.transform = k['transform'] as string;
    f.style.borderRadius = k['borderRadius'] as string;
  }

  /** Tras un arrastre que no cerró: el fondo vuelve a hundirse. */
  entrarDeNuevo(id: object, spring: SpringParams): void {
    if (this.pila.length !== 1 || this.pila[0] !== id) return;
    const f = this.fondo();
    if (f) animateSpring(f, [this.keyframe(1)], { ...spring, bounce: 0 });
  }

  esTope(id: object): boolean {
    return this.pila[this.pila.length - 1] === id;
  }

  private keyframe(p: number): Keyframe {
    const h = HUNDIDO[this.profundidad];
    return {
      transform: `translateY(${h.y * p}px) scale(${1 - (1 - h.escala) * p})`,
      borderRadius: `${h.radio * p}px`,
    };
  }

  private fondo(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-nova-fondo]');
  }
}
