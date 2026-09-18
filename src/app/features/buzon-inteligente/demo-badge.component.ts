// Chip que avisa cuando la App está mostrando datos de demostración (el backend del
// módulo aún no está disponible en el ambiente). Ver BuzonApi.modoDemo.

import { Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipDirective } from '../../shared/tooltip.directive';
import { BuzonApi } from './buzon.api';

@Component({
  selector: 'alma-demo-badge',
  imports: [LucideAngularModule, TooltipDirective],
  template: `
    @if (api.modoDemo()) {
      <span
        class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
        almaTooltip="El backend del módulo aún no está disponible en este ambiente. Se muestran datos de ejemplo del área de Recaudos; las acciones se simulan."
      >
        <lucide-icon name="flask-conical" [size]="12" />
        Datos de demostración
      </span>
    }
  `,
})
export class DemoBadgeComponent {
  protected readonly api = inject(BuzonApi);
}
