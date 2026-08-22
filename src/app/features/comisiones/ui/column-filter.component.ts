// Filtro de columna estilo Excel para las tablas de comisiones: valores únicos
// del conjunto recibido, buscador, "seleccionar todo" y botones
// Limpiar/Cancelar/Aplicar. Los valores se calculan sobre el TEXTO MOSTRADO
// (mismo criterio que usa el store al filtrar). Paridad
// CommissionPlanColumnFilter.tsx (y sus gemelos por módulo).

import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-column-filter',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <button
      #boton
      type="button"
      (click)="abrir($event)"
      class="flex h-6 w-6 items-center justify-center rounded p-0 hover:bg-accent"
      [class]="tieneFiltros() ? 'text-primary' : 'text-muted-foreground/60'"
      [title]="'Filtrar por ' + label()"
    >
      <lucide-icon name="filter" [size]="12" />
    </button>

    @if (abierto()) {
      <div class="fixed inset-0 z-[90]" (click)="cancelar()"></div>
      <div
        class="surface-solid fixed z-[95] w-80 rounded-lg border border-border p-4 shadow-[var(--shadow-lg)]"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        (click)="$event.stopPropagation()"
      >
        <h3 class="mb-4 text-sm font-medium">Filtrar por {{ label() }}</h3>

        <div class="relative mb-4 flex items-center">
          <span class="pointer-events-none absolute left-3 z-20 flex items-center">
            <lucide-icon name="search" [size]="14" class="text-muted-foreground" />
          </span>
          <input
            class="alma-input h-9 pl-9 text-sm"
            placeholder="Buscar valores..."
            [(ngModel)]="termino"
            (ngModelChange)="terminoSig.set($event)"
          />
        </div>

        <div class="h-60 overflow-y-auto">
          <div class="space-y-1">
            @if (visibles().length > 0) {
              <label
                class="flex items-center gap-2 border-b border-border/60 p-2 hover:bg-accent/50"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-[var(--primary)]"
                  [checked]="todosSeleccionados()"
                  (change)="seleccionarTodos($any($event.target).checked)"
                />
                <span class="cursor-pointer select-none text-sm font-medium">
                  (Seleccionar todo)
                </span>
              </label>
            }
            @for (v of visibles(); track v) {
              <label class="flex items-center gap-2 rounded-md p-2 hover:bg-accent/50">
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-[var(--primary)]"
                  [checked]="seleccionados().includes(v)"
                  (change)="toggle(v, $any($event.target).checked)"
                />
                <span class="flex-1 cursor-pointer select-none text-sm">
                  {{ v === '' ? '(Vacío)' : v }}
                </span>
              </label>
            } @empty {
              <div class="py-4 text-center text-sm text-muted-foreground">
                No se encontraron valores
              </div>
            }
          </div>
        </div>

        <div class="mt-4 flex justify-between border-t border-border pt-4">
          <button
            type="button"
            (click)="limpiar()"
            class="alma-btn alma-btn-outline h-8 text-xs text-muted-foreground"
          >
            Limpiar
          </button>
          <div class="flex gap-2">
            <button
              type="button"
              (click)="cancelar()"
              class="alma-btn alma-btn-outline h-8 text-xs text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="aplicar()"
              class="alma-btn alma-btn-primary h-8 text-xs"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ColumnFilterComponent {
  readonly column = input.required<string>();
  readonly label = input.required<string>();
  /** Valores únicos posibles (ya en el texto que muestra la tabla). */
  readonly valores = input.required<string[]>();
  readonly currentFilters = input.required<string[]>();
  readonly filterChange = output<{ column: string; values: string[] }>();

  @ViewChild('boton') private boton!: ElementRef<HTMLButtonElement>;

  protected readonly abierto = signal(false);
  protected readonly seleccionados = signal<string[]>([]);
  protected termino = '';
  protected readonly terminoSig = signal('');
  protected readonly pos = signal({ top: 0, left: 0 });

  protected readonly tieneFiltros = computed(() => this.currentFilters().length > 0);

  protected readonly visibles = computed(() => {
    const q = this.terminoSig().trim().toLowerCase();
    const unicos = Array.from(new Set(this.valores())).sort((a, b) => a.localeCompare(b));
    return q ? unicos.filter((v) => v.toLowerCase().includes(q)) : unicos;
  });

  protected readonly todosSeleccionados = computed(() => {
    const vis = this.visibles();
    const sel = this.seleccionados();
    return vis.length > 0 && vis.every((v) => sel.includes(v));
  });

  constructor() {
    // Al cerrarse, la selección local vuelve a reflejar los filtros aplicados.
    effect(() => {
      if (!this.abierto()) this.seleccionados.set(this.currentFilters());
    });
  }

  protected abrir(ev: MouseEvent): void {
    ev.stopPropagation();
    const r = this.boton.nativeElement.getBoundingClientRect();
    this.pos.set({
      top: Math.min(r.bottom + 4, window.innerHeight - 420),
      left: Math.min(Math.max(8, r.left), window.innerWidth - 328),
    });
    this.seleccionados.set(this.currentFilters());
    this.abierto.set(true);
  }

  protected seleccionarTodos(checked: boolean): void {
    this.seleccionados.set(checked ? this.visibles() : []);
  }

  protected toggle(valor: string, checked: boolean): void {
    this.seleccionados.update((prev) =>
      checked ? [...prev, valor] : prev.filter((v) => v !== valor),
    );
  }

  protected limpiar(): void {
    this.termino = '';
    this.terminoSig.set('');
    this.seleccionados.set([]);
    this.filterChange.emit({ column: this.column(), values: [] });
    this.abierto.set(false);
  }

  protected cancelar(): void {
    this.seleccionados.set(this.currentFilters());
    this.termino = '';
    this.terminoSig.set('');
    this.abierto.set(false);
  }

  protected aplicar(): void {
    this.filterChange.emit({ column: this.column(), values: this.seleccionados() });
    this.abierto.set(false);
  }
}
