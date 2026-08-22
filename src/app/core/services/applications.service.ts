// Catálogo de aplicaciones visible para el usuario (paridad use-applications).

import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { APP_CATALOG } from '../constants/app-catalog';
import { Application } from '../models/platform.models';
import { PreferencesService } from './preferences.service';

@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly auth = inject(AuthService);
  private readonly prefs = inject(PreferencesService);

  readonly applications = computed<Application[]>(() => {
    // user() como dependencia: el catálogo se recalcula al resolver la sesión
    this.auth.user();
    const favorites = this.prefs.favorites();
    return APP_CATALOG.filter((a) => this.auth.hasPermission(a.requiredPermission)).map(
      (a) => ({ ...a, favorito: favorites.includes(a.id) }),
    );
  });

  readonly categories = computed(() =>
    Array.from(new Set(this.applications().map((a) => a.categoria))).sort(),
  );

  readonly favorites = computed(() => this.applications().filter((a) => a.favorito));

  byRoute(route: string): Application | undefined {
    return this.applications().find((a) => a.internalRoute === route);
  }
}
