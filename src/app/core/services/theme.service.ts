// Tema claro/oscuro/sistema con persistencia (paridad con ui-store del React).

import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'alma-theme';

function systemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(
    (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system',
  );

  constructor() {
    effect(() => {
      const t = this.theme();
      localStorage.setItem(STORAGE_KEY, t);
      const dark = t === 'dark' || (t === 'system' && systemDark());
      document.documentElement.classList.toggle('dark', dark);
    });
  }

  resolved(): 'light' | 'dark' {
    const t = this.theme();
    return t === 'system' ? (systemDark() ? 'dark' : 'light') : t;
  }

  toggle(): void {
    this.theme.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }
}
