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

  /** POST override (con motivo) al confirmar el cambio de clasificación. */
  async overrideClasificacion(datos: Partial<CalificacionAgenteRecord>): Promise<boolean> {
    try {
      const res = await this.api.createCalificacionAgenteOverride(datos);
      if (res?.aplicado === false) {
        this.toast.ok('Cambio guardado', 'Se aplicará en la próxima ingesta.');
      } else {
        this.toast.ok('Clasificación actualizada', 'La clasificación del agente se actualizó.');
      }
      await this.cargarClasificacionAgentes();
      return true;
    } catch (e) {
      this.toast.errorMutacion(e, 'update');
      return false;
    }
  }

  datos(seccion: DcSeccionId): Record<string, unknown>[] {
    switch (seccion) {
      case 'clasificacionAgentes':
        return this.calificaciones() as unknown as Record<string, unknown>[];
    }
  }
}
