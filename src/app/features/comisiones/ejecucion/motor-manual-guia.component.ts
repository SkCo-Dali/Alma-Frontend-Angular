// Manual de uso plegable del proceso mensual de comisiones.

import { Component, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-motor-manual-guia',
  imports: [LucideAngularModule],
  template: `
    <div class="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        (click)="abierto.set(!abierto())"
        [attr.aria-expanded]="abierto()"
        aria-controls="motor-manual-guia-contenido"
        class="flex w-full items-center justify-between bg-muted/20 p-4 transition-colors hover:bg-muted/30"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
          >
            <lucide-icon name="clipboard-list" [size]="16" />
          </div>
          <div class="text-left">
            <h3 class="text-sm font-bold">Manual de Uso</h3>
            <p class="text-xs text-muted-foreground">
              Proceso mensual de comisiones — haz clic para expandir/contraer
            </p>
          </div>
        </div>
        <lucide-icon
          name="chevron-down"
          [size]="20"
          class="text-muted-foreground transition-transform"
          [class.rotate-180]="abierto()"
        />
      </button>

      @if (abierto()) {
        <div
          id="motor-manual-guia-contenido"
          class="space-y-4 border-t border-border bg-card p-5 text-xs leading-relaxed text-muted-foreground"
        >
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-3">
              <div class="flex gap-3">
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">1</div>
                <div>
                  <strong class="text-foreground">Calcular comisiones:</strong> Ejecute el job
                  <span class="rounded bg-emerald-100 px-1 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">01</span>.
                  Revise el resultado en <em class="text-foreground">Comisiones Pre-Calculadas</em>.
                </div>
              </div>
              <div class="flex gap-3">
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">2</div>
                <div>
                  <strong class="text-foreground">Registrar ajustes y actualizar:</strong> Cree los
                  ajustes manuales en el módulo de ajustes. Luego, corra el pipeline
                  <span class="rounded bg-sky-100 px-1 font-mono text-[10px] font-bold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">00</span>.
                  Al finalizar, ejecute los jobs
                  <span class="rounded bg-emerald-100 px-1 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">02</span>,
                  <span class="rounded bg-emerald-100 px-1 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">03</span> y
                  <span class="rounded bg-emerald-100 px-1 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">04</span>
                  en orden.
                </div>
              </div>
              <div class="flex gap-3">
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">3</div>
                <div>
                  <strong class="text-foreground">Verificar comisiones y mantenimiento:</strong>
                  Revise en <em class="text-foreground">Comisiones Finales</em> y
                  <em class="text-foreground">Reporte de Mantenimiento</em>. El reporte de
                  mantenimiento solo aplica para Seguros (Fiduciaria y AFP estarán vacíos).
                </div>
              </div>
            </div>
            <div class="space-y-3">
              <div class="flex gap-3">
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">4</div>
                <div>
                  <strong class="text-foreground">Contabilidad:</strong> Ejecute el job
                  <span class="rounded bg-emerald-100 px-1 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">05</span>
                  para generar los archivos contables en el lago de datos.
                </div>
              </div>
              <div class="flex gap-3">
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">5</div>
                <div>
                  <strong class="text-foreground">Generar covers:</strong> Ejecute el job
                  <span class="rounded bg-emerald-100 px-1 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">06</span>
                  para generar los PDF de covers por asesor.
                </div>
              </div>
              <div class="flex gap-3">
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">6</div>
                <div>
                  <strong class="text-foreground">Revisar correos y enviar:</strong> Vaya a
                  <em class="text-foreground">Distribución de Correos</em>. Edite destinatarios si
                  es necesario y excluya los que no correspondan. Ejecute el job
                  <span class="rounded bg-emerald-100 px-1 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">07</span>
                  para enviar los correos.
                </div>
              </div>
            </div>
          </div>
          <div
            class="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <lucide-icon name="info" [size]="16" class="shrink-0" />
            Las 3 compañías (Seguros, Fiduciaria y AFP) corren en paralelo bajo estos jobs.
          </div>
        </div>
      }
    </div>
  `,
})
export class MotorManualGuiaComponent {
  protected readonly abierto = signal(false);
}
