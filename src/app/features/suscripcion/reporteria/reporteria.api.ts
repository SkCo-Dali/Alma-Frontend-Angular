// Cliente de la reportería/auditoría del Motor de Suscripción
// (alma-backend /api/suscripcion/reporteria/*).
//
// Los indicadores de resultado usan la ÚLTIMA evaluación de cada solicitud: una
// misma solicitud se re-evalúa varias veces y solo la última refleja su resultado.

import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import {
  ApiFilters,
  DistinctRequest,
  DistinctResponse,
} from '../grid/suscripcion-grid.api';

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
  /** Resultado del motor al que está acotado el resumen (null = todos). */
  decision: string | null;
  estados: ConteoEstado[];
  decisiones: ConteoDecision[];
  tiempoEmision: TiempoEmision;
  topAlertas: ConteoValor[];
  topExclusiones: ConteoValor[];
  /** Totales SIN tope: denominador del reparto porcentual de las dos listas. */
  totalAlertas: number;
  totalExclusiones: number;
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
  /** Quién emitió la póliza en Pipeline (IssuanceUser), en minúsculas. */
  gestiono: string | null;
  /** Estado de la póliza en Pipeline: código (para el color) y descripción. */
  estadoPipeline: string | null;
  estadoPipelineDesc: string | null;
  /** Subestado en Pipeline; null cuando no aplica. */
  subestadoPipelineDesc: string | null;
}

export interface PaginaAuditoria {
  data: FilaAuditoria[];
  total: number;
  next: number | null;
}

export interface DiaConSolicitudes {
  fecha: string;
  total: number;
}

/** Valores de los filtros (toda la base, sin acotar por lo que ya esté aplicado). */
export interface ConteoAnalista {
  analista: string;
  total: number;
}

export interface OpcionesReporteria {
  fechas: DiaConSolicitudes[];
  decisiones: ConteoDecision[];
  estados: ConteoEstado[];
  /** Quién hizo la última evaluación. Pocos valores: va entero. */
  analistas?: ConteoAnalista[];
}

/** Columnas de la auditoría que se filtran y ordenan (lista blanca del backend). */
export type ColumnaAuditoria =
  | 'nroCotizacion'
  | 'nombre'
  | 'estadoPipeline'
  | 'decision'
  | 'analista'
  | 'gestiono'
  | 'fechaIngreso'
  | 'fechaEmision'
  | 'minutosAEmision';

export interface OrdenAuditoria {
  columna: ColumnaAuditoria;
  direccion: 'asc' | 'desc';
}

/** Lo que acota la vista entera: periodo y resultado del motor. */
export type ContextoAuditoria = Pick<FiltrosReporteria, 'desde' | 'hasta' | 'decision'>;

/** Consulta de la auditoría con filtros por columna, en el formato de la bandeja. */
export interface ConsultaAuditoria extends ContextoAuditoria {
  search?: string;
  filters?: ApiFilters;
  sortBy?: ColumnaAuditoria;
  sortDir?: 'asc' | 'desc';
  limit: number;
  offset: number;
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

  /**
   * Indicadores agregados del periodo. `decision` acota el universo al
   * resultado del motor elegido; `decisiones` vuelve siempre completo (es el
   * selector), el resto de indicadores sí queda acotado.
   */
  resumen(f: FiltrosReporteria = {}): Promise<ResumenReporteria> {
    const { desde, hasta, decision } = f;
    return this.api.fetch<ResumenReporteria>(
      `/api/suscripcion/reporteria/resumen${this.qs({ desde, hasta, decision })}`,
    );
  }

  /** Valores para los desplegables y el árbol de fechas. */
  opciones(): Promise<OpcionesReporteria> {
    return this.api.fetch<OpcionesReporteria>('/api/suscripcion/reporteria/opciones');
  }

  /** Traza fila por fila, con filtro por columna y paginada por offset. */
  auditoria(consulta: ConsultaAuditoria): Promise<PaginaAuditoria> {
    return this.api.fetch<PaginaAuditoria>('/api/suscripcion/reporteria/auditoria', {
      method: 'POST',
      body: JSON.stringify(consulta),
    });
  }
}

/**
 * Los filtros de columna de la bandeja (valores con casillas, árbol de fechas)
 * piden sus valores a `SuscripcionGridApi.fetchDistinctValues`, que apunta a la
 * bandeja. La página de reportería provee ESTA clase en su lugar, así los mismos
 * componentes sirven para la auditoría sin tocarlos: los valores salen de las
 * solicitudes de la auditoría, acotados por el periodo y el resultado del motor
 * que estén elegidos, y no de la bandeja.
 */
@Injectable()
export class AuditoriaDistinctApi {
  private readonly api = inject(ApiService);

  /** Lo pone la página: periodo y resultado elegidos en ese momento. */
  contexto: () => ContextoAuditoria = () => ({});

  fetchDistinctValues(request: DistinctRequest): Promise<DistinctResponse> {
    return this.api.fetch<DistinctResponse>('/api/suscripcion/reporteria/auditoria/distincts', {
      method: 'POST',
      body: JSON.stringify({ ...this.contexto(), ...request }),
    });
  }
}
