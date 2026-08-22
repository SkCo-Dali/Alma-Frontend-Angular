// Dock estilo macOS v2 — navegación única de ALMA (paridad layout/Dock.tsx).
//
// - Magnificación por mousemove (curva BASE + (PEAK-BASE)·t²) con transición CSS.
// - Nav fijo mínimo: Inicio + "Ver todas" (abre el Launchpad).
// - Las Apps ancladas son las primeras `dockCount` del orden ÚNICO del usuario;
//   en pantallas angostas se muestran solo las que caben.
// - Reordenamiento drag & drop EN VIVO (desktop + táctil) y menú contextual
//   (Abrir / Quitar del Dock).
// - Se auto-oculta fuera del inicio (/apps/*, /admin, /settings, /help); el asa
//   inferior lo invoca.

import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Application } from '../../core/models/platform.models';
import {
  MAX_DOCK,
  PreferencesService,
  clampDock,
} from '../../core/services/preferences.service';
import { OrderedAppsService, reordenar } from '../../core/services/ordered-apps.service';
import { AppIconArtComponent } from './app-icon-art.component';
import { DockLaunchpadComponent } from './dock-launchpad.component';
import { TouchDrag, setCloneDragImage } from '../drag-utils';

const BASE = 48; // icono en reposo (px)
const PEAK = 76; // icono bajo el cursor (px)
const RADIUS = 140; // radio de influencia (px)

interface DockEntry {
  key: string;
  label: string;
  active: boolean;
  kind: 'app' | 'nav-img' | 'nav-action';
  app?: Application;
  img?: string;
  to?: string;
  href?: string;
}

@Component({
  selector: 'alma-dock',
  imports: [NgTemplateOutlet, RouterLink, AppIconArtComponent, DockLaunchpadComponent],
  template: `
    <!-- Asa tipo indicador de iPhone -->
    @if (insideApp()) {
      <div
        class="fixed inset-x-0 bottom-0 z-30 flex items-end justify-center"
        (dragenter)="summoned.set(true)"
        (dragover)="$event.preventDefault(); summoned.set(true)"
      >
        <button
          type="button"
          aria-label="Mostrar dock"
          (mouseenter)="summoned.set(true)"
          (click)="summoned.set(true)"
          (focus)="summoned.set(true)"
          class="flex cursor-pointer flex-col items-center px-3 pb-1.5 pt-3 transition-opacity duration-200"
          [style.opacity]="hidden() ? 1 : 0"
          [style.pointerEvents]="hidden() ? 'auto' : 'none'"
        >
          <span
            class="glass-strong h-[7px] w-32 rounded-full border border-border shadow-[var(--shadow-md)]"
          ></span>
        </button>
      </div>
    }

    <div
      class="dock-panel pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3"
      [style.transform]="hidden() ? 'translateY(130px)' : 'translateY(0)'"
      [style.opacity]="hidden() ? 0 : 1"
      (mouseleave)="insideApp() && summoned.set(false)"
    >
      <nav
        aria-label="Dock de navegación"
        class="glass-strong pointer-events-auto relative flex items-end gap-2 rounded-[24px] border border-border px-3 pb-1.5 pt-2 shadow-[var(--shadow-lg)]"
        (mousemove)="onMove($event)"
        (mouseleave)="onLeaveNav()"
        (focusin)="insideApp() && summoned.set(true)"
      >
        @for (entry of entries(); track entry.key; let i = $index) {
          @if (entry.key === 'sep') {
            <div class="mx-1 h-10 w-px self-center bg-border"></div>
          } @else if (entry.kind === 'nav-action') {
            <button
              type="button"
              class="flex items-end rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              [attr.aria-label]="entry.label"
              (click)="launchpadOpen.set(true)"
            >
              <ng-container *ngTemplateOutlet="tile; context: { entry, i }" />
            </button>
          } @else if (entry.kind === 'nav-img') {
            <a
              [routerLink]="entry.to"
              class="flex items-end rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              [attr.aria-label]="entry.label"
            >
              <ng-container *ngTemplateOutlet="tile; context: { entry, i }" />
            </a>
          } @else {
            <div
              class="dock-reorder"
              [attr.data-drag-id]="entry.key"
              [draggable]="dragArmed() === entry.key"
              [style.opacity]="hiddenAppId() === entry.key ? 0 : 1"
              (touchstart)="touch.begin($any($event), entry.key)"
              (mousedown)="armDrag($any($event), entry.key)"
              (mouseup)="dragArmed.set(null)"
              (dragstart)="onDragStart($any($event), entry.key)"
              (dragend)="onDragEnd()"
              (dragover)="onDragOverTile($any($event), entry.key)"
              (drop)="$event.preventDefault()"
              (contextmenu)="onContextMenu($any($event), entry)"
            >
              @if (entry.to) {
                <a
                  [routerLink]="entry.to"
                  class="flex items-end rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [attr.aria-label]="entry.label"
                  (click)="onOpen(entry)"
                >
                  <ng-container *ngTemplateOutlet="tile; context: { entry, i }" />
                </a>
              } @else {
                <a
                  [href]="entry.href"
                  target="_blank"
                  rel="noreferrer"
                  class="flex items-end rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [attr.aria-label]="entry.label"
                  (click)="onOpen(entry)"
                >
                  <ng-container *ngTemplateOutlet="tile; context: { entry, i }" />
                </a>
              }
            </div>
          }
        }
      </nav>
    </div>

    <ng-template #tile let-entry="entry" let-i="i">
      <div class="group relative flex flex-col items-center" #iconEl>
        <span
          class="dock-tooltip pointer-events-none absolute -top-10 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-[var(--shadow-md)] group-hover:opacity-100"
        >
          {{ entry.label }}
        </span>
        <div
          class="dock-tile flex items-center justify-center overflow-hidden rounded-[26%] shadow-[0_4px_10px_rgba(0,0,0,.18)]"
          [style.width.px]="sizeAt(i)"
          [style.height.px]="sizeAt(i)"
          [style.transform]="'translateY(' + liftAt(i) + 'px)'"
        >
          @if (entry.kind === 'app') {
            <alma-app-icon-art [app]="entry.app" />
          } @else {
            <img [src]="entry.img" alt="" draggable="false" class="h-full w-full object-cover" />
          }
        </div>
        <span
          class="mt-1 h-1 w-1 rounded-full"
          [class.bg-foreground/60]="entry.active"
          [class.bg-transparent]="!entry.active"
        ></span>
      </div>
    </ng-template>

    <!-- Menú contextual estilo macOS (clic derecho sobre una App del Dock) -->
    @if (menuCtx(); as ctx) {
      <div
        class="fixed inset-0 z-50"
        (click)="menuCtx.set(null)"
        (contextmenu)="$event.preventDefault(); menuCtx.set(null)"
      ></div>
      <div
        class="surface-solid fixed z-50 min-w-44 rounded-lg border border-border p-1 shadow-[var(--shadow-lg)]"
        [style.left.px]="ctx.x"
        [style.top.px]="ctx.y - 88 > 8 ? ctx.y - 88 : 8"
      >
        <p class="px-2.5 py-1 text-xs font-medium text-muted-foreground">{{ ctx.label }}</p>
        @if (ctx.to) {
          <button
            class="w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent"
            (click)="abrirDesdeMenu(ctx.to)"
          >
            Abrir
          </button>
        }
        <button
          class="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-destructive hover:bg-accent"
          (click)="quitarDelDock(ctx.appId)"
        >
          Quitar del Dock
        </button>
      </div>
    }

    <alma-dock-launchpad [open]="launchpadOpen()" (closed)="launchpadOpen.set(false)" />
  `,
})
export class DockComponent {
  private readonly orderedApps = inject(OrderedAppsService);
  private readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);

  @ViewChildren('iconEl') private iconEls!: QueryList<ElementRef<HTMLElement>>;

  protected readonly pathname = signal(this.router.url);
  protected readonly summoned = signal(false);
  protected readonly launchpadOpen = signal(false);
  protected readonly insideApp = computed(() => {
    const p = this.pathname();
    return (
      p.startsWith('/apps/') ||
      p.startsWith('/admin') ||
      p.startsWith('/settings') ||
      p.startsWith('/help')
    );
  });
  protected readonly hidden = computed(() => this.insideApp() && !this.summoned());

  // Ancho de viewport reactivo (cuántas apps caben en el Dock)
  private readonly vw = signal(window.innerWidth);
  private readonly onResize = () => this.vw.set(window.innerWidth);

  // Drag & drop
  protected readonly dragArmed = signal<string | null>(null);
  protected readonly hiddenAppId = signal<string | null>(null);
  private readonly dragAppId = signal<string | null>(null);
  private readonly liveOrder = signal<string[] | null>(null);
  protected readonly menuCtx = signal<{
    x: number;
    y: number;
    appId: string;
    label: string;
    to?: string;
  } | null>(null);

  /** Tamaños por índice de entry; null ⇒ todos en reposo (BASE). */
  private readonly sizes = signal<number[] | null>(null);

  protected readonly touch = new TouchDrag({
    onStart: (id) => {
      this.sizes.set(null);
      this.dragAppId.set(id);
      this.liveOrder.set(this.orderIds());
      this.hiddenAppId.set(id);
    },
    onOver: (overId, after) => {
      const dragging = this.dragAppId();
      const live = this.liveOrder();
      if (!dragging || !live || overId === dragging) return;
      this.liveOrder.set(reordenar(live, dragging, overId, after));
    },
    onEnd: () => {
      const orden = this.liveOrder();
      this.dragAppId.set(null);
      this.hiddenAppId.set(null);
      this.liveOrder.set(null);
      if (orden) this.prefs.appOrder.set(orden);
    },
  });

  constructor() {
    window.addEventListener('resize', this.onResize);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.pathname.set(e.urlAfterRedirects);
        this.summoned.set(false);
      });
  }

  private orderIds(): string[] {
    return this.orderedApps.ordered().map((a) => a.id);
  }

  protected readonly entries = computed<DockEntry[]>(() => {
    const path = this.pathname();
    const ordered = this.orderedApps.ordered();
    const orderIds = ordered.map((a) => a.id);
    const porId = new Map(ordered.map((a) => [a.id, a]));

    const vw = this.vw();
    const esMovil = vw < 768;
    const disponible = vw - (esMovil ? 150 : 260);
    const caben = Math.max(1, Math.floor(disponible / 56));
    const topeVista = Math.min(caben, esMovil ? 8 : MAX_DOCK);
    const anclas = clampDock(Math.min(this.prefs.dockCount(), orderIds.length));
    const visibles = Math.min(anclas, topeVista);

    const efectivo = this.liveOrder() ?? orderIds;
    const shownIds = efectivo.slice(0, visibles);
    const apps: DockEntry[] = shownIds
      .map((id) => porId.get(id))
      .filter((a): a is Application => Boolean(a))
      .map((a) => ({
        key: a.id,
        label: a.nombre,
        active: Boolean(a.internalRoute && path.startsWith(a.internalRoute)),
        kind: 'app' as const,
        app: a,
        to: a.internalRoute ?? undefined,
        href: a.internalRoute ? undefined : a.url,
      }));

    return [
      {
        key: 'inicio',
        label: 'Inicio',
        active: path === '/',
        kind: 'nav-img',
        img: '/app-icons/nav-inicio.png',
        to: '/',
      },
      {
        key: 'apps',
        label: 'Ver todas las aplicaciones',
        active: this.launchpadOpen(),
        kind: 'nav-action',
        img: '/app-icons/nav-todas.png',
      },
      { key: 'sep', label: '', active: false, kind: 'nav-img' },
      ...apps,
    ];
  });

  protected sizeAt(i: number): number {
    return this.sizes()?.[i] ?? BASE;
  }

  protected liftAt(i: number): number {
    const size = this.sizeAt(i);
    return (-12 * (size - BASE)) / (PEAK - BASE);
  }

  protected onMove(event: MouseEvent): void {
    if (this.dragAppId()) return; // sin magnificar al arrastrar
    const els = this.iconEls?.toArray() ?? [];
    const entries = this.entries();
    const next = entries.map(() => BASE);
    const tileIdxs = entries
      .map((e, idx) => ({ e, idx }))
      .filter(({ e }) => e.key !== 'sep')
      .map(({ idx }) => idx);
    tileIdxs.forEach((entryIdx, tileIdx) => {
      const el = els[tileIdx]?.nativeElement;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = Math.min(Math.abs(event.clientX - (r.left + r.width / 2)), RADIUS);
      const t = 1 - d / RADIUS;
      next[entryIdx] = BASE + (PEAK - BASE) * t * t;
    });
    this.sizes.set(next);
  }

  protected onLeaveNav(): void {
    this.sizes.set(null);
  }

  protected onOpen(entry: DockEntry): void {
    if (entry.app) this.prefs.pushRecent(entry.app.id);
  }

  /** PERF: `draggable` se arma SOLO al presionar (el hit-testing de Chromium
   *  degrada el hover de la magnificación si es permanente). */
  protected armDrag(ev: MouseEvent, appId: string): void {
    if (ev.button === 0) this.dragArmed.set(appId);
  }

  protected onDragStart(ev: DragEvent, appId: string): void {
    if (!ev.dataTransfer) return;
    ev.dataTransfer.effectAllowed = 'move';
    setCloneDragImage(ev, ev.currentTarget as HTMLElement);
    this.sizes.set(null); // congela la magnificación durante el arrastre
    this.dragAppId.set(appId);
    this.liveOrder.set(this.orderIds());
    // Ocultado DIFERIDO del origen (si se oculta en el mismo tick, la imagen
    // de arrastre se captura en blanco).
    setTimeout(() => this.hiddenAppId.set(appId), 0);
  }

  protected onDragEnd(): void {
    this.dragArmed.set(null);
    this.hiddenAppId.set(null);
    const orden = this.liveOrder();
    this.dragAppId.set(null);
    this.liveOrder.set(null);
    // SIEMPRE confirmar el reorden en vivo; NUNCA quitar por arrastrar afuera.
    if (orden) this.prefs.appOrder.set(orden);
  }

  protected onDragOverTile(ev: DragEvent, targetId: string): void {
    ev.preventDefault();
    const dragging = this.dragAppId();
    const live = this.liveOrder();
    if (!dragging || dragging === targetId || !live) return;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const after = ev.clientX > r.left + r.width / 2;
    this.liveOrder.set(reordenar(live, dragging, targetId, after));
  }

  protected onContextMenu(ev: MouseEvent, entry: DockEntry): void {
    ev.preventDefault();
    this.menuCtx.set({
      x: ev.clientX,
      y: ev.clientY,
      appId: entry.key,
      label: entry.label,
      to: entry.to,
    });
  }

  protected abrirDesdeMenu(to: string): void {
    this.menuCtx.set(null);
    void this.router.navigateByUrl(to);
  }

  /** Quitar del Dock = mover la App justo después de la zona anclada y reducir
   *  el conteo (sigue en el Launchpad). Mínimo 1 anclada. */
  protected quitarDelDock(appId: string): void {
    this.menuCtx.set(null);
    const anclas = clampDock(Math.min(this.prefs.dockCount(), this.orderIds().length));
    if (anclas <= 1) return;
    const ids = this.orderIds().filter((id) => id !== appId);
    ids.splice(anclas - 1, 0, appId);
    this.prefs.appOrder.set(ids);
    this.prefs.setDockCount(anclas - 1);
  }
}
