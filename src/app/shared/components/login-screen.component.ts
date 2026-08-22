// Página de inicio de sesión (paridad LoginScreen.tsx). No pide credenciales:
// el botón abre el flujo de Microsoft (Entra ID). La esfera Alma es el foco.

import { Component, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AlmaHousingComponent } from './alma-housing.component';

@Component({
  selector: 'alma-login-screen',
  imports: [LucideAngularModule, AlmaHousingComponent],
  template: `
    <div
      class="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6 text-center"
    >
      <!-- Logo arriba a la izquierda -->
      <div class="absolute left-6 top-6 flex items-center gap-2">
        <img src="alma-logo.png" alt="Alma" class="h-9 w-auto dark:hidden" />
        <img src="alma-logo-neg.png" alt="Alma" class="hidden h-9 w-auto dark:block" />
      </div>

      <alma-housing [size]="224" [interactive]="true" />

      <h1 class="mt-8 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Bienvenido a Alma
      </h1>
      <p class="mt-2 text-sm text-muted-foreground">Conecta · Orquesta · Impulsa</p>

      <button
        type="button"
        (click)="entrar()"
        [disabled]="cargando()"
        class="surface-solid mt-8 inline-flex items-center gap-2.5 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground shadow-[var(--shadow-md)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] disabled:opacity-70"
      >
        @if (cargando()) {
          <lucide-icon name="loader-2" [size]="16" class="animate-spin" />
        } @else {
          <svg viewBox="0 0 21 21" class="h-4 w-4" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
          </svg>
        }
        {{ cargando() ? 'Redirigiendo…' : 'Iniciar sesión con Microsoft' }}
      </button>

      <p class="mt-5 max-w-xs text-xs text-muted-foreground">
        Usa tu cuenta corporativa Skandia. Serás redirigido a Microsoft para
        autenticarte de forma segura.
      </p>
    </div>
  `,
})
export class LoginScreenComponent {
  private readonly auth = inject(AuthService);
  protected readonly cargando = signal(false);

  protected entrar(): void {
    this.cargando.set(true);
    void this.auth.signIn(); // redirige a Microsoft
  }
}
