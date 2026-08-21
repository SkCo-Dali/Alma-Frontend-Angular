// Dock estilo macOS — navegación única de ALMA (paridad con layout/Dock.tsx).
//
// Magnificación: en cada mousemove se calcula el tamaño de cada icono según
// la distancia del cursor a su centro (misma curva que el original React:
// BASE + (PEAK - BASE) * t², t = 1 - d/RADIUS). Los springs de motion/react
// se reemplazan por una transición CSS corta (.dock-tile en styles.css).
//
// Dentro de una aplicación (/apps/*) el dock se auto-oculta pero nunca
// desaparece del todo: queda un asa tipo indicador de iPhone en el borde
// inferior que lo invoca con hover, clic o foco de teclado.

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
import { LucideAngularModule } from 'lucide-angular';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { ApplicationsService } from '../../core/services/applications.service';
import { UiStateService } from '../../core/services/ui-state.service';

const BASE = 48; // icono en reposo (px)
const PEAK = 76; // icono bajo el cursor (px)
const RADIUS = 140; // radio de influencia (px)

interface DockEntry {
  key: string;
  label: string;
  active: boolean;
  kind: 'app' | 'nav' | 'sep';
  icon: string;
  color?: string;
  to?: string;
  href?: string;
  appId?: string;
}

@Component({
  selector: 'alma-dock',
  imports: [RouterLink, LucideAngularModule, NgTemplateOutlet],
  template: `
    <!-- Asa tipo indicador de iPhone: el dock nunca desaparece del todo -->
    @if (insideApp()) {
      <div
        class="fixed inset-x-0 bottom-0 z-30 flex h-5 items-end justify-center"
        (mouseenter)="summoned.set(true)"
      >
        <button
          type="button"
          aria-label="Mostrar dock"
          (click)="summoned.set(true)"
          (focus)="summoned.set(true)"
          class="glass-strong mb-1.5 h-[7px] w-32 cursor-pointer rounded-full border border-border shadow-[var(--shadow-md)] transition-opacity duration-200"
          [class.opacity-0]="!hidden()"
        ></button>
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
        class="glass-strong pointer-events-auto flex items-end gap-2 rounded-[24px] border border-border px-3 pb-1.5 pt-2 shadow-[var(--shadow-lg)]"
        (mousemove)="onMove($event)"
        (mouseleave)="onLeave()"
        (focusin)="insideApp() && summoned.set(true)"
      >
        @for (entry of entries(); track entry.key; let i = $index) {
          @if (entry.kind === 'sep') {
            <div class="mx-1 h-10 w-px self-center bg-border"></div>
          } @else if (entry.to) {
            <a
              [routerLink]="entry.to"
              class="flex items-end rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              [attr.aria-label]="entry.label"
              (click)="onOpen(entry)"
            >
              <ng-container
                [ngTemplateOutlet]="tile"
                [ngTemplateOutletContext]="{ entry, i }"
              />
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
              <ng-container
                [ngTemplateOutlet]="tile"
                [ngTemplateOutletContext]="{ entry, i }"
              />
            </a>
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
            <div
              class="flex h-full w-full items-center justify-center text-white"
              [style.background]="
                'linear-gradient(160deg, ' + entry.color + ', ' + entry.color + 'bb)'
              "
            >
              <lucide-icon [name]="entry.icon" class="h-[55%] w-[55%]" [strokeWidth]="1.75" />
            </div>
          } @else {
            <div
              class="glass-strong flex h-full w-full items-center justify-center text-foreground/80"
            >
              <lucide-icon [name]="entry.icon" class="h-1/2 w-1/2" [strokeWidth]="1.75" />
            </div>
          }
        </div>
        <span
          class="mt-1 h-1 w-1 rounded-full"
          [class.bg-foreground/60]="entry.active"
          [class.bg-transparent]="!entry.active"
        ></span>
      </div>
    </ng-template>
  `,
})
export class DockComponent {
  private readonly apps = inject(ApplicationsService);
  private readonly auth = inject(AuthService);
  private readonly ui = inject(UiStateService);
  private readonly router = inject(Router);

  @ViewChildren('iconEl') private iconEls!: QueryList<ElementRef<HTMLElement>>;

  protected readonly pathname = signal(this.router.url);
  protected readonly summoned = signal(false);
  protected readonly insideApp = computed(() => this.pathname().startsWith('/apps/'));
  protected readonly hidden = computed(() => this.insideApp() && !this.summoned());

  /** Tamaños por índice de entry; null ⇒ todos en reposo (BASE). */
  private readonly sizes = signal<number[] | null>(null);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.pathname.set(e.urlAfterRedirects);
        this.summoned.set(false);
      });
  }

  protected readonly entries = computed<DockEntry[]>(() => {
    const path = this.pathname();
    const apps: DockEntry[] = this.apps.applications().map((a) => ({
      key: a.id,
      label: a.nombre,
      active: Boolean(a.internalRoute && path.startsWith(a.internalRoute)),
      kind: 'app' as const,
      icon: a.icono,
      color: a.color,
      to: a.internalRoute ?? undefined,
      href: a.internalRoute ? undefined : a.url,
      appId: a.id,
    }));

    const nav = (key: string, label: string, to: string, icon: string): DockEntry => ({
      key,
      label,
      active: to === '/' ? path === '/' : path.startsWith(to),
      kind: 'nav',
      icon,
      to,
    });

    const sep = (key: string): DockEntry => ({
      key,
      label: '',
      active: false,
      kind: 'sep',
      icon: '',
    });

    return [
      nav('inicio', 'Inicio', '/', 'home'),
      sep('sep-1'),
      ...apps,
      sep('sep-2'),
      nav('apps', 'Aplicaciones', '/applications', 'layout-grid'),
      nav('solicitudes', 'Solicitudes de acceso', '/access-requests', 'calendar-check'),
      ...(this.auth.isAdmin()
        ? [nav('admin', 'Administración', '/admin', 'shield-check')]
        : []),
      nav('settings', 'Configuración', '/settings', 'settings'),
      nav('help', 'Ayuda', '/help', 'help-circle'),
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
    const els = this.iconEls?.toArray() ?? [];
    const entries = this.entries();
    const next = entries.map(() => BASE);
    // Los separadores no renderizan #iconEl: se mapean tiles reales → índices
    const tileIdxs = entries
      .map((e, idx) => ({ e, idx }))
      .filter(({ e }) => e.kind !== 'sep')
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

  protected onLeave(): void {
    this.sizes.set(null);
  }

  protected onOpen(entry: DockEntry): void {
    if (entry.appId) this.ui.pushRecent(entry.appId);
  }
}
