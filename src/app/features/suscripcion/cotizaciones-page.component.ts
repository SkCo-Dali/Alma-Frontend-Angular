// Bandeja de Cotizaciones (paridad routes/apps.suscripcion_.cotizaciones.tsx):
// host del Simulador de asegurabilidad (botón flotante + panel lateral no
// bloqueante) + barra con "volver" a la landing + la bandeja server-side.

import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { BandejaSuscripcionComponent } from './bandeja-suscripcion.component';
import { SimuladorHostComponent } from './simulador/simulador-host.component';

@Component({
  selector: 'alma-cotizaciones-page',
  imports: [
    RouterLink,
    LucideAngularModule,
    AccessDeniedComponent,
    BandejaSuscripcionComponent,
    SimuladorHostComponent,
  ],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <alma-simulador-host>
        <div class="flex flex-col gap-3">
          <!-- Barra superior: volver a la landing de la App -->
          <div class="flex items-center gap-3">
            <a
              routerLink="/apps/suscripcion"
              class="flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <lucide-icon name="arrow-left" [size]="16" />
              Suscripción de Seguros
            </a>
          </div>
          <alma-bandeja-suscripcion />
        </div>
      </alma-simulador-host>
    }
  `,
})
export class CotizacionesPageComponent {
  private readonly auth = inject(AuthService);
  protected readonly puedeVer = computed(() =>
    this.auth.hasPermission('app.suscripcion.view'),
  );
}
