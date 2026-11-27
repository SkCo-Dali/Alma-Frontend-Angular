// Sheet con profundidad al estilo iOS.
//
// - El sheet sube con el spring «smooth».
// - El fondo (la página) se hunde: escala, esquinas redondeadas y velo oscuro.
//   La sensación es de una capa ENCIMA de otra, no de un recuadro que aparece.
// - Se arrastra desde la parte superior: sigue al dedo/mouse, el fondo acompaña
//   el gesto y, al soltar, hereda la velocidad. Un tirón rápido lo cierra
//   aunque se haya movido poco; un arrastre lento y corto lo devuelve a su
//   sitio con un rebote.
// - Esc o un clic en el velo también lo cierran.
//
// OJO: este componente debe rendirse FUERA del elemento `fondo`, porque un
// ancestro con transform convierte `position: fixed` en relativo a él.

import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { animateSpring, prefiereMenosMovimiento } from '../motion/spring';
import { MotionTuningService } from '../motion/motion-tuning.service';
import { PressDirective } from '../motion/press.directive';

type Estado = 'cerrado' | 'abierto' | 'cerrando';

/** Una velocidad absurda (un tirón de 1px en 1ms) haría oscilar el resorte. */
const limitar = (v: number) => Math.min(Math.max(v, -12), 12);

@Component({
  selector: 'nova-lab-sheet',
  imports: [LucideAngularModule, PressDirective],
  host: { '(document:keydown.escape)': 'cerrar()' },
  template: `
    @if (estado() !== 'cerrado') {
      <div
        #velo
        class="fixed inset-0 z-[200] bg-black/45"
        style="opacity: 0"
        (click)="cerrar()"
      ></div>
      <div
        #sheet
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-sheet-titulo"
        class="fixed inset-x-0 bottom-0 z-[201] mx-auto flex max-h-[85dvh] w-full max-w-[620px] flex-col rounded-t-[28px] bg-card text-card-foreground shadow-[0_-12px_48px_-12px_rgb(0_0_0/0.35)]"
        style="transform: translateY(110%)"
      >
        <!-- Zona de arrastre -->
        <div
          class="cursor-grab touch-none select-none px-6 pb-2 pt-3 active:cursor-grabbing"
          (pointerdown)="inicioArrastre($event)"
          (pointermove)="moverArrastre($event)"
          (pointerup)="finArrastre($event)"
          (pointercancel)="finArrastre($event)"
        >
          <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-foreground/20"></div>
          <div class="flex items-center gap-3">
            <h2 id="lab-sheet-titulo" class="flex-1 text-lg font-semibold">Nueva regla de comisión</h2>
            <button
              novaPress
              type="button"
              class="grid size-8 place-items-center rounded-full bg-secondary text-secondary-foreground"
              aria-label="Cerrar"
              (pointerdown)="$event.stopPropagation()"
              (click)="cerrar()"
            >
              <lucide-icon name="x" [size]="16" />
            </button>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            Arrástrame hacia abajo. Un tirón rápido me cierra aunque me muevas poco.
          </p>
        </div>

        <div class="flex-1 space-y-3 overflow-y-auto px-6 pb-6 pt-2">
          @for (campo of campos; track campo) {
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-muted-foreground">{{ campo }}</span>
              <div class="h-10 rounded-[10px] border border-input bg-background"></div>
            </label>
          }
          <div class="flex gap-2 pt-2">
            <button
              novaPress
              type="button"
              class="h-11 flex-1 rounded-full bg-secondary font-medium text-secondary-foreground"
              (click)="cerrar()"
            >
              Cancelar
            </button>
            <button
              novaPress
              type="button"
              class="h-11 flex-1 rounded-full bg-primary font-semibold text-primary-foreground"
              (click)="cerrar()"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class LabSheetComponent {
  /** Elemento que se hunde detrás del sheet. */
  readonly fondo = input.required<HTMLElement>();

  private readonly tuning = inject(MotionTuningService);
  private readonly injector = inject(Injector);
  private readonly sheetRef = viewChild<ElementRef<HTMLElement>>('sheet');
  private readonly veloRef = viewChild<ElementRef<HTMLElement>>('velo');

  protected readonly estado = signal<Estado>('cerrado');
  protected readonly campos = ['Nombre de la regla', 'Producto', 'Canal', 'Porcentaje'];

  private arrastre: { y0: number; muestras: { y: number; t: number }[] } | null = null;
  private desplazamiento = 0;

  abrir(): void {
    if (this.estado() === 'abierto') return;
    this.estado.set('abierto');
    afterNextRender(() => this.animarA(0), { injector: this.injector });
  }

  cerrar(velocidad = 0): void {
    if (this.estado() !== 'abierto') return;
    this.estado.set('cerrando');
    const sheet = this.sheetRef()?.nativeElement;
    if (!sheet) return this.estado.set('cerrado');
    this.animarA(sheet.offsetHeight * 1.1, velocidad);
    // Esperar al sheet Y al fondo: un transform residual en el fondo (aunque
    // sea scale(1)) lo volvería contenedor de los position: fixed de la página.
    const f0 = this.fondo();
    Promise.all([...sheet.getAnimations(), ...f0.getAnimations()].map((a) => a.finished))
      .then(() => {
        if (this.estado() !== 'cerrando') return;
        this.estado.set('cerrado');
        const f = this.fondo();
        f.style.transform = '';
        f.style.borderRadius = '';
        f.style.overflow = '';
        f.style.transformOrigin = '';
      })
      .catch(() => {});
  }

  // ── Gesto ──────────────────────────────────────────────────────────────

  protected inicioArrastre(e: PointerEvent): void {
    if (this.estado() !== 'abierto' || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const sheet = this.sheetRef()!.nativeElement;
    // Si había una animación en curso se «agarra» donde esté.
    sheet.getAnimations().forEach((a) => {
      a.commitStyles();
      a.cancel();
    });
    this.desplazamiento = this.leerY(sheet);
    this.arrastre = {
      y0: e.clientY - this.desplazamiento,
      muestras: [{ y: e.clientY, t: e.timeStamp }],
    };
  }

  protected moverArrastre(e: PointerEvent): void {
    if (!this.arrastre) return;
    let dy = e.clientY - this.arrastre.y0;
    // Hacia arriba: resistencia elástica (rubber band), como en iOS.
    if (dy < 0) dy = -Math.pow(-dy, 0.7);
    this.desplazamiento = dy;
    this.arrastre.muestras.push({ y: e.clientY, t: e.timeStamp });
    if (this.arrastre.muestras.length > 6) this.arrastre.muestras.shift();
    this.pintar(dy);
  }

  protected finArrastre(e: PointerEvent): void {
    if (!this.arrastre) return;
    const m = this.arrastre.muestras;
    this.arrastre = null;
    const a = m[0];
    const b = m[m.length - 1] ?? a;
    const dt = Math.max((b.t - a.t) / 1000, 0.001);
    const velocidadPx = e.type === 'pointercancel' ? 0 : (b.y - a.y) / dt; // px/s, + hacia abajo
    const alto = this.sheetRef()!.nativeElement.offsetHeight;

    // Proyección: dónde terminaría el sheet si siguiera con esa inercia.
    const proyectado = this.desplazamiento + velocidadPx * 0.2;
    if (proyectado > alto * 0.45 || velocidadPx > 900) {
      const restante = Math.max(alto * 1.1 - this.desplazamiento, 1);
      this.cerrar(limitar(velocidadPx / restante));
    } else {
      // Velocidad normalizada HACIA el destino (0): el signo depende de si el
      // sheet quedó abajo (d > 0) o estirado hacia arriba (d < 0).
      const d = Math.abs(this.desplazamiento) < 1 ? 0 : this.desplazamiento;
      this.animarA(0, d === 0 ? 0 : limitar(-velocidadPx / d));
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  /** Progreso 0 (abierto) … 1 (cerrado) aplicado sin animar, durante el gesto. */
  private pintar(y: number): void {
    const sheet = this.sheetRef()?.nativeElement;
    if (!sheet) return;
    sheet.style.transform = `translateY(${y}px)`;
    const p = Math.min(Math.max(y / sheet.offsetHeight, 0), 1);
    const velo = this.veloRef()?.nativeElement;
    if (velo) {
      velo.style.transition = 'none';
      velo.style.opacity = String(1 - p);
    }
    const f = this.fondo();
    f.getAnimations().forEach((a) => {
      a.commitStyles();
      a.cancel();
    });
    f.style.transform = this.transformFondo(1 - p);
    f.style.borderRadius = `${18 * (1 - p)}px`;
  }

  private animarA(y: number, velocidad = 0): Animation | undefined {
    const sheet = this.sheetRef()?.nativeElement;
    const velo = this.veloRef()?.nativeElement;
    if (!sheet) return;
    const abierto = y === 0;
    const spring = this.tuning.spring('smooth');

    const f = this.fondo();
    if (abierto && !f.style.transformOrigin) {
      // Hundir hacia el centro de lo que se ve, no del documento entero.
      const r = f.getBoundingClientRect();
      f.style.transformOrigin = `50% ${innerHeight / 2 - r.top}px`;
      f.style.overflow = 'clip';
    }
    animateSpring(
      f,
      [{ transform: this.transformFondo(abierto ? 1 : 0), borderRadius: abierto ? '18px' : '0px' }],
      { ...spring, bounce: 0 },
      { velocity: velocidad },
    );
    if (velo) {
      // Transición CSS (no WAAPI): el velo solo hace fade y así su opacidad
      // final queda en el estilo, sin depender del fill de una animación.
      void velo.offsetWidth;
      velo.style.transition = prefiereMenosMovimiento()
        ? 'none'
        : `opacity ${abierto ? 260 : 200}ms ease-out`;
      velo.style.opacity = abierto ? '1' : '0';
    }
    return animateSpring(sheet, [{ transform: `translateY(${y}px)` }], spring, {
      velocity: velocidad,
    });
  }

  /** p = 1: fondo totalmente hundido; p = 0: en reposo. */
  private transformFondo(p: number): string {
    const escala = 1 - 0.06 * p;
    return `translateY(${10 * p}px) scale(${escala})`;
  }

  private leerY(el: HTMLElement): number {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return m.m42;
  }
}
