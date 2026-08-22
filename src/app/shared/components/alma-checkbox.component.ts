// Casilla de verificación de Alma. Es el port EXACTO del Checkbox de Alma
// (components/ui/checkbox.tsx: Radix + shadcn): cuadrado de 16 px con esquina
// suave, borde verde, y al marcarse se rellena de verde con el chulito blanco
// de lucide. Antes se usaba <input type="checkbox"> nativo, que el navegador
// pinta distinto (y en Windows se veía redondo y con otro chulito).
//
// El host es un <button role="checkbox">, igual que Radix, así que un
// <label for="..."> asociado lo activa (button es un elemento etiquetable).

import { Component, computed, input, model } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-checkbox',
  imports: [LucideAngularModule],
  template: `
    <button
      type="button"
      role="checkbox"
      [attr.id]="id() || null"
      [attr.aria-checked]="indeterminate() ? 'mixed' : checked()"
      [attr.aria-label]="ariaLabel() || null"
      [disabled]="disabled()"
      (click)="alternar($event)"
      class="peer grid h-4 w-4 shrink-0 place-content-center rounded-sm border border-primary shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      [class]="marcado() ? 'bg-primary text-primary-foreground' : 'cursor-pointer'"
    >
      @if (marcado()) {
        <span class="grid place-content-center text-current">
          @if (indeterminate()) {
            <lucide-icon name="minus" [size]="16" />
          } @else {
            <lucide-icon name="check" [size]="16" />
          }
        </span>
      }
    </button>
  `,
})
export class AlmaCheckboxComponent {
  readonly checked = model(false);
  readonly disabled = input(false);
  /** Estado mixto (algunos hijos marcados): se pinta relleno con un guion. */
  readonly indeterminate = input(false);
  readonly id = input('');
  readonly ariaLabel = input('');

  protected readonly marcado = computed(() => this.checked() || this.indeterminate());

  protected alternar(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.disabled()) return;
    this.checked.set(!this.checked());
  }
}
