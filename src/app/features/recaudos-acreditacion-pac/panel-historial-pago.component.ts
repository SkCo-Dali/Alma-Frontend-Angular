// Panel lateral de solo lectura con el detalle de un pago (clic en la fila): lo que la
// IA extrajo del correo y el historial.

import { Component, computed, inject, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { DatosExtraidosComponent } from './datos-extraidos.component';
import { HistorialPagoComponent } from './historial-pago.component';
import {
  PagoPac,
  RecaudosPacApi,
  estiloBadge,
  formatoFecha,
  formatoMonto,
} from './recaudos-pac.api';

@Component({
  selector: 'alma-panel-historial-pago',
  imports: [LucideAngularModule, HistorialPagoComponent, DatosExtraidosComponent],
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
  template: `
    <div class="fixed inset-0 z-50 flex justify-end">
      <div class="absolute inset-0 bg-black/35" (click)="cerrar.emit()"></div>
      <aside
        class="surface-solid relative flex h-dvh w-full flex-col gap-5 overflow-y-auto border-l border-border p-4 shadow-[var(--shadow-lg)] sm:w-[520px] sm:max-w-[92vw] sm:p-6"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Detalle ' + pago().referencia"
      >
        <div>
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-bold text-foreground">{{ pago().referencia }}</h3>
              <p class="text-[13px] text-muted-foreground">{{ pago().empresa }} · {{ monto(pago().monto) }}</p>
            </div>
            <button type="button" class="alma-btn alma-btn-ghost" (click)="cerrar.emit()" aria-label="Cerrar">
              <lucide-icon name="x" [size]="18" />
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="alma-badge gap-1.5" [style]="badge(meta().color)">
              <span class="h-1.5 w-1.5 rounded-full" [style.background]="meta().color"></span>
              {{ meta().nombre }}
            </span>
            <span class="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground">{{ pago().analista }}</span>
            <span class="text-xs text-muted-foreground">Procesado {{ fecha(pago().fecha_procesamiento) }}</span>
          </div>
        </div>
        <alma-datos-extraidos [pago]="pago()" />
        <div class="border-t border-border pt-5">
          <alma-historial-pago [historial]="pago().historial" />
        </div>
      </aside>
    </div>
  `,
})
export class PanelHistorialPagoComponent {
  readonly pago = input.required<PagoPac>();
  readonly cerrar = output<void>();

  private readonly api = inject(RecaudosPacApi);

  protected readonly meta = computed(() => this.api.meta(this.pago().estado));
  protected readonly badge = estiloBadge;
  protected readonly monto = formatoMonto;
  protected readonly fecha = formatoFecha;
}
