// Encabezado de página del shell.

import { Component, input } from '@angular/core';

@Component({
  selector: 'alma-page-header',
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-foreground">{{ title() }}</h1>
      @if (description(); as d) {
        <p class="mt-1 text-sm text-muted-foreground">{{ d }}</p>
      }
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string | undefined>(undefined);
}
