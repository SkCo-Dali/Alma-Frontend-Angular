import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'alma-not-found',
  imports: [RouterLink],
  template: `
    <div class="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <p class="text-sm text-muted-foreground">404</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-foreground">
        Página no encontrada
      </h1>
      <a routerLink="/" class="mt-6 text-sm font-medium text-primary hover:underline">
        Volver al inicio
      </a>
    </div>
  `,
})
export class NotFoundComponent {}
