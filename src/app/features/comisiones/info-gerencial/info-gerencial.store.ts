// Estado de Métricas y Reportes.
//
// Reglas conservadas del original:
// - Los filtros de arriba se editan en borrador y solo se aplican al pulsar
//   "Filtrar"; las métricas se recalculan con los aplicados.
// - La tabla es paginada por el servidor. El periodo solo se manda cuando el
//   usuario lo elige; si no, el backend decide y su `periodo_seleccionado` es
//   el que se muestra (y el que se usa al exportar).
// - La búsqueda se aplica al pulsar Buscar o Enter, nunca al teclear.

import { Injectable, computed, inject, signal } from '@angular/core';
import { ComisionesToast } from '../comisiones-toast.service';
import {
  ApiMetricsResponse,
  ApiTableResponse,
  DEFAULT_FILTERS,
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTER_OPTIONS,
  InfoGerencialApi,
  InfoGerencialFilters,
  ReportType,
  mapCanales,
  mapMeses,
  mapReglas,
  totalSerie,
} from './info-gerencial.api';

interface EstadoTabla {
  page: number;
  pageSize: number;
  /** Periodo elegido en el desplegable; sin él, el GET va sin `periodo`. */
  selectedPeriodo?: string;
  search?: string;
}

const estadoInicial = (): EstadoTabla => ({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

@Injectable()
export class InfoGerencialStore {
  private readonly api = inject(InfoGerencialApi);
  private readonly toast = inject(ComisionesToast);

  readonly filterOptions = signal(EMPTY_FILTER_OPTIONS);
  readonly filtrosCargando = signal(false);

  readonly borrador = signal<InfoGerencialFilters>({ ...DEFAULT_FILTERS });
  readonly aplicados = signal<InfoGerencialFilters>({ ...DEFAULT_FILTERS });

  readonly metricas = signal<ApiMetricsResponse | null>(null);
  readonly metricasCargando = signal(false);

  readonly comisiones = signal<ApiTableResponse | null>(null);
  readonly comisionesCargando = signal(false);
  private estadoComisiones: EstadoTabla = estadoInicial();

  readonly reporte = signal<ApiTableResponse | null>(null);
  readonly reporteCargando = signal(false);
  private estadoReporte: EstadoTabla = estadoInicial();
  readonly reporteActivo = signal<ReportType>('reporte_contabilidad');

  // ── Derivados de las gráficas ─────────────────────────────────────────────

  readonly canales = computed(() => {
    const m = this.metricas();
    return m ? mapCanales(m.por_canal, m.total_comisiones) : [];
  });

  readonly reglas = computed(() => {
    const m = this.metricas();
    return m ? mapReglas(m.por_regla) : [];
  });

  readonly meses = computed(() => {
    const m = this.metricas();
    return m ? mapMeses(m.serie_periodo) : [];
  });

  readonly totalPeriodo = computed(() => {
    const m = this.metricas();
    return m ? totalSerie(m.serie_periodo) : 0;
  });

  // ── Carga ─────────────────────────────────────────────────────────────────

  async cargarFiltros(): Promise<void> {
    this.filtrosCargando.set(true);
    try {
      this.filterOptions.set(await this.api.getFilters());
    } catch (e) {
      this.toast.errorGenerico('fetch', e instanceof Error ? e.message : String(e));
    } finally {
      this.filtrosCargando.set(false);
    }
  }

  async cargarMetricas(): Promise<void> {
    this.metricasCargando.set(true);
    try {
      this.metricas.set(await this.api.getMetrics(this.aplicados()));
    } catch (e) {
      this.toast.errorGenerico(
        'fetch',
        e instanceof Error ? e.message : 'No se pudieron cargar las métricas',
      );
    } finally {
      this.metricasCargando.set(false);
    }
  }

  aplicarFiltros(): void {
    this.aplicados.set({ ...this.borrador() });
    void this.cargarMetricas();
  }

  setBorrador(key: keyof InfoGerencialFilters, valor: string): void {
    this.borrador.update((prev) => ({ ...prev, [key]: valor }));
  }

  // ── Tabla de comisiones ───────────────────────────────────────────────────

  async cargarComisiones(cambios: Partial<EstadoTabla> = {}): Promise<void> {
    const estado = { ...this.estadoComisiones, ...cambios };
    this.comisionesCargando.set(true);
    try {
      const res = await this.api.getCommissions({
        page: estado.page,
        page_size: estado.pageSize,
        periodo: estado.selectedPeriodo,
        search: estado.search,
      });
      this.comisiones.set(res);
      this.estadoComisiones = {
        page: res.page,
        pageSize: res.page_size,
        selectedPeriodo: estado.selectedPeriodo,
        search: estado.search,
      };
    } catch (e) {
      this.toast.errorGenerico(
        'fetch',
        e instanceof Error ? e.message : 'No se pudieron cargar las comisiones',
      );
    } finally {
      this.comisionesCargando.set(false);
    }
  }

  reiniciarComisiones(): void {
    this.estadoComisiones = estadoInicial();
    this.comisiones.set(null);
    void this.cargarComisiones();
  }

  /** El desplegable muestra la selección del usuario o la que decidió el API. */
  readonly periodoComisiones = computed(
    () =>
      this.estadoComisiones.selectedPeriodo ??
      (this.comisiones()?.periodo_seleccionado
        ? String(this.comisiones()?.periodo_seleccionado)
        : undefined),
  );

  async exportarComisiones(): Promise<void> {
    const periodo = this.periodoComisiones();
    if (!periodo) {
      this.toast.errorGenericoConMensaje('No hay un periodo seleccionado para exportar');
      return;
    }
    try {
      await this.api.exportCommissions(periodo);
    } catch (e) {
      this.toast.errorGenerico(
        'fetch',
        e instanceof Error ? e.message : 'No se pudo descargar el archivo CSV',
      );
    }
  }

  // ── Reportes ──────────────────────────────────────────────────────────────

  async cargarReporte(cambios: Partial<EstadoTabla> = {}): Promise<void> {
    const estado = { ...this.estadoReporte, ...cambios };
    this.reporteCargando.set(true);
    try {
      const res = await this.api.getReport(this.reporteActivo(), {
        page: estado.page,
        page_size: estado.pageSize,
        periodo: estado.selectedPeriodo,
        search: estado.search,
      });
      this.reporte.set(res);
      this.estadoReporte = {
        page: res.page,
        pageSize: res.page_size,
        selectedPeriodo: estado.selectedPeriodo,
        search: estado.search,
      };
    } catch (e) {
      this.toast.errorGenerico(
        'fetch',
        e instanceof Error ? e.message : 'No se pudo cargar el reporte',
      );
    } finally {
      this.reporteCargando.set(false);
    }
  }

  /** Cambiar de reporte reinicia página, búsqueda y periodo. */
  cambiarReporte(tipo: ReportType): void {
    this.reporteActivo.set(tipo);
    this.estadoReporte = estadoInicial();
    this.reporte.set(null);
    void this.cargarReporte();
  }

  reiniciarReporte(): void {
    this.estadoReporte = estadoInicial();
    this.reporte.set(null);
    void this.cargarReporte();
  }

  readonly periodoReporte = computed(
    () =>
      this.estadoReporte.selectedPeriodo ??
      (this.reporte()?.periodo_seleccionado
        ? String(this.reporte()?.periodo_seleccionado)
        : undefined),
  );

  async exportarReporte(): Promise<void> {
    const periodo = this.periodoReporte();
    if (!periodo) {
      this.toast.errorGenericoConMensaje('No hay un periodo seleccionado para exportar');
      return;
    }
    try {
      await this.api.exportReport(this.reporteActivo(), periodo);
    } catch (e) {
      this.toast.errorGenerico(
        'fetch',
        e instanceof Error ? e.message : 'No se pudo descargar el archivo CSV',
      );
    }
  }
}
