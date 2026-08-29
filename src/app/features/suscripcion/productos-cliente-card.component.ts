// Portafolio del cliente en Skandia (todos los cores vía Sigscg.Contrato):
// qué productos tiene —fondos, cesantías, pensiones, seguros—, su estado y
// fechas. Sin saldos. Pedido de la mesa de Suscripción (chat UW+, ago-2026).

import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ProductoClienteApi, SuscripcionApi } from './suscripcion.api';

@Component({
  selector: 'alma-productos-cliente-card',
  imports: [LucideAngularModule],
  template: `
    <section class="mb-3 break-inside-avoid-column">
      <div class="mb-1.5 flex items-center gap-1.5 px-1.5">
        <lucide-icon name="wallet" [size]="14" class="text-muted-foreground" />
        <h2 class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Productos del cliente en Skandia
        </h2>
      </div>
      <div class="glass overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
        @if (cargando()) {
          <div class="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
            <lucide-icon name="refresh-cw" [size]="14" class="animate-spin" />
            Consultando el portafolio…
          </div>
        } @else if (error()) {
          <p class="px-4 py-3 text-xs text-muted-foreground">{{ error() }}</p>
        } @else if (items().length === 0) {
          <p class="px-4 py-3 text-xs text-muted-foreground">
            El cliente no tiene otros productos registrados.
          </p>
        } @else {
          <div class="divide-y divide-border/40">
            @for (p of items(); track $index) {
              <div class="flex items-center justify-between gap-3 px-4 py-2">
                <div class="min-w-0">
                  <p class="truncate text-[13px] font-medium text-foreground">
                    {{ p.productoDesc ?? p.productCode ?? '—' }}
                  </p>
                  <p class="text-xs tabular-nums text-muted-foreground">
                    {{ p.productCode }}{{ p.planProducto ? ' ' + p.planProducto : '' }}
                    · Contrato {{ p.contrato ?? '—' }}
                    @if (p.fechaInicio) {
                      · desde {{ dia(p.fechaInicio) }}
                    }
                  </p>
                </div>
                <span
                  class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                  [class]="claseEstado(p.estado)"
                >
                  {{ p.estado ?? p.estadoCodigo ?? '—' }}
                </span>
              </div>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class ProductosClienteCardComponent {
  private readonly api = inject(SuscripcionApi);

  readonly solicitudId = input.required<string>();

  protected readonly items = signal<ProductoClienteApi[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected dia(iso: string | null): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  }

  protected claseEstado(estado: string | null): string {
    const e = (estado ?? '').toUpperCase();
    if (e.startsWith('ACTIV'))
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    if (e.startsWith('CANCEL') || e.startsWith('FALLEC'))
      return 'bg-destructive/10 text-destructive';
    return 'bg-muted text-muted-foreground';
  }

  constructor() {
    effect(() => {
      const id = this.solicitudId();
      untracked(() => void this.cargar(id));
    });
  }

  private async cargar(id: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const r = await this.api.getProductosCliente(id);
      this.items.set(r.items ?? []);
    } catch (e) {
      this.error.set(
        'No fue posible consultar el portafolio del cliente. ' +
          (e instanceof Error ? e.message : ''),
      );
    } finally {
      this.cargando.set(false);
    }
  }
}
