// Barra de la tabla en Métricas y Reportes: buscador (se aplica al pulsar
// Buscar o Enter), filtro de mes, tamaño de página, descarga de Excel y el
// resumen de periodo y total. Paridad InfoGerencialTableToolbar.tsx.

import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FilterOption, PAGE_SIZE_OPTIONS } from './info-gerencial.api';

@Component({
  selector: 'alma-ig-table-toolbar',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="space-y-3 border-b border-border/30 bg-card p-3">
      <div class="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
        <div class="flex items-center gap-2 lg:max-w-[360px]">
          <input
            class="alma-input h-10 w-full rounded-full"
            placeholder="Buscar"
            [ngModel]="search()"
            (ngModelChange)="searchChange.emit($event)"
            (keydown.enter)="buscar.emit()"
          />
          <button
            type="button"
            (click)="buscar.emit()"
            [disabled]="buscando()"
            class="alma-btn alma-btn-outline h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium"
          >
            @if (buscando()) {
              <lucide-icon name="loader-2" [size]="16" class="mr-2 animate-spin" />
            } @else {
              <lucide-icon name="search" [size]="16" class="mr-2" />
            }
            Buscar
          </button>
        </div>

        <div class="flex-1"></div>

        <div class="flex items-center gap-2">
          @if (monthOptions().length > 0) {
            <select
              class="alma-input h-10 min-w-[180px] max-w-[220px]"
              [disabled]="!monthFilter()"
              [ngModel]="monthFilter() ?? ''"
              (ngModelChange)="monthChange.emit($event)"
            >
              <option value="">Filtrar por mes</option>
              @for (o of monthOptions(); track o.value) {
                <option [value]="o.value">{{ o.label }}</option>
              }
            </select>
          }
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
            class="alma-btn h-10 shrink-0 whitespace-nowrap rounded-lg border border-primary px-4 text-sm font-medium text-primary hover:bg-primary hover:text-white disabled:opacity-50"
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

  protected readonly tamanos = PAGE_SIZE_OPTIONS;
}
