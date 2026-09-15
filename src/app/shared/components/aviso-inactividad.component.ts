// Aviso previo al cierre de sesión por inactividad. Aparece solo en el último
// minuto: cerrar de golpe le haría perder al analista un formulario a medio
// llenar, que es justo el trabajo del módulo de suscripción.

import { Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

import { InactividadService } from '../../core/auth/inactividad.service';

@Component({
  selector: 'alma-aviso-inactividad',
  imports: [LucideAngularModule],
  template: `
    @if (segundos(); as s) {
      <div
        class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="aviso-inactividad-titulo"
      >
        <div
          class="surface-solid w-full max-w-sm rounded-2xl border border-border p-6 text-center shadow-[var(--shadow-lg)]"
        >
          <span
            class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"
          >
            <lucide-icon name="clock-3" [size]="24" />
          </span>

          <h2 id="aviso-inactividad-titulo" class="mt-4 text-lg font-bold text-foreground">
            ¿Sigues ahí?
          </h2>
          <p class="mt-2 text-sm text-muted-foreground">
            Por seguridad cerraremos tu sesión en
            <span class="font-semibold tabular-nums text-foreground">{{ s }}</span>
            {{ s === 1 ? 'segundo' : 'segundos' }} por inactividad.
          </p>

          <button
            type="button"
            (click)="continuar()"
            class="alma-btn alma-btn-primary mt-6 h-10 w-full rounded-xl text-sm"
            autofocus
          >
            Seguir trabajando
          </button>
        </div>
      </div>
    }
  `,
})
export class AvisoInactividadComponent {
  private readonly inactividad = inject(InactividadService);

  protected readonly segundos = computed(() => this.inactividad.avisoSegundos());

  protected continuar(): void {
    this.inactividad.continuar();
  }
}
