import { DOCUMENT } from '@angular/common';
import { ENVIRONMENT_INITIALIZER, EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import { SKANDIA_DESIGN_TOKENS_CSS, SkandiaPreset } from '@skandia/ui';

// Fork local de `provideSkandiaUI()` (SkCo.Fidu.DesignSystem.Lib.UX ›
// src/app/providers/skandia.providers.ts). Reusa el theme de PrimeNG y la
// inyección de tokens CSS, pero omite los dos <link> remotos a
// skcoblobresources.blob.core.windows.net (sk-desing-main.css / sk-icon-all.min.css):
// ese CSS legacy no es parte de la librería sancionada, no tiene versión fija
// ni SRI, y Alma ya auto-hospeda su propia tipografía (public/fonts/). Alma
// también ya registra `provideAnimationsAsync()` en app.config.ts, así que no
// se duplica aquí.
export function provideAlmaSkandiaUI(): EnvironmentProviders {
  return makeEnvironmentProviders([
    providePrimeNG({
      theme: {
        preset: SkandiaPreset,
        options: { darkModeSelector: false },
      },
      translation: {
        dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
        dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
        dayNamesMin: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
        monthNames: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
        monthNamesShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
        today: 'Hoy',
        clear: 'Limpiar',
        weekHeader: 'Sm',
        firstDayOfWeek: 1,
      },
    }),
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const doc = inject(DOCUMENT);
        if (!doc.getElementById('skandia-design-tokens')) {
          const style = doc.createElement('style');
          style.id = 'skandia-design-tokens';
          style.textContent = SKANDIA_DESIGN_TOKENS_CSS;
          doc.head.prepend(style);
        }
      },
    },
  ]);
}
