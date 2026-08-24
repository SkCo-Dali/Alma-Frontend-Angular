// Host de aplicaciones: materializa el App Manifest según integrationType.
//  - internal:      la app vive en este workspace y su ruta se declara en
//                   app.routes.ts, así que nunca llega hasta aquí.
//  - iframe:        app existente embebida con SSO silencioso de Entra.
//  - microfrontend: app de otro equipo montada como Web Component.
//
// El estado final es la red de seguridad: una App del catálogo que no declara
// cómo se monta (o cuya ruta no existe) cae aquí en vez de romper la navegación.

import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { ApplicationsService } from '../../core/services/applications.service';
import { MicrofrontendHostComponent } from './microfrontend-host.component';

@Component({
  selector: 'alma-app-host',
  imports: [RouterLink, LucideAngularModule, MicrofrontendHostComponent],
  template: `
    @if (app(); as a) {
      @if (a.integrationType === 'microfrontend') {
        <alma-microfrontend-host [app]="a" />
      } @else if (a.integrationType === 'iframe') {
        <div class="glass overflow-hidden rounded-xl shadow-[var(--shadow-md)]">
          <iframe
            [src]="iframeUrl()"
            [title]="a.nombre"
            class="h-[calc(100vh-13rem)] w-full border-0"
          ></iframe>
        </div>
      } @else {
        <div class="flex min-h-[55vh] flex-col items-center justify-center text-center">
          <div
            class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[26%] text-white shadow-[0_4px_10px_rgba(0,0,0,.18)]"
            [style.background]="
              'linear-gradient(160deg, ' + a.color + ', ' + a.color + 'bb)'
            "
          >
            <lucide-icon [name]="a.icono" [size]="44" [strokeWidth]="1.75" />
          </div>
          <h1 class="mt-6 text-3xl font-bold tracking-tight text-foreground">
            {{ a.nombre }}
          </h1>
          <p class="mt-2 max-w-md text-sm text-muted-foreground">{{ a.descripcion }}</p>
          <div
            class="glass mt-8 flex items-center gap-3 rounded-xl px-5 py-4 text-left shadow-[var(--shadow-sm)]"
          >
            <lucide-icon name="construction" [size]="22" class="shrink-0 text-warning" />
            <div>
              <p class="text-sm font-semibold text-foreground">Aplicación no disponible</p>
              <p class="text-xs text-muted-foreground">
                Su manifiesto no declara cómo se monta en la plataforma. Escríbele al
                equipo dueño de la aplicación.
              </p>
            </div>
          </div>
          <a
            routerLink="/"
            class="mt-8 flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <lucide-icon name="arrow-left" [size]="16" /> Volver al inicio
          </a>
        </div>
      }
    } @else {
      <div class="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <h1 class="text-2xl font-bold text-foreground">No tienes acceso a esta aplicación</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Si la necesitas para tu trabajo, pídela en Solicitudes de acceso.
        </p>
        <a
          routerLink="/access-requests"
          class="mt-6 text-sm font-medium text-primary hover:underline"
        >
          Ir a Solicitudes de acceso
        </a>
      </div>
    }
  `,
})
export class AppHostComponent {
  private readonly apps = inject(ApplicationsService);
  private readonly sanitizer = inject(DomSanitizer);

  /** Parámetro de ruta (withComponentInputBinding). */
  readonly appId = input.required<string>();

  protected readonly app = computed(() => this.apps.byRoute(`/apps/${this.appId()}`));

  protected iframeUrl(): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.app()?.url ?? 'about:blank');
  }
}
