// Editor de parámetros tipo "lista" del motor (ciudades elegibles, ocupaciones
// delegadas): chips removibles + input para agregar. Normaliza a minúsculas/trim y evita
// duplicados. Con más de 20 ítems aparece un buscador local.

import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-lista-editor',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <input
          class="alma-input h-8 w-48 rounded-lg text-xs"
          [disabled]="disabled()"
          [(ngModel)]="nuevo"
          (ngModelChange)="nuevoSig.set($event)"
          (keydown.enter)="agregar($event)"
          placeholder="Agregar valor…"
        />
        <button
          type="button"
          class="alma-btn alma-btn-outline h-8 rounded-lg text-xs"
          [disabled]="disabled() || !normalizado() || yaExiste()"
          (click)="agregar()"
        >
          <lucide-icon name="plus" [size]="14" /> Agregar
        </button>
        @if (yaExiste()) {
          <span class="text-[11px] text-amber-600 dark:text-amber-400">
            Ya está en la lista.
          </span>
        }
        <span class="ml-auto text-[11px] text-muted-foreground">
          {{ value().length }} {{ value().length === 1 ? 'ítem' : 'ítems' }}
        </span>
      </div>

      @if (value().length > 20) {
        <div class="relative">
          <lucide-icon
            name="search"
            [size]="14"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            class="alma-input h-8 rounded-lg pl-8 text-xs"
            [(ngModel)]="busqueda"
            (ngModelChange)="busquedaSig.set($event)"
            placeholder="Buscar en la lista…"
          />
        </div>
      }

      <div
        class="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-2"
      >
        @if (visibles().length === 0) {
          <span class="px-1 py-0.5 text-[11px] text-muted-foreground">
            {{ value().length === 0 ? 'Lista vacía.' : 'Sin coincidencias.' }}
          </span>
        } @else {
          @for (item of visibles(); track item) {
            <span
              class="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-primary"
            >
              {{ item }}
              <button
                type="button"
                [disabled]="disabled()"
                (click)="quitar(item)"
                [attr.aria-label]="'Quitar ' + item"
                class="rounded-full p-0.5 text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary disabled:opacity-50"
              >
                <lucide-icon name="x" [size]="12" />
              </button>
            </span>
          }
        }
      </div>
    </div>
  `,
})
export class ListaEditorComponent {
  readonly value = input.required<string[]>();
  readonly disabled = input(false);
  readonly valueChange = output<string[]>();

  protected nuevo = '';
  protected busqueda = '';
  protected readonly nuevoSig = signal('');
  protected readonly busquedaSig = signal('');

  protected readonly normalizado = computed(() => this.nuevoSig().trim().toLowerCase());
  protected readonly yaExiste = computed(
    () => this.normalizado() !== '' && this.value().includes(this.normalizado()),
  );

  protected readonly visibles = computed(() => {
    const q = this.busquedaSig().trim().toLowerCase();
    return q ? this.value().filter((v) => v.includes(q)) : this.value();
  });

  protected agregar(ev?: Event): void {
    ev?.preventDefault();
    const n = this.normalizado();
    if (!n || this.yaExiste()) return;
    this.valueChange.emit([...this.value(), n]);
    this.nuevo = '';
    this.nuevoSig.set('');
  }

  protected quitar(item: string): void {
    this.valueChange.emit(this.value().filter((v) => v !== item));
  }
}
