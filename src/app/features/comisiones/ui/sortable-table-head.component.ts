// Encabezado ordenable de las tablas de comisiones: etiqueta + par de chevrons
// que marcan la dirección activa. Paridad SortableTableHead.tsx.

import { Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export type SortDirection = 'asc' | 'desc' | null;

@Component({
  selector: 'alma-sortable-th',
  imports: [LucideAngularModule],
  template: `
    <div class="group flex items-center justify-center gap-0.5 transition-all">
      <button
        type="button"
        (click)="sorted.emit(sortKey())"
        class="flex h-8 items-center gap-1.5 rounded-md px-2 transition-all hover:bg-primary/10 hover:text-primary"
        [class.text-primary]="activo()"
        [class.font-bold]="activo()"
        [class.bg-primary/5]="activo()"
      >
        <span class="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider">
          {{ label() }}
        </span>
        <span class="flex flex-col -space-y-1.5 opacity-60 transition-opacity group-hover:opacity-100">
          <lucide-icon
            name="chevron-up"
            [size]="12"
            [class]="
              activo() && direction() === 'asc' ? 'text-primary' : 'text-muted-foreground/30'
            "
          />
          <lucide-icon
            name="chevron-down"
            [size]="12"
            [class]="
              activo() && direction() === 'desc' ? 'text-primary' : 'text-muted-foreground/30'
            "
          />
        </span>
      </button>
      <ng-content />
    </div>
  `,
})
export class SortableTableHeadComponent {
  readonly label = input.required<string>();
  readonly sortKey = input.required<string>();
  readonly currentSortKey = input<string | null>(null);
  readonly direction = input<SortDirection>(null);
  readonly sorted = output<string>();

  protected readonly activo = computed(() => this.currentSortKey() === this.sortKey());
}
