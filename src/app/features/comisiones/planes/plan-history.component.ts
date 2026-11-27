// Historial de un plan de compensación: quién cambió qué y cuándo.
// El editor de reglas guarda cada condición por separado; los eventos del mismo
// usuario sobre la misma regla en menos de 2 minutos se muestran como uno solo.

import { Component, OnInit, inject, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CommissionPlansApi, PlanHistoryChange, PlanHistoryEvent } from './commission-plans.api';

const PAGINA = 50;
const VENTANA_MS = 2 * 60 * 1000;

interface Tarjeta {
  texto: string;
  fecha: Date;
  usuario: string;
  motivo: string | null;
  objeto: string | null;
  cambios: PlanHistoryChange[];
  tono: 'bien' | 'alerta' | 'neutro';
  deducido: boolean;
}

const TONO: Record<string, Tarjeta['tono']> = {
  create: 'bien',
  approve: 'bien',
  publish: 'bien',
  reject: 'alerta',
  inactivate: 'alerta',
  delete: 'alerta',
  rule_delete: 'alerta',
};

/** El back guarda en UTC y a veces serializa sin zona horaria. */
export function fechaUtc(valor: string): Date {
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(valor) ? valor : `${valor}Z`);
}

const esDeRegla = (e: PlanHistoryEvent) =>
  e.accion.startsWith('rule_') || e.accion.startsWith('condition_');

/** Junta los eventos seguidos de una misma edición de regla (lista de más reciente a más antiguo). */
export function agrupar(eventos: PlanHistoryEvent[]): Tarjeta[] {
  const tarjetas: Tarjeta[] = [];
  let grupo: PlanHistoryEvent[] = [];

  const cerrar = () => {
    if (!grupo.length) return;
    const primero = grupo[0];
    const acciones = new Set(grupo.map((e) => e.accion));
    const texto =
      grupo.length === 1
        ? primero.texto
        : acciones.has('rule_delete')
          ? 'Eliminó la regla'
          : acciones.has('rule_create')
            ? 'Creó la regla'
            : 'Editó la regla';
    tarjetas.push({
      texto,
      fecha: fechaUtc(primero.fecha),
      usuario: primero.usuario || primero.email || 'Sin registro de usuario',
      motivo: primero.motivo,
      objeto: primero.objeto,
      // Del más antiguo al más reciente, como se hicieron.
      cambios: [...grupo].reverse().flatMap((e) => e.cambios),
      tono: grupo.some((e) => TONO[e.accion] === 'alerta') ? 'alerta' : (TONO[primero.accion] ?? 'neutro'),
      deducido: primero.deducido,
    });
    grupo = [];
  };

  for (const e of eventos) {
    const anterior = grupo[grupo.length - 1];
    const sigue =
      anterior &&
      esDeRegla(e) &&
      esDeRegla(anterior) &&
      e.email === anterior.email &&
      e.objeto === anterior.objeto &&
      fechaUtc(anterior.fecha).getTime() - fechaUtc(e.fecha).getTime() <= VENTANA_MS;
    if (!sigue) cerrar();
    grupo.push(e);
  }
  cerrar();
  return tarjetas;
}

@Component({
  selector: 'alma-plan-history',
  imports: [LucideAngularModule],
  template: `
    <div class="scrollbar mt-6 flex-1 overflow-y-auto pb-4 pr-2">
      @if (cargando() && !eventos().length) {
        <div class="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <lucide-icon name="loader-2" [size]="24" class="mr-2 animate-spin" />
          Cargando historial…
        </div>
      } @else if (error(); as err) {
        <div class="py-8 text-center text-sm text-destructive">Error al cargar el historial: {{ err }}</div>
      } @else if (!tarjetas().length) {
        <div class="py-8 text-center text-sm text-muted-foreground">Este plan no tiene cambios registrados.</div>
      } @else {
        <ol animate.enter="nova-entra" class="relative ml-2 space-y-4 border-l border-border pl-5">
          @for (t of tarjetas(); track $index) {
            <li class="relative">
              <span
                class="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--surface-solid,white)]"
                [class]="
                  t.tono === 'bien' ? 'bg-primary' : t.tono === 'alerta' ? 'bg-destructive' : 'bg-muted-foreground'
                "
              ></span>
              <div class="rounded-xl border border-border p-3">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <p class="text-sm font-semibold">
                    {{ t.texto }}
                    @if (t.objeto) {
                      <span class="font-mono text-xs font-normal text-muted-foreground">{{ t.objeto }}</span>
                    }
                  </p>
                  <p class="text-xs text-muted-foreground">{{ formatear(t.fecha) }}</p>
                </div>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  {{ t.usuario }}
                  @if (t.deducido) {
                    · según los datos del plan
                  }
                </p>
                @if (t.motivo) {
                  <p class="mt-2 text-sm"><span class="font-medium">Motivo:</span> {{ t.motivo }}</p>
                }
                @if (t.cambios.length) {
                  <table class="mt-2 w-full table-fixed text-xs">
                    <thead>
                      <tr class="text-left text-muted-foreground">
                        <th class="w-1/5 py-1 pr-2 font-medium">Campo</th>
                        <th class="w-2/5 py-1 pr-2 font-medium">Antes</th>
                        <th class="w-2/5 py-1 font-medium">Después</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of t.cambios; track $index) {
                        <tr class="border-t border-border align-top">
                          <td class="py-1 pr-2">{{ c.campo }}</td>
                          <td class="break-words py-1 pr-2 text-muted-foreground" [class.font-mono]="c.campo === 'Fórmula'">
                            {{ c.antes ?? '—' }}
                          </td>
                          <td class="break-words py-1" [class.font-mono]="c.campo === 'Fórmula'">
                            {{ c.despues ?? '—' }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            </li>
          }
        </ol>
        @if (eventos().length < total()) {
          <div class="mt-4 text-center">
            <button
              type="button"
              (click)="cargar()"
              [disabled]="cargando()"
              class="alma-btn alma-btn-outline rounded-xl text-xs"
            >
              {{ cargando() ? 'Cargando…' : 'Ver más' }}
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class PlanHistoryComponent implements OnInit {
  readonly planId = input.required<string>();

  private readonly api = inject(CommissionPlansApi);

  protected readonly eventos = signal<PlanHistoryEvent[]>([]);
  protected readonly tarjetas = signal<Tarjeta[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  private pagina = 0;

  private readonly formato = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const res = await this.api.history(this.planId(), this.pagina + 1, PAGINA);
      this.pagina = res.page;
      this.total.set(res.total);
      this.eventos.update((prev) => [...prev, ...res.items]);
      this.tarjetas.set(agrupar(this.eventos()));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected formatear(fecha: Date): string {
    return Number.isNaN(fecha.getTime()) ? '' : this.formato.format(fecha);
  }
}
