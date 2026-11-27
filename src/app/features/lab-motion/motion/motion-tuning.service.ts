// Estado del laboratorio de movimiento: los tres springs de Nova, ajustables en
// vivo. Expone las curvas como variables CSS (--spring-<nombre> y
// --spring-<nombre>-dur) para que las demos con transiciones CSS y las que usan
// WAAPI se muevan con la misma física.

import { Injectable, computed, signal } from '@angular/core';
import { SPRING_PRESETS, SpringName, SpringParams, springCurve } from './spring';

@Injectable()
export class MotionTuningService {
  readonly springs = signal<Record<SpringName, SpringParams>>(structuredClone(SPRING_PRESETS));

  /** Multiplicador global para ver el movimiento en cámara lenta. */
  readonly lentitud = signal(1);

  spring(nombre: SpringName): SpringParams {
    const s = this.springs()[nombre];
    const k = this.lentitud();
    return { response: s.response * k, bounce: s.bounce };
  }

  ajustar(nombre: SpringName, cambio: Partial<SpringParams>): void {
    this.springs.update((s) => ({ ...s, [nombre]: { ...s[nombre], ...cambio } }));
  }

  restablecer(): void {
    this.springs.set(structuredClone(SPRING_PRESETS));
    this.lentitud.set(1);
  }

  /** Variables CSS listas para bindear con [style] en la raíz del laboratorio. */
  readonly cssVars = computed(() => {
    this.springs();
    this.lentitud();
    const vars: Record<string, string> = {};
    for (const nombre of Object.keys(SPRING_PRESETS) as SpringName[]) {
      const c = springCurve(this.spring(nombre));
      vars[`--spring-${nombre}`] = c.easing;
      vars[`--spring-${nombre}-dur`] = `${c.duration}ms`;
    }
    return vars;
  });
}
