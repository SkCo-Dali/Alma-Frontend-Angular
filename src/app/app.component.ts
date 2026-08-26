// Shell de la plataforma ALMA v2:
// - loading → splash de marca; login → pantalla de ingreso; inactive → aviso.
// - ready → app shell estilo macOS: alto de viewport acotado; el MAIN scrollea
//   internamente. Breadcrumb y Dock son fijos del shell, presentes en TODAS
//   las páginas (Dock flotante y siempre visible: el MAIN reserva pb extra
//   para que el contenido nunca quede tapado detrás de él).

import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService, authEnabled } from './core/auth/auth.service';
import { ApiService } from './core/services/api.service';
import { ApplicationsService } from './core/services/applications.service';
import { PreferencesService } from './core/services/preferences.service';
import { AlmaLoaderComponent } from './shared/components/alma-loader.component';
import { BreadcrumbComponent } from './shared/components/breadcrumb.component';
import { DockComponent } from './shared/components/dock.component';
import { HeaderComponent } from './shared/components/header.component';
import { InactiveScreenComponent } from './shared/components/inactive-screen.component';
import { LoginScreenComponent } from './shared/components/login-screen.component';
import { ToastsComponent } from './shared/components/toasts.component';

@Component({
  selector: 'alma-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    BreadcrumbComponent,
    DockComponent,
    AlmaLoaderComponent,
    LoginScreenComponent,
    InactiveScreenComponent,
    ToastsComponent,
  ],
  template: `
    @switch (auth.status()) {
      @case ('loading') {
        <div class="flex min-h-screen items-center justify-center bg-background">
          <alma-loader [size]="90" label="Verificando tu sesión…" />
        </div>
      }
      @case ('login') {
        <alma-login-screen />
      }
      @case ('inactive') {
        <alma-inactive-screen [email]="auth.profile()?.email ?? auth.user().correo" />
      }
      @case ('ready') {
        <div class="flex h-[100dvh] w-full flex-col overflow-hidden text-foreground">
          <alma-header />
          <main class="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-6 md:px-8 md:pb-28 md:pt-8">
            <!-- Las páginas que rinden un hijo con [data-full-bleed] (p. ej. la
                 bandeja de Suscripción) usan todo el ancho disponible. -->
            <div class="mx-auto w-full max-w-[1400px] has-[[data-full-bleed]]:max-w-none">
              <alma-breadcrumb />
              <router-outlet />
            </div>
          </main>
          <alma-dock />
          <alma-toasts />
        </div>
      }
    }
  `,
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  protected readonly prefs = inject(PreferencesService);
  private readonly apps = inject(ApplicationsService);

  constructor() {
    void this.auth.init(() => this.api.getMe());

    // Al quedar la sesión lista: sincronizar preferencias con el servidor y
    // precargar los íconos (cachean y luego cargan al instante).
    const listo = effect(() => {
      if (this.auth.status() !== 'ready') return;
      if (authEnabled) {
        this.prefs.conectarServidor(
          () => this.api.getPreferences(),
          (p) => this.api.savePreferences(p),
        );
      }
      const urls = new Set<string>();
      for (const a of this.apps.applications()) if (a.iconUrl) urls.add(a.iconUrl);
      urls.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
      listo.destroy();
    });
  }
}
