// Lo que la IA extrajo del correo del pago (LogEstadistica), con una alerta si el monto
// del correo no cuadra con el del comprobante. Se usa en el panel de acción y en el de
// historial. La confianza de la IA (score_confianza) llega en el modelo pero no se
// muestra: por ahora no es relevante para el analista.

import { Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CopyButtonComponent } from '../../shared/components/copy-button.component';
import {
  PagoPac,
  formatoFecha,
  formatoMonto,
  montoDescuadrado,
} from './recaudos-pac.api';

@Component({
  selector: 'alma-datos-extraidos',
  imports: [LucideAngularModule, CopyButtonComponent],
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <lucide-icon name="scan-text" [size]="16" class="text-muted-foreground" />
        <span class="text-[13px] font-semibold text-foreground">Datos extraídos del correo</span>
      </div>

      <p class="rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-[13px] text-foreground">
        <span class="text-muted-foreground">Asunto:</span> {{ pago().extraido.asunto_correo }}
      </p>

      @if (descuadre()) {
        <div class="flex items-start gap-2 rounded-lg border-l-4 border-red-500 bg-red-500/10 px-3 py-2.5">
          <lucide-icon name="alert-triangle" [size]="16" class="mt-px shrink-0 text-red-600 dark:text-red-400" />
          <p class="text-[13px] leading-relaxed text-foreground">
            El monto del correo ({{ monto(pago().monto) }}) no coincide con el del comprobante
            ({{ monto(pago().extraido.monto_comprobante!) }}). Revísalo antes de acreditar.
          </p>
        </div>
      }

      <!-- Una columna en celular: las cuentas de 15 dígitos no caben en media fila. -->
      <dl class="grid grid-cols-1 gap-x-4 gap-y-2.5 min-[420px]:grid-cols-2">
        @for (c of campos(); track c.etiqueta) {
          <div class="min-w-0">
            <dt class="text-[11px] font-medium text-muted-foreground">{{ c.etiqueta }}</dt>
            <dd class="flex items-center gap-1 text-[13px] text-foreground">
              @if (c.valor) {
                <span class="truncate" [class.tabular-nums]="c.numero">{{ c.valor }}</span>
                @if (c.copiable) {
                  <alma-copy-button [value]="c.valor" [label]="c.etiqueta.toLowerCase()" />
                }
              } @else {
                <span class="text-muted-foreground/70">—</span>
              }
            </dd>
          </div>
        }
      </dl>
    </div>
  `,
})
export class DatosExtraidosComponent {
  readonly pago = input.required<PagoPac>();

  protected readonly monto = formatoMonto;
  protected readonly descuadre = computed(() => montoDescuadrado(this.pago()));

  protected readonly campos = computed(() => {
    const e = this.pago().extraido;
    return [
      { etiqueta: 'Documento afiliado', valor: e.afiliado_documento, copiable: true, numero: true },
      { etiqueta: 'Contrato', valor: e.afiliado_contrato, copiable: true, numero: true },
      { etiqueta: 'Banco', valor: e.banco, copiable: false, numero: false },
      {
        etiqueta: 'Monto comprobante',
        valor: e.monto_comprobante === null ? null : formatoMonto(e.monto_comprobante),
        copiable: false,
        numero: true,
      },
      { etiqueta: 'Cuenta origen', valor: e.cuenta_origen, copiable: true, numero: true },
      { etiqueta: 'Cuenta destino Skandia', valor: e.cuenta_destino_skandia, copiable: true, numero: true },
      { etiqueta: 'NIT fondo', valor: e.nit_fondo, copiable: true, numero: true },
      { etiqueta: 'Fecha carta', valor: e.fecha_carta && formatoFecha(e.fecha_carta), copiable: false, numero: false },
      { etiqueta: 'Solicitud de traslado', valor: e.numero_solicitud_traslado, copiable: true, numero: true },
    ];
  });
}
