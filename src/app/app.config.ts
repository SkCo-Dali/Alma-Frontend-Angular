import {
  ApplicationConfig,
  importProvidersFrom,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';
import { LucideAngularModule } from 'lucide-angular';

import { routes } from './app.routes';
import { ALMA_ICONS } from './shared/icons';

// Tema "Alma" sobre la librería corporativa (PrimeNG): preset Aura con el
// verde Skandia (#00C83C) como primario. Los componentes PrimeNG que usen las
// apps migradas heredan automáticamente esta paleta.
const AlmaPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e6fbec',
      100: '#c4f5d3',
      200: '#8febaa',
      300: '#54de7e',
      400: '#23d25a',
      500: '#00c83c',
      600: '#00a832',
      700: '#088a2d',
      800: '#0a6d26',
      900: '#0b521f',
      950: '#063d17',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: AlmaPreset,
        options: {
          prefix: 'p',
          // el modo oscuro lo gobierna el shell con la clase .dark (ThemeService)
          darkModeSelector: '.dark',
          cssLayer: false,
        },
      },
    }),
    importProvidersFrom(LucideAngularModule.pick(ALMA_ICONS)),
  ],
};
