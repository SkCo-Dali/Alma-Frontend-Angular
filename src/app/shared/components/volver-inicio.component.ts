// Botón «← Inicio» de las pantallas de entrada de cada App: mismo estilo vidrio
// que ya usaban Aplicación de Pagos, Monitor-IA, Prestaciones y el Visor.

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-volver-inicio',
  imports: [RouterLink, LucideAngularModule],
  template: `
    <a
      routerLink="/"
      class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] transition-colors hover:text-primary"
    >
      <lucide-icon name="arrow-left" [size]="16" /> Inicio
    </a>
  `,
  host: { class: 'inline-flex shrink-0' },
})
export class VolverInicioComponent {}
