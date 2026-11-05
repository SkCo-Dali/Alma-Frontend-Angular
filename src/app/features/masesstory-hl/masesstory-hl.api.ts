// Cliente de la App «Masesstory_HL» (validación de Historias Laborales) — alma-backend
// /api/masesstory-hl/*. Los Excel se suben por tandas a un lote temporal del servidor
// (no se guardan en la base de datos); al final se descargan la validación y el
// consolidado.

import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/services/api.service';

export const PERM_VIEW = 'app.masesstory-hl.view';

export type Resultado = 'OK' | 'NO CUMPLE' | 'NO DETERMINADO';
export const RESULTADOS: Resultado[] = ['OK', 'NO CUMPLE', 'NO DETERMINADO'];

/** Un caso evaluado: una fila de la tabla de calificación de «Resumen» (una por AFP). */
export interface CasoHl {
  archivo: string;
  identificacion: string;
  nombre: string;
  genero: string;
  nacimiento: string;
  consolidacion: string;
  rais: string;
  afp: string;
  estado: string;
  resultado: Resultado;
  motivo: string;
  datos_basicos: number | null;
  aportes_afp: number | null;
  completitud: number | null;
  consistencia_total: number | null;
  saldos: number | null;
  movimientos: number | null;
  valorizacion: number | null;
}

export type Totales = Record<Resultado, number>;
/** Umbral mínimo (%) de cada componente; los define el backend. */
export type Umbrales = Record<'datos_basicos' | 'aportes_afp' | 'completitud' | 'consistencia_total', number>;

export interface EstadoConsolidado {
  estado: 'sin_generar' | 'generando' | 'listo' | 'error';
  bytes?: number;
  detalle?: string;
}

export interface EstadoLote {
  lote_id: string;
  archivos_total: number;
  totales: Totales;
  /** Instante (ISO, UTC) en que el servidor borra el lote si no hay más actividad. */
  vence_en: string;
  umbrales: Umbrales;
  consolidado: EstadoConsolidado;
}

export interface Lote extends EstadoLote {
  casos: CasoHl[];
}

export interface RespuestaTanda {
  lote_id: string;
  recibidos: number;
  procesados: number;
  /** Archivos que ya estaban en el lote (mismo contenido): no se duplican. */
  repetidos: string[];
  casos: CasoHl[];
  totales: Totales;
  archivos_total: number;
  vence_en: string;
  umbrales: Umbrales;
}

const BASE = '/api/masesstory-hl';
export type Descarga = 'evaluado' | 'consolidado';

@Injectable({ providedIn: 'root' })
export class MasesstoryHlApi {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** Sin `loteId` crea un lote nuevo; con él suma la tanda a ese lote. */
  subirTanda(archivos: File[], loteId: string | null): Promise<RespuestaTanda> {
    const form = new FormData();
    if (loteId) form.append('lote_id', loteId);
    for (const a of archivos) form.append('archivos', a, a.name);
    return this.api.upload<RespuestaTanda>(`${BASE}/tandas`, form);
  }

  verLote(loteId: string): Promise<Lote> {
    return this.api.fetch<Lote>(`${BASE}/lotes/${loteId}`);
  }

  /** Igual que verLote pero sin los casos: liviano para consultarlo seguido. */
  estadoLote(loteId: string): Promise<EstadoLote> {
    return this.api.fetch<EstadoLote>(`${BASE}/lotes/${loteId}/estado`);
  }

  /** Inicia el consolidado en segundo plano (tarda hasta ~1 min con 480 archivos). */
  generarConsolidado(loteId: string): Promise<EstadoConsolidado> {
    return this.api.fetch<EstadoConsolidado>(`${BASE}/lotes/${loteId}/consolidado`, { method: 'POST' });
  }

  async borrarLote(loteId: string): Promise<void> {
    await this.api.fetch<unknown>(`${BASE}/lotes/${loteId}`, { method: 'DELETE' });
  }

  /** Descarga el Excel (binario) y lo entrega al navegador con su nombre. No usa
   *  `ApiService`, que responde JSON: pide el archivo con el token de la sesión. */
  async descargar(loteId: string, cual: Descarga, nombre: string): Promise<void> {
    const token = await this.auth.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const base = environment.apiUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}${BASE}/lotes/${loteId}/${cual}`, { headers });
    if (!res.ok) {
      let detalle = `HTTP ${res.status} al descargar el archivo`;
      try {
        detalle = ((await res.json()) as { detail?: string }).detail ?? detalle;
      } catch {
        /* cuerpo no JSON */
      }
      throw new Error(detalle);
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
