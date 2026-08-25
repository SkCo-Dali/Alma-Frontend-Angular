// Arte del ícono de una App dentro del cuadrito redondeado ("squircle").
// - Agente Alma → la esfera "viva" como ícono.
// - iconUrl → imagen a sangre completa (estilo icono de App de iOS).
// - Fallback → degradado del color de la App + ícono lucide blanco.

import { Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Application } from '../../core/models/platform.models';
import { AlmaSphereComponent } from './alma-sphere.component';

@Component({
  selector: 'alma-app-icon-art',
  imports: [LucideAngularModule, AlmaSphereComponent],
  template: `
    @if (app().id === 'app-agente-alma') {
      <alma-sphere />
    } @else if (app().iconUrl; as url) {
      <img [src]="url" alt="" draggable="false" class="h-full w-full object-cover" />
    } @else if (flat()) {
      <!-- Glifo de color, sin cuadro (para el Dock aligerado). -->
      <lucide-icon
        [name]="app().icono"
        class="h-[80%] w-[80%]"
        [style.color]="app().color"
        [strokeWidth]="1.9"
      />
    } @else {
      <div
        class="flex h-full w-full items-center justify-center text-white"
        [style.background]="
          'linear-gradient(160deg, ' +
          app().color +
          ', color-mix(in srgb, ' +
          app().color +
          ' 72%, #000))'
        "
      >
        <lucide-icon [name]="app().icono" [class]="iconClassName()" [strokeWidth]="1.75" />
      </div>
    }
  `,
  styles: `
    :host { display: block; width: 100%; height: 100%; }
  `,
})
export class AppIconArtComponent {
  readonly app = input.required<Application>();
  readonly iconClassName = input('h-[55%] w-[55%]');
  /** true ⇒ glifo de color sin cuadro (Dock aligerado); false ⇒ tile clásico. */
  readonly flat = input(false);
}
