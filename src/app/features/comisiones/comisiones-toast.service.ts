// Avisos estandarizados del módulo de comisiones (port de utils/customToast.ts):
// mensajes genéricos por acción y trato especial del 409 (duplicado).

import { Injectable, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import {
  CONFLICT_TOAST_DESCRIPTION,
  MENSAJES_ERROR,
  isApiConflictError,
} from './api-error';

export type AccionMutacion = 'create' | 'update' | 'delete' | 'fetch' | 'toggle';

@Injectable({ providedIn: 'root' })
export class ComisionesToast {
  private readonly toast = inject(ToastService);

  ok(title: string, description?: string): void {
    this.toast.show(title, description);
  }

  /** Error genérico por acción; el detalle técnico solo va a consola. */
  errorGenerico(accion: AccionMutacion, detalle?: string): void {
    console.error(`[Comisiones] error en ${accion}:`, detalle);
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
   * Muestra el aviso de duplicado en 409 y el genérico en el resto.
   * @returns true cuando el error era un 409 (aviso ya mostrado).
   */
  errorMutacion(error: unknown, accion: 'create' | 'update'): boolean {
    if (isApiConflictError(error)) {
      this.duplicado();
      return true;
    }
    this.errorGenerico(accion, error instanceof Error ? error.message : String(error));
    return false;
  }
}
