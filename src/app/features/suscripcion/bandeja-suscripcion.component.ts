// Bandeja del Motor de Suscripción — grid server-side: filtros por tipo de dato en cada
// encabezado, reorden de columnas arrastrando, selector "Columnas", búsqueda con Enter,
// anchos redimensionables con auto-fit y persistencia server-side vía grid-events. El
// JOURNEY de etapas saca sus conteos de POST /distincts {field:'EstadoPipeline'} SIN
// filtros, y el clic en una etapa aplica/quita el filtro discreto de la columna
// EstadoPipeline. El detalle vive en /apps/suscripcion/{id}.

import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { GridPaginationComponent } from '../../shared/components/grid-pagination.component';
import { ColumnSelectorComponent } from './grid/column-selector.component';
import { GridSearchComponent } from './grid/grid-search.component';
import { SimuladorBotonComponent } from './simulador/simulador-boton.component';
import { SuscripcionGridApi, SuscripcionGridItem } from './grid/suscripcion-grid.api';
import { STICKY_GRID_COLUMNS, SuscripcionGridStore } from './grid/suscripcion-grid.store';
import { SuscripcionGridTableComponent } from './grid/suscripcion-grid-table.component';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

type FamiliaEtapa = 'sky' | 'amber' | 'primary' | 'emerald' | 'destructive';

interface EtapaJourney {
  clave: string;
  label: string;
  /** Valor traducido que expone la columna EstadoPipeline (filtro/conteo). */
  pipelineLabel: string;
  familia: FamiliaEtapa;
  /** Rama de salida (no va en la línea del flujo). */
  terminal?: boolean;
}

const ETAPAS_JOURNEY: EtapaJourney[] = [
  { clave: 'recibida', label: 'Recibida', pipelineLabel: 'Recibida', familia: 'sky' },
  { clave: 'en_estudio', label: 'En estudio', pipelineLabel: 'En Estudio', familia: 'amber' },
  { clave: 'emitida', label: 'Emitida', pipelineLabel: 'Emitida', familia: 'primary' },
  {
    clave: 'primer_pago',
    label: 'Primer pago',
    pipelineLabel: 'Primer Pago Realizado',
    familia: 'emerald',
  },
  {
    clave: 'rechazada',
    label: 'Rechazadas',
    pipelineLabel: 'Rechazada',
    familia: 'destructive',
    terminal: true,
  },
  {
    clave: 'retractada',
    label: 'Retractadas',
    pipelineLabel: 'Retractada',
    familia: 'amber',
    terminal: true,
  },
];

/** Relleno de la cápsula seleccionada (por familia). */
const CAPSULE_ACTIVE: Record<FamiliaEtapa, string> = {
  sky: 'border-sky-500 bg-sky-500 text-white',
  amber: 'border-amber-500 bg-amber-500 text-white',
  primary: 'border-primary bg-primary text-primary-foreground',
  emerald: 'border-emerald-500 bg-emerald-500 text-white',
  destructive: 'border-destructive bg-destructive text-white',
};

/** Color del número cuando la cápsula NO está seleccionada. */
const CAPSULE_COUNT: Record<FamiliaEtapa, string> = {
  sky: 'text-sky-600 dark:text-sky-400',
  amber: 'text-amber-600 dark:text-amber-400',
  primary: 'text-primary',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  destructive: 'text-destructive',
};

/** Hover del chip inactivo: borde + fondo teñidos con el color de la familia. */
const CAPSULE_HOVER: Record<FamiliaEtapa, string> = {
  sky: 'hover:border-sky-500/50 hover:bg-sky-500/10',
  amber: 'hover:border-amber-500/50 hover:bg-amber-500/10',
  primary: 'hover:border-primary/50 hover:bg-primary/10',
  emerald: 'hover:border-emerald-500/50 hover:bg-emerald-500/10',
  destructive: 'hover:border-destructive/50 hover:bg-destructive/10',
};

@Component({
  selector: 'alma-bandeja-suscripcion',
  providers: [SuscripcionGridStore],
  imports: [
    LucideAngularModule,
    AlmaLoaderComponent,
    GridPaginationComponent,
    GridSearchComponent,
    SimuladorBotonComponent,
    ColumnSelectorComponent,
    SuscripcionGridTableComponent,
  ],
  template: `
    @if (!grid.stateLoaded() || grid.columnsLoading()) {
      <div data-full-bleed class="flex w-full flex-col items-center gap-4 p-16">
        <alma-loader [size]="90" />
        <p class="text-sm text-muted-foreground">Cargando bandeja de suscripción…</p>
      </div>
    } @else {
      <div data-full-bleed class="w-full space-y-3">
        <!-- Toolbar en UNA sola fila: búsqueda (izq) · filtro por etapa (centro) ·
             Columnas + Simulador (der). Los grupos izq y der crecen por igual
             (flex-1), así el filtro —de ancho natural— queda flanqueado por
             espacios iguales = CENTRADO REAL, sin encoger el buscador. -->
        <div class="flex flex-wrap items-center gap-3">
          <!-- Izquierda: solo búsqueda + spinner de refresco -->
          <div class="flex flex-1 items-center gap-2">
            <alma-grid-search
              [searchTerm]="grid.search()"
              (searchChange)="grid.updateSearch($event)"
            />
            @if (grid.isFetching() && !grid.isLoading()) {
              <lucide-icon
                name="refresh-cw"
                [size]="14"
                class="animate-spin text-muted-foreground"
              />
            }
          </div>

          <!-- Centro: filtro por etapa SIEMPRE centrado entre los grupos
               laterales (ancho natural, sin flex-1). El botón "Limpiar" flota a
               su derecha con posición ABSOLUTA (no ocupa espacio de layout), así
               el filtro no se descentra al aparecer/desaparecer. -->
          <div class="relative flex max-w-full shrink-0 items-center justify-center">
            <div
              class="glass flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl px-3 py-2 shadow-[var(--shadow-md)]"
            >
              <span
                class="mr-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground"
              >
                <lucide-icon name="filter" [size]="14" /> Filtrar por etapa
              </span>
              <div class="mx-0.5 h-6 w-px shrink-0 bg-border"></div>

              <!-- Etapas del flujo (unidas por flechas → que marcan el avance) -->
              @for (etapa of lineales; track etapa.clave; let i = $index) {
                <button
                  type="button"
                  (click)="clickEtapa(etapa.clave)"
                  [title]="tituloChip(etapa)"
                  [attr.aria-pressed]="etapaSeleccionada() === etapa.clave"
                  class="flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors"
                  [class]="
                    etapaSeleccionada() === etapa.clave
                      ? capsuleActive[etapa.familia] + ' shadow-sm'
                      : 'border-border bg-card/70 text-foreground ' + capsuleHover[etapa.familia]
                  "
                >
                  <span
                    class="text-base font-bold leading-none tabular-nums"
                    [class]="
                      etapaSeleccionada() === etapa.clave ? '' : capsuleCount[etapa.familia]
                    "
                  >
                    {{ conteos()[etapa.clave] || 0 }}
                  </span>
                  <span
                    class="text-xs font-semibold leading-none"
                    [class]="
                      etapaSeleccionada() === etapa.clave ? 'opacity-90' : 'text-muted-foreground'
                    "
                  >
                    {{ etapa.label }}
                  </span>
                </button>
                @if (i < lineales.length - 1) {
                  <lucide-icon
                    name="arrow-right"
                    [size]="16"
                    aria-hidden="true"
                    class="shrink-0 text-muted-foreground/60"
                  />
                }
              }

              <!-- Separador sutil hacia las salidas del flujo -->
              <div class="mx-0.5 h-6 w-px shrink-0 bg-border/70"></div>

              @for (etapa of terminales; track etapa.clave) {
                <button
                  type="button"
                  (click)="clickEtapa(etapa.clave)"
                  [title]="tituloChip(etapa)"
                  [attr.aria-pressed]="etapaSeleccionada() === etapa.clave"
                  class="flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors"
                  [class]="
                    etapaSeleccionada() === etapa.clave
                      ? capsuleActive[etapa.familia] + ' shadow-sm'
                      : 'border-border bg-card/70 text-foreground ' + capsuleHover[etapa.familia]
                  "
                >
                  <span
                    class="text-base font-bold leading-none tabular-nums"
                    [class]="
                      etapaSeleccionada() === etapa.clave ? '' : capsuleCount[etapa.familia]
                    "
                  >
                    {{ conteos()[etapa.clave] || 0 }}
                  </span>
                  <span
                    class="text-xs font-semibold leading-none"
                    [class]="
                      etapaSeleccionada() === etapa.clave ? 'opacity-90' : 'text-muted-foreground'
                    "
                  >
                    {{ etapa.label }}
                  </span>
                </button>
              }

              @if (etapaSeleccionada()) {
                <div class="mx-0.5 h-6 w-px shrink-0 bg-border/70"></div>
                <button
                  type="button"
                  (click)="grid.clearFieldFilter('EstadoPipeline')"
                  class="flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <lucide-icon name="x" [size]="14" /> Ver todas
                </button>
              }
            </div>

            @if (grid.camposFiltrados() > 0 || grid.search()) {
              <button
                type="button"
                (click)="limpiarTodo()"
                class="absolute left-full top-1/2 ml-2 flex h-7 -translate-y-1/2 items-center whitespace-nowrap rounded-lg px-2 text-xs text-primary hover:bg-primary/10"
              >
                <lucide-icon name="x" [size]="14" class="mr-1" />
                {{ etiquetaLimpiar() }}
              </button>
            }
          </div>

          <!-- Derecha: selector de columnas + disparador del simulador -->
          <div class="flex flex-1 items-center justify-end gap-2">
            <alma-column-selector
              [columns]="grid.columns()"
              [requiredKeys]="stickyKeys"
              (columnsChange)="grid.setColumns($event)"
              (closed)="grid.persistColumns()"
            />
            <alma-simulador-boton />
          </div>
        </div>

        @if (grid.error(); as err) {
          <div
            class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive"
          >
            No fue posible cargar el grid: {{ err }}
          </div>
        }

        <!-- Shell de la tabla + paginación -->
        <div
          class="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-[var(--table-surface)] shadow-[var(--shadow-md)]"
        >
          <alma-suscripcion-grid-table
            [data]="grid.data()"
            [columns]="grid.columns()"
            [allColumnDefs]="grid.allColumnDefs()"
            [sortField]="grid.sortField()"
            [sortDir]="grid.sortDir()"
            [filters]="grid.filters()"
            [buildDistinctRequest]="distinctRequestFn"
            [isLoading]="grid.isLoading()"
            [initialColumnWidths]="grid.savedColumnWidths()"
            [emptyHint]="emptyHint()"
            (sorted)="grid.updateSort($event.field, $event.dir)"
            (rowClick)="abrirDetalle($event)"
            (columnsChange)="grid.setColumnsAndSave($event)"
            (columnWidthsChange)="grid.setColumnWidths($event)"
            (discreteFilterChange)="grid.setDiscreteFilter($event.field, $event.values)"
            (textFilterChange)="grid.setTextFilter($event.field, $event.op, $event.value)"
            (rangeFilterChange)="
              grid.setRangeFilter($event.field, $event.op, $event.value, $event.value2)
            "
            (dateFilterChange)="grid.setDateFilter($event.field, $event.from, $event.to)"
            (clearFilter)="grid.clearFieldFilter($event)"
          />
          <div class="mt-auto border-t bg-[var(--table-surface)] px-4">
            <alma-grid-pagination
              [currentPage]="grid.page()"
              [totalPages]="grid.totalPages() || 1"
              [total]="grid.total()"
              [itemsPerPage]="grid.pageSize()"
              [pageSizeOptions]="pageSizes"
              (pageChange)="grid.setPage($event)"
              (itemsPerPageChange)="grid.setPageSize($event)"
            />
          </div>
        </div>
      </div>
    }
  `,
})
export class BandejaSuscripcionComponent {
  protected readonly grid = inject(SuscripcionGridStore);
  private readonly api = inject(SuscripcionGridApi);
  private readonly router = inject(Router);

  protected readonly stickyKeys = STICKY_GRID_COLUMNS;
  protected readonly pageSizes = PAGE_SIZE_OPTIONS;
  protected readonly lineales = ETAPAS_JOURNEY.filter((e) => !e.terminal);
  protected readonly terminales = ETAPAS_JOURNEY.filter((e) => e.terminal);
  protected readonly capsuleActive = CAPSULE_ACTIVE;
  protected readonly capsuleCount = CAPSULE_COUNT;
  protected readonly capsuleHover = CAPSULE_HOVER;

  /** Fn estable para los distincts (los hijos la reciben como input). */
  protected readonly distinctRequestFn = () => this.grid.buildDistinctRequest();

  private readonly conteosRaw = signal<Record<string, number>>({});

  protected readonly conteos = computed(() => this.conteosRaw());

  /** Etapa seleccionada, DERIVADA del filtro discreto actual de EstadoPipeline
   *  (una sola fuente de verdad: los filtros del grid). */
  protected readonly etapaSeleccionada = computed(() => {
    const filtro = this.grid
      .filters()
      .find((f) => f.field === 'EstadoPipeline' && f.op === 'in');
    if (!filtro || !Array.isArray(filtro.value) || filtro.value.length !== 1) return null;
    const valor = String(filtro.value[0]);
    return ETAPAS_JOURNEY.find((e) => e.pipelineLabel === valor)?.clave ?? null;
  });

  protected readonly emptyHint = computed(() =>
    this.grid.camposFiltrados() > 0 || this.grid.search()
      ? 'Ajusta o limpia los filtros y la búsqueda.'
      : 'El worker sincroniza cada 5 minutos.',
  );

  protected readonly etiquetaLimpiar = computed(() => {
    const conFiltros = this.grid.camposFiltrados() > 0;
    const conBusqueda = Boolean(this.grid.search());
    if (conFiltros && conBusqueda) return 'Limpiar filtros y búsqueda';
    return conFiltros ? 'Limpiar filtros' : 'Limpiar búsqueda';
  });

  constructor() {
    void this.grid.init();
    void this.cargarConteos();
  }

  /** Conteos del journey: distincts de EstadoPipeline SIN filtros. */
  private async cargarConteos(): Promise<void> {
    try {
      const res = await this.api.fetchDistinctValues({ field: 'EstadoPipeline' });
      const porLabel = new Map<string, number>();
      let total = 0;
      for (const v of res.values) {
        total += v.count;
        if (v.value != null) porLabel.set(String(v.value), v.count);
      }
      const m: Record<string, number> = { todas: total };
      for (const e of ETAPAS_JOURNEY) m[e.clave] = porLabel.get(e.pipelineLabel) ?? 0;
      this.conteosRaw.set(m);
    } catch {
      this.conteosRaw.set({});
    }
  }

  protected tituloChip(etapa: EtapaJourney): string {
    const count = this.conteos()[etapa.clave] || 0;
    return this.etapaSeleccionada() === etapa.clave
      ? `Quitar filtro: ${etapa.label}`
      : `Filtrar por ${etapa.label} (${count})`;
  }

  protected clickEtapa(clave: string): void {
    if (this.etapaSeleccionada() === clave) {
      this.grid.clearFieldFilter('EstadoPipeline');
      return;
    }
    const etapa = ETAPAS_JOURNEY.find((e) => e.clave === clave);
    if (etapa) this.grid.setDiscreteFilter('EstadoPipeline', [etapa.pipelineLabel]);
  }

  protected limpiarTodo(): void {
    if (this.grid.camposFiltrados() > 0) this.grid.updateFilters([]);
    if (this.grid.search()) this.grid.updateSearch('');
  }

  protected abrirDetalle(row: SuscripcionGridItem): void {
    this.grid.notifyRowOpened();
    void this.router.navigate(['/apps/suscripcion', row.Id]);
  }
}
