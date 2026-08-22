// Pantalla de acceso denegado para rutas gateadas por permiso.

import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-access-denied',
  imports: [RouterLink, LucideAngularModule],
  template: `
    <div class="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <span
        class="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500"
      >
        <lucide-icon name="shield-alert" [size]="32" />
      </span>
      <h1 class="mt-6 text-2xl font-bold text-foreground">No tienes acceso</h1>
      <p class="mt-2 max-w-sm text-sm text-muted-foreground">
        {{ mensaje() }}
      </p>
      <a routerLink="/" class="mt-6 text-sm font-medium text-primary hover:underline">
        Volver al inicio
      </a>
    </div>
  `,
})
export class AccessDeniedComponent {
  readonly mensaje = input(
    'Si necesitas esta aplicación para tu trabajo, pídele acceso al administrador de la plataforma.',
  );
}
