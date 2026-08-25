// Búsqueda global del grid (aplica con Enter o con el botón, NO por tecla: cada búsqueda
// es un POST /grid al servidor).

import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-grid-search',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div
      class="glass flex h-9 w-full min-w-[260px] max-w-md overflow-hidden rounded-xl focus-within:ring-2 focus-within:ring-ring"
    >
      <input
        type="text"
        placeholder="Buscar por cotización, asegurado, cédula, agente o contrato"
        [(ngModel)]="local"
        (keydown.enter)="aplicar()"
        class="h-full flex-1 border-none bg-transparent pl-3 pr-1 text-sm outline-none placeholder:text-muted-foreground"
      />
      @if (local) {
        <button
          type="button"
          (click)="limpiar()"
          class="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Limpiar búsqueda"
        >
          <lucide-icon name="x" [size]="16" class="mx-auto" />
        </button>
      }
      <button
        type="button"
        (click)="aplicar()"
        class="h-9 w-9 shrink-0 bg-primary p-0 text-primary-foreground hover:bg-primary/90"
        aria-label="Buscar"
      >
        <lucide-icon name="search" [size]="16" class="mx-auto" />
      </button>
    </div>
  `,
})
export class GridSearchComponent {
  readonly searchTerm = input.required<string>();
  readonly searchChange = output<string>();

  protected local = '';

  constructor() {
    // Sincroniza cambios externos (hidratación del estado guardado).
    effect(() => {
      this.local = this.searchTerm();
    });
  }

  protected aplicar(): void {
    if (this.local !== this.searchTerm()) this.searchChange.emit(this.local);
  }

  protected limpiar(): void {
    this.local = '';
    if (this.searchTerm() !== '') this.searchChange.emit('');
  }
}
