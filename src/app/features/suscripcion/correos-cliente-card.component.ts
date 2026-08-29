// Correos del buzón de suscripción relacionados con el cliente (por cédula o
// número de cotización) + envío del correo de suscripción al FP con copia al
// director comercial. Cubre la verificación "Correo" del analista (UW+,
// ago-2026). Si el ambiente no tiene el buzón configurado (503), la tarjeta
// se oculta sola.

import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { CorreoClienteApi, SuscripcionApi } from './suscripcion.api';

@Component({
  selector: 'alma-correos-cliente-card',
  imports: [FormsModule, LucideAngularModule],
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
              (click)="abrirEnvio()"
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

    <!-- Diálogo de envío -->
    @if (enviando() !== null) {
      <div
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        (click)="cerrarEnvio()"
      >
        <div
          class="surface-solid w-full max-w-lg rounded-2xl border border-border p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          @if (resultadoEnvio(); as res) {
            <div
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            >
              <lucide-icon name="check-circle-2" [size]="24" />
            </div>
            <h2 class="mt-3 text-center text-lg font-bold">Correo enviado</h2>
            <p class="text-center text-sm text-muted-foreground">
              Para <strong class="text-foreground">{{ res.para }}</strong>
              @if (res.cc.length > 0) {
                con copia a {{ res.cc.join(', ') }}
              }
            </p>
            <p class="mt-2 text-center text-xs text-muted-foreground">
              Para estampar la fecha del correo y el subestado en Pipeline, usa
              "Actualizar en Pipeline → Información adicional".
            </p>
            <button
              type="button"
              (click)="cerrarEnvio()"
              class="alma-btn alma-btn-primary mt-4 w-full rounded-xl"
            >
              Listo
            </button>
          } @else {
            <h2 class="text-lg font-bold">Correo al asesor</h2>
            <p class="mt-1 text-xs text-muted-foreground">
              Se envía desde el buzón de suscripción al FP de la cotización
              {{ nroCotizacion() }}.
            </p>
            <label class="mt-3 block text-xs font-medium text-muted-foreground">Asunto</label>
            <input [(ngModel)]="asunto" maxlength="250" class="alma-input mt-1 w-full rounded-xl" />
            <label class="mt-3 block text-xs font-medium text-muted-foreground">Mensaje</label>
            <textarea
              [(ngModel)]="cuerpo"
              rows="6"
              maxlength="20000"
              class="alma-input mt-1 w-full rounded-xl text-sm"
              placeholder="Qué se le solicita al asesor…"
            ></textarea>
            <label class="mt-3 flex cursor-pointer items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                [(ngModel)]="copiarDirector"
                class="h-4 w-4 accent-[var(--primary)]"
              />
              Con copia al director comercial
            </label>
            @if (errorEnvio(); as err) {
              <p class="mt-3 rounded-xl bg-destructive/10 p-2 text-center text-xs text-destructive">
                {{ err }}
              </p>
            }
            <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                (click)="cerrarEnvio()"
                class="alma-btn alma-btn-outline w-full rounded-xl sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="!asunto.trim() || !cuerpo.trim() || enviando() === true"
                (click)="enviar()"
                class="alma-btn alma-btn-primary w-full rounded-xl sm:w-auto"
              >
                @if (enviando() === true) {
                  <lucide-icon name="loader-2" [size]="16" class="animate-spin" />
                }
                {{ enviando() === true ? 'Enviando…' : 'Enviar correo' }}
              </button>
            </div>
          }
        </div>
      </div>
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
  /** true cuando el ambiente no tiene el buzón configurado (503). */
  protected readonly oculto = signal(false);

  // Estado del diálogo de envío: null = cerrado, false = abierto, true = enviando.
  protected readonly enviando = signal<boolean | null>(null);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly resultadoEnvio = signal<{ para: string; cc: string[] } | null>(null);
  protected asunto = '';
  protected cuerpo = '';
  protected copiarDirector = true;

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

  private async cargar(id: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const r = await this.api.getCorreosCliente(id);
      this.items.set(r.items ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 503 = el módulo de correos no está configurado en el ambiente: la
      // tarjeta desaparece en vez de mostrar un error permanente.
      if (msg.includes('503') || msg.toLowerCase().includes('no está configurad')) {
        this.oculto.set(true);
      } else {
        this.error.set('No fue posible consultar el buzón. ' + msg);
      }
    } finally {
      this.cargando.set(false);
    }
  }

  protected abrirEnvio(): void {
    this.errorEnvio.set(null);
    this.resultadoEnvio.set(null);
    if (!this.asunto) {
      this.asunto = `Suscripción — cotización ${this.nroCotizacion()}`.trim();
    }
    this.enviando.set(false);
  }

  protected cerrarEnvio(): void {
    this.enviando.set(null);
    if (this.resultadoEnvio()) {
      this.resultadoEnvio.set(null);
      void this.cargar(this.solicitudId());
    }
  }

  protected async enviar(): Promise<void> {
    this.enviando.set(true);
    this.errorEnvio.set(null);
    try {
      const res = await this.api.enviarCorreoAsesor(this.solicitudId(), {
        asunto: this.asunto.trim(),
        cuerpo: this.cuerpo.trim().replace(/\n/g, '<br/>'),
        copiar_director: this.copiarDirector,
      });
      this.resultadoEnvio.set({ para: res.para, cc: res.cc });
      this.enviado.emit();
    } catch (e) {
      this.errorEnvio.set(e instanceof Error ? e.message : String(e));
    } finally {
      if (this.enviando() === true) this.enviando.set(false);
    }
  }
}
