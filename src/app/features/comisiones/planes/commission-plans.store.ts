// Estado de la página de Planes de Compensación (port de useCommissionPlans).
//
// Lógica NO negociable conservada del original:
// - Paginación, tamaño de página y página actual SEPARADOS por estado (tab).
// - Los conteos de cada tab salen de un GET por estado con page_size=1 (solo
//   interesa el `total`), así los badges no dependen de traer las filas.
// - Con filtros o orden activos NO se pagina en el servidor: se traen hasta
//   1000 planes del estado activo (páginas de 200) y se filtra/ordena/pagina
//   en cliente; sin filtros manda la página del API.
// - Cualquier cambio de búsqueda, filtro u orden resetea TODOS los tabs a la
//   página 1.
// - Los mensajes de error distinguen 403 (permiso), 404 y 409 (estado inválido).

import { Injectable, computed, inject, signal } from '@angular/core';
import { ComisionesToast } from '../comisiones-toast.service';
import {
  ALL_STATUSES,
  CommissionPlan,
  CommissionPlanStatus,
  CommissionPlansApi,
  CreateCommissionPlanRequest,
  UpdateCommissionPlanRequest,
  formatDateForAPI,
  mapApiPlanToUI,
} from './commission-plans.api';

export type SortDirection = 'asc' | 'desc' | null;

const MAX_TOTAL_FOR_FILTERS = 1000;
const PAGE_SIZE_BULK = 200;

const porEstado = <T>(valor: T): Record<CommissionPlanStatus, T> => ({
  published: valor,
  ready_to_approve: valor,
  draft: valor,
  rejected: valor,
  inactive: valor,
});

/** Producto y canal se derivan del nombre del plan (convención AIS_FRONT1_OMPEV). */
export function extractProduct(name: string): string {
  const parts = name.split('_');
  if (name.endsWith('%')) return parts[parts.length - 2] || '-';
  return parts[parts.length - 1] || '-';
}

export function extractChannel(name: string): string {
  return name.split('_')[0] || '-';
}

/** dd/MM/yyyy (los filtros de columna comparan contra el texto mostrado). */
export function fmtFecha(iso: string): string {
  const ymd = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

@Injectable()
export class CommissionPlansStore {
  private readonly api = inject(CommissionPlansApi);
  private readonly toast = inject(ComisionesToast);

  /** Página actual del API para el estado activo. */
  readonly plans = signal<CommissionPlan[]>([]);
  /** Hasta 1000 planes del estado activo (para filtrar/ordenar en cliente). */
  readonly allPlans = signal<CommissionPlan[]>([]);
  readonly loading = signal(true);
  readonly loadingAll = signal(false);
  readonly error = signal<string | null>(null);

  readonly activeStatus = signal<CommissionPlanStatus>('published');
  readonly currentPage = signal<Record<CommissionPlanStatus, number>>(porEstado(1));
  readonly itemsPerPage = signal<Record<CommissionPlanStatus, number>>(porEstado(20));
  readonly totalCounts = signal<Record<CommissionPlanStatus, number>>(porEstado(0));
  readonly total = signal(0);

  readonly searchTerm = signal('');
  readonly columnFilters = signal<Record<string, string[]>>({});
  readonly sortConfig = signal<{ key: string; direction: SortDirection }>({
    key: '',
    direction: null,
  });

  readonly hayFiltros = computed(
    () =>
      this.searchTerm().trim() !== '' || Object.keys(this.columnFilters()).length > 0,
  );

  private get ordenActivo(): boolean {
    const s = this.sortConfig();
    return Boolean(s.key && s.direction);
  }

  async init(): Promise<void> {
    await Promise.all([
      this.fetchPlansForStatus('published', 1, 20),
      this.fetchAllPlansForStatus('published'),
      this.fetchAllCounts(),
    ]);
  }

  /** Conteos de todos los estados (page_size=1: solo interesa el total). */
  private async fetchAllCounts(): Promise<void> {
    try {
      const resultados = await Promise.all(
        ALL_STATUSES.map((status) =>
          this.api
            .list(1, 1, status)
            .then((res) => ({ status, total: res.total }))
            .catch(() => ({ status, total: 0 })),
        ),
      );
      const counts = porEstado(0);
      for (const r of resultados) counts[r.status] = r.total;
      this.totalCounts.set(counts);
    } catch (e) {
      console.error('Error consultando conteos de planes:', e);
    }
  }

  /** Trae hasta 1000 planes del estado (páginas de 200) para filtros/orden. */
  private async fetchAllPlansForStatus(status: CommissionPlanStatus): Promise<void> {
    try {
      this.loadingAll.set(true);
      this.allPlans.set([]);
      const primera = await this.api.list(1, PAGE_SIZE_BULK, status);
      let todos = primera.items.map(mapApiPlanToUI);

      const limite = Math.min(primera.total, MAX_TOTAL_FOR_FILTERS);
      if (limite > PAGE_SIZE_BULK) {
        const paginas = Math.ceil(limite / PAGE_SIZE_BULK) - 1;
        const respuestas = await Promise.all(
          Array.from({ length: paginas }, (_, i) =>
            this.api.list(i + 2, PAGE_SIZE_BULK, status),
          ),
        );
        for (const res of respuestas) todos = [...todos, ...res.items.map(mapApiPlanToUI)];
      }
      this.allPlans.set(todos);
    } catch (e) {
      console.error('Error consultando todos los planes para filtros:', e);
    } finally {
      this.loadingAll.set(false);
    }
  }

  /** Página del estado indicado (la que pinta la tabla sin filtros). */
  private async fetchPlansForStatus(
    status: CommissionPlanStatus,
    page?: number,
    pageSize?: number,
  ): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);
      const p = page ?? this.currentPage()[status];
      const ps = pageSize ?? this.itemsPerPage()[status];
      const res = await this.api.list(p, ps, status);
      this.total.set(res.total);
      this.plans.set(res.items.map(mapApiPlanToUI));
      // El total del API es la fuente del badge de ESTE estado.
      this.totalCounts.update((prev) => ({ ...prev, [status]: res.total }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los planes';
      this.error.set(msg);
      this.toast.errorGenerico('fetch', msg);
    } finally {
      this.loading.set(false);
    }
  }

  /** Refresco completo tras una mutación. */
  private async refrescar(): Promise<void> {
    const status = this.activeStatus();
    await this.fetchPlansForStatus(status);
    await this.fetchAllPlansForStatus(status);
    await this.fetchAllCounts();
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────

  async createPlan(data: Partial<CommissionPlan>): Promise<CommissionPlan | null> {
    try {
      if (
        !data.name ||
        !data.description ||
        !data.startDate ||
        !data.endDate ||
        !data.assignmentType
      ) {
        throw new Error('Faltan campos obligatorios');
      }
      const payload: CreateCommissionPlanRequest = {
        name: data.name,
        description: data.description,
        start_date: formatDateForAPI(data.startDate),
        end_date: formatDateForAPI(data.endDate, true),
        assignment_type: data.assignmentType,
      };
      if (data.assignmentType !== 'all_users' && data.assignmentValue) {
        payload.assignment_value = data.assignmentValue;
      }
      const res = await this.api.create(payload);
      this.toast.ok('Plan creado', 'El plan de comisiones se creó correctamente.');
      await this.refrescar();
      return mapApiPlanToUI(res);
    } catch (e) {
      this.toast.errorMutacion(e, 'create');
      return null;
    }
  }

  async updatePlan(
    id: string,
    data: Partial<CommissionPlan>,
  ): Promise<CommissionPlan | null> {
    try {
      const payload: UpdateCommissionPlanRequest = {};
      if (data.name) payload.name = data.name;
      if (data.description) payload.description = data.description;
      if (data.startDate) payload.start_date = formatDateForAPI(data.startDate);
      if (data.endDate) payload.end_date = formatDateForAPI(data.endDate, true);
      if (data.assignmentType) payload.assignment_type = data.assignmentType;
      if (data.assignmentValue) payload.assignment_value = data.assignmentValue;

      const res = await this.api.update(id, payload);
      this.toast.ok('Plan actualizado', 'El plan de comisiones se actualizó.');
      await this.refrescar();
      return mapApiPlanToUI(res);
    } catch (e) {
      this.toast.errorMutacion(e, 'update');
      return null;
    }
  }

  async deletePlan(id: string): Promise<boolean> {
    try {
      await this.api.remove(id);
      this.toast.ok('Plan eliminado', 'El plan de comisiones se eliminó.');
      await this.refrescar();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('reglas asociadas')) {
        this.toast.errorGenericoConMensaje(
          'No se puede eliminar el plan: tiene reglas asociadas. Elimina primero las reglas.',
        );
      } else {
        this.toast.errorGenerico('delete', msg);
      }
      return false;
    }
  }

  /** Transiciones de estado; los errores distinguen 403/404/409. */
  private async transicion(
    accion: () => Promise<unknown>,
    okTitulo: string,
    okDescripcion: string,
    mensaje409: string,
    mensaje404?: string,
  ): Promise<boolean> {
    try {
      await accion();
      this.toast.ok(okTitulo, okDescripcion);
      await this.refrescar();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('403')) {
        this.toast.errorGenericoConMensaje('No tienes permiso para realizar esta acción.');
      } else if (mensaje404 && msg.includes('404')) {
        this.toast.errorGenericoConMensaje(mensaje404);
      } else if (msg.includes('409')) {
        this.toast.errorGenericoConMensaje(mensaje409);
      } else {
        this.toast.errorGenerico('toggle', msg);
      }
      return false;
    }
  }

  sendToApproval(id: string): Promise<boolean> {
    return this.transicion(
      () => this.api.sendToApproval(id),
      'Enviado a aprobación',
      'El plan quedó listo para aprobar.',
      'El plan debe tener al menos una regla activa y estar en borrador o rechazado.',
    );
  }

  rejectPlan(id: string, reason?: string): Promise<boolean> {
    return this.transicion(
      () => this.api.reject(id, reason),
      'Plan rechazado',
      'El plan se rechazó correctamente.',
      'El plan debe estar en "listo para aprobar" para poder rechazarse.',
    );
  }

  publishPlan(id: string): Promise<boolean> {
    return this.transicion(
      () => this.api.publish(id),
      'Plan publicado',
      'El plan se publicó correctamente.',
      'El plan debe tener al menos una regla activa y no estar publicado.',
    );
  }

  inactivatePlan(id: string, reason?: string): Promise<boolean> {
    return this.transicion(
      () => this.api.inactivate(id, reason),
      'Plan inactivado',
      'El plan se inactivó correctamente.',
      'El plan debe estar publicado para poder inactivarse.',
      'El plan no existe o fue eliminado.',
    );
  }

  // ── Navegación de tabs, páginas, filtros y orden ──────────────────────────

  private resetPaginas(): void {
    this.currentPage.set(porEstado(1));
  }

  setSearchTerm(term: string): void {
    this.searchTerm.set(term);
    this.resetPaginas();
  }

  handleStatusChange(status: CommissionPlanStatus): void {
    this.activeStatus.set(status);
    void this.fetchPlansForStatus(
      status,
      this.currentPage()[status],
      this.itemsPerPage()[status],
    );
    void this.fetchAllPlansForStatus(status);
  }

  handlePageChange(status: CommissionPlanStatus, page: number): void {
    this.currentPage.update((prev) => ({ ...prev, [status]: page }));
    // Con filtros/orden la paginación es en cliente: no hay que pedir al API.
    if (!this.hayFiltros() && !this.ordenActivo) {
      void this.fetchPlansForStatus(status, page);
    }
  }

  handleItemsPerPageChange(status: CommissionPlanStatus, items: number): void {
    this.itemsPerPage.update((prev) => ({ ...prev, [status]: items }));
    this.currentPage.update((prev) => ({ ...prev, [status]: 1 }));
    if (!this.hayFiltros() && !this.ordenActivo) {
      void this.fetchPlansForStatus(status, 1, items);
    }
  }

  handleColumnFilterChange(column: string, values: string[]): void {
    this.columnFilters.update((prev) => {
      const next = { ...prev };
      if (values.length === 0) delete next[column];
      else next[column] = values;
      return next;
    });
    this.resetPaginas();
  }

  handleClearColumnFilter(column: string): void {
    this.handleColumnFilterChange(column, []);
  }

  clearAllFilters(): void {
    this.searchTerm.set('');
    this.columnFilters.set({});
    this.sortConfig.set({ key: '', direction: null });
    this.resetPaginas();
  }

  /** Ciclo del orden: asc → desc → sin orden. */
  handleSort(key: string): void {
    this.sortConfig.update((prev) => {
      let direction: SortDirection = 'asc';
      if (prev.key === key && prev.direction === 'asc') direction = 'desc';
      else if (prev.key === key && prev.direction === 'desc') direction = null;
      return { key, direction };
    });
    this.resetPaginas();
  }

  // ── Derivados: filtrado, orden y paginación en cliente ────────────────────

  /** Texto que muestra la tabla para una columna (base de los filtros). */
  valorColumna(plan: CommissionPlan, column: string): string {
    if (column === 'product') return extractProduct(plan.name);
    if (column === 'channel') return extractChannel(plan.name);
    if (column === 'startDate') return fmtFecha(plan.startDate);
    if (column === 'endDate') return fmtFecha(plan.endDate);
    if (column === 'publishedOn')
      return plan.publishedOn ? fmtFecha(plan.publishedOn) : '-';
    return String((plan as unknown as Record<string, unknown>)[column] ?? '');
  }

  private aplicarFiltros(lista: CommissionPlan[]): CommissionPlan[] {
    const q = this.searchTerm().trim().toLowerCase();
    const filtros = Object.entries(this.columnFilters());
    return lista.filter((plan) => {
      if (q) {
        const coincide =
          plan.name.toLowerCase().includes(q) ||
          plan.description.toLowerCase().includes(q);
        if (!coincide) return false;
      }
      for (const [column, values] of filtros) {
        if (!values || values.length === 0) continue;
        if (!values.includes(this.valorColumna(plan, column))) return false;
      }
      return true;
    });
  }

  private ordenar(lista: CommissionPlan[]): CommissionPlan[] {
    const { key, direction } = this.sortConfig();
    if (!key || !direction) return lista;
    return [...lista].sort((a, b) => {
      let av: unknown;
      let bv: unknown;
      if (key === 'product') {
        av = extractProduct(a.name);
        bv = extractProduct(b.name);
      } else if (key === 'channel') {
        av = extractChannel(a.name);
        bv = extractChannel(b.name);
      } else {
        av = (a as unknown as Record<string, unknown>)[key];
        bv = (b as unknown as Record<string, unknown>)[key];
      }
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        const c = av.localeCompare(bv);
        return direction === 'asc' ? c : -c;
      }
      const c = (av as number) < (bv as number) ? -1 : 1;
      return direction === 'asc' ? c : -c;
    });
  }

  /** Filas a pintar para un estado (server-side sin filtros, cliente con ellos). */
  planesPaginados(status: CommissionPlanStatus): CommissionPlan[] {
    const conFiltros = this.hayFiltros() || this.ordenActivo;
    if (conFiltros && status === this.activeStatus()) {
      if (this.allPlans().length > 0) {
        const ordenados = this.ordenar(this.aplicarFiltros(this.allPlans()));
        const p = this.currentPage()[status];
        const ps = this.itemsPerPage()[status];
        return ordenados.slice((p - 1) * ps, (p - 1) * ps + ps);
      }
      // allPlans aún no llegó: se filtra la página actual como aproximación.
      return this.ordenar(this.aplicarFiltros(this.plans()));
    }
    return this.plans();
  }

  /** Conteo del badge de un tab (respeta filtros en el estado activo). */
  conteoTab(status: CommissionPlanStatus): number {
    const conFiltros = this.hayFiltros() || this.ordenActivo;
    if (!conFiltros) return this.totalCounts()[status] || 0;
    if (status === this.activeStatus() && this.allPlans().length > 0) {
      return this.aplicarFiltros(this.allPlans()).length;
    }
    return this.totalCounts()[status] || 0;
  }
}
