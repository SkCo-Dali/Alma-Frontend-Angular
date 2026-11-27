// Host del panel del simulador: el panel (nova-dialog lateral) flota POR ENCIMA del
// contenido SIN mover la tabla; clic fuera, Esc o arrastrar lo cierran (igual que
// el panel de Columnas). El botón flotante vive bajo el
// header (top-24) y se OCULTA cuando la página monta su propio disparador en el toolbar
// (alma-simulador-boton). El estado abierto/cerrado persiste en sessionStorage para
// sobrevivir la navegación bandeja ↔ detalle (cada ruta monta su propio host).

import { Component, inject, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SimuladorPanelComponent } from './simulador-panel.component';
import { SimuladorStore } from './simulador.store';

@Component({
  selector: 'alma-simulador-host',
  imports: [LucideAngularModule, SimuladorPanelComponent],
  template: `
    <!-- El panel flota por ENCIMA del contenido (overlay); la tabla no se mueve. -->
    <ng-content />

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

    <!-- El panel es un nova-dialog lateral: trae su propio velo y animación. -->

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
