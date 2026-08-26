import {
  ApplicationConfig,
  importProvidersFrom,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { LucideAngularModule } from 'lucide-angular';

import { routes } from './app.routes';
import { ALMA_ICONS } from './shared/icons';
import { authInterceptor } from './core/http/auth.interceptor';
import { retryInterceptor } from './core/http/retry.interceptor';
import { provideAlmaSkandiaUI } from './shared/providers/alma-skandia-ui.provider';

// El lenguaje visual de Alma (styles.css + shared/components) sigue siendo la
// fuente de estilos hoy. La adopción del Design System de Skandia
// (`@skandia/ui` + tokens de SkCo.Fidu.DesignSystem.Lib.UX) está en curso —
// ver docs/skandia-ui-adoption.md para el estado y el plan de migración
// componente por componente.

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, retryInterceptor])),
    provideAnimationsAsync(),
    provideAlmaSkandiaUI(),
    importProvidersFrom(LucideAngularModule.pick(ALMA_ICONS)),
  ],
};
