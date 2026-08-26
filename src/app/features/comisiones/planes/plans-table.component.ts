// Tabla de planes de compensación: columnas ordenables con filtro por columna (los de
// fecha usan el filtro en cascada), menú de fila y paginación.

import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent } from '@skandia/ui';
import { PortalDirective } from '../../../shared/portal.directive';
import { colocarPanel } from '../../../shared/popover-position';
import { GridPaginationComponent } from '../../../shared/components/grid-pagination.component';
import { ColumnFilterComponent } from '../ui/column-filter.component';
import { DateColumnFilterComponent } from '../ui/date-column-filter.component';
import {
  SortDirection,
  SortableTableHeadComponent,
} from '../ui/sortable-table-head.component';
import { CommissionPlan } from './commission-plans.api';
import {
  CommissionPlansStore,
  extractChannel,
  extractProduct,
  fmtFecha,
} from './commission-plans.store';
import { PlanEditorDialogComponent } from './plan-editor-dialog.component';

/** Máx. 200 por el límite de page_size del API de planes. */
export const PLANS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200] as const;

const COLUMNAS: { key: string; label: string; fecha?: boolean }[] = [
  { key: 'product', label: 'Producto' },
  { key: 'channel', label: 'Canal' },
  { key: 'name', label: 'Nombre' },
  { key: 'description', label: 'Descripción' },
  { key: 'startDate', label: 'Fecha Inicio', fecha: true },
  { key: 'endDate', label: 'Fecha Fin', fecha: true },
  { key: 'publishedOn', label: 'Publicado el', fecha: true },
];

@Component({
  selector: 'alma-plans-table',
  imports: [
    LucideAngularModule,
    SkButtonComponent,
    PortalDirective,
    GridPaginationComponent,
    ColumnFilterComponent,
    DateColumnFilterComponent,
    SortableTableHeadComponent,
    PlanEditorDialogComponent,
  ],
  template: `
    @if (plans().length === 0) {
      <div
        class="mx-4 my-8 rounded-xl border-2 border-dashed border-border/50 bg-muted/20 py-12 text-center text-muted-foreground"
      >
        <p class="text-lg font-medium">No se encontraron planes</p>
        <p class="text-sm">Intenta ajustar los filtros o la búsqueda.</p>
      </div>
    } @else {
      <div
        class="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-[var(--table-surface)] shadow-[var(--shadow-md)]"
      >
        <div class="w-full bg-[var(--table-surface)]">
          <div
            class="scrollbar w-full overflow-auto bg-[var(--table-surface)]"
            style="height: calc(100dvh - 260px); min-height: 240px"
          >
            <div class="w-full min-w-[1000px] bg-[var(--table-surface)]">
              <table class="alma-table w-full border-separate border-spacing-0">
                <thead
                  class="sticky top-0 z-20 border-b bg-[var(--table-header)] backdrop-blur-md"
                >
                  <tr>
                    @for (col of columnas; track col.key) {
                      <th
                        class="h-[48px] border-b border-border bg-[var(--table-header)] px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-foreground/65"
                      >
                        <alma-sortable-th
                          [label]="col.label"
                          [sortKey]="col.key"
                          [currentSortKey]="store.sortConfig().key"
                          [direction]="store.sortConfig().direction"
                          (sorted)="store.handleSort($event)"
                        >
                          @if (col.fecha) {
                            <alma-date-column-filter
                              [column]="col.key"
                              [label]="col.label"
                              [fechas]="fechasDe(col.key)"
                              [currentFilters]="filtrosDe(col.key)"
                              (filterChange)="
                                store.handleColumnFilterChange($event.column, $event.values)
                              "
                            />
                          } @else {
                            <alma-column-filter
                              [column]="col.key"
                              [label]="col.label"
                              [valores]="valoresDe(col.key)"
                              [currentFilters]="filtrosDe(col.key)"
                              (filterChange)="
                                store.handleColumnFilterChange($event.column, $event.values)
                              "
                            />
                          }
                        </alma-sortable-th>
                      </th>
                    }
                    <th
                      class="w-[100px] border-b border-border bg-[var(--table-header)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-foreground/65"
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-[var(--table-surface)]">
                  @for (p of plans(); track p.id) {
                    <tr class="group bg-[var(--table-surface)] transition-colors hover:bg-primary/5">
                      <td
                        class="whitespace-nowrap border-b border-border px-4 py-2 text-center text-xs font-medium"
                      >
                        <span class="rounded-md bg-primary/10 px-2 py-1 text-primary">
                          {{ producto(p) }}
                        </span>
                      </td>
                      <td
                        class="whitespace-nowrap border-b border-border px-4 py-2 text-center text-xs"
                      >
                        <span class="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                          {{ canal(p) }}
                        </span>
                      </td>
                      <td
                        class="select-all whitespace-nowrap border-b border-border px-4 py-2 text-xs font-semibold text-foreground"
                      >
                        {{ p.name }}
                      </td>
                      <td class="max-w-[300px] border-b border-border px-4 py-2">
                        <div class="truncate text-xs text-muted-foreground" [title]="p.description">
                          {{ p.description }}
                        </div>
                      </td>
                      <td
                        class="whitespace-nowrap border-b border-border px-4 py-2 text-center text-xs"
                      >
                        {{ fecha(p.startDate) }}
                      </td>
                      <td
                        class="whitespace-nowrap border-b border-border px-4 py-2 text-center text-xs"
                      >
                        {{ fecha(p.endDate) }}
                      </td>
                      <td
                        class="whitespace-nowrap border-b border-border px-4 py-2 text-center text-xs"
                      >
                        {{ p.publishedOn ? fecha(p.publishedOn) : '-' }}
                      </td>
                      <td
                        class="relative whitespace-nowrap border-b border-border px-4 py-2 text-center"
                      >
                        <button
                          type="button"
                          (click)="abrirMenu(p.id, $event)"
                          class="h-8 w-8 rounded-full transition-all hover:bg-primary/10 hover:text-primary"
                          aria-label="Acciones del plan"
                        >
                          <lucide-icon name="more-horizontal" [size]="16" />
                        </button>

                        @if (menu() === p.id) {
                          <div
                            almaPortal
                            class="fixed inset-0 z-[80]"
                            (click)="menu.set(null)"
                          ></div>
                          <div
                            #panel
                            almaPortal
                            class="surface-solid fixed z-[85] min-w-[170px] rounded-xl border border-border p-1 text-left text-sm normal-case tracking-normal text-foreground shadow-[var(--shadow-lg)]"
                          >
                            <button
                              type="button"
                              (click)="editar(p)"
                              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50"
                            >
                              <lucide-icon name="pencil" [size]="16" class="text-primary" />
                              Editar Plan
                            </button>
                            <button
                              type="button"
                              (click)="porBorrar.set(p); menu.set(null)"
                              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                            >
                              <lucide-icon name="trash-2" [size]="16" />
                              Eliminar Plan
                            </button>
                          </div>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="mt-auto border-t bg-[var(--table-surface)] px-4">
          <alma-grid-pagination
            [currentPage]="currentPage()"
            [totalPages]="totalPages()"
            [total]="totalCount()"
            [itemsPerPage]="itemsPerPage()"
            [pageSizeOptions]="pageSizeOptions"
            (pageChange)="store.handlePageChange(store.activeStatus(), $event)"
            (itemsPerPageChange)="
              store.handleItemsPerPageChange(store.activeStatus(), $event)
            "
          />
        </div>
      </div>
    }

    @if (porBorrar(); as p) {
      <div
        class="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
        (click)="porBorrar.set(null)"
      >
        <div
          class="surface-solid w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <h2 class="text-xl font-bold">Eliminar Plan de Comisiones</h2>
          <p class="mt-2 text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar
            <span class="font-bold text-foreground">"{{ p.name }}"</span>? Esta acción no
            se puede deshacer.
          </p>
          <div
            class="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive"
          >
            Aviso: Si este plan tiene reglas asociadas, debes eliminarlas primero.
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <sk-button
              variant="secondary"
              type="button"
              label="Cancelar"
              (clicked)="porBorrar.set(null)"
            />
            <sk-button
              variant="primary"
              severity="danger"
              type="button"
              [label]="borrando() ? 'Eliminando…' : 'Confirmar Eliminación'"
              [disabled]="borrando()"
              (clicked)="confirmarBorrado()"
            />
          </div>
        </div>
      </div>
    }

    @if (enEdicion(); as p) {
      <alma-plan-editor-dialog
        [plan]="p"
        [updatePlan]="actualizar"
        [sendToApproval]="enviarAAprobacion"
        [rejectPlan]="rechazar"
        [publishPlan]="publicar"
        [inactivatePlan]="inactivar"
        (closed)="enEdicion.set(null)"
      />
    }
  `,
})
export class PlansTableComponent {
  readonly plans = input.required<CommissionPlan[]>();
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly itemsPerPage = input.required<number>();

  protected readonly store = inject(CommissionPlansStore);
  protected readonly columnas = COLUMNAS;
  protected readonly pageSizeOptions = PLANS_PAGE_SIZE_OPTIONS;

  protected readonly menu = signal<string | null>(null);
  private anchor: DOMRect | null = null;

  /** El menú se monta en <body> y se coloca bajo el botón. */
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchor) colocarPanel(el.nativeElement, this.anchor, 'end');
  }

  protected abrirMenu(id: string, ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.menu() === id) {
      this.menu.set(null);
      return;
    }
    this.anchor = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.menu.set(id);
  }
  protected readonly enEdicion = signal<CommissionPlan | null>(null);
  protected readonly porBorrar = signal<CommissionPlan | null>(null);
  protected readonly borrando = signal(false);

  /** Base de los filtros: todos los planes traídos del estado, o la página. */
  private readonly universo = computed(() =>
    this.store.allPlans().length > 0 ? this.store.allPlans() : this.plans(),
  );

  // Las mutaciones se pasan al editor como funciones ya ligadas al store.
  protected readonly actualizar = (id: string, data: Partial<CommissionPlan>) =>
    this.store.updatePlan(id, data);
  protected readonly enviarAAprobacion = (id: string) => this.store.sendToApproval(id);
  protected readonly rechazar = (id: string, reason?: string) =>
    this.store.rejectPlan(id, reason);
  protected readonly publicar = (id: string) => this.store.publishPlan(id);
  protected readonly inactivar = (id: string, reason?: string) =>
    this.store.inactivatePlan(id, reason);

  protected producto(p: CommissionPlan): string {
    return extractProduct(p.name);
  }

  protected canal(p: CommissionPlan): string {
    return extractChannel(p.name);
  }

  protected fecha(iso: string): string {
    return fmtFecha(iso);
  }

  protected filtrosDe(column: string): string[] {
    return this.store.columnFilters()[column] ?? [];
  }

  /** Valores posibles de una columna de texto, tal como los pinta la tabla. */
  protected valoresDe(column: string): string[] {
    return this.universo().map((p) => this.store.valorColumna(p, column));
  }

  protected fechasDe(column: string): (string | undefined)[] {
    return this.universo().map((p) =>
      column === 'startDate'
        ? p.startDate
        : column === 'endDate'
          ? p.endDate
          : p.publishedOn,
    );
  }

  protected editar(p: CommissionPlan): void {
    this.menu.set(null);
    this.enEdicion.set(p);
  }

  protected async confirmarBorrado(): Promise<void> {
    const p = this.porBorrar();
    if (!p) return;
    this.borrando.set(true);
    try {
      if (await this.store.deletePlan(p.id)) this.porBorrar.set(null);
    } finally {
      this.borrando.set(false);
    }
  }
}

export type { SortDirection };
