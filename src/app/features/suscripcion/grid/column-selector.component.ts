// Panel lateral "Columnas": buscador, drag vertical para reordenar, toggles de
// visibilidad y "Seleccionar todas". Paridad ColumnSelector.tsx — los cambios
// aplican EN VIVO (la tabla reacciona) y la persistencia ocurre AL CERRAR
// (evento closed → immediateSave columns_changed en el contenedor).
// dnd-kit se reemplaza por HTML5 drag & drop nativo.

import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ColumnConfig } from './suscripcion-grid.api';

@Component({
  selector: 'alma-column-selector',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <button
      type="button"
      (click)="abrir()"
      class="alma-btn alma-btn-outline h-9 rounded-xl bg-card px-3 text-xs font-medium"
    >
      <lucide-icon name="columns-3" [size]="16" class="text-primary" />
      Columnas
    </button>

    @if (abierto()) {
      <!-- Overlay -->
      <div class="fixed inset-0 z-[60] bg-black/30" (click)="cerrar()"></div>
      <!-- Sheet lateral derecho -->
      <div
        class="surface-solid fixed right-0 top-0 z-[61] flex h-full w-72 flex-col overflow-hidden border-l border-border shadow-[var(--shadow-lg)] sm:w-80"
      >
        <!-- Header -->
        <div
          class="shrink-0 border-b border-border/60 bg-[var(--table-header)] px-4 pb-4 pt-5"
        >
          <div class="mb-1 flex items-center justify-between">
            <h2 class="text-sm font-bold uppercase tracking-wide text-foreground">
              Columnas
            </h2>
            <div class="flex items-center gap-2">
              <span
                class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary"
              >
                {{ visibleCount() }} / {{ columns().length }}
              </span>
              <button
                type="button"
                (click)="cerrar()"
                class="text-muted-foreground hover:text-foreground"
                aria-label="Cerrar"
              >
                <lucide-icon name="x" [size]="16" />
              </button>
            </div>
          </div>
          <p class="text-[11px] text-muted-foreground">
            Selecciona y reordena las columnas visibles
          </p>
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-primary transition-all duration-500"
              [style.width.%]="progreso()"
            ></div>
          </div>
        </div>

        <!-- Buscador + listado -->
        <div class="flex flex-1 flex-col overflow-hidden">
          <div class="px-4 pb-2 pt-3">
            <input
              class="alma-input h-8 rounded-lg"
              placeholder="Buscar columnas..."
              [(ngModel)]="filtro"
              (ngModelChange)="filtroSig.set($event)"
            />
          </div>

          <div
            class="mb-1.5 flex items-center gap-1.5 px-4 text-[11px] text-muted-foreground"
          >
            <lucide-icon name="grip-vertical" [size]="12" />
            <span>Arrastra para reordenar</span>
          </div>

          <div class="mx-3 mb-2 flex-1 overflow-y-auto rounded-lg border border-border/40">
            <div class="p-1">
              @for (col of filtradas(); track col.key) {
                <div
                  class="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all"
                  [class.opacity-50]="arrastrando() === col.key"
                  [class.bg-primary/5]="arrastrando() === col.key"
                  [class.hover:bg-muted/50]="arrastrando() !== col.key"
                  [attr.data-col-key]="col.key"
                  [draggable]="true"
                  (dragstart)="onDragStart(col.key)"
                  (dragover)="onDragOver($any($event), col.key)"
                  (dragend)="onDragEnd()"
                  (drop)="$event.preventDefault()"
                >
                  <span class="cursor-grab rounded p-0.5 active:cursor-grabbing">
                    <lucide-icon
                      name="grip-vertical"
                      [size]="14"
                      class="text-muted-foreground/40"
                    />
                  </span>
                  <input
                    type="checkbox"
                    [id]="'susc-column-' + col.key"
                    [checked]="col.visible"
                    [disabled]="esRequerida(col.key)"
                    (change)="toggle(col.key)"
                    class="h-4 w-4 accent-[var(--primary)]"
                  />
                  <label
                    [for]="'susc-column-' + col.key"
                    class="flex-1 text-sm"
                    [class]="
                      esRequerida(col.key)
                        ? 'cursor-default text-muted-foreground'
                        : 'cursor-pointer'
                    "
                  >
                    {{ col.label }}
                    @if (esRequerida(col.key)) {
                      <span class="ml-1 text-[10px] italic text-muted-foreground/50">
                        (obligatoria)
                      </span>
                    }
                  </label>
                  @if (col.tooltip; as tip) {
                    <span
                      [title]="tip"
                      class="shrink-0 cursor-help text-muted-foreground/40 hover:text-primary"
                    >
                      <lucide-icon name="info" [size]="14" />
                    </span>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="shrink-0 border-t border-border/40 bg-muted/20 px-4 py-3">
          <label class="flex items-center justify-between">
            <span class="text-xs font-semibold">Seleccionar todas</span>
            <input
              type="checkbox"
              [checked]="todasSeleccionadas()"
              (change)="toggleTodas($any($event.target).checked)"
              class="h-4 w-4 accent-[var(--primary)]"
            />
          </label>
        </div>
      </div>
    }
  `,
})
export class ColumnSelectorComponent {
  readonly columns = input.required<ColumnConfig[]>();
  readonly requiredKeys = input<string[]>([]);
  readonly columnsChange = output<ColumnConfig[]>();
  /** Se dispara al CERRAR si hubo cambios — momento de persistir. */
  readonly closed = output<void>();

  protected readonly abierto = signal(false);
  protected filtro = '';
  protected readonly filtroSig = signal('');
  protected readonly arrastrando = signal<string | null>(null);

  private dirty = false;
  private dragKey: string | null = null;

  protected readonly filtradas = computed(() => {
    const term = this.filtroSig().toLowerCase().trim();
    if (!term) return this.columns();
    return this.columns().filter(
      (c) =>
        c.label.toLowerCase().includes(term) ||
        (c.tooltip && c.tooltip.toLowerCase().includes(term)),
    );
  });

  protected readonly visibleCount = computed(
    () => this.columns().filter((c) => c.visible).length,
  );
  protected readonly progreso = computed(() =>
    this.columns().length > 0 ? (this.visibleCount() / this.columns().length) * 100 : 0,
  );
  protected readonly todasSeleccionadas = computed(() =>
    this.columns()
      .filter((c) => !this.esRequerida(c.key))
      .every((c) => c.visible),
  );

  protected esRequerida(key: string): boolean {
    return this.requiredKeys().includes(key);
  }

  protected abrir(): void {
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.filtro = '';
    this.filtroSig.set('');
    if (this.dirty) {
      this.dirty = false;
      this.closed.emit();
    }
  }

  protected toggle(key: string): void {
    if (this.esRequerida(key)) return;
    // Mantener la POSICIÓN al activar/desactivar: mover la columna al final
    // desorienta al usuario. El orden del listado ES el orden de la tabla.
    this.dirty = true;
    this.columnsChange.emit(
      this.columns().map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)),
    );
  }

  protected toggleTodas(checked: boolean): void {
    this.dirty = true;
    this.columnsChange.emit(
      this.columns().map((c) => ({
        ...c,
        visible: this.esRequerida(c.key) ? true : checked,
      })),
    );
  }

  protected onDragStart(key: string): void {
    this.dragKey = key;
    this.arrastrando.set(key);
  }

  protected onDragOver(ev: DragEvent, targetKey: string): void {
    ev.preventDefault();
    const from = this.dragKey;
    if (!from || from === targetKey) return;
    const cols = [...this.columns()];
    const oldIndex = cols.findIndex((c) => c.key === from);
    const newIndex = cols.findIndex((c) => c.key === targetKey);
    if (oldIndex < 0 || newIndex < 0) return;
    const [moved] = cols.splice(oldIndex, 1);
    cols.splice(newIndex, 0, moved);
    this.dirty = true;
    this.columnsChange.emit(cols);
  }

  protected onDragEnd(): void {
    this.dragKey = null;
    this.arrastrando.set(null);
  }
}
