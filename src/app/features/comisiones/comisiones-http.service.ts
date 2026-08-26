// HTTP base del módulo de comisiones:
//  - El Bearer token lo adjunta `authInterceptor` (core/http/auth.interceptor.ts).
//  - Conserva el retry con backoff exponencial ante 5xx/errores de red (ahora
//    vía `retryInterceptor`, opt-in con el context token WITH_RETRY) y el
//    ApiConflictError en 409 (registro duplicado), que la UI trata distinto.

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { WITH_RETRY } from '../../core/http/retry.interceptor';
import { ApiConflictError, HTTP_CONFLICT } from './api-error';

const API_BASE = environment.apiUrl.replace(/\/+$/, '');
const RETRY_CONTEXT = new HttpContext().set(WITH_RETRY, true);

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
  private readonly http = inject(HttpClient);

  /** GET que devuelve JSON. */
  async get<T>(path: string): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.get<T>(`${API_BASE}${path}`, { context: RETRY_CONTEXT }),
      );
    } catch (err) {
      throw await this.error(err, `Error consultando ${path}`);
    }
  }

  /** POST/PUT/PATCH/DELETE que devuelve JSON (o null si el cuerpo viene vacío). */
  async send<T>(
    path: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown,
    fallbackMessage = 'La operación falló',
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.request<T>(method, `${API_BASE}${path}`, {
          body: body === undefined ? undefined : JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
          context: RETRY_CONTEXT,
        }),
      );
    } catch (err) {
      throw await this.error(err, fallbackMessage);
    }
  }

  /**
   * Descarga un archivo (Excel del motor). El nombre sale del
   * Content-Disposition cuando el backend lo manda; si no, del fallback.
   */
  async descargar(path: string, fallbackFilename: string): Promise<void> {
    let res: HttpResponse<Blob>;
    try {
      res = await firstValueFrom(
        this.http.get(`${API_BASE}${path}`, {
          observe: 'response',
          responseType: 'blob',
          context: RETRY_CONTEXT,
        }),
      );
    } catch (err) {
      throw await this.error(err, 'No se pudo generar el archivo');
    }

    const blob = res.body!;
    const nombre =
      nombreDeContentDisposition(res.headers.get('Content-Disposition')) ?? fallbackFilename;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Traduce un error de HttpClient: 409 → ApiConflictError (duplicado), y el
   * resto a Error con el `detail` del backend cuando viene en JSON. El status
   * queda en el mensaje: varios flujos lo inspeccionan (403/404/409).
   */
  private async error(err: unknown, fallbackMessage: string): Promise<Error> {
    if (!(err instanceof HttpErrorResponse)) {
      return err instanceof Error ? err : new Error(fallbackMessage);
    }

    const texto = await this.textoDelError(err);
    if (err.status === HTTP_CONFLICT) {
      return new ApiConflictError(texto || fallbackMessage);
    }

    let detalle = texto;
    const cuerpo = err.error as { detail?: string } | string | null;
    if (cuerpo && typeof cuerpo === 'object') {
      detalle = cuerpo.detail ?? JSON.stringify(cuerpo);
    }

    return new Error(
      `${fallbackMessage}: ${err.status} ${err.statusText}${detalle ? ` - ${detalle}` : ''}`,
    );
  }

  /** `err.error` ya viene parseado por HttpClient (JSON u objeto); si la
   *  respuesta fue un Blob (p. ej. un error del endpoint de descarga con
   *  responseType 'blob'), hay que leerlo aparte. */
  private async textoDelError(err: HttpErrorResponse): Promise<string> {
    if (err.error instanceof Blob) {
      try {
        return await err.error.text();
      } catch {
        return '';
      }
    }
    if (typeof err.error === 'string') return err.error;
    return '';
  }
}
