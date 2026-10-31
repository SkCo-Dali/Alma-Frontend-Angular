// Pantalla cuando hay sesión de Microsoft pero el API de Alma no entregó el
// perfil (caído, colgado o con error): reintentar o cerrar sesión, en vez de
// quedarse en «Verificando tu sesión…» sin fin.

import { Component, inject, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'alma-sin-respuesta-screen',
  imports: [LucideAngularModule],
  template: `
    <div
      class="flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 text-center"
    >
      <span
        class="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500"
      >
        <lucide-icon name="unplug" [size]="32" />
      </span>
      <h1 class="mt-6 text-2xl font-bold text-foreground">No pudimos conectar con Nova</h1>
      <p class="mt-2 max-w-sm text-sm text-muted-foreground">
        Puede ser un problema temporal del servidor. Intenta de nuevo en unos segundos.
      </p>
      @if (email(); as e) {
        <p class="mt-1 max-w-sm text-sm text-muted-foreground">
          Para entrar con otra cuenta, cierra la sesión de
          <span class="font-medium text-foreground">{{ e }}</span>.
        </p>
      }
      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          (click)="reintentar()"
          class="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-md)] hover:opacity-90"
        >
          <lucide-icon name="refresh-cw" [size]="16" />
          Reintentar
        </button>
        <button
          type="button"
          (click)="signOut()"
          class="surface-solid inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground shadow-[var(--shadow-md)] hover:bg-accent"
        >
          <lucide-icon name="log-out" [size]="16" />
          Cerrar sesión
        </button>
      </div>
    </div>
  `,
})
export class SinRespuestaScreenComponent {
  private readonly auth = inject(AuthService);
  readonly email = input<string | null | undefined>(undefined);

  /** Vuelve al splash mientras pide el perfil otra vez. */
  protected reintentar(): void {
    void this.auth.reintentar();
  }

  protected signOut(): void {
    void this.auth.signOut();
  }
}
