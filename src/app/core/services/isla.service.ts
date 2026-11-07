// Isla de Nova (estilo Dynamic Island): una sola pastilla en el centro del header
// que muestra lo que sigue pasando mientras el usuario navega.
//
// - Actividades: procesos largos (p. ej. la ejecución del Motor de Comisiones).
//   Se quedan visibles en cualquier pantalla hasta que la App las termina.
// - Avisos: mensajes breves (los antiguos toasts). Se muestran de a uno, en cola,
//   y la isla vuelve a su estado anterior al cerrarse cada uno.
//
// Las Apps solo reportan; la isla decide qué mostrar: aviso > actividades > reposo.

import { Injectable, computed, signal } from '@angular/core';

export interface ActividadIsla {
  /** Único por proceso; reportar el mismo id actualiza la actividad. */
  id: string;
  titulo: string;
  /** Línea corta de estado: «Ejecutando · 3m 12s». */
  detalle?: string;
  /** 0–100; null = sin porcentaje (se muestra como progreso indeterminado). */
  progreso?: number | null;
  /** Ícono lucide. */
  icono: string;
  /** Pantalla donde vive el proceso («Ver» en la isla expandida). */
  ruta?: string;
  /** Acción secundaria opcional en la isla expandida (p. ej. Cancelar). */
  accion?: { etiqueta: string; ejecutar: () => void };
  inicio: number;
}

export type TonoAviso = 'info' | 'ok' | 'error';

export interface AvisoIsla {
  id: number;
  titulo: string;
  detalle?: string;
  tono: TonoAviso;
}

const DURACION_MS: Record<TonoAviso, number> = { info: 4000, ok: 4000, error: 6500 };
/** Con varios avisos en cola se acortan para no quedar mostrando mensajes viejos. */
const DURACION_COLA_MS = 2500;
const COLA_LARGA = 3;

@Injectable({ providedIn: 'root' })
export class IslaService {
  readonly actividades = signal<ActividadIsla[]>([]);
  readonly aviso = signal<AvisoIsla | null>(null);
  readonly expandida = signal(false);

  /** Lo que la pastilla muestra ahora mismo. */
  readonly modo = computed<'aviso' | 'expandida' | 'actividad' | 'reposo'>(() => {
    if (this.aviso()) return 'aviso';
    if (this.actividades().length === 0) return 'reposo';
    return this.expandida() ? 'expandida' : 'actividad';
  });

  private cola: AvisoIsla[] = [];
  private seq = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  // ── Actividades ─────────────────────────────────────────────────────────

  /** Crea o actualiza una actividad (idempotente por id). */
  reportar(actividad: Omit<ActividadIsla, 'inicio'> & { inicio?: number }): void {
    this.actividades.update((lista) => {
      const i = lista.findIndex((a) => a.id === actividad.id);
      if (i < 0) return [...lista, { ...actividad, inicio: actividad.inicio ?? Date.now() }];
      const copia = [...lista];
      copia[i] = { ...copia[i], ...actividad, inicio: copia[i].inicio };
      return copia;
    });
  }

  terminar(id: string): void {
    this.actividades.update((lista) => lista.filter((a) => a.id !== id));
    if (this.actividades().length === 0) this.expandida.set(false);
  }

  // ── Avisos ──────────────────────────────────────────────────────────────

  avisar(titulo: string, detalle?: string, tono: TonoAviso = 'info'): void {
    this.cola.push({ id: ++this.seq, titulo, detalle, tono });
    if (!this.aviso()) this.siguienteAviso();
  }

  /** Cierra el aviso visible (clic sobre la isla) y pasa al siguiente. */
  cerrarAviso(): void {
    this.siguienteAviso();
  }

  private siguienteAviso(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    const proximo = this.cola.shift() ?? null;
    this.aviso.set(proximo);
    if (!proximo) return;
    const ms = this.cola.length >= COLA_LARGA ? DURACION_COLA_MS : DURACION_MS[proximo.tono];
    this.temporizador = setTimeout(() => this.siguienteAviso(), ms);
  }

  // ── Expandir ────────────────────────────────────────────────────────────

  alternar(): void {
    if (this.aviso()) {
      this.cerrarAviso();
      return;
    }
    if (this.actividades().length > 0) this.expandida.update((v) => !v);
  }

  cerrar(): void {
    this.expandida.set(false);
  }
}
