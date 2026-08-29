// Pólizas y cotizaciones ANTERIORES del mismo asegurado en Control Emisión
// (TrkApplications), con sus observaciones: la verificación "Pipeline" del
// analista sin salir de Alma (pedido de la mesa de Suscripción, ago-2026).

import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { HistorialClienteItemApi, SuscripcionApi } from './suscripcion.api';
import { fmtCOP } from './suscripcion.domain';

@Component({
  selector: 'alma-historial-cliente-card',
  imports: [LucideAngularModule],
  template: `
    <section class="mb-3 break-inside-avoid-column">
      <div class="mb-1.5 flex items-center gap-1.5 px-1.5">
        <lucide-icon name="history" [size]="14" class="text-muted-foreground" />
        <h2 class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Pólizas anteriores del cliente
        </h2>
      </div>
      <div class="glass overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
        @if (cargando()) {
          <div class="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
            <lucide-icon name="refresh-cw" [size]="14" class="animate-spin" />
            Consultando Control Emisión…
          </div>
        } @else if (error()) {
          <p class="px-4 py-3 text-xs text-muted-foreground">{{ error() }}</p>
        } @else if (anteriores().length === 0) {
          <p class="px-4 py-3 text-xs text-muted-foreground">
            El cliente no tiene otras cotizaciones en Control Emisión.
          </p>
        } @else {
          <div class="divide-y divide-border/40">
            @for (h of anteriores(); track $index) {
              <div class="px-4 py-2.5">
                <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p class="text-[13px] font-medium text-foreground">
                    {{ h.producto ?? h.nro_cotizacion ?? '—' }}
                  </p>
                  <p class="text-xs tabular-nums text-muted-foreground">
                    {{ dia(h.fecha_recepcion) }}
                  </p>
                </div>
                <p class="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  @if (h.estado) {
                    <span class="font-medium text-foreground/80">{{ h.estado }}</span>
                  }
                  @if (h.subestado && h.subestado !== 'No Aplica') {
                    <span>· {{ h.subestado }}</span>
                  }
                  @if (h.contrato_pharos) {
                    <span>· Contrato {{ h.contrato_pharos }}</span>
                  }
                  @if (h.suma_asegurada) {
                    <span>· {{ cop(h.suma_asegurada) }}</span>
                  }
                  @if (h.estado_cobertura) {
                    <span>· Cobertura: {{ h.estado_cobertura }}</span>
                  }
                </p>
                @if (h.motivo_rechazo_retracto) {
                  <p class="mt-1 text-xs font-medium text-destructive">
                    {{ h.motivo_rechazo_retracto }}
                  </p>
                }
                @if (h.observaciones) {
                  <p class="mt-1 break-words text-xs leading-snug text-foreground/90">
                    {{ h.observaciones }}
                  </p>
                }
                @if (h.observaciones_reaseguro) {
                  <p class="mt-1 break-words text-xs leading-snug text-foreground/80">
                    Reaseguro: {{ h.observaciones_reaseguro }}
                  </p>
                }
              </div>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class HistorialClienteCardComponent {
  private readonly api = inject(SuscripcionApi);

  readonly solicitudId = input.required<string>();

  protected readonly items = signal<HistorialClienteItemApi[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Solo las ANTERIORES: la cotización actual ya es toda la subpágina. */
  protected readonly anteriores = computed(() =>
    this.items().filter((h) => !h.es_actual),
  );

  protected cop(n: number): string {
    return fmtCOP(n);
  }

  protected dia(iso: string | null): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
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
      const r = await this.api.getHistorialCliente(id);
      this.items.set(r.items ?? []);
    } catch (e) {
      this.error.set(
        'No fue posible consultar el historial en Pipeline. ' +
          (e instanceof Error ? e.message : ''),
      );
    } finally {
      this.cargando.set(false);
    }
  }
}
