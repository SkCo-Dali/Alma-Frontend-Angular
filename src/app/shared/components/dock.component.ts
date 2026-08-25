// Dock estilo macOS v2 — navegación única de ALMA.
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
import { LaunchpadService } from '../../core/services/launchpad.service';
import {
  Component,
  DestroyRef,
  ElementRef,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
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

const BASE = 44; // icono en reposo (px)
const PEAK = 54; // icono bajo el cursor (px) — zoom sutil (+23%)
const RADIUS = 110; // radio de influencia (px) — magnificación más contenida

interface DockEntry {
  key: string;
  label: string;
  active: boolean;
  kind: 'app' | 'nav-img' | 'nav-action';
  app?: Application;
  img?: string;
  /** Glifo lucide (se pinta SIN cuadro). Tiene prioridad sobre `img`. */
  icon?: string;
  to?: string;
  href?: string;
}

@Component({
  selector: 'alma-dock',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    LucideAngularModule,
    AppIconArtComponent,
    DockLaunchpadComponent,
  ],
  template: `
    <!-- Asa tipo indicador de iPhone -->
    @if (insideApp()) {
      <div
        class="fixed inset-x-0 bottom-0 z-30 flex items-end justify-center"
        (dragenter)="invocar()"
        (dragover)="$event.preventDefault(); invocar()"
      >
        <button
          type="button"
          aria-label="Mostrar dock"
          (mouseenter)="invocar()"
          (click)="invocar()"
          (focus)="invocar()"
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
      (mouseenter)="cancelarOcultar()"
      (mouseleave)="alSalirDelPanel($event)"
    >
      <nav
        aria-label="Dock de navegación"
        class="glass-strong pointer-events-auto relative flex items-end gap-1.5 rounded-3xl border border-border px-4 pb-1 pt-1.5 shadow-[var(--shadow-lg)]"
        (mousemove)="onMove($event)"
        (mouseleave)="onLeaveNav()"
        (focusin)="insideApp() && invocar()"
      >
        @for (entry of entries(); track entry.key; let i = $index) {
          @if (entry.key === 'sep') {
            <div class="mx-1 h-10 w-px self-center bg-border"></div>
          } @else if (entry.kind === 'nav-action') {
            <button
              type="button"
              class="flex items-end rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              [attr.aria-label]="entry.label"
              (click)="launchpad.open.set(true)"
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
      <!-- Tile con etiqueta SIEMPRE visible (estilo launcher); la entrada activa
           se resalta con una pastilla clara. La magnificación solo escala el
           ícono, la etiqueta queda quieta para que la fila no "salte". -->
      <div class="dock-entry" [class.activa]="entry.active" [attr.data-i]="i" #iconEl>
        <div
          class="dock-tile flex items-center justify-center"
          [class.dock-tile--boxed]="esTile(entry)"
          [style.width.px]="baseSize"
          [style.height.px]="baseSize"
          [style.transform]="'translateY(' + liftAt(i) + 'px) scale(' + scaleAt(i) + ')'"
        >
          @if (entry.kind === 'app') {
            <alma-app-icon-art [app]="entry.app" [flat]="!esTile(entry)" />
          } @else if (entry.icon) {
            <lucide-icon
              [name]="entry.icon"
              class="h-[78%] w-[78%] text-foreground/70"
              [strokeWidth]="1.9"
            />
          } @else {
            <img [src]="entry.img" alt="" draggable="false" class="h-full w-full object-cover" />
          }
        </div>
        <span class="dock-label">{{ entry.label }}</span>
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

    <alma-dock-launchpad [open]="launchpad.open()" (closed)="launchpad.open.set(false)" />
  `,
})
export class DockComponent {
  private readonly orderedApps = inject(OrderedAppsService);
  private readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);

  @ViewChildren('iconEl') private iconEls!: QueryList<ElementRef<HTMLElement>>;

  protected readonly launchpad = inject(LaunchpadService);
  protected readonly pathname = signal(this.router.url);
  protected readonly summoned = signal(false);
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

  // Hover-intent: entre la línea invocadora (bottom-0) y el Dock (bottom-3) hay
  // una franja muerta. Sin gracia, cruzarla dispara un ocultar→mostrar en cadena
  // que se siente como rebote. Ocultamos con un retardo CANCELABLE: volver a
  // entrar cancela el cierre en vez de reiniciar la animación.
  private ocultarTimer: number | null = null;

  protected cancelarOcultar(): void {
    if (this.ocultarTimer !== null) {
      clearTimeout(this.ocultarTimer);
      this.ocultarTimer = null;
    }
  }

  private programarOcultar(): void {
    this.cancelarOcultar();
    this.ocultarTimer = setTimeout(() => this.summoned.set(false), 300) as unknown as number;
  }

  protected invocar(): void {
    this.cancelarOcultar();
    this.summoned.set(true);
  }

  /**
   * El Dock DESLIZA bajo el cursor al mostrarse/ocultarse, lo que dispara un
   * mouseleave "fantasma" con el cursor quieto. Si el cursor sigue pegado al
   * borde inferior (sobre la línea invocadora, por debajo del Dock) NO ocultamos:
   * no se fue, es el Dock el que pasó por debajo.
   */
  protected alSalirDelPanel(e: MouseEvent): void {
    if (!this.insideApp()) return;
    if (window.innerHeight - e.clientY < 28) return;
    this.programarOcultar();
  }

  // Ancho de viewport reactivo (cuántas apps caben en el Dock)
  private readonly vw = signal(window.innerWidth);
  private readonly onResize = () => this.vw.set(window.innerWidth);

  // Drag & drop.
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
    inject(DestroyRef).onDestroy(() => this.cancelarOcultar());
    window.addEventListener('resize', this.onResize);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.pathname.set(e.urlAfterRedirects);
        this.cancelarOcultar();
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
    const caben = Math.max(1, Math.floor(disponible / 50));
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
        label: 'Todas las apps',
        active: this.launchpad.open(),
        kind: 'nav-action',
        icon: 'layout-grid',
      },
      { key: 'sep', label: '', active: false, kind: 'nav-img' },
      ...apps,
    ];
  });

  protected sizeAt(i: number): number {
    return this.sizes()?.[i] ?? BASE;
  }

  protected readonly baseSize = BASE;

  /** Escala visual del ícono bajo el cursor. Usamos transform:scale (no width/
   *  height) para que la magnificación NO cambie el layout: el dock se queda
   *  quieto y solo "crece" el ícono, saliendo por encima de la barra. */
  protected scaleAt(i: number): number {
    return this.sizeAt(i) / BASE;
  }

  /** Pequeño empuje hacia arriba (además de la escala) para que el ícono
   *  sobresalga un poco de la barra, estilo macOS. Es transform ⇒ no toca layout. */
  protected liftAt(i: number): number {
    const t = (this.sizeAt(i) - BASE) / (PEAK - BASE);
    return -12 * t;
  }

  /** ¿Este ícono se pinta como "tile" con cuadro (squircle + sombra)? Sí para
   *  imágenes a sangre completa (PNG que traen su propio fondo); no para glifos
   *  lucide, el orbe de Alma ni las apps sin iconUrl (glifo de color). */
  protected esTile(entry: DockEntry): boolean {
    if (entry.icon) return false;
    if (entry.kind === 'app') {
      const a = entry.app;
      if (!a || a.id === 'app-agente-alma') return false;
      return Boolean(a.iconUrl);
    }
    return true;
  }

  protected onMove(event: MouseEvent): void {
    if (this.dragAppId()) return; // sin magnificar al arrastrar
    const next = this.entries().map(() => BASE);
    // Cada #iconEl lleva su índice real en data-i: aplicamos el tamaño a ESE
    // índice y medimos su propio rect. Así no dependemos de que el orden del
    // QueryList coincida con el de entries() (fuente del bug: se magnificaba el
    // ícono vecino).
    for (const ref of this.iconEls?.toArray() ?? []) {
      const el = ref.nativeElement;
      const i = Number(el.dataset['i']);
      if (Number.isNaN(i)) continue;
      const r = el.getBoundingClientRect();
      const d = Math.min(Math.abs(event.clientX - (r.left + r.width / 2)), RADIUS);
      const t = 1 - d / RADIUS;
      next[i] = BASE + (PEAK - BASE) * t * t;
    }
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
