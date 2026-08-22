// Pantalla para usuarios cuya cuenta existe en alma.Users pero está INACTIVA
// (paridad InactiveScreen.tsx).

import { Component, inject, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'alma-inactive-screen',
  imports: [LucideAngularModule],
  template: `
    <div
      class="flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 text-center"
    >
      <span
        class="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500"
      >
        <lucide-icon name="shield-alert" [size]="32" />
      </span>
      <h1 class="mt-6 text-2xl font-bold text-foreground">Cuenta inactiva</h1>
      <p class="mt-2 max-w-sm text-sm text-muted-foreground">
        Tu cuenta
        @if (email(); as e) {
          <span class="font-medium text-foreground">({{ e }})</span>
        }
        está inactiva en Alma. Contacta al administrador de la plataforma para habilitar
        tu acceso.
      </p>
      <button
        type="button"
        (click)="signOut()"
        class="surface-solid mt-8 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground shadow-[var(--shadow-md)] hover:bg-accent"
      >
        <lucide-icon name="log-out" [size]="16" />
        Cerrar sesión
      </button>
    </div>
  `,
})
export class InactiveScreenComponent {
  private readonly auth = inject(AuthService);
  readonly email = input<string | null | undefined>(undefined);

  protected signOut(): void {
    void this.auth.signOut();
  }
}
