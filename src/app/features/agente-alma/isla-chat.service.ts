// Chat rápido con el Agente Nova desde la isla (fuera del Inicio y del Agente).
// Usa el mismo API de streaming que el chat completo, así que la conversación
// queda guardada y se puede seguir en la App del Agente («Abrir en el Agente»).
//
// Es global: si la persona cierra la isla mientras Nova responde, la respuesta
// sigue llegando; la isla muestra «Nova está respondiendo» y avisa al terminar.

import { Injectable, computed, inject, signal } from '@angular/core';
import { IslaService } from '../../core/services/isla.service';
import { AgenteAlmaApi } from './agente-alma.api';

export interface MensajeIsla {
  key: number;
  rol: 'user' | 'assistant';
  contenido: string;
}

const ID_ACTIVIDAD = 'nova-chat';

@Injectable({ providedIn: 'root' })
export class IslaChatService {
  private readonly api = inject(AgenteAlmaApi);
  private readonly isla = inject(IslaService);

  readonly mensajes = signal<MensajeIsla[]>([]);
  readonly conversacionId = signal<string | null>(null);
  readonly respondiendo = signal(false);

  /** Mientras llega el primer fragmento de la respuesta. */
  readonly pensando = computed(() => {
    const m = this.mensajes();
    const ultimo = m[m.length - 1];
    return this.respondiendo() && ultimo?.rol === 'assistant' && ultimo.contenido === '';
  });

  private seq = 0;

  async enviar(texto: string): Promise<void> {
    const contenido = texto.trim();
    if (!contenido || this.respondiendo()) return;
    const asistente: MensajeIsla = { key: ++this.seq, rol: 'assistant', contenido: '' };
    this.mensajes.update((m) => [...m, { key: ++this.seq, rol: 'user', contenido }, asistente]);
    this.respondiendo.set(true);
    try {
      const res = await this.api.enviarMensajeStream(
        contenido,
        this.conversacionId() ?? undefined,
        (delta) => this.agregar(asistente.key, delta),
      );
      this.conversacionId.set(res.conversacion_id || this.conversacionId());
      if (!this.isla.chat()) {
        const texto = this.mensajes().find((m) => m.key === asistente.key)?.contenido ?? '';
        this.isla.avisar('Nova respondió', resumen(texto), 'ok');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.mensajes.update((m) =>
        m.map((x) => (x.key === asistente.key ? { ...x, contenido: `⚠️ ${msg}` } : x)),
      );
      if (!this.isla.chat()) this.isla.avisar('Nova no pudo responder', msg, 'error');
    } finally {
      this.respondiendo.set(false);
      this.isla.terminar(ID_ACTIVIDAD);
    }
  }

  /** Al cerrar la isla con una respuesta en curso, queda como actividad. */
  alCerrar(): void {
    if (!this.respondiendo()) return;
    this.isla.reportar({
      id: ID_ACTIVIDAD,
      titulo: 'Nova está respondiendo',
      icono: 'sparkles',
      progreso: null,
      detalle: 'Tu pregunta sigue en curso',
      accion: { etiqueta: 'Abrir', ejecutar: () => this.abrir() },
    });
  }

  abrir(): void {
    this.isla.terminar(ID_ACTIVIDAD);
    this.isla.abrirChat();
  }

  nueva(): void {
    if (this.respondiendo()) return;
    this.mensajes.set([]);
    this.conversacionId.set(null);
  }

  private agregar(key: number, delta: string): void {
    this.mensajes.update((m) =>
      m.map((x) => (x.key === key ? { ...x, contenido: x.contenido + delta } : x)),
    );
  }
}

function resumen(texto: string): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  return t.length > 90 ? t.slice(0, 89) + '…' : t;
}
