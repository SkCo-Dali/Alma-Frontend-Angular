// Historial de cambios de la configuración del motor (auditoría del PUT): quién cambió
// qué, cuándo y por qué.

import { Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LogItem } from './motor-config.api';

/** Formatea un ISO a dd/mm/aaaa HH:mm (hora local). */
export function fmtFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

@Component({
  selector: 'alma-historial-cambios',
  imports: [LucideAngularModule],
  template: `
    <div class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
      <div class="mb-3 flex items-center gap-2">
        <lucide-icon name="history" [size]="14" class="text-muted-foreground" />
        <p
          class="text-[10px] font-semibold uppercase tracking-wider text-foreground/65"
        >
          Historial de cambios
        </p>
      </div>

      @if (cargando()) {
        <p class="flex items-center gap-2 text-xs text-muted-foreground">
          <lucide-icon name="refresh-cw" [size]="14" class="animate-spin" /> Cargando
          historial…
        </p>
      } @else if (error()) {
        <p class="text-xs text-muted-foreground">No fue posible cargar el historial.</p>
      } @else if (log().length === 0) {
        <p class="text-xs text-muted-foreground">
          Sin cambios registrados. La configuración vigente es la del despliegue inicial.
        </p>
      } @else {
        <div class="overflow-x-auto">
          <table class="alma-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Ámbito</th>
                <th>Parámetro</th>
                <th>Antes</th>
                <th>Después</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              @for (item of log(); track $index) {
                <tr>
                  <td class="whitespace-nowrap text-xs text-muted-foreground">
                    {{ fecha(item.cambiado_en) }}
                  </td>
                  <td class="max-w-52 truncate text-xs" [title]="item.cambiado_por">
                    {{ item.cambiado_por }}
                  </td>
                  <td class="whitespace-nowrap text-xs">
                    {{ ambitoTitulo()(item.ambito) }}
                  </td>
                  <td class="whitespace-nowrap text-xs font-medium">
                    {{ etiquetaDe()(item.ambito, item.clave) }}
                  </td>
                  <td
                    class="max-w-56 truncate text-xs text-muted-foreground"
                    [title]="item.valor_anterior ?? ''"
                  >
                    {{ item.valor_anterior ?? '—' }}
                  </td>
                  <td class="max-w-56 truncate text-xs" [title]="item.valor_nuevo ?? ''">
                    {{ item.valor_nuevo ?? '—' }}
                  </td>
                  <td
                    class="max-w-64 truncate text-xs text-muted-foreground"
                    [title]="item.comentario ?? ''"
                  >
                    {{ item.comentario ?? '—' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class HistorialCambiosComponent {
  readonly log = input.required<LogItem[]>();
  readonly cargando = input(false);
  readonly error = input(false);
  /** Traduce el ámbito técnico (crea_patrimonio) a su título humano. */
  readonly ambitoTitulo = input.required<(ambito: string) => string>();
  /** Traduce la clave técnica (suma_max) a su etiqueta humana. */
  readonly etiquetaDe = input.required<(ambito: string, clave: string) => string>();

  protected readonly fecha = fmtFechaHora;
}
