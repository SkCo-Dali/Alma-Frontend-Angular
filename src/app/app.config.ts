import {
  ApplicationConfig,
  importProvidersFrom,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { LucideAngularModule } from 'lucide-angular';

import { routes } from './app.routes';
import { ALMA_ICONS } from './shared/icons';

// El diseño de Alma es la única fuente de estilos: sus tokens y componentes
// propios (styles.css + shared/components) gobiernan toda la interfaz. La
// librería corporativa (PrimeNG) queda como dependencia para el día en que se
// integren apps de otros equipos, pero NO se registra su tema: inyecta una hoja
// global de estilos que compite con la de Alma sin que ningún componente suyo
// se use aquí.

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideAnimationsAsync(),
    importProvidersFrom(LucideAngularModule.pick(ALMA_ICONS)),
  ],
};
