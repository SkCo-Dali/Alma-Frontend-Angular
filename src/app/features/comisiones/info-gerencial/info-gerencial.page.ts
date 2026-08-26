// Métricas y Reportes: pestaña Desempeño (filtros + 3 gráficas + tabla de comisiones) y
// pestaña Reportes (8 reportes con la misma tabla).

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent, SkDropdownComponent } from '@skandia/ui';
import { Tabs, TabList, Tab as PTab, TabPanels, TabPanel } from 'primeng/tabs';
import { AuthService } from '../../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../../shared/components/access-denied.component';
import { IgChartsComponent } from './ig-charts.component';
import { IgTableToolbarComponent } from './ig-table-toolbar.component';
import { IgTableComponent } from './ig-table.component';
import {
  COLUMNAS_MONEDA,
  FilterOption,
  InfoGerencialFilters,
  REPORT_TYPES,
  ReportType,
  etiquetaColumnaDesempeno,
  etiquetaColumnaReporte,
  formatCurrency,
  formatPeriodo,
  ultimaActualizacion,
} from './info-gerencial.api';
import { InfoGerencialStore } from './info-gerencial.store';

@Component({
  selector: 'alma-info-gerencial-page',
  providers: [InfoGerencialStore],
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    SkButtonComponent,
    SkDropdownComponent,
    AccessDeniedComponent,
    IgChartsComponent,
    IgTableComponent,
    IgTableToolbarComponent,
    Tabs,
    TabList,
    PTab,
    TabPanels,
    TabPanel,
  ],
  template: `
    @if (!tieneAcceso()) {
      <alma-access-denied />
    } @else {
      <div class="w-full">
        <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
            <a
              routerLink="/apps/motor-comisiones"
              class="alma-btn h-9 w-fit shrink-0 gap-2 rounded-xl px-3 text-muted-foreground hover:text-foreground"
            >
              <lucide-icon name="arrow-left" [size]="16" />
              Volver
            </a>
            <h1 class="text-lg font-bold tracking-tight sm:text-xl">Métricas y Reportes</h1>
          </div>

          <!-- Pestañas -->
          <p-tabs [value]="tab()" (valueChange)="onTabChange($any($event))" [lazy]="true">
            <div class="flex justify-center">
              <p-tablist aria-label="Vistas de Métricas y Reportes">
                @for (v of vistas; track v.id) {
                  <p-tab [value]="v.id" class="inline-flex items-center gap-2">
                    <lucide-icon [name]="v.icon" [size]="16" class="shrink-0" />
                    {{ v.label }}
                  </p-tab>
                }
              </p-tablist>
            </div>
            <p-tabpanels>
                <p-tabpanel
                  value="desempeno"
                  class="glass mt-4 overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]"
                >
                  <div class="p-3 md:p-6">
                <div class="mb-6 space-y-6 rounded-2xl bg-[var(--surface-sunken)] p-3 md:p-6">
                  <!-- Filtros (se aplican al pulsar Filtrar) -->
                  <div
                    class="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div class="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      @for (f of filtros; track f.key) {
                        <sk-dropdown
                          [options]="opcionesFiltro(f)"
                          fluid
                          class="h-10"
                          [disabled]="store.filtrosCargando() || store.metricasCargando()"
                          [ngModel]="valorFiltro(f.key)"
                          (ngModelChange)="store.setBorrador(f.key, $event)"
                        />
                      }
                    </div>
                    <sk-button
                      type="button"
                      variant="primary"
                      label="Filtrar"
                      class="h-10 w-full shrink-0 rounded-lg px-8 text-sm font-semibold lg:w-auto lg:min-w-[110px]"
                      [disabled]="store.metricasCargando()"
                      (clicked)="store.aplicarFiltros()"
                    />
                  </div>

                  <alma-ig-charts
                    [channelData]="store.canales()"
                    [monthlyData]="store.meses()"
                    [ruleData]="store.reglas()"
                    [periodTotal]="store.totalPeriodo()"
                    [loading]="store.metricasCargando()"
                  />
                </div>

                <div class="mt-4 overflow-hidden bg-card">
                  <alma-ig-table-toolbar
                    [search]="busquedaComisiones()"
                    [buscando]="store.comisionesCargando()"
                    [monthFilter]="store.periodoComisiones()"
                    [monthOptions]="store.filterOptions().periods"
                    [itemsPerPage]="pageSizeComisiones()"
                    [periodoLabel]="periodoComisionesLabel()"
                    [totalLabel]="totalComisionesLabel()"
                    [exportando]="exportando()"
                    (searchChange)="busquedaComisiones.set($event)"
                    (buscar)="store.cargarComisiones({ page: 1, search: busquedaComisiones().trim() || undefined })"
                    (monthChange)="store.cargarComisiones({ page: 1, selectedPeriodo: $event })"
                    (itemsPerPageChange)="store.cargarComisiones({ page: 1, pageSize: $event })"
                    (exportar)="exportarComisiones()"
                  />

                  <alma-ig-table
                    [columns]="store.comisiones()?.columns ?? []"
                    [rows]="store.comisiones()?.data ?? []"
                    [loading]="store.comisionesCargando()"
                    [currentPage]="store.comisiones()?.page ?? 1"
                    [pageSize]="pageSizeComisiones()"
                    [totalPages]="store.comisiones()?.total_pages ?? 1"
                    [totalRecords]="store.comisiones()?.total_records ?? 0"
                    [etiquetaDe]="etiquetaDesempeno"
                    (pageChange)="store.cargarComisiones({ page: $event })"
                    (pageSizeChange)="store.cargarComisiones({ page: 1, pageSize: $event })"
                  />
                </div>

                <div
                  class="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground"
                >
                  <lucide-icon name="clock-3" [size]="16" />
                  {{ actualizacion }}
                </div>
              </div>
                </p-tabpanel>
                <p-tabpanel
                  value="reportes"
                  class="glass mt-4 overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]"
                >
                  <div class="p-3 md:p-6">
                <!-- Selector de reporte -->
                <div class="flex justify-center border-b border-border/30 pb-3">
                  <p-tabs
                    [value]="store.reporteActivo()"
                    (valueChange)="cambiarReporte($any($event))"
                  >
                    <p-tablist
                      aria-label="Tipo de reporte"
                      class="glass flex max-w-full flex-wrap justify-center gap-1 rounded-2xl bg-[var(--surface-sunken)] p-1 px-2 md:rounded-full"
                    >
                      @for (r of reportes; track r.value) {
                        <p-tab [value]="r.value">{{ r.label }}</p-tab>
                      }
                    </p-tablist>
                  </p-tabs>
                </div>

                <div class="mt-4 overflow-hidden bg-card">
                  <alma-ig-table-toolbar
                    [search]="busquedaReporte()"
                    [buscando]="store.reporteCargando()"
                    [monthFilter]="store.periodoReporte()"
                    [monthOptions]="store.filterOptions().periods"
                    [itemsPerPage]="pageSizeReporte()"
                    [periodoLabel]="periodoReporteLabel()"
                    [totalLabel]="totalReporteLabel()"
                    [exportando]="exportando()"
                    (searchChange)="busquedaReporte.set($event)"
                    (buscar)="store.cargarReporte({ page: 1, search: busquedaReporte().trim() || undefined })"
                    (monthChange)="store.cargarReporte({ page: 1, selectedPeriodo: $event })"
                    (itemsPerPageChange)="store.cargarReporte({ page: 1, pageSize: $event })"
                    (exportar)="exportarReporte()"
                  />

                  <alma-ig-table
                    [columns]="store.reporte()?.columns ?? []"
                    [rows]="store.reporte()?.data ?? []"
                    [loading]="store.reporteCargando()"
                    [currentPage]="store.reporte()?.page ?? 1"
                    [pageSize]="pageSizeReporte()"
                    [totalPages]="store.reporte()?.total_pages ?? 1"
                    [totalRecords]="store.reporte()?.total_records ?? 0"
                    [etiquetaDe]="etiquetaReporte"
                    [columnasMoneda]="columnasMoneda"
                    [filtersResetKey]="resetFiltrosReporte()"
                    (pageChange)="store.cargarReporte({ page: $event })"
                    (pageSizeChange)="store.cargarReporte({ page: 1, pageSize: $event })"
                  />
                </div>

                <div
                  class="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground"
                >
                  <lucide-icon name="clock-3" [size]="16" />
                  {{ actualizacion }}
                </div>
              </div>
                </p-tabpanel>
              </p-tabpanels>
            </p-tabs>
        </div>
      </div>
    }
  `,
})
export class InfoGerencialPageComponent implements OnInit {
  protected readonly store = inject(InfoGerencialStore);
  private readonly auth = inject(AuthService);

  protected readonly tab = signal<'desempeno' | 'reportes'>('desempeno');
  protected readonly vistas: { id: 'desempeno' | 'reportes'; label: string; icon: string }[] = [
    { id: 'desempeno', label: 'Desempeño', icon: 'activity' },
    { id: 'reportes', label: 'Reportes', icon: 'bar-chart-3' },
  ];
  protected readonly reportes = REPORT_TYPES;
  protected readonly columnasMoneda = COLUMNAS_MONEDA;
  protected readonly actualizacion = ultimaActualizacion();
  protected readonly etiquetaDesempeno = etiquetaColumnaDesempeno;
  protected readonly etiquetaReporte = etiquetaColumnaReporte;

  protected readonly filtros: { key: keyof InfoGerencialFilters; label: string }[] = [
    { key: 'period', label: 'Periodo' },
    { key: 'channel', label: 'Canal' },
    { key: 'company', label: 'Compañía' },
    { key: 'product', label: 'Producto' },
  ];

  protected readonly busquedaComisiones = signal('');
  protected readonly busquedaReporte = signal('');
  protected readonly exportando = signal(false);
  protected readonly resetFiltrosReporte = signal(0);
  private reportesCargados = false;

  protected readonly tieneAcceso = computed(() =>
    this.auth.hasPermission('app.motor-comisiones.view'),
  );

  protected readonly pageSizeComisiones = computed(
    () => this.store.comisiones()?.page_size ?? 200,
  );
  protected readonly pageSizeReporte = computed(() => this.store.reporte()?.page_size ?? 200);

  protected readonly periodoComisionesLabel = computed(() => {
    const p = this.store.comisiones()?.periodo_seleccionado;
    return p ? formatPeriodo(p) : '—';
  });

  protected readonly totalComisionesLabel = computed(() => {
    const c = this.store.comisiones();
    return c ? formatCurrency(c.total_comisiones) : '—';
  });

  protected readonly periodoReporteLabel = computed(() => {
    const p = this.store.reporte()?.periodo_seleccionado;
    return p ? formatPeriodo(p) : '—';
  });

  protected readonly totalReporteLabel = computed(() => {
    const r = this.store.reporte();
    return r ? formatCurrency(r.total_comisiones) : '—';
  });

  ngOnInit(): void {
    void this.store.cargarFiltros();
    void this.store.cargarMetricas();
    this.store.reiniciarComisiones();
  }

  protected valorFiltro(key: keyof InfoGerencialFilters): string {
    return this.store.borrador()[key];
  }

  protected opciones(key: keyof InfoGerencialFilters) {
    const o = this.store.filterOptions();
    if (key === 'period') return o.periods;
    if (key === 'channel') return o.channels;
    if (key === 'company') return o.companies;
    return o.products;
  }

  protected opcionesFiltro(f: { key: keyof InfoGerencialFilters; label: string }): FilterOption[] {
    return [{ value: 'all', label: f.label }, ...this.opciones(f.key)];
  }

  protected onTabChange(t: 'desempeno' | 'reportes'): void {
    if (t === 'reportes') {
      this.irAReportes();
    } else {
      this.tab.set('desempeno');
    }
  }

  /** El reporte se pide la primera vez que se entra a la pestaña. */
  protected irAReportes(): void {
    this.tab.set('reportes');
    if (!this.reportesCargados) {
      this.reportesCargados = true;
      this.store.reiniciarReporte();
    }
  }

  protected cambiarReporte(tipo: ReportType): void {
    this.busquedaReporte.set('');
    this.resetFiltrosReporte.update((n) => n + 1);
    this.store.cambiarReporte(tipo);
  }

  protected async exportarComisiones(): Promise<void> {
    this.exportando.set(true);
    try {
      await this.store.exportarComisiones();
    } finally {
      this.exportando.set(false);
    }
  }

  protected async exportarReporte(): Promise<void> {
    this.exportando.set(true);
    try {
      await this.store.exportarReporte();
    } finally {
      this.exportando.set(false);
    }
  }
}
