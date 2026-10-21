// Cliente de la App «Solicitudes Prestaciones» (Servicio al Cliente) — alma-backend
// /api/prestaciones/*. Ayuda al asesor a diligenciar el formato FOR-0075 sin errores:
// prellena por documento, valida con reglas y genera el PDF oficial para firmar.
//
// Todo viaja por POST con el documento en el cuerpo (nunca en la URL: los logs de
// acceso no deben guardar cédulas). Nada de lo digitado se guarda en Alma.

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

export const PERM_DILIGENCIAR = 'app.solicitudes-prestaciones.diligenciar';
export const PERM_AUDITORIA = 'app.solicitudes-prestaciones.auditoria.view';

export interface Opcion {
  valor: string;
  rotulo: string;
}

export interface Catalogos {
  version_formato: string;
  alcance: string;
  /** Opciones por clave del campo (la del beneficiario va como `beneficiarios[].campo`). */
  opciones: Record<string, Opcion[]>;
  tipos_documento_afiliado: string[];
  tipos_documento_beneficiario: string[];
  tipos_consultables: string[];
  recordatorios: string[];
  reglas_en_borrador: boolean;
  max_beneficiarios_por_hoja: number;
}

export type EstadoOrigen =
  | { estado: 'ok' }
  | { estado: 'no_encontrado' }
  | { estado: 'error'; codigo: string };

export interface Prellenado {
  afiliado: Record<string, string | number>;
  nombres_para_revisar?: boolean;
  bono?: { estado_fenix: string; sin_derecho?: boolean };
  semanas?: number;
  semanas_corte?: string;
}

export interface Consulta {
  tipo_documento: string;
  consultado_en: string;
  origenes: { persona: EstadoOrigen; bono: EstadoOrigen; semanas: EstadoOrigen };
  prellenado: Prellenado;
}

export interface Hallazgo {
  regla: string;
  seccion: string;
  campo: string;
  campo_rotulo: string;
  gravedad: 'error' | 'aviso';
  mensaje: string;
  por_confirmar: boolean;
}

export interface Analisis {
  hallazgos: Hallazgo[];
  resumen: { errores: number; avisos: number; puede_imprimir: boolean };
}

export interface Evento {
  id: number;
  tipo: 'consulta' | 'pdf';
  usuario: string;
  tipo_documento: string;
  documento_fin: string | null;
  detalle: string | null;
  creado_en: string;
}

/** El PDF se negó porque la solicitud tiene errores: trae el análisis para mostrarlo. */
export class PdfConErrores extends Error {
  constructor(readonly analisis: Analisis) {
    super('La solicitud tiene errores pendientes.');
  }
}

@Injectable({ providedIn: 'root' })
export class PrestacionesApi {
  private readonly api = inject(ApiService);

  catalogos(): Promise<Catalogos> {
    return this.api.fetch<Catalogos>('/api/prestaciones/catalogos');
  }

  consultar(tipoDocumento: string, numeroDocumento: string): Promise<Consulta> {
    return this.api.fetch<Consulta>('/api/prestaciones/consulta', {
      method: 'POST',
      body: JSON.stringify({ tipo_documento: tipoDocumento, numero_documento: numeroDocumento }),
    });
  }

  validar(datos: unknown): Promise<Analisis> {
    return this.api.fetch<Analisis>('/api/prestaciones/validar', {
      method: 'POST',
      body: JSON.stringify({ datos }),
    });
  }

  /** PDF diligenciado. Con errores y sin `borrador`, el backend responde 422 con el análisis. */
  async pdf(datos: unknown, borrador: boolean): Promise<{ blob: Blob; nombre: string }> {
    const res = await this.api.fetchRaw('/api/prestaciones/pdf', {
      method: 'POST',
      body: JSON.stringify({ datos, borrador }),
    });
    if (!res.ok) {
      let cuerpo: { detail?: unknown } | null = null;
      try {
        cuerpo = await res.json();
      } catch {
        /* sin cuerpo JSON */
      }
      const detalle = cuerpo?.detail as { hallazgos?: Hallazgo[]; resumen?: Analisis['resumen'] } | string | undefined;
      if (res.status === 422 && detalle && typeof detalle === 'object' && detalle.hallazgos && detalle.resumen) {
        throw new PdfConErrores({ hallazgos: detalle.hallazgos, resumen: detalle.resumen });
      }
      throw new Error(typeof detalle === 'string' ? detalle : `No se pudo generar el PDF (HTTP ${res.status}).`);
    }
    const nombre = /filename="?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'FOR-0075.pdf';
    return { blob: await res.blob(), nombre };
  }

  async eventos(limite: number, tipoDocumento?: string, numeroDocumento?: string): Promise<Evento[]> {
    const r = await this.api.fetch<{ eventos: Evento[] }>('/api/prestaciones/eventos', {
      method: 'POST',
      body: JSON.stringify({
        limite,
        tipo_documento: tipoDocumento || null,
        numero_documento: numeroDocumento || null,
      }),
    });
    return r.eventos;
  }
}
