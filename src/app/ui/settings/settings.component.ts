// Configuración (paridad con routes/settings.tsx).

import { Component } from '@angular/core';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

const SECTIONS = [
  {
    title: 'Apariencia',
    description: 'Tema, densidad y preferencias visuales del portal.',
    fields: [
      { label: 'Tema', value: 'Claro / Oscuro (botón del header)' },
      { label: 'Densidad', value: 'Confortable' },
      { label: 'Idioma', value: 'Español' },
    ],
  },
  {
    title: 'Notificaciones',
    description: 'Controla qué alertas recibes del portal.',
    fields: [
      { label: 'Comunicados', value: 'Activado' },
      { label: 'Solicitudes de acceso', value: 'Activado' },
      { label: 'Cambios en aplicaciones', value: 'Solo importantes' },
    ],
  },
  {
    title: 'Sesión',
    description: 'Gestión de sesión e identidad corporativa.',
    fields: [
      { label: 'Proveedor de identidad', value: 'Microsoft Entra ID' },
      { label: 'Última sesión', value: 'Hoy' },
    ],
  },
];

@Component({
  selector: 'alma-settings',
  imports: [PageHeaderComponent],
  template: `
    <alma-page-header title="Configuración" description="Preferencias personales del portal." />
    <div class="flex flex-col gap-5">
      @for (s of sections; track s.title) {
        <div class="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 class="text-sm font-semibold text-foreground">{{ s.title }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">{{ s.description }}</p>
          <div class="mt-4 divide-y divide-border">
            @for (f of s.fields; track f.label) {
              <div class="flex items-center justify-between py-3">
                <span class="text-sm text-foreground">{{ f.label }}</span>
                <span class="text-sm text-muted-foreground">{{ f.value }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class SettingsComponent {
  protected readonly sections = SECTIONS;
}
