// Filtro de fecha del visor, replicando el de Cotizaciones: pestaña "Específicas"
// (árbol año/mes/día con checkboxes) + "Filtros de Fecha" (presets + autofiltro
// personalizado, reutilizando alma-date-filter-tab). Cliente 100%: el árbol se
// arma con las fechas del índice (mock). Emite un rango {from,to} date-only.

import { Component, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaCheckboxComponent } from '../../shared/components/alma-checkbox.component';
import { DateFilterTabComponent } from '../suscripcion/grid/date-filter-tab.component';
import { nombreMes } from '../suscripcion/grid/date-utils';

interface DiaInfo {
  day: string;
  count: number;
  fullDate: string;
}
interface MesGrupo {
  mes: string;
  nombre: string;
  dias: DiaInfo[];
}
interface AnioGrupo {
  anio: string;
  meses: MesGrupo[];
}

@Component({
  selector: 'alma-date-filter-comunicaciones',
  imports: [LucideAngularModule, AlmaCheckboxComponent, DateFilterTabComponent],
  template: `
    <div (click)="$event.stopPropagation()">
      <div class="mb-3 flex">
        <div class="flex rounded-xl bg-muted p-1">
          <button
            type="button"
            (click)="tab.set('specific')"
            class="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
            [class]="tab() === 'specific' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
          >
            Específicas
          </button>
          <button
            type="button"
            (click)="tab.set('advanced')"
            class="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
            [class]="tab() === 'advanced' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
          >
            Filtros de Fecha
          </button>
        </div>
      </div>

      <div class="max-h-80 space-y-2 overflow-y-auto">
        @if (tab() === 'specific') {
          <div>
            <button
              type="button"
              (click)="arbolAbierto.set(!arbolAbierto())"
              class="flex w-full items-center gap-2 border-b border-border/60 p-2 text-left hover:bg-accent/50"
            >
              <lucide-icon
                name="chevron-down"
                [size]="16"
                [class.-rotate-90]="!arbolAbierto()"
                class="transition-transform"
              />
              <span class="text-sm font-medium text-foreground">Fechas Específicas</span>
            </button>

            @if (arbolAbierto()) {
              <div class="ml-2">
                @for (ga of agrupadas(); track ga.anio) {
                  <div>
                    <div class="flex w-full items-center gap-2 p-1 hover:bg-accent/50">
                      <alma-checkbox
                        [checked]="anioCompleto(ga)"
                        (checkedChange)="toggleAnio(ga, $event)"
                      />
                      <button
                        type="button"
                        (click)="toggleExpand(ga.anio)"
                        class="flex flex-1 items-center gap-2 text-left"
                      >
                        <lucide-icon
                          name="chevron-down"
                          [size]="12"
                          [class.-rotate-90]="!expandido(ga.anio)"
                          class="transition-transform"
                        />
                        <span class="text-xs text-foreground">{{ ga.anio }}</span>
                      </button>
                    </div>

                    @if (expandido(ga.anio)) {
                      <div class="ml-4">
                        @for (gm of ga.meses; track gm.mes) {
                          <div>
                            <div class="flex w-full items-center gap-2 p-1 hover:bg-accent/50">
                              <alma-checkbox
                                [checked]="mesCompleto(gm)"
                                (checkedChange)="toggleMes(gm, $event)"
                              />
                              <button
                                type="button"
                                (click)="toggleExpand(ga.anio + '-' + gm.mes)"
                                class="flex flex-1 items-center gap-2 text-left"
                              >
                                <lucide-icon
                                  name="chevron-down"
                                  [size]="12"
                                  [class.-rotate-90]="!expandido(ga.anio + '-' + gm.mes)"
                                  class="transition-transform"
                                />
                                <span class="text-xs capitalize text-muted-foreground">{{ gm.nombre }}</span>
                              </button>
                            </div>

                            @if (expandido(ga.anio + '-' + gm.mes)) {
                              <div class="ml-4">
                                @for (dia of gm.dias; track dia.fullDate) {
                                  <label class="flex items-center gap-2 p-1 hover:bg-accent/50">
                                    <alma-checkbox
                                      [checked]="seleccionadas().includes(dia.fullDate)"
                                      (checkedChange)="toggleDia(dia.fullDate, $event)"
                                    />
                                    <span class="flex-1 cursor-pointer select-none text-xs text-muted-foreground">
                                      {{ dia.day }}
                                      <span class="tabular-nums text-muted-foreground/70">({{ dia.count }})</span>
                                    </span>
                                  </label>
                                }
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                } @empty {
                  <div class="py-4 text-center text-sm text-muted-foreground">No hay fechas</div>
                }
              </div>
            }
          </div>
        } @else {
          <alma-date-filter-tab
            [availableDates]="fechasDisponibles()"
            (applied)="aplicarAvanzado($event)"
            (closed)="cerrar.emit()"
          />
        }
      </div>

      <div class="mt-3 flex justify-between border-t border-border/60 pt-3">
        <button
          type="button"
          class="alma-btn alma-btn-outline h-8 rounded-lg text-xs text-muted-foreground"
          (click)="limpiar()"
        >
          Limpiar
        </button>
        <div class="flex gap-2">
          <button
            type="button"
            class="alma-btn alma-btn-outline h-8 rounded-lg text-xs text-muted-foreground"
            (click)="cerrar.emit()"
          >
            Cancelar
          </button>
          <button type="button" class="alma-btn alma-btn-primary h-8 rounded-lg text-xs" (click)="aplicar()">
            Aplicar
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DateFilterComunicacionesComponent {
  /** Lista de fechas (YYYY-MM-DD o ISO) del índice; con duplicados para contar. */
  readonly fechas = input.required<string[]>();
  readonly aplicado = output<{ from: string | null; to: string | null }>();
  readonly cerrar = output<void>();

  protected readonly tab = signal<'specific' | 'advanced'>('specific');
  protected readonly seleccionadas = signal<string[]>([]);
  protected readonly arbolAbierto = signal(true);
  private readonly expandidos = signal<Set<string>>(new Set());

  protected readonly agrupadas = computed<AnioGrupo[]>(() => {
    const porAnio = new Map<string, Map<string, Map<string, DiaInfo>>>();
    for (const raw of this.fechas()) {
      const [y, m, d] = raw.slice(0, 10).split('-');
      if (!y || !m || !d) continue;
      const mes = m.padStart(2, '0');
      const dia = d.padStart(2, '0');
      const fullDate = `${y}-${mes}-${dia}`;
      if (!porAnio.has(y)) porAnio.set(y, new Map());
      const meses = porAnio.get(y)!;
      if (!meses.has(mes)) meses.set(mes, new Map());
      const dias = meses.get(mes)!;
      const ex = dias.get(fullDate);
      if (ex) ex.count += 1;
      else dias.set(fullDate, { day: dia, count: 1, fullDate });
    }
    return [...porAnio.entries()]
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .map(([anio, meses]) => ({
        anio,
        meses: [...meses.entries()]
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([mes, dias]) => ({
            mes,
            nombre: nombreMes(parseInt(mes)),
            dias: [...dias.values()].sort((a, b) => parseInt(a.day) - parseInt(b.day)),
          })),
      }));
  });

  protected readonly fechasDisponibles = computed(() =>
    this.agrupadas().flatMap((a) => a.meses.flatMap((m) => m.dias.map((d) => d.fullDate))),
  );

  protected expandido(clave: string): boolean {
    return this.expandidos().has(clave);
  }
  protected toggleExpand(clave: string): void {
    this.expandidos.update((prev) => {
      const next = new Set(prev);
      next.has(clave) ? next.delete(clave) : next.add(clave);
      return next;
    });
  }

  protected anioCompleto(g: AnioGrupo): boolean {
    const todas = g.meses.flatMap((m) => m.dias.map((d) => d.fullDate));
    const sel = this.seleccionadas();
    return todas.length > 0 && todas.every((d) => sel.includes(d));
  }
  protected mesCompleto(m: MesGrupo): boolean {
    const todas = m.dias.map((d) => d.fullDate);
    const sel = this.seleccionadas();
    return todas.length > 0 && todas.every((d) => sel.includes(d));
  }
  protected toggleAnio(g: AnioGrupo, checked: boolean): void {
    const todas = g.meses.flatMap((m) => m.dias.map((d) => d.fullDate));
    this.seleccionadas.update((prev) => {
      const resto = prev.filter((d) => !d.startsWith(`${g.anio}-`));
      return checked ? [...resto, ...todas] : resto;
    });
  }
  protected toggleMes(m: MesGrupo, checked: boolean): void {
    const todas = m.dias.map((d) => d.fullDate);
    const prefijo = todas[0]?.slice(0, 8) ?? '';
    this.seleccionadas.update((prev) => {
      const resto = prev.filter((d) => !d.startsWith(prefijo));
      return checked ? [...resto, ...todas] : resto;
    });
  }
  protected toggleDia(fecha: string, checked: boolean): void {
    this.seleccionadas.update((prev) => (checked ? [...prev, fecha] : prev.filter((d) => d !== fecha)));
  }

  protected limpiar(): void {
    this.seleccionadas.set([]);
    this.aplicado.emit({ from: null, to: null });
  }

  protected aplicarAvanzado(r: { from?: string; to?: string }): void {
    this.aplicado.emit({ from: r.from ?? null, to: r.to ?? null });
    this.cerrar.emit();
  }

  protected aplicar(): void {
    const sel = this.seleccionadas();
    if (sel.length > 0) {
      const ord = [...sel].sort();
      this.aplicado.emit({ from: ord[0], to: ord[ord.length - 1] });
    }
    this.cerrar.emit();
  }
}
