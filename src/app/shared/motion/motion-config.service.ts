// Movimiento de Nova para TODA la app.
//
// Define en <html> las variables --spring-snappy, --spring-smooth y
// --spring-bouncy (con su -dur), que cualquier componente puede usar:
//
//   transition: transform var(--spring-smooth-dur) var(--spring-smooth);
//
// Arranca con los valores de fábrica (spring.ts) y, al iniciar sesión, los
// reemplaza por los publicados desde /lab/motion (GET /api/plataforma/movimiento).
// Si el backend no responde, se quedan los de fábrica: una animación nunca
// bloquea la carga.

import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/services/api.service';
import { SPRING_PRESETS, SpringSet, springCssVars } from './spring';

export const PERM_MOTION_EDIT = 'platform.motion.edit';

export interface MovimientoPublicado {
  springs: SpringSet;
  /** null = valores de fábrica (nadie ha publicado). */
  actualizadoPor: string | null;
  actualizadoEn: string | null;
}

interface MovimientoApi {
  springs: SpringSet | null;
  actualizadoPor: string | null;
  actualizadoEn: string | null;
}

const FABRICA: MovimientoPublicado = {
  springs: structuredClone(SPRING_PRESETS),
  actualizadoPor: null,
  actualizadoEn: null,
};

@Injectable({ providedIn: 'root' })
export class MotionConfigService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly publicado = signal<MovimientoPublicado>(structuredClone(FABRICA));
  readonly puedeEditar = computed(() => {
    this.auth.user();
    return this.auth.hasPermission(PERM_MOTION_EDIT);
  });

  constructor() {
    this.aplicar(this.publicado().springs);
  }

  fabrica(): SpringSet {
    return structuredClone(SPRING_PRESETS);
  }

  async cargar(): Promise<void> {
    try {
      const r = await this.api.fetch<MovimientoApi>('/api/plataforma/movimiento');
      if (r?.springs) this.establecer(r);
    } catch {
      /* sin backend: siguen los valores de fábrica */
    }
  }

  /** Publica para todos los usuarios (requiere platform.motion.edit). */
  async publicar(springs: SpringSet): Promise<void> {
    const r = await this.api.fetch<MovimientoApi>('/api/plataforma/movimiento', {
      method: 'PUT',
      body: JSON.stringify({ springs: redondear(springs) }),
    });
    this.establecer(r?.springs ? r : { ...r, springs: redondear(springs) });
  }

  /** Escribe las variables en <html>. El laboratorio lo usa para previsualizar. */
  aplicar(springs: SpringSet, lentitud = 1): void {
    const raiz = document.documentElement;
    for (const [k, v] of Object.entries(springCssVars(springs, lentitud))) {
      raiz.style.setProperty(k, v);
    }
  }

  /** Vuelve a dejar en <html> lo publicado (al salir del laboratorio). */
  restaurar(): void {
    this.aplicar(this.publicado().springs);
  }

  private establecer(r: MovimientoApi): void {
    this.publicado.set({
      springs: { ...structuredClone(SPRING_PRESETS), ...r.springs! },
      actualizadoPor: r.actualizadoPor,
      actualizadoEn: r.actualizadoEn,
    });
    this.restaurar();
  }
}

function redondear(springs: SpringSet): SpringSet {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const out = {} as SpringSet;
  for (const [k, s] of Object.entries(springs) as [keyof SpringSet, SpringSet[keyof SpringSet]][]) {
    out[k] = { response: r2(s.response), bounce: r2(s.bounce) };
  }
  return out;
}
