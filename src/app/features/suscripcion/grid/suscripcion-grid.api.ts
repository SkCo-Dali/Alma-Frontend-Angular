// Cliente del GRID de la bandeja de Suscripción (réplica del patrón Mi Cartera de Dali).
// 5 endpoints: grid-columns / grid / distincts / grid-state / grid-events.

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';

// ── Tipos de columnas (GET /api/suscripcion/grid-columns) ────────────────────

export interface GridColumnUiHints {
  autoFit?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export interface GridColumnDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'currency';
  filterable: boolean;
  searchable: boolean;
  sortable: boolean;
  discrete: boolean;
  sensitive: boolean;
  defaultVisible: boolean;
  label?: string;
  tooltip?: string;
  ui?: GridColumnUiHints;
}

export type GridColumnsResponse = Record<string, GridColumnDefinition>;

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  sortable: boolean;
  tooltip?: string;
  ui?: GridColumnUiHints;
}

// ── Tipos de filtros y datos (POST /api/suscripcion/grid) ────────────────────

export type GridFilterOp =
  | 'eq'
  | 'ne'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'in'
  | 'between'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'isnull'
  | 'isnotnull';

export interface GridFilter {
  field: string;
  op: GridFilterOp;
  value: string | number | boolean | (string | number | boolean)[];
}

export interface ApiFilterCondition {
  operator: string;
  value: string | number | boolean | (string | number | boolean)[];
}

export type ApiFilters = Record<string, ApiFilterCondition>;

export interface GridApiRequest {
  filters?: ApiFilters;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface SuscripcionRowMeta {
  uw_status: string | null;
  sub_status: string | null;
  decision_slug: string | null;
  veredicto_slug:
    | 'sin_novedades'
    | 'requiere_revision'
    | 'covid_sin_restriccion'
    | 'con_positivas'
    | 'sin_diligenciar'
    | null;
  product_code: string | null;
}

export interface SuscripcionGridItem extends Record<string, unknown> {
  Id: string;
  meta?: SuscripcionRowMeta;
}

export interface GridDataResponse {
  items: SuscripcionGridItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Distincts (POST /api/suscripcion/distincts) ──────────────────────────────

export interface DistinctRequest {
  field: string;
  filters?: ApiFilters;
  search?: string;
  valueSearch?: string;
}

export type DistinctBaseRequest = Omit<DistinctRequest, 'field'>;

export interface DistinctValueItem {
  value: string | number | boolean | null;
  count: number;
}

export interface DistinctResponse {
  field: string;
  values: DistinctValueItem[];
}

// ── Estado persistido (grid-state / grid-events) ─────────────────────────────

export interface GridState {
  filters?: ApiFilters | null;
  search?: string | null;
  sortBy?: string | null;
  sortDir?: string | null;
  page?: number | null;
  pageSize?: number | null;
  visibleColumns?: string[] | null;
  columnWidths?: Record<string, number> | null;
}

export type GridStateResponse = GridState | null;

export type GridEventType =
  | 'initial_load'
  | 'filters_changed'
  | 'sort_changed'
  | 'search_changed'
  | 'page_changed'
  | 'columns_changed'
  | 'row_opened';

export interface GridEventRequest extends Partial<GridState> {
  sessionId: string;
  eventType: GridEventType;
}

const SESSION_ID_KEY = 'alma-session-id';

/** sessionId estable por pestaña; se genera (uuid) si no existe. */
export function getGridSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      sessionStorage.setItem(SESSION_ID_KEY, id);
    } catch {
      /* storage lleno/bloqueado: seguimos con el id efímero */
    }
  }
  return id;
}

// v2: 34 columnas nuevas del proceso — el bump invalida el caché de sesiones.
const COLUMNS_CACHE_KEY = 'suscripcion-grid-columns-v2';

/**
 * Convierte el arreglo interno GridFilter[] al formato objeto de la API.
 * Fusiona gte+lte del mismo campo en un único 'between'. Boolean solo admite
 * 'eq'; sentinel '__EMPTY__' en 'in' para registros NULL/vacíos.
 */
export function filtersToApiFormat(
  filters: GridFilter[],
  columnDefs?: GridColumnsResponse,
): ApiFilters | undefined {
  if (filters.length === 0) return undefined;

  const result: ApiFilters = {};

  const grouped = new Map<string, GridFilter[]>();
  for (const f of filters) {
    const arr = grouped.get(f.field) || [];
    arr.push(f);
    grouped.set(f.field, arr);
  }

  for (const [field, fieldFilters] of grouped) {
    const colType = columnDefs?.[field]?.type;

    if (colType === 'boolean') {
      const f = fieldFilters[fieldFilters.length - 1];
      if (f.op === 'in' && Array.isArray(f.value)) {
        if (f.value.length >= 2) continue;
        if (f.value.length === 1) {
          const boolVal = f.value[0] === 'true' || f.value[0] === true;
          result[field] = { operator: 'eq', value: boolVal };
          continue;
        }
        continue;
      }
      result[field] = { operator: 'eq', value: f.value };
      continue;
    }

    // Las columnas 'date' de Suscripción son fechas puras: NO se convierte UTC.

    if (fieldFilters.length === 2) {
      const gte = fieldFilters.find((f) => f.op === 'gte');
      const lte = fieldFilters.find((f) => f.op === 'lte');
      if (gte && lte) {
        result[field] = {
          operator: 'between',
          value: [gte.value, lte.value] as (string | number | boolean)[],
        };
        continue;
      }
    }

    const f = fieldFilters[fieldFilters.length - 1];
    let apiValue = f.value;
    if (f.op === 'in' && Array.isArray(apiValue)) {
      apiValue = apiValue.map((v) => (v === '' || v === null ? '__EMPTY__' : v));
    }
    result[field] = { operator: f.op, value: apiValue };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/** Inverso de filtersToApiFormat: expande 'between' en gte+lte al hidratar. */
export function apiFiltersToInternal(apiFilters: ApiFilters): GridFilter[] {
  const result: GridFilter[] = [];
  for (const [field, condition] of Object.entries(apiFilters)) {
    if (
      condition.operator === 'between' &&
      Array.isArray(condition.value) &&
      condition.value.length === 2
    ) {
      result.push({ field, op: 'gte', value: condition.value[0] });
      result.push({ field, op: 'lte', value: condition.value[1] });
    } else {
      result.push({ field, op: condition.operator as GridFilterOp, value: condition.value });
    }
  }
  return result;
}

@Injectable({ providedIn: 'root' })
export class SuscripcionGridApi {
  private readonly api = inject(ApiService);

  /** GET /grid-columns — catálogo, cacheado en sessionStorage por sesión. */
  async fetchGridColumns(): Promise<GridColumnsResponse> {
    try {
      const cached = sessionStorage.getItem(COLUMNS_CACHE_KEY);
      if (cached) return JSON.parse(cached) as GridColumnsResponse;
    } catch {
      /* JSON corrupto: se refetchea */
    }
    const raw = await this.api.fetch<{ columns: GridColumnsResponse }>(
      '/api/suscripcion/grid-columns',
    );
    try {
      sessionStorage.setItem(COLUMNS_CACHE_KEY, JSON.stringify(raw.columns));
    } catch {
      /* best-effort */
    }
    return raw.columns;
  }

  fetchGridData(request: GridApiRequest): Promise<GridDataResponse> {
    return this.api.fetch<GridDataResponse>('/api/suscripcion/grid', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  fetchDistinctValues(request: DistinctRequest): Promise<DistinctResponse> {
    return this.api.fetch<DistinctResponse>('/api/suscripcion/distincts', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async fetchGridState(): Promise<GridStateResponse> {
    const data = await this.api.fetch<GridStateResponse>('/api/suscripcion/grid-state');
    return data ?? null;
  }

  /** POST /grid-events — upserta el estado del usuario y registra el evento. */
  async saveGridEvent(event: GridEventRequest): Promise<void> {
    await this.api.fetch<{ saved: boolean }>('/api/suscripcion/grid-events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }
}
