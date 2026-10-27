// Recorrido de la asignación de un correo (traza del backend): una lista vertical
// con un ícono por estado — ok (aplicó), skip (no aplica), warn (siguió de largo
// por algo que conviene revisar) y bad (quedó sin responsable).

import { Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PasoTraza } from './buzon.api';

const ESTADOS: Record<PasoTraza['estado'], { icon: string; clase: string; nombre: string }> = {
  ok: { icon: 'check-circle-2', clase: 'text-emerald-600 dark:text-emerald-400', nombre: 'Aplicó' },
  skip: { icon: 'circle-dashed', clase: 'text-muted-foreground', nombre: 'No aplica' },
  warn: { icon: 'alert-triangle', clase: 'text-amber-600 dark:text-amber-400', nombre: 'Revisar' },
  bad: { icon: 'x-circle', clase: 'text-rose-600 dark:text-rose-400', nombre: 'Sin responsable' },
};

@Component({
  selector: 'alma-traza-asignacion',
  imports: [LucideAngularModule],
  template: `
    @if (traza().length) {
      <ol class="relative grid gap-3 border-l border-border/70 pl-5" [attr.aria-label]="'Recorrido de la asignación'">
        @for (t of traza(); track $index) {
          <li class="relative">
            <span class="absolute -left-[29px] top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-card" [class]="estados[t.estado].clase">
              <lucide-icon [name]="estados[t.estado].icon" [size]="16" [attr.aria-label]="estados[t.estado].nombre" />
            </span>
            <p class="text-sm font-medium leading-snug text-foreground" [class.text-muted-foreground]="t.estado === 'skip'">{{ t.titulo }}</p>
            @if (t.detalle) { <p class="text-xs leading-snug text-muted-foreground">{{ t.detalle }}</p> }
          </li>
        }
      </ol>
    } @else {
      <p class="text-xs text-muted-foreground">{{ vacio() }}</p>
    }
  `,
})
export class TrazaAsignacionComponent {
  readonly traza = input<PasoTraza[]>([]);
  readonly vacio = input('Sin recorrido de asignación.');
  protected readonly estados = ESTADOS;
}
