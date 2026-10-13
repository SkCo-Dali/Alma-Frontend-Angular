// Selector múltiple con búsqueda, para elegir entre cientos de analistas o colas.
// Reemplaza al <select multiple> nativo del script original, que con una lista
// larga no se puede buscar ni seleccionar «todos los visibles».

import { Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaCheckboxComponent } from '../../shared/components/alma-checkbox.component';
import { ItemCatalogo } from './monitor-ia.api';

@Component({
  selector: 'alma-selector-multiple',
  host: { class: 'block' },
  imports: [FormsModule, LucideAngularModule, AlmaCheckboxComponent],
  template: `
    <div class="rounded-xl border border-border bg-[var(--surface-sunken)]">
      <div class="flex items-center gap-2 border-b border-border/60 px-2.5 py-2">
        <lucide-icon name="search" [size]="14" class="shrink-0 text-muted-foreground" />
        <input
          type="search"
          [ngModel]="busqueda()"
          (ngModelChange)="busqueda.set($event)"
          [placeholder]="placeholder()"
          [attr.aria-label]="placeholder()"
          class="h-7 w-full border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5 text-xs">
        <span class="text-muted-foreground">
          <span class="font-semibold tabular-nums text-foreground">{{ seleccion().length }}</span>
          de {{ items().length }} seleccionados
        </span>
        <span class="flex gap-3">
          <button type="button" class="font-medium text-primary hover:underline disabled:opacity-40"
                  [disabled]="!visibles().length" (click)="elegirVisibles()">
            Seleccionar visibles
          </button>
          <button type="button" class="font-medium text-muted-foreground hover:text-foreground hover:underline disabled:opacity-40"
                  [disabled]="!seleccion().length" (click)="limpiar()">
            Limpiar
          </button>
        </span>
      </div>

      <div class="max-h-56 overflow-y-auto p-1">
        @for (item of visibles(); track item.id) {
          <label class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/60">
            <alma-checkbox [checked]="elegidos().has(item.id)" (checkedChange)="alternar(item.id, $event)" [ariaLabel]="item.name" />
            <span class="min-w-0 flex-1 truncate text-foreground" [title]="item.name">{{ item.name }}</span>
          </label>
        } @empty {
          <p class="px-3 py-6 text-center text-xs text-muted-foreground">
            {{ items().length ? 'Sin coincidencias.' : vacio() }}
          </p>
        }
      </div>
    </div>
  `,
})
export class SelectorMultipleComponent {
  readonly items = input.required<ItemCatalogo[]>();
  /** Ids elegidos. */
  readonly seleccion = model<string[]>([]);
  readonly placeholder = input('Buscar…');
  readonly vacio = input('No hay opciones.');

  protected readonly busqueda = signal('');
  protected readonly elegidos = computed(() => new Set(this.seleccion()));

  protected readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const todos = this.items();
    return q ? todos.filter((i) => i.name.toLowerCase().includes(q)) : todos;
  });

  protected alternar(id: string, marcado: boolean): void {
    const actual = this.elegidos();
    if (marcado === actual.has(id)) return;
    this.seleccion.set(marcado ? [...this.seleccion(), id] : this.seleccion().filter((x) => x !== id));
  }

  protected elegirVisibles(): void {
    const nuevos = new Set(this.seleccion());
    for (const i of this.visibles()) nuevos.add(i.id);
    this.seleccion.set([...nuevos]);
  }

  protected limpiar(): void {
    this.seleccion.set([]);
  }
}
