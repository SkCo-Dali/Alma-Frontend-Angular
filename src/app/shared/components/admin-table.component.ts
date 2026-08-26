// Tabla estándar de la consola /admin: área de scroll con altura acotada + header
// sticky y paginado en cliente estilo Dali. Las filas se definen con un <ng-template>
// del consumidor (let-row).

import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SkDropdownComponent, SkPaginatorComponent } from '@skandia/ui';

const TAMANOS = [10, 25, 50] as const;

@Component({
  selector: 'alma-admin-table',
  imports: [NgTemplateOutlet, FormsModule, SkDropdownComponent, SkPaginatorComponent],
  template: `
    <div
      class="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-sm)]"
    >
      <div class="overflow-auto" [style.maxHeight]="maxHeight()">
        <table class="w-full text-sm">
          <thead
            class="sticky top-0 z-10 text-xs uppercase tracking-wider text-muted-foreground shadow-[0_1px_0_var(--border)]"
          >
            <tr>
              @for (h of headers(); track h) {
                <th class="bg-[var(--table-header)] px-4 py-3 text-left font-medium">
                  {{ h }}
                </th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            @for (row of visibles(); track $index) {
              <tr class="hover:bg-[var(--surface-sunken)]">
                <ng-container
                  [ngTemplateOutlet]="rowTpl()"
                  [ngTemplateOutletContext]="{ $implicit: row }"
                />
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (rows().length === 0) {
        <p class="py-8 text-center text-sm text-muted-foreground">{{ emptyMessage() }}</p>
      } @else {
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground"
        >
          <div class="flex items-center gap-2">
            <span>Mostrar</span>
            <sk-dropdown
              class="w-16"
              [options]="tamanoOpciones()"
              [ngModel]="'' + tamano()"
              (ngModelChange)="cambiarTamano($event)"
            />
            <span>Resultado {{ desde() }} - {{ hasta() }} de {{ rows().length }}</span>
          </div>

          @if (totalPaginas() > 1) {
            <sk-paginator
              [first]="(pagina() - 1) * tamano()"
              [rows]="tamano()"
              [totalRecords]="rows().length"
              [rowsPerPageOptions]="[]"
              [showFirstLastIcon]="false"
              [showCurrentPageReport]="false"
              (pageChange)="onSkPageChange($any($event))"
            />
          }
        </div>
      }
    </div>
  `,
})
export class AdminTableComponent<T = unknown> {
  readonly headers = input.required<string[]>();
  readonly rows = input.required<T[]>();
  readonly rowTpl = input.required<TemplateRef<{ $implicit: T }>>();
  readonly emptyMessage = input('Sin registros.');
  readonly maxHeight = input('calc(100dvh - 13rem)');

  protected readonly tamano = signal<number>(25);
  protected readonly tamanoOpciones = computed(() =>
    TAMANOS.map((t) => ({ label: String(t), value: String(t) })),
  );
  protected readonly pagina = signal(1);

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.rows().length / this.tamano())),
  );
  protected readonly visibles = computed(() => {
    const p = Math.min(this.pagina(), this.totalPaginas());
    return this.rows().slice((p - 1) * this.tamano(), p * this.tamano());
  });
  protected readonly desde = computed(() =>
    this.rows().length === 0 ? 0 : (this.pagina() - 1) * this.tamano() + 1,
  );
  protected readonly hasta = computed(() =>
    Math.min(this.pagina() * this.tamano(), this.rows().length),
  );

  protected cambiarTamano(v: string): void {
    this.tamano.set(Number(v));
    this.pagina.set(1);
  }

  protected onSkPageChange(state: { page?: number }): void {
    this.pagina.set((state.page ?? 0) + 1);
  }
}
