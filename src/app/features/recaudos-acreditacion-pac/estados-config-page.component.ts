// Configuración del catálogo de estados de Acreditación PAC (apps/recaudos-acreditacion-
// pac/estados). Solo con PERM_CONFIG. Lista en orden de flujo con cuántos pagos tiene
// hoy cada estado; crear, editar, reordenar y activar/desactivar (no se borra: el
// historial de los pagos sigue nombrando los estados por los que pasaron). Arriba avisa
// de los códigos que llegan en pagos y no están en el catálogo, para configurarlos.

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import { EstadoEditorComponent } from './estado-editor.component';
import { EstadoMeta, PERM_CONFIG, RecaudosPacApi, estiloBadge } from './recaudos-pac.api';

@Component({
  selector: 'alma-estados-config-page',
  imports: [RouterLink, LucideAngularModule, AccessDeniedComponent, TooltipDirective, EstadoEditorComponent],
  template: `
    @if (!puedeConfigurar()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div class="flex flex-wrap items-center gap-2">
          <a
            routerLink="/apps/recaudos-acreditacion-pac"
            class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary"
          >
            <lucide-icon name="arrow-left" [size]="16" /> Acreditación PAC
          </a>
        </div>

        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Configuración de estados
            </h1>
            <p class="text-on-wallpaper mt-1 max-w-2xl text-sm text-foreground/80">
              Cada estado define su tarjeta en la bandeja, el botón de acción, el correo a la empresa y a
              qué estado pasa el pago al confirmar.
            </p>
          </div>
          <div class="flex items-center gap-2">
            @if (api.modoDemo()) {
              <span
                class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                almaTooltip="Sin backend todavía: los cambios se guardan solo mientras dure la sesión."
              >
                <lucide-icon name="flask-conical" [size]="12" />
                Datos de demostración
              </span>
            }
            <button type="button" class="alma-btn alma-btn-primary" (click)="abrirNuevo()">
              <lucide-icon name="plus" [size]="16" />
              Nuevo estado
            </button>
          </div>
        </div>

        <!-- Códigos que llegan en pagos y no están en el catálogo -->
        @for (s of sinConfigurar(); track s.codigo) {
          <div class="glass flex flex-wrap items-center gap-3 rounded-xl border-l-4 border-amber-500 px-4 py-3 shadow-[var(--shadow-sm)]">
            <lucide-icon name="alert-triangle" [size]="18" class="shrink-0 text-amber-600 dark:text-amber-400" />
            <p class="min-w-0 flex-1 text-sm text-foreground">
              Estado sin configurar: <code class="rounded bg-[var(--surface-sunken)] px-1.5 py-px text-[13px]">{{ s.codigo }}</code>
              · {{ s.total }} {{ s.total === 1 ? 'pago' : 'pagos' }} en bandeja. Se ven en gris y sin acciones.
            </p>
            <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" (click)="abrirNuevo(s.codigo)">
              Configurar
            </button>
          </div>
        }

        <!-- Lista -->
        <div class="glass overflow-hidden rounded-xl shadow-[var(--shadow-sm)]">
          @if (cargando() && !estados().length) {
            <div class="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <lucide-icon name="loader-2" [size]="16" class="animate-spin" /> Cargando estados…
            </div>
          } @else {
            <ul class="divide-y divide-border">
              @for (e of estados(); track e.codigo; let primero = $first; let ultimo = $last) {
                <li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" [class.opacity-55]="!e.activo">
                  <!-- Orden -->
                  <div class="flex flex-col">
                    <button type="button" class="alma-btn alma-btn-ghost h-6 w-6" [disabled]="primero || ocupado()" (click)="mover(e, -1)" aria-label="Subir">
                      <lucide-icon name="chevron-up" [size]="14" />
                    </button>
                    <button type="button" class="alma-btn alma-btn-ghost h-6 w-6" [disabled]="ultimo || ocupado()" (click)="mover(e, 1)" aria-label="Bajar">
                      <lucide-icon name="chevron-down" [size]="14" />
                    </button>
                  </div>

                  <!-- Identidad -->
                  <div class="flex min-w-[220px] flex-1 flex-col gap-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="alma-badge gap-1.5" [style]="badge(e.color)">
                        <span class="h-1.5 w-1.5 rounded-full" [style.background]="e.color"></span>
                        {{ e.corto }}
                      </span>
                      <span class="text-sm font-semibold text-foreground">{{ e.nombre }}</span>
                      @if (!e.activo) {
                        <span class="rounded bg-muted px-1.5 py-px text-[11px] text-muted-foreground">Inactivo</span>
                      }
                    </div>
                    <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <code class="text-[12px]">{{ e.codigo }}</code>
                      <span>Botón: «{{ e.accion }}»</span>
                      <span>{{ destino(e) }}</span>
                      @if (e.plantilla_correo) {
                        <span class="inline-flex items-center gap-1"><lucide-icon name="mail" [size]="12" /> {{ e.plantilla_correo === 'acreditacion' ? 'Acreditación' : 'Solicitud de info' }}</span>
                      }
                      @if (e.es_pipeline) {
                        <span class="inline-flex items-center gap-1"><lucide-icon name="workflow" [size]="12" /> Pipeline</span>
                      }
                      @if (e.gestion_manual) {
                        <span>Gestión manual</span>
                      }
                    </p>
                  </div>

                  <!-- Conteo + acciones -->
                  <div class="ml-auto flex items-center gap-2">
                    <span class="min-w-[72px] text-right text-xs tabular-nums text-muted-foreground">
                      {{ conteo().get(e.codigo) ?? 0 }} {{ (conteo().get(e.codigo) ?? 0) === 1 ? 'pago' : 'pagos' }}
                    </span>
                    <button type="button" class="alma-btn alma-btn-ghost" almaTooltip="Editar" aria-label="Editar" [disabled]="ocupado()" (click)="abrirEdicion(e)">
                      <lucide-icon name="pencil" [size]="15" />
                    </button>
                    <button
                      type="button"
                      class="alma-btn alma-btn-ghost"
                      [almaTooltip]="e.activo ? 'Desactivar' : 'Activar'"
                      [attr.aria-label]="e.activo ? 'Desactivar' : 'Activar'"
                      [disabled]="ocupado()"
                      (click)="alternarActivo(e)"
                    >
                      <lucide-icon [name]="e.activo ? 'power-off' : 'power'" [size]="15" />
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
        <p class="text-xs text-muted-foreground">
          El orden es el de las tarjetas en la bandeja. Un estado inactivo no se ofrece como destino al
          configurar transiciones; los pagos que ya lo tengan se siguen mostrando.
        </p>
      </div>

      @if (editor(); as ed) {
        <alma-estado-editor
          [estado]="ed.estado"
          [codigoSugerido]="ed.codigo"
          [catalogo]="estados()"
          [guardando]="ocupado()"
          (cerrar)="editor.set(null)"
          (guardar)="guardar($event, ed.estado === null)"
        />
      }
    }
  `,
})
export class EstadosConfigPageComponent {
  protected readonly api = inject(RecaudosPacApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly badge = estiloBadge;
  protected readonly puedeConfigurar = computed(() => this.auth.hasPermission(PERM_CONFIG));

  protected readonly estados = this.api.estados;
  protected readonly conteo = signal(new Map<string, number>());
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly editor = signal<{ estado: EstadoMeta | null; codigo: string } | null>(null);

  protected readonly sinConfigurar = computed(() => {
    const conocidos = new Set(this.estados().map((e) => e.codigo));
    return [...this.conteo().entries()]
      .filter(([codigo]) => !conocidos.has(codigo))
      .map(([codigo, total]) => ({ codigo, total }));
  });

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      await this.api.listarEstados();
      this.conteo.set(await this.api.conteoPorEstado());
    } catch (e) {
      this.toast.error('No se pudieron cargar los estados', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected destino(e: EstadoMeta): string {
    if (e.al_confirmar === null) return 'Al confirmar: sale de la bandeja';
    if (e.al_confirmar === e.codigo) return 'Al confirmar: se queda';
    return `Al confirmar: pasa a «${this.api.meta(e.al_confirmar).corto}»`;
  }

  protected abrirNuevo(codigo = ''): void {
    this.editor.set({ estado: null, codigo });
  }

  protected abrirEdicion(e: EstadoMeta): void {
    this.editor.set({ estado: e, codigo: e.codigo });
  }

  protected async guardar(e: EstadoMeta, esNuevo: boolean): Promise<void> {
    await this.ejecutar(async () => {
      await this.api.guardarEstado(e, esNuevo);
      this.editor.set(null);
      this.toast.show(esNuevo ? `Estado «${e.corto}» creado` : `Estado «${e.corto}» actualizado`);
    });
  }

  protected async mover(e: EstadoMeta, direccion: -1 | 1): Promise<void> {
    await this.ejecutar(() => this.api.moverEstado(e.codigo, direccion));
  }

  protected async alternarActivo(e: EstadoMeta): Promise<void> {
    const pagos = this.conteo().get(e.codigo) ?? 0;
    if (e.activo && pagos > 0 && !confirm(`«${e.corto}» tiene ${pagos} ${pagos === 1 ? 'pago' : 'pagos'} en bandeja. Se seguirán mostrando, pero el estado no se ofrecerá como destino. ¿Desactivarlo?`)) {
      return;
    }
    await this.ejecutar(async () => {
      await this.api.guardarEstado({ ...e, activo: !e.activo }, false);
      this.toast.show(`Estado «${e.corto}» ${e.activo ? 'desactivado' : 'activado'}`);
    });
  }

  private async ejecutar(fn: () => Promise<void>): Promise<void> {
    this.ocupado.set(true);
    try {
      await fn();
    } catch (err) {
      this.toast.error('No se pudo guardar', err instanceof Error ? err.message : String(err));
    } finally {
      this.ocupado.set(false);
    }
  }
}
