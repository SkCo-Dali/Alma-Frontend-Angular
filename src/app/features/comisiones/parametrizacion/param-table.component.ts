// Tabla genérica de Parametrización: las 8 secciones tienen la misma mecánica
// (encabezados ordenables, filtro por columna, interruptor de activo, menú de acciones y
// paginación), así que se describen por columnas en vez de repetir ocho tablas casi
// idénticas.

import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaSwitchComponent } from '../../../shared/components/alma-switch.component';
import { GridPaginationComponent } from '../../../shared/components/grid-pagination.component';
import { PortalDirective } from '../../../shared/portal.directive';
import { colocarPanel } from '../../../shared/popover-position';
import { ColumnFilterComponent } from '../ui/column-filter.component';
import { DateColumnFilterComponent } from '../ui/date-column-filter.component';
import {
  SortDirection,
  SortableTableHeadComponent,
} from '../ui/sortable-table-head.component';
import {
  fmtFechaCorta,
  fmtFechaHora,
  fmtMoneda,
  fmtPorcentaje,
} from './parametrizacion.domain';

export type ParamColumnTipo =
  | 'texto'
  | 'mono'
  | 'moneda'
  | 'moneda2'
  | 'porcentaje'
  | 'fecha'
  | 'fechaHora'
  | 'siNo'
  | 'chipPrimario'
  | 'chipMuted'
  | 'estado'
  | 'switch';

export interface ParamColumn {
  key: string;
  label: string;
  tipo?: ParamColumnTipo;
  /** Por defecto 'texto'; 'fecha' usa el filtro en cascada. */
  filtro?: 'texto' | 'fecha' | 'ninguno';
}

export type ParamRow = Record<string, unknown>;

export const PARAM_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 300, 400, 500] as const;

@Component({
  selector: 'alma-param-table',
  imports: [
    LucideAngularModule,
    AlmaSwitchComponent,
    PortalDirective,
    GridPaginationComponent,
    ColumnFilterComponent,
    DateColumnFilterComponent,
    SortableTableHeadComponent,
  ],
  template: `
    @if (rows().length === 0) {
      <div class="py-8 text-center text-sm text-muted-foreground">
        <p>{{ mensajeVacio() }}</p>
      </div>
    } @else {
      <div
        class="flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-[var(--table-surface)]"
      >
        <div
          class="scrollbar w-full overflow-auto"
          style="max-height: calc(100dvh - 200px); min-height: 280px"
        >
          <div class="w-full" [style.min-width]="anchoMinimo()">
            <table class="alma-table w-full border-separate border-spacing-0">
              <thead
                class="sticky top-0 z-20 bg-[var(--table-header)] backdrop-blur-md"
              >
                <tr>
                  @for (col of columns(); track col.key) {
                    <th
                      class="h-[48px] border-b border-border bg-[var(--table-header)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-foreground/65"
                    >
                      <alma-sortable-th
                        [label]="col.label"
                        [sortKey]="col.key"
                        [currentSortKey]="sort().key"
                        [direction]="sort().direction"
                        (sorted)="ordenar($event)"
                      >
                        @if (col.filtro !== 'ninguno') {
                          @if (col.filtro === 'fecha') {
                            <alma-date-column-filter
                              [column]="col.key"
                              [label]="col.label"
                              [fechas]="fechasDe(col.key)"
                              [currentFilters]="filtrosDe(col.key)"
                              (filterChange)="cambiarFiltro($event.column, $event.values)"
                            />
                          } @else {
                            <alma-column-filter
                              [column]="col.key"
                              [label]="col.label"
                              [valores]="valoresDe(col)"
                              [currentFilters]="filtrosDe(col.key)"
                              (filterChange)="cambiarFiltro($event.column, $event.values)"
                            />
                          }
                        }
                      </alma-sortable-th>
                    </th>
                  }
                  @if (conAcciones()) {
                    <th
                      class="sticky right-0 z-30 h-[48px] w-[100px] border-b border-border bg-[var(--table-header)] px-3 py-1 text-center text-xs font-semibold uppercase tracking-wider text-foreground/65"
                    >
                      Acciones
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of pagina(); track $index) {
                  <tr class="group transition-colors hover:bg-primary/5">
                    @for (col of columns(); track col.key) {
                      <td
                        class="whitespace-nowrap border-b border-border px-3 py-2 text-center text-xs"
                      >
                        @switch (col.tipo) {
                          @case ('switch') {
                            <div class="flex items-center justify-center gap-2">
                              <span
                                class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                                [class]="
                                  verdadero(row, col.key)
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'
                                "
                              >
                              {{ verdadero(row, col.key) ? 'Activo' : 'Inactivo' }}
                            </span>
                              @if (conAcciones()) {
                                <alma-switch
                                  [checked]="verdadero(row, col.key)"
                                  (checkedChange)="alternar.emit({ row: row, activo: $event })"
                                  ariaLabel="Activar o desactivar"
                                />
                              }
                            </div>
                          }
                          @case ('chipPrimario') {
                            <span class="rounded-md bg-primary/10 px-2 py-1 text-primary">
                              {{ texto(row, col) }}
                            </span>
                          }
                          @case ('chipMuted') {
                            <span class="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                              {{ texto(row, col) }}
                            </span>
                          }
                          @case ('estado') {
                            <span
                              class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                              [class]="
                                texto(row, col) === 'Completado'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                              "
                            >
                              {{ texto(row, col) }}
                            </span>
                          }
                          @case ('mono') {
                            <span class="font-mono">{{ texto(row, col) }}</span>
                          }
                          @case ('moneda') {
                            <span class="font-semibold text-primary">{{ texto(row, col) }}</span>
                          }
                          @case ('moneda2') {
                            <span class="font-semibold text-primary">{{ texto(row, col) }}</span>
                          }
                          @case ('porcentaje') {
                            <span class="font-mono font-bold text-primary">
                              {{ texto(row, col) }}
                            </span>
                          }
                          @default {
                            {{ texto(row, col) }}
                          }
                        }
                      </td>
                    }
                    @if (conAcciones()) {
                      <td
                        class="sticky right-0 z-10 border-b border-border bg-[var(--table-surface)] px-3 py-2 text-center group-hover:[background-color:color-mix(in_srgb,var(--primary)_5%,var(--table-surface))]"
                      >
                        <div>
                          <button
                            type="button"
                            (click)="abrirMenu(row, $event)"
                            class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-foreground hover:bg-transparent hover:text-primary"
                            aria-label="Acciones de la fila"
                          >
                            <lucide-icon name="more-horizontal" [size]="16" />
                          </button>
                          @if (menu() === row) {
                            <div almaPortal class="fixed inset-0 z-[80]" (click)="menu.set(null)"></div>
                            <div
                              #panel
                              almaPortal
                              class="surface-solid fixed z-[85] min-w-[160px] rounded-xl border border-border p-1 text-left text-sm normal-case tracking-normal text-foreground shadow-[var(--shadow-lg)]"
                            >
                              <button
                                type="button"
                                (click)="editar.emit(row); menu.set(null)"
                                class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50"
                              >
                                <lucide-icon name="pencil" [size]="16" class="text-primary" />
                                Editar
                              </button>
                              <button
                                type="button"
                                (click)="eliminar.emit(row); menu.set(null)"
                                class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                              >
                                <lucide-icon name="trash-2" [size]="16" />
                                Eliminar
                              </button>
                            </div>
                          }
                        </div>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-auto border-t bg-[var(--table-surface)] px-4">
          <alma-grid-pagination
            [currentPage]="pageActual()"
            [totalPages]="totalPaginas()"
            [total]="filtradas().length"
            [itemsPerPage]="itemsPerPage()"
            [pageSizeOptions]="tamanos"
            surfaceClass=""
            (pageChange)="pageChange.emit($event)"
            (itemsPerPageChange)="itemsPerPageChange.emit($event)"
          />
        </div>
      </div>
    }
  `,
})
export class ParamTableComponent {
  readonly columns = input.required<ParamColumn[]>();
  /** Filas ya filtradas por la búsqueda de la sección. */
  readonly rows = input.required<ParamRow[]>();
  readonly page = input(1);
  readonly itemsPerPage = input(20);
  readonly conAcciones = input(true);
  readonly mensajeVacio = input('No se encontraron registros.');
  readonly anchoMinimo = input('900px');

  readonly pageChange = output<number>();
  readonly itemsPerPageChange = output<number>();
  readonly editar = output<ParamRow>();
  readonly eliminar = output<ParamRow>();
  readonly alternar = output<{ row: ParamRow; activo: boolean }>();

  protected readonly tamanos = PARAM_PAGE_SIZE_OPTIONS;
  protected readonly menu = signal<ParamRow | null>(null);
  private anchor: DOMRect | null = null;

  /** El menú se monta en <body> y se coloca bajo el botón (como el Dropdown). */
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchor) colocarPanel(el.nativeElement, this.anchor, 'end');
  }

  protected abrirMenu(row: ParamRow, ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.menu() === row) {
      this.menu.set(null);
      return;
    }
    this.anchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.menu.set(row);
  }
  protected readonly sort = signal<{ key: string; direction: SortDirection }>({
    key: '',
    direction: null,
  });
  private readonly columnFilters = signal<Record<string, string[]>>({});

  /** Texto que muestra la celda; los filtros comparan contra este valor. */
  protected texto(row: ParamRow, col: ParamColumn): string {
    const v = row[col.key];
    switch (col.tipo) {
      case 'moneda':
        return fmtMoneda(v);
      case 'moneda2':
        return fmtMoneda(v, 2);
      case 'porcentaje':
        return fmtPorcentaje(v);
      case 'fecha':
        return fmtFechaCorta(v);
      case 'fechaHora':
        return fmtFechaHora(v);
      case 'siNo':
        return v ? 'Sí' : 'No';
      case 'switch':
        return v ? 'Activo' : 'Inactivo';
      default:
        return v === null || v === undefined || v === '' ? '-' : String(v);
    }
  }

  protected verdadero(row: ParamRow, key: string): boolean {
    return Boolean(row[key]);
  }

  protected valoresDe(col: ParamColumn): string[] {
    return this.rows().map((r) => this.texto(r, col));
  }

  protected fechasDe(key: string): (string | undefined)[] {
    return this.rows().map((r) => {
      const v = r[key];
      return v ? String(v) : undefined;
    });
  }

  protected filtrosDe(key: string): string[] {
    return this.columnFilters()[key] ?? [];
  }

  protected cambiarFiltro(key: string, valores: string[]): void {
    this.columnFilters.update((prev) => {
      const next = { ...prev };
      if (valores.length === 0) delete next[key];
      else next[key] = valores;
      return next;
    });
  }

  protected ordenar(key: string): void {
    this.sort.update((prev) => {
      let direction: SortDirection = 'asc';
      if (prev.key === key && prev.direction === 'asc') direction = 'desc';
      else if (prev.key === key && prev.direction === 'desc') direction = null;
      return { key, direction };
    });
  }

  protected readonly filtradas = computed(() => {
    const filtros = Object.entries(this.columnFilters());
    const cols = this.columns();
    const filas = this.rows().filter((row) =>
      filtros.every(([key, valores]) => {
        if (valores.length === 0) return true;
        const col = cols.find((c) => c.key === key);
        return valores.includes(col ? this.texto(row, col) : String(row[key] ?? ''));
      }),
    );

    const { key, direction } = this.sort();
    if (!key || !direction) return filas;
    return [...filas].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        const c = av.localeCompare(bv, 'es');
        return direction === 'asc' ? c : -c;
      }
      const c = (av as number) < (bv as number) ? -1 : 1;
      return direction === 'asc' ? c : -c;
    });
  });

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.filtradas().length / this.itemsPerPage())),
  );

  /** La página se acota por si el filtro dejó menos páginas que la actual. */
  protected readonly pageActual = computed(() =>
    Math.min(this.page(), this.totalPaginas()),
  );

  protected readonly pagina = computed(() => {
    const desde = (this.pageActual() - 1) * this.itemsPerPage();
    return this.filtradas().slice(desde, desde + this.itemsPerPage());
  });
}
