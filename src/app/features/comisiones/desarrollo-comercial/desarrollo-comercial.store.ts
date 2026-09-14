// Estado de Desarrollo Comercial: carga perezosa por pestaña y mutaciones
// que recargan la entidad completa (mismo patrón que Parametrización).

import { Injectable, inject, signal } from '@angular/core';
import { ComisionesToast } from '../comisiones-toast.service';
import { DesarrolloComercialApi } from './desarrollo-comercial.api';
import { CalificacionAgenteRecord } from './desarrollo-comercial.domain';

export type DcSeccionId = 'clasificacionAgentes';

@Injectable()
export class DesarrolloComercialStore {
  private readonly api = inject(DesarrolloComercialApi);
  private readonly toast = inject(ComisionesToast);

  readonly calificaciones = signal<CalificacionAgenteRecord[]>([]);

  readonly loading = signal<Record<DcSeccionId, boolean>>({
    clasificacionAgentes: false,
  });

  readonly errorClasificacionAgentes = signal<string | null>(null);

  private marcar(seccion: DcSeccionId, valor: boolean): void {
    this.loading.update((prev) => ({ ...prev, [seccion]: valor }));
  }

  private async cargar<T>(
    seccion: DcSeccionId,
    traer: () => Promise<T[]>,
    destino: { set: (v: T[]) => void },
  ): Promise<void> {
    this.marcar(seccion, true);
    try {
      destino.set(await traer());
      if (seccion === 'clasificacionAgentes') this.errorClasificacionAgentes.set(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (seccion === 'clasificacionAgentes') this.errorClasificacionAgentes.set(msg);
      this.toast.errorGenerico('fetch', msg);
    } finally {
      this.marcar(seccion, false);
    }
  }

  cargarClasificacionAgentes(): Promise<void> {
    return this.cargar(
      'clasificacionAgentes',
      () => this.api.listCalificacionAgente(),
      this.calificaciones,
    );
  }

  cargarPestana(vista: string): void {
    if (vista === 'clasificacion_agentes') {
      void this.cargarClasificacionAgentes();
    }
  }

  private async mutar(
    accion: () => Promise<unknown>,
    recargar: () => Promise<void>,
    okTitulo: string,
    okDescripcion: string,
    tipo: 'create' | 'update' | 'delete' | 'toggle',
  ): Promise<boolean> {
    try {
      await accion();
      this.toast.ok(okTitulo, okDescripcion);
      await recargar();
      return true;
    } catch (e) {
      if (tipo === 'create' || tipo === 'update') {
        this.toast.errorMutacion(e, tipo);
      } else {
        this.toast.errorGenerico(tipo, e instanceof Error ? e.message : String(e));
      }
      return false;
    }
  }

  /** POST override al cambiar la clasificación desde el dropdown de la tabla. */
  overrideClasificacion(datos: Partial<CalificacionAgenteRecord>): Promise<boolean> {
    return this.mutar(
      () => this.api.createCalificacionAgenteOverride(datos),
      () => this.cargarClasificacionAgentes(),
      'Clasificación actualizada',
      'La clasificación del agente se actualizó correctamente.',
      'update',
    );
  }

  datos(seccion: DcSeccionId): Record<string, unknown>[] {
    switch (seccion) {
      case 'clasificacionAgentes':
        return this.calificaciones() as unknown as Record<string, unknown>[];
    }
  }
}
