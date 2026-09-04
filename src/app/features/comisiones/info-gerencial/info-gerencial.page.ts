// Métricas y Reportes: pestaña Desempeño (filtros + 3 gráficas + tabla de comisiones) y
// pestaña Reportes (8 reportes con la misma tabla).

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../../shared/components/access-denied.component';
import { IgChartsComponent } from './ig-charts.component';
import { IgTableToolbarComponent } from './ig-table-toolbar.component';
import { IgTableComponent } from './ig-table.component';
import {
  COLUMNAS_MONEDA,
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
    AccessDeniedComponent,
    IgChartsComponent,
    IgTableComponent,
    IgTableToolbarComponent,
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
          <div class="flex justify-center">
            <div
              class="glass inline-flex gap-1 rounded-full bg-[var(--surface-sunken)] p-1"
            >
              <button
                type="button"
                (click)="tab.set('desempeno')"
                class="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all"
                [class]="
                  tab() === 'desempeno'
                    ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
                    : 'text-muted-foreground hover:text-foreground'
                "
              >
                <lucide-icon name="activity" [size]="16" class="shrink-0" />
                Desempeño
              </button>
              <button
                type="button"
                (click)="irAReportes()"
                class="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all"
                [class]="
                  tab() === 'reportes'
                    ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
                    : 'text-muted-foreground hover:text-foreground'
                "
              >
                <lucide-icon name="bar-chart-3" [size]="16" class="shrink-0" />
                Reportes
              </button>
            </div>
          </div>

          <div class="glass mt-4 overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
            @if (tab() === 'desempeno') {
              <div class="p-3 md:p-6">
                <div class="mb-6 space-y-6 rounded-2xl bg-[var(--surface-sunken)] p-3 md:p-6">
                  <!-- Filtros (se aplican al pulsar Filtrar) -->
                  <div
                    class="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div class="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      @for (f of filtros; track f.key) {
                        <select
                          class="alma-input h-10"
                          [disabled]="store.filtrosCargando() || store.metricasCargando()"
                          [ngModel]="valorFiltro(f.key)"
                          (ngModelChange)="store.setBorrador(f.key, $event)"
                        >
                          <option value="all">{{ f.label }}</option>
                          @for (o of opciones(f.key); track o.value) {
                            <option [value]="o.value">{{ o.label }}</option>
                          }
                        </select>
                      }
                    </div>
                    <button
                      type="button"
                      (click)="store.aplicarFiltros()"
                      [disabled]="store.metricasCargando()"
                      class="alma-btn alma-btn-primary h-10 w-full shrink-0 rounded-lg px-8 text-sm font-semibold lg:w-auto lg:min-w-[110px]"
                    >
                      Filtrar
                    </button>
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
            } @else {
              <div class="p-3 md:p-6">
                <!-- Selector de reporte -->
                <div class="flex justify-center border-b border-border/30 pb-3">
                  <div
                    class="glass flex max-w-full flex-wrap justify-center gap-1 rounded-2xl bg-[var(--surface-sunken)] p-1 px-2 md:rounded-full"
                  >
                    @for (r of reportes; track r.value) {
                      <button
                        type="button"
                        (click)="cambiarReporte(r.value)"
                        class="cursor-pointer whitespace-nowrap rounded-full px-2 py-2.5 text-sm font-semibold transition-colors"
                        [class]="
                          store.reporteActivo() === r.value
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-transparent text-muted-foreground hover:text-foreground'
                        "
                      >
                        {{ r.label }}
                      </button>
                    }
                  </div>
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
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class InfoGerencialPageComponent implements OnInit {
  protected readonly store = inject(InfoGerencialStore);
  private readonly auth = inject(AuthService);

  protected readonly tab = signal<'desempeno' | 'reportes'>('desempeno');
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
