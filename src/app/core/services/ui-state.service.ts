// Favoritos y apps recientes con persistencia local (paridad con ui-store).

import { Injectable, effect, signal } from '@angular/core';

const FAVORITES_KEY = 'alma-favorites';
const RECENTS_KEY = 'alma-recent-apps';
const MAX_RECENTS = 6;

function load(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class UiStateService {
  readonly favorites = signal<string[]>(load(FAVORITES_KEY));
  readonly recentApps = signal<string[]>(load(RECENTS_KEY));

  constructor() {
    effect(() => localStorage.setItem(FAVORITES_KEY, JSON.stringify(this.favorites())));
    effect(() => localStorage.setItem(RECENTS_KEY, JSON.stringify(this.recentApps())));
  }

  toggleFavorite(appId: string): void {
    this.favorites.update((f) =>
      f.includes(appId) ? f.filter((id) => id !== appId) : [...f, appId],
    );
  }

  pushRecent(appId: string): void {
    this.recentApps.update((r) =>
      [appId, ...r.filter((id) => id !== appId)].slice(0, MAX_RECENTS),
    );
  }
}
