// Cliente de la reportería/auditoría del Motor de Suscripción
// (alma-backend /api/suscripcion/reporteria/*).
//
// Los indicadores de resultado usan la ÚLTIMA evaluación de cada solicitud: una
// misma solicitud se re-evalúa varias veces y solo la última refleja su resultado.

import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';

export interface ConteoEstado {
  estado: string;
  total: number;
}
export interface ConteoDecision {
  decision: string;
  total: number;
}
export interface ConteoValor {
  valor: string;
  total: number;
}

export interface TiempoEmision {
  /** Cuántas emisiones tienen tiempo medible. */
  n: number;
  medianaMin: number | null;
  p90Min: number | null;
  minMin: number | null;
  maxMin: number | null;
}

export interface ResumenReporteria {
  solicitudes: number;
  emitidas: number;
  /** Evaluaciones totales (actividad del motor), no una por solicitud. */
  evaluaciones: number;
  emisionAutomatica: number;
  estados: ConteoEstado[];
  decisiones: ConteoDecision[];
  tiempoEmision: TiempoEmision;
  topAlertas: ConteoValor[];
  topExclusiones: ConteoValor[];
}

export interface FilaAuditoria {
  nroCotizacion: string;
  nombre: string;
  cedula: string;
  estado: string;
  fechaIngreso: string | null;
  decision: string | null;
  analista: string | null;
  evaluadaEn: string | null;
  fechaEmision: string | null;
  minutosAEmision: number | null;
}

export interface PaginaAuditoria {
  data: FilaAuditoria[];
  total: number;
  next: number | null;
}

export interface FiltrosReporteria {
  desde?: string;
  hasta?: string;
  decision?: string;
  estado?: string;
  analista?: string;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class ReporteriaApi {
  private readonly api = inject(ApiService);

  private qs(f: FiltrosReporteria, extra: Record<string, string> = {}): string {
    const p = new URLSearchParams(extra);
    for (const [k, v] of Object.entries(f)) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
  }

  /** Indicadores agregados del periodo. */
  resumen(f: FiltrosReporteria = {}): Promise<ResumenReporteria> {
    const { desde, hasta } = f;
    return this.api.fetch<ResumenReporteria>(
      `/api/suscripcion/reporteria/resumen${this.qs({ desde, hasta })}`,
    );
  }

  /** Traza fila por fila, filtrable y paginada (`cursor` = offset). */
  auditoria(f: FiltrosReporteria = {}, limit = 50, cursor: number | null = null): Promise<PaginaAuditoria> {
    const extra: Record<string, string> = { limit: String(limit) };
    if (cursor != null) extra['cursor'] = String(cursor);
    return this.api.fetch<PaginaAuditoria>(
      `/api/suscripcion/reporteria/auditoria${this.qs(f, extra)}`,
    );
  }
}
