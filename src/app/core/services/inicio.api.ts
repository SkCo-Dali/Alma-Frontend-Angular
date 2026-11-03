// Cliente del Inicio del hub (alma-backend /api/inicio/*): trabajo pendiente por
// App para las tarjetas «Tus aplicaciones». Solo trae las Apps con algo pendiente.

import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface Pendiente {
  n: number;
  /** Ya en singular o plural según n: «correos por validar». */
  texto: string;
}

/** Por slug de la App (el id del catálogo es `app-<slug>`). */
export type PendientesPorApp = Record<string, Pendiente>;

@Injectable({ providedIn: 'root' })
export class InicioApi {
  private readonly api = inject(ApiService);

  obtenerPendientes(): Promise<PendientesPorApp> {
    return this.api.fetch<PendientesPorApp>('/api/inicio/pendientes');
  }
}
