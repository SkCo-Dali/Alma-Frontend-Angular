// Shell de la plataforma ALMA: wallpaper (body) + header + contenido + dock.
// Mientras MSAL resuelve la sesión se muestra el splash de marca.

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ApiService } from './core/services/api.service';
import { ThemeService } from './core/services/theme.service';
import { AlmaLoaderComponent } from './shared/components/alma-loader.component';
import { DockComponent } from './shared/components/dock.component';
import { HeaderComponent } from './shared/components/header.component';

@Component({
  selector: 'alma-root',
  imports: [RouterOutlet, HeaderComponent, DockComponent, AlmaLoaderComponent],
  template: `
    @if (auth.status() === 'loading') {
      <div class="flex min-h-screen items-center justify-center bg-background">
        <alma-loader [size]="90" label="Verificando tu sesión…" />
      </div>
    } @else {
      <alma-header />
      <main class="mx-auto w-full max-w-7xl px-4 pb-32 pt-8 md:px-6">
        <router-outlet />
      </main>
      <alma-dock />
    }
  `,
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  // instanciar el servicio aplica el tema persistido desde el arranque
  private readonly theme = inject(ThemeService);

  constructor() {
    void this.auth.init(() => this.api.getMe());
  }
}
