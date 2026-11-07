// Isla de Nova: pastilla oscura en el centro del header que cambia de forma
// según lo que pasa (ver IslaService). Reposo → lema; actividad → proceso en
// curso con anillo de progreso; aviso → mensaje breve; expandida → detalle de
// cada proceso con «Ver» y su acción.
//
// Fuera del Inicio y del Agente, la isla también da acceso al Agente Nova: en
// reposo muestra el orbe con «Pregúntale a Nova», y con un proceso o un aviso el
// orbe queda como burbuja a la izquierda (solo si el usuario tiene el Agente).
// Al tocarlo la isla se agranda en un chat rápido con Nova (IslaChatService) y
// ofrece «Abrir en el Agente» para seguir la misma conversación en la App.
//
// El tamaño de cada estado es fijo (ancho/alto/radio) para poder animar el
// cambio de forma con CSS; el contenido entra con un fundido corto.

import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';
import { ActividadIsla, IslaService, TonoAviso } from '../../core/services/isla.service';
import { ApplicationsService } from '../../core/services/applications.service';
import { AlmaSphereComponent } from './alma-sphere.component';
import { IslaChatService } from '../../features/agente-alma/isla-chat.service';

const ICONO_AVISO: Record<TonoAviso, string> = {
  info: 'info',
  ok: 'check-circle-2',
  error: 'alert-triangle',
};

const ID_AGENTE = 'app-agente-alma';
const RUTA_AGENTE = '/apps/agente-alma';

/** Filas visibles en la isla expandida (el resto se resume en «y N más»). */
const MAX_FILAS = 3;

@Component({
  selector: 'alma-isla',
  imports: [DecimalPipe, NgTemplateOutlet, FormsModule, LucideAngularModule, AlmaSphereComponent],
  host: {
    // Escritorio: centrada en el header. Móvil: debajo del header y solo si hay algo.
    class:
      'fixed left-1/2 top-[84px] z-40 flex -translate-x-1/2 items-start gap-1.5 md:absolute md:top-[22px]',
    '[class.max-md:hidden]': "isla.modo() === 'reposo'",
    '[class.md:-translate-x-[calc(50%+23px)]]': 'burbujaAgente()',
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
    <!-- Acceso al Agente mientras la isla está ocupada (proceso o aviso). -->
    @if (burbujaAgente()) {
      <button
        type="button"
        class="isla isla-burbuja flex h-10 w-10 items-center justify-center rounded-full p-1.5"
        aria-label="Pregúntale a Nova"
        (click)="chatSvc.abrir()"
      >
        <alma-sphere />
      </button>
    }

    <div
      [attr.role]="isla.modo() === 'chat' ? 'dialog' : 'button'"
      [attr.tabindex]="isla.modo() === 'chat' ? null : 0"
      class="isla cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
      [style.width]="'min(' + forma().w + 'px, 92vw)'"
      [style.height.px]="forma().h"
      [style.border-radius.px]="forma().r"
      [attr.aria-expanded]="isla.modo() === 'chat' ? null : isla.modo() === 'expandida'"
      [attr.aria-label]="etiqueta()"
      (click)="clic()"
      (keydown.enter)="clic()"
      (keydown.space)="$event.preventDefault(); clic()"
    >
      @switch (isla.modo()) {
        @case ('reposo') {
          @if (orbeEnIsla()) {
            <span class="isla-contenido flex h-full items-center gap-2.5 pl-1 pr-4 text-[13px] font-medium text-white/90">
              <span class="h-7 w-7 shrink-0"><alma-sphere /></span>
              Pregúntale a Nova
            </span>
          } @else {
            <span class="isla-contenido flex h-full items-center justify-center gap-2 text-[13px] font-medium text-white/85">
              <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
              Tu hub de operaciones
            </span>
          }
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
        @case ('chat') {
          <span
            class="isla-contenido flex h-full cursor-default flex-col"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <span class="flex items-center gap-2 px-3.5 pb-2 pt-3">
              <span class="h-7 w-7 shrink-0"><alma-sphere /></span>
              <span class="flex-1 text-[14px] font-semibold">Nova</span>
              @if (chatSvc.mensajes().length > 0) {
                <button
                  type="button"
                  class="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40"
                  aria-label="Nueva conversación"
                  title="Nueva conversación"
                  [disabled]="chatSvc.respondiendo()"
                  (click)="chatSvc.nueva()"
                >
                  <lucide-icon name="message-square-plus" [size]="15" />
                </button>
              }
              <button
                type="button"
                class="inline-flex h-7 items-center gap-1 rounded-full bg-white/10 px-3 text-[12px] font-medium hover:bg-white/20 disabled:opacity-40"
                [disabled]="chatSvc.respondiendo()"
                (click)="abrirEnAgente()"
              >
                Abrir en el Agente <lucide-icon name="arrow-up-right" [size]="12" />
              </button>
              <button
                type="button"
                class="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
                (click)="cerrarTodo()"
              >
                <lucide-icon name="x" [size]="15" />
              </button>
            </span>

            @if (chatSvc.mensajes().length === 0) {
              <span class="px-4 pb-2 text-[13px] text-white/70">¡Hola! Soy Nova. ¿Qué movemos hoy?</span>
            } @else {
              <span #chatScroll class="flex flex-1 flex-col gap-2 overflow-y-auto px-3.5 py-1" aria-live="polite">
                @for (m of chatSvc.mensajes(); track m.key) {
                  @if (m.rol === 'user') {
                    <span class="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary/25 px-3 py-2 text-[13px]">{{ m.contenido }}</span>
                  } @else if (m.contenido) {
                    <span class="max-w-[92%] self-start whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white/[0.08] px-3 py-2 text-[13px] leading-relaxed">{{ m.contenido }}</span>
                  }
                }
                @if (chatSvc.pensando()) {
                  <span class="self-start px-1 text-[12px] text-white/60">Nova está pensando…</span>
                }
              </span>
            }

            <form class="flex items-center gap-2 px-3 pb-3 pt-2" (submit)="$event.preventDefault(); enviar()">
              <input
                #chatInput
                type="text"
                name="pregunta"
                [(ngModel)]="pregunta"
                autocomplete="off"
                placeholder="Cuéntame qué necesitas…"
                aria-label="Pregunta para Nova"
                class="h-10 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[13px] text-white outline-none placeholder:text-white/45 focus:bg-white/15"
              />
              <button
                type="submit"
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Enviar a Nova"
                [disabled]="!pregunta.trim() || chatSvc.respondiendo()"
              >
                <lucide-icon name="send" [size]="16" />
              </button>
            </form>
          </span>
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
  protected readonly chatSvc = inject(IslaChatService);
  private readonly router = inject(Router);
  private readonly apps = inject(ApplicationsService);
  private readonly el = inject(ElementRef<HTMLElement>);

  private readonly ruta = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** El orbe da acceso al Agente fuera del Inicio (que ya tiene su tarjeta) y
   *  fuera del propio Agente, solo si el usuario tiene la App. */
  protected readonly orbeEnIsla = computed(() => {
    const ruta = this.ruta().split(/[?#]/)[0];
    if (ruta === '/' || ruta.startsWith(RUTA_AGENTE)) return false;
    return this.apps.applications().some((a) => a.id === ID_AGENTE);
  });

  protected pregunta = '';
  private readonly chatScroll = viewChild<ElementRef<HTMLElement>>('chatScroll');
  private readonly chatInput = viewChild<ElementRef<HTMLInputElement>>('chatInput');

  constructor() {
    // Al abrir el chat, foco en la pregunta.
    effect(() => {
      const input = this.chatInput();
      if (this.isla.modo() === 'chat' && input) setTimeout(() => input.nativeElement.focus(), 320);
    });
    // Siempre al último mensaje mientras llega la respuesta.
    effect(() => {
      this.chatSvc.mensajes();
      const el = this.chatScroll()?.nativeElement;
      if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
    });
  }

  /** Con la isla ocupada, el orbe pasa a una burbuja a la izquierda. */
  protected readonly burbujaAgente = computed(
    () => this.orbeEnIsla() && ['actividad', 'aviso'].includes(this.isla.modo()),
  );

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
      case 'chat':
        return { w: 460, h: this.chatSvc.mensajes().length ? 440 : 150, r: 28 };
      case 'expandida': {
        const filas = this.filas().length;
        return { w: 420, h: 24 + filas * 96 + (this.restantes() ? 22 : 0), r: 30 };
      }
      default:
        return this.orbeEnIsla() ? { w: 196, h: 36, r: 18 } : { w: 232, h: 36, r: 18 };
    }
  });

  protected readonly etiqueta = computed(() => {
    const a = this.isla.aviso();
    if (a) return `${a.titulo}. Clic para cerrar`;
    const n = this.isla.actividades().length;
    if (this.isla.chat()) return 'Chat con Nova';
    if (n === 0) return this.orbeEnIsla() ? 'Pregúntale a Nova' : 'Tu hub de operaciones';
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

  protected clic(): void {
    const modo = this.isla.modo();
    if (modo === 'chat') return;
    if (modo === 'reposo' && this.orbeEnIsla()) this.chatSvc.abrir();
    else this.isla.alternar();
  }

  protected enviar(): void {
    const texto = this.pregunta;
    this.pregunta = '';
    void this.chatSvc.enviar(texto);
  }

  /** Sigue la misma conversación en la App del Agente. */
  protected abrirEnAgente(): void {
    const id = this.chatSvc.conversacionId();
    this.isla.cerrar();
    this.chatSvc.nueva();
    void this.router.navigate([RUTA_AGENTE], { queryParams: id ? { conversacion: id } : {} });
  }

  /** Cierra la isla; si Nova sigue respondiendo, queda como actividad. */
  protected cerrarTodo(): void {
    if (this.isla.chat()) this.chatSvc.alCerrar();
    this.isla.cerrar();
  }

  protected ver(act: ActividadIsla): void {
    this.isla.cerrar();
    if (act.ruta) void this.router.navigateByUrl(act.ruta);
  }

  @HostListener('document:click', ['$event'])
  protected clicFuera(ev: MouseEvent): void {
    if (!this.el.nativeElement.contains(ev.target as Node)) this.cerrarTodo();
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.cerrarTodo();
  }
}
