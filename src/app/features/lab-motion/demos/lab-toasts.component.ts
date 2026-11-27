// Toasts apilados al estilo de las notificaciones de iOS.
//
// - Los avisos se agrupan en una pila: el más nuevo adelante, los anteriores
//   asoman detrás, más pequeños.
// - Al pasar el mouse la pila se despliega en lista; al salir se recoge. Ambos
//   movimientos son springs, así que se pueden interrumpir a mitad de camino.
// - Entrada y salida con `animate.enter` / `animate.leave` nativos de Angular.
//   La posición en la pila usa las propiedades `translate`/`scale` y la entrada
//   anima `transform`: se componen sin pisarse.

import { Component, OnDestroy, computed, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PressDirective } from '../../../shared/motion/press.directive';

interface Toast {
  id: number;
  titulo: string;
  texto: string;
  icono: string;
  color: string;
}

const MUESTRAS: Omit<Toast, 'id'>[] = [
  { titulo: 'Liquidación lista', texto: '1.284 registros procesados', icono: 'check', color: '#00a63e' },
  { titulo: 'Nuevo correo clasificado', texto: 'Buzón SAC · Reclamaciones', icono: 'mail', color: '#2f6fde' },
  { titulo: 'Carga masiva', texto: '3 filas con advertencias', icono: 'alert-triangle', color: '#e0a21f' },
  { titulo: 'Póliza aprobada', texto: 'Suscripción · Vida individual', icono: 'sparkles', color: '#8a4fd8' },
];

const ALTO = 64;
const SEPARACION = 8;
const VISIBLES = 3;

@Component({
  selector: 'nova-lab-toasts',
  imports: [LucideAngularModule, PressDirective],
  styles: `
    .toast {
      transition-property: translate, scale, opacity;
      transition-duration: var(--spring-smooth-dur);
      transition-timing-function: var(--spring-smooth);
    }
    .entra {
      animation: entra var(--spring-bouncy-dur) var(--spring-bouncy) both;
    }
    @keyframes entra {
      from {
        transform: translateY(calc(100% + 24px)) scale(0.9);
        opacity: 0;
      }
    }
    .sale {
      animation: sale 0.22s cubic-bezier(0.4, 0, 1, 1) both;
    }
    @keyframes sale {
      to {
        transform: translateX(60%) scale(0.95);
        opacity: 0;
      }
    }
  `,
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap gap-2">
        <button
          novaPress
          type="button"
          class="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
          (click)="agregar()"
        >
          Lanzar aviso
        </button>
        <button
          novaPress
          type="button"
          class="h-9 rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground"
          (click)="toasts.set([])"
        >
          Limpiar
        </button>
      </div>

      <div
        class="relative h-[300px] overflow-hidden rounded-[20px] bg-foreground/[0.04]"
        (mouseenter)="desplegada.set(true)"
        (mouseleave)="desplegada.set(false)"
      >
        @if (toasts().length === 0) {
          <p class="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            Lanza varios avisos y pasa el mouse por la pila.
          </p>
        }
        @for (t of toasts(); track t.id; let i = $index) {
          <div
            class="toast absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-[18px] border border-border bg-card px-3 shadow-[var(--shadow-md)]"
            animate.enter="entra"
            animate.leave="sale"
            [style.height.px]="alto"
            [style.z-index]="100 - posicion(i)"
            [style.translate]="desplazamiento(i)"
            [style.scale]="escala(i)"
            [style.opacity]="opacidad(i)"
          >
            <span class="grid size-9 shrink-0 place-items-center rounded-full text-white" [style.background]="t.color">
              <lucide-icon [name]="t.icono" [size]="18" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{{ t.titulo }}</span>
              <span class="block truncate text-xs text-muted-foreground">{{ t.texto }}</span>
            </span>
            <button
              type="button"
              class="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
              aria-label="Descartar"
              (click)="quitar(t.id)"
            >
              <lucide-icon name="x" [size]="14" />
            </button>
          </div>
        }
        @if (toasts().length > 1 && !desplegada()) {
          <span class="absolute right-6 top-4 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium">
            {{ toasts().length }} avisos
          </span>
        }
      </div>
    </div>
  `,
})
export class LabToastsComponent implements OnDestroy {
  protected readonly alto = ALTO;
  protected readonly toasts = signal<Toast[]>([]);
  protected readonly desplegada = signal(false);
  private readonly total = computed(() => this.toasts().length);
  private sig = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  /** 0 = el más nuevo (al frente). El arreglo guarda el más viejo primero. */
  protected posicion(i: number): number {
    return this.total() - 1 - i;
  }

  protected desplazamiento(i: number): string {
    const p = this.posicion(i);
    const y = this.desplegada() ? -p * (ALTO + SEPARACION) : -p * 12;
    return `0 ${y}px`;
  }

  protected escala(i: number): string {
    const p = this.posicion(i);
    return this.desplegada() ? '1' : String(1 - Math.min(p, VISIBLES) * 0.05);
  }

  protected opacidad(i: number): string {
    const p = this.posicion(i);
    if (this.desplegada()) return '1';
    return p >= VISIBLES ? '0' : '1';
  }

  protected agregar(): void {
    const base = MUESTRAS[this.sig % MUESTRAS.length];
    const id = ++this.sig;
    this.toasts.update((l) => [...l, { ...base, id }].slice(-5));
    this.timers.set(
      id,
      setTimeout(() => this.quitar(id), 7000),
    );
  }

  protected quitar(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update((l) => l.filter((t) => t.id !== id));
  }

  ngOnDestroy(): void {
    this.timers.forEach((t) => clearTimeout(t));
  }
}
