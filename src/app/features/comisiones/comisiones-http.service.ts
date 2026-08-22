// HTTP base del módulo de comisiones. Equivale a los `*ApiClient` del front
// React, con dos diferencias deliberadas:
//  - El token de Entra se agrega aquí (en React lo inyectaba un interceptor
//    global de fetch; en Angular es explícito).
//  - Conserva el retry con backoff exponencial ante 5xx/errores de red y el
//    ApiConflictError en 409 (registro duplicado), que la UI trata distinto.

import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ApiConflictError, HTTP_CONFLICT } from './api-error';

const API_BASE = environment.apiUrl.replace(/\/+$/, '');
const RETRIES = 3;

/** Nombre de archivo del header, con la variante UTF-8 primero. */
function nombreDeContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const ascii = header.match(/filename="?([^";]+)"?/i);
  return ascii?.[1] ?? null;
}

@Injectable({ providedIn: 'root' })
export class ComisionesHttp {
  private readonly auth = inject(AuthService);

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await this.auth.getAccessToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  /** fetch con retry: reintenta 5xx y errores de red con backoff exponencial. */
  private async fetchConRetry(url: string, init?: RequestInit): Promise<Response> {
    for (let i = 0; i < RETRIES; i++) {
      try {
        const res = await fetch(url, init);
        // Éxito o error de cliente (4xx): se devuelve tal cual.
        if (res.ok || (res.status >= 400 && res.status < 500)) return res;
        if (i === RETRIES - 1) return res;
      } catch (err) {
        if (i === RETRIES - 1) throw err;
      }
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
    throw new Error('Max retries exceeded');
  }

  /** GET que devuelve JSON. */
  async get<T>(path: string): Promise<T> {
    const res = await this.fetchConRetry(`${API_BASE}${path}`, {
      headers: await this.headers(),
    });
    if (!res.ok) throw await this.error(res, `Error consultando ${path}`);
    return (await res.json()) as T;
  }

  /** POST/PUT/PATCH que devuelve JSON (o null si el cuerpo viene vacío). */
  async send<T>(
    path: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown,
    fallbackMessage = 'La operación falló',
  ): Promise<T> {
    const res = await this.fetchConRetry(`${API_BASE}${path}`, {
      method,
      headers: await this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw await this.error(res, fallbackMessage);
    const texto = await res.text();
    return (texto ? JSON.parse(texto) : null) as T;
  }

  /**
   * Descarga un archivo (Excel del motor). El nombre sale del
   * Content-Disposition cuando el backend lo manda; si no, del fallback.
   */
  async descargar(path: string, fallbackFilename: string): Promise<void> {
    const res = await this.fetchConRetry(`${API_BASE}${path}`, {
      headers: await this.headers(),
    });
    if (!res.ok) throw await this.error(res, 'No se pudo generar el archivo');

    const blob = await res.blob();
    const nombre =
      nombreDeContentDisposition(res.headers.get('Content-Disposition')) ??
      fallbackFilename;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Traduce una respuesta fallida: 409 → ApiConflictError (duplicado), y el
   * resto a Error con el `detail` del backend cuando viene en JSON.
   */
  private async error(res: Response, fallbackMessage: string): Promise<Error> {
    const texto = await res.text().catch(() => '');
    if (res.status === HTTP_CONFLICT) {
      return new ApiConflictError(texto || fallbackMessage);
    }
    let detalle = texto;
    try {
      const json = JSON.parse(texto) as { detail?: string };
      if (json?.detail) detalle = json.detail;
    } catch {
      /* no era JSON: se usa el texto crudo */
    }
    // El status queda en el mensaje: varios flujos lo inspeccionan (403/404/409).
    return new Error(
      `${fallbackMessage}: ${res.status} ${res.statusText}${detalle ? ` - ${detalle}` : ''}`,
    );
  }
}
