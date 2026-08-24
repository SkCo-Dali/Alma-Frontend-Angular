// Filtro de fechas para columnas 'date': árbol año/mes/día con checkboxes tri-nivel
// (pestaña "Específicas") + presets/autofiltro ("Filtros de Fecha"). Las fechas de
// Suscripción son PURAS (YYYY-MM-DD) — los rangos se emiten date-only, sin conversión de
// zona.

import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaCheckboxComponent } from '../../../shared/components/alma-checkbox.component';
import { DistinctStore } from './distinct.store';
import { DistinctBaseRequest, SuscripcionGridApi } from './suscripcion-grid.api';
import { DateFilterTabComponent } from './date-filter-tab.component';
import { nombreMes } from './date-utils';

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
  selector: 'alma-date-filter',
  imports: [LucideAngularModule, AlmaCheckboxComponent, DateFilterTabComponent],
  template: `
    <div (click)="$event.stopPropagation()">
      @if (store.loading()) {
        <div class="py-4 text-center text-sm text-muted-foreground">Cargando fechas...</div>
      } @else if (store.error(); as err) {
        <div class="py-4 text-center text-sm text-destructive">Error: {{ err }}</div>
      } @else {
        <div class="mb-3 flex">
          <div class="flex rounded-xl bg-muted p-1">
            <button
              type="button"
              (click)="$event.stopPropagation(); tab.set('specific')"
              class="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
              [class]="
                tab() === 'specific'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              "
            >
              Específicas
            </button>
            <button
              type="button"
              (click)="$event.stopPropagation(); tab.set('advanced')"
              class="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
              [class]="
                tab() === 'advanced'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              "
            >
              Filtros de Fecha
            </button>
          </div>
        </div>
      }

      <div class="max-h-80 space-y-2 overflow-y-auto">
        @if (!store.loading() && !store.error() && tab() === 'specific') {
          @if (vacios() > 0) {
            <label
              class="flex items-center gap-2 border-b border-border/60 p-2 hover:bg-accent/50"
            >
              <alma-checkbox
                [checked]="incluirVacios()"
                (checkedChange)="incluirVacios.set($event)"
                ariaLabel="Incluir registros sin fecha"
              />
              <span
                class="flex flex-1 cursor-pointer select-none items-center justify-between text-sm"
              >
                <span class="italic text-muted-foreground">(Sin fecha)</span>
                <span class="ml-2 text-xs tabular-nums text-muted-foreground">
                  ({{ vacios().toLocaleString('es-CO') }})
                </span>
              </span>
            </label>
          }

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
                @for (grupoAnio of agrupadas(); track grupoAnio.anio) {
                  <div>
                    <div class="flex w-full items-center gap-2 p-1 hover:bg-accent/50">
                      <alma-checkbox
                        [checked]="anioCompleto(grupoAnio)"
                        (checkedChange)="toggleAnio(grupoAnio, $event)"
                      />
                      <button
                        type="button"
                        (click)="toggleExpand(grupoAnio.anio)"
                        class="flex flex-1 items-center gap-2 text-left"
                      >
                        <lucide-icon
                          name="chevron-down"
                          [size]="12"
                          [class.-rotate-90]="!expandido(grupoAnio.anio)"
                          class="transition-transform"
                        />
                        <span class="text-xs text-foreground">{{ grupoAnio.anio }}</span>
                      </button>
                    </div>

                    @if (expandido(grupoAnio.anio)) {
                      <div class="ml-4">
                        @for (grupoMes of grupoAnio.meses; track grupoMes.mes) {
                          <div>
                            <div class="flex w-full items-center gap-2 p-1 hover:bg-accent/50">
                              <alma-checkbox
                                [checked]="mesCompleto(grupoMes)"
                                (checkedChange)="toggleMes(grupoMes, $event)"
                              />
                              <button
                                type="button"
                                (click)="toggleExpand(grupoAnio.anio + '-' + grupoMes.mes)"
                                class="flex flex-1 items-center gap-2 text-left"
                              >
                                <lucide-icon
                                  name="chevron-down"
                                  [size]="12"
                                  [class.-rotate-90]="
                                    !expandido(grupoAnio.anio + '-' + grupoMes.mes)
                                  "
                                  class="transition-transform"
                                />
                                <span class="text-xs capitalize text-muted-foreground">
                                  {{ grupoMes.nombre }}
                                </span>
                              </button>
                            </div>

                            @if (expandido(grupoAnio.anio + '-' + grupoMes.mes)) {
                              <div class="ml-4">
                                @for (dia of grupoMes.dias; track dia.fullDate) {
                                  <label
                                    class="flex items-center gap-2 p-1 hover:bg-accent/50"
                                  >
                                    <alma-checkbox
                                      [checked]="seleccionadas().includes(dia.fullDate)"
                                      (checkedChange)="toggleDia(dia.fullDate, $event)"
                                    />
                                    <span
                                      class="flex-1 cursor-pointer select-none text-xs text-muted-foreground"
                                    >
                                      {{ dia.day }}
                                      <span class="tabular-nums text-muted-foreground/70">
                                        ({{ dia.count }})
                                      </span>
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
                  <div class="py-4 text-center text-sm text-muted-foreground">
                    No se encontraron fechas
                  </div>
                }
              </div>
            }
          </div>
        }

        @if (!store.loading() && !store.error() && tab() === 'advanced') {
          <alma-date-filter-tab
            [availableDates]="fechasDisponibles()"
            (applied)="aplicarAvanzado($event)"
            (closed)="requestClose.emit()"
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
            (click)="cancelar()"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="alma-btn alma-btn-primary h-8 rounded-lg text-xs"
            (click)="aplicar()"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DateFilterComponent implements OnInit, OnDestroy {
  private readonly api = inject(SuscripcionGridApi);

  readonly field = input.required<string>();
  readonly buildRequest = input.required<() => DistinctBaseRequest>();
  /** from/to en formato YYYY-MM-DD; from='__NULL__' filtra vacíos. */
  readonly dateChange = output<{ field: string; from?: string; to?: string }>();
  readonly requestClose = output<void>();

  protected store!: DistinctStore;
  protected readonly tab = signal<'specific' | 'advanced'>('specific');
  protected readonly seleccionadas = signal<string[]>([]);
  protected readonly arbolAbierto = signal(true);
  protected readonly incluirVacios = signal(false);
  private readonly expandidos = signal<Set<string>>(new Set());

  /** Conteo de registros sin fecha (valor null en los distincts). */
  protected readonly vacios = computed(() =>
    this.store
      .values()
      .filter((i) => i.value === null || i.value === undefined)
      .reduce((acc, i) => acc + i.count, 0),
  );

  /** Árbol año → mes → días, ordenado (años desc, meses y días asc). */
  protected readonly agrupadas = computed<AnioGrupo[]>(() => {
    const porAnio = new Map<string, Map<string, Map<string, DiaInfo>>>();
    for (const item of this.store.values()) {
      if (item.value === null || item.value === undefined) continue;
      const str = String(item.value);
      const datePart = str.length > 10 ? str.substring(0, 10) : str;
      const [y, m, d] = datePart.split('-');
      if (!y || !m || !d) continue;
      const anio = y;
      const mes = m.padStart(2, '0');
      const dia = d.padStart(2, '0');
      const fullDate = `${anio}-${mes}-${dia}`;
      if (!porAnio.has(anio)) porAnio.set(anio, new Map());
      const meses = porAnio.get(anio)!;
      if (!meses.has(mes)) meses.set(mes, new Map());
      const dias = meses.get(mes)!;
      const existente = dias.get(fullDate);
      if (existente) existente.count += item.count;
      else dias.set(fullDate, { day: dia, count: item.count, fullDate });
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

  ngOnInit(): void {
    this.store = new DistinctStore(this.api, this.field(), this.buildRequest());
    // LAZY: solo existe con el popover abierto.
    this.store.initialize();
  }

  ngOnDestroy(): void {
    this.store?.destroy();
  }

  protected expandido(clave: string): boolean {
    return this.expandidos().has(clave);
  }

  protected toggleExpand(clave: string): void {
    this.expandidos.update((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
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
    this.seleccionadas.update((prev) =>
      checked ? [...prev, fecha] : prev.filter((d) => d !== fecha),
    );
  }

  protected limpiar(): void {
    this.seleccionadas.set([]);
    this.incluirVacios.set(false);
    this.dateChange.emit({ field: this.field(), from: undefined, to: undefined });
  }

  protected cancelar(): void {
    this.seleccionadas.set([]);
    this.incluirVacios.set(false);
    this.requestClose.emit();
  }

  protected aplicarAvanzado(r: { from?: string; to?: string }): void {
    this.dateChange.emit({ field: this.field(), from: r.from, to: r.to });
  }

  protected aplicar(): void {
    if (this.tab() === 'specific') {
      const sel = this.seleccionadas();
      if (this.incluirVacios() && sel.length === 0) {
        this.dateChange.emit({ field: this.field(), from: '__NULL__', to: undefined });
      } else if (sel.length > 0) {
        const ordenadas = [...sel].sort();
        // Fechas puras: el rango va date-only (sin hora).
        this.dateChange.emit({
          field: this.field(),
          from: ordenadas[0],
          to: ordenadas[ordenadas.length - 1],
        });
      }
    }
    this.requestClose.emit();
  }
}
