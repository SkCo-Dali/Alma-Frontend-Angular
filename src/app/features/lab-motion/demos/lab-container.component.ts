// Transición de contenedor (container transform / «hero»).
//
// La tarjeta que tocas SE CONVIERTE en la pantalla siguiente: su caja crece
// hasta ocupar el panel, y el ícono y el título viajan a su nueva posición por
// separado. Volver hace el camino inverso hacia la tarjeta de origen.
//
// Usa la View Transitions API (la misma que se activaría en el router con
// withViewTransitions()) con la curva del spring «smooth». Sin soporte del
// navegador o con reduced motion, el cambio es directo.

import { ApplicationRef, Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PressDirective } from '../motion/press.directive';
import { prefiereMenosMovimiento } from '../../../shared/motion/spring';

interface AppDemo {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  color: string;
}

type DocConVT = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

@Component({
  selector: 'nova-lab-container',
  imports: [LucideAngularModule, PressDirective],
  encapsulation: ViewEncapsulation.None,
  styles: `
    /* Solo durante la transición del laboratorio (clase en <html>), para no
       afectar ninguna otra pantalla. */
    html.nv-vt-lab::view-transition-old(root),
    html.nv-vt-lab::view-transition-new(root) {
      animation: none;
    }
    html.nv-vt-lab::view-transition-group(*) {
      animation-duration: var(--spring-smooth-dur);
      animation-timing-function: var(--spring-smooth);
    }
    html.nv-vt-lab::view-transition-old(*),
    html.nv-vt-lab::view-transition-new(*) {
      animation-duration: calc(var(--spring-smooth-dur) * 0.45);
      animation-timing-function: ease-out;
    }
    /* Container transform: la CAJA crece y recorta; su contenido no se estira,
       queda anclado arriba a la izquierda a su tamaño real. */
    html.nv-vt-lab::view-transition-group(nv-app-caja) {
      overflow: hidden;
      border-radius: 22px;
    }
    html.nv-vt-lab::view-transition-old(nv-app-caja),
    html.nv-vt-lab::view-transition-new(nv-app-caja) {
      width: 100%;
      height: 100%;
      object-fit: none;
      object-position: left top;
    }
  `,
  template: `
    <div class="relative min-h-[380px]">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        @for (app of apps; track app.id) {
          <button
            novaPress
            type="button"
            class="flex flex-col items-start gap-3 rounded-[20px] border border-border bg-card p-4 text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
            [style.view-transition-name]="nombreVT(app, 'caja')"
            (click)="abrir(app)"
          >
            <span
              class="grid size-12 place-items-center rounded-[14px] text-white"
              [style.background]="app.color"
              [style.view-transition-name]="nombreVT(app, 'icono')"
            >
              <lucide-icon [name]="app.icono" [size]="24" />
            </span>
            <span
              class="text-[15px] font-semibold"
              [style.view-transition-name]="nombreVT(app, 'titulo')"
              >{{ app.nombre }}</span
            >
            <span class="text-xs text-muted-foreground">{{ app.descripcion }}</span>
          </button>
        }
      </div>

      @if (abierta(); as app) {
        <div
          class="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-[var(--shadow-lg)]"
          style="view-transition-name: nv-app-caja"
        >
          <div class="flex items-center gap-4 p-5">
            <button
              novaPress
              type="button"
              class="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground"
              aria-label="Volver"
              (click)="cerrar()"
            >
              <lucide-icon name="arrow-left" [size]="18" />
            </button>
            <span
              class="grid size-16 place-items-center rounded-[18px] text-white"
              style="view-transition-name: nv-app-icono"
              [style.background]="app.color"
            >
              <lucide-icon [name]="app.icono" [size]="32" />
            </span>
            <div>
              <h3 class="text-2xl font-bold tracking-tight" style="view-transition-name: nv-app-titulo">
                {{ app.nombre }}
              </h3>
              <p class="text-sm text-muted-foreground">{{ app.descripcion }}</p>
            </div>
          </div>
          <div class="grid flex-1 grid-cols-3 gap-3 px-5 pb-5">
            @for (k of kpis; track k.titulo; let i = $index) {
              <div
                class="nv-lab-aparece rounded-[16px] bg-background p-4"
                [style.animation-delay.ms]="120 + i * 40"
              >
                <div class="text-xs text-muted-foreground">{{ k.titulo }}</div>
                <div class="mt-1 text-2xl font-bold tabular-nums">{{ k.valor }}</div>
              </div>
            }
            <div
              class="nv-lab-aparece col-span-3 rounded-[16px] bg-background p-4"
              style="animation-delay: 240ms"
            >
              <div class="mb-3 text-xs text-muted-foreground">Actividad reciente</div>
              @for (f of [1, 2, 3]; track f) {
                <div class="mb-2 h-3 rounded-full bg-foreground/8" [style.width.%]="90 - f * 18"></div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class LabContainerComponent {
  private readonly appRef = inject(ApplicationRef);

  protected readonly apps: AppDemo[] = [
    { id: 'com', nombre: 'Comisiones', descripcion: 'Motor y parametrización', icono: 'calculator', color: '#00a63e' },
    { id: 'buz', nombre: 'Buzón', descripcion: 'Correo clasificado por IA', icono: 'inbox', color: '#2f6fde' },
    { id: 'sus', nombre: 'Suscripción', descripcion: 'Pipeline de pólizas', icono: 'file-text', color: '#e07a1f' },
    { id: 'mon', nombre: 'Monitor-IA', descripcion: 'Calidad de llamadas', icono: 'bar-chart-3', color: '#8a4fd8' },
  ];
  protected readonly kpis = [
    { titulo: 'Hoy', valor: '1.284' },
    { titulo: 'Pendientes', valor: '37' },
    { titulo: 'Tasa de éxito', valor: '98,2%' },
  ];

  protected readonly abierta = signal<AppDemo | null>(null);
  /** Tarjeta que participa en la transición (la de origen/destino). */
  private readonly participante = signal<string | null>(null);

  protected nombreVT(app: AppDemo, parte: string): string {
    return this.participante() === app.id && !this.abierta() ? `nv-app-${parte}` : 'none';
  }

  protected abrir(app: AppDemo): void {
    this.participante.set(app.id);
    this.transicion(() => this.abierta.set(app));
  }

  protected cerrar(): void {
    this.transicion(() => this.abierta.set(null));
  }

  private transicion(cambio: () => void): void {
    const doc = document as DocConVT;
    if (!doc.startViewTransition || prefiereMenosMovimiento()) {
      cambio();
      return;
    }
    // La tarjeta de origen necesita su nombre ANTES de la captura inicial.
    this.appRef.tick();
    const html = document.documentElement;
    html.classList.add('nv-vt-lab');
    const t = doc.startViewTransition(() => {
      cambio();
      this.appRef.tick();
    });
    t.finished.finally(() => html.classList.remove('nv-vt-lab'));
  }
}
