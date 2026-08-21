// Cliente HTTP base hacia alma-backend (paridad con lib/api.ts del React).
// Todas las llamadas van autenticadas con el token de Entra (MSAL).

import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService } from '../auth/auth.service';
import { MeApi } from '../models/platform.models';

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

  /** Perfil del usuario autenticado contra alma.Users (rol único, estilo Dali). */
  getMe(): Promise<MeApi> {
    return this.fetch<MeApi>('/api/users/me');
  }
}
