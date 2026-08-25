// Tabla estándar de la consola /admin: área de scroll con altura acotada + header
// sticky y paginado en cliente estilo Dali. Las filas se definen con un <ng-template>
// del consumidor (let-row).

import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, computed, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

const TAMANOS = [10, 25, 50] as const;

@Component({
  selector: 'alma-admin-table',
  imports: [NgTemplateOutlet, LucideAngularModule],
  template: `
    <div
      class="glass flex flex-col overflow-hidden rounded-lg shadow-[var(--shadow-sm)]"
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
            <select
              class="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs"
              [value]="tamano()"
              (change)="cambiarTamano($any($event.target).value)"
            >
              @for (t of tamanos; track t) {
                <option [value]="t">{{ t }}</option>
              }
            </select>
            <span>Resultado {{ desde() }} - {{ hasta() }} de {{ rows().length }}</span>
          </div>

          @if (totalPaginas() > 1) {
            <div class="flex items-center gap-1">
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent disabled:opacity-40"
                [disabled]="pagina() === 1"
                (click)="pagina.set(pagina() - 1)"
                aria-label="Página anterior"
              >
                <lucide-icon name="chevron-left" [size]="16" />
              </button>
              @for (n of paginas(); track n; let i = $index) {
                @if (i > 0 && paginas()[i - 1] < n - 1) {
                  <span class="px-1">…</span>
                }
                <button
                  (click)="pagina.set(n)"
                  class="h-7 min-w-7 rounded-md px-1.5"
                  [class]="
                    n === pagina()
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'hover:bg-accent'
                  "
                >
                  {{ n }}
                </button>
              }
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent disabled:opacity-40"
                [disabled]="pagina() === totalPaginas()"
                (click)="pagina.set(pagina() + 1)"
                aria-label="Página siguiente"
              >
                <lucide-icon name="chevron-right" [size]="16" />
              </button>
            </div>
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

  protected readonly tamanos = TAMANOS;
  protected readonly tamano = signal<number>(25);
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
  protected readonly paginas = computed(() => {
    const total = this.totalPaginas();
    const p = this.pagina();
    const set = new Set<number>([1, total, p - 1, p, p + 1]);
    return [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  });

  protected cambiarTamano(v: string): void {
    this.tamano.set(Number(v));
    this.pagina.set(1);
  }
}
