// Buscador con debounce de 500 ms (el filtrado es en cliente, así que no hace falta
// esperar Enter).

import {
  Component,
  OnDestroy,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

const DEBOUNCE_MS = 500;

@Component({
  selector: 'alma-busqueda-debounce',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="relative w-full">
      <span
        class="pointer-events-none absolute inset-y-0 left-3.5 z-20 flex items-center"
      >
        <lucide-icon name="search" [size]="16" class="mr-2 text-muted-foreground" />
      </span>
      <input
        class="alma-input bg-card pl-11 text-left shadow-sm"
        [placeholder]="placeholder()"
        [(ngModel)]="local"
        (ngModelChange)="onInput($event)"
      />
    </div>
  `,
})
export class BusquedaDebounceComponent implements OnDestroy {
  readonly searchTerm = input.required<string>();
  readonly placeholder = input('Buscar por nombre o descripción...');
  readonly searchChange = output<string>();

  protected local = '';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly externo = signal('');

  constructor() {
    // Sincroniza cambios externos (p. ej. "Limpiar filtros").
    effect(() => {
      const t = this.searchTerm();
      this.externo.set(t);
      if (this.local !== t) this.local = t;
    });
  }

  protected onInput(valor: string): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (valor !== this.externo()) this.searchChange.emit(valor);
    }, DEBOUNCE_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
