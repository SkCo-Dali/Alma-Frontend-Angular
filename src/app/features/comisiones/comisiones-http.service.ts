// HTTP base del módulo de comisiones:
//  - El token de Entra se agrega aquí, de forma explícita (no hay interceptor
//    global de fetch).
//  - Solo las consultas (GET) se reintentan con backoff exponencial ante
//    5xx/errores de red. Guardar, borrar y subir archivos se envían una sola
//    vez: reintentar un POST que sí llegó al servidor duplicaba el registro.
//  - El ApiConflictError en 409 lo trata distinto la UI.
//  - En los 4xx el error lleva el motivo del backend (ver api-error.ts); en los
//    5xx el cuerpo de la respuesta solo va a la consola.

import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService } from '../../core/auth/auth.service';
import {
  ApiConflictError,
  ApiHttpError,
  ApiValidationError,
  HTTP_CONFLICT,
  HTTP_UNPROCESSABLE,
  leerMotivo,
} from './api-error';

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

  /** fetch con retry (solo para GET): reintenta 5xx y errores de red con backoff exponencial. */
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
    const res = await fetch(`${API_BASE}${path}`, {
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
    // Sin reintento automático: cada intento es otra consulta pesada; ante 429/503 el usuario ve el motivo.
    const res = await fetch(`${API_BASE}${path}`, {
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
   * POST multipart (FormData). No fija Content-Type para que el navegador
   * agregue el boundary del multipart.
   */
  async upload<T>(
    path: string,
    formData: FormData,
    fallbackMessage = 'Error subiendo el archivo',
  ): Promise<T> {
    const headers: Record<string, string> = {};
    const token = await this.auth.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const texto = await res.text();
    const body = texto ? (() => {
      try {
        return JSON.parse(texto) as unknown;
      } catch {
        return texto;
      }
    })() : null;

    if (res.status === HTTP_UNPROCESSABLE) {
      throw new ApiValidationError(body, fallbackMessage);
    }
    if (!res.ok) throw await this.errorFromText(res, texto, fallbackMessage);
    return body as T;
  }

  /**
   * Traduce una respuesta fallida: 409 → ApiConflictError, y el resto a
   * ApiHttpError. En los 4xx guarda el motivo legible del backend para el aviso;
   * en los 5xx no, para no mostrar detalles técnicos.
   */
  private async error(res: Response, fallbackMessage: string): Promise<Error> {
    const texto = await res.text().catch(() => '');
    return this.errorFromText(res, texto, fallbackMessage);
  }

  private errorFromText(res: Response, texto: string, fallbackMessage: string): Error {
    const esCliente = res.status >= 400 && res.status < 500;
    const motivo = esCliente ? leerMotivo(texto) : null;
    // En los 5xx el cuerpo puede ser una traza o la página de error del proxy.
    if (!esCliente && texto) console.error(`[Comisiones] ${res.status} en ${res.url}:`, texto);
    const detalle = motivo ?? (esCliente ? texto : '');
    // El status queda en el mensaje: varios flujos lo inspeccionan (403/404/409).
    const mensaje = `${fallbackMessage}: ${res.status} ${res.statusText}${detalle ? ` - ${detalle}` : ''}`;
    if (res.status === HTTP_CONFLICT) {
      return new ApiConflictError(mensaje, motivo);
    }
    return new ApiHttpError(mensaje, res.status, motivo);
  }
}
