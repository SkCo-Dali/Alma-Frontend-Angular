// Chat del Agente Alma (paridad con features/agente-alma/ChatAgente.tsx):
// rail de conversaciones + panel de chat con streaming SSE.

import {
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  AgenteAlmaApi,
  ConversacionItem,
  MENSAJE_BIENVENIDA,
  SUGERENCIAS,
} from './agente-alma.api';

interface Mensaje {
  rol: 'user' | 'assistant';
  contenido: string;
  key: string;
}

let seq = 0;
function nuevoMensaje(rol: 'user' | 'assistant', contenido: string): Mensaje {
  seq += 1;
  return { rol, contenido, key: `${rol}-${seq}` };
}

@Component({
  selector: 'alma-chat-agente',
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="flex h-[calc(100dvh-11rem)] gap-4">
      <!-- Rail de historial -->
      <aside
        class="hidden w-64 shrink-0 flex-col rounded-xl border border-border bg-card md:flex"
      >
        <div class="p-3">
          <button
            type="button"
            class="alma-btn alma-btn-outline w-full justify-start gap-2"
            (click)="nuevaConversacion()"
          >
            <lucide-icon name="message-square-plus" [size]="16" />
            Nueva conversación
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-2 pb-2">
          <p class="px-2 py-1 text-xs font-medium text-muted-foreground">Recientes</p>
          @for (c of conversaciones(); track c.id) {
            <button
              type="button"
              (click)="abrirConversacion(c.id)"
              class="w-full truncate rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
              [class.bg-accent]="c.id === conversacionId()"
              [class.font-medium]="c.id === conversacionId()"
              [title]="c.titulo"
            >
              {{ c.titulo }}
            </button>
          } @empty {
            <p class="px-2 py-2 text-xs text-muted-foreground">
              Aún no tienes conversaciones.
            </p>
          }
        </div>
      </aside>

      <!-- Panel de chat -->
      <section
        class="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-card"
      >
        <header class="flex items-center gap-3 border-b border-border px-5 py-3">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <lucide-icon name="sparkles" [size]="20" />
          </span>
          <div>
            <h1 class="text-sm font-semibold text-foreground">Agente Alma</h1>
            <p class="text-xs text-muted-foreground">Asistente de Servicio al Cliente</p>
          </div>
        </header>

        <!-- Mensajes -->
        <div #scroll class="flex-1 overflow-y-auto px-5 py-4">
          @if (vacio()) {
            <div
              class="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-5 text-center"
            >
              <span
                class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
              >
                <lucide-icon name="sparkles" [size]="28" />
              </span>
              <p class="text-sm text-muted-foreground">{{ bienvenida }}</p>
              <div class="grid w-full gap-2 sm:grid-cols-2">
                @for (s of sugerencias; track s) {
                  <button
                    type="button"
                    (click)="enviar(s)"
                    class="rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    {{ s }}
                  </button>
                }
              </div>
            </div>
          } @else {
            <div class="mx-auto flex max-w-3xl flex-col gap-4">
              @if (cargandoHist()) {
                <p class="text-center text-xs text-muted-foreground">
                  Cargando conversación…
                </p>
              }
              @for (m of visibles(); track m.key) {
                <div class="flex gap-3" [class.flex-row-reverse]="m.rol === 'user'">
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    [class]="
                      m.rol === 'user'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary'
                    "
                  >
                    <lucide-icon [name]="m.rol === 'user' ? 'user' : 'sparkles'" [size]="16" />
                  </span>
                  <div
                    class="max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm"
                    [class]="
                      m.rol === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-background text-foreground'
                    "
                  >
                    {{ m.contenido }}
                  </div>
                </div>
              }
              @if (pensando()) {
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <lucide-icon name="loader-2" [size]="16" class="animate-spin" />
                  Alma está pensando…
                </div>
              }
            </div>
          }
        </div>

        <!-- Composer -->
        <div class="border-t border-border p-3">
          <div class="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              class="alma-input max-h-40 min-h-[44px] flex-1 resize-none py-2.5"
              rows="1"
              [(ngModel)]="input"
              (keydown.enter)="onEnter($any($event))"
              placeholder="Escribe tu consulta… (Enter para enviar, Shift+Enter salto de línea)"
            ></textarea>
            <button
              type="button"
              class="alma-btn alma-btn-primary h-11 w-11 shrink-0 p-0"
              [disabled]="!input.trim() || streaming()"
              (click)="enviar()"
            >
              @if (streaming()) {
                <lucide-icon name="loader-2" [size]="16" class="animate-spin" />
              } @else {
                <lucide-icon name="send" [size]="16" />
              }
            </button>
          </div>
          <p class="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-muted-foreground">
            Alma usa solo información oficial de Skandia. Verifica los datos antes de actuar.
          </p>
        </div>
      </section>
    </div>
  `,
})
export class ChatAgenteComponent implements AfterViewChecked {
  private readonly api = inject(AgenteAlmaApi);

  @ViewChild('scroll') private scrollEl?: ElementRef<HTMLElement>;

  protected readonly bienvenida = MENSAJE_BIENVENIDA;
  protected readonly sugerencias = SUGERENCIAS;

  protected input = '';
  protected readonly mensajes = signal<Mensaje[]>([]);
  protected readonly conversacionId = signal<string | null>(null);
  protected readonly conversaciones = signal<ConversacionItem[]>([]);
  protected readonly streaming = signal(false);
  protected readonly cargandoHist = signal(false);

  protected readonly vacio = computed(
    () => this.mensajes().length === 0 && !this.streaming() && !this.cargandoHist(),
  );
  protected readonly visibles = computed(() =>
    this.mensajes().filter((m) => !(m.rol === 'assistant' && m.contenido === '')),
  );
  protected readonly pensando = computed(() => {
    const m = this.mensajes();
    const ultimo = m[m.length - 1];
    return this.streaming() && ultimo?.rol === 'assistant' && ultimo.contenido === '';
  });

  private ultimoScroll = 0;

  constructor() {
    void this.cargarConversaciones();
  }

  ngAfterViewChecked(): void {
    // auto-scroll al fondo cuando crece el contenido (equivalente al finRef)
    const el = this.scrollEl?.nativeElement;
    if (el && el.scrollHeight !== this.ultimoScroll) {
      this.ultimoScroll = el.scrollHeight;
      el.scrollTop = el.scrollHeight;
    }
  }

  private async cargarConversaciones(): Promise<void> {
    try {
      this.conversaciones.set(await this.api.listarConversaciones());
    } catch {
      this.conversaciones.set([]);
    }
  }

  protected onEnter(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      void this.enviar();
    }
  }

  protected async enviar(texto?: string): Promise<void> {
    const contenido = (texto ?? this.input).trim();
    if (!contenido || this.streaming()) return;
    this.mensajes.update((m) => [...m, nuevoMensaje('user', contenido)]);
    this.input = '';
    this.streaming.set(true);
    const asistente = nuevoMensaje('assistant', '');
    this.mensajes.update((m) => [...m, asistente]);
    try {
      const res = await this.api.enviarMensajeStream(
        contenido,
        this.conversacionId() ?? undefined,
        (delta) => {
          this.mensajes.update((m) =>
            m.map((x) =>
              x.key === asistente.key ? { ...x, contenido: x.contenido + delta } : x,
            ),
          );
        },
      );
      this.conversacionId.set(res.conversacion_id);
      void this.cargarConversaciones();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.mensajes.update((m) =>
        m.map((x) => (x.key === asistente.key ? { ...x, contenido: `⚠️ ${msg}` } : x)),
      );
    } finally {
      this.streaming.set(false);
    }
  }

  protected nuevaConversacion(): void {
    this.conversacionId.set(null);
    this.mensajes.set([]);
    this.input = '';
  }

  protected async abrirConversacion(id: string): Promise<void> {
    if (id === this.conversacionId()) return;
    this.cargandoHist.set(true);
    try {
      const hist = await this.api.obtenerConversacion(id);
      this.conversacionId.set(hist.id);
      this.mensajes.set(hist.mensajes.map((m) => nuevoMensaje(m.rol, m.contenido)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.mensajes.set([nuevoMensaje('assistant', `⚠️ ${msg}`)]);
    } finally {
      this.cargandoHist.set(false);
    }
  }
}
