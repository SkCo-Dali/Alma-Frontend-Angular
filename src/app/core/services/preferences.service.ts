// Preferencias del portal: tema, fondo esmerilado, orden ÚNICO de las Apps, ancladas al
// Dock, favoritos y recientes. localStorage es el caché rápido; el servidor
// (/api/users/me/preferences) es la fuente de verdad al iniciar sesión y recibe cada
// cambio con debounce.

import { Injectable, effect, signal } from '@angular/core';
import { PreferenciasPortal } from '../models/platform.models';

export type Theme = 'system' | 'light' | 'dark';

/** Fondos disponibles: los cinco primeros son wallpapers solarpunk
 *  (public/wallpapers/*.jpg); el resto son paletas esmeriladas --wp-*. */
export const BACKGROUNDS = [
  'terraza',
  'mirador',
  'lago',
  'balcon',
  'dorado',
  'oceano',
  'aurora',
  'atardecer',
  'grafito',
  'cielo',
] as const;
export type Background = (typeof BACKGROUNDS)[number];

/** Fondos que son imagen (wallpaper); el resto son paletas de degradado --wp-*.
 *  El desenfoque solo aplica a estos. */
export const IMAGE_BACKGROUNDS: readonly Background[] = [
  'terraza',
  'mirador',
  'lago',
  'balcon',
  'dorado',
];
export const isImageBackground = (bg: Background): boolean =>
  IMAGE_BACKGROUNDS.includes(bg);

/** Intensidad del desenfoque del fondo de imagen ('off' = sin desenfoque). */
export const BLUR_LEVELS = ['off', 'suave', 'medio', 'fuerte'] as const;
export type BackgroundBlur = (typeof BLUR_LEVELS)[number];

/** Máximo de Apps que el usuario puede anclar al Dock. */
export const MAX_DOCK = 10;
export const clampDock = (n: number) => Math.max(1, Math.min(MAX_DOCK, n));

const STORAGE_KEY = 'alma-ui-v2';

/**
 * Estreno del fondo solarpunk (ago-2026): la PRIMERA vez que alguien abre ALMA
 * después de este cambio, ve el fondo nuevo aunque tuviera otro guardado —
 * queremos que todos noten el rediseño. A partir de ahí su elección se respeta.
 *
 * El sello va aparte del snapshot de preferencias: así se puede volver a
 * estrenar un fondo en el futuro subiendo la versión, sin resetear nada más.
 */
const ESTRENO_FONDO_KEY = 'alma-estreno-fondo-v1';

function consumirEstrenoFondo(): boolean {
  try {
    if (localStorage.getItem(ESTRENO_FONDO_KEY)) return false;
    localStorage.setItem(ESTRENO_FONDO_KEY, '1');
    return true;
  } catch {
    // Sin localStorage no hay dónde recordarlo; se respeta lo del servidor
    // (forzarlo en cada carga le quitaría al usuario su elección).
    return false;
  }
}

interface Persisted {
  theme: Theme;
  background: Background;
  /** Intensidad del desenfoque de la imagen de fondo (solo aplica a imágenes). */
  backgroundBlur: BackgroundBlur;
  appOrder: string[];
  dockCount: number;
  favorites: string[];
  recentApps: string[];
}

const DEFAULTS: Persisted = {
  theme: 'system',
  background: 'terraza',
  backgroundBlur: 'off',
  appOrder: [],
  dockCount: 6,
  favorites: [],
  recentApps: [],
};

/** Fondos retirados ('esmeralda' fue el por defecto hasta ago-2026 y 'solarpunk'
 *  la escena SVG que reemplazaron estos wallpapers): heredan el nuevo default. */
function migrarFondo(bg: unknown): Background {
  if (bg === 'esmeralda' || bg === 'solarpunk') return 'terraza';
  return (BACKGROUNDS as readonly string[]).includes(bg as string)
    ? (bg as Background)
    : DEFAULTS.background;
}

/** Normaliza el desenfoque persistido. El campo fue booleano hasta ago-2026,
 *  cuando pasó a tener niveles: el `true` de entonces equivale a 'medio'. */
function migrarBlur(v: unknown): BackgroundBlur {
  if (v === true) return 'medio';
  if (v === false || v == null) return 'off';
  return (BLUR_LEVELS as readonly string[]).includes(v as string)
    ? (v as BackgroundBlur)
    : 'off';
}

function load(estrenarFondo: boolean): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const p = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) };
    p.background = estrenarFondo ? DEFAULTS.background : migrarFondo(p.background);
    p.backgroundBlur = migrarBlur(p.backgroundBlur);
    return p;
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
  /** true solo en la primera carga tras el estreno del fondo (ver arriba). */
  private readonly estrenoFondo = consumirEstrenoFondo();
  private readonly inicial = load(this.estrenoFondo);

  readonly theme = signal<Theme>(this.inicial.theme);
  readonly background = signal<Background>(this.inicial.background);
  readonly backgroundBlur = signal<BackgroundBlur>(this.inicial.backgroundBlur);
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
      if (bg === 'terraza') delete document.documentElement.dataset['bg'];
      else document.documentElement.dataset['bg'] = bg;
    });
    // El CSS solo desenfoca la capa de imagen (body::before), así que el
    // atributo es inofensivo con degradados: no hay imagen que desenfocar.
    effect(() => {
      const nivel = this.backgroundBlur();
      if (nivel === 'off') delete document.documentElement.dataset['bgBlur'];
      else document.documentElement.dataset['bgBlur'] = nivel;
    });
    effect(() => {
      const snap: Persisted = {
        theme: this.theme(),
        background: this.background(),
        backgroundBlur: this.backgroundBlur(),
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
          backgroundBlur: snap.backgroundBlur,
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
        // Durante el estreno se ignora el fondo guardado (abajo se persiste el
        // nuevo, para que también lo vea en sus otros dispositivos).
        if (p.background && !this.estrenoFondo) this.background.set(migrarFondo(p.background));
        if (p.backgroundBlur != null) this.backgroundBlur.set(migrarBlur(p.backgroundBlur));
        if (Array.isArray(p.appOrder)) this.appOrder.set(p.appOrder);
        if (typeof p.dockCount === 'number') this.dockCount.set(clampDock(p.dockCount));
      })
      .catch((e) => console.error('[prefs] no se pudieron cargar', e))
      .finally(() => {
        this.hidratado = true;
        setTimeout(() => {
          this.aplicandoServidor = false;
          if (this.estrenoFondo) this.empujarRemoto();
        }, 0);
      });
  }

  /** Guarda el estado actual en el servidor de inmediato (sin debounce). */
  private empujarRemoto(): void {
    void this.saveRemote?.({
      theme: this.theme(),
      background: this.background(),
      backgroundBlur: this.backgroundBlur(),
      appOrder: this.appOrder(),
      dockCount: this.dockCount(),
    }).catch((e) => console.error('[prefs] no se pudo guardar', e));
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
