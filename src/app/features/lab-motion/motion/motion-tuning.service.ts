// Borrador del laboratorio de movimiento.
//
// Parte de lo PUBLICADO (MotionConfigService) y se ajusta en vivo. Mientras el
// laboratorio está abierto, el borrador se aplica a <html> para previsualizar
// (solo en esta pestaña); al salir se restaura lo publicado. «Publicar» lo
// guarda en el backend y aplica a todos los usuarios.

import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import {
  MotionConfigService,
  MovimientoPublicado,
} from '../../../shared/motion/motion-config.service';
import {
  SpringName,
  SpringParams,
  SpringSet,
  springCssVars,
} from '../../../shared/motion/spring';

@Injectable()
export class MotionTuningService {
  private readonly config = inject(MotionConfigService);

  // linkedSignal: si lo publicado llega (o cambia) con el laboratorio abierto
  // —p. ej. entrando directo por URL antes de que responda el GET—, el
  // borrador toma esos valores… salvo que ya tenga cambios propios: un GET
  // tardío no debe borrar lo que el usuario está ajustando.
  readonly springs = linkedSignal<MovimientoPublicado, SpringSet>({
    source: this.config.publicado,
    computation: (pub, previo) =>
      previo && !iguales(previo.value, previo.source.springs)
        ? previo.value
        : structuredClone(pub.springs),
  });

  /** Multiplicador para ver el movimiento en cámara lenta (no se publica). */
  readonly lentitud = signal(1);

  readonly publicado = this.config.publicado;
  readonly puedePublicar = this.config.puedeEditar;
  readonly publicando = signal(false);

  /** true si el borrador difiere de lo publicado. */
  readonly hayCambios = computed(() => !iguales(this.springs(), this.publicado().springs));
  /** true si el borrador difiere de los valores de fábrica. */
  readonly distintoDeFabrica = computed(() => !iguales(this.springs(), this.config.fabrica()));

  /** Spring efectivo (con cámara lenta) para animaciones WAAPI. */
  spring(nombre: SpringName): SpringParams {
    const s = this.springs()[nombre];
    return { response: s.response * this.lentitud(), bounce: s.bounce };
  }

  ajustar(nombre: SpringName, cambio: Partial<SpringParams>): void {
    this.springs.update((s) => ({ ...s, [nombre]: { ...s[nombre], ...cambio } }));
  }

  /** Descarta el borrador y vuelve a lo publicado. */
  volverAPublicado(): void {
    this.springs.set(structuredClone(this.publicado().springs));
    this.lentitud.set(1);
  }

  /** Carga en el borrador los valores de fábrica (no publica). */
  valoresDeFabrica(): void {
    this.springs.set(this.config.fabrica());
  }

  async publicar(): Promise<void> {
    this.publicando.set(true);
    try {
      await this.config.publicar(this.springs());
    } finally {
      this.publicando.set(false);
    }
  }

  /** Variables CSS del borrador, para la previsualización. */
  readonly cssVars = computed(() => springCssVars(this.springs(), this.lentitud()));
}

function iguales(a: SpringSet, b: SpringSet): boolean {
  const r = (n: number) => Math.round(n * 100);
  return (Object.keys(a) as SpringName[]).every(
    (k) => r(a[k].response) === r(b[k].response) && r(a[k].bounce) === r(b[k].bounce),
  );
}
