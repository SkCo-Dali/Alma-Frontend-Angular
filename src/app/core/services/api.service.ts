// Cliente HTTP base hacia alma-backend. Todas las llamadas van autenticadas con el token
// de Entra (MSAL).

import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService } from '../auth/auth.service';
import { MeApi, PreferenciasPortal } from '../models/platform.models';

const API_BASE_URL = environment.apiUrl.replace(/\/+$/, '');

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly auth = inject(AuthService);

  async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    const token = await this.auth.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const detail =
        (body as { detail?: string } | null)?.detail ?? `HTTP ${res.status} en ${path}`;
      throw new Error(detail);
    }
    return body as T;
  }

  /** Perfil del usuario autenticado: identidad + permisos RBAC por App. */
  getMe(): Promise<MeApi> {
    return this.fetch<MeApi>('/api/users/me');
  }

  /** Preferencias del portal persistidas por usuario (cross-device). */
  async getPreferences(): Promise<PreferenciasPortal> {
    const r = await this.fetch<{ data: PreferenciasPortal }>('/api/users/me/preferences');
    return r?.data ?? {};
  }

  async savePreferences(data: PreferenciasPortal): Promise<void> {
    await this.fetch('/api/users/me/preferences', {
      method: 'PUT',
      body: JSON.stringify({ data }),
    });
  }
}
