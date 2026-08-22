// Subpágina de detalle de una cotización del Motor de Suscripción.
//
// Lenguaje visual "inset grouped" (HIG de Apple, como Ajustes de iOS):
// encabezado con Large Title + línea de identidad del asegurado, fila de
// decisiones (motor + declaraciones) y grupos de datos como listas de filas
// label→valor con separadores finos — en columnas tipo masonry en desktop.
// El único estado visible es el de Pipeline (uw_status/sub_status).
// Paridad DetalleSolicitud.tsx.

import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { CopyButtonComponent } from '../../shared/components/copy-button.component';
import { GrupoDef, buildGrupos, buildIdentidad } from './detalle-grupos';
import { AfiliacionDetalleApi, SuscripcionApi } from './suscripcion.api';
import {
  DECISION_BADGE,
  Tarea,
  UW_BADGE,
  apiToTarea,
  veredictoSalud,
} from './suscripcion.domain';
import { DeclaracionesDialogComponent } from './declaraciones-dialog.component';
import { EmitirDialogComponent } from './emitir-dialog.component';
import { EvaluarModalComponent } from './evaluar-modal.component';
import { SimuladorHostComponent } from './simulador/simulador-host.component';

@Component({
  selector: 'alma-detalle-solicitud',
  imports: [
    RouterLink,
    LucideAngularModule,
    AccessDeniedComponent,
    AlmaLoaderComponent,
    CopyButtonComponent,
    DeclaracionesDialogComponent,
    EmitirDialogComponent,
    EvaluarModalComponent,
    SimuladorHostComponent,
  ],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else if (cargando()) {
      <div class="flex flex-col items-center gap-4 p-16">
        <alma-loader [size]="90" />
        <p class="text-sm text-muted-foreground">Cargando cotización…</p>
      </div>
    } @else if (!tarea()) {
      <div
        class="mx-auto max-w-lg rounded-xl border-2 border-dashed border-border/50 bg-muted/20 p-12 text-center"
      >
        <p class="text-lg font-medium text-foreground">
          No fue posible cargar la cotización
        </p>
        <p class="mt-1 text-sm text-muted-foreground">{{ error() }}</p>
        <div class="mt-4 flex justify-center gap-2">
          <a routerLink="/apps/suscripcion/cotizaciones" class="alma-btn alma-btn-outline">
            <lucide-icon name="arrow-left" [size]="16" /> Volver
          </a>
          <button type="button" (click)="recargar()" class="alma-btn alma-btn-outline">
            <lucide-icon name="refresh-cw" [size]="16" /> Reintentar
          </button>
        </div>
      </div>
    } @else if (tarea(); as sel) {
      <!-- El panel del simulador precarga ESTA cotización (patrón "Tu Dali"). -->
      <alma-simulador-host [solicitudId]="solicitudId()">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <!-- ── Encabezado: Large Title + identidad + acciones ── -->
        <header class="glass rounded-2xl px-5 py-4 shadow-[var(--shadow-sm)]">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <a
              routerLink="/apps/suscripcion/cotizaciones"
              class="-ml-2 flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <lucide-icon name="arrow-left" [size]="16" />
              Cotizaciones
            </a>
            <div class="flex shrink-0 flex-wrap items-center gap-2">
              @if (refrescando()) {
                <lucide-icon
                  name="refresh-cw"
                  [size]="14"
                  class="animate-spin text-muted-foreground"
                />
              }
              @if (puedeGestionar()) {
                <button
                  type="button"
                  (click)="modal.set('evaluar')"
                  class="alma-btn alma-btn-outline h-8 rounded-xl text-xs"
                >
                  <lucide-icon name="stethoscope" [size]="16" /> Evaluar con el motor
                </button>
              }
              <!-- Aprobar y emitir: solo con permiso emit; habilitado cuando la
                   cotización es emitible (creada HOY, sin contrato, no emitida). -->
              @if (puedeEmitir()) {
                <span
                  class="inline-flex"
                  [title]="
                    sel.afiliacion?.emitible
                      ? ''
                      : (sel.afiliacion?.motivo_no_emitible ?? '')
                  "
                >
                  <button
                    type="button"
                    [disabled]="!sel.afiliacion?.emitible"
                    (click)="modal.set('emitir')"
                    class="alma-btn alma-btn-primary h-8 rounded-xl text-xs"
                  >
                    <lucide-icon name="send" [size]="16" /> Aprobar y emitir
                  </button>
                </span>
              }
            </div>
          </div>

          <div class="mt-2 min-w-0">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1
                class="min-w-0 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-[28px] sm:leading-9"
              >
                {{ sel.asegurado.nombre }}
              </h1>
              <span class="flex flex-wrap items-center gap-1.5">
                @if (sel.afiliacion?.uw_status_desc; as estado) {
                  <span
                    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium"
                    [class]="claseUw(sel.afiliacion?.uw_status)"
                  >
                    {{ estado }}
                  </span>
                }
                @if (sel.afiliacion?.producto_desc; as prod) {
                  <span
                    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {{ prod }}
                  </span>
                }
              </span>
            </div>

            <!-- Línea de identidad -->
            <p
              class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-relaxed text-muted-foreground"
            >
              @for (p of identidad(); track $index; let i = $index) {
                <span class="inline-flex items-center gap-2">
                  @if (i > 0) {
                    <span aria-hidden="true" class="text-border">·</span>
                  }
                  <span class="inline-flex items-center gap-1">
                    @if (p.icon) {
                      <lucide-icon [name]="p.icon" [size]="12" />
                    }
                    @if (p.prefijo) {
                      <span>{{ p.prefijo }}</span>
                    }
                    <span [class]="p.fuerte ? 'font-medium tabular-nums text-foreground' : ''">
                      {{ p.texto }}
                    </span>
                    @if (p.copy) {
                      <alma-copy-button
                        [value]="p.copy"
                        [label]="p.copyLabel ?? 'valor'"
                      />
                    }
                  </span>
                </span>
              }
            </p>
          </div>
        </header>

        <!-- Banner de datos incompletos -->
        @if (sel.datos_incompletos) {
          <div
            class="rounded-xl border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
          >
            Datos del asegurado incompletos — el worker los completa desde chankla/Pharos
            en el próximo ciclo, o puedes corregirlos al evaluar.
          </div>
        }

        <!-- ── Decisiones: motor + declaraciones ── -->
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <section class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)] lg:col-span-2">
            <div class="flex items-start gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                [class]="claseDecision(sel.evaluacion.decision)"
              >
                <lucide-icon name="zap" [size]="16" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p
                    class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    Evaluación del motor
                  </p>
                  <span
                    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium"
                    [class]="claseDecision(sel.evaluacion.decision)"
                  >
                    {{ sel.evaluacion.decision_label }}
                  </span>
                </div>
                <p class="mt-1 text-xs leading-snug text-muted-foreground">
                  {{ sel.evaluacion.accion_sugerida }}
                </p>
              </div>
            </div>
            @if (sel.evaluacion.alertas.length > 0) {
              <ul class="mt-3 grid gap-1.5 border-t border-border/40 pt-3 sm:grid-cols-2">
                @for (a of sel.evaluacion.alertas; track $index) {
                  <li
                    class="flex items-start gap-2 text-xs leading-snug text-foreground/90"
                  >
                    <lucide-icon
                      name="alert-triangle"
                      [size]="14"
                      class="mt-0.5 shrink-0"
                      [class]="a.prioridad === 'alta' ? 'text-destructive' : 'text-amber-500'"
                    />
                    {{ a.mensaje }}
                  </li>
                }
              </ul>
            }
          </section>

          <section
            class="glass flex flex-col justify-between gap-3 rounded-2xl p-4 shadow-[var(--shadow-sm)]"
          >
            <div class="flex items-start gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <lucide-icon name="file-text" [size]="16" />
              </div>
              <div class="min-w-0">
                <p
                  class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Declaraciones
                </p>
                <div class="mt-1.5">
                  @if (sel.declaraciones) {
                    <span
                      class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium"
                      [class]="veredicto().cls"
                    >
                      <lucide-icon [name]="veredicto().icon" [size]="12" />
                      {{ veredicto().label }}
                    </span>
                  } @else {
                    <span
                      class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      Sin sincronizar
                    </span>
                  }
                </div>
              </div>
            </div>
            <button
              type="button"
              [disabled]="!sel.declaraciones"
              (click)="modal.set('declaraciones')"
              class="alma-btn h-9 w-full rounded-xl border border-primary text-primary hover:bg-primary hover:text-white"
            >
              Ver cuestionario
            </button>
          </section>
        </div>

        <!-- ── Grupos de datos (inset grouped, masonry en desktop) ── -->
        @if (cargandoAfiliacion()) {
          <div
            class="glass flex items-center gap-2 rounded-xl px-4 py-3 text-xs text-muted-foreground shadow-[var(--shadow-sm)]"
          >
            <lucide-icon name="refresh-cw" [size]="14" class="animate-spin" />
            Cargando detalle de la afiliación…
          </div>
        } @else if (grupos().length > 0) {
          <div class="columns-1 gap-3 md:columns-2 xl:columns-3">
            @for (g of grupos(); track g.title) {
              <section class="mb-3 break-inside-avoid">
                <div class="mb-1.5 flex items-center gap-1.5 px-1.5">
                  <lucide-icon [name]="g.icon" [size]="14" class="text-muted-foreground" />
                  <h2
                    class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {{ g.title }}
                  </h2>
                </div>
                <div
                  class="glass divide-y divide-border/40 overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]"
                >
                  @for (f of g.filas; track $index) {
                    @if (f.full) {
                      <div class="px-4 py-2.5">
                        <p class="text-xs text-muted-foreground">{{ f.k }}</p>
                        <p
                          class="mt-0.5 break-words text-[13px] leading-snug text-foreground"
                          [class.font-semibold]="f.strong"
                          [class.font-medium]="f.danger"
                          [class.text-destructive]="f.danger"
                        >
                          {{ f.v }}
                        </p>
                      </div>
                    } @else {
                      <div class="flex items-baseline justify-between gap-4 px-4 py-2">
                        <p class="shrink-0 text-xs text-muted-foreground">{{ f.k }}</p>
                        <p
                          class="min-w-0 break-words text-right text-[13px] text-foreground"
                          [class.tabular-nums]="f.num"
                          [class.text-sm]="f.strong"
                          [class.font-semibold]="f.strong || f.danger"
                          [class.font-medium]="!f.strong && !f.danger"
                          [class.text-destructive]="f.danger"
                        >
                          {{ f.v }}
                          @if (f.copy) {
                            <span class="ml-1 inline-flex align-middle">
                              <alma-copy-button
                                [value]="f.copy"
                                [label]="f.k.toLowerCase()"
                              />
                            </span>
                          }
                        </p>
                      </div>
                    }
                  }
                </div>
              </section>
            }
          </div>
        }

        <!-- Modales -->
        @if (modal() === 'evaluar') {
          <alma-evaluar-modal
            [tarea]="sel"
            (closed)="modal.set(null)"
            (aplicado)="recargar()"
          />
        }
        @if (modal() === 'declaraciones') {
          <alma-declaraciones-dialog
            [solicitudId]="sel.tarea_id"
            [nroCotizacion]="sel.nro_cotizacion"
            (closed)="modal.set(null)"
          />
        }
        @if (modal() === 'emitir') {
          <alma-emitir-dialog
            [tarea]="sel"
            (closed)="modal.set(null)"
            (emitido)="recargar()"
          />
        }
      </div>
      </alma-simulador-host>
    }
  `,
})
export class DetalleSolicitudComponent {
  private readonly api = inject(SuscripcionApi);
  private readonly auth = inject(AuthService);

  /** Parámetro de ruta (withComponentInputBinding). */
  readonly solicitudId = input.required<string>();

  /** Clases del badge de estado de Pipeline (fallback si el código no mapea). */
  protected claseUw(uwStatus: string | null | undefined): string {
    return UW_BADGE[uwStatus ?? ''] || 'bg-muted text-muted-foreground';
  }

  /** Clases del badge de decisión del motor. */
  protected claseDecision(decision: string): string {
    return DECISION_BADGE[decision] || 'bg-muted text-muted-foreground';
  }

  protected readonly tarea = signal<Tarea | null>(null);
  protected readonly afiliacion = signal<AfiliacionDetalleApi | null>(null);
  protected readonly cargando = signal(true);
  protected readonly cargandoAfiliacion = signal(true);
  protected readonly refrescando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<null | 'evaluar' | 'declaraciones' | 'emitir'>(null);

  // Permisos finos: manage = evaluar con el motor; emit = emitir en Pharos.
  protected readonly puedeVer = computed(() =>
    this.auth.hasPermission('app.suscripcion.view'),
  );
  protected readonly puedeGestionar = computed(() =>
    this.auth.hasPermission('app.suscripcion.solicitudes.manage'),
  );
  protected readonly puedeEmitir = computed(() =>
    this.auth.hasPermission('app.suscripcion.solicitudes.emit'),
  );

  protected readonly veredicto = computed(() => {
    const d = this.tarea()?.declaraciones;
    return veredictoSalud({
      todas_negativas: d?.todas_negativas ?? null,
      covid_positivo: Boolean(d?.covid_positivo),
      retiene_por_salud: Boolean(d?.retiene_por_salud),
    });
  });

  protected readonly identidad = computed(() => {
    const t = this.tarea();
    return t ? buildIdentidad(t, this.afiliacion()) : [];
  });

  /** Grupos con al menos una fila visible (las vacías ya se filtran). */
  protected readonly grupos = computed<GrupoDef[]>(() => {
    const t = this.tarea();
    const a = this.afiliacion();
    if (!t || !a) return [];
    return buildGrupos(a, t)
      .map((g) => ({ ...g, filas: g.filas.filter((f) => f.v != null && f.v !== '') }))
      .filter((g) => g.filas.length > 0);
  });

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const dto = await this.api.getSolicitud(this.solicitudId());
      this.tarea.set(apiToTarea(dto));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
    // El detalle de afiliación no bloquea: se pinta cuando llega.
    try {
      this.afiliacion.set(await this.api.getAfiliacion(this.solicitudId()));
    } catch {
      this.afiliacion.set(null);
    } finally {
      this.cargandoAfiliacion.set(false);
    }
  }

  protected async recargar(): Promise<void> {
    this.modal.set(null);
    this.refrescando.set(true);
    try {
      const dto = await this.api.getSolicitud(this.solicitudId());
      this.tarea.set(apiToTarea(dto));
      this.afiliacion.set(await this.api.getAfiliacion(this.solicitudId()).catch(() => null));
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.refrescando.set(false);
      this.cargando.set(false);
    }
  }
}
