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
    /* lucide-icon no tiene tamaño propio (encoge al contenido): sin esto, el
       % del glyph se resuelve contra su svg (24px) en vez del tile, y al no
       centrarse por sí solo queda pegado arriba a la izquierda. */
    lucide-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
  `,
})
export class AppIconArtComponent {
  readonly app = input.required<Application>();
  readonly iconClassName = input('h-[62%] w-[62%]');
}
