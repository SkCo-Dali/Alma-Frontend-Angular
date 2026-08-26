// Pestaña "Filtros de Fecha": presets (hoy, esta semana, este mes, trimestre, año…) +
// autofiltro personalizado. Las columnas de Suscripción son fechas PURAS: los rangos se
// emiten date-only.

import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent, SkDropdownComponent } from '@skandia/ui';
import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  etiquetaFecha,
  parseYmd,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  ymd,
} from './date-utils';

interface DatePreset {
  id: string;
  label: string;
  getRange: () => { start: Date; end: Date };
  separator?: boolean;
}

const hoy = () => new Date();

const DATE_PRESETS: DatePreset[] = [
  { id: 'today', label: 'Hoy', getRange: () => ({ start: hoy(), end: hoy() }) },
  {
    id: 'yesterday',
    label: 'Ayer',
    getRange: () => {
      const d = addDays(hoy(), -1);
      return { start: d, end: d };
    },
  },
  {
    id: 'tomorrow',
    label: 'Mañana',
    getRange: () => {
      const d = addDays(hoy(), 1);
      return { start: d, end: d };
    },
    separator: true,
  },
  {
    id: 'this-week',
    label: 'Esta semana',
    getRange: () => ({ start: startOfWeek(hoy()), end: endOfWeek(hoy()) }),
  },
  {
    id: 'last-week',
    label: 'Semana pasada',
    getRange: () => {
      const d = addDays(hoy(), -7);
      return { start: startOfWeek(d), end: endOfWeek(d) };
    },
  },
  {
    id: 'next-week',
    label: 'Próxima semana',
    getRange: () => {
      const d = addDays(hoy(), 7);
      return { start: startOfWeek(d), end: endOfWeek(d) };
    },
    separator: true,
  },
  {
    id: 'this-month',
    label: 'Este mes',
    getRange: () => ({ start: startOfMonth(hoy()), end: endOfMonth(hoy()) }),
  },
  {
    id: 'last-month',
    label: 'Mes pasado',
    getRange: () => {
      const d = addMonths(hoy(), -1);
      return { start: startOfMonth(d), end: endOfMonth(d) };
    },
  },
  {
    id: 'next-month',
    label: 'Próximo mes',
    getRange: () => {
      const d = addMonths(hoy(), 1);
      return { start: startOfMonth(d), end: endOfMonth(d) };
    },
    separator: true,
  },
  {
    id: 'this-quarter',
    label: 'Este trimestre',
    getRange: () => ({ start: startOfQuarter(hoy()), end: endOfQuarter(hoy()) }),
  },
  {
    id: 'last-quarter',
    label: 'Trimestre pasado',
    getRange: () => {
      const d = addMonths(hoy(), -3);
      return { start: startOfQuarter(d), end: endOfQuarter(d) };
    },
  },
  {
    id: 'next-quarter',
    label: 'Próximo trimestre',
    getRange: () => {
      const d = addMonths(hoy(), 3);
      return { start: startOfQuarter(d), end: endOfQuarter(d) };
    },
    separator: true,
  },
  {
    id: 'this-year',
    label: 'Este año',
    getRange: () => ({ start: startOfYear(hoy()), end: endOfYear(hoy()) }),
  },
  {
    id: 'last-year',
    label: 'Año pasado',
    getRange: () => {
      const d = addYears(hoy(), -1);
      return { start: startOfYear(d), end: endOfYear(d) };
    },
  },
  {
    id: 'next-year',
    label: 'Próximo año',
    getRange: () => {
      const d = addYears(hoy(), 1);
      return { start: startOfYear(d), end: endOfYear(d) };
    },
  },
];

type DateOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

const OPERATOR_OPTIONS: { value: DateOp; label: string }[] = [
  { value: 'eq', label: 'es igual a' },
  { value: 'neq', label: 'no es igual a' },
  { value: 'gt', label: 'es posterior a' },
  { value: 'gte', label: 'es posterior o igual a' },
  { value: 'lt', label: 'es anterior a' },
  { value: 'lte', label: 'es anterior o igual a' },
];

@Component({
  selector: 'alma-date-filter-tab',
  imports: [FormsModule, LucideAngularModule, SkButtonComponent, SkDropdownComponent],
  template: `
    <div class="space-y-0.5">
      @for (preset of presets; track preset.id) {
        @if (preset.separator) {
          <div class="my-1 border-t border-border/60"></div>
        }
        <button
          type="button"
          (click)="clickPreset($event, preset)"
          class="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent"
        >
          {{ preset.label }}
          <lucide-icon name="chevron-right" [size]="12" class="text-muted-foreground" />
        </button>
      }

      <div class="my-1 border-t border-border/60"></div>
      <button
        type="button"
        (click)="$event.stopPropagation(); dialogoAbierto.set(true)"
        class="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs font-medium text-foreground hover:bg-accent"
      >
        <lucide-icon name="sliders-horizontal" [size]="12" />
        Filtro personalizado…
      </button>
    </div>

    @if (dialogoAbierto()) {
      <div
        class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
        (click)="dialogoAbierto.set(false)"
      >
        <div
          class="surface-solid w-full max-w-md rounded-xl border border-border p-5 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <h3 class="text-sm font-medium">Autofiltro personalizado</h3>

          <div class="space-y-4 py-3">
            <p class="text-xs text-muted-foreground">Mostrar las filas en las cuales:</p>

            <div class="flex items-center gap-2">
              <sk-dropdown
                class="w-[180px]"
                [options]="operadores"
                optionLabel="label"
                optionValue="value"
                [(ngModel)]="op1"
              />
              <sk-dropdown
                class="flex-1"
                placeholder="Seleccionar fecha..."
                [options]="fechaOpciones()"
                optionLabel="label"
                optionValue="value"
                [(ngModel)]="val1"
              />
            </div>

            <div class="flex items-center gap-4">
              <label class="flex items-center gap-1.5 text-xs font-medium">
                <input type="radio" name="logic-date" value="and" [(ngModel)]="logic" /> Y
              </label>
              <label class="flex items-center gap-1.5 text-xs font-medium">
                <input type="radio" name="logic-date" value="or" [(ngModel)]="logic" /> O
              </label>
            </div>

            <div class="flex items-center gap-2">
              <sk-dropdown
                class="w-[180px]"
                [options]="operadores"
                optionLabel="label"
                optionValue="value"
                [(ngModel)]="op2"
              />
              <sk-dropdown
                class="flex-1"
                placeholder="Seleccionar fecha..."
                [options]="fechaOpciones()"
                optionLabel="label"
                optionValue="value"
                [(ngModel)]="val2"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <sk-button
              variant="secondary"
              type="button"
              label="Cancelar"
              (clicked)="dialogoAbierto.set(false)"
            />
            <sk-button
              variant="primary"
              type="button"
              label="Aceptar"
              [disabled]="!val1 && !val2"
              (clicked)="aceptarPersonalizado()"
            />
          </div>
        </div>
      </div>
    }
  `,
})
export class DateFilterTabComponent {
  /** Fechas disponibles (YYYY-MM-DD) desde el API de distincts. */
  readonly availableDates = input.required<string[]>();
  readonly applied = output<{ from?: string; to?: string }>();
  readonly closed = output<void>();

  protected readonly presets = DATE_PRESETS;
  protected readonly operadores = OPERATOR_OPTIONS;
  protected readonly etiqueta = etiquetaFecha;
  protected readonly dialogoAbierto = signal(false);

  protected op1: DateOp = 'gte';
  protected val1 = '';
  protected logic: 'and' | 'or' = 'and';
  protected op2: DateOp = 'lte';
  protected val2 = '';

  protected readonly fechasOrdenadas = computed(() =>
    [...this.availableDates()].sort((a, b) => a.localeCompare(b)),
  );

  /** Opciones {label, value} para el sk-dropdown de selección de fecha. */
  protected readonly fechaOpciones = computed(() =>
    this.fechasOrdenadas().map((d) => ({ label: this.etiqueta(d), value: d })),
  );

  protected clickPreset(ev: MouseEvent, preset: DatePreset): void {
    ev.stopPropagation();
    const { start, end } = preset.getRange();
    this.applied.emit({ from: ymd(start), to: ymd(end) });
    this.closed.emit();
  }

  /** Rango de una condición sobre fechas PURAS: gt/lt mueven el borde un día. */
  private rangoDe(op: DateOp, dateStr: string): { from?: string; to?: string } {
    const d = parseYmd(dateStr);
    switch (op) {
      case 'eq':
      case 'neq': // aproximación del original: neq se trata como eq en el rango
        return { from: dateStr, to: dateStr };
      case 'gt':
        return { from: ymd(addDays(d, 1)), to: undefined };
      case 'gte':
        return { from: dateStr, to: undefined };
      case 'lt':
        return { from: undefined, to: ymd(addDays(d, -1)) };
      case 'lte':
        return { from: undefined, to: dateStr };
    }
  }

  protected aceptarPersonalizado(): void {
    if (!this.val1 && !this.val2) return;

    if (this.val1 && !this.val2) {
      this.applied.emit(this.rangoDe(this.op1, this.val1));
    } else if (!this.val1 && this.val2) {
      this.applied.emit(this.rangoDe(this.op2, this.val2));
    } else {
      const r1 = this.rangoDe(this.op1, this.val1);
      const r2 = this.rangoDe(this.op2, this.val2);
      if (this.logic === 'and') {
        // Intersección: bordes más restrictivos.
        const from =
          r1.from && r2.from ? (r1.from > r2.from ? r1.from : r2.from) : r1.from || r2.from;
        const to = r1.to && r2.to ? (r1.to < r2.to ? r1.to : r2.to) : r1.to || r2.to;
        this.applied.emit({ from, to });
      } else {
        // Unión: bordes más amplios.
        const from =
          r1.from && r2.from ? (r1.from < r2.from ? r1.from : r2.from) : undefined;
        const to = r1.to && r2.to ? (r1.to > r2.to ? r1.to : r2.to) : undefined;
        this.applied.emit({ from, to });
      }
    }

    this.dialogoAbierto.set(false);
    this.closed.emit();
  }
}
