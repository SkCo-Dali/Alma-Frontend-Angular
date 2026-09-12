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
  campanas?: string[];
  desde?: string;
  hasta?: string;
}

/** Indicadores del conjunto filtrado. `aperturas`/`clics` van en null cuando el
 *  conjunto excede `topeEngagement` (ver backend: el cruce por messageId no escala). */
export interface KpisEnvios {
  envios: number;
  exitosos: number;
  fallidos: number;
  aperturas: number | null;
  clics: number | null;
  engagementParcial: boolean;
  topeEngagement: number;
}

/** Valores para los desplegables de filtros (toda la base). */
export interface OpcionesFiltros {
  campanas: string[];
  fechas: string[];
}

@Injectable({ providedIn: 'root' })
export class ComunicacionesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** ⚙️ true = datos de ejemplo locales; false = backend real. */
  private readonly usarMock = false;

  /**
   * Busca envíos (Cosmos `send-mail`) filtrando en SERVIDOR por texto
   * (correo/asunto), campaña y rango de fechas. Devuelve UNA página (por defecto
   * los 50 más recientes que coincidan). `hayMas` indica si el resultado se topó
   * con el límite (conviene afinar la búsqueda).
   */
  async buscar(
    opts: BusquedaEnvios = {},
    limit = 50,
  ): Promise<{ items: ComunicacionRef[]; hayMas: boolean }> {
    if (this.usarMock) return { items: COMUNICACIONES_MOCK, hayMas: false };
    const qs = new URLSearchParams({ limit: String(limit) });
    if (opts.q) qs.set('q', opts.q);
    (opts.campanas ?? []).forEach((c) => qs.append('campana', c));
    if (opts.desde) qs.set('desde', opts.desde);
    if (opts.hasta) qs.set('hasta', opts.hasta);
    const r = await this.api.fetch<{ data: ComunicacionRef[]; next: number | null }>(
      `/api/comunicaciones?${qs.toString()}`,
    );
    return { items: r.data, hayMas: r.next != null };
  }

  /** Indicadores del conjunto filtrado (mismos filtros que `buscar`). */
  async kpis(opts: BusquedaEnvios = {}): Promise<KpisEnvios> {
    const qs = new URLSearchParams();
    if (opts.q) qs.set('q', opts.q);
    (opts.campanas ?? []).forEach((c) => qs.append('campana', c));
    if (opts.desde) qs.set('desde', opts.desde);
    if (opts.hasta) qs.set('hasta', opts.hasta);
    const s = qs.toString();
    return this.api.fetch<KpisEnvios>(`/api/comunicaciones/kpis${s ? '?' + s : ''}`);
  }

  /** Opciones de filtros (todas las campañas y días de la base). */
  async opciones(): Promise<OpcionesFiltros> {
    if (this.usarMock) return { campanas: [], fechas: [] };
    return this.api.fetch<OpcionesFiltros>('/api/comunicaciones/opciones');
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
