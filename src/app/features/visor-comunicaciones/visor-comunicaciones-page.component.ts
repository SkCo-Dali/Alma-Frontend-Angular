// Visor de comunicaciones: app de CONSULTA (master-detail en una sola vista).
// Arriba: buscador + filtros (campaña, rango de fechas). Izquierda: lista de
// resultados (top 50, Cosmos send-mail). Derecha: detalle del envío seleccionado
// (correo, adjuntos, TRAZA de entrega/engagement, detalles) o un estado inicial.

import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { EmlService } from './eml.service';
import { EmlAttachment, ParsedEml } from './eml.types';
import { EmailFrameComponent } from './email-frame.component';
import { AttachmentPreviewComponent } from './attachment-preview.component';
import { ColMenuComponent } from './col-menu.component';
import { ComunicacionRef } from './comunicaciones.mock';
import { ComunicacionesService, EventoTraza, OpcionesFiltros } from './comunicaciones.service';

type Modo = 'correo' | 'adjuntos' | 'traza' | 'detalles';

const ANCHO_LISTA_MIN = 360;
const ANCHO_LISTA_MAX = 800;
const ANCHO_LISTA_KEY = 'visor-comunicaciones.anchoLista';

function leerAnchoGuardado(): number {
  try {
    const v = Number(localStorage.getItem(ANCHO_LISTA_KEY));
    if (v >= ANCHO_LISTA_MIN && v <= ANCHO_LISTA_MAX) return v;
  } catch {
    /* localStorage no disponible */
  }
  return ANCHO_LISTA_MIN;
}

@Component({
  selector: 'alma-visor-comunicaciones-page',
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    EmailFrameComponent,
    AttachmentPreviewComponent,
    ColMenuComponent,
  ],
  template: `
    <div data-full-bleed class="flex flex-col gap-3" [style.height]="'calc(100dvh - 8.5rem)'">
      <!-- ── Barra: inicio + buscador + filtros ── -->
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <a
          routerLink="/"
          class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] transition-colors hover:text-primary"
        >
          <lucide-icon name="arrow-left" [size]="16" />
          Inicio
        </a>

        <form
          class="glass flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-xl px-3 focus-within:ring-2 focus-within:ring-ring"
          (submit)="$event.preventDefault(); buscar()"
        >
          <lucide-icon name="search" [size]="16" class="shrink-0 text-muted-foreground" />
          <input
            [(ngModel)]="qInput"
            name="q"
            type="search"
            placeholder="Buscar por correo del cliente o asunto…"
            class="h-full flex-1 border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </form>

        <button type="button" (click)="buscar()" class="alma-btn alma-btn-primary h-9 rounded-xl px-4 text-sm">
          Buscar
        </button>

        <!-- Filtros (refinan los resultados cargados, estilo cotizaciones) -->
        <div class="glass flex h-9 items-center gap-1.5 rounded-xl px-3">
          <lucide-icon name="megaphone" [size]="14" class="text-muted-foreground" />
          <span class="text-sm text-muted-foreground">Campaña</span>
          <alma-col-menu
            [sortActive]="sortField() === 'campana'"
            [sortDir]="sortDir()"
            [valores]="campanasOpciones()"
            [seleccion]="filtroCampana()"
            (sort)="ordenar('campana', $event)"
            (filtrar)="onCampana($event)"
          />
        </div>
        <div class="glass flex h-9 items-center gap-1.5 rounded-xl px-3">
          <lucide-icon name="calendar-clock" [size]="14" class="text-muted-foreground" />
          <span class="text-sm text-muted-foreground">Fecha</span>
          <alma-col-menu
            [sortActive]="sortField() === 'fecha'"
            [sortDir]="sortDir()"
            [esFecha]="true"
            [fechas]="fechasOpciones()"
            [fechaActiva]="!!(rangoFecha().desde || rangoFecha().hasta)"
            (sort)="ordenar('fecha', $event)"
            (rango)="onRango($event)"
          />
        </div>

        @if (hayFiltros()) {
          <button type="button" (click)="limpiar()" class="alma-btn alma-btn-outline h-9 rounded-xl px-3 text-sm">
            <lucide-icon name="x" [size]="15" /> Limpiar
          </button>
        }
      </div>

      <!-- ── Master-detail ── -->
      <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <!-- Lista -->
        <aside
          class="glass flex max-h-[40vh] w-full shrink-0 flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-sm)] md:max-h-none"
          [style.width.px]="esDesktop() ? anchoLista() : null"
        >
          <header class="shrink-0 border-b border-border/60 px-4 py-3">
            <p class="text-sm font-bold text-foreground">Envíos</p>
            <p class="text-xs text-muted-foreground">
              {{ resultadosFiltrados().length }}{{ hayMas() ? '+' : '' }}
              {{ resultadosFiltrados().length === 1 ? 'resultado' : 'resultados' }}
            </p>
          </header>
          <div class="min-h-0 flex-1 overflow-auto">
            @if (cargandoLista()) {
              <div class="flex h-full items-center justify-center">
                <lucide-icon name="loader-2" [size]="18" class="animate-spin text-primary" />
              </div>
            } @else if (error()) {
              <p class="flex items-center gap-1.5 p-4 text-xs text-destructive">
                <lucide-icon name="alert-triangle" [size]="14" /> {{ error() }}
              </p>
            } @else {
              @for (c of resultadosFiltrados(); track c.id) {
                <button
                  type="button"
                  (click)="seleccionar(c)"
                  class="flex w-full flex-col gap-0.5 border-b border-border/40 px-4 py-2.5 text-left transition-colors hover:bg-accent"
                  [class.bg-primary/10]="seleccionado()?.id === c.id"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {{ c.destinatarios[0] || c.remitenteEmail }}
                    </span>
                    @if (c.estado) {
                      <span class="alma-badge shrink-0" [class]="claseEstado(c.estado)">{{ c.estado }}</span>
                    }
                  </div>
                  <span class="truncate text-xs text-muted-foreground">{{ c.asunto }}</span>
                  <span class="truncate text-[11px] text-muted-foreground/70">
                    {{ fechaCorta(c.fecha) }}@if (c.campana) { · {{ c.campana }} }
                  </span>
                </button>
              } @empty {
                <div class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <lucide-icon name="inbox" [size]="26" class="text-muted-foreground/40" />
                  <p class="text-sm text-muted-foreground">No hay envíos que coincidan.</p>
                </div>
              }
              @if (hayMas()) {
                <p class="px-4 py-2 text-center text-[11px] text-muted-foreground/70">
                  Mostrando los primeros {{ resultados().length }}. Afina la búsqueda para ver menos.
                </p>
              }
            }
          </div>
        </aside>

        <!-- Divisor arrastrable (solo desktop) -->
        <div
          class="hidden w-1.5 shrink-0 cursor-col-resize touch-none self-stretch rounded-full bg-border/40 transition-colors hover:bg-primary/40 md:block"
          (pointerdown)="onResizeStart($event)"
          (pointermove)="onResizeMove($event)"
          title="Arrastra para ajustar el ancho de la lista"
        ></div>

        <!-- Detalle -->
        <section class="glass flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
          @if (cargandoDetalle()) {
            <div class="flex h-full items-center justify-center">
              <span class="flex items-center gap-2 text-sm text-muted-foreground">
                <lucide-icon name="loader-2" [size]="18" class="animate-spin text-primary" /> Abriendo envío…
              </span>
            </div>
          } @else if (parsed(); as eml) {
            <!-- Cabecera del envío -->
            <header class="shrink-0 border-b border-border/60 px-5 pb-3 pt-4">
              <h1 class="truncate text-lg font-bold text-foreground" [title]="eml.subject">
                {{ eml.subject }}
              </h1>
              <!-- Franja de metadatos -->
              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                @if (refActual(); as r) {
                  @if (r.estado) {
                    <span class="alma-badge" [class]="claseEstado(r.estado)">
                      <lucide-icon [name]="iconoEstado(r.estado)" [size]="12" /> {{ r.estado }}
                    </span>
                  }
                  <span><span class="font-medium text-foreground">Para:</span> {{ r.destinatarios[0] || '—' }}</span>
                  @if (r.poliza) {
                    <span><span class="font-medium text-foreground">Póliza:</span> {{ r.poliza }}</span>
                  }
                  @if (r.campana) {
                    <span><span class="font-medium text-foreground">Campaña:</span> {{ r.campana }}</span>
                  }
                }
                <span>{{ fechaLarga(eml.date) }}</span>
              </div>
              @if (refActual()?.error; as err) {
                <p class="mt-1 break-words text-xs text-destructive">{{ err }}</p>
              }
              <!-- Pestañas -->
              <div class="mt-3 flex flex-wrap items-center gap-2">
                @for (m of modos; track m.id) {
                  <button
                    type="button"
                    (click)="modo.set(m.id)"
                    class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                    [class]="modo() === m.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
                  >
                    <lucide-icon [name]="m.icon" [size]="16" />
                    {{ m.label }}
                    @if (m.id === 'traza' && traza().length) {
                      <span class="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">{{ traza().length }}</span>
                    }
                  </button>
                }
              </div>
            </header>

            <div class="min-h-0 flex-1">
              @switch (modo()) {
                @case ('correo') {
                  <div class="flex h-full flex-col">
                    @if (eml.hasRemoteContent && !cargarRemoto()) {
                      <div class="flex flex-wrap items-center gap-2 border-b border-border/60 bg-[var(--surface-sunken)] px-4 py-2 text-xs text-muted-foreground">
                        <lucide-icon name="shield-alert" [size]="15" class="text-primary" />
                        <span class="flex-1">Se bloqueó contenido remoto (imágenes externas y rastreo).</span>
                        <button type="button" (click)="cargarRemoto.set(true)" class="alma-btn alma-btn-outline h-7 rounded-lg text-xs">
                          Cargar imágenes
                        </button>
                      </div>
                    }
                    @if (eml.html) {
                      <alma-email-frame class="min-h-0 flex-1" [html]="eml.html" [loadRemote]="cargarRemoto()" />
                    } @else {
                      <pre class="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-white p-5 text-sm leading-relaxed text-[#111]">{{ eml.text || 'Este correo no tiene cuerpo.' }}</pre>
                    }
                  </div>
                }
                @case ('adjuntos') {
                  <div class="flex h-full flex-col">
                    @if (eml.attachments.length) {
                      <div class="flex flex-wrap gap-1.5 border-b border-border/60 px-4 py-2">
                        @for (a of eml.attachments; track a.id) {
                          <button
                            type="button"
                            (click)="adjuntoSel.set(a)"
                            class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors"
                            [class]="adjuntoActivo()?.id === a.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'"
                          >
                            <lucide-icon [name]="iconoAdjunto(a)" [size]="14" />
                            <span class="max-w-[12rem] truncate">{{ a.filename }}</span>
                          </button>
                        }
                      </div>
                      @if (adjuntoActivo(); as a) {
                        <alma-attachment-preview class="min-h-0 flex-1" [attachment]="a" />
                      }
                    } @else {
                      <div class="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <lucide-icon name="paperclip" [size]="28" class="text-muted-foreground/50" />
                        <p class="text-sm text-muted-foreground">Este correo no tiene adjuntos.</p>
                      </div>
                    }
                  </div>
                }
                @case ('traza') {
                  <div class="h-full overflow-auto p-5">
                    @if (cargandoTraza()) {
                      <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <lucide-icon name="loader-2" [size]="18" class="animate-spin text-primary" /> Cargando traza…
                      </div>
                    } @else if (traza().length === 0) {
                      <div class="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <lucide-icon name="history" [size]="28" class="text-muted-foreground/50" />
                        <p class="text-sm text-muted-foreground">Sin eventos de entrega registrados para este envío.</p>
                      </div>
                    } @else {
                      <ol class="relative ml-3 border-l border-border/60">
                        @for (e of traza(); track $index) {
                          <li class="mb-5 ml-5">
                            <span
                              class="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-[var(--surface)]"
                              [class]="claseEvento(e)"
                            >
                              <lucide-icon [name]="iconoEvento(e)" [size]="10" class="text-white" />
                            </span>
                            <p class="text-sm font-medium text-foreground">{{ etiquetaEvento(e) }}</p>
                            <p class="text-xs text-muted-foreground">{{ fechaLarga(e.fecha) }}</p>
                            @if (e.contexto) {
                              <a [href]="e.contexto" target="_blank" rel="noopener noreferrer" class="mt-0.5 inline-flex items-center gap-1 break-all text-xs text-primary hover:underline">
                                <lucide-icon name="external-link" [size]="12" />{{ e.contexto }}
                              </a>
                            }
                            @if (e.userAgent) {
                              <p class="mt-0.5 break-all text-[11px] text-muted-foreground/70">{{ e.userAgent }}</p>
                            }
                          </li>
                        }
                      </ol>
                    }
                  </div>
                }
                @case ('detalles') {
                  <div class="h-full overflow-auto p-5">
                    <div class="mb-4 grid gap-3 sm:grid-cols-2">
                      <div class="rounded-lg border border-border/60 p-3">
                        <p class="text-[10px] uppercase tracking-wider text-muted-foreground">Message-ID</p>
                        <p class="break-words text-xs text-foreground">{{ eml.messageId || '—' }}</p>
                      </div>
                      <div class="rounded-lg border border-border/60 p-3">
                        <p class="text-[10px] uppercase tracking-wider text-muted-foreground">Tamaño del archivo</p>
                        <p class="text-xs text-foreground">{{ formatBytes(eml.sizeBytes) }}</p>
                      </div>
                    </div>
                    <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Encabezados ({{ eml.headers.length }})
                    </p>
                    <div class="overflow-hidden rounded-lg border border-border/60">
                      <table class="w-full text-xs">
                        <tbody>
                          @for (h of eml.headers; track $index) {
                            <tr class="border-b border-border/40 align-top last:border-0">
                              <td class="w-48 whitespace-nowrap px-3 py-1.5 font-mono font-medium text-muted-foreground">{{ h.key }}</td>
                              <td class="break-all px-3 py-1.5 font-mono text-foreground">{{ h.value }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                }
              }
            </div>
          } @else {
            <!-- Estado inicial (sin selección) -->
            <div class="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
              <div class="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                <lucide-icon name="mail-search" [size]="44" class="text-primary" />
              </div>
              <h2 class="mt-5 text-xl font-bold text-foreground">Busca un correo para empezar</h2>
              <p class="mt-1 max-w-md text-sm text-muted-foreground">
                Ingresa un correo electrónico y utiliza los filtros para encontrar las
                comunicaciones enviadas en nuestras campañas.
              </p>
              <div class="mt-8 grid w-full max-w-2xl grid-cols-2 gap-6 border-t border-border/60 pt-8 sm:grid-cols-4">
                @for (h of hints; track h.label) {
                  <div class="flex flex-col items-center gap-2 text-center">
                    <div class="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                      <lucide-icon [name]="h.icon" [size]="20" class="text-primary" />
                    </div>
                    <p class="text-xs font-medium text-foreground">{{ h.label }}</p>
                  </div>
                }
              </div>
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class VisorComunicacionesPageComponent {
  private readonly eml = inject(EmlService);
  private readonly comService = inject(ComunicacionesService);

  // Filtros (bindeados al formulario superior).
  protected qInput = '';

  // Filtros que refinan (client-side) los resultados cargados.
  protected readonly filtroCampana = signal<string[]>([]);
  protected readonly rangoFecha = signal<{ desde: string | null; hasta: string | null }>({
    desde: null,
    hasta: null,
  });
  protected readonly sortField = signal<'fecha' | 'campana'>('fecha');
  protected readonly sortDir = signal<'asc' | 'desc'>('desc');

  // Ancho de la lista (redimensionable en desktop; mínimo = ANCHO_LISTA_MIN).
  protected readonly anchoLista = signal(leerAnchoGuardado());
  protected readonly esDesktop = signal(
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  private arrastreX = 0;
  private anchoInicial = 0;

  protected readonly resultados = signal<ComunicacionRef[]>([]);
  protected readonly hayMas = signal(false);
  protected readonly cargandoLista = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly seleccionado = signal<ComunicacionRef | null>(null);
  protected readonly refActual = signal<ComunicacionRef | null>(null);
  protected readonly parsed = signal<ParsedEml | null>(null);
  protected readonly cargandoDetalle = signal(false);
  protected readonly modo = signal<Modo>('correo');
  protected readonly cargarRemoto = signal(false);
  protected readonly adjuntoSel = signal<EmlAttachment | null>(null);

  protected readonly traza = signal<EventoTraza[]>([]);
  protected readonly cargandoTraza = signal(false);

  protected readonly adjuntoActivo = computed(
    () => this.adjuntoSel() ?? this.parsed()?.attachments[0] ?? null,
  );

  // Opciones de filtros: preferimos las del servidor (TODA la base); si aún no
  // llegan, caemos a las derivadas de lo cargado (fallback).
  protected readonly opcionesSrv = signal<OpcionesFiltros>({ campanas: [], fechas: [] });
  private readonly campanasDistintas = computed(() =>
    [...new Set(this.resultados().map((c) => c.campana).filter((x): x is string => !!x))].sort(),
  );
  private readonly fechasLista = computed(() =>
    this.resultados()
      .map((c) => c.fecha)
      .filter((x): x is string => !!x),
  );
  protected readonly campanasOpciones = computed(() =>
    this.opcionesSrv().campanas.length ? this.opcionesSrv().campanas : this.campanasDistintas(),
  );
  protected readonly fechasOpciones = computed(() =>
    this.opcionesSrv().fechas.length ? this.opcionesSrv().fechas : this.fechasLista(),
  );
  // La lista solo se ORDENA en cliente; campaña y fecha se filtran en el servidor.
  protected readonly resultadosFiltrados = computed(() => {
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    const field = this.sortField();
    return [...this.resultados()].sort((a, b) => {
      const r =
        field === 'fecha'
          ? (a.fecha || '').localeCompare(b.fecha || '')
          : (a.campana || '').localeCompare(b.campana || '', 'es');
      return r * dir;
    });
  });

  protected readonly modos: { id: Modo; label: string; icon: string }[] = [
    { id: 'correo', label: 'Vista correo', icon: 'mail' },
    { id: 'adjuntos', label: 'Adjuntos', icon: 'paperclip' },
    { id: 'traza', label: 'Traza del envío', icon: 'history' },
    { id: 'detalles', label: 'Detalles técnicos', icon: 'sliders-horizontal' },
  ];

  protected readonly hints: { label: string; icon: string }[] = [
    { label: 'Visualiza el correo completo', icon: 'mail' },
    { label: 'Revisa sus adjuntos', icon: 'paperclip' },
    { label: 'Consulta detalles técnicos', icon: 'info' },
    { label: 'Analiza el contenido con Alma', icon: 'sparkles' },
  ];

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.eml.revoke(this.parsed()));

    // Seguir el breakpoint desktop para aplicar el ancho variable solo en fila.
    const mq = window.matchMedia('(min-width: 768px)');
    const onMq = () => this.esDesktop.set(mq.matches);
    mq.addEventListener('change', onMq);
    destroyRef.onDestroy(() => mq.removeEventListener('change', onMq));

    // Persistir el ancho elegido.
    effect(() => {
      const w = this.anchoLista();
      try {
        localStorage.setItem(ANCHO_LISTA_KEY, String(w));
      } catch {
        /* localStorage no disponible */
      }
    });

    // Opciones de filtros de TODA la base (si falla, quedan los fallback).
    void this.comService
      .opciones()
      .then((o) => this.opcionesSrv.set(o))
      .catch(() => {});

    void this.cargarLista();
  }

  protected onCampana(sel: string[]): void {
    this.filtroCampana.set(sel);
    void this.cargarLista();
  }

  protected onRango(r: { desde: string | null; hasta: string | null }): void {
    this.rangoFecha.set(r);
    void this.cargarLista();
  }

  protected onResizeStart(ev: PointerEvent): void {
    ev.preventDefault();
    this.arrastreX = ev.clientX;
    this.anchoInicial = this.anchoLista();
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
  }

  protected onResizeMove(ev: PointerEvent): void {
    if (!(ev.buttons & 1)) return; // solo mientras se mantiene presionado
    const dx = ev.clientX - this.arrastreX;
    const nuevo = Math.min(ANCHO_LISTA_MAX, Math.max(ANCHO_LISTA_MIN, this.anchoInicial + dx));
    this.anchoLista.set(nuevo);
  }

  protected hayFiltros(): boolean {
    const { desde, hasta } = this.rangoFecha();
    return !!(this.qInput || this.filtroCampana().length || desde || hasta);
  }

  protected buscar(): void {
    void this.cargarLista();
  }

  protected limpiar(): void {
    this.qInput = '';
    this.filtroCampana.set([]);
    this.rangoFecha.set({ desde: null, hasta: null });
    void this.cargarLista();
  }

  protected ordenar(campo: 'fecha' | 'campana', dir: 'asc' | 'desc'): void {
    this.sortField.set(campo);
    this.sortDir.set(dir);
  }

  private async cargarLista(): Promise<void> {
    this.cargandoLista.set(true);
    this.error.set(null);
    try {
      const { desde, hasta } = this.rangoFecha();
      const campanas = this.filtroCampana();
      const { items, hayMas } = await this.comService.buscar({
        q: this.qInput.trim() || undefined,
        campanas: campanas.length ? campanas : undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
      this.resultados.set(items);
      this.hayMas.set(hayMas);
    } catch {
      this.error.set('No se pudo consultar los envíos.');
      this.resultados.set([]);
    } finally {
      this.cargandoLista.set(false);
    }
  }

  protected async seleccionar(c: ComunicacionRef): Promise<void> {
    if (this.seleccionado()?.id === c.id && this.parsed()) return;
    this.seleccionado.set(c);
    this.refActual.set(c);
    this.cargandoDetalle.set(true);
    this.error.set(null);
    this.modo.set('correo');
    this.adjuntoSel.set(null);
    this.cargarRemoto.set(false);
    this.traza.set([]);
    try {
      const buffer = await this.comService.obtenerEml(c);
      const nuevo = await this.eml.parse(buffer);
      this.eml.revoke(this.parsed());
      this.parsed.set(nuevo);
      void this.cargarTraza(c.id);
    } catch {
      this.eml.revoke(this.parsed());
      this.parsed.set(null);
      this.error.set('No se pudo abrir la comunicación. Intenta de nuevo.');
    } finally {
      this.cargandoDetalle.set(false);
    }
  }

  private async cargarTraza(id: string): Promise<void> {
    this.cargandoTraza.set(true);
    try {
      this.traza.set(await this.comService.traza(id));
    } catch {
      this.traza.set([]);
    } finally {
      this.cargandoTraza.set(false);
    }
  }

  protected cerrarDetalle(): void {
    this.eml.revoke(this.parsed());
    this.parsed.set(null);
    this.seleccionado.set(null);
    this.refActual.set(null);
    this.traza.set([]);
    this.adjuntoSel.set(null);
  }

  protected formatBytes(n: number): string {
    return this.eml.formatBytes(n);
  }

  protected fechaLarga(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  }

  protected fechaCorta(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  protected iconoAdjunto(a: EmlAttachment): string {
    switch (a.kind) {
      case 'pdf':
        return 'file-text';
      case 'image':
        return 'eye';
      case 'text':
        return 'scroll-text';
      default:
        return 'paperclip';
    }
  }

  protected claseEstado(estado?: string): string {
    const e = (estado || '').toLowerCase();
    if (e.includes('succ') || e.includes('deliver') || e.includes('entreg')) {
      return 'bg-[#10b981]/12 text-[#047857] dark:text-[#34d399]';
    }
    if (e.includes('fail') || e.includes('bounce') || e.includes('error') || e.includes('rebot')) {
      return 'bg-destructive/12 text-destructive';
    }
    return 'bg-muted text-muted-foreground';
  }

  protected iconoEstado(estado?: string): string {
    const e = (estado || '').toLowerCase();
    if (e.includes('succ') || e.includes('deliver') || e.includes('entreg')) return 'check-circle-2';
    if (e.includes('fail') || e.includes('bounce') || e.includes('error') || e.includes('rebot')) return 'x-circle';
    return 'circle-dashed';
  }

  protected etiquetaEvento(e: EventoTraza): string {
    const est = (e.estado || '').toLowerCase();
    if (e.tipo === 'Engagement') {
      if (est === 'click') return 'Clic en un enlace';
      if (est === 'view' || est === 'open') return 'Correo abierto';
      return `Engagement: ${e.estado}`;
    }
    if (e.tipo === 'Entrega') return `Entrega: ${e.estado}`;
    return `${e.tipo}: ${e.estado}`;
  }

  protected claseEvento(e: EventoTraza): string {
    const est = (e.estado || '').toLowerCase();
    if (est.includes('bounce') || est.includes('fail') || est.includes('rebot')) return 'bg-destructive';
    if (est === 'click' || est === 'view' || est === 'open') return 'bg-primary';
    if (est.includes('deliver') || est.includes('entreg')) return 'bg-[#10b981]';
    return 'bg-muted-foreground';
  }

  protected iconoEvento(e: EventoTraza): string {
    const est = (e.estado || '').toLowerCase();
    if (est === 'click') return 'external-link';
    if (est === 'view' || est === 'open') return 'eye';
    if (est.includes('bounce') || est.includes('fail') || est.includes('rebot')) return 'x-circle';
    if (est.includes('deliver') || est.includes('entreg')) return 'check-circle-2';
    return 'send';
  }
}
