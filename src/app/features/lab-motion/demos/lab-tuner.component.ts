// Panel para ajustar en vivo los tres springs de Nova. Todo el laboratorio se
// mueve con estos valores, así se puede decidir el «carácter» de la marca
// viendo el resultado en cada demo.

import { Component, ElementRef, computed, inject, viewChildren } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { PressDirective } from '../motion/press.directive';
import { MotionTuningService } from '../motion/motion-tuning.service';
import { SpringName, animateSpring, springCurve, springSamples } from '../motion/spring';

const INFO: Record<SpringName, { titulo: string; uso: string }> = {
  snappy: { titulo: 'Snappy', uso: 'Botones, switches, press' },
  smooth: { titulo: 'Smooth', uso: 'Sheets, diálogos, páginas' },
  bouncy: { titulo: 'Bouncy', uso: 'Isla, avisos, confirmaciones' },
};

@Component({
  selector: 'nova-lab-tuner',
  imports: [PressDirective, DecimalPipe],
  template: `
    <div class="grid gap-3 md:grid-cols-3">
      @for (f of filas(); track f.nombre) {
        <div class="rounded-[18px] bg-background p-4">
          <div class="flex items-baseline justify-between">
            <span class="font-semibold">{{ f.info.titulo }}</span>
            <span class="text-xs tabular-nums text-muted-foreground">{{ f.duracion }} ms</span>
          </div>
          <div class="text-xs text-muted-foreground">{{ f.info.uso }}</div>

          <svg viewBox="0 0 200 90" class="my-3 h-[90px] w-full overflow-visible" aria-hidden="true">
            <line x1="0" y1="25" x2="200" y2="25" class="stroke-foreground/15" stroke-dasharray="3 3" />
            <line x1="0" y1="80" x2="200" y2="80" class="stroke-foreground/15" />
            <path [attr.d]="f.path" fill="none" class="stroke-primary" stroke-width="2.5" stroke-linecap="round" />
          </svg>

          <!-- Pista de prueba -->
          <div class="relative mb-3 h-8 rounded-full bg-foreground/[0.06]">
            <div #bola class="absolute left-1 top-1 size-6 rounded-full bg-primary shadow"></div>
          </div>

          <label class="mb-2 block text-xs">
            <span class="flex justify-between"
              ><span>Respuesta</span><span class="tabular-nums">{{ f.params.response | number: '1.2-2' }} s</span></span
            >
            <input
              type="range"
              min="0.15"
              max="1.2"
              step="0.01"
              class="w-full accent-[var(--primary)]"
              [value]="f.params.response"
              (input)="tuning.ajustar(f.nombre, { response: +$any($event.target).value })"
            />
          </label>
          <label class="mb-3 block text-xs">
            <span class="flex justify-between"
              ><span>Rebote</span><span class="tabular-nums">{{ f.params.bounce | number: '1.2-2' }}</span></span
            >
            <input
              type="range"
              min="0"
              max="0.6"
              step="0.01"
              class="w-full accent-[var(--primary)]"
              [value]="f.params.bounce"
              (input)="tuning.ajustar(f.nombre, { bounce: +$any($event.target).value })"
            />
          </label>
          <button
            novaPress
            type="button"
            class="h-8 w-full rounded-full bg-secondary text-sm font-medium text-secondary-foreground"
            (click)="probar($index, f.nombre)"
          >
            Probar
          </button>
        </div>
      }
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <span class="text-muted-foreground">Velocidad del laboratorio</span>
      @for (v of [1, 2, 4]; track v) {
        <button
          novaPress
          type="button"
          class="h-8 rounded-full px-3 font-medium transition-colors"
          [class]="tuning.lentitud() === v ? 'bg-foreground text-background' : 'bg-secondary text-secondary-foreground'"
          (click)="tuning.lentitud.set(v)"
        >
          {{ v === 1 ? 'Normal' : 'Lenta ×' + v }}
        </button>
      }
      <button
        novaPress
        type="button"
        class="ml-auto h-8 rounded-full px-3 font-medium text-primary hover:bg-secondary"
        (click)="tuning.restablecer()"
      >
        Restablecer
      </button>
    </div>
  `,
})
export class LabTunerComponent {
  protected readonly tuning = inject(MotionTuningService);
  private readonly bolas = viewChildren<ElementRef<HTMLElement>>('bola');
  private readonly ida: boolean[] = [];

  protected readonly filas = computed(() => {
    this.tuning.lentitud();
    const springs = this.tuning.springs();
    return (Object.keys(INFO) as SpringName[]).map((nombre) => {
      const params = springs[nombre];
      const muestras = springSamples(params);
      const path = muestras
        .map((m, i) => `${i ? 'L' : 'M'}${(m.t * 200).toFixed(1)} ${(80 - m.x * 55).toFixed(1)}`)
        .join(' ');
      return {
        nombre,
        info: INFO[nombre],
        params,
        path,
        duracion: springCurve(this.tuning.spring(nombre)).duration,
      };
    });
  });

  protected probar(i: number, nombre: SpringName): void {
    const bola = this.bolas()[i]?.nativeElement;
    const pista = bola?.parentElement;
    if (!bola || !pista) return;
    this.ida[i] = !this.ida[i];
    const x = this.ida[i] ? pista.clientWidth - bola.offsetWidth - 8 : 0;
    animateSpring(bola, [{ transform: `translateX(${x}px)` }], this.tuning.spring(nombre));
  }
}
