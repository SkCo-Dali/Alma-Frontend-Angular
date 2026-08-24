// Página de la app Cheques.

import { Component } from '@angular/core';
import { BandejaChequesComponent } from './bandeja-cheques.component';

@Component({
  selector: 'alma-cheques-page',
  imports: [BandejaChequesComponent],
  template: `
    <div class="flex flex-col gap-4">
      <alma-bandeja-cheques />
    </div>
  `,
})
export class ChequesPageComponent {}
