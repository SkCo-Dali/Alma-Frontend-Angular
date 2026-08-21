// Inicio minimalista, como un escritorio de Mac recién abierto: la fecha, el
// saludo y el dock. Las aplicaciones viven en el dock. (Paridad routes/index.tsx)

import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

@Component({
  selector: 'alma-home',
  template: `
    <div class="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <p class="text-sm capitalize text-muted-foreground">{{ today }}</p>
      <h1 class="mt-3 text-5xl font-bold tracking-tight text-foreground">
        {{ greeting() }} 👋
      </h1>
      <p class="mt-3 text-sm text-muted-foreground">
        Tus aplicaciones te esperan en el dock.
      </p>
    </div>
  `,
})
export class HomeComponent {
  private readonly auth = inject(AuthService);

  protected readonly today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${saludo}, ${firstName(this.auth.user().nombre)}`;
  });
}
