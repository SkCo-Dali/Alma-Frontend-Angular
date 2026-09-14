// Cliente HTTP de Desarrollo Comercial: calificación / clasificación de agentes.

import { Injectable, inject } from '@angular/core';
import { ComisionesHttp } from '../comisiones-http.service';
import { CalificacionAgenteRecord } from './desarrollo-comercial.domain';

interface ListResponse<T> {
  items?: T[];
  data?: T[];
  page?: number;
  page_size?: number;
  total?: number;
}

const PAGE_SIZE = 200;

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

@Injectable({ providedIn: 'root' })
export class DesarrolloComercialApi {
  private readonly http = inject(ComisionesHttp);

  /** El listado puede llegar como arreglo plano o como {items}/{data}. */
  async listCalificacionAgente(): Promise<CalificacionAgenteRecord[]> {
    const primera = await this.http.get<
      ApiCalificacionAgente[] | ListResponse<ApiCalificacionAgente>
    >(`/api/calificacion-agente${qs({ page: 1, page_size: PAGE_SIZE })}`);

    const normalizar = (
      res: ApiCalificacionAgente[] | ListResponse<ApiCalificacionAgente>,
    ): { items: ApiCalificacionAgente[]; total: number } => {
      if (Array.isArray(res)) return { items: res, total: res.length };
      const items = res.items ?? res.data ?? [];
      return { items, total: res.total ?? items.length };
    };

    const { items, total } = normalizar(primera);
    let todos = [...items];
    const paginas = Math.ceil(total / PAGE_SIZE);
    if (paginas > 1) {
      const restantes = await Promise.all(
        Array.from({ length: paginas - 1 }, (_, i) =>
          this.http.get<ApiCalificacionAgente[] | ListResponse<ApiCalificacionAgente>>(
            `/api/calificacion-agente${qs({ page: i + 2, page_size: PAGE_SIZE })}`,
          ),
        ),
      );
      for (const r of restantes) todos = [...todos, ...normalizar(r).items];
    }
    return todos.map(mapCalificacionAgente);
  }

  createCalificacionAgenteOverride(
    data: Partial<CalificacionAgenteRecord>,
  ): Promise<ApiCalificacionAgente> {
    return this.http.send<ApiCalificacionAgente>(
      '/api/calificacion-agente/override',
      'POST',
      toCalificacionAgenteRequest(data),
      'Error actualizando la clasificación de agente',
    );
  }
}

// ── Formas del API y mapeos ─────────────────────────────────────────────────

interface ApiCalificacionAgente {
  id?: string;
  Periodo?: number;
  IdAgte?: number;
  NombreAgte?: string | null;
  IdSociedad?: number;
  NombreSoc?: string | null;
  CanalId?: number;
  CanalDescripcion?: string | null;
  ClasificacionAgente?: string | null;
  Activo?: boolean;
  EditadoManual?: boolean;
  UsuarioModifica?: string | null;
  FechaModifica?: string | null;
  ClasificacionSociedad?: string | null;
  VigenteEnOrigen?: boolean;
  FechaUltimaVezEnOrigen?: string | null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function texto(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function mapCalificacionAgente(api: ApiCalificacionAgente): CalificacionAgenteRecord {
  const Periodo = num(api.Periodo);
  const IdAgte = num(api.IdAgte);
  const IdSociedad = num(api.IdSociedad);
  const CanalId = num(api.CanalId);
  const ClasificacionAgente = texto(api.ClasificacionAgente);
  return {
    id: api.id ?? `${Periodo}-${IdAgte}-${IdSociedad}-${CanalId}-${ClasificacionAgente}`,
    Periodo,
    IdAgte,
    NombreAgte: texto(api.NombreAgte),
    IdSociedad,
    NombreSoc: texto(api.NombreSoc),
    CanalId,
    CanalDescripcion: texto(api.CanalDescripcion),
    ClasificacionAgente,
    Activo: Boolean(api.Activo ?? true),
    EditadoManual: Boolean(api.EditadoManual),
    UsuarioModifica: api.UsuarioModifica ?? null,
    FechaModifica: api.FechaModifica ?? null,
    ClasificacionSociedad: texto(api.ClasificacionSociedad),
    VigenteEnOrigen: Boolean(api.VigenteEnOrigen),
    FechaUltimaVezEnOrigen: api.FechaUltimaVezEnOrigen ?? null,
  };
}

/** Body del override: solo los campos que exige el contrato POST. */
function toCalificacionAgenteRequest(r: Partial<CalificacionAgenteRecord>) {
  return {
    IdAgte: Number(r.IdAgte) || 0,
    IdSociedad: Number(r.IdSociedad) || 0,
    CanalId: Number(r.CanalId) || 0,
    PeriodoDesde: Number(r.Periodo) || 0,
    ClasificacionAgente: r.ClasificacionAgente ?? '',
    Activo: r.Activo ?? true,
  };
}
