// Paginación compartida de los grids: selector de tamaño de página, rango mostrado y
// números con elipsis.

import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SkDropdownComponent, SkPaginatorComponent } from '@skandia/ui';

@Component({
  selector: 'alma-grid-pagination',
  imports: [FormsModule, SkDropdownComponent, SkPaginatorComponent],
  template: `
    <div
      class="flex flex-col items-center justify-between gap-4 border-t bg-card px-4 py-3 sm:flex-row"
    >
      <div class="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
        <div
          class="flex w-full items-center justify-center gap-2 border-b pb-2 sm:w-auto sm:justify-start sm:border-none sm:pb-0"
        >
          <span class="text-xs font-medium text-muted-foreground sm:text-sm">Mostrar:</span>
          <sk-dropdown
            class="w-16 sm:w-20"
            [options]="sizeOptions()"
            [ngModel]="selectedSize()"
            (valueChange)="onSizeChange($event)"
          />
        </div>

        <span
          class="w-full text-center text-xs font-medium text-muted-foreground sm:text-left sm:text-sm"
        >
          Mostrando <span class="font-bold text-foreground">{{ desde() }}</span> -
          <span class="font-bold text-foreground">{{ hasta() }}</span> de
          <span class="font-bold text-foreground">{{ total() }}</span>
        </span>
      </div>

      @if (totalPages() > 1) {
        <sk-paginator
          [first]="(currentPage() - 1) * itemsPerPage()"
          [rows]="itemsPerPage()"
          [totalRecords]="total()"
          [rowsPerPageOptions]="[]"
          [showFirstLastIcon]="false"
          [showCurrentPageReport]="false"
          (pageChange)="onSkPageChange($any($event))"
        />
      }
    </div>
  `,
})
export class GridPaginationComponent {
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();
  readonly itemsPerPage = input.required<number>();
  readonly pageSizeOptions = input<readonly number[]>([10, 25, 50, 100]);

  readonly pageChange = output<number>();
  readonly itemsPerPageChange = output<number>();

  protected readonly sizeOptions = computed(() =>
    this.pageSizeOptions().map((size) => ({ label: String(size), value: String(size) })),
  );
  protected readonly selectedSize = computed(() => String(this.itemsPerPage()));

  protected onSizeChange(value: unknown): void {
    this.itemsPerPageChange.emit(Number(value));
  }

  protected readonly desde = computed(
    () => (this.currentPage() - 1) * this.itemsPerPage() + 1,
  );
  protected readonly hasta = computed(() =>
    Math.min(this.currentPage() * this.itemsPerPage(), this.total()),
  );

  protected onSkPageChange(state: { page?: number }): void {
    this.pageChange.emit((state.page ?? 0) + 1);
  }
}
