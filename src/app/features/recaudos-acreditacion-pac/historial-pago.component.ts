// Línea de tiempo del historial de un pago: eventos automáticos del sistema y
// acciones manuales del analista, con copia del correo cuando se envió uno.
// Se usa tanto en el panel de acción como en el de historial.

import { Component, input } from '@angular/core';
import { EventoPago, TONO_COLOR, formatoFechaHora } from './recaudos-pac.api';

@Component({
  selector: 'alma-historial-pago',
  template: `
    <h4 class="mb-3 text-sm font-semibold text-foreground">Historial</h4>
    <ol class="flex flex-col">
      @for (ev of historial(); track $index; let ultimo = $last) {
        <li class="flex gap-3">
          <div class="flex flex-col items-center">
            <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" [style.background]="tonoColor[ev.tono]"></span>
            @if (!ultimo) {
              <span class="mt-1 w-px flex-1 bg-border"></span>
            }
          </div>
          <div class="min-w-0 flex-1 pb-4">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[13px] font-semibold text-foreground">{{ ev.accion }}</span>
              <span
                class="rounded px-1.5 py-px text-[11px]"
                [class]="
                  ev.tipo === 'automatico'
                    ? 'rounded px-1.5 py-px text-[11px] bg-sky-500/10 text-sky-700 dark:text-sky-300'
                    : 'rounded px-1.5 py-px text-[11px] bg-muted text-muted-foreground'
                "
              >
                {{ ev.tipo === 'automatico' ? 'Automático' : 'Manual' }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground">{{ fecha(ev.fecha) }} · {{ ev.usuario }}</p>
            @if (ev.correo_enviado) {
              <div class="mt-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
                <p class="mb-1 text-[11px] font-semibold text-muted-foreground">Correo enviado</p>
                <p class="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{{ ev.correo_enviado }}</p>
              </div>
            }
          </div>
        </li>
      }
    </ol>
  `,
})
export class HistorialPagoComponent {
  readonly historial = input.required<EventoPago[]>();

  protected readonly tonoColor = TONO_COLOR;
  protected readonly fecha = formatoFechaHora;
}
