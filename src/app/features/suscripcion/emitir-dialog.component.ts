// Confirmación de emisión de la póliza en Pharos (issuecontract vía bridge). La emisión
// NUNCA es automática: la dispara el analista con confirmación explícita, y requiere su
// cuenta de Pharos conectada (queda a su nombre).

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CuentaPharosApi, SuscripcionApi } from './suscripcion.api';
import { Tarea, fmtCOP } from './suscripcion.domain';

@Component({
  selector: 'alma-emitir-dialog',
  imports: [FormsModule, RouterLink, LucideAngularModule],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        @if (emitida(); as res) {
          <!-- Éxito -->
          <div
            class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            <lucide-icon name="check-circle-2" [size]="24" />
          </div>
          <h2 class="mt-3 text-center text-lg font-bold">Póliza emitida</h2>
          <p class="text-center text-sm text-muted-foreground">
            Pharos generó el contrato
            <strong class="text-foreground">{{ res.contrato }}</strong> para la cotización
            {{ tarea().nro_cotizacion }}.
          </p>
          @if (res.advertencia; as adv) {
            <div
              class="mt-3 flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <lucide-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0" />
              {{ adv }}
            </div>
          }
          <button
            type="button"
            (click)="cerrar()"
            class="alma-btn alma-btn-primary mt-4 w-full rounded-xl"
          >
            Listo
          </button>
        } @else if (cargandoCuenta()) {
          <div class="flex flex-col items-center gap-3 p-8">
            <lucide-icon
              name="loader-2"
              [size]="24"
              class="animate-spin text-muted-foreground"
            />
            <p class="text-sm text-muted-foreground">Verificando tu cuenta de Pharos…</p>
          </div>
        } @else if (!cuentaLista()) {
          <!-- Falta conectar/actualizar la cuenta de Pharos -->
          <div
            class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          >
            <lucide-icon
              [name]="requiereRefresco() ? 'alert-triangle' : 'plug'"
              [size]="24"
            />
          </div>
          <h2 class="mt-3 text-center text-lg font-bold">
            {{
              requiereRefresco()
                ? 'Actualiza tu cuenta de Pharos'
                : 'Conecta tu cuenta de Pharos'
            }}
          </h2>
          <p class="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
            {{
              requiereRefresco()
                ? 'No pudimos acceder a tu cuenta de Pharos. Actualiza tu contraseña en Configuración para poder emitir a tu nombre.'
                : 'Para emitir a tu nombre en Pharos necesitas conectar tu cuenta. Se hace una sola vez, en Configuración → Cuentas conectadas.'
            }}
          </p>
          <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              (click)="cerrar()"
              class="alma-btn alma-btn-outline w-full rounded-xl sm:w-auto"
            >
              Cancelar
            </button>
            <a
              routerLink="/settings"
              (click)="cerrar()"
              class="alma-btn alma-btn-primary w-full rounded-xl sm:w-auto"
            >
              {{ requiereRefresco() ? 'Actualizar cuenta' : 'Conectar cuenta' }}
            </a>
          </div>
        } @else {
          <!-- Confirmación de emisión -->
          <div
            class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <lucide-icon name="send" [size]="20" />
          </div>
          <h2 class="mt-3 text-center text-lg font-bold">Aprobar y emitir en Pharos</h2>
          <p class="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
            Se emitirá la póliza de
            <strong class="text-foreground">{{ tarea().asegurado.nombre }}</strong> por
            <strong class="text-foreground">{{ suma() }}</strong>. Esta acción crea el
            contrato real en el core de seguros.
          </p>

          <div
            class="mt-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-center text-xs text-muted-foreground"
          >
            Cotización
            <strong class="text-foreground">{{ tarea().nro_cotizacion }}</strong> ·
            {{
              tarea().afiliacion?.producto_desc ?? tarea().afiliacion?.product_code ?? '—'
            }}
            · creada en Pharos el
            {{ tarea().afiliacion?.fecha_cotizacion_pharos ?? '—' }}
          </div>

          <label
            class="mx-auto mt-3 flex cursor-pointer items-center gap-2 text-xs text-foreground"
          >
            <input
              type="checkbox"
              [(ngModel)]="acepta"
              class="h-4 w-4 accent-[var(--primary)]"
            />
            Revisé las declaraciones y la evaluación del motor; apruebo la emisión.
          </label>

          @if (error(); as err) {
            <p
              class="mt-3 rounded-xl bg-destructive/10 p-2 text-center text-xs text-destructive"
            >
              {{ err }}
            </p>
          }

          <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              (click)="cerrar()"
              class="alma-btn alma-btn-outline w-full rounded-xl sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              [disabled]="!acepta || emitiendo()"
              (click)="emitir()"
              class="alma-btn alma-btn-primary w-full rounded-xl sm:w-auto"
            >
              @if (emitiendo()) {
                <lucide-icon name="loader-2" [size]="16" class="animate-spin" />
              }
              {{ emitiendo() ? 'Emitiendo…' : 'Sí, emitir póliza' }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class EmitirDialogComponent {
  private readonly api = inject(SuscripcionApi);

  readonly tarea = input.required<Tarea>();
  readonly closed = output<void>();
  /** Se emite tras una emisión exitosa (el padre refresca la cotización). */
  readonly emitido = output<void>();

  protected acepta = false;
  protected readonly cuenta = signal<CuentaPharosApi | null>(null);
  protected readonly cargandoCuenta = signal(true);
  protected readonly emitiendo = signal(false);
  protected readonly emitida = signal<{
    contrato: string;
    advertencia: string | null;
  } | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly cuentaLista = computed(
    () => this.cuenta()?.conectada && this.cuenta()?.estado === 'conectada',
  );
  protected readonly requiereRefresco = computed(
    () => this.cuenta()?.estado === 'requiere_refresco',
  );
  protected readonly suma = computed(() => fmtCOP(this.tarea().producto.suma_asegurada));

  constructor() {
    void this.cargarCuenta();
  }

  private async cargarCuenta(): Promise<void> {
    try {
      this.cuenta.set(await this.api.getCuentaPharos());
    } catch {
      this.cuenta.set(null);
    } finally {
      this.cargandoCuenta.set(false);
    }
  }

  protected async emitir(): Promise<void> {
    this.emitiendo.set(true);
    this.error.set(null);
    try {
      const res = await this.api.emitirSolicitud(
        this.tarea().tarea_id,
        `Emisión aprobada por el analista — cotización ${this.tarea().nro_cotizacion}`,
      );
      this.emitida.set(res);
      this.emitido.emit();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
      // Si falló por credenciales, el backend marcó 'requiere_refresco':
      // refrescamos el estado de la cuenta para reflejarlo.
      void this.cargarCuenta();
    } finally {
      this.emitiendo.set(false);
    }
  }

  protected cerrar(): void {
    this.acepta = false;
    this.closed.emit();
  }
}
