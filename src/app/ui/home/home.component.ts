// Inicio: la esfera de Alma saluda al usuario, como si fuera Alma hablándole.
// A futuro, este espacio será donde el Agente interactúe con el usuario.
// (Paridad routes/index.tsx v2.)

import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { AlmaHousingComponent } from '../../shared/components/alma-housing.component';
import { firstName } from '../../core/utils/name';

@Component({
  selector: 'alma-home',
  imports: [AlmaHousingComponent],
  template: `
    <div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <alma-housing [size]="188" [interactive]="true" />
      <h1 class="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {{ greeting() }}
      </h1>
    </div>
  `,
})
export class HomeComponent {
  private readonly auth = inject(AuthService);

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${saludo}, ${firstName(this.auth.user().nombre)}`;
  });
}
