// Página de la app Motor de Suscripción (paridad con routes/apps.suscripcion.tsx).

import { Component } from '@angular/core';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb.component';
import { BandejaSuscripcionComponent } from './bandeja-suscripcion.component';

@Component({
  selector: 'alma-suscripcion-page',
  imports: [BreadcrumbComponent, BandejaSuscripcionComponent],
  template: `
    <div class="flex flex-col gap-4">
      <alma-breadcrumb current="Motor de Suscripción" />
      <alma-bandeja-suscripcion />
    </div>
  `,
})
export class SuscripcionPageComponent {}
