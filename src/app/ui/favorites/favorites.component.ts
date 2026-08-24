// Favoritos.

import { Component, inject } from '@angular/core';
import { ApplicationsService } from '../../core/services/applications.service';
import { AppCardGridComponent } from '../../shared/components/app-card-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'alma-favorites',
  imports: [PageHeaderComponent, AppCardGridComponent],
  template: `
    <alma-page-header
      title="Favoritos"
      description="Aplicaciones que has marcado para acceso rápido."
    />
    <alma-app-card-grid
      [apps]="apps.favorites()"
      emptyMessage="Aún no tienes favoritos: márcalos con la estrella en el catálogo."
    />
  `,
})
export class FavoritesComponent {
  protected readonly apps = inject(ApplicationsService);
}
