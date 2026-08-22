// Página de la app Cheques (paridad con routes/apps.cheques.tsx).

import { Component } from '@angular/core';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb.component';
import { BandejaChequesComponent } from './bandeja-cheques.component';

@Component({
  selector: 'alma-cheques-page',
  imports: [BreadcrumbComponent, BandejaChequesComponent],
  template: `
    <div class="flex flex-col gap-4">
      <alma-breadcrumb current="Cheques" />
      <alma-bandeja-cheques />
    </div>
  `,
})
export class ChequesPageComponent {}
