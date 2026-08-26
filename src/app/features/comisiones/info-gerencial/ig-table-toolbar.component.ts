// Barra de la tabla en Métricas y Reportes: buscador (se aplica al pulsar Buscar o
// Enter), filtro de mes, tamaño de página, descarga de Excel y el resumen de periodo y
// total.

import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent, SkDropdownComponent, SkInputComponent } from '@skandia/ui';
import { FilterOption, PAGE_SIZE_OPTIONS } from './info-gerencial.api';

@Component({
  selector: 'alma-ig-table-toolbar',
  imports: [FormsModule, LucideAngularModule, SkButtonComponent, SkDropdownComponent, SkInputComponent],
  template: `
    <div class="space-y-3 border-b border-border/30 bg-card p-3">
      <div class="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
        <div class="flex items-center gap-2 lg:max-w-[360px]">
          <sk-input
            placeholder="Buscar"
            fluid
            [ngModel]="search()"
            (ngModelChange)="searchChange.emit($event)"
            (keydown.enter)="buscar.emit()"
          />
          <sk-button
            type="button"
            variant="secondary"
            label="Buscar"
            class="h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium"
            [disabled]="buscando()"
            [loading]="buscando()"
            (clicked)="buscar.emit()"
          />
        </div>

        <div class="flex-1"></div>

        <div class="flex flex-wrap items-center gap-2">
          @if (monthOptions().length > 0) {
            <sk-dropdown
              label="Filtrar por mes"
              [options]="monthOptions()"
              class="min-w-[180px] max-w-[220px]"
              [disabled]="!monthFilter()"
              [ngModel]="monthFilter() ?? ''"
              (ngModelChange)="monthChange.emit($event)"
            />
          }
          <sk-dropdown
            [options]="tamanosOpciones"
            class="w-[80px] shrink-0"
            [ngModel]="itemsPerPageStr()"
            (ngModelChange)="itemsPerPageChange.emit(+$event)"
          />
          <sk-button
            type="button"
            variant="secondary"
            label="Descargar Excel"
            class="h-10 shrink-0 whitespace-nowrap rounded-lg px-4 text-sm font-medium"
            [disabled]="exportando()"
            [loading]="exportando()"
            (clicked)="exportar.emit()"
          />
        </div>
      </div>

      <div
        class="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex items-center gap-2 text-muted-foreground">
          <lucide-icon name="calendar-check" [size]="16" class="shrink-0 text-primary" />
          <span>
            Periodo seleccionado:
            <strong class="text-foreground">{{ periodoLabel() }}</strong>
          </span>
        </div>
        <div class="flex items-center gap-2 text-muted-foreground sm:justify-end">
          <lucide-icon name="coins" [size]="16" class="shrink-0 text-primary" />
          <span>
            Total comisiones:
            <strong class="text-foreground">{{ totalLabel() }}</strong>
          </span>
        </div>
      </div>
    </div>
  `,
})
export class IgTableToolbarComponent {
  readonly search = input.required<string>();
  readonly buscando = input(false);
  readonly monthFilter = input<string | undefined>(undefined);
  readonly monthOptions = input<FilterOption[]>([]);
  readonly itemsPerPage = input.required<number>();
  readonly periodoLabel = input.required<string>();
  readonly totalLabel = input.required<string>();
  readonly exportando = input(false);

  readonly searchChange = output<string>();
  readonly buscar = output<void>();
  readonly monthChange = output<string>();
  readonly itemsPerPageChange = output<number>();
  readonly exportar = output<void>();

  protected readonly tamanosOpciones = PAGE_SIZE_OPTIONS.map((s) => ({
    label: String(s),
    value: String(s),
  }));
  protected readonly itemsPerPageStr = computed(() => String(this.itemsPerPage()));
}
