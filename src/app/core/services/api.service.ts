// Cliente HTTP base hacia alma-backend. Todas las llamadas van autenticadas con el token
// de Entra (MSAL), adjuntado por `authInterceptor` — ver core/http/auth.interceptor.ts.

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { MeApi, PreferenciasPortal } from '../models/platform.models';

const API_BASE_URL = environment.apiUrl.replace(/\/+$/, '');

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /** Firma preservada de la era `fetch`: sólo se usan `method` y `body` de
   *  RequestInit (los headers los pone el interceptor). */
  fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const method = init?.method ?? 'GET';
    const body = init?.body as string | undefined;

    return firstValueFrom(
      this.http
        .request<T>(method, `${API_BASE_URL}${path}`, {
          body,
          headers: { 'Content-Type': 'application/json' },
        })
        .pipe(
          catchError((err: HttpErrorResponse) => {
            const detail =
              (err.error as { detail?: string } | null)?.detail ?? `HTTP ${err.status} en ${path}`;
            return throwError(() => new Error(detail));
          }),
        ),
    );
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
