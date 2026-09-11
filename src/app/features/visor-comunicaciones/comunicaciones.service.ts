// Fuente de datos de las comunicaciones. Conectado al backend real de Alma
// (alma-backend: app/api/Comunicaciones). La UI (bandeja + visor) NO cambia:
// consume este servicio. Poner `usarMock = true` para volver a los datos de
// ejemplo locales (sin backend).
//
// Contrato backend (FastAPI):
//   GET /api/comunicaciones?limit=&cursor=  -> { data: ComunicacionRef[], next: string|null }
//   GET /api/comunicaciones/{id}/eml        -> bytes del .eml (autenticado con token de Alma)

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

  /** ⚙️ true = datos de ejemplo locales; false = backend real (/api/comunicaciones). */
  private readonly usarMock = false;

  /**
   * Índice de comunicaciones (metadatos + puntero al .eml).
   *
   * `onProgreso` (opcional) recibe el acumulado tras CADA página. La bandeja lo
   * usa para pintar apenas llega la primera página y no dejar al usuario en
   * "cargando" mientras llegan miles de correos (render progresivo); el resto se
   * sigue acumulando en background. Sin callback, se comporta como antes.
   */
  async listar(onProgreso?: (parcial: ComunicacionRef[]) => void): Promise<ComunicacionRef[]> {
    if (this.usarMock) return COMUNICACIONES_MOCK;
    // La bandeja filtra/ordena 100% en cliente, así que traemos TODAS las
    // páginas siguiendo `next`. Tope de seguridad para no pedir sin límite
    // (200/pág × 50 = 10k comunicaciones); si se rebasa, la UI muestra las
    // primeras y habría que migrar a filtrado/paginación en servidor.
    const LIMITE_POR_PAGINA = 200; // máximo que acepta el backend
    const MAX_PAGINAS = 50;
    const acumulado: ComunicacionRef[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < MAX_PAGINAS; i++) {
      const qs = new URLSearchParams({ limit: String(LIMITE_POR_PAGINA) });
      if (cursor) qs.set('cursor', cursor);
      const r = await this.api.fetch<{ data: ComunicacionRef[]; next: string | null }>(
        `/api/comunicaciones?${qs.toString()}`,
      );
      acumulado.push(...r.data);
      onProgreso?.(acumulado.slice()); // copia: nueva referencia para disparar el signal
      cursor = r.next;
      if (!cursor) break;
    }
    return acumulado;
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
