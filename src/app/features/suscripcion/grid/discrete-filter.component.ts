// Filtro discreto (checkboxes de valores únicos) embebido en el menú de columna.
// Conserva:
// - Distincts lazy (initialize al montarse dentro del popover abierto).
// - RENDER_CAP 200: pintar miles de checkboxes por tecla hacía lenta la
//   escritura; el resto se alcanza refinando la búsqueda (valueSearch server).
// - Pestaña "Filtros de Texto" opcional para columnas string.

import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlmaCheckboxComponent } from '../../../shared/components/alma-checkbox.component';
import { DistinctStore } from './distinct.store';
import { DistinctBaseRequest, GridFilter, SuscripcionGridApi } from './suscripcion-grid.api';
import { TextFilterCondition, TextFilterTabComponent } from './text-filter-tab.component';

const RENDER_CAP = 200;

@Component({
  selector: 'alma-discrete-filter',
  imports: [FormsModule, AlmaCheckboxComponent, TextFilterTabComponent],
  template: `
    <div (click)="$event.stopPropagation()">
      @if (store.loading()) {
        <div class="py-4 text-center text-sm text-muted-foreground">Cargando valores...</div>
      } @else if (store.error(); as err) {
        <div class="py-4 text-center text-sm text-destructive">Error: {{ err }}</div>
      } @else {
        @if (mostrarPestanaTexto()) {
          <div class="mb-3 flex">
            <div class="flex rounded-xl bg-muted p-1">
              <button
                type="button"
                (click)="$event.stopPropagation(); tab.set('specific')"
                class="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
                [class]="
                  tab() === 'specific'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                "
              >
                Específica
              </button>
              <button
                type="button"
                (click)="$event.stopPropagation(); tab.set('text')"
                class="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
                [class]="
                  tab() === 'text'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                "
              >
                Filtros de Texto
              </button>
            </div>
          </div>
        }

        @if (tab() === 'specific') {
          <div class="mb-3">
            <input
              class="alma-input h-8 rounded-lg text-sm"
              placeholder="Buscar valores..."
              [(ngModel)]="termino"
              (ngModelChange)="store.buscar($event)"
              (click)="$event.stopPropagation()"
            />
          </div>

          <div class="h-60 overflow-y-auto">
            <div class="space-y-0.5">
              @if (store.values().length > 0) {
                <div
                  class="flex items-center gap-2 border-b border-border/60 p-2 hover:bg-accent/50"
                  (click)="seleccionarTodos(!todosSeleccionados())"
                >
                  <alma-checkbox
                    [checked]="todosSeleccionados()"
                    [indeterminate]="algunosSeleccionados()"
                    (checkedChange)="seleccionarTodos($event)"
                    ariaLabel="Seleccionar todos"
                  />
                  <span class="cursor-pointer select-none text-sm font-medium text-foreground">
                    Seleccionar todos
                  </span>
                </div>
              }

              @for (item of visibles(); track item.key) {
                <div
                  class="flex items-center gap-2 rounded-md p-2 hover:bg-accent/50"
                  (click)="toggleValor(item.key, !seleccionados().includes(item.key))"
                >
                  <alma-checkbox
                    [checked]="seleccionados().includes(item.key)"
                    (checkedChange)="toggleValor(item.key, $event)"
                  />
                  <span
                    class="flex flex-1 cursor-pointer select-none items-center justify-between text-sm text-foreground"
                  >
                    <span>
                      @if (item.vacio) {
                        <span class="italic text-muted-foreground">(Vacío)</span>
                      } @else if (item.booleano) {
                        <span
                          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          [class]="
                            item.boolTrue
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          "
                        >
                          {{ item.boolTrue ? 'Sí' : 'No' }}
                        </span>
                      } @else {
                        {{ item.key }}
                      }
                    </span>
                    <span class="ml-2 text-xs tabular-nums text-muted-foreground">
                      ({{ item.count }})
                    </span>
                  </span>
                </div>
              }

              @if (ocultos() > 0) {
                <div
                  class="border-t border-border/60 py-2 text-center text-xs text-muted-foreground"
                >
                  +{{ ocultos().toLocaleString('es-CO') }} valores más — usa el buscador para
                  encontrarlos
                </div>
              }

              @if (store.searchingServer()) {
                <div class="py-1.5 text-center text-xs text-muted-foreground">
                  Buscando más valores…
                </div>
              }

              @if (store.values().length === 0) {
                <div class="py-4 text-center text-sm text-muted-foreground">
                  {{ store.searchingServer() ? 'Buscando…' : 'No se encontraron valores' }}
                </div>
              }
            </div>
          </div>

          <div class="mt-3 flex justify-between border-t border-border/60 pt-3">
            <button
              type="button"
              class="alma-btn alma-btn-outline h-8 rounded-lg text-xs text-muted-foreground"
              (click)="limpiar()"
            >
              Limpiar
            </button>
            <div class="flex gap-2">
              <button
                type="button"
                class="alma-btn alma-btn-outline h-8 rounded-lg text-xs text-muted-foreground"
                (click)="cancelar()"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="alma-btn alma-btn-primary h-8 rounded-lg text-xs"
                [disabled]="store.loading()"
                (click)="aplicar()"
              >
                Aplicar
              </button>
            </div>
          </div>
        } @else {
          <alma-text-filter-tab
            (applied)="aplicarTexto($event)"
            (closed)="requestClose.emit()"
          />
        }
      }
    </div>
  `,
})
export class DiscreteFilterComponent implements OnInit, OnDestroy {
  private readonly api = inject(SuscripcionGridApi);

  readonly field = input.required<string>();
  readonly currentFilters = input.required<GridFilter[]>();
  readonly buildRequest = input.required<() => DistinctBaseRequest>();
  /** Si es false se oculta la pestaña de texto (p. ej. columnas boolean). */
  readonly conPestanaTexto = input(true);

  readonly filterChange = output<{ field: string; values: (string | number | boolean)[] }>();
  readonly textFilterChange = output<{ field: string; op: string; value: string }>();
  readonly requestClose = output<void>();

  protected store!: DistinctStore;
  protected readonly tab = signal<'specific' | 'text'>('specific');
  protected readonly seleccionados = signal<string[]>([]);
  protected termino = '';

  protected readonly mostrarPestanaTexto = computed(() => this.conPestanaTexto());

  /** Valores del filtro ya aplicados a esta columna (op 'in'). */
  private readonly aplicados = computed(() => {
    const f = this.currentFilters().find(
      (x) => x.field === this.field() && x.op === 'in',
    );
    return f && Array.isArray(f.value) ? f.value.map((v) => String(v)) : [];
  });

  protected readonly visibles = computed(() =>
    this.store
      .values()
      .slice(0, RENDER_CAP)
      .map((item) => {
        const key = String(item.value ?? '');
        const boolTrue = key === 'true' || key === 'True';
        const boolFalse = key === 'false' || key === 'False';
        return {
          key,
          count: item.count,
          vacio: item.value === null || item.value === undefined,
          booleano: boolTrue || boolFalse,
          boolTrue,
        };
      }),
  );

  protected readonly ocultos = computed(() =>
    Math.max(0, this.store.values().length - RENDER_CAP),
  );

  protected readonly todosSeleccionados = computed(() => {
    const vals = this.store.values();
    const sel = this.seleccionados();
    return vals.length > 0 && vals.every((i) => sel.includes(String(i.value ?? '')));
  });

  /** Estado mixto del "Seleccionar todos" (algunos, pero no todos). */
  protected readonly algunosSeleccionados = computed(() => {
    const vals = this.store.values();
    const sel = this.seleccionados();
    return (
      !this.todosSeleccionados() && vals.some((i) => sel.includes(String(i.value ?? '')))
    );
  });

  constructor() {
    // Sincroniza la selección local con los filtros aplicados.
    effect(() => this.seleccionados.set(this.aplicados()));
  }

  ngOnInit(): void {
    this.store = new DistinctStore(this.api, this.field(), this.buildRequest());
    // LAZY: este componente solo se monta dentro del popover ya abierto.
    this.store.initialize();
  }

  ngOnDestroy(): void {
    this.store?.destroy();
  }

  protected seleccionarTodos(checked: boolean): void {
    this.seleccionados.set(
      checked ? this.store.values().map((i) => String(i.value ?? '')) : [],
    );
  }

  protected toggleValor(value: string, checked: boolean): void {
    this.seleccionados.update((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value),
    );
  }

  protected limpiar(): void {
    this.termino = '';
    this.seleccionados.set([]);
    this.filterChange.emit({ field: this.field(), values: [] });
  }

  protected cancelar(): void {
    this.seleccionados.set(this.aplicados());
    this.termino = '';
    this.requestClose.emit();
  }

  protected aplicar(): void {
    const sel = this.seleccionados();
    if (sel.length === 0 && this.termino.trim()) {
      this.filterChange.emit({ field: this.field(), values: [this.termino.trim()] });
    } else {
      this.filterChange.emit({ field: this.field(), values: sel });
    }
    this.requestClose.emit();
  }

  protected aplicarTexto(conditions: TextFilterCondition[]): void {
    if (conditions.length === 0) return;
    this.filterChange.emit({ field: this.field(), values: [] });
    const cond = conditions[0];
    this.textFilterChange.emit({ field: this.field(), op: cond.op, value: cond.value });
  }
}
