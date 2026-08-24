// Barra de filtros de las tablas del motor. Dos variantes: comisiones (compañía +
// periodo) y correos (periodo + segmento + estado). La búsqueda se aplica al pulsar
// "Filtrar" o Enter, nunca al teclear.

import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  MOTOR_COMPANY_FILTER_OPTIONS,
  MOTOR_ESTADO_CORREO_OPTIONS,
  MOTOR_PAGE_SIZE_OPTIONS,
  formatMotorPeriodo,
  formatMotorSegmentoLabel,
} from './motor.api';

@Component({
  selector: 'alma-motor-table-toolbar',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-3 border-b border-border/30 bg-card p-3 sm:p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          class="alma-input h-10 w-full rounded-full bg-card md:max-w-[280px]"
          placeholder="Buscar"
          [ngModel]="search()"
          (ngModelChange)="searchChange.emit($event)"
          (keydown.enter)="filtrar.emit()"
        />

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          @if (variant() === 'comisiones') {
            <select
              class="alma-input h-10 w-full sm:w-[200px]"
              [ngModel]="compania()"
              (ngModelChange)="filtroChange.emit({ key: 'compania', value: $event })"
            >
              <option value="">Compañías</option>
              @for (c of companias; track c.value) {
                <option [value]="c.value">{{ c.label }}</option>
              }
            </select>
          } @else {
            <select
              class="alma-input h-10 w-full sm:w-[150px]"
              [ngModel]="segmento()"
              (ngModelChange)="filtroChange.emit({ key: 'segmento', value: $event })"
            >
              <option value="">Segmento</option>
              @for (r of roles(); track r) {
                <option [value]="r">{{ etiquetaSegmento(r) }}</option>
              }
            </select>
            <select
              class="alma-input h-10 w-full sm:w-[140px]"
              [ngModel]="estado()"
              (ngModelChange)="filtroChange.emit({ key: 'estado', value: $event })"
            >
              <option value="">Estado</option>
              @for (e of estados; track e) {
                <option [value]="e">{{ e }}</option>
              }
            </select>
          }

          <select
            class="alma-input h-10 w-full sm:w-[160px]"
            [ngModel]="periodo()"
            (ngModelChange)="filtroChange.emit({ key: 'periodo', value: $event })"
          >
            <option value="">Periodos</option>
            @for (p of periodos(); track p) {
              <option [value]="p">{{ etiquetaPeriodo(p) }}</option>
            }
          </select>
        </div>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="filtrar.emit()"
            [disabled]="cargando()"
            class="alma-btn alma-btn-primary h-10 rounded-lg px-4 text-sm"
          >
            @if (cargando()) {
              <lucide-icon name="loader-2" [size]="16" class="mr-2 animate-spin" />
            }
            Filtrar
          </button>
          <button
            type="button"
            (click)="limpiar.emit()"
            [disabled]="cargando()"
            class="alma-btn alma-btn-outline h-10 rounded-lg"
          >
            Limpiar
          </button>
        </div>

        <div class="flex items-center gap-2">
          <select
            class="alma-input h-10 w-[80px] shrink-0"
            [ngModel]="itemsPerPage()"
            (ngModelChange)="itemsPerPageChange.emit(+$event)"
          >
            @for (s of tamanos; track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
          <button
            type="button"
            (click)="exportar.emit()"
            [disabled]="exportando()"
            class="alma-btn h-10 whitespace-nowrap rounded-lg border border-primary px-4 text-sm font-medium text-primary hover:bg-primary hover:text-white disabled:opacity-50"
          >
            @if (exportando()) {
              <lucide-icon name="loader-2" [size]="16" class="mr-2 animate-spin" />
            } @else {
              <lucide-icon name="download" [size]="16" class="mr-2" />
            }
            Descargar Excel
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MotorTableToolbarComponent {
  readonly variant = input.required<'comisiones' | 'correos'>();
  readonly search = input.required<string>();
  readonly periodos = input.required<string[]>();
  readonly periodo = input('');
  readonly compania = input('');
  readonly segmento = input('');
  readonly estado = input('');
  readonly roles = input<string[]>([]);
  readonly itemsPerPage = input.required<number>();
  readonly cargando = input(false);
  readonly exportando = input(false);

  readonly searchChange = output<string>();
  readonly filtroChange = output<{ key: string; value: string }>();
  readonly filtrar = output<void>();
  readonly limpiar = output<void>();
  readonly exportar = output<void>();
  readonly itemsPerPageChange = output<number>();

  protected readonly companias = MOTOR_COMPANY_FILTER_OPTIONS;
  protected readonly estados = MOTOR_ESTADO_CORREO_OPTIONS;
  protected readonly tamanos = MOTOR_PAGE_SIZE_OPTIONS;

  protected etiquetaPeriodo(p: string): string {
    return formatMotorPeriodo(p);
  }

  protected etiquetaSegmento(s: string): string {
    return formatMotorSegmentoLabel(s);
  }
}
