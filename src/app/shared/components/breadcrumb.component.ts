// Breadcrumb del shell: ruta de navegación (Inicio › App › Página) para que el
// usuario pueda volver entre pantallas. Se arma a partir de la URL activa —
// ninguna página necesita declarar sus propios crumbs.

import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { filter } from 'rxjs/operators';
import { ApplicationsService } from '../../core/services/applications.service';

interface Crumb {
  label: string;
  to?: string;
}

@Component({
  selector: 'alma-breadcrumb',
  imports: [RouterLink, LucideAngularModule],
  template: `
    @if (crumbs().length) {
      <nav aria-label="Ruta de navegación" class="mb-5 flex flex-wrap items-center gap-1.5 text-sm">
        <a
          routerLink="/"
          class="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <lucide-icon name="home" [size]="14" />
          <span>Inicio</span>
        </a>
        @for (crumb of crumbs(); track crumb.label + $index) {
          <lucide-icon name="chevron-right" [size]="14" class="text-muted-foreground/50" />
          @if (crumb.to) {
            <a
              [routerLink]="crumb.to"
              class="text-muted-foreground transition-colors hover:text-foreground"
            >
              {{ crumb.label }}
            </a>
          } @else {
            <span class="font-medium text-foreground" aria-current="page">{{ crumb.label }}</span>
          }
        }
      </nav>
    }
  `,
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly apps = inject(ApplicationsService);

  private readonly url = signal(this.router.url);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.url.set(this.router.url));
  }

  protected readonly crumbs = computed<Crumb[]>(() => {
    const path = this.url().split('?')[0].split('#')[0];
    if (path === '/' || path === '') return [];

    const segments = path.split('/').filter(Boolean);
    const crumbs: Crumb[] = [];

    if (segments[0] === 'apps' && segments[1]) {
      const base = `/apps/${segments[1]}`;
      const app = this.apps.applications().find((a) => a.internalRoute === base);
      const label = app?.nombre ?? segments[1];
      const isLanding = segments.length === 2;
      crumbs.push({ label, to: isLanding ? undefined : base });
      if (!isLanding) crumbs.push({ label: this.pageTitle(), to: undefined });
    } else {
      crumbs.push({ label: this.pageTitle(), to: undefined });
    }

    return crumbs;
  });

  private pageTitle(): string {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return (route.title ?? '').replace(/\s*—\s*ALMA\s*$/, '');
  }
}
