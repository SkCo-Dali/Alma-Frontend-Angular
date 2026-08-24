// Disparador del simulador para el toolbar de la bandeja (a juego con el botón
// "Columnas"). Mientras está montado, el host oculta su botón flotante.
// Paridad SimuladorToolbarButton (SimuladorHost.tsx).

import { Component, DestroyRef, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SimuladorStore } from './simulador.store';

@Component({
  selector: 'alma-simulador-boton',
  imports: [LucideAngularModule],
  template: `
    <button
      type="button"
      (click)="simulador.alternar(!simulador.abierto())"
      [attr.aria-pressed]="simulador.abierto()"
      title="Simulador de asegurabilidad"
      class="alma-btn alma-btn-outline h-9 rounded-xl bg-card px-3 text-xs font-medium"
      [class]="simulador.abierto() ? 'border-primary/50 bg-primary/10' : ''"
    >
      <lucide-icon name="calculator" [size]="16" class="text-primary" />
      Simulador
    </button>
  `,
})
export class SimuladorBotonComponent {
  protected readonly simulador = inject(SimuladorStore);

  constructor() {
    const baja = this.simulador.registrarDisparadorExterno();
    inject(DestroyRef).onDestroy(baja);
  }
}
