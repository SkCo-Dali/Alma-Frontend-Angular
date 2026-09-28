// Avisos estandarizados del módulo de comisiones (port de utils/customToast.ts):
// mensajes genéricos por acción, trato especial del 409 (duplicado) y, cuando el
// backend explica por qué rechazó algo (4xx), ese motivo en lugar del genérico.

import { Injectable, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import {
  CONFLICT_TOAST_DESCRIPTION,
  MENSAJES_ERROR,
  isApiConflictError,
  motivoDeError,
} from './api-error';

export type AccionMutacion = 'create' | 'update' | 'delete' | 'fetch' | 'toggle';

const TITULOS_MOTIVO: Record<AccionMutacion, string> = {
  create: 'No se pudo guardar',
  update: 'No se pudo guardar',
  delete: 'No se pudo eliminar',
  toggle: 'No se pudo cambiar el estado',
  fetch: 'No se pudo cargar',
};

@Injectable({ providedIn: 'root' })
export class ComisionesToast {
  private readonly toast = inject(ToastService);

  ok(title: string, description?: string): void {
    this.toast.show(title, description);
  }

  /**
   * Error por acción: si el backend dio un motivo (4xx) se muestra; si no, el
   * mensaje genérico. El detalle técnico solo va a consola.
   */
  errorGenerico(accion: AccionMutacion, detalle?: unknown): void {
    console.error(`[Comisiones] error en ${accion}:`, detalle);
    const motivo = motivoDeError(detalle);
    if (motivo) {
      this.toast.error(TITULOS_MOTIVO[accion], motivo);
      return;
    }
    this.toast.error('Error', MENSAJES_ERROR[accion]);
  }

  /** Error con un mensaje propio (permiso, estado inválido, no encontrado…). */
  errorGenericoConMensaje(mensaje: string, titulo = 'Error'): void {
    this.toast.error(titulo, mensaje);
  }

  duplicado(): void {
    this.toast.error('Registro duplicado', CONFLICT_TOAST_DESCRIPTION);
  }

  /**
   * Muestra el motivo del backend si lo hay; si no, el aviso de duplicado en
   * 409 y el genérico en el resto.
   * @returns true cuando el error era un 409 (aviso ya mostrado).
   */
  errorMutacion(error: unknown, accion: 'create' | 'update'): boolean {
    if (motivoDeError(error)) {
      this.errorGenerico(accion, error);
      return isApiConflictError(error);
    }
    if (isApiConflictError(error)) {
      this.duplicado();
      return true;
    }
    this.errorGenerico(accion, error);
    return false;
  }
}
