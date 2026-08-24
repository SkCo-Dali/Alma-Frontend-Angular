// Editor de un plan de compensación: datos generales, sus reglas y las transiciones de
// estado disponibles según en qué estado esté el plan. Único cambio respecto al
// original: el motivo del rechazo se pide en un diálogo propio en vez de un
// window.prompt() del navegador; es el mismo diálogo que ya usaba la inactivación.

import {
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ComisionesToast } from '../comisiones-toast.service';
import { CommissionPlan, CommissionRule } from './commission-plans.api';
import { CommissionRulesApi, mapApiRuleToUI } from './commission-rules.api';
import { CommissionRulesTableComponent } from './commission-rules-table.component';
import { RuleDialogComponent } from './rule-dialog.component';

/** ISO → yyyy-MM-dd, que es lo que acepta <input type="date">. */
function aInputDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

type MotivoPara = 'reject' | 'inactivate';

@Component({
  selector: 'alma-plan-editor-dialog',
  imports: [
    FormsModule,
    LucideAngularModule,
    CommissionRulesTableComponent,
    RuleDialogComponent,
  ],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid flex h-[90vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl border border-border p-4 shadow-2xl sm:p-6"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-center text-xl font-bold">Editor de Planes de Compensación</h2>

        <!-- Pestañas -->
        <div class="mt-4 grid w-full grid-cols-2 gap-1 rounded-full bg-[var(--surface-sunken)] p-1">
          <button
            type="button"
            (click)="tab.set('information')"
            class="w-full rounded-full px-4 py-2 text-xs font-medium transition-all sm:text-sm"
            [class]="
              tab() === 'information'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'
            "
          >
            Información
          </button>
          <button
            type="button"
            (click)="tab.set('history')"
            class="w-full rounded-full px-4 py-2 text-xs font-medium transition-all sm:text-sm"
            [class]="
              tab() === 'history'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'
            "
          >
            Historial
          </button>
        </div>

        @if (tab() === 'information') {
          <div class="scrollbar mt-6 flex-1 overflow-y-auto pb-4 pr-2">
            <!-- Información general -->
            <div class="flex flex-col space-y-4">
              <h3 class="border-b border-border pb-2 text-sm font-semibold text-muted-foreground">
                Información General
              </h3>
              <div class="space-y-4">
                <div>
                  <label class="text-xs font-medium sm:text-sm" for="plan-name">Nombre*</label>
                  <input
                    id="plan-name"
                    class="alma-input mt-1"
                    placeholder="Ingrese el nombre del plan"
                    [(ngModel)]="nombre"
                  />
                </div>
                <div>
                  <label class="text-xs font-medium sm:text-sm" for="plan-desc">
                    Descripción
                  </label>
                  <textarea
                    id="plan-desc"
                    class="alma-input mt-1"
                    rows="2"
                    placeholder="Ingrese la descripción del plan"
                    [(ngModel)]="descripcion"
                  ></textarea>
                </div>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-xs font-medium sm:text-sm" for="plan-start">
                      Fecha de Inicio *
                    </label>
                    <input id="plan-start" type="date" class="alma-input" [(ngModel)]="inicio" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-xs font-medium sm:text-sm" for="plan-end">
                      Fecha de Fin *
                    </label>
                    <input
                      id="plan-end"
                      type="date"
                      class="alma-input"
                      [min]="inicio"
                      [(ngModel)]="fin"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Reglas -->
            <div class="mt-6 flex flex-col">
              <div class="mb-2 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-muted-foreground">Reglas</h3>
                <button
                  type="button"
                  (click)="creandoRegla.set(true)"
                  [disabled]="cargandoReglas()"
                  class="alma-btn alma-btn-primary h-8 px-3 text-xs"
                >
                  <lucide-icon name="plus" [size]="16" class="mr-2" />
                  Crear
                </button>
              </div>

              @if (cargandoReglas()) {
                <div
                  class="flex items-center justify-center rounded-md border border-border py-8 text-sm text-muted-foreground"
                >
                  <lucide-icon name="loader-2" [size]="24" class="mr-2 animate-spin" />
                  Cargando reglas…
                </div>
              } @else if (errorReglas(); as err) {
                <div
                  class="rounded-md border border-border py-8 text-center text-sm text-destructive"
                >
                  Error al cargar reglas: {{ err }}
                </div>
              } @else if (reglas().length === 0) {
                <div
                  class="rounded-md border border-border py-8 text-center text-sm text-muted-foreground"
                >
                  No hay reglas creadas aún. Haz clic en "Crear" para agregar tu primera
                  regla.
                </div>
              } @else {
                <alma-commission-rules-table
                  [rules]="reglas()"
                  [planId]="plan().id"
                  (ruleDeleted)="cargarReglas()"
                  (ruleUpdated)="cargarReglas()"
                />
              }
            </div>
          </div>
        } @else {
          <div class="flex-1 overflow-y-auto py-8 text-center text-sm text-muted-foreground">
            Funcionalidad de historial próximamente.
          </div>
        }

        <!-- Acciones según el estado del plan -->
        <div class="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
          @switch (plan().status) {
            @case ('ready_to_approve') {
              <button
                type="button"
                (click)="publicar()"
                [disabled]="ocupado()"
                class="alma-btn alma-btn-primary rounded-xl"
              >
                {{ ocupado() ? 'Publicando…' : 'Publicar' }}
              </button>
              <button
                type="button"
                (click)="pedirMotivo('reject')"
                [disabled]="ocupado()"
                class="alma-btn rounded-xl border border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                Rechazar
              </button>
            }
            @case ('rejected') {
              <button
                type="button"
                (click)="enviarAAprobacion()"
                [disabled]="ocupado()"
                class="alma-btn rounded-xl border border-primary bg-primary/10 text-primary hover:bg-primary/20"
              >
                Listo para Aprobar
              </button>
            }
            @case ('inactive') {
              <button
                type="button"
                (click)="enviarAAprobacion()"
                [disabled]="ocupado()"
                class="alma-btn rounded-xl border border-primary bg-primary/10 text-primary hover:bg-primary/20"
              >
                Listo para Aprobar
              </button>
            }
            @case ('published') {
              <button
                type="button"
                (click)="pedirMotivo('inactivate')"
                [disabled]="ocupado()"
                class="alma-btn rounded-xl border border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                {{ ocupado() ? 'Inactivando…' : 'Inactivar' }}
              </button>
            }
            @default {
              <button
                type="button"
                (click)="guardarBorrador()"
                [disabled]="ocupado()"
                class="alma-btn rounded-xl border border-primary bg-primary/10 text-primary hover:bg-primary/20"
              >
                {{ ocupado() ? 'Guardando…' : 'Guardar como Borrador' }}
              </button>
              <button
                type="button"
                (click)="enviarAAprobacion()"
                [disabled]="ocupado()"
                class="alma-btn rounded-xl border border-primary bg-primary/10 text-primary hover:bg-primary/20"
              >
                Listo para Aprobar
              </button>
            }
          }
          <button
            type="button"
            (click)="cerrar()"
            [disabled]="ocupado()"
            class="alma-btn alma-btn-outline rounded-xl"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>

    <!-- Motivo (rechazo / inactivación) -->
    @if (motivoPara(); as destino) {
      <div
        class="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
        (click)="motivoPara.set(null)"
      >
        <div
          class="surface-solid w-full max-w-[500px] rounded-2xl border border-border p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <h2 class="text-lg font-bold">
            {{
              destino === 'reject'
                ? 'Rechazar Plan de Comisiones'
                : 'Inactivar Plan de Comisiones'
            }}
          </h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {{
              destino === 'reject'
                ? '¿Está seguro que desea rechazar este plan? Opcionalmente puede indicar el motivo.'
                : '¿Está seguro que desea inactivar este plan? Opcionalmente puede indicar el motivo.'
            }}
          </p>

          <div class="py-4">
            <label class="text-sm font-medium" for="motivo">
              {{
                destino === 'reject'
                  ? 'Motivo del rechazo (opcional)'
                  : 'Razón de inactivación (opcional)'
              }}
            </label>
            <textarea
              id="motivo"
              class="alma-input mt-2"
              rows="4"
              [disabled]="ocupado()"
              [(ngModel)]="motivo"
            ></textarea>
          </div>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              (click)="motivoPara.set(null)"
              [disabled]="ocupado()"
              class="alma-btn alma-btn-outline"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirmarMotivo(destino)"
              [disabled]="ocupado()"
              class="alma-btn bg-destructive text-white hover:bg-destructive/90"
            >
              @if (destino === 'reject') {
                {{ ocupado() ? 'Rechazando…' : 'Rechazar Plan' }}
              } @else {
                {{ ocupado() ? 'Inactivando…' : 'Inactivar Plan' }}
              }
            </button>
          </div>
        </div>
      </div>
    }

    @if (creandoRegla()) {
      <alma-rule-dialog
        mode="create"
        [planId]="plan().id"
        (closed)="creandoRegla.set(false)"
        (saved)="cargarReglas()"
      />
    }
  `,
})
export class PlanEditorDialogComponent implements OnInit {
  readonly plan = input.required<CommissionPlan>();
  readonly closed = output<void>();

  /** Las mutaciones viven en el store de la página; el diálogo solo las invoca. */
  readonly updatePlan = input.required<
    (id: string, data: Partial<CommissionPlan>) => Promise<CommissionPlan | null>
  >();
  readonly sendToApproval = input.required<(id: string) => Promise<boolean>>();
  readonly rejectPlan = input.required<(id: string, reason?: string) => Promise<boolean>>();
  readonly publishPlan = input.required<(id: string) => Promise<boolean>>();
  readonly inactivatePlan =
    input.required<(id: string, reason?: string) => Promise<boolean>>();

  private readonly rulesApi = inject(CommissionRulesApi);
  private readonly toast = inject(ComisionesToast);

  protected readonly tab = signal<'information' | 'history'>('information');
  protected readonly ocupado = signal(false);
  protected readonly creandoRegla = signal(false);
  protected readonly motivoPara = signal<MotivoPara | null>(null);
  protected motivo = '';

  protected nombre = '';
  protected descripcion = '';
  protected inicio = '';
  protected fin = '';

  protected readonly reglas = signal<CommissionRule[]>([]);
  protected readonly cargandoReglas = signal(false);
  protected readonly errorReglas = signal<string | null>(null);

  protected readonly esBorrador = computed(() => this.plan().status === 'draft');

  ngOnInit(): void {
    const p = this.plan();
    this.nombre = p.name;
    this.descripcion = p.description;
    this.inicio = aInputDate(p.startDate);
    this.fin = aInputDate(p.endDate);
    void this.cargarReglas();
  }

  protected async cargarReglas(): Promise<void> {
    this.cargandoReglas.set(true);
    this.errorReglas.set(null);
    try {
      const res = await this.rulesApi.list(this.plan().id);
      this.reglas.set(res.items.map(mapApiRuleToUI));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.errorReglas.set(msg);
      this.toast.errorGenerico('fetch', msg);
    } finally {
      this.cargandoReglas.set(false);
    }
  }

  protected async guardarBorrador(): Promise<void> {
    this.ocupado.set(true);
    try {
      const res = await this.updatePlan()(this.plan().id, {
        name: this.nombre,
        description: this.descripcion,
        startDate: this.inicio || undefined,
        endDate: this.fin || undefined,
      });
      if (res) this.closed.emit();
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async enviarAAprobacion(): Promise<void> {
    this.ocupado.set(true);
    try {
      if (await this.sendToApproval()(this.plan().id)) this.closed.emit();
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async publicar(): Promise<void> {
    this.ocupado.set(true);
    try {
      if (await this.publishPlan()(this.plan().id)) this.closed.emit();
    } finally {
      this.ocupado.set(false);
    }
  }

  protected pedirMotivo(destino: MotivoPara): void {
    this.motivo = '';
    this.motivoPara.set(destino);
  }

  protected async confirmarMotivo(destino: MotivoPara): Promise<void> {
    const razon = this.motivo.trim() || undefined;
    this.ocupado.set(true);
    try {
      const ok =
        destino === 'reject'
          ? await this.rejectPlan()(this.plan().id, razon)
          : await this.inactivatePlan()(this.plan().id, razon);
      if (ok) {
        this.motivoPara.set(null);
        this.closed.emit();
      }
    } finally {
      this.ocupado.set(false);
    }
  }

  protected cerrar(): void {
    if (this.ocupado()) return;
    this.closed.emit();
  }
}
