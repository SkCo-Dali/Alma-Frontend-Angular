// Conector de la cuenta de Pharos del usuario (Configuración → Cuentas conectadas). Al
// emitir una póliza, Alma autentica contra Pharos con esta cuenta (trazabilidad). La
// contraseña se cifra en el backend.

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent, SkInputComponent, SkTagComponent } from '@skandia/ui';
import { ApiService } from '../../core/services/api.service';

export interface CuentaPharosApi {
  conectada: boolean;
  estado: 'conectada' | 'requiere_refresco' | null;
  pharos_user?: string;
  ultima_verificacion?: string | null;
}

@Component({
  selector: 'alma-cuenta-pharos',
  imports: [FormsModule, LucideAngularModule, SkButtonComponent, SkInputComponent, SkTagComponent],
  template: `
    <section class="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <h2 class="text-sm font-semibold text-foreground">Cuentas conectadas</h2>
      <p class="mb-4 mt-1 text-xs text-muted-foreground">
        Conecta tu cuenta de Pharos para que las pólizas que emitas queden a tu nombre en
        el core de seguros. Tu contraseña se guarda cifrada.
      </p>

      <div class="rounded-lg border border-border p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <span class="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
              <lucide-icon name="plug" [size]="16" />
            </span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium text-foreground">Pharos</p>
                @if (!cargando()) {
                  @if (requiereRefresco()) {
                    <sk-tag value="Requiere actualizar" severity="warn" />
                  } @else if (conectada()) {
                    <sk-tag value="Conectada" severity="success" />
                  } @else {
                    <sk-tag value="No conectada" severity="secondary" />
                  }
                }
              </div>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{
                  conectada() && data()?.pharos_user
                    ? 'Usuario ' + data()!.pharos_user
                    : 'Core de seguros (emisión de pólizas)'
                }}
              </p>
            </div>
          </div>

          @if (!mostrarForm()) {
            <div class="flex shrink-0 gap-2">
              <sk-button
                variant="secondary"
                type="button"
                [label]="conectada() || requiereRefresco() ? 'Actualizar' : 'Conectar'"
                (clicked)="editando.set(true)"
              />
              @if (conectada() || requiereRefresco()) {
                <sk-button
                  variant="tertiary"
                  severity="danger"
                  type="button"
                  icon="times"
                  label="Desconectar"
                  [disabled]="desconectando()"
                  (clicked)="desconectar()"
                />
              }
            </div>
          }
        </div>

        @if (requiereRefresco() && !mostrarForm()) {
          <div
            class="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <lucide-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0" />
            No pudimos acceder a tu cuenta de Pharos (contraseña inválida o cambiada).
            Actualízala para poder volver a emitir.
          </div>
        }

        @if (mostrarForm()) {
          <div class="mt-4 flex flex-col gap-3 border-t border-border/50 pt-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <sk-input
                  label="Usuario Pharos"
                  [(ngModel)]="usuario"
                  placeholder="usuario"
                  autocomplete="off"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <sk-input
                  type="password"
                  label="Contraseña"
                  [(ngModel)]="password"
                  placeholder="••••••••"
                  autocomplete="new-password"
                />
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Verificamos tus credenciales contra Pharos antes de guardarlas (cifradas). Si
              son inválidas, no se guardan.
            </p>
            @if (error(); as err) {
              <p class="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{{ err }}</p>
            }
            @if (exito()) {
              <p
                class="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                <lucide-icon name="check-circle-2" [size]="14" /> Cuenta conectada.
              </p>
            }
            <div class="flex justify-end gap-2">
              @if (conectada() || requiereRefresco() || editando()) {
                <sk-button
                  variant="tertiary"
                  type="button"
                  label="Cancelar"
                  (clicked)="cancelar()"
                />
              }
              <sk-button
                variant="primary"
                type="button"
                [label]="conectando() ? 'Verificando…' : 'Guardar y conectar'"
                [loading]="conectando()"
                [disabled]="!usuario.trim() || !password || conectando()"
                (clicked)="conectar()"
              />
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class CuentaPharosComponent {
  private readonly api = inject(ApiService);

  protected usuario = '';
  protected password = '';

  protected readonly data = signal<CuentaPharosApi | null>(null);
  protected readonly cargando = signal(true);
  protected readonly editando = signal(false);
  protected readonly conectando = signal(false);
  protected readonly desconectando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal(false);

  protected readonly conectada = computed(() => this.data()?.conectada ?? false);
  protected readonly requiereRefresco = computed(
    () => this.data()?.estado === 'requiere_refresco',
  );
  protected readonly mostrarForm = computed(
    () => this.editando() || (!this.conectada() && !this.requiereRefresco()),
  );

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.data.set(await this.api.fetch<CuentaPharosApi>('/api/suscripcion/cuenta-pharos'));
    } catch {
      this.data.set(null);
    } finally {
      this.cargando.set(false);
    }
  }

  protected async conectar(): Promise<void> {
    this.conectando.set(true);
    this.error.set(null);
    this.exito.set(false);
    try {
      await this.api.fetch<CuentaPharosApi>('/api/suscripcion/cuenta-pharos', {
        method: 'PUT',
        body: JSON.stringify({ pharos_user: this.usuario.trim(), password: this.password }),
      });
      this.exito.set(true);
      this.editando.set(false);
      this.usuario = '';
      this.password = '';
      await this.cargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.conectando.set(false);
    }
  }

  protected async desconectar(): Promise<void> {
    this.desconectando.set(true);
    try {
      await this.api.fetch('/api/suscripcion/cuenta-pharos', { method: 'DELETE' });
      await this.cargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.desconectando.set(false);
    }
  }

  protected cancelar(): void {
    this.editando.set(false);
    this.error.set(null);
    this.exito.set(false);
  }
}
