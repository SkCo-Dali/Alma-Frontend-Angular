// /lab/motion — Laboratorio de movimiento de Nova.
//
// Prototipo del nuevo lenguaje de animación (springs, profundidad, transiciones
// de contenedor, morph de la isla, toasts apilados, coreografía y scroll). No
// está enlazado desde la navegación: sirve para que el equipo vea y ajuste el
// «carácter» del movimiento antes de llevarlo a las pantallas reales.
//
// Las piezas reutilizables viven en ./motion (spring.ts, press.directive.ts);
// las demos en ./demos.

import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  effect,
  inject,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { MotionConfigService } from '../../shared/motion/motion-config.service';
import { SPRING_SOURCE } from '../../shared/motion/spring-source';
import { MotionTuningService } from './motion/motion-tuning.service';
import { PressDirective } from '../../shared/motion/press.directive';
import { LabContainerComponent } from './demos/lab-container.component';
import { LabIslaComponent } from './demos/lab-isla.component';
import { NovaDialogComponent } from '../../shared/components/nova-dialog/nova-dialog.component';
import { LabToastsComponent } from './demos/lab-toasts.component';
import { LabTunerComponent } from './demos/lab-tuner.component';

@Component({
  selector: 'nova-motion-lab',
  // SPRING_SOURCE → el borrador: novaPress y nova-dialog del laboratorio se
  // mueven con los controles, no con lo publicado.
  providers: [MotionTuningService, { provide: SPRING_SOURCE, useExisting: MotionTuningService }],
  imports: [
    LucideAngularModule,
    PageHeaderComponent,
    PressDirective,
    LabTunerComponent,
    NovaDialogComponent,
    LabContainerComponent,
    LabIslaComponent,
    LabToastsComponent,
  ],
  // Sin encapsulación: las keyframes y la línea de tiempo de scroll se
  // comparten entre las demos. Todo va con prefijo nv-lab-.
  encapsulation: ViewEncapsulation.None,
  styles: `
    .nv-lab-seccion {
      border-radius: 24px;
      border: 1px solid var(--border);
      background: var(--card);
      padding: 20px;
      box-shadow: var(--shadow-md);
    }
    .nv-lab-aparece {
      animation: nv-lab-aparece var(--spring-smooth-dur) var(--spring-smooth) both;
    }
    @keyframes nv-lab-aparece {
      from {
        opacity: 0;
        transform: translateY(14px) scale(0.98);
      }
    }

    /* Press feedback + shape morph (M3 Expressive): el radio cambia con spring. */
    .nv-lab-morph {
      transition-property: border-radius, background-color, color;
      transition-duration: var(--spring-snappy-dur);
      transition-timing-function: var(--spring-snappy);
    }

    /* Switch con spring: el pulgar viaja con rebote y se estira al presionar. */
    .nv-lab-pulgar {
      transition-property: translate, width;
      transition-duration: var(--spring-bouncy-dur);
      transition-timing-function: var(--spring-bouncy);
    }
    .nv-lab-riel {
      transition: background-color 0.2s ease;
    }

    /* Tarjeta que se eleva: sombra y escala responden al hover. */
    .nv-lab-eleva {
      transition-property: transform, box-shadow;
      transition-duration: var(--spring-smooth-dur);
      transition-timing-function: var(--spring-smooth);
    }
    .nv-lab-eleva:hover {
      transform: translateY(-4px) scale(1.015);
      box-shadow: var(--shadow-lg);
    }

    /* Título grande que colapsa con el scroll (iOS large titles), sin JS. */
    .nv-lab-scroller {
      scroll-timeline: --nv-lab-scroll y;
    }
    @supports (animation-timeline: scroll()) {
      .nv-lab-titulo-grande {
        transform-origin: left bottom;
        animation: nv-lab-titulo-grande linear both;
        animation-timeline: --nv-lab-scroll;
        animation-range: 0px 70px;
      }
      .nv-lab-titulo-compacto {
        animation: nv-lab-titulo-compacto linear both;
        animation-timeline: --nv-lab-scroll;
        animation-range: 50px 90px;
      }
      .nv-lab-barra {
        animation: nv-lab-barra linear both;
        animation-timeline: --nv-lab-scroll;
        animation-range: 50px 90px;
      }
    }
    @keyframes nv-lab-titulo-grande {
      to {
        opacity: 0;
        transform: scale(0.82) translateY(-6px);
      }
    }
    @keyframes nv-lab-titulo-compacto {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    @keyframes nv-lab-barra {
      from {
        background-color: transparent;
        box-shadow: none;
      }
      to {
        background-color: var(--card);
        box-shadow: 0 1px 0 var(--border);
      }
    }
  `,
  template: `
    <div class="pb-24">
      <alma-page-header
        title="Laboratorio de movimiento"
        description="Prototipo del nuevo lenguaje de animación de Nova: springs, profundidad y continuidad. Ajusta los springs, previsualiza aquí y publícalos para que apliquen en toda la app."
      />

      <div class="flex flex-col gap-6">
        <!-- 1. Springs -->
        <section class="nv-lab-seccion">
          <h2 class="text-lg font-semibold">1 · Springs en lugar de duraciones</h2>
          <p class="mb-4 text-sm text-muted-foreground">
            Cada movimiento es un resorte con respuesta y rebote. La duración sale de la física, no
            se elige a mano. Usa la cámara lenta para ver el detalle.
          </p>
          <nova-lab-tuner />
        </section>

        <!-- 2. Press, shape morph, switch, elevación -->
        <section class="nv-lab-seccion">
          <h2 class="text-lg font-semibold">2 · Microinteracciones físicas</h2>
          <p class="mb-5 text-sm text-muted-foreground">
            Mantén presionado: los controles se hunden y vuelven con rebote. El botón de filtro cambia
            de forma al activarse, el switch estira su pulgar y las tarjetas se elevan al pasar el mouse.
          </p>
          <div class="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div class="flex flex-wrap items-center gap-3">
              <button novaPress type="button" class="h-11 rounded-full bg-primary px-6 font-semibold text-primary-foreground">
                Guardar
              </button>
              <button novaPress type="button" class="h-11 rounded-full bg-secondary px-6 font-medium text-secondary-foreground">
                Cancelar
              </button>
              <button
                novaPress
                type="button"
                class="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground"
                aria-label="Buscar"
              >
                <lucide-icon name="search" [size]="18" />
              </button>
              @for (f of filtros; track f; let i = $index) {
                <button
                  novaPress
                  type="button"
                  class="nv-lab-morph flex h-11 items-center gap-1.5 px-5 text-sm font-medium"
                  [style.border-radius.px]="filtroActivo() === i ? 12 : 22"
                  [class]="filtroActivo() === i ? 'bg-foreground text-background' : 'bg-secondary text-secondary-foreground'"
                  [attr.aria-pressed]="filtroActivo() === i"
                  (click)="filtroActivo.set(i)"
                >
                  @if (filtroActivo() === i) {
                    <lucide-icon name="check" [size]="15" />
                  }
                  {{ f }}
                </button>
              }

              <button
                type="button"
                role="switch"
                class="nv-lab-riel relative h-8 w-[52px] rounded-full"
                [class]="switchOn() ? 'bg-primary' : 'bg-foreground/20'"
                [attr.aria-checked]="switchOn()"
                aria-label="Notificaciones"
                (pointerdown)="switchPresionado.set(true)"
                (pointerup)="switchPresionado.set(false)"
                (pointerleave)="switchPresionado.set(false)"
                (click)="switchOn.set(!switchOn())"
              >
                <span
                  class="nv-lab-pulgar absolute left-[3px] top-[3px] h-[26px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.25)]"
                  [style.width.px]="switchPresionado() ? 32 : 26"
                  [style.translate]="pulgarX()"
                ></span>
              </button>
            </div>

            <div class="grid grid-cols-3 gap-3">
              @for (c of tarjetas; track c.titulo) {
                <div [novaPress]="0.97" class="nv-lab-eleva cursor-pointer rounded-[18px] border border-border bg-background p-4">
                  <lucide-icon [name]="c.icono" [size]="20" class="text-primary" />
                  <div class="mt-3 text-sm font-semibold">{{ c.titulo }}</div>
                  <div class="text-xs text-muted-foreground">{{ c.texto }}</div>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- 3. nova-dialog -->
        <section class="nv-lab-seccion">
          <h2 class="text-lg font-semibold">3 · Profundidad: &lt;nova-dialog&gt;</h2>
          <p class="mb-4 text-sm text-muted-foreground">
            El componente real que reemplaza a los diálogos de hoy. La app retrocede detrás; en modo sheet
            se cierra arrastrando y hereda la velocidad del gesto. En pantallas angostas, «auto» se vuelve sheet.
          </p>
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="h-11 rounded-full border border-border bg-background px-5 font-medium"
              (click)="antes.set(true)"
            >
              Diálogo actual (antes)
            </button>
            <button
              novaPress
              type="button"
              class="h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
              (click)="demoVariante.set('dialog'); demoAbierto.set(true)"
            >
              nova-dialog
            </button>
            <button
              novaPress
              type="button"
              class="h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
              (click)="demoVariante.set('sheet'); demoAbierto.set(true)"
            >
              nova-dialog · sheet
            </button>
          </div>
        </section>

        <!-- 4. Container transform -->
        <section class="nv-lab-seccion">
          <h2 class="text-lg font-semibold">4 · Continuidad: la tarjeta se convierte en la app</h2>
          <p class="mb-4 text-sm text-muted-foreground">
            Abre una app: su tarjeta crece hasta ser la pantalla, y el ícono y el título viajan a su
            lugar. Es la misma técnica (View Transitions) que llevaríamos al router.
          </p>
          <nova-lab-container />
        </section>

        <div class="grid gap-6 xl:grid-cols-2">
          <!-- 5. Isla -->
          <section class="nv-lab-seccion">
            <h2 class="text-lg font-semibold">5 · La isla cambia de forma</h2>
            <p class="mb-4 text-sm text-muted-foreground">
              La pastilla no se reemplaza: se estira con rebote hacia cada estado. Tócala para abrir el chat.
            </p>
            <nova-lab-isla />
          </section>

          <!-- 6. Toasts -->
          <section class="nv-lab-seccion">
            <h2 class="text-lg font-semibold">6 · Avisos apilados</h2>
            <p class="mb-4 text-sm text-muted-foreground">
              Como las notificaciones de iOS: se agrupan en pila y se despliegan al pasar el mouse.
            </p>
            <nova-lab-toasts />
          </section>

          <!-- 7. Coreografía -->
          <section class="nv-lab-seccion">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold">7 · Coreografía de entrada</h2>
                <p class="mb-4 text-sm text-muted-foreground">
                  Las listas entran escalonadas (40 ms entre filas) en lugar de aparecer de golpe.
                </p>
              </div>
              <button
                novaPress
                type="button"
                class="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"
                aria-label="Repetir"
                (click)="generacion.set(generacion() + 1)"
              >
                <lucide-icon name="rotate-ccw" [size]="16" />
              </button>
            </div>
            @for (fila of filasLista; track generacion() + '-' + $index; let i = $index) {
              <div
                class="nv-lab-aparece mb-2 flex items-center gap-3 rounded-[14px] bg-background p-3"
                [style.animation-delay.ms]="i * 40"
              >
                <span class="size-9 rounded-full" [style.background]="fila.color"></span>
                <span class="flex-1">
                  <span class="block text-sm font-medium">{{ fila.nombre }}</span>
                  <span class="block text-xs text-muted-foreground">{{ fila.detalle }}</span>
                </span>
                <span class="text-sm font-semibold tabular-nums">{{ fila.valor }}</span>
              </div>
            }
          </section>

          <!-- 8. Large title -->
          <section class="nv-lab-seccion">
            <h2 class="text-lg font-semibold">8 · Título que colapsa con el scroll</h2>
            <p class="mb-4 text-sm text-muted-foreground">
              Haz scroll dentro del recuadro: el título grande se encoge y pasa a la barra, como en iOS.
              Solo CSS (scroll-driven animations).
            </p>
            <div class="nv-lab-scroller relative h-[340px] overflow-y-auto rounded-[18px] bg-background">
              <div class="nv-lab-barra sticky top-0 z-10 flex h-12 items-center justify-center">
                <span class="nv-lab-titulo-compacto text-[15px] font-semibold">Bandeja</span>
              </div>
              <h3 class="nv-lab-titulo-grande px-4 pb-3 text-[32px] font-bold tracking-tight">Bandeja</h3>
              @for (n of correos; track n) {
                <div class="mx-3 mb-2 rounded-[12px] bg-card p-3">
                  <div class="h-3 w-2/5 rounded-full bg-foreground/15"></div>
                  <div class="mt-2 h-2.5 w-4/5 rounded-full bg-foreground/8"></div>
                </div>
              }
            </div>
          </section>
        </div>
      </div>
    </div>

    <nova-dialog
      [(open)]="demoAbierto"
      [variant]="demoVariante()"
      title="Nueva regla de comisión"
      description="Arrástrame hacia abajo en modo sheet; Esc o el velo también cierran."
    >
      <div class="space-y-3">
        @for (campo of camposDemo; track campo) {
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-muted-foreground">{{ campo }}</span>
            <input class="h-10 w-full rounded-[10px] border border-input bg-background px-3 text-sm" />
          </label>
        }
      </div>
      <div novaDialogFooter class="flex gap-2">
        <button novaPress type="button" class="alma-btn alma-btn-outline" (click)="demoAbierto.set(false)">Cancelar</button>
        <button novaPress type="button" class="alma-btn alma-btn-primary" (click)="demoAbierto.set(false)">Guardar</button>
      </div>
    </nova-dialog>

    @if (antes()) {
      <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" (click)="antes.set(false)">
        <div class="w-full max-w-md rounded-xl bg-card p-6 shadow-[var(--shadow-lg)]" (click)="$event.stopPropagation()">
          <h2 class="text-lg font-semibold">Nueva regla de comisión</h2>
          <p class="mt-1 text-sm text-muted-foreground">Así aparecen hoy los diálogos: de golpe, sin relación con lo que hay detrás.</p>
          <button type="button" class="mt-5 h-10 w-full rounded-lg bg-primary font-semibold text-primary-foreground" (click)="antes.set(false)">
            Cerrar
          </button>
        </div>
      </div>
    }
  `,
})
export class MotionLabPage {
  private readonly tuning = inject(MotionTuningService);

  protected readonly filtros = ['Todos', 'Pendientes', 'Aprobados'];
  protected readonly filtroActivo = signal(0);
  protected readonly switchOn = signal(true);
  protected readonly switchPresionado = signal(false);
  protected readonly antes = signal(false);
  protected readonly demoAbierto = signal(false);
  protected readonly demoVariante = signal<'dialog' | 'sheet'>('dialog');
  protected readonly camposDemo = ['Nombre de la regla', 'Producto', 'Canal', 'Porcentaje'];
  protected readonly generacion = signal(0);

  protected readonly tarjetas = [
    { icono: 'inbox', titulo: 'Buzón', texto: '12 nuevos' },
    { icono: 'calculator', titulo: 'Comisiones', texto: 'Corte hoy' },
    { icono: 'users', titulo: 'Equipo', texto: '8 activos' },
  ];
  protected readonly filasLista = [
    { nombre: 'Laura Gómez', detalle: 'Vida individual', valor: '$ 4,2 M', color: '#00a63e' },
    { nombre: 'Andrés Rojas', detalle: 'Pensiones voluntarias', valor: '$ 3,8 M', color: '#2f6fde' },
    { nombre: 'Camila Torres', detalle: 'Fondos de inversión', valor: '$ 3,1 M', color: '#e07a1f' },
    { nombre: 'Julián Pérez', detalle: 'Seguros colectivos', valor: '$ 2,7 M', color: '#8a4fd8' },
    { nombre: 'Sofía Díaz', detalle: 'Vida individual', valor: '$ 2,2 M', color: '#d84f7a' },
  ];
  protected readonly correos = Array.from({ length: 14 }, (_, i) => i);

  protected pulgarX(): string {
    // Riel 52px, pulgar 26px (32 al presionar), margen 3px.
    const ancho = this.switchPresionado() ? 32 : 26;
    return this.switchOn() ? `${52 - 6 - ancho}px 0` : '0 0';
  }

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const raiz = document.documentElement;
    // Las variables van en el host (demos) y en <html> (los pseudo-elementos de
    // View Transitions cuelgan de <html> y no heredan del host).
    effect(() => {
      for (const [k, v] of Object.entries(this.tuning.cssVars())) {
        host.style.setProperty(k, v);
        raiz.style.setProperty(k, v);
      }
    });
    // Al salir, <html> vuelve a lo publicado: el borrador no se filtra al resto de la app.
    const config = inject(MotionConfigService);
    inject(DestroyRef).onDestroy(() => config.restaurar());
  }
}
