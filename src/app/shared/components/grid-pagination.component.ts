// Paginación compartida de los grids (paridad CommissionsPagination.tsx):
// selector de tamaño de página, rango mostrado y números con elipsis.

import { Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-grid-pagination',
  imports: [LucideAngularModule],
  template: `
    <div
      class="flex flex-col items-center justify-between gap-4 border-t bg-card px-4 py-3 sm:flex-row"
    >
      <div class="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
        <div
          class="flex w-full items-center justify-center gap-2 border-b pb-2 sm:w-auto sm:justify-start sm:border-none sm:pb-0"
        >
          <span class="text-xs font-medium text-muted-foreground sm:text-sm">Mostrar:</span>
          <select
            class="alma-input h-8 w-16 rounded-lg px-[10px] sm:w-20"
            [value]="itemsPerPage()"
            (change)="itemsPerPageChange.emit(+$any($event.target).value)"
          >
            @for (size of pageSizeOptions(); track size) {
              <option [value]="size">{{ size }}</option>
            }
          </select>
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
        <div class="flex items-center gap-1 rounded-full bg-muted/30 p-1">
          <button
            class="flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-all"
            [class]="
              currentPage() === 1
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'bg-primary text-white hover:opacity-90 active:scale-95'
            "
            [disabled]="currentPage() === 1"
            (click)="pageChange.emit(currentPage() - 1)"
            aria-label="Página anterior"
          >
            <lucide-icon name="chevron-left" [size]="16" />
          </button>

          <div class="flex items-center gap-0.5 px-1">
            @for (p of paginas(); track $index) {
              @if (p === null) {
                <span class="px-1.5 py-1 text-[10px] text-muted-foreground">...</span>
              } @else {
                <button
                  class="h-7 min-w-[1.75rem] rounded-lg px-1 text-xs transition-all"
                  [class]="
                    currentPage() === p
                      ? 'bg-primary/10 font-bold text-primary'
                      : 'font-medium text-muted-foreground hover:bg-muted active:scale-90'
                  "
                  (click)="pageChange.emit(p)"
                >
                  {{ p }}
                </button>
              }
            }
          </div>

          <button
            class="flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-all"
            [class]="
              currentPage() === totalPages()
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'bg-primary text-white hover:opacity-90 active:scale-95'
            "
            [disabled]="currentPage() === totalPages()"
            (click)="pageChange.emit(currentPage() + 1)"
            aria-label="Página siguiente"
          >
            <lucide-icon name="chevron-right" [size]="16" />
          </button>
        </div>
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

  protected readonly desde = computed(
    () => (this.currentPage() - 1) * this.itemsPerPage() + 1,
  );
  protected readonly hasta = computed(() =>
    Math.min(this.currentPage() * this.itemsPerPage(), this.total()),
  );

  /** Números de página con elipsis (null) — misma lógica del original. */
  protected readonly paginas = computed<(number | null)[]>(() => {
    const total = this.totalPages();
    const actual = this.currentPage();
    const pages: (number | null)[] = [];
    const maxVisible = 5;

    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }
    if (actual <= 3) {
      for (let i = 1; i <= 4; i++) pages.push(i);
      pages.push(null, total);
      return pages;
    }
    if (actual >= total - 2) {
      pages.push(1, null);
      for (let i = total - 3; i <= total; i++) pages.push(i);
      return pages;
    }
    pages.push(1, null);
    for (let i = actual - 1; i <= actual + 1; i++) pages.push(i);
    pages.push(null, total);
    return pages;
  });
}
