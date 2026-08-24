// Pestaña "Filtros de Texto" reutilizable para popovers de columnas string. Presets
// rápidos estilo Excel + diálogo de autofiltro personalizado.

import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

export type TextFilterOp =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'isnull'
  | 'isnotnull';

export interface TextFilterCondition {
  op: TextFilterOp;
  value: string;
}

interface TextPreset {
  id: string;
  label: string;
  op: TextFilterOp;
  /** true → el preset aplica de inmediato sin pedir valor. */
  noValue?: boolean;
  separator?: boolean;
}

const TEXT_PRESETS: TextPreset[] = [
  { id: 'eq', label: 'Es igual a…', op: 'eq' },
  { id: 'ne', label: 'No es igual a…', op: 'ne' },
  { id: 'startsWith', label: 'Comienza por…', op: 'startsWith', separator: true },
  { id: 'endsWith', label: 'Termina con…', op: 'endsWith' },
  { id: 'contains', label: 'Contiene…', op: 'contains', separator: true },
  { id: 'isnull', label: 'Está vacío', op: 'isnull', noValue: true, separator: true },
  { id: 'isnotnull', label: 'No está vacío', op: 'isnotnull', noValue: true },
];

const OPERATOR_OPTIONS: { value: TextFilterOp; label: string }[] = [
  { value: 'eq', label: 'es igual a' },
  { value: 'ne', label: 'no es igual a' },
  { value: 'contains', label: 'contiene' },
  { value: 'startsWith', label: 'comienza por' },
  { value: 'endsWith', label: 'termina con' },
];

@Component({
  selector: 'alma-text-filter-tab',
  imports: [FormsModule, LucideAngularModule],
  template: `
    @if (presetPidiendoValor(); as preset) {
      <div class="space-y-3">
        <p class="text-xs text-muted-foreground">{{ preset.label.replace('…', '') }}:</p>
        <input
          #valorInput
          class="alma-input h-8 rounded-lg"
          placeholder="Escriba un valor..."
          [(ngModel)]="valorPreset"
          (keydown.enter)="aplicarPreset()"
          (keydown.escape)="cancelarPreset()"
          (click)="$event.stopPropagation()"
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="alma-btn alma-btn-outline h-8 rounded-lg text-xs"
            (click)="cancelarPreset()"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="alma-btn alma-btn-primary h-8 rounded-lg text-xs"
            [disabled]="!valorPreset.trim()"
            (click)="aplicarPreset()"
          >
            Aplicar
          </button>
        </div>
      </div>
    } @else {
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
            @if (!preset.noValue) {
              <lucide-icon name="chevron-right" [size]="12" class="text-muted-foreground" />
            }
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
    }

    <!-- Diálogo de autofiltro personalizado -->
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
              <select class="alma-input h-8 w-[180px] text-xs" [(ngModel)]="op1">
                @for (o of operadores; track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
              <input
                class="alma-input h-8 flex-1 rounded-lg text-xs"
                placeholder="Valor..."
                [(ngModel)]="val1"
              />
            </div>

            <div class="flex items-center gap-4">
              <label class="flex items-center gap-1.5 text-xs font-medium">
                <input type="radio" name="logic-text" value="and" [(ngModel)]="logic" /> Y
              </label>
              <label class="flex items-center gap-1.5 text-xs font-medium">
                <input type="radio" name="logic-text" value="or" [(ngModel)]="logic" /> O
              </label>
            </div>

            <div class="flex items-center gap-2">
              <select class="alma-input h-8 w-[180px] text-xs" [(ngModel)]="op2">
                @for (o of operadores; track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
              <input
                class="alma-input h-8 flex-1 rounded-lg text-xs"
                placeholder="Valor..."
                [(ngModel)]="val2"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="alma-btn alma-btn-outline h-8 rounded-lg text-xs"
              (click)="dialogoAbierto.set(false)"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="alma-btn alma-btn-primary h-8 rounded-lg text-xs"
              [disabled]="!val1.trim() && !val2.trim()"
              (click)="aceptarPersonalizado()"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TextFilterTabComponent {
  readonly applied = output<TextFilterCondition[]>();
  readonly closed = output<void>();

  protected readonly presets = TEXT_PRESETS;
  protected readonly operadores = OPERATOR_OPTIONS;

  protected readonly presetPidiendoValor = signal<TextPreset | null>(null);
  protected readonly dialogoAbierto = signal(false);
  protected valorPreset = '';

  protected op1: TextFilterOp = 'contains';
  protected val1 = '';
  protected logic: 'and' | 'or' = 'and';
  protected op2: TextFilterOp = 'contains';
  protected val2 = '';

  protected clickPreset(ev: MouseEvent, preset: TextPreset): void {
    ev.stopPropagation();
    if (preset.noValue) {
      this.applied.emit([{ op: preset.op, value: '' }]);
      this.closed.emit();
      return;
    }
    this.presetPidiendoValor.set(preset);
    this.valorPreset = '';
  }

  protected aplicarPreset(): void {
    const preset = this.presetPidiendoValor();
    if (!preset || !this.valorPreset.trim()) return;
    this.applied.emit([{ op: preset.op, value: this.valorPreset.trim() }]);
    this.presetPidiendoValor.set(null);
    this.valorPreset = '';
    this.closed.emit();
  }

  protected cancelarPreset(): void {
    this.presetPidiendoValor.set(null);
    this.valorPreset = '';
  }

  protected aceptarPersonalizado(): void {
    const conditions: TextFilterCondition[] = [];
    if (this.val1.trim()) conditions.push({ op: this.op1, value: this.val1.trim() });
    if (this.val2.trim()) conditions.push({ op: this.op2, value: this.val2.trim() });
    if (conditions.length === 0) return;
    this.applied.emit(conditions);
    this.dialogoAbierto.set(false);
    this.closed.emit();
  }
}
