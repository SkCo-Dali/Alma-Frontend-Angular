// Filtro de columna estilo Excel para las tablas de comisiones: valores únicos del
// conjunto recibido, buscador, "seleccionar todo" y botones Limpiar/Cancelar/Aplicar.
// Los valores se calculan sobre el TEXTO MOSTRADO (mismo criterio que usa el store al
// filtrar).

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
import { SkButtonComponent, SkInputComponent } from '@skandia/ui';
import { AlmaCheckboxComponent } from '../../../shared/components/alma-checkbox.component';
import { PortalDirective } from '../../../shared/portal.directive';
import { colocarPanel } from '../../../shared/popover-position';

@Component({
  selector: 'alma-column-filter',
  imports: [
    FormsModule,
    LucideAngularModule,
    SkButtonComponent,
    SkInputComponent,
    AlmaCheckboxComponent,
    PortalDirective,
  ],
  template: `
    <button
      #boton
      type="button"
      (click)="abrir($event)"
      class="flex h-8 w-8 items-center justify-center rounded p-0 hover:bg-accent"
      [class]="tieneFiltros() ? 'text-primary' : 'text-muted-foreground/60'"
      [title]="'Filtrar por ' + label()"
    >
      <lucide-icon name="filter" [size]="12" />
    </button>

    @if (abierto()) {
      <div almaPortal class="fixed inset-0 z-[90]" (click)="cancelar()"></div>
      <div
        #panel
        almaPortal
        class="surface-solid fixed z-[95] w-80 rounded-lg border border-border p-4 text-left text-sm normal-case tracking-normal text-foreground shadow-[var(--shadow-lg)]"
        (click)="$event.stopPropagation()"
      >
        <h3 class="mb-4 text-sm font-medium">Filtrar por {{ label() }}</h3>

        <div class="mb-4">
          <sk-input
            iconLeft="search"
            placeholder="Buscar valores..."
            [(ngModel)]="termino"
            (ngModelChange)="terminoSig.set($event)"
          />
        </div>

        <div class="h-60 overflow-y-auto">
          <div class="space-y-1">
            @if (visibles().length > 0) {
              <div
                class="flex items-center gap-2 border-b border-border/60 p-2 hover:bg-accent/50"
                (click)="seleccionarTodos(!todosSeleccionados())"
              >
                <alma-checkbox
                  [checked]="todosSeleccionados()"
                  (checkedChange)="seleccionarTodos($event)"
                  ariaLabel="Seleccionar todo"
                />
                <span class="cursor-pointer select-none text-sm font-medium">
                  (Seleccionar todo)
                </span>
              </div>
            }
            @for (v of visibles(); track v) {
              <div
                class="flex items-center gap-2 rounded-md p-2 hover:bg-accent/50"
                (click)="toggle(v, !seleccionados().includes(v))"
              >
                <alma-checkbox
                  [checked]="seleccionados().includes(v)"
                  (checkedChange)="toggle(v, $event)"
                />
                <span class="flex-1 cursor-pointer select-none text-sm">
                  {{ v === '' ? '(Vacío)' : v }}
                </span>
              </div>
            } @empty {
              <div class="py-4 text-center text-sm text-muted-foreground">
                No se encontraron valores
              </div>
            }
          </div>
        </div>

        <div class="mt-4 flex justify-between border-t border-border pt-4">
          <sk-button
            type="button"
            variant="secondary"
            size="small"
            label="Limpiar"
            (clicked)="limpiar()"
          />
          <div class="flex gap-2">
            <sk-button
              type="button"
              variant="secondary"
              size="small"
              label="Cancelar"
              (clicked)="cancelar()"
            />
            <sk-button
              type="button"
              variant="primary"
              size="small"
              label="Aplicar"
              (clicked)="aplicar()"
            />
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

  /** Al aparecer el panel (ya en <body>) se coloca con su medida real. */
  @ViewChild('panel') set panelRef(el: ElementRef<HTMLElement> | undefined) {
    if (el && this.anchor) colocarPanel(el.nativeElement, this.anchor);
  }

  private anchor: DOMRect | null = null;

  protected readonly abierto = signal(false);
  protected readonly seleccionados = signal<string[]>([]);
  protected termino = '';
  protected readonly terminoSig = signal('');

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
    this.anchor = this.boton.nativeElement.getBoundingClientRect();
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
