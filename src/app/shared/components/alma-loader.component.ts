// Loader de marca de ALMA: la "A" del logo se dibuja a sí misma en loop
// (primero el trazo azul, luego el arco verde). Portado 1:1 de AlmaLoader.tsx.

import { Component, input } from '@angular/core';

@Component({
  selector: 'alma-loader',
  template: `
    <div
      role="status"
      [attr.aria-label]="label() ?? 'Cargando'"
      class="flex flex-col items-center gap-3"
    >
      <svg viewBox="0 0 40 40" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
        <path
          class="alma-loader-stroke"
          pathLength="1"
          d="M6 33 L18 7 a2.4 2.4 0 0 1 4.2 0 L34 33"
          fill="none"
          stroke="#0F6CBD"
          stroke-width="5"
          stroke-linecap="round"
        />
        <path
          class="alma-loader-stroke alma-loader-arc"
          pathLength="1"
          d="M12 28 C18 22, 24 22, 30 28"
          fill="none"
          stroke="#00C83C"
          stroke-width="5"
          stroke-linecap="round"
        />
      </svg>
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
