// Tabla de reglas de un plan con panel de detalle a la derecha. El resumen de
// condiciones de cada fila se arma con un GET por regla (el listado de reglas no las
// trae) y se cachea por id mientras el diálogo vive.

import { Component, effect, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ComisionesToast } from '../comisiones-toast.service';
import { CommissionRule } from './commission-plans.api';
import {
  ApiConditionRule,
  CommissionRulesApi,
} from './commission-rules.api';
import { mapApiOperatorToShort } from './rule-form.domain';
import { RuleDialogComponent } from './rule-dialog.component';

@Component({
  selector: 'alma-commission-rules-table',
  imports: [LucideAngularModule, RuleDialogComponent],
  template: `
    @if (rules().length === 0) {
      <div class="py-8 text-center text-sm text-muted-foreground">
        No hay reglas definidas para este plan de comisiones aún.
      </div>
    } @else {
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <div
            class="scrollbar relative mb-3 overflow-x-auto rounded-xl border border-border bg-[var(--table-surface)]/50 shadow-sm"
          >
            <table class="alma-table min-w-[800px] table-fixed lg:min-w-full">
              <thead class="sticky top-0 z-10 bg-[var(--table-header)] backdrop-blur-sm">
                <tr>
                  <th class="w-12 py-3 text-center text-[11px] uppercase tracking-wide">#</th>
                  <th class="w-[200px] py-3 text-center text-[11px] uppercase tracking-wide">
                    Nombre
                  </th>
                  <th class="w-[280px] py-3 text-center text-[11px] uppercase tracking-wide">
                    Fórmula
                  </th>
                  <th class="w-[260px] py-3 text-center text-[11px] uppercase tracking-wide">
                    Condiciones
                  </th>
                  <th class="w-20 py-3 text-center text-[11px] uppercase tracking-wide">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (r of rules(); track r.id; let i = $index) {
                  <tr
                    class="group cursor-pointer transition-colors even:bg-muted/5 hover:bg-primary/5"
                    [class]="
                      seleccionada()?.id === r.id
                        ? 'bg-primary/10 ring-1 ring-inset ring-primary/30'
                        : ''
                    "
                    (click)="abrirEdicion(r)"
                  >
                    <td class="py-2.5 text-center text-xs text-muted-foreground">
                      {{ i + 1 }}
                    </td>
                    <td class="py-2.5 text-sm">
                      <div class="truncate font-medium" [title]="r.name">{{ r.name }}</div>
                    </td>
                    <td class="py-2.5">
                      <div class="flex items-center justify-center">
                        <code
                          class="inline-block max-w-[24ch] truncate rounded border border-border/50 bg-muted/80 px-2 py-1 font-mono text-xs"
                          [title]="r.formula"
                          >{{ r.formula }}</code
                        >
                      </div>
                    </td>
                    <td class="py-2.5">
                      <div class="flex items-center justify-center">
                        @if (cargando()[r.id]) {
                          <span class="flex items-center text-[10px] text-muted-foreground">
                            <lucide-icon
                              name="loader-2"
                              [size]="12"
                              class="mr-1.5 animate-spin"
                            />
                            Cargando…
                          </span>
                        } @else if (resumen(r)) {
                          <code
                            class="inline-block max-w-[24ch] truncate rounded border border-border/50 bg-muted/80 px-2 py-1 font-mono text-xs"
                            [title]="resumen(r)"
                            >{{ resumen(r) }}</code
                          >
                        } @else {
                          <span class="text-xs text-muted-foreground">—</span>
                        }
                      </div>
                    </td>
                    <td class="py-2.5 text-center">
                      <button
                        type="button"
                        (click)="pedirBorrado(r, $event)"
                        class="h-8 w-8 rounded-full transition-all hover:bg-destructive/10 sm:invisible group-hover:visible"
                        aria-label="Eliminar regla"
                      >
                        <lucide-icon name="trash-2" [size]="16" class="text-destructive" />
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Detalle -->
        <div class="mr-2 overflow-y-auto lg:col-span-1">
          <div class="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
            <h3 class="text-lg font-semibold">Detalles de la Regla</h3>
            @if (seleccionada(); as s) {
              <div class="mt-4 space-y-4 text-sm">
                <div>
                  <h4 class="mb-1 font-semibold">Información</h4>
                  <div class="space-y-2">
                    <div>
                      <span class="font-medium">Nombre:</span>
                      <p class="mt-1 text-muted-foreground">{{ s.name }}</p>
                    </div>
                    @if (s.description) {
                      <div>
                        <span class="font-medium">Descripción:</span>
                        <p class="mt-1 text-muted-foreground">{{ s.description }}</p>
                      </div>
                    }
                  </div>
                </div>

                @if (s.owner || s.dataField) {
                  <div>
                    <h4 class="mb-2 font-semibold">Detalles</h4>
                    <div class="space-y-3">
                      @if (s.owner) {
                        <div>
                          <span class="font-medium">Propietario:</span>
                          <p class="mt-1 text-muted-foreground">{{ s.owner }}</p>
                        </div>
                      }
                      @if (s.dataField) {
                        <div>
                          <span class="font-medium">Campo de Datos:</span>
                          <p class="mt-1 text-muted-foreground">{{ s.dataField }}</p>
                        </div>
                      }
                    </div>
                  </div>
                }

                <div>
                  <h4 class="mb-2 font-semibold">Fórmula</h4>
                  <code class="block break-words rounded bg-muted p-2 text-xs">{{
                    s.formula
                  }}</code>
                </div>

                <div>
                  <h4 class="mb-2 font-semibold">Condiciones</h4>
                  @if (cargando()[s.id]) {
                    <div class="flex items-center py-2 text-sm text-muted-foreground">
                      <lucide-icon name="loader-2" [size]="16" class="mr-2 animate-spin" />
                      Cargando condiciones…
                    </div>
                  } @else {
                    <code class="block break-words rounded bg-muted p-2 text-xs">{{
                      resumen(s) || 'Sin condiciones'
                    }}</code>
                  }
                </div>
              </div>
            } @else {
              <div class="py-4 text-center text-sm text-muted-foreground">
                Selecciona una regla para ver detalles
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- Confirmación de borrado -->
    @if (porBorrar(); as r) {
      <div
        class="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
        (click)="porBorrar.set(null)"
      >
        <div
          class="surface-solid w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <h2 class="text-lg font-bold">Eliminar Regla</h2>
          <p class="mt-2 text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar la regla
            <span class="font-semibold text-foreground">"{{ r.name }}"</span>? Esta acción
            no se puede deshacer.
          </p>
          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              (click)="porBorrar.set(null)"
              [disabled]="borrando()"
              class="alma-btn alma-btn-outline"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirmarBorrado()"
              [disabled]="borrando()"
              class="alma-btn bg-destructive text-white hover:bg-destructive/90"
            >
              {{ borrando() ? 'Eliminando…' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (enEdicion(); as r) {
      <alma-rule-dialog
        mode="edit"
        [planId]="planId()"
        [rule]="r"
        (closed)="enEdicion.set(null)"
        (saved)="ruleUpdated.emit()"
      />
    }
  `,
})
export class CommissionRulesTableComponent {
  readonly rules = input.required<CommissionRule[]>();
  readonly planId = input.required<string>();
  readonly ruleDeleted = output<void>();
  readonly ruleUpdated = output<void>();

  private readonly api = inject(CommissionRulesApi);
  private readonly toast = inject(ComisionesToast);

  protected readonly seleccionada = signal<CommissionRule | null>(null);
  protected readonly enEdicion = signal<CommissionRule | null>(null);
  protected readonly porBorrar = signal<CommissionRule | null>(null);
  protected readonly borrando = signal(false);

  /** Resumen textual de condiciones por regla y banderas de carga. */
  protected readonly condiciones = signal<Record<string, string>>({});
  protected readonly cargando = signal<Record<string, boolean>>({});

  constructor() {
    effect(() => {
      const lista = this.rules();
      if (lista.length > 0 && !this.seleccionada()) this.seleccionada.set(lista[0]);
      for (const r of lista) {
        if (this.condiciones()[r.id] === undefined && !this.cargando()[r.id]) {
          void this.cargarCondiciones(r.id);
        }
      }
    });
  }

  protected resumen(r: CommissionRule): string {
    return this.condiciones()[r.id] ?? r.conditions ?? '';
  }

  private async cargarCondiciones(ruleId: string): Promise<void> {
    this.cargando.update((prev) => ({ ...prev, [ruleId]: true }));
    try {
      const res = await this.api.listConditions(ruleId);
      this.condiciones.update((prev) => ({
        ...prev,
        [ruleId]: this.formatear(res.items),
      }));
    } catch (e) {
      console.error(`Error consultando las condiciones de la regla ${ruleId}:`, e);
      this.condiciones.update((prev) => ({ ...prev, [ruleId]: 'Error al cargar' }));
    } finally {
      this.cargando.update((prev) => ({ ...prev, [ruleId]: false }));
    }
  }

  /** "Campo == valor AND otro > 3" — el operador lógico va antes de la 2.ª en adelante. */
  private formatear(items: ApiConditionRule[]): string {
    if (items.length === 0) return '';
    return items
      .map((c, i) => {
        const partes: string[] = [];
        if (i > 0) partes.push(c.logical_operator || 'AND');
        partes.push(c.field_name, mapApiOperatorToShort(c.operator), c.field_value);
        return partes.join(' ');
      })
      .join(' ');
  }

  protected abrirEdicion(r: CommissionRule): void {
    this.seleccionada.set(r);
    this.enEdicion.set(r);
  }

  protected pedirBorrado(r: CommissionRule, ev: Event): void {
    ev.stopPropagation();
    this.porBorrar.set(r);
  }

  protected async confirmarBorrado(): Promise<void> {
    const r = this.porBorrar();
    if (!r) return;
    this.borrando.set(true);
    try {
      await this.api.remove(r.id);
      this.toast.ok('Regla eliminada', 'La regla se eliminó correctamente.');
      if (this.seleccionada()?.id === r.id) this.seleccionada.set(null);
      this.porBorrar.set(null);
      this.ruleDeleted.emit();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // El backend responde 409 con "dependencias" cuando la regla tiene
      // condiciones, incentivos o pagos colgando.
      if (msg.includes('dependencias') || msg.includes('dependencies')) {
        this.toast.errorGenericoConMensaje(
          'Esta regla tiene condiciones, incentivos o pagos asociados. Elimínalos primero.',
          'No se puede eliminar la regla',
        );
      } else {
        this.toast.errorGenerico('delete', msg);
      }
    } finally {
      this.borrando.set(false);
    }
  }
}
