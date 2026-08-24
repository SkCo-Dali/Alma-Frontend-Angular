// Preferencias del portal: tema, fondo esmerilado, orden ÚNICO de las Apps, ancladas al
// Dock, favoritos y recientes. localStorage es el caché rápido; el servidor
// (/api/users/me/preferences) es la fuente de verdad al iniciar sesión y recibe cada
// cambio con debounce.

import { Injectable, effect, signal } from '@angular/core';
import { PreferenciasPortal } from '../models/platform.models';

export type Theme = 'system' | 'light' | 'dark';

/** Fondos esmerilados disponibles (paletas --wp-* en styles.css). */
export const BACKGROUNDS = [
  'esmeralda',
  'oceano',
  'aurora',
  'atardecer',
  'grafito',
  'cielo',
] as const;
export type Background = (typeof BACKGROUNDS)[number];

/** Máximo de Apps que el usuario puede anclar al Dock. */
export const MAX_DOCK = 10;
export const clampDock = (n: number) => Math.max(1, Math.min(MAX_DOCK, n));

const STORAGE_KEY = 'alma-ui-v2';

interface Persisted {
  theme: Theme;
  background: Background;
  appOrder: string[];
  dockCount: number;
  favorites: string[];
  recentApps: string[];
}

const DEFAULTS: Persisted = {
  theme: 'system',
  background: 'esmeralda',
  appOrder: [],
  dockCount: 6,
  favorites: [],
  recentApps: [],
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly inicial = load();

  readonly theme = signal<Theme>(this.inicial.theme);
  readonly background = signal<Background>(this.inicial.background);
  readonly appOrder = signal<string[]>(this.inicial.appOrder);
  readonly dockCount = signal<number>(clampDock(this.inicial.dockCount));
  readonly favorites = signal<string[]>(this.inicial.favorites);
  readonly recentApps = signal<string[]>(this.inicial.recentApps);

  /** Guardado remoto (lo conecta AuthService al quedar la sesión lista). */
  private saveRemote: ((p: PreferenciasPortal) => Promise<void>) | null = null;
  private hidratado = false;
  private aplicandoServidor = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Aplicar tema/fondo al arrancar y ante cada cambio; persistir el snapshot
    // en localStorage y (tras hidratar) empujarlo al servidor con debounce.
    effect(() => {
      const t = this.theme();
      document.documentElement.classList.toggle('dark', resolveTheme(t) === 'dark');
    });
    effect(() => {
      const bg = this.background();
      if (bg === 'esmeralda') delete document.documentElement.dataset['bg'];
      else document.documentElement.dataset['bg'] = bg;
    });
    effect(() => {
      const snap: Persisted = {
        theme: this.theme(),
        background: this.background(),
        appOrder: this.appOrder(),
        dockCount: this.dockCount(),
        favorites: this.favorites(),
        recentApps: this.recentApps(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
      if (this.hidratado && !this.aplicandoServidor && this.saveRemote) {
        clearTimeout(this.timer);
        const remoto: PreferenciasPortal = {
          theme: snap.theme,
          background: snap.background,
          appOrder: snap.appOrder,
          dockCount: snap.dockCount,
        };
        this.timer = setTimeout(() => {
          void this.saveRemote?.(remoto).catch((e) =>
            console.error('[prefs] no se pudo guardar', e),
          );
        }, 800);
      }
    });
  }

  /** Hidrata desde el servidor (al iniciar sesión) y activa el guardado remoto. */
  conectarServidor(
    fetchRemote: () => Promise<PreferenciasPortal>,
    saveRemote: (p: PreferenciasPortal) => Promise<void>,
  ): void {
    this.saveRemote = saveRemote;
    fetchRemote()
      .then((p) => {
        this.aplicandoServidor = true;
        if (p.theme) this.theme.set(p.theme as Theme);
        if (p.background && (BACKGROUNDS as readonly string[]).includes(p.background))
          this.background.set(p.background as Background);
        if (Array.isArray(p.appOrder)) this.appOrder.set(p.appOrder);
        if (typeof p.dockCount === 'number') this.dockCount.set(clampDock(p.dockCount));
      })
      .catch((e) => console.error('[prefs] no se pudieron cargar', e))
      .finally(() => {
        this.hidratado = true;
        setTimeout(() => (this.aplicandoServidor = false), 0);
      });
  }

  resolved(): 'light' | 'dark' {
    return resolveTheme(this.theme());
  }

  toggleTheme(): void {
    this.theme.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  toggleFavorite(appId: string): void {
    this.favorites.update((f) =>
      f.includes(appId) ? f.filter((id) => id !== appId) : [...f, appId],
    );
  }

  pushRecent(appId: string): void {
    this.recentApps.update((r) =>
      [appId, ...r.filter((id) => id !== appId)].slice(0, 8),
    );
  }

  setDockCount(n: number): void {
    this.dockCount.set(clampDock(n));
  }
}
