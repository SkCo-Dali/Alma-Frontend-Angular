// Línea de estado de un módulo del buzón (Asignación, Búsqueda en bases,
// Exportación) arriba de su pestaña: «Activo» o «Desactivado», con el atajo a
// Ajustes → Módulos, que es donde se prenden y apagan.

import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-modulo-estado',
  imports: [LucideAngularModule],
  styleUrls: ['./buzon-proto.css'],
  styles: [`:host { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }`],
  template: `
    <span class="xs b">Módulo {{ nombre() }}</span>
    @if (activo()) {
      <span class="badge b-emerald"><lucide-icon name="check-circle-2" [size]="13" /> Activo</span>
    } @else {
      <span class="badge b-slate"><lucide-icon name="circle-off" [size]="13" /> Desactivado</span>
    }
    @if (puede()) {
      <button type="button" class="linkbtn xs" (click)="irAjustes.emit()">Cambiar en Ajustes → Módulos</button>
    }
  `,
})
export class ModuloEstadoComponent {
  readonly nombre = input.required<string>();
  readonly activo = input.required<boolean>();
  readonly puede = input(true);
  readonly irAjustes = output<void>();
}
