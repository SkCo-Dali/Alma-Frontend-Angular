// Barra de filtros de las tablas del motor. Dos variantes: comisiones (compañía +
// periodo) y correos (periodo + segmento + estado). La búsqueda se aplica al pulsar
// "Filtrar" o Enter, nunca al teclear.

import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent, SkDropdownComponent, SkInputComponent } from '@skandia/ui';
import {
  MOTOR_COMPANY_FILTER_OPTIONS,
  MOTOR_ESTADO_CORREO_OPTIONS,
  MOTOR_PAGE_SIZE_OPTIONS,
  formatMotorPeriodo,
  formatMotorSegmentoLabel,
} from './motor.api';

@Component({
  selector: 'alma-motor-table-toolbar',
  imports: [FormsModule, LucideAngularModule, SkButtonComponent, SkDropdownComponent, SkInputComponent],
  template: `
    <div class="space-y-3 border-b border-border/30 bg-card p-3 sm:p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <sk-input
          placeholder="Buscar"
          [ngModel]="search()"
          (ngModelChange)="searchChange.emit($event)"
          (keydown.enter)="filtrar.emit()"
          class="w-full md:max-w-[280px]"
          fluid
        />

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          @if (variant() === 'comisiones') {
            <sk-dropdown
              label="Compañías"
              [options]="companiaOptions"
              [ngModel]="compania()"
              (ngModelChange)="filtroChange.emit({ key: 'compania', value: $event })"
              class="w-full sm:w-[200px]"
              fluid
            />
          } @else {
            <sk-dropdown
              label="Segmento"
              [options]="segmentoOptions()"
              [ngModel]="segmento()"
              (ngModelChange)="filtroChange.emit({ key: 'segmento', value: $event })"
              class="w-full sm:w-[150px]"
              fluid
            />
            <sk-dropdown
              label="Estado"
              [options]="estadoOptions"
              [ngModel]="estado()"
              (ngModelChange)="filtroChange.emit({ key: 'estado', value: $event })"
              class="w-full sm:w-[140px]"
              fluid
            />
          }

          <sk-dropdown
            label="Periodos"
            [options]="periodoOptions()"
            [ngModel]="periodo()"
            (ngModelChange)="filtroChange.emit({ key: 'periodo', value: $event })"
            class="w-full sm:w-[160px]"
            fluid
          />
        </div>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <sk-button
            type="button"
            variant="primary"
            label="Filtrar"
            class="h-10 rounded-lg px-4 text-sm"
            [disabled]="cargando()"
            [loading]="cargando()"
            (clicked)="filtrar.emit()"
          />
          <sk-button
            type="button"
            variant="secondary"
            label="Limpiar"
            class="h-10 rounded-lg"
            [disabled]="cargando()"
            (clicked)="limpiar.emit()"
          />
        </div>

        <div class="flex items-center gap-2">
          <sk-dropdown
            label="Tamaño"
            [options]="tamanosOptions"
            [ngModel]="'' + itemsPerPage()"
            (ngModelChange)="itemsPerPageChange.emit(+$event)"
            class="w-[80px] shrink-0"
            fluid
          />
          <sk-button
            type="button"
            variant="secondary"
            label="Descargar Excel"
            class="h-10 whitespace-nowrap rounded-lg px-4 text-sm"
            [disabled]="exportando()"
            [loading]="exportando()"
            (clicked)="exportar.emit()"
          />
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

  protected readonly companiaOptions: { label: string; value: string }[] = [
    { label: 'Compañías', value: '' },
    ...this.companias,
  ];

  protected readonly estadoOptions: { label: string; value: string }[] = [
    { label: 'Estado', value: '' },
    ...this.estados.map((e) => ({ label: e, value: e })),
  ];

  protected readonly tamanosOptions: { label: string; value: string }[] = this.tamanos.map(
    (s) => ({ label: String(s), value: String(s) }),
  );

  protected etiquetaPeriodo(p: string): string {
    return formatMotorPeriodo(p);
  }

  protected etiquetaSegmento(s: string): string {
    return formatMotorSegmentoLabel(s);
  }

  protected segmentoOptions(): { label: string; value: string }[] {
    return [
      { label: 'Segmento', value: '' },
      ...this.roles().map((r) => ({ label: this.etiquetaSegmento(r), value: r })),
    ];
  }

  protected periodoOptions(): { label: string; value: string }[] {
    return [
      { label: 'Periodos', value: '' },
      ...this.periodos().map((p) => ({ label: this.etiquetaPeriodo(p), value: p })),
    ];
  }
}
