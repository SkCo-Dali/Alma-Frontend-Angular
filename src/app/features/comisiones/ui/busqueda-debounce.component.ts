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
import { SkInputComponent } from '@skandia/ui';

const DEBOUNCE_MS = 500;

@Component({
  selector: 'alma-busqueda-debounce',
  imports: [FormsModule, SkInputComponent],
  template: `
    <sk-input
      class="w-full"
      fluid
      iconLeft="search"
      [placeholder]="placeholder()"
      [(ngModel)]="local"
      (ngModelChange)="onInput($event)"
    />
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
