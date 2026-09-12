// Fuente de datos del Visor de comunicaciones. Consulta el backend real de Alma,
// que a su vez lee del Cosmos DB de Communication Services:
//   GET /api/comunicaciones?q=&campana=&desde=&hasta=&limit=&cursor=
//        -> { data: ComunicacionRef[], next: number|null }   (cursor = offset)
//   GET /api/comunicaciones/{id}/eml    -> bytes del .eml
//   GET /api/comunicaciones/{id}/traza  -> { data: EventoTraza[] }  (entrega/engagement)

import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { COMUNICACIONES_MOCK, ComunicacionRef } from './comunicaciones.mock';

const API_BASE = environment.apiUrl.replace(/\/+$/, '');

/** Un evento de la traza de un envío (entrega o engagement de ACS). */
export interface EventoTraza {
  tipo: string; // "Entrega" | "Engagement" | ...
  estado: string; // Delivered/Bounced/... | click/view
  fecha: string | null;
  destinatario?: string | null;
  contexto?: string | null;
  userAgent?: string | null;
  detalle?: string | null;
}

export interface BusquedaEnvios {
  q?: string;
  campana?: string;
  desde?: string;
  hasta?: string;
}

@Injectable({ providedIn: 'root' })
export class ComunicacionesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** ⚙️ true = datos de ejemplo locales; false = backend real. */
  private readonly usarMock = false;

  /**
   * Busca envíos (Cosmos `send-mail`) filtrando en SERVIDOR por texto
   * (correo/asunto), campaña y rango de fechas. Sigue `next` acumulando páginas
   * hasta un tope de seguridad; `onProgreso` recibe el parcial tras cada página
   * para pintar apenas llega la primera.
   */
  async buscar(
    opts: BusquedaEnvios = {},
    onProgreso?: (parcial: ComunicacionRef[]) => void,
  ): Promise<ComunicacionRef[]> {
    if (this.usarMock) return COMUNICACIONES_MOCK;
    const LIMITE_POR_PAGINA = 200;
    const MAX_PAGINAS = 25; // tope ~5.000; una consulta por cliente trae pocos
    const acumulado: ComunicacionRef[] = [];
    let cursor: number | null = null;
    for (let i = 0; i < MAX_PAGINAS; i++) {
      const qs = new URLSearchParams({ limit: String(LIMITE_POR_PAGINA) });
      if (opts.q) qs.set('q', opts.q);
      if (opts.campana) qs.set('campana', opts.campana);
      if (opts.desde) qs.set('desde', opts.desde);
      if (opts.hasta) qs.set('hasta', opts.hasta);
      if (cursor != null) qs.set('cursor', String(cursor));
      const r = await this.api.fetch<{ data: ComunicacionRef[]; next: number | null }>(
        `/api/comunicaciones?${qs.toString()}`,
      );
      acumulado.push(...r.data);
      onProgreso?.(acumulado.slice());
      cursor = r.next;
      if (cursor == null) break;
    }
    return acumulado;
  }

  /** Traza de entrega/engagement de un envío (por su id = messageId). */
  async traza(id: string): Promise<EventoTraza[]> {
    if (this.usarMock) return [];
    const r = await this.api.fetch<{ data: EventoTraza[] }>(
      `/api/comunicaciones/${encodeURIComponent(id)}/traza`,
    );
    return r.data;
  }

  /** Bytes del .eml de una comunicación (para parsear/render en el visor). */
  async obtenerEml(ref: ComunicacionRef): Promise<ArrayBuffer> {
    if (this.usarMock) {
      const resp = await fetch(ref.archivo);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} al descargar el correo`);
      return resp.arrayBuffer();
    }
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
