// Buzones de correo de la plataforma (sección informativa de Configuración):
// desde qué cuenta envía correos cada App. Solo se muestra a usuarios con
// acceso a alguna App con buzón. El envío usa los permisos de aplicación de
// Entra (app-only) — no hay nada que conectar ni administrar aquí; la
// conexión OAuth delegada quedó solo como mecanismo de contingencia por API.

import { Component, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { BuzonCorreoApi, CorreoApi } from './correo.api';

@Component({
  selector: 'alma-buzones-correo-card',
  imports: [LucideAngularModule],
  template: `
    @if (buzones().length > 0) {
      <section class="glass rounded-xl p-5 shadow-[var(--shadow-sm)]">
        <h2 class="text-sm font-semibold text-foreground">Buzones de correo</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Cuentas desde las que se envían los correos de cada App.
        </p>
        <div class="mt-3 divide-y divide-border/40">
          @for (b of buzones(); track b.id) {
            <div class="flex items-center gap-3 py-2.5">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <lucide-icon name="mail" [size]="16" />
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ b.direccion }}</p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ b.descripcion || (b.app_slug ? 'App ' + b.app_slug : 'Plataforma') }}
                </p>
              </div>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class BuzonesCorreoCardComponent {
  private readonly api = inject(CorreoApi);

  protected readonly buzones = signal<BuzonCorreoApi[]>([]);

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const r = await this.api.getBuzones();
      this.buzones.set(r.items);
    } catch {
      this.buzones.set([]);
    }
  }
}
