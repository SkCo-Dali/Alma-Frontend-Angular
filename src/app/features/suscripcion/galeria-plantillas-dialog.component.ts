// Galería de plantillas — réplica del EmailTemplatesModal de Dali:
// header con buscador inline + botón Buscar, pestañas glass de TIPO
// (Todas / Mis plantillas) y de CATEGORÍA, tarjetas con miniatura real del
// HTML y overlay "Ver plantilla" al hover, y el MODAL DE PREVISUALIZACIÓN
// encima (700px) con el botón "Usar esta plantilla" — igual que en Dali,
// donde el clic en la tarjeta previsualiza y desde ahí se usa.

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { PlantillaCorreoApi } from './suscripcion.api';

@Component({
  selector: 'alma-galeria-plantillas-dialog',
  imports: [FormsModule, LucideAngularModule],
  styles: [`
    .glass { background: color-mix(in oklab, var(--background) 60%, transparent);
      border: 1px solid color-mix(in oklab, var(--border) 40%, transparent);
      box-shadow: 0 4px 24px -4px rgb(0 0 0 / .06); border-radius: 10px; }
    .tab { display: inline-flex; align-items: center; gap: 6px; border: 0;
      padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500;
      background: transparent; color: var(--muted-foreground); cursor: pointer;
      white-space: nowrap; flex-shrink: 0; transition: all .3s; }
    .tab:hover { color: var(--foreground);
      background: color-mix(in oklab, var(--background) 70%, transparent); }
    .tab.on { color: #fff; background: linear-gradient(90deg, var(--primary), #34d399);
      box-shadow: 0 2px 8px color-mix(in oklab, var(--primary) 20%, transparent); }
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
    .thumb { position: relative; height: 176px; overflow: hidden; background: #fff;
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
  `],
  template: `
    <!-- ── Galería (dims de Dali: max-w-6xl / 85vh) ── -->
    <div class="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" (click)="closed.emit()">
      <div
        class="surface-solid flex max-h-[85vh] w-full max-w-6xl flex-col gap-2 rounded-2xl border border-border px-3 pb-3 pt-3 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <!-- Header: ícono + títulos + buscador inline + Buscar + X (Dali) -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2.5">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 shadow-md shadow-primary/25">
              <lucide-icon name="file-text" [size]="16" class="text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-base font-semibold leading-tight tracking-tight">Plantillas de Correo</h2>
              <p class="text-[10px] leading-tight text-muted-foreground">Selecciona una plantilla para tu correo</p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <input [(ngModel)]="busqueda" placeholder="Buscar plantillas..."
                   class="alma-input h-8 w-48 rounded-lg text-sm sm:w-56" />
            <button type="button"
                    class="h-8 rounded-lg bg-gradient-to-r from-primary to-emerald-500 px-3 text-xs font-medium text-white shadow-md shadow-primary/20">
              Buscar
            </button>
            <button type="button" (click)="closed.emit()" aria-label="Cerrar"
                    class="rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100">
              <lucide-icon name="x" [size]="16" />
            </button>
          </div>
        </div>

        <!-- Pestañas de TIPO (glass, como Dali) -->
        <div class="glass flex items-center gap-1 overflow-x-auto p-1">
          @for (t of tiposTabs; track t.valor) {
            <button type="button" class="tab" [class.on]="tipo() === t.valor" (click)="tipo.set(t.valor)">
              {{ t.label }}
            </button>
          }
        </div>
        <!-- Pestañas de CATEGORÍA -->
        <div class="glass flex items-center gap-1 overflow-x-auto p-1">
          <button type="button" class="tab" [class.on]="categoria() === ''" (click)="categoria.set('')">
            Todas las categorías
          </button>
          @for (c of categorias(); track c) {
            <button type="button" class="tab" [class.on]="categoria() === c" (click)="categoria.set(c)">{{ c }}</button>
          }
        </div>

        <!-- Grid de tarjetas: el CLIC previsualiza (como Dali) -->
        <div class="min-h-0 flex-1 overflow-y-auto pt-1">
          @if (filtradas().length === 0) {
            <div class="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
              <lucide-icon name="file-text" [size]="28" />
              No hay plantillas para esa búsqueda.
            </div>
          } @else {
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              @for (p of filtradas(); track p.id) {
                <button type="button" class="card" (click)="previa.set(p)">
                  <div class="thumb">
                    <div class="mini" [innerHTML]="p.cuerpo_html"></div>
                    <div class="velo"><span>Ver plantilla</span></div>
                  </div>
                  <div class="flex flex-1 flex-col gap-1 p-3">
                    <h4 class="line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-snug">{{ p.nombre }}</h4>
                    <p class="line-clamp-1 text-xs text-muted-foreground">{{ p.asunto }}</p>
                    <div class="mt-auto flex flex-wrap gap-1.5 pt-1">
                      <span class="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">{{ p.categoria }}</span>
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

    <!-- ── Preview Modal (encima, 700px, como Dali) ── -->
    @if (previa(); as p) {
      <div class="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4" (click)="previa.set(null)">
        <div
          class="surface-solid flex max-h-[90vh] w-full max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-border shadow-2xl lg:max-w-[700px]"
          (click)="$event.stopPropagation()"
        >
          <div class="flex shrink-0 items-center justify-between border-b border-border/30 px-5 py-3">
            <h3 class="truncate text-sm font-semibold">{{ p.nombre }}</h3>
            <button type="button" (click)="previa.set(null)" aria-label="Cerrar"
                    class="rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100">
              <lucide-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto bg-white p-5 md:p-8">
            <div class="text-[14px] leading-relaxed text-neutral-800"
                 style="font-family: Arial, 'Segoe UI', sans-serif;"
                 [innerHTML]="p.cuerpo_html"></div>
          </div>
          <div class="flex shrink-0 items-center justify-center gap-2 border-t border-border/30 bg-muted/20 px-5 py-3">
            <button type="button" (click)="usar(p)"
                    class="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-emerald-500 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:shadow-xl active:scale-95">
              <lucide-icon name="mail" [size]="14" /> Usar esta plantilla
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class GaleriaPlantillasDialogComponent {
  private readonly auth = inject(AuthService);

  readonly plantillas = input.required<PlantillaCorreoApi[]>();
  readonly closed = output<void>();
  readonly seleccionar = output<PlantillaCorreoApi>();

  protected busqueda = '';
  protected readonly categoria = signal('');
  protected readonly tipo = signal<'todas' | 'mias'>('todas');
  protected readonly previa = signal<PlantillaCorreoApi | null>(null);

  protected readonly tiposTabs = [
    { valor: 'todas' as const, label: 'Todas' },
    { valor: 'mias' as const, label: 'Mis plantillas' },
  ];

  protected readonly categorias = computed(() =>
    [...new Set(this.plantillas().map((p) => p.categoria))].sort(),
  );

  protected filtradas(): PlantillaCorreoApi[] {
    const q = this.busqueda.trim().toLowerCase();
    const yo = (this.auth.user()?.correo ?? '').toLowerCase();
    return this.plantillas().filter(
      (p) =>
        (this.tipo() === 'todas' ||
          (p.creada_por ?? '').toLowerCase() === yo ||
          (p.actualizada_por ?? '').toLowerCase() === yo) &&
        (!this.categoria() || p.categoria === this.categoria()) &&
        (!q || p.nombre.toLowerCase().includes(q) || p.asunto.toLowerCase().includes(q)),
    );
  }

  protected usar(p: PlantillaCorreoApi): void {
    this.previa.set(null);
    this.seleccionar.emit(p);
  }
}
