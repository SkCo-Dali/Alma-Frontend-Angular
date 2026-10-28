// Selector de carpetas del buzón (prototipo folderSel): carpetas leídas de Outlook
// con la conexión vigente. Nunca se supone una carpeta: se elige de la lista. Si el
// valor guardado ya no existe en el buzón se muestra marcado para que lo corrijan.

import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CarpetaGraph } from './buzon.api';

export interface CarpetaPlana {
  nombre: string;
  nivel: number;
  total: number;
}

/** Árbol de Graph (dos niveles) → lista plana para un <select>. */
export function aplanarCarpetas(arbol: CarpetaGraph[], nivel = 0): CarpetaPlana[] {
  return arbol.flatMap((c) => [{ nombre: c.nombre, nivel, total: c.total }, ...aplanarCarpetas(c.hijas ?? [], nivel + 1)]);
}

@Component({
  selector: 'alma-carpeta-select',
  imports: [FormsModule],
  styleUrls: ['./buzon-proto.css'],
  styles: [`:host { display: contents; }`],
  template: `
    <select
      class="input sm"
      [style.min-width]="compacto() ? null : '200px'"
      [attr.aria-label]="ariaLabel()"
      [attr.id]="inputId() || null"
      [disabled]="disabled()"
      [ngModel]="valor() ?? ''"
      (ngModelChange)="valor.set($event || null)"
    >
      <option value="">{{ vacia() }}</option>
      @for (c of carpetas(); track $index) {
        <option [value]="c.nombre">{{ c.nivel ? '— ' : '' }}{{ c.nombre }}</option>
      }
      @if (huerfana(); as h) {
        <option [value]="h">⚠ {{ h }} (no existe en el buzón)</option>
      } @else if (!carpetas().length && valor()) {
        <option [value]="valor()">{{ valor() }}</option>
      }
    </select>
  `,
})
export class CarpetaSelectComponent {
  readonly carpetas = input<CarpetaPlana[]>([]);
  readonly valor = model<string | null>(null);
  readonly vacia = input('Elige la carpeta…');
  readonly ariaLabel = input('Carpeta del buzón');
  readonly inputId = input('');
  readonly disabled = input(false);
  readonly compacto = input(false);

  protected readonly huerfana = computed(() => {
    const v = this.valor();
    // Sin lista (buzón sin conexión) no se puede afirmar que no exista.
    return v && this.carpetas().length && !this.carpetas().some((c) => c.nombre === v) ? v : null;
  });
}
