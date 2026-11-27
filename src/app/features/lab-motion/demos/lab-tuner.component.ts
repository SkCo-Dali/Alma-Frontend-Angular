// Panel para ajustar en vivo los tres springs de Nova. Todo el laboratorio se
// mueve con el borrador; «Publicar para todos» lo guarda en el backend y desde
// ahí aplica a toda la app (MotionConfigService).

import { Component, ElementRef, computed, inject, signal, viewChildren } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { DecimalPipe } from '@angular/common';
import { PressDirective } from '../motion/press.directive';
import { MotionTuningService } from '../motion/motion-tuning.service';
import { SpringName, animateSpring, springCurve, springSamples } from '../../../shared/motion/spring';

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
      <span class="text-xs text-muted-foreground">Solo para previsualizar: no se publica.</span>
    </div>

    <!-- Publicación -->
    <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-sm">
      <span class="flex min-w-0 items-center gap-2">
        @if (tuning.hayCambios()) {
          <span class="size-2 shrink-0 rounded-full bg-[var(--warning)]"></span>
          <span><b class="font-semibold">Borrador sin publicar.</b> Solo lo ves tú, en esta página.</span>
        } @else {
          <span class="size-2 shrink-0 rounded-full bg-primary"></span>
          <span class="text-muted-foreground">{{ estadoPublicado() }}</span>
        }
      </span>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        @if (tuning.hayCambios()) {
          <button
            novaPress
            type="button"
            class="h-9 rounded-full px-4 font-medium hover:bg-secondary"
            (click)="tuning.volverAPublicado()"
          >
            Volver a lo publicado
          </button>
        }
        @if (tuning.distintoDeFabrica()) {
          <button
            novaPress
            type="button"
            class="h-9 rounded-full px-4 font-medium hover:bg-secondary"
            (click)="tuning.valoresDeFabrica()"
          >
            Valores de fábrica
          </button>
        }
        @if (tuning.puedePublicar()) {
          <button
            novaPress
            type="button"
            class="h-9 rounded-full px-5 font-semibold transition-colors disabled:opacity-40"
            [class]="confirmando() ? 'bg-[var(--warning)] text-black' : 'bg-primary text-primary-foreground'"
            [disabled]="!tuning.hayCambios() || tuning.publicando()"
            (click)="publicar()"
          >
            {{ tuning.publicando() ? 'Publicando…' : confirmando() ? 'Confirmar: aplica a todos' : 'Publicar para todos' }}
          </button>
        } @else {
          <span class="text-xs text-muted-foreground">Solo los administradores de plataforma pueden publicar.</span>
        }
      </div>
    </div>
  `,
})
export class LabTunerComponent {
  protected readonly tuning = inject(MotionTuningService);
  private readonly toast = inject(ToastService);
  protected readonly confirmando = signal(false);
  private confirmTimer?: ReturnType<typeof setTimeout>;

  protected readonly estadoPublicado = computed(() => {
    const p = this.tuning.publicado();
    if (!p.actualizadoPor) return 'Valores de fábrica: aún no se ha publicado nada.';
    const fecha = p.actualizadoEn
      ? new Date(p.actualizadoEn).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
      : '';
    return `Publicado por ${p.actualizadoPor}${fecha ? ' · ' + fecha : ''} · Es lo que ven todos`;
  });

  /** Dos pasos: el primer clic pide confirmación (aplica a todos los usuarios). */
  protected async publicar(): Promise<void> {
    if (!this.confirmando()) {
      this.confirmando.set(true);
      clearTimeout(this.confirmTimer);
      this.confirmTimer = setTimeout(() => this.confirmando.set(false), 4000);
      return;
    }
    clearTimeout(this.confirmTimer);
    this.confirmando.set(false);
    try {
      await this.tuning.publicar();
      this.toast.show('Movimiento publicado', 'Los nuevos springs aplican a todos los usuarios al cargar Nova.');
    } catch (e) {
      this.toast.error('No se pudo publicar', e instanceof Error ? e.message : undefined);
    }
  }
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
