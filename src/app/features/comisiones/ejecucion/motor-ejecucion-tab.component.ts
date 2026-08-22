// Pestaña "Ejecución del Motor": manual, contadores de estado y la lista de
// procesos (el pipeline de ingesta 00 + los jobs de Databricks) con su avance.
// Paridad MotorEjecucionTab.tsx.

import { Component, computed, inject, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AdfPhase, EjecucionMotorStore, JobPhase } from './ejecucion-motor.store';
import { MotorManualGuiaComponent } from './motor-manual-guia.component';

/** Chip de estado por fase del job. */
const BADGE_JOB: Record<JobPhase, { cls: string; text: string }> = {
  idle: { cls: 'bg-muted text-muted-foreground', text: 'Listo' },
  pending: {
    cls: 'bg-amber-100 text-amber-800 animate-pulse dark:bg-amber-500/15 dark:text-amber-300',
    text: 'Encendiendo cluster',
  },
  running: {
    cls: 'bg-sky-100 text-sky-800 animate-pulse dark:bg-sky-500/15 dark:text-sky-300',
    text: 'Ejecutando',
  },
  terminating: {
    cls: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
    text: 'Finalizando',
  },
  success: {
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    text: 'Completo',
  },
  canceled: {
    cls: 'bg-amber-100 text-amber-800 border border-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300',
    text: 'Cancelado',
  },
  error: {
    cls: 'bg-destructive/10 text-destructive cursor-pointer hover:bg-destructive/20',
    text: 'Error — ver detalle',
  },
};

const BADGE_ADF: Record<AdfPhase, { cls: string; text: string }> = {
  idle: { cls: 'bg-muted text-muted-foreground', text: 'Listo' },
  triggered: {
    cls: 'bg-sky-100 text-sky-800 animate-pulse dark:bg-sky-500/15 dark:text-sky-300',
    text: 'Pipeline activo',
  },
  waiting_email: {
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    text: 'Esperando correo',
  },
  check_email: {
    cls: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
    text: 'Revisa tu correo',
  },
  success: {
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    text: 'Completo',
  },
  error: {
    cls: 'bg-destructive/10 text-destructive cursor-pointer hover:bg-destructive/20',
    text: 'Error',
  },
};

const TEXTO_ADF: Record<AdfPhase, string> = {
  idle: '',
  triggered: 'Pipeline activo…',
  waiting_email: 'Esperando correo…',
  check_email: 'Revisa tu correo…',
  success: 'Finalizado',
  error: 'Error al disparar pipeline',
};

@Component({
  selector: 'alma-motor-ejecucion-tab',
  imports: [LucideAngularModule, MotorManualGuiaComponent],
  template: `
    <div class="space-y-6">
      <alma-motor-manual-guia />

      @if (store.restoring() || store.hayActivos()) {
        <div
          class="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
        >
          <lucide-icon name="refresh-cw" [size]="16" class="shrink-0 animate-spin" />
          <span>Consultando estado de ejecuciones activas…</span>
        </div>
      }

      <!-- Contadores -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        @for (s of contadores(); track s.label) {
          <div class="flex items-center gap-3 rounded-xl border border-border bg-muted/10 p-4">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" [class]="s.dot"></span>
            <div>
              <div class="text-xl font-bold leading-none">{{ s.count }}</div>
              <div class="mt-1 text-[11px] text-muted-foreground">{{ s.label }}</div>
            </div>
          </div>
        }
      </div>

      <!-- Procesos -->
      <div class="overflow-hidden rounded-xl border border-border shadow-sm">
        <table class="alma-table w-full">
          <thead class="bg-muted/30">
            <tr>
              <th class="w-[45%] px-4 py-2 text-left text-[11px] uppercase tracking-wider">Proceso</th>
              <th class="w-[20%] px-4 py-2 text-left text-[11px] uppercase tracking-wider">Estado</th>
              <th class="w-[25%] px-4 py-2 text-left text-[11px] uppercase tracking-wider">
                Progreso / Duración
              </th>
              <th class="w-[10%] px-4 py-2 text-center text-[11px] uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Pipeline de ingesta (ADF) -->
            <tr class="hover:bg-muted/10">
              <td class="px-4 py-2">
                <div class="flex items-start gap-3">
                  <span
                    class="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                  >
                    00
                  </span>
                  <div>
                    <h4 class="text-xs font-semibold">Ingesta - Ajustes y Parametrización</h4>
                    <p class="mt-0.5 text-[10px] leading-normal text-muted-foreground">
                      Copia las tablas fuente de SQL Server al Unity Catalog de Databricks vía ADF
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-2">
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  [class]="badgeAdf().cls"
                  (click)="store.adfPhase() === 'error' && verError.emit('adf')"
                >
                  {{ badgeAdf().text }}
                </span>
              </td>
              <td class="px-4 py-2">
                <div class="space-y-1">
                  <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div class="h-full rounded-full transition-all duration-500" [class]="barraAdf()"></div>
                  </div>
                  <div class="text-[10px] text-muted-foreground">{{ textoAdf() }}</div>
                </div>
              </td>
              <td class="px-4 py-2 text-center">
                <button
                  type="button"
                  (click)="confirmar.emit('adf')"
                  [disabled]="adfCorriendo()"
                  class="h-8 w-8 rounded-lg bg-primary text-white hover:bg-[var(--primary-hover)] disabled:opacity-30"
                  aria-label="Ejecutar pipeline de ingesta"
                >
                  <lucide-icon name="play" [size]="14" />
                </button>
              </td>
            </tr>

            <!-- Jobs de Databricks -->
            @for (j of store.jobs(); track j.job_id) {
              @let s = store.estadoDe(j.job_id);
              <tr class="hover:bg-muted/10">
                <td class="px-4 py-2">
                  <div class="flex items-start gap-3">
                    <span
                      class="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
                      [class]="
                        s.phase === 'canceled'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                      "
                    >
                      {{ orden(j.orden) }}
                    </span>
                    <div>
                      <h4 class="text-xs font-semibold">{{ j.nombre }}</h4>
                      <p class="mt-0.5 text-[10px] leading-normal text-muted-foreground">
                        {{ j.descripcion }}
                      </p>
                      @if (s.runId && j.url_databricks) {
                        <a
                          [href]="j.url_databricks + '/run/' + s.runId"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="mt-1 inline-flex items-center gap-0.5 text-[9px] text-sky-600 hover:underline dark:text-sky-400"
                        >
                          Run #{{ s.runId }} ↗
                        </a>
                      }
                    </div>
                  </div>
                </td>
                <td class="px-4 py-2">
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    [class]="badgeJob(s.phase).cls"
                    (click)="s.phase === 'error' && verError.emit(j.job_id)"
                  >
                    {{ badgeJob(s.phase).text }}
                  </span>
                </td>
                <td class="px-4 py-2">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          class="h-full rounded-full transition-all duration-500"
                          [class]="
                            s.phase === 'error'
                              ? 'bg-destructive'
                              : s.phase === 'canceled'
                                ? 'bg-amber-500'
                                : 'bg-primary'
                          "
                          [style.width.%]="s.phase === 'error' ? 100 : s.progress"
                        ></div>
                      </div>
                      <span
                        class="w-8 text-right text-[10px] font-bold"
                        [class]="
                          s.phase === 'canceled' ? 'text-amber-700' : 'text-muted-foreground'
                        "
                      >
                        {{ porcentaje(s.phase, s.progress) }}
                      </span>
                    </div>
                    <div
                      class="text-[10px]"
                      [class]="
                        s.phase === 'canceled' ? 'text-amber-700/80' : 'text-muted-foreground'
                      "
                    >
                      {{ duracion(s.phase, s.elapsedText) }}
                    </div>
                  </div>
                </td>
                <td class="px-4 py-2">
                  <div class="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      (click)="confirmar.emit(j.job_id)"
                      [disabled]="corriendo(s.phase)"
                      class="h-8 w-8 rounded-lg bg-primary text-white hover:bg-[var(--primary-hover)] disabled:opacity-30"
                      aria-label="Ejecutar job"
                    >
                      <lucide-icon name="play" [size]="14" />
                    </button>
                    <button
                      type="button"
                      (click)="store.cancelarJob(j.job_id)"
                      [disabled]="!corriendo(s.phase) || s.phase === 'terminating'"
                      class="h-8 w-8 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-30"
                      aria-label="Cancelar job"
                    >
                      <lucide-icon name="square" [size]="14" />
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class MotorEjecucionTabComponent {
  protected readonly store = inject(EjecucionMotorStore);

  readonly confirmar = output<number | 'adf'>();
  readonly verError = output<number | 'adf'>();

  protected readonly contadores = computed(() => {
    const s = this.store.stats();
    return [
      { label: 'En espera', count: s.idle, dot: 'bg-muted-foreground/40' },
      { label: 'En ejecución', count: s.running, dot: 'bg-sky-500 animate-pulse' },
      { label: 'Completados', count: s.success, dot: 'bg-primary' },
      { label: 'Con error', count: s.error, dot: 'bg-destructive' },
    ];
  });

  protected readonly adfCorriendo = computed(() =>
    ['triggered', 'waiting_email', 'check_email'].includes(this.store.adfPhase()),
  );

  protected readonly badgeAdf = computed(() => BADGE_ADF[this.store.adfPhase()]);
  protected readonly textoAdf = computed(() => TEXTO_ADF[this.store.adfPhase()]);

  protected readonly barraAdf = computed(() => {
    const p = this.store.adfPhase();
    if (['triggered', 'waiting_email', 'check_email'].includes(p)) {
      return 'w-full animate-pulse bg-gradient-to-r from-sky-500 to-sky-300';
    }
    if (p === 'success') return 'w-full bg-primary';
    if (p === 'error') return 'w-full bg-destructive';
    return 'w-0 bg-muted-foreground/30';
  });

  protected badgeJob(phase: JobPhase): { cls: string; text: string } {
    return BADGE_JOB[phase];
  }

  protected corriendo(phase: JobPhase): boolean {
    return ['pending', 'running', 'terminating'].includes(phase);
  }

  protected orden(n: number): string {
    return String(n).padStart(2, '0');
  }

  protected porcentaje(phase: JobPhase, progress: number): string {
    if (progress > 0 && phase !== 'error' && phase !== 'canceled') {
      return `${Math.round(progress)}%`;
    }
    return '';
  }

  protected duracion(phase: JobPhase, elapsed: string): string {
    if (phase !== 'canceled') return elapsed;
    return elapsed ? `${elapsed} · Cancelado` : 'Ejecución cancelada';
  }
}
