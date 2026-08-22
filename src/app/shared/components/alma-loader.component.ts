// Loader de marca de ALMA: la esfera "viva" de Alma girando sus colores
// mientras carga (paridad con AlmaLoader.tsx v2).

import { Component, input } from '@angular/core';
import { AlmaSphereComponent } from './alma-sphere.component';

@Component({
  selector: 'alma-loader',
  imports: [AlmaSphereComponent],
  template: `
    <div
      role="status"
      [attr.aria-label]="label() ?? 'Cargando'"
      class="flex flex-col items-center gap-3"
    >
      <div [style.width.px]="size()" [style.height.px]="size()">
        <alma-sphere />
      </div>
      @if (label(); as l) {
        <span class="text-sm text-muted-foreground">{{ l }}</span>
      }
    </div>
  `,
})
export class AlmaLoaderComponent {
  readonly size = input<number>(64);
  readonly label = input<string | undefined>(undefined);
}
