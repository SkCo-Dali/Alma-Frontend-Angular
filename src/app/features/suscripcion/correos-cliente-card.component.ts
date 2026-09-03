// Correos del buzón de suscripción relacionados con el cliente (por cédula o
// número de cotización). El botón "Correo al asesor" abre el diálogo "Envío
// de Correos" (réplica del módulo de Dali: componer, previsualizar,
// historial). Si el ambiente no tiene el correo configurado (503), la tarjeta
// se oculta sola.

import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { EnvioCorreosDialogComponent } from './envio-correos-dialog.component';
import { CorreoClienteApi, SuscripcionApi } from './suscripcion.api';

@Component({
  selector: 'alma-correos-cliente-card',
  imports: [LucideAngularModule, EnvioCorreosDialogComponent],
  template: `
    @if (!oculto()) {
      <section class="mb-3 break-inside-avoid-column">
        <div class="mb-1.5 flex items-center justify-between gap-1.5 px-1.5">
          <div class="flex items-center gap-1.5">
            <lucide-icon name="mail" [size]="14" class="text-muted-foreground" />
            <h2
              class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Correos de suscripción
            </h2>
          </div>
          @if (puedeGestionar()) {
            <button
              type="button"
              (click)="dialogoAbierto.set(true)"
              class="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <lucide-icon name="send" [size]="12" /> Correo al asesor
            </button>
          }
        </div>
        <div class="glass overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
          @if (cargando()) {
            <div class="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
              <lucide-icon name="refresh-cw" [size]="14" class="animate-spin" />
              Buscando en el buzón…
            </div>
          } @else if (error()) {
            <p class="px-4 py-3 text-xs text-muted-foreground">{{ error() }}</p>
          } @else if (items().length === 0) {
            <p class="px-4 py-3 text-xs text-muted-foreground">
              El buzón no tiene correos que mencionen la cédula o la cotización.
            </p>
          } @else {
            <div class="divide-y divide-border/40">
              @for (c of items(); track $index) {
                <div class="px-4 py-2.5">
                  <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p class="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                      {{ c.asunto ?? '(sin asunto)' }}
                    </p>
                    <p class="text-xs tabular-nums text-muted-foreground">
                      {{ dia(c.fecha) }}
                    </p>
                  </div>
                  <p class="mt-0.5 truncate text-xs text-muted-foreground">
                    {{ c.de_nombre ?? c.de ?? '—' }}
                  </p>
                  @if (c.resumen) {
                    <p class="mt-1 line-clamp-2 break-words text-xs leading-snug text-foreground/80">
                      {{ c.resumen }}
                    </p>
                  }
                  @if (c.enlace) {
                    <a
                      [href]="c.enlace"
                      target="_blank"
                      rel="noopener"
                      class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <lucide-icon name="external-link" [size]="11" /> Abrir en Outlook
                    </a>
                  }
                </div>
              }
            </div>
          }
        </div>
      </section>
    }

    @if (dialogoAbierto()) {
      <alma-envio-correos-dialog
        [solicitudId]="solicitudId()"
        [nroCotizacion]="nroCotizacion()"
        (closed)="cerrarDialogo()"
        (enviado)="enviado.emit()"
      />
    }
  `,
})
export class CorreosClienteCardComponent {
  private readonly api = inject(SuscripcionApi);
  private readonly auth = inject(AuthService);

  readonly solicitudId = input.required<string>();
  readonly nroCotizacion = input<string>('');
  /** Emite tras un envío exitoso (el padre puede refrescar). */
  readonly enviado = output<void>();

  protected readonly items = signal<CorreoClienteApi[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  /** true cuando el ambiente no tiene el correo configurado (503). */
  protected readonly oculto = signal(false);
  protected readonly dialogoAbierto = signal(false);

  protected puedeGestionar(): boolean {
    return this.auth.hasPermission('app.suscripcion.solicitudes.manage');
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

  protected cerrarDialogo(): void {
    this.dialogoAbierto.set(false);
    // Refresca la lista por si el envío quedó en el buzón.
    void this.cargar(this.solicitudId());
  }

  private async cargar(id: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const r = await this.api.getCorreosCliente(id);
      this.items.set(r.items ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 503 = correos no configurados en el ambiente: la tarjeta desaparece.
      if (msg.includes('503') || msg.toLowerCase().includes('no está configurad')) {
        this.oculto.set(true);
      } else {
        this.error.set('No fue posible consultar el buzón. ' + msg);
      }
    } finally {
      this.cargando.set(false);
    }
  }
}
