// Administración de los buzones de correo de la plataforma (sección de la
// App Configuración): qué buzón usa cada App, su estado y — mientras llega el
// admin consent de los permisos de aplicación — la conexión OAuth delegada
// (bootstrap). El backend decide quién puede administrar cada buzón
// (app.<slug>.correo.buzones.manage o platform.correo.buzones.manage); aquí
// solo se pinta lo que devuelve /api/correo/buzones.

import { Component, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '@env/environment';
import { BuzonCorreoApi, CorreoApi } from './correo.api';

@Component({
  selector: 'alma-buzones-correo-card',
  imports: [LucideAngularModule],
  template: `
    @if (buzones().length > 0) {
      <section class="glass rounded-xl p-5 shadow-[var(--shadow-sm)]">
        <h2 class="text-sm font-semibold text-foreground">Buzones de correo</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Cuentas desde las que las Apps envían correos. Con los permisos de
          aplicación otorgados por Infraestructura no requieren conexión; la
          conexión manual es el plan B mientras tanto.
        </p>
        <div class="mt-3 divide-y divide-border/40">
          @for (b of buzones(); track b.id) {
            <div class="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div class="flex min-w-0 items-center gap-3">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                     [class]="b.conectada
                       ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                       : 'bg-muted text-muted-foreground'">
                  <lucide-icon [name]="b.conectada ? 'plug-zap' : 'plug'" [size]="16" />
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ b.direccion }}</p>
                  <p class="truncate text-xs text-muted-foreground">
                    {{ b.descripcion || (b.app_slug ? 'App ' + b.app_slug : 'Plataforma') }}
                    ·
                    @if (b.conectada) {
                      conectado por {{ b.conectada_por }}
                    } @else if (b.estado === 'requiere_reconexion') {
                      <span class="font-medium text-amber-600 dark:text-amber-400">requiere reconexión</span>
                    } @else {
                      sin conectar (opera con permisos de aplicación si están otorgados)
                    }
                  </p>
                </div>
              </div>
              @if (b.puede_administrar) {
                <div class="flex shrink-0 items-center gap-2">
                  @if (b.conectada) {
                    <button type="button" (click)="desconectar(b)"
                            class="alma-btn alma-btn-outline h-8 rounded-xl text-xs">
                      Desconectar
                    </button>
                  }
                  <button type="button" (click)="conectar(b)"
                          class="alma-btn alma-btn-primary h-8 rounded-xl text-xs">
                    <lucide-icon name="plug-zap" [size]="13" />
                    {{ b.conectada ? 'Reconectar' : 'Conectar' }}
                  </button>
                </div>
              }
            </div>
          }
        </div>
        @if (error(); as err) {
          <p class="mt-2 text-xs font-medium text-destructive">{{ err }}</p>
        }
      </section>
    }
  `,
})
export class BuzonesCorreoCardComponent {
  private readonly api = inject(CorreoApi);

  protected readonly buzones = signal<BuzonCorreoApi[]>([]);
  protected readonly error = signal<string | null>(null);

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

  /** OAuth delegado: vuelve por /graph-callback con state = b:<id>|<url>. */
  protected conectar(b: BuzonCorreoApi): void {
    const params = new URLSearchParams({
      client_id: environment.azure.clientId,
      response_type: 'code',
      redirect_uri: `${window.location.origin}/graph-callback`,
      response_mode: 'query',
      scope: b.scopes,
      // Quien administra tiene SU sesión activa: selector de cuentas para
      // entrar con la del buzón, no con la personal.
      prompt: 'select_account',
      login_hint: b.direccion,
      state: `b:${b.id}|${window.location.pathname}${window.location.search}`,
    });
    window.location.href =
      `https://login.microsoftonline.com/${environment.azure.tenantId}` +
      `/oauth2/v2.0/authorize?${params.toString()}`;
  }

  protected async desconectar(b: BuzonCorreoApi): Promise<void> {
    this.error.set(null);
    try {
      await this.api.desconectarBuzon(b.id);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
    await this.cargar();
  }
}
