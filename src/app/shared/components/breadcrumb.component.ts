// Miga de pan de las apps: Inicio > Aplicaciones > {app actual}.

import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-breadcrumb',
  imports: [RouterLink, LucideAngularModule],
  template: `
    <nav class="flex items-center gap-1.5 text-xs text-muted-foreground">
      <a routerLink="/" class="hover:text-foreground">Inicio</a>
      <lucide-icon name="chevron-right" [size]="12" />
      <a routerLink="/applications" class="hover:text-foreground">Aplicaciones</a>
      <lucide-icon name="chevron-right" [size]="12" />
      <span class="font-medium text-foreground">{{ current() }}</span>
    </nav>
  `,
})
export class BreadcrumbComponent {
  readonly current = input.required<string>();
}
