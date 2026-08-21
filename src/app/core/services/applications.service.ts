// Catálogo de aplicaciones visible para el usuario (paridad con use-applications).

import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { APP_CATALOG } from '../constants/app-catalog';
import { Application } from '../models/platform.models';
import { UiStateService } from './ui-state.service';

@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiStateService);

  readonly applications = computed<Application[]>(() => {
    // user() como dependencia: el catálogo se recalcula al resolver la sesión
    this.auth.user();
    const favorites = this.ui.favorites();
    return APP_CATALOG.filter((a) => this.auth.hasPermission(a.requiredPermission)).map(
      (a) => ({ ...a, favorito: favorites.includes(a.id) }),
    );
  });

  readonly categories = computed(() =>
    Array.from(new Set(this.applications().map((a) => a.categoria))).sort(),
  );

  byRoute(route: string): Application | undefined {
    return this.applications().find((a) => a.internalRoute === route);
  }
}
