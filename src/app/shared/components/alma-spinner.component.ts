// Spinner propio (SVG + CSS). El arco gira sobre su centro, sin el vaivén
// que produce un anillo hecho solo con border.

import { Component, input } from '@angular/core';

@Component({
  selector: 'alma-spinner',
  host: { class: 'inline-flex shrink-0 items-center justify-center' },
  styles: `
    .alma-spinner {
      display: block;
    }
    .alma-spinner-arc {
      transform-box: view-box;
      transform-origin: center;
      animation: alma-spin 1.35s linear infinite;
    }
    @keyframes alma-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `,
  template: `
    <svg
      class="alma-spinner"
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      [attr.aria-label]="label() ?? 'Cargando'"
      [style.width.px]="size()"
      [style.height.px]="size()"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        stroke-width="2.25"
        opacity="0.16"
      />
      <circle
        class="alma-spinner-arc"
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-dasharray="16 41"
      />
    </svg>
  `,
})
export class AlmaSpinnerComponent {
  readonly size = input(16);
  readonly label = input<string | undefined>(undefined);
}
