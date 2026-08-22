// Store del grid de Suscripción: unifica los tres hooks del front React
// (useSuscripcionGridColumns + useSuscripcionGridState + useSuscripcionGrid)
// en un servicio con signals. Puntos NO negociables conservados del original:
//
// - Conversión bidireccional GridFilter[] ↔ ApiFilters (en el api client).
// - `hidratado` GATEA el primer fetch: sin esto el grid pedía datos con los
//   defaults y de inmediato repetía con los filtros hidratados (doble POST).
// - Detección del eventType por prioridad search > sort > page > filters.
// - debouncedSave (2s) para filtros/búsqueda/orden/página; immediateSave para
//   columnas, anchos y row_opened. Flush del pendiente al destruir.
// - Los anchos SIEMPRE se incluyen en cada guardado (grid-events upserta el
//   estado completo: un save sin columnWidths borraría los anchos guardados).
// - Dedup defensivo por Id (ids repetidos ⇒ filas huérfanas al reconciliar).
// - NUNCA refetch del estado tras guardar: la carrera GET vs POST revertía los
//   toggles del usuario (bug real de Dali, 2026-08-05).

import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import {
  ApiFilters,
  ColumnConfig,
  DistinctBaseRequest,
  GridApiRequest,
  GridColumnsResponse,
  GridEventRequest,
  GridEventType,
  GridFilter,
  GridFilterOp,
  GridState,
  SuscripcionGridApi,
  SuscripcionGridItem,
  apiFiltersToInternal,
  filtersToApiFormat,
  getGridSessionId,
} from './suscripcion-grid.api';

/** Columnas fijas (sticky): siempre visibles, no arrastrables, primeras. */
export const STICKY_GRID_COLUMNS: string[] = ['NroCotizacion', 'Asegurado'];

const DEBOUNCE_MS = 2000;

@Injectable()
export class SuscripcionGridStore implements OnDestroy {
  private readonly api = inject(SuscripcionGridApi);

  // ── Estado de carga ────────────────────────────────────────────────────────
  readonly columnsLoading = signal(true);
  readonly stateLoaded = signal(false);
  readonly hidratado = signal(false);
  readonly isLoading = signal(false);
  readonly isFetching = signal(false);
  readonly error = signal<string | null>(null);

  // ── Datos ─────────────────────────────────────────────────────────────────
  readonly data = signal<SuscripcionGridItem[]>([]);
  readonly total = signal(0);
  readonly totalPages = computed(() => {
    const t = this.total();
    return t > 0 ? Math.ceil(t / this.pageSize()) : 0;
  });

  // ── Columnas ──────────────────────────────────────────────────────────────
  readonly allColumnDefs = signal<GridColumnsResponse>({});
  readonly columns = signal<ColumnConfig[]>([]);
  readonly savedColumnWidths = signal<Record<string, number>>({});

  // ── Consulta ──────────────────────────────────────────────────────────────
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly sortField = signal('Recibida');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly search = signal('');
  readonly filters = signal<GridFilter[]>([]);

  /** Cuántos campos distintos tienen filtro activo (chip del toolbar). */
  readonly camposFiltrados = computed(
    () => new Set(this.filters().map((f) => f.field)).size,
  );

  // Los anchos viven en la tabla; este mapa conserva el último conocido para
  // incluirlo en CADA guardado.
  private widths: Record<string, number> = {};

  // Guardado con debounce
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendiente: { state: GridState; eventType: GridEventType } | null = null;

  // Refs del valor previo para detectar QUÉ cambió
  private prev = {
    filters: [] as GridFilter[],
    search: '',
    sortField: 'Recibida',
    sortDir: 'desc' as 'asc' | 'desc',
    page: 1,
    pageSize: 25,
  };

  // Token de la petición en curso: descarta respuestas obsoletas.
  private fetchToken = 0;
  private initialLoadEnviado = false;

  /** Arranque: catálogo de columnas + estado guardado, luego primer fetch. */
  async init(): Promise<void> {
    const [defs, estado] = await Promise.all([
      this.api.fetchGridColumns().catch((e) => {
        this.error.set(e instanceof Error ? e.message : String(e));
        return {} as GridColumnsResponse;
      }),
      this.api.fetchGridState().catch(() => null),
    ]);

    this.allColumnDefs.set(defs);
    this.columns.set(this.construirColumnas(defs, estado?.visibleColumns ?? null));
    this.savedColumnWidths.set(estado?.columnWidths ?? {});
    this.widths = { ...(estado?.columnWidths ?? {}) };
    this.columnsLoading.set(false);

    // Hidratación del estado guardado ANTES del primer fetch (evita doble POST)
    if (estado) {
      if (estado.search) this.search.set(estado.search);
      if (estado.sortBy) this.sortField.set(estado.sortBy);
      if (estado.sortDir) this.sortDir.set(estado.sortDir as 'asc' | 'desc');
      if (estado.pageSize) this.pageSize.set(estado.pageSize);
      if (estado.filters) this.filters.set(apiFiltersToInternal(estado.filters));
    }
    this.snapshotPrevio();
    this.stateLoaded.set(true);
    this.hidratado.set(true);

    await this.cargar();

    if (!this.initialLoadEnviado) {
      this.initialLoadEnviado = true;
      this.immediateSave(this.buildCurrentState(), 'initial_load');
    }
  }

  /**
   * ColumnConfig[] = catálogo + preferencias del usuario. Con preferencias: las
   * preferidas van visibles y en su orden; el resto oculto (listado en el
   * selector). Sin preferencias: defaultVisible. Las sticky SIEMPRE primero.
   */
  private construirColumnas(
    defs: GridColumnsResponse,
    preferidas: string[] | null,
  ): ColumnConfig[] {
    const build = (key: string, visible: boolean): ColumnConfig | null => {
      const def = defs[key];
      if (!def) return null;
      return {
        key,
        label: def.label ?? key,
        visible,
        sortable: def.sortable,
        tooltip: def.tooltip,
        ui: def.ui,
      };
    };

    const pinned: ColumnConfig[] = [];
    for (const key of STICKY_GRID_COLUMNS) {
      const c = build(key, true);
      if (c) pinned.push(c);
    }

    if (preferidas && preferidas.length > 0) {
      const result: ColumnConfig[] = [...pinned];
      for (const key of preferidas) {
        if (STICKY_GRID_COLUMNS.includes(key)) continue;
        const c = build(key, true);
        if (c) result.push(c);
      }
      for (const key of Object.keys(defs)) {
        if (STICKY_GRID_COLUMNS.includes(key) || preferidas.includes(key)) continue;
        const c = build(key, false);
        if (c) result.push(c);
      }
      return result;
    }

    const rest: ColumnConfig[] = [];
    for (const [key, def] of Object.entries(defs)) {
      if (STICKY_GRID_COLUMNS.includes(key)) continue;
      rest.push({
        key,
        label: def.label ?? key,
        visible: def.defaultVisible,
        sortable: def.sortable,
        tooltip: def.tooltip,
        ui: def.ui,
      });
    }
    return [...pinned, ...rest];
  }

  private request(): GridApiRequest {
    return {
      page: this.page(),
      pageSize: this.pageSize(),
      sortBy: this.sortField(),
      sortDir: this.sortDir(),
      search: this.search().trim() || undefined,
      filters: filtersToApiFormat(this.filters(), this.allColumnDefs()),
    };
  }

  /** Fetch de la página actual. Descarta respuestas de peticiones obsoletas. */
  private async cargar(): Promise<void> {
    if (!this.hidratado()) return;
    const token = ++this.fetchToken;
    const primeraCarga = this.data().length === 0;
    if (primeraCarga) this.isLoading.set(true);
    this.isFetching.set(true);
    this.error.set(null);
    try {
      const res = await this.api.fetchGridData(this.request());
      if (token !== this.fetchToken) return; // llegó tarde: la descartamos
      // DEDUP defensivo por Id: ids repetidos ⇒ filas huérfanas al reconciliar.
      const seen = new Set<string>();
      const items = res.items.filter((row) => {
        const id = String(row.Id ?? '');
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      if (items.length !== res.items.length) {
        console.warn('[SuscripcionGrid] items duplicados eliminados', {
          recibidos: res.items.length,
          unicos: items.length,
        });
      }
      this.data.set(items);
      this.total.set(res.total);
    } catch (e) {
      if (token !== this.fetchToken) return;
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      if (token === this.fetchToken) {
        this.isLoading.set(false);
        this.isFetching.set(false);
      }
    }
  }

  /** Snapshot del estado actual (para persistir vía grid-events). */
  buildCurrentState(): GridState {
    const visibleKeys = this.columns()
      .filter((c) => c.visible)
      .map((c) => c.key);
    return {
      filters: filtersToApiFormat(this.filters(), this.allColumnDefs()) ?? null,
      search: this.search().trim() || null,
      sortBy: this.sortField(),
      sortDir: this.sortDir(),
      page: this.page(),
      pageSize: this.pageSize(),
      visibleColumns: visibleKeys.length > 0 ? visibleKeys : null,
      columnWidths: Object.keys(this.widths).length > 0 ? this.widths : null,
    };
  }

  private snapshotPrevio(): void {
    this.prev = {
      filters: this.filters(),
      search: this.search(),
      sortField: this.sortField(),
      sortDir: this.sortDir(),
      page: this.page(),
      pageSize: this.pageSize(),
    };
  }

  /** Recarga + persiste con el eventType correcto según QUÉ cambió. */
  private async aplicarCambio(): Promise<void> {
    // Prioridad search > sort > page > filters (igual que el original)
    let eventType: GridEventType | null = null;
    if (this.prev.search !== this.search()) eventType = 'search_changed';
    else if (
      this.prev.sortField !== this.sortField() ||
      this.prev.sortDir !== this.sortDir()
    )
      eventType = 'sort_changed';
    else if (this.prev.page !== this.page() || this.prev.pageSize !== this.pageSize())
      eventType = 'page_changed';
    else if (this.prev.filters !== this.filters()) eventType = 'filters_changed';

    this.snapshotPrevio();
    if (eventType) this.debouncedSave(this.buildCurrentState(), eventType);
    await this.cargar();
  }

  // ── Mutadores (todos resetean la página a 1, salvo setPage) ────────────────

  updateSearch(term: string): void {
    this.search.set(term);
    this.page.set(1);
    void this.aplicarCambio();
  }

  updateFilters(nuevos: GridFilter[]): void {
    this.filters.set(nuevos);
    this.page.set(1);
    void this.aplicarCambio();
  }

  clearFieldFilter(field: string): void {
    this.filters.update((prev) => prev.filter((f) => f.field !== field));
    this.page.set(1);
    void this.aplicarCambio();
  }

  /** Filtro discreto (op 'in') de una columna. */
  setDiscreteFilter(field: string, values: (string | number | boolean)[]): void {
    if (values.length === 0) {
      this.clearFieldFilter(field);
      return;
    }
    this.filters.update((prev) => [
      ...prev.filter((f) => f.field !== field),
      { field, op: 'in' as GridFilterOp, value: values },
    ]);
    this.page.set(1);
    void this.aplicarCambio();
  }

  /** Filtro de texto con operador (contains, startsWith, etc.). */
  setTextFilter(field: string, op: string, value: string): void {
    this.filters.update((prev) => [
      ...prev.filter((f) => f.field !== field),
      { field, op: op as GridFilterOp, value },
    ]);
    this.page.set(1);
    void this.aplicarCambio();
  }

  /** Filtro de rango numérico de una columna. */
  setRangeFilter(
    field: string,
    op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'clear',
    value?: number,
    value2?: number,
  ): void {
    if (op === 'clear') {
      this.clearFieldFilter(field);
      return;
    }
    this.filters.update((prev) => {
      const next = prev.filter((f) => f.field !== field);
      if (op === 'between') {
        if (value !== undefined) next.push({ field, op: 'gte', value });
        if (value2 !== undefined) next.push({ field, op: 'lte', value: value2 });
      } else if (value !== undefined) {
        next.push({ field, op: op as GridFilterOp, value });
      }
      return next;
    });
    this.page.set(1);
    void this.aplicarCambio();
  }

  /** Filtro de rango de fechas (gte/lte) de una columna 'date'. */
  setDateFilter(field: string, from?: string, to?: string): void {
    this.filters.update((prev) => {
      const next = prev.filter((f) => f.field !== field);
      // Sentinel: '__NULL__' significa "filtrar por vacíos".
      if (from === '__NULL__') {
        next.push({ field, op: 'isnull', value: true });
      } else {
        if (from) next.push({ field, op: 'gte', value: from });
        if (to) next.push({ field, op: 'lte', value: to });
      }
      return next;
    });
    this.page.set(1);
    void this.aplicarCambio();
  }

  updateSort(field: string, dir?: 'asc' | 'desc'): void {
    if (field === this.sortField() && !dir) {
      this.sortDir.update((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set(dir || 'asc');
    }
    this.page.set(1);
    void this.aplicarCambio();
  }

  setPage(p: number): void {
    this.page.set(p);
    void this.aplicarCambio();
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    void this.aplicarCambio();
  }

  /** Request base para distincts (filtros en cascada + búsqueda). */
  buildDistinctRequest(): DistinctBaseRequest {
    return {
      filters: filtersToApiFormat(this.filters(), this.allColumnDefs()),
      search: this.search().trim() || undefined,
    };
  }

  // ── Columnas: reorden/toggles/anchos + persistencia ────────────────────────

  /** Drag en la tabla o selector: aplica y persiste DE INMEDIATO. */
  setColumnsAndSave(nuevas: ColumnConfig[]): void {
    this.columns.set(nuevas);
    this.immediateSave(this.buildCurrentState(), 'columns_changed');
  }

  /** Cambios en vivo del selector (se persiste al cerrar). */
  setColumns(nuevas: ColumnConfig[]): void {
    this.columns.set(nuevas);
  }

  persistColumns(): void {
    this.immediateSave(this.buildCurrentState(), 'columns_changed');
  }

  setColumnWidths(widths: Record<string, number>): void {
    this.widths = { ...widths };
    this.immediateSave(this.buildCurrentState(), 'columns_changed');
  }

  notifyRowOpened(): void {
    this.immediateSave(this.buildCurrentState(), 'row_opened');
  }

  // ── Persistencia ──────────────────────────────────────────────────────────

  private async doSave(state: GridState, eventType: GridEventType): Promise<void> {
    try {
      const event: GridEventRequest = {
        ...state,
        sessionId: getGridSessionId(),
        eventType,
      };
      await this.api.saveGridEvent(event);
    } catch (err) {
      console.error('[SuscripcionGridState] Auto-save falló:', err);
    }
  }

  private debouncedSave(state: GridState, eventType: GridEventType): void {
    this.pendiente = { state, eventType };
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (this.pendiente) {
        void this.doSave(this.pendiente.state, this.pendiente.eventType);
        this.pendiente = null;
      }
    }, DEBOUNCE_MS);
  }

  private immediateSave(state: GridState, eventType: GridEventType): void {
    // Cancela el debounce pendiente: este estado ya es el más reciente.
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.pendiente = null;
    void this.doSave(state, eventType);
  }

  ngOnDestroy(): void {
    // Flush del guardado pendiente (no perder el último cambio).
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      if (this.pendiente) {
        void this.doSave(this.pendiente.state, this.pendiente.eventType);
      }
    }
  }
}
