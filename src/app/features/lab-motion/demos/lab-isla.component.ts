// La isla de Nova con morph de forma por spring (estilo Dynamic Island).
//
// La pastilla NO se desvanece para ser reemplazada: cambia de ancho, alto y
// radio con el spring «bouncy», y el contenido nuevo entra con un desenfoque
// breve cuando la forma ya casi llegó. Es la base para la isla real del header
// (shared/components/isla.component.ts).

import { Component, computed, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PressDirective } from '../motion/press.directive';

type EstadoIsla = 'reposo' | 'actividad' | 'aviso' | 'expandida';

const FORMAS: Record<EstadoIsla, { w: number; h: number; r: number }> = {
  reposo: { w: 210, h: 40, r: 20 },
  actividad: { w: 320, h: 40, r: 20 },
  aviso: { w: 360, h: 72, r: 28 },
  expandida: { w: 400, h: 210, r: 36 },
};

@Component({
  selector: 'nova-lab-isla',
  imports: [LucideAngularModule, PressDirective],
  styles: `
    .isla {
      transition-property: width, height, border-radius;
      transition-duration: var(--spring-bouncy-dur);
      transition-timing-function: var(--spring-bouncy);
    }
    .contenido {
      animation: entra 0.32s ease-out 0.08s both;
    }
    @keyframes entra {
      from {
        opacity: 0;
        transform: scale(0.94);
        filter: blur(4px);
      }
    }
    .orbe {
      background: radial-gradient(circle at 35% 30%, #b8ffe8, #2fe08a 45%, #00a63e 80%);
      box-shadow: 0 0 12px #2fe08a99;
    }
    .gira {
      animation: gira 1s linear infinite;
    }
    @keyframes gira {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  template: `
    <div class="flex flex-col items-center gap-5">
      <div class="grid h-[230px] w-full place-items-start justify-center pt-2">
        <button
          type="button"
          class="isla relative overflow-hidden bg-[#0b0b0c] text-white shadow-[0_10px_30px_-10px_rgb(0_0_0/0.6)]"
          [style.width.px]="forma().w"
          [style.height.px]="forma().h"
          [style.border-radius.px]="forma().r"
          [attr.aria-expanded]="estado() === 'expandida'"
          (click)="alternar()"
        >
          @switch (estado()) {
            @case ('reposo') {
              <span class="contenido absolute inset-0 flex items-center gap-2.5 px-3">
                <span class="orbe size-5 rounded-full"></span>
                <span class="text-[13px] font-medium text-white/90">Pregúntale a Nova</span>
              </span>
            }
            @case ('actividad') {
              <span class="contenido absolute inset-0 flex items-center gap-2.5 px-3">
                <svg class="gira size-5" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="#ffffff30" stroke-width="2.5" />
                  <path d="M10 2a8 8 0 0 1 8 8" stroke="#30d158" stroke-width="2.5" stroke-linecap="round" />
                </svg>
                <span class="flex-1 text-left text-[13px] font-medium">Liquidando comisiones</span>
                <span class="text-[13px] font-semibold tabular-nums text-[#30d158]">64%</span>
              </span>
            }
            @case ('aviso') {
              <span class="contenido absolute inset-0 flex items-center gap-3 px-4">
                <span class="grid size-10 shrink-0 place-items-center rounded-full bg-[#30d158] text-black">
                  <lucide-icon name="check" [size]="22" />
                </span>
                <span class="text-left">
                  <span class="block text-[14px] font-semibold">Liquidación lista</span>
                  <span class="block text-[12px] text-white/60">1.284 registros · hace un momento</span>
                </span>
              </span>
            }
            @case ('expandida') {
              <span class="contenido absolute inset-0 flex flex-col gap-3 p-5 text-left">
                <span class="flex items-center gap-2.5">
                  <span class="orbe size-7 rounded-full"></span>
                  <span class="text-[15px] font-semibold">Nova</span>
                </span>
                <span class="text-[13px] text-white/70">¡Hola! ¿Qué movemos hoy?</span>
                <span class="mt-auto flex flex-wrap gap-2">
                  @for (s of sugerencias; track s) {
                    <span class="rounded-full bg-white/10 px-3 py-1.5 text-[12px]">{{ s }}</span>
                  }
                </span>
              </span>
            }
          }
        </button>
      </div>

      <div class="flex flex-wrap justify-center gap-2">
        @for (e of estados; track e.id) {
          <button
            novaPress
            type="button"
            class="h-9 rounded-full px-4 text-sm font-medium transition-colors"
            [class]="estado() === e.id ? 'bg-foreground text-background' : 'bg-secondary text-secondary-foreground'"
            (click)="estado.set(e.id)"
          >
            {{ e.label }}
          </button>
        }
      </div>
    </div>
  `,
})
export class LabIslaComponent {
  protected readonly estado = signal<EstadoIsla>('reposo');
  protected readonly forma = computed(() => FORMAS[this.estado()]);
  protected readonly estados: { id: EstadoIsla; label: string }[] = [
    { id: 'reposo', label: 'Reposo' },
    { id: 'actividad', label: 'Proceso en curso' },
    { id: 'aviso', label: 'Aviso' },
    { id: 'expandida', label: 'Chat' },
  ];
  protected readonly sugerencias = ['Estado de mi liquidación', 'Correos sin clasificar', 'Resumen del día'];

  protected alternar(): void {
    this.estado.update((e) => (e === 'expandida' ? 'reposo' : 'expandida'));
  }
}
