// Tabla de columnas dinámicas de Métricas y Reportes: numeración, encabezados
// ordenables con filtro por columna sobre la página cargada, formato de moneda
// por columna y paginación del servidor.
// Paridad de las tablas de InfoGerencialDesempenoTab / InfoGerencialReportesTab.

import { Component, computed, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { GridPaginationComponent } from '../../../shared/components/grid-pagination.component';
import { ColumnFilterComponent } from '../ui/column-filter.component';
import {
  SortDirection,
  SortableTableHeadComponent,
} from '../ui/sortable-table-head.component';
import {
  COLUMNAS_ANCHAS,
  PAGE_SIZE_OPTIONS,
  TableRow,
  formatCurrency,
  numeroDeCelda,
} from './info-gerencial.api';

@Component({
  selector: 'alma-ig-table',
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
          Cargando …
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
                    <th class="border-none px-1 py-3 text-center" [class]="claseColumna(col)">
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
                </tr>
              </thead>
              <tbody>
                @for (row of filas(); track $index; let i = $index) {
                  <tr>
                    <td class="text-center text-xs font-medium">
                      {{ (currentPage() - 1) * pageSize() + i + 1 }}
                    </td>
                    @for (col of columns(); track col) {
                      <td
                        class="text-center text-xs"
                        [class]="esNumerica(col) ? 'font-mono' : ''"
                      >
                        {{ celda(row, col) }}
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td
                      [attr.colspan]="columns().length + 1"
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
export class IgTableComponent {
  readonly columns = input.required<string[]>();
  readonly rows = input.required<TableRow[]>();
  readonly loading = input.required<boolean>();
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly totalRecords = input.required<number>();
  /** Etiqueta visible de cada columna (la clave del dato no cambia). */
  readonly etiquetaDe = input.required<(col: string) => string>();
  /** Columnas que se pintan como moneda. */
  readonly columnasMoneda = input<Set<string>>(new Set(['ValorComision']));
  /** Al cambiar, se limpian los filtros de columna. */
  readonly filtersResetKey = input(0);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly tamanos = PAGE_SIZE_OPTIONS;
  protected readonly sort = signal<{ key: string; direction: SortDirection }>({
    key: '',
    direction: null,
  });
  private readonly columnFilters = signal<Record<string, string[]>>({});

  constructor() {
    effect(() => {
      this.filtersResetKey();
      this.columnFilters.set({});
      this.sort.set({ key: '', direction: null });
    });
  }

  protected etiqueta(col: string): string {
    return this.etiquetaDe()(col);
  }

  protected claseColumna(col: string): string {
    return COLUMNAS_ANCHAS.has(col) ? 'min-w-[200px]' : '';
  }

  protected esNumerica(col: string): boolean {
    return (
      this.columnasMoneda().has(col) || col === 'ContratoCorto' || col === 'ContratoLargo'
    );
  }

  protected celda(row: TableRow, col: string): string {
    const v = row[col];
    if (v === null || v === undefined) return '';
    if (this.columnasMoneda().has(col)) {
      const n = numeroDeCelda(v);
      if (n !== null) return formatCurrency(n);
    }
    return String(v);
  }

  protected valoresDe(col: string): string[] {
    return this.rows().map((r) => this.celda(r, col));
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

  protected ordenar(key: string): void {
    this.sort.update((prev) => {
      let direction: SortDirection = 'asc';
      if (prev.key === key && prev.direction === 'asc') direction = 'desc';
      else if (prev.key === key && prev.direction === 'desc') direction = null;
      return { key, direction };
    });
  }

  /** Filtra por columna y ordena (numérico cuando ambos valores lo son). */
  protected readonly filas = computed(() => {
    const filtros = Object.entries(this.columnFilters());
    const filas = this.rows().filter((row) =>
      filtros.every(
        ([col, valores]) => valores.length === 0 || valores.includes(this.celda(row, col)),
      ),
    );

    const { key, direction } = this.sort();
    if (!key || !direction) return filas;
    return [...filas].sort((a, b) => {
      const na = numeroDeCelda(a[key]);
      const nb = numeroDeCelda(b[key]);
      if (na !== null && nb !== null) return direction === 'asc' ? na - nb : nb - na;
      const c = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'es');
      return direction === 'asc' ? c : -c;
    });
  });
}
