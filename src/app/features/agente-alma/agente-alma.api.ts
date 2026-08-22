// Cliente del módulo Agente Alma (alma-backend /api/agente/*).
// Chat conversacional con el agente de Servicio al Cliente (Azure AI Foundry).
// Portado 1:1 de lib/agente-alma.api.ts, incluido el consumo SSE en streaming.

import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/services/api.service';

const API_BASE_URL = environment.apiUrl.replace(/\/+$/, '');

export interface ConversacionItem {
  id: string;
  titulo: string;
  actualizada_en: string;
}

export interface MensajeItem {
  rol: 'user' | 'assistant';
  contenido: string;
  fecha: string;
}

export interface HistorialResponse {
  id: string;
  titulo: string;
  mensajes: MensajeItem[];
}

export interface StreamResult {
  conversacion_id: string;
  titulo?: string | null;
}

export const SUGERENCIAS: string[] = [
  '¿Cómo se solicita un cheque y cuánto tarda la emisión?',
  '¿Cuál es la ruta en AS400 para consultar movimientos de un FPOB?',
  'Muéstrame los casos asociados al documento 1020304050.',
  '¿Qué requisitos hay para un retiro parcial?',
];

export const MENSAJE_BIENVENIDA =
  'Hola, soy Alma, tu asistente de Servicio al Cliente. Puedo ayudarte con procesos y ' +
  'procedimientos, consultar casos en Salesforce y localizar registros de cheques. ' +
  '¿En qué te ayudo?';

@Injectable({ providedIn: 'root' })
export class AgenteAlmaApi {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  listarConversaciones(): Promise<ConversacionItem[]> {
    return this.api.fetch<ConversacionItem[]>('/api/agente/conversaciones');
  }

  obtenerConversacion(id: string): Promise<HistorialResponse> {
    return this.api.fetch<HistorialResponse>(`/api/agente/conversaciones/${id}`);
  }

  /**
   * Envía un mensaje y consume la respuesta en streaming (SSE). Llama onDelta
   * con cada fragmento de texto a medida que llega. Devuelve el id de
   * conversación al cerrar. No usa ApiService (que bufferiza); lee el
   * ReadableStream directamente.
   */
  async enviarMensajeStream(
    mensaje: string,
    conversacionId: string | undefined,
    onDelta: (text: string) => void,
  ): Promise<StreamResult> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(`${API_BASE_URL}/api/agente/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ mensaje, conversacion_id: conversacionId ?? null }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: StreamResult = { conversacion_id: conversacionId ?? '' };
    let errorMsg: string | null = null;

    const procesar = (raw: string) => {
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data:')) continue; // ignora comentarios de padding
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const evt = JSON.parse(payload) as {
            type: string;
            text?: string;
            conversacion_id?: string;
            titulo?: string | null;
            message?: string;
          };
          if (evt.type === 'delta' && evt.text) onDelta(evt.text);
          else if (evt.type === 'done')
            result = {
              conversacion_id: evt.conversacion_id ?? result.conversacion_id,
              titulo: evt.titulo,
            };
          else if (evt.type === 'error') errorMsg = evt.message ?? 'Error del agente.';
        } catch {
          /* fragmento incompleto o no-JSON: ignorar */
        }
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        procesar(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
    if (buffer) procesar(buffer);
    if (errorMsg) throw new Error(errorMsg);
    return result;
  }
}
