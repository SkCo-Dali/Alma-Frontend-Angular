// Cliente HTTP base hacia alma-backend. Todas las llamadas van autenticadas con el token
// de Entra (MSAL).

import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService } from '../auth/auth.service';
import { MeApi, PreferenciasPortal } from '../models/platform.models';

const API_BASE_URL = environment.apiUrl.replace(/\/+$/, '');

// Topes de espera: sin ellos, un API colgado dejaba pantallas cargando sin fin.
const ESPERA_MS = 60_000;
const ESPERA_ARCHIVOS_MS = 5 * 60_000;
/** Para llamadas que procesan con IA o recorren un buzón (minutos, no segundos). */
export const ESPERA_LARGA_MS = 5 * 60_000;
const SIN_RESPUESTA = 'El servidor no respondió a tiempo. Intenta de nuevo.';

/** fetch con tope de espera; respeta el `signal` propio de quien llama. `hasta`
 *  decide qué cubre el tope: la respuesta completa o solo sus encabezados (las
 *  descargas leen el cuerpo después). */
async function conEspera<T>(
  url: string,
  init: RequestInit,
  ms: number,
  leer: (res: Response) => Promise<T>,
): Promise<T> {
  const control = new AbortController();
  let agotado = false;
  const espera = setTimeout(() => {
    agotado = true;
    control.abort();
  }, ms);
  const externo = init.signal;
  if (externo) {
    if (externo.aborted) control.abort();
    else externo.addEventListener('abort', () => control.abort(), { once: true });
  }
  try {
    return await leer(await fetch(url, { ...init, signal: control.signal }));
  } catch (err) {
    if (agotado) throw new Error(SIN_RESPUESTA);
    throw err;
  } finally {
    clearTimeout(espera);
  }
}

async function cuerpo(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly auth = inject(AuthService);

  async fetch<T>(path: string, init?: RequestInit, esperaMs = ESPERA_MS): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    const token = await this.auth.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const { res, body } = await conEspera(
      `${API_BASE_URL}${path}`,
      { ...init, headers },
      esperaMs,
      async (res) => ({ res, body: await cuerpo(res) }),
    );
    if (!res.ok) {
      const detail =
        (body as { detail?: string } | null)?.detail ?? `HTTP ${res.status} en ${path}`;
      throw new Error(detail);
    }
    return body as T;
  }

  /**
   * Petición autenticada que devuelve la Response tal cual: para descargas (PDF)
   * y para errores cuyo cuerpo trae más que un `detail` de texto.
   */
  async fetchRaw(path: string, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    const token = await this.auth.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return conEspera(`${API_BASE_URL}${path}`, { ...init, headers }, ESPERA_ARCHIVOS_MS, async (res) => res);
  }

  /**
   * POST multipart (FormData) para subir archivos. No fija Content-Type: el
   * navegador lo pone con el boundary del multipart.
   */
  async upload<T>(path: string, form: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    const token = await this.auth.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const { res, body } = await conEspera(
      `${API_BASE_URL}${path}`,
      { method: 'POST', headers, body: form },
      ESPERA_ARCHIVOS_MS,
      async (res) => ({ res, body: await cuerpo(res) }),
    );
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
