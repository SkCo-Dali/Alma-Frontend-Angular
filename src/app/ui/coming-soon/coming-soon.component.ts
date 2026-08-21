// Página genérica para secciones del shell aún no portadas desde React.

import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'alma-coming-soon',
  imports: [LucideAngularModule, PageHeaderComponent],
  template: `
    <alma-page-header [title]="pageTitle" [description]="pageDescription" />
    <div
      class="glass flex items-center gap-3 rounded-xl px-5 py-4 shadow-[var(--shadow-sm)]"
    >
      <lucide-icon name="construction" [size]="22" class="shrink-0 text-warning" />
      <p class="text-sm text-muted-foreground">
        Esta sección está en migración desde el front React de Alma.
      </p>
    </div>
  `,
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly pageTitle =
    (this.route.snapshot.data['pageTitle'] as string | undefined) ?? 'Próximamente';
  protected readonly pageDescription = this.route.snapshot.data['pageDescription'] as
    | string
    | undefined;
}
