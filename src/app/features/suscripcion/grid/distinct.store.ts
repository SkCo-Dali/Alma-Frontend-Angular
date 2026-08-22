// Valores únicos de una columna del grid (port de useSuscripcionDistinct):
// - LAZY: se inicializa cuando el popover del filtro se abre.
// - EN CASCADA: manda los filtros de las OTRAS columnas + la búsqueda global
//   (el propio campo se excluye del request — así se ven todas sus opciones).
// - Debounce de 250ms del buscador de valores; si la lista base llegó truncada
//   al TOP del servidor (500), el término también se busca en el SERVIDOR vía
//   valueSearch para encontrar valores fuera del TOP.
// - Token de petición para descartar respuestas obsoletas.

import { signal } from '@angular/core';
import {
  ApiFilters,
  DistinctBaseRequest,
  SuscripcionGridApi,
} from './suscripcion-grid.api';

export interface DiscreteValueItem {
  value: string | number | boolean | null;
  count: number;
}

/** TOP de valores que devuelve el backend (contrato: 500). */
const SERVER_TRUNCATION_THRESHOLD = 500;
const DEBOUNCE_MS = 250;

/** Excluye los filtros del propio campo (distinct en cascada). */
function stripOwnField(
  filters: ApiFilters | undefined,
  field: string,
): ApiFilters | undefined {
  if (!filters || !(field in filters)) return filters;
  const rest: ApiFilters = {};
  for (const [k, v] of Object.entries(filters)) {
    if (k !== field) rest[k] = v;
  }
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function filtrarLocal(all: DiscreteValueItem[], search: string): DiscreteValueItem[] {
  if (!search.trim()) return all;
  const lower = search.toLowerCase().trim();
  return all.filter((item) => {
    if (item.value === null || item.value === undefined) {
      return '(vacío)'.includes(lower) || 'vacio'.includes(lower);
    }
    return String(item.value).toLowerCase().includes(lower);
  });
}

export class DistinctStore {
  readonly values = signal<DiscreteValueItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchingServer = signal(false);
  readonly inicializado = signal(false);

  private todos: DiscreteValueItem[] = [];
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private token = 0;

  constructor(
    private readonly api: SuscripcionGridApi,
    private readonly column: string,
    private readonly buildRequest: () => DistinctBaseRequest,
  ) {}

  /** Primera carga (al abrir el popover del filtro). */
  initialize(): void {
    if (this.inicializado()) return;
    this.inicializado.set(true);
    void this.fetch();
  }

  /** Refetch (p. ej. otro filtro cambió mientras el popover estaba abierto). */
  async fetch(): Promise<void> {
    const token = ++this.token;
    this.loading.set(true);
    this.error.set(null);
    try {
      const base = this.buildRequest();
      const result = await this.api.fetchDistinctValues({
        field: this.column,
        ...base,
        filters: stripOwnField(base.filters, this.column),
      });
      if (token !== this.token) return;
      const items: DiscreteValueItem[] = result.values.map((v) => ({
        // Normaliza el sentinel '__EMPTY__' a null para tratarlo uniforme.
        value: v.value === '__EMPTY__' ? null : v.value,
        count: v.count,
      }));
      this.todos = items;
      this.values.set(items);
    } catch (err) {
      if (token !== this.token) return;
      const msg = err instanceof Error ? err.message : String(err);
      this.error.set(msg);
      console.error('[SuscripcionDistinct] error:', err);
    } finally {
      if (token === this.token) this.loading.set(false);
    }
  }

  /** Buscador de valores: filtra local al instante y, si la lista base llegó
   *  truncada, consulta el servidor 250ms después de la última tecla. */
  buscar(term: string): void {
    if (this.debounce) clearTimeout(this.debounce);
    // Filtrado local inmediato (fluido)
    this.values.set(filtrarLocal(this.todos, term));
    const t = term.trim();
    if (!t || this.todos.length < SERVER_TRUNCATION_THRESHOLD) {
      this.searchingServer.set(false);
      return;
    }
    this.searchingServer.set(true);
    this.debounce = setTimeout(() => void this.buscarEnServidor(t), DEBOUNCE_MS);
  }

  private async buscarEnServidor(term: string): Promise<void> {
    const token = ++this.token;
    try {
      const base = this.buildRequest();
      const result = await this.api.fetchDistinctValues({
        field: this.column,
        ...base,
        filters: stripOwnField(base.filters, this.column),
        valueSearch: term,
      });
      if (token !== this.token) return;
      this.values.set(
        result.values.map((v) => ({
          value: v.value === '__EMPTY__' ? null : v.value,
          count: v.count,
        })),
      );
    } catch (err) {
      // Best-effort: si el servidor falla, queda el filtrado local.
      console.warn(
        '[SuscripcionDistinct] valueSearch falló (queda el filtro local):',
        err,
      );
    } finally {
      if (token === this.token) this.searchingServer.set(false);
    }
  }

  destroy(): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.token++; // invalida respuestas en vuelo
  }
}
