// Host del panel del simulador (patrón "Tu Dali"): el contenido de la página va
// dentro de un wrapper con margin-right animado cuando el panel está abierto, y
// el panel es un hermano `fixed` SIN overlay en desktop — el usuario interactúa
// con ambos a la vez. El botón flotante vive bajo el header (top-24) y se OCULTA
// cuando la página monta su propio disparador en el toolbar (alma-simulador-boton).
//
// El estado abierto/cerrado persiste en sessionStorage para sobrevivir la
// navegación bandeja ↔ detalle (cada ruta monta su propio host).
// Paridad SimuladorHost.tsx.

import { Component, inject, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SimuladorPanelComponent } from './simulador-panel.component';
import { SimuladorStore } from './simulador.store';

@Component({
  selector: 'alma-simulador-host',
  imports: [LucideAngularModule, SimuladorPanelComponent],
  template: `
    <!-- El contenido se comprime para hacerle espacio al panel (desktop). -->
    <div class="transition-[margin-right] duration-300" [class.md:mr-[420px]]="simulador.abierto()">
      <ng-content />
    </div>

    <!-- Botón flotante: esquina superior derecha, debajo del header. -->
    @if (simulador.mostrarFlotante()) {
      <button
        type="button"
        (click)="simulador.alternar(true)"
        title="Simulador de asegurabilidad"
        aria-label="Abrir simulador de asegurabilidad"
        class="glass-strong fixed right-4 top-24 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border text-primary shadow-[var(--shadow-md)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] active:scale-95"
      >
        <lucide-icon name="calculator" [size]="18" />
      </button>
    }

    <alma-simulador-panel
      [open]="simulador.abierto()"
      [solicitudId]="solicitudId()"
      (closed)="simulador.alternar(false)"
    />
  `,
})
export class SimuladorHostComponent {
  /** Presente en la subpágina de detalle: el panel precarga esa cotización. */
  readonly solicitudId = input<string | undefined>(undefined);

  protected readonly simulador = inject(SimuladorStore);
}
