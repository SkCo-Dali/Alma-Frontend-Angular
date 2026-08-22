// Menú unificado de encabezado de columna (estilo Excel): ordenar + filtrar en
// un solo disclosure con ChevronDown. Paridad ColumnHeaderMenu.tsx. El cuerpo
// del filtro se elige por TIPO de dato:
//   date → DateFilter (árbol año/mes/día + presets)
//   discrete → DiscreteFilter (checkboxes de valores únicos)
//   number/currency → RangeFilter
//   string no-discreta → TextFilterTab (contiene / comienza por / …)
//
// El popover se posiciona fijo desde el botón (los contenedores del grid tienen
// overflow y recortarían un panel absoluto).

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
import {
  DistinctBaseRequest,
  GridColumnDefinition,
  GridFilter,
} from './suscripcion-grid.api';
import { DateFilterComponent } from './date-filter.component';
import { DiscreteFilterComponent } from './discrete-filter.component';
import { RangeFilterComponent, RangeOp } from './range-filter.component';
import { TextFilterCondition, TextFilterTabComponent } from './text-filter-tab.component';

@Component({
  selector: 'alma-column-header-menu',
  imports: [
    LucideAngularModule,
    DateFilterComponent,
    DiscreteFilterComponent,
    RangeFilterComponent,
    TextFilterTabComponent,
  ],
  template: `
    <button
      #boton
      type="button"
      (click)="toggle($event)"
      class="relative inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors"
      [class]="
        activo()
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground'
      "
      title="Ordenar y filtrar"
    >
      <lucide-icon name="chevron-down" [size]="12" [strokeWidth]="2.5" />
      @if (ordenActivo()) {
        <span
          class="absolute -right-[3px] -top-[3px] inline-flex h-[9px] w-[9px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
        >
          <lucide-icon
            [name]="sortDir() === 'asc' ? 'arrow-up' : 'arrow-down'"
            [size]="7"
            [strokeWidth]="3"
          />
        </span>
      }
    </button>

    @if (abierto()) {
      <div class="fixed inset-0 z-[90]" (click)="cerrar()"></div>
      <div
        class="surface-solid fixed z-[95] rounded-lg border border-border p-0 shadow-[var(--shadow-lg)]"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        [style.width.px]="ancho()"
        (click)="$event.stopPropagation()"
      >
        <!-- Sección de orden -->
        @if (def()?.sortable) {
          <div class="py-1.5">
            <button
              type="button"
              (click)="ordenar('asc')"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
              [class.font-medium]="ordenActivo() && sortDir() === 'asc'"
              [class.text-primary]="ordenActivo() && sortDir() === 'asc'"
            >
              <lucide-icon name="arrow-up" [size]="14" />
              <span>{{ ascLabel() }}</span>
            </button>
            <button
              type="button"
              (click)="ordenar('desc')"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
              [class.font-medium]="ordenActivo() && sortDir() === 'desc'"
              [class.text-primary]="ordenActivo() && sortDir() === 'desc'"
            >
              <lucide-icon name="arrow-down" [size]="14" />
              <span>{{ descLabel() }}</span>
            </button>
          </div>
        }

        @if (def()?.sortable && (tieneCuerpo() || filtroActivo())) {
          <div class="border-t border-border/60"></div>
        }

        <!-- Quitar filtro activo -->
        @if (filtroActivo()) {
          <div class="py-1.5">
            <button
              type="button"
              (click)="quitarFiltro()"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
            >
              <lucide-icon name="x-circle" [size]="14" />
              <span>Quitar filtro de "{{ label() }}"</span>
            </button>
          </div>
        }

        @if (filtroActivo() && tieneCuerpo()) {
          <div class="border-t border-border/60"></div>
        }

        <!-- Cuerpo del filtro según el tipo de dato -->
        @if (tieneCuerpo()) {
          <div class="p-3">
            @if (esFecha()) {
              <alma-date-filter
                [field]="field()"
                [buildRequest]="buildDistinctRequest()"
                (dateChange)="dateFilterChange.emit($event); cerrar()"
                (requestClose)="cerrar()"
              />
            } @else if (esDiscreta()) {
              <alma-discrete-filter
                [field]="field()"
                [currentFilters]="filters()"
                [buildRequest]="buildDistinctRequest()"
                [conPestanaTexto]="!esBooleana()"
                (filterChange)="discreteFilterChange.emit($event)"
                (textFilterChange)="textFilterChange.emit($event)"
                (requestClose)="cerrar()"
              />
            } @else if (esNumerica()) {
              <alma-range-filter
                [field]="field()"
                [currentFilters]="filters()"
                (rangeChange)="rangeFilterChange.emit($event)"
                (requestClose)="cerrar()"
              />
            } @else {
              <alma-text-filter-tab
                (applied)="aplicarTexto($event)"
                (closed)="cerrar()"
              />
            }
          </div>
        }
      </div>
    }
  `,
})
export class ColumnHeaderMenuComponent {
  readonly field = input.required<string>();
  readonly label = input.required<string>();
  readonly def = input<GridColumnDefinition | undefined>(undefined);
  readonly sortField = input.required<string>();
  readonly sortDir = input.required<'asc' | 'desc'>();
  readonly filters = input.required<GridFilter[]>();
  readonly buildDistinctRequest = input.required<() => DistinctBaseRequest>();

  readonly sorted = output<{ field: string; dir: 'asc' | 'desc' }>();
  readonly discreteFilterChange = output<{
    field: string;
    values: (string | number | boolean)[];
  }>();
  readonly textFilterChange = output<{ field: string; op: string; value: string }>();
  readonly rangeFilterChange = output<{
    field: string;
    op: RangeOp | 'clear';
    value?: number;
    value2?: number;
  }>();
  readonly dateFilterChange = output<{ field: string; from?: string; to?: string }>();
  readonly clearFilter = output<string>();

  @ViewChild('boton') private boton!: ElementRef<HTMLButtonElement>;

  protected readonly abierto = signal(false);
  protected readonly pos = signal({ top: 0, left: 0 });

  protected readonly esFecha = computed(() => this.def()?.type === 'date');
  protected readonly esDiscreta = computed(() => !!this.def()?.discrete);
  protected readonly esBooleana = computed(() => this.def()?.type === 'boolean');
  protected readonly esNumerica = computed(
    () => this.def()?.type === 'number' || this.def()?.type === 'currency',
  );
  protected readonly ordenActivo = computed(() => this.sortField() === this.field());
  protected readonly filtroActivo = computed(() =>
    this.filters().some((f) => f.field === this.field()),
  );
  protected readonly activo = computed(() => this.ordenActivo() || this.filtroActivo());
  protected readonly tieneCuerpo = computed(() => !!this.def()?.filterable);

  /** Ancho del popover según el filtro que renderiza adentro. */
  protected readonly ancho = computed(() => {
    if (!this.tieneCuerpo()) return 224;
    if (this.esFecha()) return 384;
    if (this.esDiscreta()) return 320;
    return 288;
  });

  // Etiquetas de orden según el tipo de columna (estilo Excel).
  protected readonly ascLabel = computed(() =>
    this.esNumerica()
      ? 'Ordenar de menor a mayor'
      : this.esFecha()
        ? 'Ordenar de más antiguo a más reciente'
        : 'Ordenar de A a Z',
  );
  protected readonly descLabel = computed(() =>
    this.esNumerica()
      ? 'Ordenar de mayor a menor'
      : this.esFecha()
        ? 'Ordenar de más reciente a más antiguo'
        : 'Ordenar de Z a A',
  );

  protected toggle(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    const r = this.boton.nativeElement.getBoundingClientRect();
    const w = this.ancho();
    this.pos.set({
      top: Math.min(r.bottom + 4, window.innerHeight - 380),
      left: Math.min(Math.max(8, r.left), window.innerWidth - w - 8),
    });
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected ordenar(dir: 'asc' | 'desc'): void {
    this.sorted.emit({ field: this.field(), dir });
    this.cerrar();
  }

  protected quitarFiltro(): void {
    this.clearFilter.emit(this.field());
    this.cerrar();
  }

  protected aplicarTexto(conditions: TextFilterCondition[]): void {
    if (conditions.length === 0) return;
    const cond = conditions[0];
    this.textFilterChange.emit({ field: this.field(), op: cond.op, value: cond.value });
  }
}
