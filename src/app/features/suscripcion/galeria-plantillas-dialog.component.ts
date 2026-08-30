// Galería de plantillas — réplica del EmailTemplatesModal de Dali: buscador,
// pestañas de categoría, y tarjetas glass con MINIATURA real del HTML
// (escalado 25%), overlay al pasar el mouse, nombre, asunto y badges.

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { PlantillaCorreoApi } from './suscripcion.api';

@Component({
  selector: 'alma-galeria-plantillas-dialog',
  imports: [FormsModule, LucideAngularModule],
  styles: [`
    .card { position: relative; display: flex; flex-direction: column; overflow: hidden;
      border-radius: 12px; cursor: pointer; text-align: left;
      background: color-mix(in oklab, var(--background) 60%, transparent);
      border: 1px solid color-mix(in oklab, var(--border) 40%, transparent);
      box-shadow: 0 4px 24px -4px rgb(0 0 0 / .06);
      transition: transform .3s, box-shadow .3s, border-color .3s; }
    .card:hover { transform: translateY(-4px);
      border-color: color-mix(in oklab, var(--primary) 25%, transparent);
      box-shadow: 0 8px 32px -4px color-mix(in oklab, var(--primary) 15%, transparent); }
    .card:hover .borde { opacity: 1; }
    .borde { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; opacity: 0;
      background: linear-gradient(90deg, var(--primary), #34d399); transition: opacity .3s; }
    .thumb { position: relative; height: 168px; overflow: hidden; background: #fff;
      border-bottom: 1px solid color-mix(in oklab, var(--border) 40%, transparent); }
    .thumb .mini { position: absolute; inset: 0; padding: 8px; overflow: hidden;
      pointer-events: none; transform: scale(0.25); transform-origin: top left;
      width: 400%; height: 400%; color: #1f2937; background: #fff;
      font-family: Arial, sans-serif; font-size: 14px; }
    .thumb .velo { position: absolute; inset: 0; display: flex; align-items: flex-end;
      justify-content: center; padding-bottom: 12px; opacity: 0; transition: opacity .3s;
      background: linear-gradient(to top, rgb(0 0 0 / .4), transparent 50%); }
    .card:hover .velo { opacity: 1; }
    .velo span { color: #fff; font-size: 12px; font-weight: 500; padding: 4px 12px;
      border-radius: 999px; background: rgb(0 0 0 / .3); backdrop-filter: blur(4px); }
    .cat { display: inline-flex; align-items: center; border: 0; cursor: pointer;
      padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 500;
      background: color-mix(in oklab, var(--muted) 50%, transparent);
      color: var(--muted-foreground); white-space: nowrap; }
    .cat.on { background: var(--primary); color: #fff; }
  `],
  template: `
    <div class="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" (click)="closed.emit()">
      <div
        class="surface-solid flex max-h-[90vh] w-full max-w-4xl flex-col gap-3 rounded-2xl border-l-[3px] border border-border border-l-primary px-4 pb-4 pt-3 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <!-- Header (estilo Dali) -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2.5">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 shadow-md shadow-primary/25">
              <lucide-icon name="file-text" [size]="16" class="text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-base font-semibold leading-tight tracking-tight">Plantillas de Correo</h2>
              <p class="text-[10px] leading-tight text-muted-foreground">Elige una plantilla para tu correo</p>
            </div>
          </div>
          <button type="button" (click)="closed.emit()" aria-label="Cerrar"
                  class="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <lucide-icon name="x" [size]="16" />
          </button>
        </div>

        <!-- Búsqueda + categorías -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-[200px] flex-1">
            <lucide-icon name="search" [size]="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input [(ngModel)]="busqueda" placeholder="Buscar plantilla…"
                   class="alma-input h-9 w-full rounded-xl pl-8 text-sm" />
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" class="cat" [class.on]="categoria() === ''" (click)="categoria.set('')">Todas</button>
            @for (c of categorias(); track c) {
              <button type="button" class="cat" [class.on]="categoria() === c" (click)="categoria.set(c)">{{ c }}</button>
            }
          </div>
        </div>

        <!-- Grid de tarjetas con miniatura -->
        <div class="min-h-0 flex-1 overflow-y-auto">
          @if (filtradas().length === 0) {
            <div class="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
              <lucide-icon name="file-text" [size]="28" />
              No hay plantillas para esa búsqueda.
            </div>
          } @else {
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              @for (p of filtradas(); track p.id) {
                <button type="button" class="card" (click)="seleccionar.emit(p)">
                  <div class="thumb">
                    <div class="mini" [innerHTML]="p.cuerpo_html"></div>
                    <div class="velo"><span>Usar plantilla</span></div>
                  </div>
                  <div class="flex flex-1 flex-col gap-1 p-3">
                    <h4 class="line-clamp-2 text-sm font-semibold leading-snug">{{ p.nombre }}</h4>
                    <p class="line-clamp-1 text-xs text-muted-foreground">{{ p.asunto }}</p>
                    <div class="mt-auto flex flex-wrap gap-1.5 pt-1">
                      <span class="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                        {{ p.categoria }}
                      </span>
                      @if (!p.activa) {
                        <span class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Inactiva</span>
                      }
                    </div>
                  </div>
                  <div class="borde"></div>
                </button>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class GaleriaPlantillasDialogComponent {
  readonly plantillas = input.required<PlantillaCorreoApi[]>();
  readonly closed = output<void>();
  readonly seleccionar = output<PlantillaCorreoApi>();

  protected busqueda = '';
  protected readonly categoria = signal('');

  protected readonly categorias = computed(() =>
    [...new Set(this.plantillas().map((p) => p.categoria))].sort(),
  );

  protected filtradas(): PlantillaCorreoApi[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.plantillas().filter(
      (p) =>
        (!this.categoria() || p.categoria === this.categoria()) &&
        (!q ||
          p.nombre.toLowerCase().includes(q) ||
          p.asunto.toLowerCase().includes(q)),
    );
  }
}
