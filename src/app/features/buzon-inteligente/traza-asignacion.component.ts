// Recorrido de la asignación de un correo (prototipo: «Recorrido», <ol class="tl">):
// un paso por regla con su estado — ok (aplicó), skip (no aplica), warn (siguió de
// largo por algo que conviene revisar) y bad (quedó sin responsable).

import { Component, input } from '@angular/core';
import { PasoTraza } from './buzon.api';

@Component({
  selector: 'alma-traza-asignacion',
  styleUrls: ['./buzon-proto.css'],
  template: `
    @if (traza().length) {
      <ol class="tl" aria-label="Recorrido de la asignación">
        @for (t of traza(); track $index) {
          <li [class]="t.estado"><p class="sm b">{{ t.titulo }}</p>@if (t.detalle) { <p class="w">{{ t.detalle }}</p> }</li>
        }
      </ol>
    } @else {
      <p class="xs muted">{{ vacio() }}</p>
    }
  `,
})
export class TrazaAsignacionComponent {
  readonly traza = input<PasoTraza[]>([]);
  readonly vacio = input('Sin recorrido de asignación.');
}
