// Dock maximizado (estilo Launchpad): TODAS las Apps con buscador. El orden es
// una secuencia ÚNICA con un DIVISOR; lo anterior al divisor son las Apps
// ancladas al Dock (1..MAX_DOCK). Reemplaza a /applications.
// (Paridad layout/DockLaunchpad.tsx.)

import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Application } from '../../core/models/platform.models';
import { OrderedAppsService } from '../../core/services/ordered-apps.service';
import { PreferencesService, clampDock } from '../../core/services/preferences.service';
import { AppIconArtComponent } from './app-icon-art.component';
import { TouchDrag, setCloneDragImage } from '../drag-utils';

const DIVIDER = '__divider__';

@Component({
  selector: 'alma-dock-launchpad',
  imports: [NgTemplateOutlet, LucideAngularModule, AppIconArtComponent],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-[80] flex flex-col bg-[rgba(20,30,25,.35)] backdrop-blur-2xl"
        (click)="closed.emit()"
      >
        <div
          class="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-6 py-10"
          (click)="$event.stopPropagation()"
        >
          <div class="relative mx-auto mb-8 w-full max-w-md shrink-0">
            <lucide-icon
              name="search"
              [size]="16"
              class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              #searchInput
              [value]="query()"
              (input)="query.set(searchInput.value)"
              placeholder="Buscar aplicación…"
              class="surface-solid h-11 w-full rounded-full border border-border pl-10 pr-4 text-sm shadow-[var(--shadow-md)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto">
            @if (resultados(); as res) {
              @if (res.length === 0) {
                <p class="py-16 text-center text-sm text-white/80">
                  No hay aplicaciones que coincidan con “{{ query() }}”.
                </p>
              } @else {
                <div
                  class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-x-4 gap-y-8 sm:gap-x-6"
                >
                  @for (app of res; track app.id) {
                    <ng-container
                      *ngTemplateOutlet="tileTpl; context: { app, reordenable: false }"
                    />
                  }
                </div>
              }
            } @else {
              <div
                class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-x-4 gap-y-8 sm:gap-x-6"
              >
                <!-- Etiqueta superior (soltar aquí → anclar) -->
                <div
                  class="col-span-full"
                  (dragover)="$event.preventDefault(); haciaAncladas()"
                >
                  <p class="text-xs font-semibold uppercase tracking-wider text-white/70">
                    Ancladas al Dock
                  </p>
                </div>
                @for (item of seq(); track item) {
                  @if (item === divider) {
                    <div
                      class="col-span-full"
                      (dragover)="$event.preventDefault(); haciaMas()"
                    >
                      <p class="text-xs font-semibold uppercase tracking-wider text-white/70">
                        Más aplicaciones
                      </p>
                    </div>
                  } @else if (porId().get(item); as app) {
                    <ng-container
                      *ngTemplateOutlet="tileTpl; context: { app, reordenable: true }"
                    />
                  }
                }
              </div>
            }
          </div>
        </div>

        <button
          (click)="closed.emit()"
          aria-label="Cerrar"
          class="surface-solid absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-border shadow-[var(--shadow-md)] hover:bg-accent"
        >
          <lucide-icon name="x" [size]="16" />
        </button>
      </div>
    }

    <ng-template #tileTpl let-app="app" let-reordenable="reordenable">
      <div
        class="dock-reorder select-none"
        [class.cursor-grab]="reordenable"
        [attr.data-drag-id]="app.id"
        [draggable]="reordenable"
        [style.opacity]="hiddenId() === app.id ? 0 : 1"
        (dragstart)="reordenable && iniciarDrag($any($event), app)"
        (dragover)="reordenable && sobreTileEvent($any($event), app.id)"
        (drop)="$event.preventDefault()"
        (dragend)="reordenable && terminar()"
        (touchstart)="reordenable && touch.begin($any($event), app.id)"
        [title]="app.descripcion"
      >
        <a
          [attr.href]="app.internalRoute ? null : app.url"
          [attr.target]="app.internalRoute ? null : '_blank'"
          rel="noreferrer"
          [attr.aria-label]="app.nombre"
          draggable="false"
          class="block cursor-pointer"
          (click)="abrir($any($event), app)"
        >
          <div class="flex flex-col items-center gap-2">
            <div
              class="h-[72px] w-[72px] overflow-hidden rounded-[22%] shadow-[0_6px_14px_rgba(0,0,0,.16)] transition-transform hover:scale-105 active:scale-95"
            >
              <alma-app-icon-art [app]="app" iconClassName="h-9 w-9" />
            </div>
            <span
              class="max-w-[96px] truncate text-center text-xs font-medium text-white drop-shadow"
            >
              {{ app.nombre }}
            </span>
          </div>
        </a>
      </div>
    </ng-template>
  `,
})
export class DockLaunchpadComponent {
  private readonly orderedApps = inject(OrderedAppsService);
  private readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  protected readonly divider = DIVIDER;
  protected readonly query = signal('');
  protected readonly hiddenId = signal<string | null>(null);
  private readonly liveSeq = signal<string[] | null>(null);
  private dragId: string | null = null;

  protected readonly porId = computed(
    () => new Map(this.orderedApps.ordered().map((a) => [a.id, a])),
  );

  private readonly baseSeq = computed(() => {
    const ids = this.orderedApps.ordered().map((a) => a.id);
    const corte = clampDock(Math.min(this.prefs.dockCount(), ids.length));
    return [...ids.slice(0, corte), DIVIDER, ...ids.slice(corte)];
  });

  protected readonly seq = computed(() => this.liveSeq() ?? this.baseSeq());

  protected readonly resultados = computed<Application[] | null>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return null;
    return this.orderedApps
      .ordered()
      .filter(
        (a) => a.nombre.toLowerCase().includes(q) || a.descripcion.toLowerCase().includes(q),
      );
  });

  protected readonly touch = new TouchDrag({
    onStart: (id) => {
      this.dragId = id;
      this.liveSeq.set(this.baseSeq());
      this.hiddenId.set(id);
    },
    onOver: (overId, after) => this.sobreTile(overId, after),
    onEnd: () => this.terminar(),
  });

  private normalizar(s: string[]): string[] {
    const di = s.indexOf(DIVIDER);
    const clamped = clampDock(di);
    if (clamped === di) return s;
    const sin = s.filter((x) => x !== DIVIDER);
    sin.splice(clamped, 0, DIVIDER);
    return sin;
  }

  private moverA(s: string[], id: string, index: number): string[] {
    const sin = s.filter((x) => x !== id);
    sin.splice(Math.max(0, Math.min(index, sin.length)), 0, id);
    return this.normalizar(sin);
  }

  private sobreTile(targetId: string, after: boolean): void {
    const id = this.dragId;
    const live = this.liveSeq();
    if (!id || id === targetId || !live) return;
    const rest = live.filter((x) => x !== id);
    let ti = rest.indexOf(targetId);
    if (ti < 0) return;
    if (after) ti += 1;
    this.liveSeq.set(this.moverA(live, id, ti));
  }

  protected sobreTileEvent(ev: DragEvent, targetId: string): void {
    ev.preventDefault();
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.sobreTile(targetId, ev.clientX > r.left + r.width / 2);
  }

  protected haciaMas(): void {
    const id = this.dragId;
    const live = this.liveSeq();
    if (!id || !live) return;
    const di = live.filter((x) => x !== id).indexOf(DIVIDER);
    this.liveSeq.set(this.moverA(live, id, di + 1));
  }

  protected haciaAncladas(): void {
    const id = this.dragId;
    const live = this.liveSeq();
    if (!id || !live) return;
    this.liveSeq.set(this.moverA(live, id, 0));
  }

  protected iniciarDrag(e: DragEvent, app: Application): void {
    this.dragId = app.id;
    this.liveSeq.set(this.baseSeq());
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    setCloneDragImage(e, e.currentTarget as HTMLElement);
    setTimeout(() => this.hiddenId.set(app.id), 0);
  }

  protected terminar(): void {
    const live = this.liveSeq();
    if (live) {
      const di = live.indexOf(DIVIDER);
      this.prefs.appOrder.set(live.filter((x) => x !== DIVIDER));
      this.prefs.setDockCount(di);
    }
    this.dragId = null;
    this.liveSeq.set(null);
    this.hiddenId.set(null);
  }

  protected abrir(ev: MouseEvent, app: Application): void {
    this.prefs.pushRecent(app.id);
    this.closed.emit();
    if (app.internalRoute) {
      ev.preventDefault();
      void this.router.navigateByUrl(app.internalRoute);
    }
  }
}
