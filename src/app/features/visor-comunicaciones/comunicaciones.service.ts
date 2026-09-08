// Fuente de datos de las comunicaciones. Hoy devuelve el MOCK del índice; cuando el
// backend esté desplegado se pone `usarMock = false` y ya queda conectado al contrato
// real (ver docs/backend/). La UI (bandeja + visor) NO cambia: consume este servicio.
//
// Contrato backend (FastAPI, docs/backend/comunicaciones.py):
//   GET /api/comunicaciones            -> { data: ComunicacionRef[], next: string|null }
//   GET /api/comunicaciones/{id}/eml   -> bytes del .eml (autenticado con token de Alma)

import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { COMUNICACIONES_MOCK, ComunicacionRef } from './comunicaciones.mock';

const API_BASE = environment.apiUrl.replace(/\/+$/, '');

@Injectable({ providedIn: 'root' })
export class ComunicacionesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** ⚙️ Cambiar a false cuando el backend de comunicaciones esté disponible. */
  private readonly usarMock = true;

  /** Índice de comunicaciones (metadatos + puntero al .eml). */
  async listar(): Promise<ComunicacionRef[]> {
    if (this.usarMock) return COMUNICACIONES_MOCK;
    // TODO(paginación): usar `next` para páginas siguientes cuando haya volumen.
    const r = await this.api.fetch<{ data: ComunicacionRef[]; next: string | null }>(
      '/api/comunicaciones',
    );
    return r.data;
  }

  /** Bytes del .eml de una comunicación (para parsear/render en el visor). */
  async obtenerEml(ref: ComunicacionRef): Promise<ArrayBuffer> {
    if (this.usarMock) {
      // Mock servido en la raíz de la app (/mock-eml/...): sin token.
      const resp = await fetch(ref.archivo);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} al descargar el correo`);
      return resp.arrayBuffer();
    }

    // `ref.archivo` es una ruta del API (/api/comunicaciones/{id}/eml) que exige el
    // token de Alma. (Si migran a SAS de Azure, `archivo` sería una URL absoluta y
    // aquí bastaría un fetch directo sin Authorization — ver docs/backend/README.)
    const url = ref.archivo.startsWith('http') ? ref.archivo : `${API_BASE}${ref.archivo}`;
    const headers: Record<string, string> = {};
    if (!ref.archivo.startsWith('http')) {
      const token = await this.auth.getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} al descargar el correo`);
    return resp.arrayBuffer();
  }
}
