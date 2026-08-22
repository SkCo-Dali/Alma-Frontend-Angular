// Métricas de uso por App de la plataforma (paridad MetricasUso.tsx).

import { Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { MetricasApi, ResumenMetricas } from '../../core/services/metricas.api';

const RANGOS = [7, 30, 90] as const;

@Component({
  selector: 'alma-metricas-uso',
  imports: [LucideAngularModule],
  template: `
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="flex items-center gap-2 text-sm font-semibold text-foreground">
            <lucide-icon name="bar-chart-3" [size]="16" class="text-primary" />
            Métricas de uso
          </h1>
          <p class="text-xs text-muted-foreground">
            Adopción y actividad por App de la plataforma.
          </p>
        </div>
        <div class="flex gap-1 rounded-lg border border-border p-1">
          @for (r of rangos; track r) {
            <button
              (click)="dias.set(r); cargar()"
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              [class]="
                dias() === r
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              "
            >
              {{ r }} días
            </button>
          }
        </div>
      </div>

      @if (cargando()) {
        <div class="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <lucide-icon name="loader-2" [size]="16" class="animate-spin" /> Calculando métricas…
        </div>
      } @else if (error(); as err) {
        <p class="py-10 text-sm text-destructive">{{ err }}</p>
      } @else if (data(); as d) {
        <div class="flex flex-col gap-5">
          <!-- KPIs -->
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            @if (d.agente; as ag) {
              <div class="rounded-lg border border-border bg-background p-4">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <lucide-icon name="message-square-text" [size]="16" class="text-primary" />
                  Agente Alma
                </div>
                <p class="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {{ ag.mensajes.toLocaleString('es-CO') }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ ag.conversaciones }} conversaciones · {{ ag.usuarios }} usuarios
                </p>
              </div>
            }
            @if (d.cheques; as ch) {
              <div class="rounded-lg border border-border bg-background p-4">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <lucide-icon name="wallet" [size]="16" class="text-primary" />
                  Cheques
                </div>
                <p class="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {{ ch.registros.toLocaleString('es-CO') }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ ch.usuarios }} usuarios registrando
                </p>
              </div>
            }
            @if (d.suscripcion; as su) {
              <div class="rounded-lg border border-border bg-background p-4">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <lucide-icon name="users" [size]="16" class="text-primary" />
                  Suscripción
                </div>
                <p class="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {{ su.evaluaciones.toLocaleString('es-CO') }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ su.solicitudes }} solicitudes nuevas
                </p>
              </div>
            }
            @if (d.accesos; as ac) {
              <div class="rounded-lg border border-border bg-background p-4">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <lucide-icon name="bar-chart-3" [size]="16" class="text-primary" />
                  Cambios de acceso
                </div>
                <p class="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {{ ac.eventos.toLocaleString('es-CO') }}
                </p>
                <p class="text-xs text-muted-foreground">movimientos en auditoría</p>
              </div>
            }
          </div>

          <!-- Serie diaria del Agente -->
          @if (d.agente && d.agente.serie.length > 0) {
            <div class="rounded-lg border border-border bg-background p-4">
              <p class="mb-3 text-xs font-medium text-muted-foreground">
                Mensajes al Agente por día
              </p>
              <div class="flex h-32 items-end gap-1">
                @for (s of d.agente.serie; track s.dia) {
                  <div
                    class="group relative flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
                    [style.height.%]="alturaBarra(s.mensajes)"
                    [title]="s.dia + ': ' + s.mensajes + ' mensajes'"
                  ></div>
                }
              </div>
              <div class="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{{ d.agente.serie[0].dia }}</span>
                <span>{{ d.agente.serie[d.agente.serie.length - 1].dia }}</span>
              </div>
            </div>
          }

          <div class="grid gap-4 lg:grid-cols-2">
            <!-- Top usuarios -->
            <div class="rounded-lg border border-border bg-background p-4">
              <p class="mb-3 text-xs font-medium text-muted-foreground">
                Quiénes más usan el Agente
              </p>
              @if (d.agente?.top_usuarios?.length) {
                <div class="flex flex-col gap-2">
                  @for (u of d.agente!.top_usuarios; track u.email) {
                    <div class="flex items-center justify-between gap-2 text-sm">
                      <span class="truncate text-foreground">{{ u.email }}</span>
                      <span class="alma-badge shrink-0 bg-[var(--surface-sunken)] font-normal">
                        {{ u.mensajes }} msjs
                      </span>
                    </div>
                  }
                </div>
              } @else {
                <p class="text-sm text-muted-foreground">Sin actividad en el rango.</p>
              }
            </div>

            <!-- Preguntas recientes -->
            <div class="rounded-lg border border-border bg-background p-4">
              <p class="mb-3 text-xs font-medium text-muted-foreground">
                Qué le preguntan al Agente (recientes)
              </p>
              <div class="max-h-64 overflow-y-auto">
                <table class="alma-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Pregunta</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of d.preguntas_recientes; track $index) {
                      <tr>
                        <td class="whitespace-nowrap align-top text-xs">
                          {{ p.email }}
                          <div class="text-[10px] text-muted-foreground">{{ p.fecha }}</div>
                        </td>
                        <td class="text-xs">{{ p.contenido }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class MetricasUsoComponent {
  private readonly api = inject(MetricasApi);

  protected readonly rangos = RANGOS;
  protected readonly dias = signal<number>(30);
  protected readonly data = signal<ResumenMetricas | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly maxSerie = computed(() =>
    Math.max(1, ...(this.data()?.agente?.serie ?? []).map((s) => s.mensajes)),
  );

  constructor() {
    void this.cargar();
  }

  protected alturaBarra(mensajes: number): number {
    return Math.max(4, (mensajes / this.maxSerie()) * 100);
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.data.set(await this.api.obtenerResumen(this.dias()));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
