// Administración de campañas del Visor de comunicaciones (qué carpetas del storage
// se indexan). Consume los endpoints admin del backend (gateados por
// app.visor-comunicaciones.admin). Ver alma-backend/app/api/Comunicaciones.

import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

export interface CampanaConfig {
  clave: string;
  nombre: string;
  tipo: string;
  activa: boolean;
  totalIndexados: number;
  ultimoSync: string | null;
}

export interface CampanaDisponible {
  clave: string;
  configurada: boolean;
}

export interface ReindexResumen {
  campana: string;
  blobsTotal: number;
  nuevos: number;
  insertados: number;
}

@Injectable({ providedIn: 'root' })
export class CampanasService {
  private readonly api = inject(ApiService);

  /** Campañas configuradas con su estado de indexación. */
  async listar(): Promise<CampanaConfig[]> {
    const r = await this.api.fetch<{ data: CampanaConfig[] }>('/api/comunicaciones/campanas');
    return r.data;
  }

  /** Carpetas presentes en el storage (con flag de si ya están configuradas). */
  async disponibles(): Promise<CampanaDisponible[]> {
    const r = await this.api.fetch<{ data: CampanaDisponible[] }>(
      '/api/comunicaciones/campanas/disponibles',
    );
    return r.data;
  }

  /** Crea o edita una campaña (upsert por clave). */
  async guardar(body: { clave: string; nombre: string; tipo: string; activa: boolean }): Promise<void> {
    await this.api.fetch('/api/comunicaciones/campanas', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** Activa/desactiva una campaña. */
  async setActiva(clave: string, activa: boolean): Promise<void> {
    await this.api.fetch(`/api/comunicaciones/campanas/${encodeURIComponent(clave)}`, {
      method: 'PATCH',
      body: JSON.stringify({ activa }),
    });
  }

  /** Fuerza la indexación de una campaña (sin esperar el tick del worker). */
  async reindexar(clave: string): Promise<ReindexResumen> {
    const r = await this.api.fetch<{ ok: boolean; resumen: ReindexResumen }>(
      `/api/comunicaciones/campanas/${encodeURIComponent(clave)}/reindexar`,
      { method: 'POST' },
    );
    return r.resumen;
  }
}
