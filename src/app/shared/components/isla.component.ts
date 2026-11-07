// Isla de Nova: pastilla oscura en el centro del header que cambia de forma
// según lo que pasa (ver IslaService). Reposo → lema; actividad → proceso en
// curso con anillo de progreso; aviso → mensaje breve; expandida → detalle de
// cada proceso con «Ver» y su acción.
//
// El tamaño de cada estado es fijo (ancho/alto/radio) para poder animar el
// cambio de forma con CSS; el contenido entra con un fundido corto.

import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ActividadIsla, IslaService, TonoAviso } from '../../core/services/isla.service';

const ICONO_AVISO: Record<TonoAviso, string> = {
  info: 'info',
  ok: 'check-circle-2',
  error: 'alert-triangle',
};

/** Filas visibles en la isla expandida (el resto se resume en «y N más»). */
const MAX_FILAS = 3;

@Component({
  selector: 'alma-isla',
  imports: [DecimalPipe, NgTemplateOutlet, LucideAngularModule],
  host: {
    // Escritorio: centrada en el header. Móvil: debajo del header y solo si hay algo.
    class:
      'fixed left-1/2 top-[84px] z-40 flex -translate-x-1/2 items-start gap-1.5 md:absolute md:top-[22px]',
    '[class.max-md:hidden]': "isla.modo() === 'reposo'",
  },
  styles: [
    `
      .isla {
        background: rgb(12 12 14 / 0.94);
        color: #fff;
        backdrop-filter: blur(16px) saturate(1.2);
        -webkit-backdrop-filter: blur(16px) saturate(1.2);
        box-shadow: 0 10px 30px -12px rgb(0 0 0 / 0.55), inset 0 0 0 1px rgb(255 255 255 / 0.06);
        overflow: hidden;
        transition:
          width 0.5s cubic-bezier(0.34, 1.4, 0.64, 1),
          height 0.5s cubic-bezier(0.34, 1.4, 0.64, 1),
          border-radius 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);
      }
      .isla-contenido { animation: isla-entra 0.28s ease-out 0.12s both; }
      @keyframes isla-entra { from { opacity: 0; transform: scale(0.96); filter: blur(2px); } }
      .isla-burbuja {
        animation: isla-burbuja 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) both;
      }
      @keyframes isla-burbuja { from { opacity: 0; transform: translateX(-24px) scale(0.4); } }
      .isla-gira { animation: isla-gira 1.1s linear infinite; transform-origin: 50% 50%; }
      @keyframes isla-gira { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .isla, .isla-contenido, .isla-burbuja { transition: none; animation: none; }
      }
    `,
  ],
  template: `
    <div
      role="button"
      tabindex="0"
      class="isla cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
      [style.width]="'min(' + forma().w + 'px, 92vw)'"
      [style.height.px]="forma().h"
      [style.border-radius.px]="forma().r"
      [attr.aria-expanded]="isla.modo() === 'expandida'"
      [attr.aria-label]="etiqueta()"
      (click)="isla.alternar()"
      (keydown.enter)="isla.alternar()"
      (keydown.space)="$event.preventDefault(); isla.alternar()"
    >
      @switch (isla.modo()) {
        @case ('reposo') {
          <span class="isla-contenido flex h-full items-center justify-center gap-2 text-[13px] font-medium text-white/85">
            <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
            Tu hub de operaciones
          </span>
        }
        @case ('aviso') {
          @if (isla.aviso(); as a) {
            <span class="isla-contenido flex h-full items-center gap-3 px-3.5">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                [class]="a.tono === 'error' ? 'bg-rose-500/20 text-rose-300' : 'bg-primary/20 text-primary'"
              >
                <lucide-icon [name]="iconoAviso(a.tono)" [size]="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13.5px] font-semibold">{{ a.titulo }}</span>
                @if (a.detalle) {
                  <span class="line-clamp-2 text-[12px] leading-snug text-white/70">{{ a.detalle }}</span>
                }
              </span>
            </span>
          }
        }
        @case ('actividad') {
          @if (principal(); as act) {
            <span class="isla-contenido flex h-full items-center gap-2.5 pl-1.5 pr-3.5">
              <ng-container *ngTemplateOutlet="anillo; context: { $implicit: act, tam: 30 }" />
              <span class="min-w-0 flex-1 truncate text-[13px] font-medium">{{ act.titulo }}</span>
              <span class="shrink-0 text-[12.5px] font-semibold tabular-nums text-primary">
                {{ act.progreso != null ? (act.progreso | number: '1.0-0') + ' %' : act.detalle }}
              </span>
            </span>
          }
        }
        @case ('expandida') {
          <span class="isla-contenido flex flex-col gap-1 p-3" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
            @for (act of filas(); track act.id) {
              <span class="flex items-start gap-3 rounded-2xl p-2">
                <ng-container *ngTemplateOutlet="anillo; context: { $implicit: act, tam: 40 }" />
                <span class="min-w-0 flex-1">
                  <span class="flex items-baseline justify-between gap-2">
                    <span class="truncate text-[14px] font-semibold">{{ act.titulo }}</span>
                    @if (act.progreso != null) {
                      <span class="shrink-0 text-[12.5px] font-semibold tabular-nums text-primary">
                        {{ act.progreso | number: '1.0-0' }} %
                      </span>
                    }
                  </span>
                  @if (act.detalle) {
                    <span class="block truncate text-[12px] text-white/65">{{ act.detalle }}</span>
                  }
                  <span class="mt-2 flex gap-1.5">
                    @if (act.ruta) {
                      <button
                        type="button"
                        class="inline-flex h-7 items-center gap-1 rounded-full bg-white/10 px-3 text-[12px] font-medium hover:bg-white/20"
                        (click)="ver(act)"
                      >
                        Ver <lucide-icon name="arrow-right" [size]="12" />
                      </button>
                    }
                    @if (act.accion; as acc) {
                      <button
                        type="button"
                        class="inline-flex h-7 items-center rounded-full px-3 text-[12px] font-medium text-rose-300 hover:bg-rose-500/15"
                        (click)="acc.ejecutar()"
                      >
                        {{ acc.etiqueta }}
                      </button>
                    }
                  </span>
                </span>
              </span>
            }
            @if (restantes() > 0) {
              <span class="px-2 pb-1 text-[12px] text-white/60">y {{ restantes() }} más en curso</span>
            }
          </span>
        }
      }
    </div>

    <!-- Segunda actividad: burbuja pegada a la isla, como en el iPhone. -->
    @if (isla.modo() === 'actividad' && secundaria(); as act2) {
      <button
        type="button"
        class="isla isla-burbuja flex h-10 w-10 items-center justify-center rounded-full"
        [attr.aria-label]="act2.titulo + (isla.actividades().length > 2 ? ' y otras' : '')"
        (click)="isla.alternar()"
      >
        <ng-container *ngTemplateOutlet="anillo; context: { $implicit: act2, tam: 30 }" />
      </button>
    }

    <!-- Lectores de pantalla: los avisos se anuncian sin robar el foco. -->
    <span class="sr-only" role="status" aria-live="polite">
      @if (isla.aviso(); as a) { {{ a.titulo }}. {{ a.detalle }} }
    </span>

    <ng-template #anillo let-act let-tam="tam">
      <span class="relative flex shrink-0 items-center justify-center" [style.width.px]="tam" [style.height.px]="tam">
        <svg viewBox="0 0 36 36" class="absolute inset-0 -rotate-90" [class.isla-gira]="act.progreso == null">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(255 255 255 / 0.14)" stroke-width="3" />
          <circle
            cx="18" cy="18" r="15" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round"
            [attr.stroke-dasharray]="trazo(act.progreso)"
            style="transition: stroke-dasharray 0.6s ease"
          />
        </svg>
        <lucide-icon [name]="act.icono" [size]="tam * 0.42" class="text-white" />
      </span>
    </ng-template>
  `,
})
export class IslaComponent {
  protected readonly isla = inject(IslaService);
  private readonly router = inject(Router);
  private readonly el = inject(ElementRef<HTMLElement>);

  protected readonly principal = computed(() => this.isla.actividades()[0] ?? null);
  protected readonly secundaria = computed(() => this.isla.actividades()[1] ?? null);
  protected readonly filas = computed(() => this.isla.actividades().slice(0, MAX_FILAS));
  protected readonly restantes = computed(() =>
    Math.max(0, this.isla.actividades().length - MAX_FILAS),
  );

  /** Ancho, alto y radio de cada estado (lo que anima el cambio de forma). */
  protected readonly forma = computed(() => {
    switch (this.isla.modo()) {
      case 'aviso':
        return { w: 380, h: this.isla.aviso()?.detalle ? 68 : 52, r: 26 };
      case 'actividad':
        return { w: 320, h: 40, r: 20 };
      case 'expandida': {
        const filas = this.filas().length;
        return { w: 420, h: 24 + filas * 96 + (this.restantes() ? 22 : 0), r: 30 };
      }
      default:
        return { w: 232, h: 36, r: 18 };
    }
  });

  protected readonly etiqueta = computed(() => {
    const a = this.isla.aviso();
    if (a) return `${a.titulo}. Clic para cerrar`;
    const n = this.isla.actividades().length;
    if (n === 0) return 'Tu hub de operaciones';
    return `${n} ${n === 1 ? 'proceso' : 'procesos'} en curso. Clic para ver el detalle`;
  });

  protected iconoAviso(tono: TonoAviso): string {
    return ICONO_AVISO[tono];
  }

  /** Arco del anillo: porcentaje sobre la circunferencia (2π·15 ≈ 94,2). */
  protected trazo(progreso: number | null | undefined): string {
    const c = 94.2;
    if (progreso == null) return `${c * 0.28} ${c}`;
    const p = Math.max(0, Math.min(100, progreso));
    return `${(p / 100) * c} ${c}`;
  }

  protected ver(act: ActividadIsla): void {
    this.isla.cerrar();
    if (act.ruta) void this.router.navigateByUrl(act.ruta);
  }

  @HostListener('document:click', ['$event'])
  protected clicFuera(ev: MouseEvent): void {
    if (!this.el.nativeElement.contains(ev.target as Node)) this.isla.cerrar();
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.isla.cerrar();
  }
}
