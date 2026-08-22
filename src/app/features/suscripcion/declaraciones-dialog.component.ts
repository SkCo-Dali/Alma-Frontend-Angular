// Cuestionario de asegurabilidad de la cotización, leído de la BD de Pharos
// (snapshot sincronizado por el worker). Paridad DeclaracionesDialog.tsx.

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { DeclaracionItemApi, DeclaracionesApi, SuscripcionApi } from './suscripcion.api';
import { veredictoSalud } from './suscripcion.domain';

const FORM_SALUD = '400500';
const FORM_MEDICO = '400100';

// Fallback para snapshots viejos SIN visibleType: la 400250 es la 2ª redacción
// de la P11 (oculta en Pharos) y 400251 su subcampo.
const OCULTOS_PHAROS = new Set(['400250', '400251']);

interface ItemVista {
  id: string;
  descripcion: string;
  /** 'si' | 'no' | 'valor' | 'vacio' */
  forma: 'si' | 'no' | 'valor' | 'vacio';
  valor: string | null;
}

interface FormularioVista {
  titulo: string;
  items: ItemVista[];
}

/**
 * Muestra el valor de una declaración. Los campos de fecha vienen como epoch en
 * milisegundos; se formatean a dd/mm/aaaa. Si el número es un centinela (fechas
 * absurdas) se trata como vacío.
 */
function formatearValor(valor: string | null): string | null {
  const v = (valor ?? '').trim();
  if (v === '') return null;
  if (/^-?\d{12,}$/.test(v)) {
    const d = new Date(Number(v));
    const anio = d.getFullYear();
    if (!Number.isNaN(d.getTime()) && anio >= 1950 && anio <= 2100) {
      return d.toLocaleDateString('es-CO');
    }
    return null; // centinela / fecha inválida
  }
  return v;
}

function aItemVista(d: DeclaracionItemApi): ItemVista {
  const v = (d.valor ?? '').trim().toLowerCase();
  let forma: ItemVista['forma'] = 'vacio';
  let valor: string | null = null;
  if (v === 'true' || v === 's' || v === 'si') forma = 'si';
  else if (v === 'false' || v === 'n' || v === 'no') forma = 'no';
  else {
    valor = formatearValor(d.valor);
    forma = valor === null ? 'vacio' : 'valor';
  }
  return {
    id: d.ddeclarationid,
    descripcion: d.descripcion ?? '',
    forma,
    valor,
  };
}

function filtrarItems(
  items: DeclaracionItemApi[],
  soloRelevantes: boolean,
): DeclaracionItemApi[] {
  return items.filter((d) => {
    if (!d.descripcion) return false;
    // Fiel a Pharos: oculta lo que Pharos oculta (visibleType=4).
    if (d.visibleType === 4) return false;
    if (d.code && OCULTOS_PHAROS.has(d.code)) return false;
    if (!soloRelevantes) return true;
    // En el form de salud se ocultan los renglones de detalle vacíos.
    const esDetalle = d.descripcion.trim().startsWith('-');
    return !esDetalle || (d.valor ?? '').trim() !== '';
  });
}

@Component({
  selector: 'alma-declaraciones-dialog',
  imports: [LucideAngularModule, AlmaLoaderComponent],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      (click)="closed.emit()"
    >
      <div
        class="surface-solid flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <!-- Header compacto -->
        <div class="flex-none border-b border-border px-5 py-3">
          <div class="flex items-center gap-3 pr-10">
            <div
              class="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
              [class]="veredicto().cls"
            >
              <lucide-icon [name]="veredicto().icon" [size]="16" />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-sm font-bold leading-tight">
                Declaraciones de asegurabilidad
              </h2>
              <p class="truncate text-xs text-muted-foreground">
                Cotización
                <strong class="text-foreground">{{ nroCotizacion() }}</strong>
                @if (fechaSync(); as f) {
                  · sincronizado {{ f }}
                }
              </p>
            </div>
            <button
              type="button"
              (click)="closed.emit()"
              class="text-muted-foreground hover:text-foreground"
              aria-label="Cerrar"
            >
              <lucide-icon name="x" [size]="18" />
            </button>
          </div>
        </div>

        @if (cargando()) {
          <div class="flex flex-1 flex-col items-center justify-center gap-3 p-10">
            <alma-loader [size]="60" />
            <p class="text-sm text-muted-foreground">Cargando cuestionario…</p>
          </div>
        } @else if (error(); as err) {
          <div
            class="m-5 rounded-xl border-2 border-dashed border-border/50 bg-muted/20 p-8 text-center text-sm text-muted-foreground"
          >
            {{ err }}
          </div>
        } @else if (data(); as d) {
          <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <!-- Veredicto + señales rápidas -->
            <div
              class="rounded-xl p-3 text-center text-sm font-semibold"
              [class]="veredicto().cls"
            >
              {{ veredicto().label }}
            </div>
            <div class="flex flex-wrap justify-center gap-2 text-[11px]">
              @if (analisis()?.covidPositivo) {
                <span
                  class="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                >
                  COVID positivo
                </span>
              }
              <span class="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                Vacunación COVID:
                {{
                  analisis()?.covidVacunado
                    ? 'Sí (' + (analisis()?.covidDosis ?? '?') + ' dosis)'
                    : 'No'
                }}
              </span>
              @if (analisis()?.peso) {
                <span class="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  Peso {{ analisis()?.peso }} kg · Estatura {{ analisis()?.estatura }} m
                </span>
              }
              @if (analisis()?.retieneContratoPorSalud) {
                <span
                  class="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive"
                >
                  Retiene contrato por declaración de salud
                </span>
              }
            </div>

            <!-- Explicación de la retención (evita la aparente contradicción
                 con "todas en No"). -->
            @if (analisis()?.retieneContratoPorSalud) {
              <div
                class="rounded-xl border border-amber-200/60 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
              >
                Pharos marca la cotización para retención/estudio por una declaración de
                salud (por ejemplo, una prueba COVID positiva). Requiere revisión del
                analista aunque el cuestionario de enfermedades esté en “No”.
              </div>
            }

            <!-- Declaraciones positivas (bloques de detalle) -->
            @if (bloques().length > 0) {
              <div class="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p
                  class="mb-2 text-xs font-semibold uppercase tracking-wider text-destructive"
                >
                  Declaraciones positivas registradas
                </p>
                <ul class="space-y-1 text-sm text-foreground">
                  @for (b of bloques(); track b.code) {
                    <li class="flex gap-2">
                      <span class="text-destructive">•</span>
                      <span>{{ b.valor }}</span>
                    </li>
                  }
                </ul>
              </div>
            }

            <!-- Formularios (datos médicos + estado del riesgo) -->
            @for (form of formularios(); track form.titulo) {
              <div
                class="overflow-hidden rounded-xl border border-border bg-[var(--table-surface)]"
              >
                <p
                  class="border-b border-border bg-[var(--table-header)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-foreground/65"
                >
                  {{ form.titulo }}
                </p>
                <ul class="divide-y divide-border/60">
                  @for (item of form.items; track item.id) {
                    <li class="flex items-center justify-between gap-3 px-3 py-1.5">
                      <span class="text-xs leading-snug text-foreground/90">
                        {{ item.descripcion }}
                      </span>
                      @switch (item.forma) {
                        @case ('si') {
                          <span
                            class="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
                          >
                            Sí
                          </span>
                        }
                        @case ('no') {
                          <span
                            class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            No
                          </span>
                        }
                        @case ('valor') {
                          <span
                            class="max-w-[180px] truncate rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"
                          >
                            {{ item.valor }}
                          </span>
                        }
                        @default {
                          <span class="text-[10px] text-muted-foreground/60">—</span>
                        }
                      }
                    </li>
                  }
                </ul>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class DeclaracionesDialogComponent {
  private readonly api = inject(SuscripcionApi);

  readonly solicitudId = input.required<string>();
  readonly nroCotizacion = input.required<string>();
  readonly closed = output<void>();

  protected readonly data = signal<DeclaracionesApi | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly analisis = computed(() => this.data()?.analisis ?? null);

  protected readonly fechaSync = computed(() => {
    const f = this.data()?.fecha;
    return f ? new Date(f).toLocaleString('es-CO') : null;
  });

  /** Veredicto COHERENTE con la bandeja: mismo helper compartido. */
  protected readonly veredicto = computed(() => {
    const a = this.analisis();
    return veredictoSalud({
      todas_negativas: a?.todasNegativas ?? null,
      covid_positivo: Boolean(a?.covidPositivo),
      retiene_por_salud: Boolean(a?.retieneContratoPorSalud),
    });
  });

  protected readonly bloques = computed(() =>
    Object.entries(this.analisis()?.bloquesDetalle ?? {}).map(([code, valor]) => ({
      code,
      valor,
    })),
  );

  protected readonly formularios = computed<FormularioVista[]>(() => {
    const forms = (this.data()?.contenido ?? []).flatMap((n) => n.formularios);
    const salida: FormularioVista[] = [];
    const medico = forms.find((f) => f.formCode === FORM_MEDICO);
    if (medico) {
      salida.push({
        titulo: medico.descripcion ?? 'Datos médicos',
        items: filtrarItems(medico.declaraciones, false).map(aItemVista),
      });
    }
    const salud = forms.find((f) => f.formCode === FORM_SALUD);
    if (salud) {
      salida.push({
        titulo: salud.descripcion ?? 'Estado del riesgo',
        items: filtrarItems(salud.declaraciones, true).map(aItemVista),
      });
    }
    return salida;
  });

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.data.set(await this.api.getDeclaraciones(this.solicitudId()));
    } catch (e) {
      this.error.set(
        e instanceof Error
          ? e.message
          : 'La solicitud aún no tiene declaraciones sincronizadas.',
      );
    } finally {
      this.cargando.set(false);
    }
  }
}
