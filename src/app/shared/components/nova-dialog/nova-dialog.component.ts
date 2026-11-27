// <nova-dialog>: diálogo y sheet de Nova con el lenguaje de movimiento nuevo.
//
// - Diálogo (escritorio): entra con el spring «smooth» desde abajo y un poco
//   más pequeño; la app de atrás se hunde levemente.
// - Sheet (móvil, o variant="sheet"): sube desde abajo, la app se hunde con
//   esquinas redondeadas y se cierra ARRASTRANDO, heredando la velocidad.
// - Salida más rápida que la entrada. Con reduced motion, cambios directos.
// - Accesible: role="dialog", aria-modal, foco atrapado, Esc (solo el de
//   arriba), foco devuelto al cerrar e `inert` en la app de atrás.
//
// Se rinde en <body> (fuera del shell que se hunde). Si el padre lo destruye
// con @if —el patrón de los diálogos actuales al guardar—, igual anima la
// salida antes de desaparecer.
//
// Uso:
//   <nova-dialog title="Nueva regla" description="…" size="lg" (closed)="cerrar()">
//     …contenido…
//     <div novaDialogFooter>
//       <button class="alma-btn alma-btn-outline" (click)="dlg.close()">Cancelar</button>
//       <button class="alma-btn alma-btn-primary">Guardar</button>
//     </div>
//   </nova-dialog>
//
//   O controlado:  <nova-dialog [(open)]="abierto"> … </nova-dialog>
//
// `closed` se emite cuando el diálogo YA terminó de salir (cualquier vía).
// `dismiss` se emite al pedir cerrar el usuario (Esc, velo, X, arrastre).
// Con [dismissable]="false" (p. ej. mientras guarda) esas vías no cierran.

import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PressDirective } from '../../motion/press.directive';
import { animateSpring, prefiereMenosMovimiento } from '../../motion/spring';
import { SPRING_SOURCE } from '../../motion/spring-source';
import { NovaDialogStack } from './nova-dialog-stack.service';

export type NovaDialogSize = 'sm' | 'md' | 'lg' | 'xl';
export type NovaDialogVariant = 'auto' | 'dialog' | 'sheet';

const ANCHOS: Record<NovaDialogSize, string> = {
  sm: '420px',
  md: '560px',
  lg: '720px',
  xl: '960px',
};

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Una velocidad absurda (un tirón de 1px en 1ms) haría oscilar el resorte. */
const limitar = (v: number) => Math.min(Math.max(v, -12), 12);

let secuencia = 0;

@Component({
  selector: 'nova-dialog',
  imports: [LucideAngularModule, PressDirective],
  host: { style: 'display: contents', '(document:keydown.escape)': 'escape($event)' },
  template: `
    <div #capa>
      @if (visible()) {
        <div
          #velo
          class="fixed inset-0 bg-black/40"
          style="opacity: 0"
          [style.z-index]="z"
          (click)="pedirCierre()"
        ></div>
        <div
          class="pointer-events-none fixed inset-0 flex justify-center"
          [class]="esSheet() ? 'items-end' : 'items-center p-4'"
          [style.z-index]="z + 1"
        >
          <div
            #panel
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            [attr.aria-labelledby]="title() ? idTitulo : null"
            [attr.aria-describedby]="description() ? idDescripcion : null"
            [attr.aria-label]="title() ? null : ariaLabel()"
            class="pointer-events-auto flex w-full flex-col bg-card text-card-foreground outline-none"
            [class]="
              esSheet()
                ? 'max-h-[92dvh] rounded-t-[28px] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_48px_-12px_rgb(0_0_0/0.35)]'
                : 'max-h-[calc(100dvh-2rem)] rounded-[24px] border border-border shadow-[var(--shadow-lg)]'
            "
            [style.max-width]="ancho()"
            (keydown)="trampaFoco($event)"
          >
            <!-- Encabezado (en sheet también es la zona de arrastre) -->
            <div
              class="shrink-0"
              [class]="esSheet() ? 'cursor-grab touch-none select-none active:cursor-grabbing' : ''"
              (pointerdown)="inicioArrastre($event)"
              (pointermove)="moverArrastre($event)"
              (pointerup)="finArrastre($event)"
              (pointercancel)="finArrastre($event)"
            >
              @if (esSheet()) {
                <div class="mx-auto mt-3 h-1.5 w-10 rounded-full bg-foreground/20"></div>
              }
              @if (title() || mostrarCerrar()) {
                <div class="flex items-start gap-3 px-6 pb-2" [class]="esSheet() ? 'pt-3' : 'pt-5'">
                  <div class="min-w-0 flex-1">
                    @if (title()) {
                      <h2 [id]="idTitulo" class="text-lg font-bold leading-tight">{{ title() }}</h2>
                    }
                    @if (description()) {
                      <p [id]="idDescripcion" class="mt-1 text-sm text-muted-foreground">{{ description() }}</p>
                    }
                  </div>
                  @if (mostrarCerrar()) {
                    <button
                      novaPress
                      type="button"
                      class="-mr-2 grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-40"
                      aria-label="Cerrar"
                      [disabled]="!dismissable()"
                      (pointerdown)="$event.stopPropagation()"
                      (click)="pedirCierre()"
                    >
                      <lucide-icon name="x" [size]="16" />
                    </button>
                  }
                </div>
              }
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto" [class]="padded() ? 'px-6 pb-5 pt-2' : ''">
              <ng-content />
            </div>

            <div class="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4 empty:hidden">
              <ng-content select="[novaDialogFooter]" />
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class NovaDialogComponent implements OnDestroy {
  /** Abierto o cerrado. Por defecto true: el patrón `@if (x) { <nova-dialog> }`. */
  readonly open = model(true);
  readonly title = input('');
  readonly description = input('');
  /** Nombre accesible cuando no hay título visible. */
  readonly ariaLabel = input('Diálogo');
  readonly size = input<NovaDialogSize>('md');
  /** Ancho máximo explícito (p. ej. '640px'); manda sobre `size`. */
  readonly width = input<string | undefined>(undefined);
  /** auto = diálogo en escritorio y sheet en pantallas angostas. */
  readonly variant = input<NovaDialogVariant>('auto');
  /** false = Esc, velo, X y arrastre no cierran (p. ej. mientras guarda). */
  readonly dismissable = input(true);
  readonly showClose = input(true);
  /** Relleno estándar del cuerpo; false para contenido a sangre. */
  readonly padded = input(true);

  /** El usuario pidió cerrar (Esc, velo, X, arrastre). */
  readonly dismiss = output<void>();
  /** Terminó de salir. */
  readonly closed = output<void>();

  private readonly stack = inject(NovaDialogStack);
  private readonly springs = inject(SPRING_SOURCE);
  private readonly injector = inject(Injector);
  private readonly capa = viewChild.required<ElementRef<HTMLElement>>('capa');
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly veloRef = viewChild<ElementRef<HTMLElement>>('velo');

  protected readonly visible = signal(false);
  protected readonly idTitulo = `nova-dialog-t-${++secuencia}`;
  protected readonly idDescripcion = `nova-dialog-d-${secuencia}`;
  protected z = 300;

  private readonly angosta = signal(false);
  protected readonly esSheet = computed(() => {
    const v = this.variant();
    return v === 'sheet' || (v === 'auto' && this.angosta());
  });
  protected readonly ancho = computed(() => this.width() ?? ANCHOS[this.size()]);
  protected readonly mostrarCerrar = computed(() => this.showClose());

  private estado: 'cerrado' | 'abierto' | 'saliendo' = 'cerrado';
  private focoPrevio: HTMLElement | null = null;
  private arrastre: { y0: number; muestras: { y: number; t: number }[] } | null = null;
  private desplazamiento = 0;
  private montado = false;

  constructor() {
    const mq = matchMedia('(max-width: 639px)');
    this.angosta.set(mq.matches);
    const alCambiar = (e: MediaQueryListEvent) => this.angosta.set(e.matches);
    mq.addEventListener('change', alCambiar);

    afterNextRender(() => {
      // A <body>: fuera del shell que se hunde (un ancestro con transform
      // atraparía los position: fixed).
      document.body.appendChild(this.capa().nativeElement);
      this.montado = true;
      if (this.open()) this.mostrar();
    });

    effect(() => {
      const abierto = this.open();
      untracked(() => {
        if (!this.montado) return;
        if (abierto) this.mostrar();
        else this.ocultar();
      });
    });

    this.alDestruir = () => mq.removeEventListener('change', alCambiar);
  }

  private alDestruir: () => void;

  /** Cierra con animación (p. ej. desde el botón Cancelar del pie). */
  close(): void {
    this.open.set(false);
  }

  // ── Apertura / cierre ──────────────────────────────────────────────────

  private mostrar(): void {
    if (this.estado === 'abierto') return;
    this.estado = 'abierto';
    this.focoPrevio = document.activeElement as HTMLElement | null;
    this.z = 300 + document.querySelectorAll('[data-nova-dialog-abierto]').length * 10;
    this.visible.set(true);
    afterNextRender(() => this.animarEntrada(), { injector: this.injector });
  }

  private animarEntrada(): void {
    const panel = this.panelRef()?.nativeElement;
    const velo = this.veloRef()?.nativeElement;
    if (!panel || !velo) return;
    panel.setAttribute('data-nova-dialog-abierto', '');
    const smooth = this.springs.spring('smooth');
    this.stack.entrar(this, this.esSheet() ? 'sheet' : 'dialog', smooth);

    void velo.offsetWidth;
    velo.style.transition = prefiereMenosMovimiento() ? 'none' : 'opacity 240ms ease-out';
    velo.style.opacity = '1';

    let anim: Animation;
    if (this.esSheet()) {
      panel.style.transform = 'translateY(105%)';
      anim = animateSpring(panel, [{ transform: 'translateY(0px)' }], smooth);
    } else {
      panel.style.transform = 'translateY(18px) scale(0.96)';
      panel.style.opacity = '0';
      anim = animateSpring(panel, [{ transform: 'translateY(0px) scale(1)', opacity: 1 }], smooth);
    }
    // En reposo, SIN transform: un panel transformado atraparía los
    // position: fixed de su contenido (menús y diálogos que se abren dentro).
    anim.finished
      .then(() => {
        if (this.estado !== 'abierto' || this.arrastre) return;
        panel.style.transform = '';
        panel.style.opacity = '';
      })
      .catch(() => {});
    this.enfocarInicial(panel);
  }

  private ocultar(velocidad = 0): void {
    if (this.estado !== 'abierto') return;
    this.estado = 'saliendo';
    this.animarSalida(velocidad).then(() => {
      if (this.estado !== 'saliendo') return; // se reabrió mientras salía
      this.estado = 'cerrado';
      this.visible.set(false);
      this.closed.emit();
    });
  }

  /** Anima la salida sobre el DOM actual (también sirve al destruirse). */
  private animarSalida(velocidad = 0): Promise<void> {
    const panel = this.panelRef()?.nativeElement;
    const velo = this.veloRef()?.nativeElement;
    const smooth = this.springs.spring('smooth');
    this.stack.salir(this, smooth, this.esSheet() ? velocidad : 0);
    this.devolverFoco();
    if (!panel || !velo) return Promise.resolve();
    panel.removeAttribute('data-nova-dialog-abierto');
    panel.style.pointerEvents = 'none';

    const reducido = prefiereMenosMovimiento();
    velo.style.transition = reducido ? 'none' : `opacity ${this.esSheet() ? 220 : 160}ms ease-in`;
    velo.style.opacity = '0';

    let anim: Animation;
    if (this.esSheet()) {
      anim = animateSpring(
        panel,
        [{ transform: `translateY(${panel.offsetHeight * 1.05}px)` }],
        { ...smooth, bounce: 0 },
        { velocity: velocidad },
      );
    } else {
      panel.getAnimations().forEach((a) => {
        a.commitStyles();
        a.cancel();
      });
      anim = panel.animate([{ opacity: 0, transform: 'translateY(8px) scale(0.97)' }], {
        duration: reducido ? 1 : 160,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'forwards',
      });
    }
    return anim.finished.then(
      () => undefined,
      () => undefined,
    );
  }

  ngOnDestroy(): void {
    this.alDestruir();
    const capa = this.capa().nativeElement;
    if (this.estado === 'abierto') {
      // El padre lo quitó con @if estando abierto: salida «fantasma» sobre el
      // DOM que queda en <body>, y luego se retira.
      this.estado = 'saliendo';
      void this.animarSalida().then(() => capa.remove());
    } else if (this.estado === 'saliendo') {
      const anims = capa.getAnimations({ subtree: true });
      void Promise.allSettled(anims.map((a) => a.finished)).then(() => capa.remove());
    } else {
      capa.remove();
    }
  }

  protected pedirCierre(velocidad = 0): void {
    if (!this.dismissable() || this.estado !== 'abierto') return;
    this.dismiss.emit();
    this.ocultar(velocidad);
    this.open.set(false);
  }

  protected escape(e: Event): void {
    if (this.estado !== 'abierto' || !this.stack.esTope(this)) return;
    // Un diálogo antiguo abierto DENTRO de este (fixed inset-0) maneja su
    // propio Esc: no cerrar los dos de un golpe.
    if (this.panelRef()?.nativeElement.querySelector('.fixed.inset-0')) return;
    e.stopPropagation();
    this.pedirCierre();
  }

  // ── Foco ───────────────────────────────────────────────────────────────

  private enfocarInicial(panel: HTMLElement): void {
    const auto = panel.querySelector<HTMLElement>('[autofocus]');
    const cuerpo = Array.from(panel.querySelectorAll<HTMLElement>(ENFOCABLES)).find(
      (el) => el.getAttribute('aria-label') !== 'Cerrar',
    );
    (auto ?? cuerpo ?? panel).focus({ preventScroll: true });
  }

  protected trampaFoco(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const panel = this.panelRef()?.nativeElement;
    if (!panel) return;
    const lista = Array.from(panel.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
      (el) => el.offsetParent !== null,
    );
    if (!lista.length) {
      e.preventDefault();
      return;
    }
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (e.shiftKey && (document.activeElement === primero || document.activeElement === panel)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }

  private devolverFoco(): void {
    const f = this.focoPrevio;
    this.focoPrevio = null;
    // Tras quitar `inert` del fondo (stack.salir), el foco puede volver.
    if (f && f.isConnected) queueMicrotask(() => f.focus({ preventScroll: true }));
  }

  // ── Arrastre (solo sheet) ──────────────────────────────────────────────

  protected inicioArrastre(e: PointerEvent): void {
    if (!this.esSheet() || this.estado !== 'abierto' || e.button !== 0 || !this.dismissable()) return;
    const panel = this.panelRef()!.nativeElement;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panel.getAnimations().forEach((a) => {
      a.commitStyles();
      a.cancel();
    });
    this.desplazamiento = new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42;
    this.arrastre = { y0: e.clientY - this.desplazamiento, muestras: [{ y: e.clientY, t: e.timeStamp }] };
  }

  protected moverArrastre(e: PointerEvent): void {
    if (!this.arrastre) return;
    let dy = e.clientY - this.arrastre.y0;
    if (dy < 0) dy = -Math.pow(-dy, 0.7); // resistencia elástica hacia arriba
    this.desplazamiento = dy;
    this.arrastre.muestras.push({ y: e.clientY, t: e.timeStamp });
    if (this.arrastre.muestras.length > 6) this.arrastre.muestras.shift();

    const panel = this.panelRef()!.nativeElement;
    panel.style.transform = `translateY(${dy}px)`;
    const p = Math.min(Math.max(dy / panel.offsetHeight, 0), 1);
    const velo = this.veloRef()?.nativeElement;
    if (velo) {
      velo.style.transition = 'none';
      velo.style.opacity = String(1 - p);
    }
    this.stack.seguirGesto(this, 1 - p);
  }

  protected finArrastre(e: PointerEvent): void {
    if (!this.arrastre) return;
    const m = this.arrastre.muestras;
    this.arrastre = null;
    const a = m[0];
    const b = m[m.length - 1] ?? a;
    const dt = Math.max((b.t - a.t) / 1000, 0.001);
    const vPx = e.type === 'pointercancel' ? 0 : (b.y - a.y) / dt;
    const panel = this.panelRef()!.nativeElement;
    const alto = panel.offsetHeight;

    if (this.desplazamiento + vPx * 0.2 > alto * 0.45 || vPx > 900) {
      const restante = Math.max(alto * 1.05 - this.desplazamiento, 1);
      this.pedirCierre(limitar(vPx / restante));
      return;
    }
    // Vuelve a su sitio con la velocidad del gesto.
    const d = Math.abs(this.desplazamiento) < 1 ? 0 : this.desplazamiento;
    const smooth = this.springs.spring('smooth');
    animateSpring(panel, [{ transform: 'translateY(0px)' }], smooth, {
      velocity: d === 0 ? 0 : limitar(-vPx / d),
    })
      .finished.then(() => {
        if (this.estado === 'abierto' && !this.arrastre) panel.style.transform = '';
      })
      .catch(() => {});
    const velo = this.veloRef()?.nativeElement;
    if (velo) {
      velo.style.transition = 'opacity 200ms ease-out';
      velo.style.opacity = '1';
    }
    this.stack.entrarDeNuevo(this, smooth);
  }
}
