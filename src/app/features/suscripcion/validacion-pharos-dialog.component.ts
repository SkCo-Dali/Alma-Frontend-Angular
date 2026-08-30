// "Validación Pharos": el apartado que pidió Control y Emisión (chat UW+,
// ago-2026) para validar la cotización tal como quedó creada en Pharos sin
// abrir el core — terceros (tomador/asegurado/beneficiarios con %/nivel/
// parentesco/pagador/agente), las declaraciones del producto (Meta de Ahorro,
// Prima Pactada, Contrato Ulla, Incremento %…), CertifiAportes y las fechas
// del nodo (vigencia, impuesto, tasa de cambio). Todo sale del blob del nodo
// que el bridge lee en vivo de la BD de Pharos.

import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { DeclaracionItemApi, DeclaracionesApi, SuscripcionApi, TerceroApi } from './suscripcion.api';

interface FilaValor {
  etiqueta: string;
  valor: string;
}

/**
 * Ajustes de presentación por declaración (ddeclarationid): etiqueta limpia,
 * traducción de códigos a texto de negocio (como los pinta la UI de Pharos) y
 * campos que se ocultan por redundantes. Complementa la calibración del bridge.
 */
const AJUSTES: Record<
  string,
  { label?: string; map?: Record<string, string>; ocultar?: boolean }
> = {
  // Sexo llega como código; Pharos muestra el texto.
  '34644484742353': { label: 'Sexo', map: { '1': 'Femenino', '2': 'Masculino' } },
  '325883419086948': {
    label: 'Tipo de Prestación',
    map: { PU: 'Pago único', RT: 'Renta temporal' },
  },
  '34644545785465': { label: 'Incremento Automático', map: { OTRO: 'Otro Valor' } },
  // Código del catálogo de profesión: el NOMBRE ya se muestra en la línea de
  // identidad del detalle; el código crudo aquí solo confunde.
  '34644468682781': { ocultar: true },
};

/** Orden de la pestaña "Declaraciones" de la UI de Pharos (los demás, después). */
const ORDEN_PHAROS = [
  '34644468682760', // Meta de Ahorro
  '34644468682799', // Tiempo de Ahorro en años
  '34644468682878', // Prima Pactada
  '34644468682858', // Fecha de Nacimiento
  '34644468682819', // Edad Inicial
  '34644484742353', // Sexo
  '34644545785991', // Edad Alcanzada
  '34644545785465', // Incremento Automático
  '34644545785646', // Incremento %
  '34644522206874', // Iniciativas
  '34644557933531', // Contrato Ulla
  '325099075363127', // Contingencia
  '34644945033197', // Cambio OMPEV Sep 2020
  '34644557933286', // Extraprima Reaseguro
  '34644862182384', // Excluye Contingencia COVID 2
  '34644957204315', // Indemnizaciones últimos 2 años
  '325883419086948', // Tipo de Prestación
];

/** Números del blob ('1.62E8', '360000.0') → formato es-CO ('162.000.000'). */
function numeroLegible(v: string): string | null {
  // Con cero a la izquierda es un CÓDIGO (Contrato Ulla '000686328'), no un número.
  if (/^0\d/.test(v)) return null;
  if (!/^-?\d+(\.\d+)?(E[+-]?\d+)?$/i.test(v)) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

/** Epoch ms → dd/mm/aaaa; centinelas (fechas absurdas) → null; S/N → Sí/No. */
function valorLegible(valor: string | null): string | null {
  const v = (valor ?? '').trim();
  if (v === '') return null;
  const low = v.toLowerCase();
  if (low === 'true' || low === 's' || low === 'si') return 'Sí';
  if (low === 'false' || low === 'n' || low === 'no') return 'No';
  if (/^-?\d{12,}$/.test(v)) {
    const d = new Date(Number(v));
    const anio = d.getFullYear();
    if (!Number.isNaN(d.getTime()) && anio >= 1950 && anio <= 2100) {
      return d.toLocaleDateString('es-CO');
    }
    return null;
  }
  return numeroLegible(v) ?? v;
}

function dia(iso: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

@Component({
  selector: 'alma-validacion-pharos-dialog',
  imports: [LucideAngularModule, AlmaLoaderComponent],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      (click)="closed.emit()"
    >
      <div
        class="surface-solid flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-border shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3">
          <div class="flex items-center gap-2">
            <lucide-icon name="shield-check" [size]="18" class="text-primary" />
            <div>
              <h2 class="text-base font-bold leading-tight">Validación Pharos</h2>
              <p class="text-xs text-muted-foreground">
                Cotización {{ nroCotizacion() }} tal como está en el core
              </p>
            </div>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            class="alma-btn alma-btn-outline h-8 w-8 rounded-xl p-0"
            aria-label="Cerrar"
          >
            <lucide-icon name="x" [size]="16" />
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          @if (cargando()) {
            <div class="flex flex-col items-center gap-3 p-10">
              <alma-loader [size]="70" />
              <p class="text-sm text-muted-foreground">Leyendo el nodo en Pharos…</p>
            </div>
          } @else if (error()) {
            <p class="rounded-xl bg-destructive/10 p-3 text-center text-sm text-destructive">
              {{ error() }}
            </p>
          } @else {
            <!-- Fechas del nodo -->
            @if (fechasNodo().length > 0) {
              <h3 class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Nodo
              </h3>
              <div class="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                @for (f of fechasNodo(); track f.etiqueta) {
                  <div class="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                    <p class="text-[10px] text-muted-foreground">{{ f.etiqueta }}</p>
                    <p class="text-[13px] font-medium tabular-nums text-foreground">
                      {{ f.valor }}
                    </p>
                  </div>
                }
              </div>
            }

            <!-- Terceros -->
            <h3
              class="mt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Terceros
            </h3>
            @if (terceros().length === 0) {
              <p class="mt-1.5 text-xs text-muted-foreground">
                El nodo no trae terceros (bridge sin actualizar o snapshot antiguo).
              </p>
            } @else {
              <div class="mt-1.5 overflow-hidden rounded-xl border border-border/50">
                <table class="w-full text-xs">
                  <thead class="bg-muted/30 text-left text-muted-foreground">
                    <tr>
                      <th class="px-3 py-1.5 font-medium">Rol</th>
                      <th class="px-3 py-1.5 font-medium">Nombre</th>
                      <th class="px-3 py-1.5 text-right font-medium">%</th>
                      <th class="px-3 py-1.5 text-right font-medium">Nivel</th>
                      <th class="px-3 py-1.5 font-medium">Parentesco</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border/40">
                    @for (t of terceros(); track $index) {
                      <tr>
                        <td class="px-3 py-1.5 font-medium text-foreground">{{ t.tipo }}</td>
                        <td class="px-3 py-1.5 text-foreground/90">{{ t.nombre ?? '—' }}</td>
                        <td class="px-3 py-1.5 text-right tabular-nums">
                          {{ t.porcentaje != null ? t.porcentaje + '%' : '—' }}
                        </td>
                        <td class="px-3 py-1.5 text-right tabular-nums">{{ t.nivel }}</td>
                        <td class="px-3 py-1.5">{{ t.parentesco ?? '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- Declaraciones del producto (raíz) -->
            @if (declaracionesProducto().length > 0) {
              <h3
                class="mt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Declaraciones del producto
              </h3>
              <div class="mt-1.5 divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50">
                @for (f of declaracionesProducto(); track $index) {
                  <div class="flex items-baseline justify-between gap-4 px-3 py-1.5">
                    <p class="text-xs text-muted-foreground">{{ f.etiqueta }}</p>
                    <p class="min-w-0 break-words text-right text-[13px] font-medium tabular-nums text-foreground">
                      {{ f.valor }}
                    </p>
                  </div>
                }
              </div>
              @if (sinEtiqueta() > 0) {
                <p class="mt-1 px-1 text-[11px] text-muted-foreground">
                  +{{ sinEtiqueta() }} campo(s) técnicos del producto sin etiqueta de
                  negocio (ids internos de Pharos, no se muestran).
                </p>
              }
            }

            <!-- CertifiAportes -->
            @if (certifiAportes().length > 0) {
              <h3
                class="mt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                CertifiAportes
              </h3>
              <div class="mt-1.5 divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50">
                @for (f of certifiAportes(); track $index) {
                  <div class="flex items-baseline justify-between gap-4 px-3 py-1.5">
                    <p class="min-w-0 text-xs leading-snug text-muted-foreground">
                      {{ f.etiqueta }}
                    </p>
                    <p class="shrink-0 text-right text-[13px] font-medium text-foreground">
                      {{ f.valor }}
                    </p>
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class ValidacionPharosDialogComponent {
  private readonly api = inject(SuscripcionApi);

  readonly solicitudId = input.required<string>();
  readonly nroCotizacion = input<string>('');
  readonly closed = output<void>();

  protected readonly data = signal<DeclaracionesApi | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  private nodo() {
    return (this.data()?.contenido ?? [])[0] ?? null;
  }

  protected readonly terceros = computed<TerceroApi[]>(() => {
    const ts = this.nodo()?.terceros ?? [];
    // Roles de sistema (visibleType>=3 sin nombre) no aportan a la validación.
    return ts.filter((t) => t.nombre || (t.visibleType ?? 1) < 3);
  });

  protected readonly fechasNodo = computed<FilaValor[]>(() => {
    const nodos = this.data()?.pharos?.nodos ?? [];
    const n = nodos[0] as Record<string, unknown> | undefined;
    if (!n) return [];
    const filas: FilaValor[] = [];
    const agregar = (etiqueta: string, v: unknown) => {
      const d = dia(v);
      if (d) filas.push({ etiqueta, valor: d });
    };
    agregar('Vigencia desde', n['START_DATE']);
    agregar('Vigencia hasta', n['END_DATE']);
    agregar('Fecha impuesto', n['TAX_DATE']);
    agregar('Fecha tasa cambio', n['XCG_DATE']);
    return filas;
  });

  private filasDe(items: DeclaracionItemApi[]): FilaValor[] {
    return items
      .filter((d) => d.visibleType !== 4 && !AJUSTES[d.ddeclarationid]?.ocultar)
      .map((d) => {
        const aj = AJUSTES[d.ddeclarationid];
        const crudo = (d.valor ?? '').trim();
        const valor = aj?.map?.[crudo] ?? valorLegible(d.valor) ?? '';
        return {
          etiqueta: aj?.label ?? d.descripcion ?? `Declaración ${d.ddeclarationid}`,
          valor,
        };
      })
      .filter((f) => f.valor !== '');
  }

  // Solo las declaraciones CALIBRADAS (con etiqueta de negocio), en el orden
  // de la pestaña Declaraciones de Pharos. Las no mapeadas son ids internos y
  // mostrarlas como "Declaración 346..." confunde más de lo que aporta: van
  // en un contador.
  protected readonly declaracionesProducto = computed<FilaValor[]>(() => {
    const raiz = (this.nodo()?.declaracionesRaiz ?? [])
      .filter((d) => d.descripcion != null)
      .slice()
      .sort((a, b) => {
        const ia = ORDEN_PHAROS.indexOf(a.ddeclarationid);
        const ib = ORDEN_PHAROS.indexOf(b.ddeclarationid);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    return this.filasDe(raiz);
  });

  protected readonly sinEtiqueta = computed<number>(
    () =>
      (this.nodo()?.declaracionesRaiz ?? []).filter(
        (d) =>
          d.descripcion == null &&
          d.visibleType !== 4 &&
          (valorLegible(d.valor) ?? '') !== '',
      ).length,
  );

  protected readonly certifiAportes = computed<FilaValor[]>(() => {
    const forms = this.nodo()?.formularios ?? [];
    const cert = forms.find(
      (f) =>
        (f.descripcion ?? '').toLowerCase().includes('certifiaportes') ||
        f.formCode === '500250',
    );
    return cert ? this.filasDe(cert.declaraciones) : [];
  });

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
      this.data.set(await this.api.getDeclaraciones(id));
    } catch (e) {
      this.error.set(
        'No fue posible leer la cotización en Pharos. ' +
          (e instanceof Error ? e.message : ''),
      );
    } finally {
      this.cargando.set(false);
    }
  }
}
