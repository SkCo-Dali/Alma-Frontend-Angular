// Tabla genérica de las pestañas de datos del motor: columnas dinámicas (las que
// devuelve el API), numeración de fila, orden y filtro por columna en cliente sobre la
// página cargada, y paginación del servidor.

import { Component, computed, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { GridPaginationComponent } from '../../../shared/components/grid-pagination.component';
import { ColumnFilterComponent } from '../ui/column-filter.component';
import {
  SortDirection,
  SortableTableHeadComponent,
} from '../ui/sortable-table-head.component';
import {
  MOTOR_PAGE_SIZE_OPTIONS,
  MotorTableRow,
  formatMotorCellValue,
  motorRowsToObjects,
  sortMotorRows,
} from './motor.api';

/** Chip de estado de envío en la tabla de correos. */
const COLOR_ESTADO: Record<string, string> = {
  Pendiente: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Excluido: 'bg-muted text-muted-foreground',
  Enviado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  Error: 'bg-destructive/10 text-destructive',
};

@Component({
  selector: 'alma-motor-data-table',
  imports: [
    LucideAngularModule,
    GridPaginationComponent,
    ColumnFilterComponent,
    SortableTableHeadComponent,
  ],
  template: `
    <div class="flex h-[480px] max-h-[480px] min-h-0 flex-col">
      @if (loading()) {
        <div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <lucide-icon name="loader-2" [size]="24" class="mr-2 animate-spin" />
          Cargando datos…
        </div>
      } @else {
        <div class="scrollbar min-h-0 flex-1 overflow-auto">
          <div class="min-w-max">
            <table class="alma-table w-full">
              <thead class="sticky top-0 z-20 bg-[var(--table-header)] backdrop-blur-md">
                <tr>
                  <th class="border-none px-1 py-3 text-center">
                    <div
                      class="inline-flex items-center justify-center rounded-[6px] bg-muted px-3.5 py-1.5 text-xs font-bold"
                    >
                      #
                    </div>
                  </th>
                  @for (col of columns(); track col) {
                    <th class="border-none px-1 py-3 text-center">
                      <alma-sortable-th
                        [label]="etiqueta(col)"
                        [sortKey]="col"
                        [currentSortKey]="sort().key"
                        [direction]="sort().direction"
                        (sorted)="ordenar($event)"
                      >
                        <alma-column-filter
                          [column]="col"
                          [label]="etiqueta(col)"
                          [valores]="valoresDe(col)"
                          [currentFilters]="filtrosDe(col)"
                          (filterChange)="cambiarFiltro($event.column, $event.values)"
                        />
                      </alma-sortable-th>
                    </th>
                  }
                  @if (conAcciones()) {
                    <th class="border-none px-1 py-3 text-center">
                      <div
                        class="inline-flex items-center justify-center rounded-[6px] bg-muted px-3.5 py-1.5 text-xs font-bold"
                      >
                        Acciones
                      </div>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of filas(); track $index; let i = $index) {
                  <tr>
                    <td class="text-center text-xs font-medium">
                      {{ (currentPage() - 1) * pageSize() + i + 1 }}
                    </td>
                    @for (col of columns(); track col) {
                      <td class="whitespace-nowrap text-center text-xs">
                        @if (col === 'EstadoEnvio') {
                          <span
                            class="rounded px-2 py-0.5 text-[10px] font-semibold"
                            [class]="colorEstado(valor(row, col))"
                          >
                            {{ valor(row, col) }}
                          </span>
                        } @else {
                          {{ valor(row, col) }}
                        }
                      </td>
                    }
                    @if (conAcciones()) {
                      <td class="py-2 text-center">
                        <div class="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            [disabled]="!esPendiente(row)"
                            (click)="editar.emit(row)"
                            class="h-7 w-7 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 disabled:opacity-30 dark:bg-sky-500/10 dark:text-sky-300"
                            aria-label="Editar destinatario"
                          >
                            <lucide-icon name="pencil" [size]="14" />
                          </button>
                          <button
                            type="button"
                            [disabled]="!esPendiente(row)"
                            (click)="excluir.emit(row)"
                            class="h-7 w-7 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-30"
                            aria-label="Excluir del envío"
                          >
                            <lucide-icon name="x" [size]="14" />
                          </button>
                        </div>
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td
                      [attr.colspan]="columns().length + 1 + (conAcciones() ? 1 : 0)"
                      class="py-12 text-center text-muted-foreground"
                    >
                      No hay registros para los filtros seleccionados.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    <alma-grid-pagination
      [currentPage]="currentPage()"
      [totalPages]="totalPages()"
      [total]="totalRecords()"
      [itemsPerPage]="pageSize()"
      [pageSizeOptions]="tamanos"
      (pageChange)="pageChange.emit($event)"
      (itemsPerPageChange)="pageSizeChange.emit($event)"
    />
  `,
})
export class MotorDataTableComponent {
  readonly columns = input.required<string[]>();
  readonly rows = input.required<unknown[][]>();
  readonly loading = input.required<boolean>();
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly totalRecords = input.required<number>();
  /** Etiquetas visibles distintas al nombre de columna (la clave no cambia). */
  readonly columnLabels = input<Record<string, string>>({});
  readonly conAcciones = input(false);
  /** Al subir, se limpian los filtros de columna (cambio de filtros arriba). */
  readonly filtersResetKey = input(0);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly editar = output<MotorTableRow>();
  readonly excluir = output<MotorTableRow>();

  protected readonly tamanos = MOTOR_PAGE_SIZE_OPTIONS;
  protected readonly sort = signal<{ key: string; direction: SortDirection }>({
    key: '',
    direction: null,
  });
  private readonly columnFilters = signal<Record<string, string[]>>({});

  private readonly objetos = computed(() => motorRowsToObjects(this.columns(), this.rows()));

  protected readonly filas = computed(() => {
    const filtros = Object.entries(this.columnFilters());
    const filtradas = this.objetos().filter((row) =>
      filtros.every(
        ([col, valores]) =>
          valores.length === 0 || valores.includes(formatMotorCellValue(row[col])),
      ),
    );
    return sortMotorRows(filtradas, this.sort().key, this.sort().direction);
  });

  constructor() {
    effect(() => {
      this.filtersResetKey();
      this.columnFilters.set({});
    });
  }

  protected etiqueta(col: string): string {
    return this.columnLabels()[col] ?? col;
  }

  protected valor(row: MotorTableRow, col: string): string {
    return formatMotorCellValue(row[col]);
  }

  protected valoresDe(col: string): string[] {
    return this.objetos().map((r) => formatMotorCellValue(r[col]));
  }

  protected filtrosDe(col: string): string[] {
    return this.columnFilters()[col] ?? [];
  }

  protected cambiarFiltro(col: string, valores: string[]): void {
    this.columnFilters.update((prev) => {
      const next = { ...prev };
      if (valores.length === 0) delete next[col];
      else next[col] = valores;
      return next;
    });
  }

  /** asc → desc → sin orden. */
  protected ordenar(key: string): void {
    this.sort.update((prev) => {
      let direction: SortDirection = 'asc';
      if (prev.key === key && prev.direction === 'asc') direction = 'desc';
      else if (prev.key === key && prev.direction === 'desc') direction = null;
      return { key, direction };
    });
  }

  protected colorEstado(estado: string): string {
    return COLOR_ESTADO[estado] || 'bg-muted text-muted-foreground';
  }

  /** Solo los correos pendientes se pueden editar o excluir. */
  protected esPendiente(row: MotorTableRow): boolean {
    return row['EstadoEnvio'] === 'Pendiente';
  }
}
