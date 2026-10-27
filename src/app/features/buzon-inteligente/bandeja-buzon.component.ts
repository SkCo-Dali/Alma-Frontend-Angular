// Bandeja del Buzón Inteligente: master-detail. Izquierda, los correos clasificados
// (filtros por buzón/estado/tipo/búsqueda). Derecha, el detalle: qué decidió la IA y
// por qué, los datos extraídos, las acciones previstas/ejecutadas y el correo real
// (visor EML reutilizado del Visor de comunicaciones). Aprobar, corregir, ignorar.

import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import { AttachmentPreviewComponent } from '../visor-comunicaciones/attachment-preview.component';
import { EmailFrameComponent } from '../visor-comunicaciones/email-frame.component';
import { EmlService } from '../visor-comunicaciones/eml.service';
import { EmlAttachment, ParsedEml } from '../visor-comunicaciones/eml.types';
import {
  Buzon,
  BuzonApi,
  Categoria,
  Correo,
  CorreoDetalle,
  ESTADO_CORREO,
  EstadoCorreo,
  PERM_VER_BUZON,
  ArchivoCorreo,
  iconoAccion,
  nombreAccion,
  resumenAccion,
} from './buzon.api';
import { DemoBadgeComponent } from './demo-badge.component';
import { TrazaAsignacionComponent } from './traza-asignacion.component';

/** Un dato extraído en edición (se conserva su tipo al guardar). */
interface DatoForm {
  clave: string;
  tipo: 'texto' | 'numero' | 'bool' | 'json';
  valor: string;
}

interface AsignacionVista {
  tipo: 'persona' | 'carpeta' | 'categorizar' | 'sin';
  icon: string;
  etiqueta: string;
  texto: string;
  correo?: string;
}

type Panel = 'ia' | 'correo' | 'adjuntos' | 'traza';

@Component({
  selector: 'alma-bandeja-buzon',
  imports: [DecimalPipe, FormsModule, RouterLink, LucideAngularModule, AccessDeniedComponent, TooltipDirective, EmailFrameComponent, AttachmentPreviewComponent, DemoBadgeComponent, TrazaAsignacionComponent],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div data-full-bleed class="flex flex-col gap-3" [style.height]="'calc(100dvh - 8.5rem)'">
        <!-- Barra superior -->
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <a routerLink="/apps/buzon-inteligente" class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary">
            <lucide-icon name="arrow-left" [size]="16" /> Buzón Inteligente
          </a>
          <form class="glass flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-xl px-3 focus-within:ring-2 focus-within:ring-ring" (submit)="$event.preventDefault(); aplicar()">
            <lucide-icon name="search" [size]="16" class="shrink-0 text-muted-foreground" />
            <input [(ngModel)]="q" name="q" type="search" placeholder="Buscar por asunto, remitente o resumen…" class="h-full flex-1 border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          </form>
          <select class="alma-input glass h-9 w-44 rounded-xl" [(ngModel)]="buzonId" (ngModelChange)="aplicar()">
            <option value="">Todos los buzones</option>
            @for (b of buzones(); track b.id) { <option [value]="b.id">{{ b.nombre }}</option> }
          </select>
          <select class="alma-input glass h-9 w-40 rounded-xl" [(ngModel)]="categoriaId" (ngModelChange)="aplicar()">
            <option value="">Todos los tipos</option>
            @for (c of categoriasFiltro(); track c.id) { <option [value]="c.id">{{ c.nombre }}</option> }
          </select>
          <alma-demo-badge />
        </div>

        <!-- Estados (chips) -->
        <div class="flex shrink-0 flex-wrap gap-1.5">
          @for (e of estadosChips; track e.id) {
            <button type="button" class="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors" [attr.aria-pressed]="!sinAsignar && estado === e.id" [class]="!sinAsignar && estado === e.id ? 'border-primary bg-primary text-primary-foreground' : 'glass border-border/60 text-foreground hover:text-primary'" (click)="estado = e.id; sinAsignar = false; aplicar()">
              <lucide-icon [name]="e.icon" [size]="13" /> {{ e.nombre }}
              @if (e.id === 'revision' && porRevisar() > 0) { <span class="rounded-full px-1.5 text-[10px] tabular-nums" [class]="!sinAsignar && estado === e.id ? 'bg-white/25' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'">{{ porRevisar() }}</span> }
            </button>
          }
          <span class="mx-1 h-8 w-px bg-border/70" aria-hidden="true"></span>
          <button type="button" class="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors" [attr.aria-pressed]="sinAsignar" [class]="sinAsignar ? 'border-amber-500 bg-amber-500 text-white' : 'glass border-border/60 text-foreground hover:text-amber-600'" almaTooltip="Correos de un grupo de personas que quedaron sin responsable" (click)="alternarSinAsignar()">
            <lucide-icon name="user-x" [size]="13" /> Sin asignar
          </button>
        </div>

        <!-- Master-detail -->
        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <aside class="glass flex max-h-[40vh] w-full shrink-0 flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-sm)] md:max-h-none md:w-[400px]">
            <header class="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
              <div>
                <p class="text-sm font-bold text-foreground">Correos</p>
                <p class="text-xs text-muted-foreground">{{ total() }} {{ total() === 1 ? 'resultado' : 'resultados' }}</p>
              </div>
              <button type="button" class="alma-btn alma-btn-ghost" almaTooltip="Actualizar" (click)="cargar()"><lucide-icon name="refresh-cw" [size]="15" [class.animate-spin]="cargandoLista()" /></button>
            </header>
            <div class="min-h-0 flex-1 overflow-auto">
              @if (cargandoLista() && !correos().length) {
                <p class="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
              } @else if (!correos().length) {
                <div class="flex flex-col items-center gap-2 p-10 text-center">
                  <lucide-icon name="mail-check" [size]="28" class="text-emerald-500" />
                  <p class="text-sm font-medium text-foreground">Nada pendiente aquí</p>
                  <p class="text-xs text-muted-foreground">Cambia los filtros para ver otros correos.</p>
                </div>
              } @else {
                @for (c of correos(); track c.id) {
                  <button type="button" class="flex w-full flex-col gap-1 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-sunken)]" [class.bg-primary/10]="seleccionado()?.id === c.id" (click)="seleccionar(c)">
                    <div class="flex w-full items-center gap-2">
                      <span class="h-2.5 w-2.5 shrink-0 rounded-full" [style.background]="c.categoria_color || '#8E8E93'"></span>
                      <span class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{{ c.asunto }}</span>
                      <span class="shrink-0 text-[11px] text-muted-foreground">{{ hora(c.recibido_en) }}</span>
                    </div>
                    <p class="w-full truncate text-xs text-muted-foreground">{{ c.remitente_nombre || c.remitente }}</p>
                    <div class="flex w-full flex-wrap items-center gap-1.5">
                      <span class="alma-badge" [class]="'alma-badge ' + estadoMeta[c.estado].clase">{{ estadoMeta[c.estado].nombre }}</span>
                      @if (c.categoria_nombre) { <span class="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-foreground">{{ c.categoria_nombre }}</span> }
                      @if (c.grupo_id && !c.asignado_a) { <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Sin asignar</span> }
                      @if (c.confianza !== null) { <span class="ml-auto text-[11px] tabular-nums" [class]="confianzaClase(c.confianza)">{{ (c.confianza * 100) | number: '1.0-0' }}%</span> }
                      @if (c.tiene_adjuntos) { <lucide-icon name="paperclip" [size]="12" class="text-muted-foreground" /> }
                    </div>
                  </button>
                }
                @if (hayMas()) {
                  <button type="button" class="w-full py-3 text-xs font-medium text-primary hover:underline" (click)="masResultados()">Cargar más</button>
                }
              }
            </div>
          </aside>

          <!-- Detalle -->
          <section class="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
            @if (!seleccionado()) {
              <div class="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                <span class="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary"><lucide-icon name="mail-open" [size]="30" /></span>
                <p class="text-sm font-semibold text-foreground">Selecciona un correo</p>
                <p class="max-w-sm text-xs text-muted-foreground">Verás qué decidió Alma, por qué, los datos que extrajo y podrás aprobar o corregir en un clic.</p>
              </div>
            } @else if (detalle(); as d) {
              <!-- Encabezado del correo -->
              <header class="shrink-0 border-b border-border/60 px-5 py-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <h2 class="text-base font-bold leading-snug text-foreground">{{ d.asunto }}</h2>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      <b class="text-foreground">{{ d.remitente_nombre || d.remitente }}</b> &lt;{{ d.remitente }}&gt; · {{ fecha(d.recibido_en) }} · buzón {{ d.buzon_nombre }}
                    </p>
                  </div>
                  <span class="alma-badge" [class]="'alma-badge ' + estadoMeta[d.estado].clase">{{ estadoMeta[d.estado].nombre }}</span>
                </div>

                <!-- Decisión -->
                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-white" [style.background]="d.categoria_color || '#8E8E93'">
                    <lucide-icon name="tag" [size]="14" /> {{ d.categoria_nombre || 'Sin categoría' }}
                  </span>
                  @if (d.confianza !== null) {
                    <span class="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-1.5 text-sm" almaTooltip="Confianza de la IA en la clasificación">
                      <lucide-icon name="gauge" [size]="14" class="text-muted-foreground" />
                      <b class="tabular-nums" [class]="confianzaClase(d.confianza)">{{ (d.confianza * 100) | number: '1.0-0' }}%</b>
                    </span>
                  }
                  <span class="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
                    <lucide-icon [name]="d.origen === 'humano' ? 'user-check' : d.origen === 'regla' ? 'list-filter' : 'sparkles'" [size]="13" />
                    {{ d.origen === 'humano' ? 'Decidido por ' + (d.decidido_por || 'una persona') : d.origen === 'regla' ? 'Regla fija' : 'Clasificado por IA' + (d.modelo_ia ? ' · ' + d.modelo_ia : '') }}
                  </span>
                  @if (asignacion(d); as a) {
                    @if (a.tipo === 'sin') {
                      <span class="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"><lucide-icon name="user-x" [size]="13" /> Sin asignar</span>
                    } @else {
                      <span class="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-1.5 text-xs text-muted-foreground"><lucide-icon [name]="a.icon" [size]="13" /> {{ a.etiqueta }} <b class="text-foreground">{{ a.texto }}</b></span>
                    }
                  }
                  @if (d.categoria_sugerida_id && d.categoria_sugerida_id !== d.categoria_id && d.origen === 'humano') {
                    <span class="inline-flex items-center gap-1 rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300"><lucide-icon name="alert-triangle" [size]="13" /> Corregido: la IA propuso otra categoría</span>
                  }
                </div>

                <!-- Acciones humanas -->
                @if (puedeRevisar() && (d.estado === 'revision' || d.estado === 'error' || d.estado === 'pendiente')) {
                  <div class="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface-sunken)] p-2.5">
                    <select class="alma-input h-9 w-56" [(ngModel)]="categoriaDecision">
                      @for (c of categoriasDe(d.buzon_id); track c.id) { <option [value]="c.id">{{ c.nombre }}</option> }
                    </select>
                    <button type="button" class="alma-btn alma-btn-primary h-9 rounded-lg" [disabled]="accionando()" (click)="decidir(true)">
                      <lucide-icon name="check" [size]="15" /> {{ categoriaDecision === d.categoria_id ? 'Aprobar y ejecutar' : 'Corregir y ejecutar' }}
                    </button>
                    <button type="button" class="alma-btn alma-btn-outline h-9 rounded-lg" [disabled]="accionando()" (click)="decidir(false)" almaTooltip="Guarda la categoría sin ejecutar acciones">
                      <lucide-icon name="tag" [size]="15" /> Solo clasificar
                    </button>
                    <button type="button" class="alma-btn alma-btn-outline h-9 rounded-lg" [disabled]="accionando()" (click)="reclasificar()" almaTooltip="Vuelve a leer el correo con la IA">
                      <lucide-icon name="sparkles" [size]="15" /> Reclasificar
                    </button>
                    <button type="button" class="alma-btn alma-btn-ghost ml-auto h-9 w-auto px-3 text-muted-foreground" [disabled]="accionando()" (click)="ignorar()">
                      <lucide-icon name="mail-x" [size]="15" /> Ignorar
                    </button>
                  </div>
                }
                @if (d.error) {
                  <p class="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"><lucide-icon name="alert-triangle" [size]="13" class="mt-0.5 shrink-0" /> {{ d.error }}</p>
                }
              </header>

              <!-- Pestañas -->
              <div class="flex shrink-0 gap-1 border-b border-border/60 px-5 py-2">
                @for (p of paneles; track p.id) {
                  <button type="button" class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors" [class]="panel() === p.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'" (click)="panel.set(p.id)">
                    <lucide-icon [name]="p.icon" [size]="14" /> {{ p.nombre }}
                    @if (p.id === 'adjuntos' && d.adjuntos.length) { <span class="rounded-full bg-black/10 px-1.5 text-[10px]">{{ d.adjuntos.length }}</span> }
                  </button>
                }
              </div>

              <div class="min-h-0 flex-1 overflow-auto">
                @switch (panel()) {
                  @case ('ia') {
                    <div class="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
                      <div class="rounded-2xl bg-[var(--surface-sunken)] p-4">
                        <p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><lucide-icon name="sparkles" [size]="12" /> Resumen de Alma</p>
                        <p class="mt-2 text-sm leading-relaxed text-foreground">{{ d.resumen || 'Sin resumen (el correo aún no fue procesado).' }}</p>
                        @if (d.justificacion) {
                          <p class="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Por qué</p>
                          <p class="mt-1 text-xs leading-relaxed text-muted-foreground">{{ d.justificacion }}</p>
                        }
                      </div>
                      <div class="flex flex-col gap-4">
                        <div class="rounded-2xl border border-border/60 p-4">
                          <div class="flex items-center justify-between gap-2">
                            <p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><lucide-icon name="scan-text" [size]="12" /> Datos extraídos</p>
                            @if (puedeRevisar() && !editandoDatos()) {
                              <button type="button" class="alma-btn alma-btn-ghost h-7 text-xs" (click)="editarDatos(d)"><lucide-icon name="pencil" [size]="13" /> Corregir datos</button>
                            }
                          </div>
                          @if (editandoDatos()) {
                            <div class="mt-2 grid gap-2">
                              @for (f of datosForm(); track f.clave; let i = $index) {
                                <div class="grid gap-1">
                                  <label class="font-mono text-[11px] text-muted-foreground" [attr.for]="'dx-' + i">{{ f.clave }}</label>
                                  @switch (f.tipo) {
                                    @case ('bool') {
                                      <select class="alma-input h-8 text-xs" [id]="'dx-' + i" [(ngModel)]="f.valor">
                                        <option value="true">Sí</option>
                                        <option value="false">No</option>
                                      </select>
                                    }
                                    @case ('json') {
                                      <textarea class="alma-input min-h-24 py-1.5 font-mono text-[11px]" [id]="'dx-' + i" [(ngModel)]="f.valor"></textarea>
                                    }
                                    @default {
                                      <input class="alma-input h-8 text-xs" [id]="'dx-' + i" [(ngModel)]="f.valor" />
                                    }
                                  }
                                </div>
                              }
                              <form class="flex items-center gap-1.5" (submit)="$event.preventDefault(); agregarDato()">
                                <input class="alma-input h-8 flex-1 font-mono text-xs" name="nuevo-dato" [(ngModel)]="nuevoDato" placeholder="nuevo_dato" aria-label="Clave del dato a agregar" />
                                <button type="submit" class="alma-btn alma-btn-ghost h-8 text-xs" [disabled]="!nuevoDato.trim()"><lucide-icon name="plus" [size]="13" /> Agregar dato</button>
                              </form>
                              @if (errorDatos(); as e) { <p class="text-xs text-destructive">{{ e }}</p> }
                              <p class="text-[11px] text-muted-foreground">{{ d.estado === 'ejecutado' ? 'Al guardar se genera la versión siguiente del archivo.' : 'El archivo se genera con estos datos al aprobar el correo.' }}</p>
                              <div class="flex justify-end gap-2">
                                <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" [disabled]="guardandoDatos()" (click)="editandoDatos.set(false)">Cancelar</button>
                                <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardandoDatos()" (click)="guardarDatos(d)">
                                  <lucide-icon [name]="guardandoDatos() ? 'loader-2' : 'save'" [size]="13" [class.animate-spin]="guardandoDatos()" /> Guardar datos
                                </button>
                              </div>
                            </div>
                          } @else if (entradas(d.datos_extraidos).length) {
                            <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                              @for (e of entradas(d.datos_extraidos); track e[0]) {
                                <dt class="font-mono text-muted-foreground">{{ e[0] }}</dt>
                                @if (listaDe(d.datos_extraidos, e[0]); as l) {
                                  <dd class="min-w-0">
                                    <span class="text-muted-foreground">{{ l.filas.length }} {{ l.filas.length === 1 ? 'elemento' : 'elementos' }}</span>
                                    <div class="mt-1 max-h-40 overflow-auto rounded-lg border border-border/60">
                                      <table class="alma-table text-[11px]">
                                        <thead><tr>@for (c of l.columnas; track c) { <th class="whitespace-nowrap">{{ c }}</th> }</tr></thead>
                                        <tbody>
                                          @for (fila of l.filas; track $index) {
                                            <tr>@for (c of l.columnas; track c) { <td class="whitespace-nowrap">{{ fila[c] }}</td> }</tr>
                                          }
                                        </tbody>
                                      </table>
                                    </div>
                                  </dd>
                                } @else {
                                  <dd class="min-w-0 break-words font-medium text-foreground">{{ e[1] || '—' }}</dd>
                                }
                              }
                            </dl>
                          } @else {
                            <p class="mt-2 text-xs text-muted-foreground">Este tipo de correo no define datos a extraer.</p>
                          }
                        </div>
                        <div class="rounded-2xl border border-border/60 p-4">
                          <p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><lucide-icon name="zap" [size]="12" /> {{ d.estado === 'ejecutado' ? 'Acciones ejecutadas' : 'Acciones previstas' }}</p>
                          <div class="mt-2 flex flex-col gap-1.5">
                            @for (a of d.estado === 'ejecutado' && d.ejecuciones.length ? d.ejecuciones : d.acciones_previstas; track $index) {
                              <div class="flex items-center gap-2 text-sm">
                                <lucide-icon [name]="icono(a.tipo)" [size]="14" class="shrink-0 text-primary" />
                                <span class="min-w-0 flex-1 truncate">{{ resumen({ tipo: a.tipo, parametros: a.parametros ?? {} }) }}</span>
                                @if (esEjecucion(a)) { <span class="alma-badge" [class]="'alma-badge ' + claseResultado(a.resultado)">{{ a.resultado }}</span> }
                              </div>
                            }
                            @if (!d.acciones_previstas.length && !d.ejecuciones.length) { <p class="text-xs italic text-muted-foreground">Este tipo no tiene acciones: solo se clasifica.</p> }
                          </div>
                        </div>
                      </div>

                      <!-- Asignación 2.0 -->
                      @if (d.grupo_id || d.proceso_clave || d.asignacion_traza.length) {
                        <section class="rounded-2xl border border-border/60 p-4 lg:col-span-2" aria-labelledby="bz-asig">
                          <p id="bz-asig" class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><lucide-icon name="route" [size]="12" /> Asignación</p>
                          <div class="mt-2 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
                            <dl class="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1.5 text-xs">
                              <dt class="text-muted-foreground">Proceso</dt>
                              <dd class="font-medium text-foreground">{{ d.proceso_clave || '—' }}</dd>
                              <dt class="text-muted-foreground">Grupo</dt>
                              <dd class="font-medium text-foreground">{{ d.grupo_nombre || 'Sin grupo' }}</dd>
                              <dt class="text-muted-foreground">Asignado a</dt>
                              <dd>
                                @if (asignacion(d); as a) {
                                  @if (a.tipo === 'sin') {
                                    <span class="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-300">Sin asignar</span>
                                  } @else {
                                    <span class="font-medium text-foreground">{{ a.etiqueta }} {{ a.texto }}</span>
                                    @if (a.correo) { <span class="block text-[11px] text-muted-foreground">{{ a.correo }}</span> }
                                  }
                                }
                              </dd>
                            </dl>
                            <div>
                              <p class="mb-2 text-[11px] font-semibold text-muted-foreground">Recorrido</p>
                              <alma-traza-asignacion [traza]="d.asignacion_traza" vacio="Este correo no tiene recorrido de asignación." />
                            </div>
                          </div>
                        </section>
                      }

                      <!-- Archivos generados (059) -->
                      @if (archivos().length || d.proceso_clave) {
                        <section class="rounded-2xl border border-border/60 p-4 lg:col-span-2" aria-labelledby="bz-arch">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <p id="bz-arch" class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><lucide-icon name="file-spreadsheet" [size]="12" /> Archivos</p>
                            @if (puedeRevisar() && d.estado === 'ejecutado') {
                              <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="generando()" almaTooltip="Genera la versión siguiente con los datos actuales" (click)="regenerar(d)">
                                <lucide-icon name="refresh-cw" [size]="13" [class.animate-spin]="generando()" /> Generar de nuevo
                              </button>
                            }
                          </div>
                          @if (cargandoArchivos()) {
                            <p class="mt-2 text-xs text-muted-foreground">Cargando archivos…</p>
                          } @else {
                            <div class="mt-2 grid gap-1.5">
                              @for (a of archivos(); track a.id; let primero = $first) {
                                <div class="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2" [class]="primero ? 'bg-emerald-500/10' : 'bg-[var(--surface-sunken)]'">
                                  <lucide-icon name="file-spreadsheet" [size]="16" class="shrink-0 text-emerald-600" />
                                  <div class="min-w-0 flex-1">
                                    <p class="truncate text-sm font-medium text-foreground">{{ a.nombre }}</p>
                                    <p class="text-[11px] text-muted-foreground">
                                      Versión {{ a.version }}{{ primero ? ' (vigente)' : '' }} · {{ a.filas }} {{ a.filas === 1 ? 'fila' : 'filas' }}@if (a.salida_nombre) { · {{ a.salida_nombre }}} · {{ fecha(a.created_at) }} · {{ a.created_by }}
                                    </p>
                                  </div>
                                  @if (a.borrador_en_hilo) {
                                    <span class="alma-badge gap-1 bg-sky-500/15 text-sky-700 dark:text-sky-300"><lucide-icon name="mail" [size]="11" /> Borrador en el hilo</span>
                                  }
                                  <button type="button" class="alma-btn alma-btn-ghost h-8 rounded-lg text-xs" [disabled]="descargando() === a.id" [attr.aria-label]="'Descargar ' + a.nombre" (click)="descargar(a)">
                                    <lucide-icon [name]="descargando() === a.id ? 'loader-2' : 'download'" [size]="14" [class.animate-spin]="descargando() === a.id" /> Descargar
                                  </button>
                                </div>
                              } @empty {
                                <p class="text-xs text-muted-foreground">
                                  {{ d.estado === 'ejecutado' ? 'La etiqueta de este correo no genera archivo, o aún no se ha generado.' : 'Un correo en Validar genera su archivo al aprobarlo, con la salida de su etiqueta final.' }}
                                </p>
                              }
                            </div>
                          }
                        </section>
                      }
                    </div>
                  }
                  @case ('correo') {
                    @if (cargandoEml()) {
                      <p class="p-6 text-center text-sm text-muted-foreground">Descargando el correo…</p>
                    } @else if (eml(); as e) {
                      <div class="flex h-full flex-col">
                        @if (e.hasRemoteContent) {
                          <div class="flex items-center gap-1.5 border-b border-border/60 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
                            <lucide-icon name="shield-alert" [size]="13" />
                            <span>
                              Imágenes remotas bloqueadas: cargarlas le avisaría al remitente que
                              alguien abrió el correo. Las que viajaron dentro sí se muestran.
                            </span>
                          </div>
                        }
                        @if (e.html) {
                          <alma-email-frame class="min-h-0 flex-1" [html]="e.html" />
                        } @else {
                          <pre class="whitespace-pre-wrap p-5 text-sm">{{ e.text }}</pre>
                        }
                      </div>
                    } @else {
                      <p class="p-6 text-center text-sm text-muted-foreground">{{ errorEml() || 'No fue posible cargar el correo.' }}</p>
                    }
                  }
                  @case ('adjuntos') {
                    <div class="flex h-full">
                      <div class="w-64 shrink-0 overflow-auto border-r border-border/60">
                        @if (eml(); as e) {
                          @for (a of e.attachments; track a.id) {
                            <button type="button" class="flex w-full items-center gap-2 border-b border-border/50 px-3 py-2.5 text-left text-xs hover:bg-[var(--surface-sunken)]" [class.bg-primary/10]="adjunto()?.id === a.id" (click)="adjunto.set(a)">
                              <lucide-icon name="paperclip" [size]="13" class="shrink-0 text-muted-foreground" />
                              <span class="min-w-0 flex-1"><span class="block truncate font-medium text-foreground">{{ a.filename }}</span><span class="text-muted-foreground">{{ emlSvc.formatBytes(a.sizeBytes) }}</span></span>
                            </button>
                          }
                          @if (!e.attachments.length) { <p class="p-4 text-xs text-muted-foreground">Este correo no tiene adjuntos.</p> }
                        } @else {
                          @for (a of d.adjuntos; track a.nombre) {
                            <div class="flex items-center gap-2 border-b border-border/50 px-3 py-2.5 text-xs">
                              <lucide-icon name="paperclip" [size]="13" class="text-muted-foreground" />
                              <span class="min-w-0 flex-1"><span class="block truncate font-medium">{{ a.nombre }}</span><span class="text-muted-foreground">{{ emlSvc.formatBytes(a.tamano) }} @if (a.texto_extraido) { · texto leído por IA }</span></span>
                            </div>
                          }
                        }
                      </div>
                      <div class="min-w-0 flex-1">
                        @if (adjunto(); as a) {
                          <alma-attachment-preview class="h-full" [attachment]="a" />
                        } @else {
                          <div class="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">Selecciona un adjunto para previsualizarlo.</div>
                        }
                      </div>
                    </div>
                  }
                  @case ('traza') {
                    <div class="p-5">
                      <ol class="relative border-l border-border/60 pl-5">
                        <li class="mb-4">
                          <span class="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary"></span>
                          <p class="text-xs text-muted-foreground">{{ fecha(d.recibido_en) }}</p>
                          <p class="text-sm font-medium">Correo recibido en {{ d.buzon_nombre }}</p>
                        </li>
                        <li class="mb-4">
                          <span class="absolute -left-1.5 mt-1 h-3 w-3 rounded-full" [class]="d.origen === 'regla' ? 'bg-sky-500' : 'bg-violet-500'"></span>
                          <p class="text-xs text-muted-foreground">{{ fecha(d.created_at) }}</p>
                          <p class="text-sm font-medium">{{ d.origen === 'regla' ? 'Clasificado por regla fija' : 'Clasificado por IA' }} como <b>{{ d.categoria_nombre }}</b>@if (d.confianza !== null) { ({{ (d.confianza * 100) | number: '1.0-0' }}%) }</p>
                        </li>
                        @if (d.decidido_en) {
                          <li class="mb-4">
                            <span class="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-emerald-500"></span>
                            <p class="text-xs text-muted-foreground">{{ fecha(d.decidido_en) }}</p>
                            <p class="text-sm font-medium">{{ d.decidido_por === 'sistema' ? 'Ejecutado automáticamente (sobre el umbral)' : 'Decidido por ' + d.decidido_por }}</p>
                          </li>
                        }
                        @for (e of d.ejecuciones; track e.id) {
                          <li class="mb-4">
                            <span class="absolute -left-1.5 mt-1 h-3 w-3 rounded-full" [class]="e.resultado === 'ok' ? 'bg-emerald-500' : e.resultado === 'error' ? 'bg-rose-500' : 'bg-slate-400'"></span>
                            <p class="text-xs text-muted-foreground">{{ fecha(e.ejecutado_en) }} · {{ e.ejecutado_por }}</p>
                            <p class="flex items-center gap-1.5 text-sm font-medium"><lucide-icon [name]="icono(e.tipo)" [size]="14" class="text-primary" /> {{ nombre(e.tipo) }} <span class="alma-badge" [class]="'alma-badge ' + claseResultado(e.resultado)">{{ e.resultado }}</span></p>
                            @if (e.detalle) { <p class="text-xs text-muted-foreground">{{ e.detalle }}</p> }
                          </li>
                        }
                      </ol>
                    </div>
                  }
                }
              </div>
            } @else {
              <p class="p-6 text-center text-sm text-muted-foreground">Cargando detalle…</p>
            }
          </section>
        </div>
      </div>
    }
  `,
})
export class BandejaBuzonComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  protected readonly emlSvc = inject(EmlService);

  protected readonly puedeVer = computed(() => this.auth.hasPermission(PERM_VER_BUZON));
  /** Cualquier rol del buzón (admin, editor o revisor) trabaja la bandeja; el
   *  backend solo devuelve correos de los buzones que el usuario ve. */
  protected readonly puedeRevisar = this.puedeVer;

  // Datos extraídos (corrección del revisor) y archivos generados (059)
  protected readonly editandoDatos = signal(false);
  protected readonly datosForm = signal<DatoForm[]>([]);
  protected readonly guardandoDatos = signal(false);
  protected readonly errorDatos = signal<string | null>(null);
  protected nuevoDato = '';
  protected readonly archivos = signal<ArchivoCorreo[]>([]);
  protected readonly cargandoArchivos = signal(false);
  protected readonly generando = signal(false);
  protected readonly descargando = signal<string | null>(null);

  protected readonly estadoMeta = ESTADO_CORREO;
  protected readonly icono = iconoAccion;
  protected readonly nombre = nombreAccion;
  protected readonly resumen = resumenAccion;
  protected readonly estadosChips: { id: EstadoCorreo | ''; nombre: string; icon: string }[] = [
    { id: 'revision', nombre: 'Por revisar', icon: 'mail-warning' },
    { id: 'ejecutado', nombre: 'Ejecutados', icon: 'mail-check' },
    { id: 'error', nombre: 'Con error', icon: 'alert-triangle' },
    { id: 'ignorado', nombre: 'Ignorados', icon: 'mail-x' },
    { id: '', nombre: 'Todos', icon: 'inbox' },
  ];
  protected readonly paneles: { id: Panel; nombre: string; icon: string }[] = [
    { id: 'ia', nombre: 'Decisión de Alma', icon: 'sparkles' },
    { id: 'correo', nombre: 'Correo', icon: 'mail-open' },
    { id: 'adjuntos', nombre: 'Adjuntos', icon: 'paperclip' },
    { id: 'traza', nombre: 'Traza', icon: 'history' },
  ];

  // Filtros
  protected q = '';
  protected buzonId = '';
  protected categoriaId = '';
  protected estado: EstadoCorreo | '' = 'revision';
  /** Cola «Sin asignar» (grupos de personas sin responsable), de cualquier estado. */
  protected sinAsignar = false;
  private offset = 0;
  private readonly limit = 50;

  protected readonly buzones = signal<Buzon[]>([]);
  private readonly categorias = signal<Categoria[]>([]);
  protected readonly correos = signal<Correo[]>([]);
  protected readonly total = signal(0);
  protected readonly porRevisar = signal(0);
  protected readonly cargandoLista = signal(false);
  protected readonly hayMas = computed(() => this.correos().length < this.total());

  protected readonly seleccionado = signal<Correo | null>(null);
  protected readonly detalle = signal<CorreoDetalle | null>(null);
  protected readonly panel = signal<Panel>('ia');
  protected categoriaDecision = '';
  protected readonly accionando = signal(false);

  protected readonly eml = signal<ParsedEml | null>(null);
  protected readonly cargandoEml = signal(false);
  protected readonly errorEml = signal<string | null>(null);
  protected readonly adjunto = signal<EmlAttachment | null>(null);

  protected readonly categoriasFiltro = computed(() => {
    const cats = this.categorias();
    return this.buzonId ? cats.filter((c) => c.buzon_id === this.buzonId) : cats;
  });

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('estado') !== null) this.estado = (qp.get('estado') as EstadoCorreo) ?? '';
    if (qp.get('buzon')) this.buzonId = qp.get('buzon')!;
    if (qp.get('sin_asignar')) {
      this.sinAsignar = true;
      this.estado = '';
    }
    void this.inicial();
    inject(DestroyRef).onDestroy(() => this.emlSvc.revoke(this.eml()));
  }

  private async inicial(): Promise<void> {
    try {
      const buzones = await this.api.listarBuzones();
      this.buzones.set(buzones);
      const cats = await Promise.all(buzones.map((b) => this.api.listarCategorias(b.id)));
      this.categorias.set(cats.flat());
      this.porRevisar.set(buzones.reduce((n, b) => n + b.en_revision, 0));
    } catch {
      /* la lista principal informa el error */
    }
    await this.cargar();
  }

  protected aplicar(): void {
    this.offset = 0;
    void this.cargar();
  }

  protected alternarSinAsignar(): void {
    this.sinAsignar = !this.sinAsignar;
    if (this.sinAsignar) this.estado = '';
    else if (!this.estado) this.estado = 'revision';
    this.aplicar();
  }

  protected async cargar(): Promise<void> {
    this.cargandoLista.set(true);
    try {
      const r = await this.api.listarCorreos({
        buzon_id: this.buzonId || undefined,
        estado: this.estado || undefined,
        categoria_id: this.categoriaId || undefined,
        q: this.q.trim() || undefined,
        sin_asignar: this.sinAsignar || undefined,
        limit: this.limit,
        offset: this.offset,
      });
      this.correos.set(this.offset ? [...this.correos(), ...r.data] : r.data);
      this.total.set(r.total);
      if (!this.offset && r.data.length && !this.seleccionado()) void this.seleccionar(r.data[0]);
    } catch (e) {
      this.toast.error('No se pudieron cargar los correos', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargandoLista.set(false);
    }
  }

  protected masResultados(): void {
    this.offset += this.limit;
    void this.cargar();
  }

  protected categoriasDe(buzonId: string): Categoria[] {
    return this.categorias().filter((c) => c.buzon_id === buzonId && c.activa);
  }

  protected async seleccionar(c: Correo): Promise<void> {
    this.seleccionado.set(c);
    this.detalle.set(null);
    this.emlSvc.revoke(this.eml());
    this.eml.set(null);
    this.adjunto.set(null);
    this.errorEml.set(null);
    this.panel.set('ia');
    this.editandoDatos.set(false);
    this.archivos.set([]);
    try {
      const d = await this.api.obtenerCorreo(c.id);
      this.detalle.set(d);
      this.categoriaDecision = d.categoria_id ?? this.categoriasDe(d.buzon_id)[0]?.id ?? '';
      void this.cargarEml(c.id);
      void this.cargarArchivos(c.id);
    } catch (e) {
      this.toast.error('No se pudo cargar el detalle', e instanceof Error ? e.message : String(e));
    }
  }

  private async cargarEml(id: string): Promise<void> {
    this.cargandoEml.set(true);
    try {
      const buffer = await this.api.obtenerMime(id);
      if (this.seleccionado()?.id !== id) return;
      const parsed = await this.emlSvc.parse(buffer);
      this.eml.set(parsed);
      this.adjunto.set(parsed.attachments[0] ?? null);
    } catch (e) {
      this.errorEml.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargandoEml.set(false);
    }
  }

  protected asignacion(d: Correo): AsignacionVista | null {
    if (d.asignado_persona_id) {
      const correo = d.asignado_a && d.asignado_a.includes('@') ? d.asignado_a : undefined;
      return { tipo: 'persona', icon: 'user', etiqueta: 'Asignado a', texto: d.asignado_nombre ?? d.asignado_a ?? 'una persona', correo: d.asignado_nombre ? correo : undefined };
    }
    const a = d.asignado_a ?? '';
    if (a.startsWith('Carpeta')) return { tipo: 'carpeta', icon: 'folder-input', etiqueta: 'Enviado a', texto: a.replace(/^Carpeta\s*/, 'la carpeta ') };
    if (a === 'Solo categorizar') return { tipo: 'categorizar', icon: 'tag', etiqueta: '', texto: 'Solo categorizar' };
    if (a) return { tipo: 'persona', icon: 'user', etiqueta: 'Asignado a', texto: a };
    // Sin persona ni carpeta: solo es «Sin asignar» si el buzón usa la asignación 2.0.
    return d.grupo_id || d.asignacion_traza?.length ? { tipo: 'sin', icon: 'user-x', etiqueta: '', texto: 'Sin asignar' } : null;
  }

  private reemplazar(actualizado: Correo): void {
    this.correos.update((l) => l.map((x) => (x.id === actualizado.id ? actualizado : x)));
    this.seleccionado.set(actualizado);
    void this.api
      .obtenerCorreo(actualizado.id)
      .then((d) => this.detalle.set(d))
      .catch(() => undefined);
    void this.cargarArchivos(actualizado.id);
    this.porRevisar.update((n) => Math.max(0, n - 1));
  }

  // ── Datos extraídos: corrección del revisor ──
  protected listaDe(datos: Record<string, unknown> | null, clave: string): { columnas: string[]; filas: Record<string, string>[] } | null {
    const v = datos?.[clave];
    if (!Array.isArray(v) || !v.length || !v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) return null;
    const columnas = [...new Set(v.flatMap((x) => Object.keys(x as object)))];
    const filas = (v as Record<string, unknown>[]).map((x) =>
      Object.fromEntries(columnas.map((c) => [c, x[c] === null || x[c] === undefined ? '' : typeof x[c] === 'object' ? JSON.stringify(x[c]) : String(x[c])])),
    );
    return { columnas, filas };
  }

  protected editarDatos(d: CorreoDetalle): void {
    this.errorDatos.set(null);
    this.nuevoDato = '';
    this.datosForm.set(
      Object.entries(d.datos_extraidos ?? {}).map(([clave, v]) => {
        if (typeof v === 'boolean') return { clave, tipo: 'bool' as const, valor: String(v) };
        if (typeof v === 'number') return { clave, tipo: 'numero' as const, valor: String(v) };
        if (v !== null && typeof v === 'object') return { clave, tipo: 'json' as const, valor: JSON.stringify(v, null, 2) };
        return { clave, tipo: 'texto' as const, valor: v === null || v === undefined ? '' : String(v) };
      }),
    );
    this.editandoDatos.set(true);
  }

  protected agregarDato(): void {
    const clave = this.nuevoDato.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!clave) return;
    if (this.datosForm().some((f) => f.clave === clave)) {
      this.errorDatos.set(`Ya existe el dato «${clave}».`);
      return;
    }
    this.datosForm.update((l) => [...l, { clave, tipo: 'texto', valor: '' }]);
    this.nuevoDato = '';
  }

  protected async guardarDatos(d: CorreoDetalle): Promise<void> {
    this.errorDatos.set(null);
    const datos: Record<string, unknown> = {};
    for (const f of this.datosForm()) {
      const v = f.valor.trim();
      if (f.tipo === 'bool') datos[f.clave] = v === 'true';
      else if (f.tipo === 'numero') datos[f.clave] = v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : v;
      else if (f.tipo === 'json') {
        try {
          datos[f.clave] = v ? JSON.parse(v) : null;
        } catch {
          this.errorDatos.set(`«${f.clave}» no es un JSON válido.`);
          return;
        }
      } else datos[f.clave] = v === '' ? null : v;
    }
    this.guardandoDatos.set(true);
    try {
      const r = await this.api.corregirDatos(d.id, datos);
      this.correos.update((l) => l.map((x) => (x.id === r.correo.id ? r.correo : x)));
      this.seleccionado.set(r.correo);
      this.detalle.set(await this.api.obtenerCorreo(d.id));
      this.editandoDatos.set(false);
      if (r.archivo) {
        this.toast.show('Datos corregidos', `Se generó ${r.archivo.nombre} (versión ${r.archivo.version}, ${r.archivo.filas} filas).`);
        void this.cargarArchivos(d.id);
      } else {
        this.toast.show('Datos corregidos', r.correo.asignado_a && !d.asignado_a ? 'Con los datos corregidos el correo ya tiene responsable.' : 'Se guardaron los datos del correo.');
      }
    } catch (e) {
      this.errorDatos.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoDatos.set(false);
    }
  }

  // ── Archivos generados ──
  private async cargarArchivos(correoId: string): Promise<void> {
    this.cargandoArchivos.set(true);
    try {
      const l = await this.api.archivosCorreo(correoId);
      if (this.seleccionado()?.id === correoId) this.archivos.set(l);
    } catch {
      this.archivos.set([]);
    } finally {
      this.cargandoArchivos.set(false);
    }
  }

  protected async regenerar(d: CorreoDetalle): Promise<void> {
    this.generando.set(true);
    try {
      const a = await this.api.regenerarArchivo(d.id);
      this.toast.show('Archivo generado', `${a.nombre} · versión ${a.version} · ${a.filas} filas.`);
      await this.cargarArchivos(d.id);
    } catch (e) {
      this.toast.error('No se pudo generar el archivo', e instanceof Error ? e.message : String(e));
    } finally {
      this.generando.set(false);
    }
  }

  protected async descargar(a: ArchivoCorreo): Promise<void> {
    this.descargando.set(a.id);
    try {
      await this.api.descargarArchivo(a);
    } catch (e) {
      this.toast.error('No se pudo descargar el archivo', e instanceof Error ? e.message : String(e));
    } finally {
      this.descargando.set(null);
    }
  }

  protected async decidir(ejecutar: boolean): Promise<void> {
    const c = this.seleccionado();
    if (!c || !this.categoriaDecision) return;
    this.accionando.set(true);
    try {
      const r = await this.api.decidir(c.id, this.categoriaDecision, ejecutar);
      this.reemplazar(r);
      this.toast.show(ejecutar ? 'Acciones ejecutadas' : 'Correo clasificado', `${r.asunto} → ${r.categoria_nombre}`);
    } catch (e) {
      this.toast.error('No se pudo aplicar la decisión', e instanceof Error ? e.message : String(e));
    } finally {
      this.accionando.set(false);
    }
  }

  protected async ignorar(): Promise<void> {
    const c = this.seleccionado();
    if (!c) return;
    this.accionando.set(true);
    try {
      this.reemplazar(await this.api.ignorar(c.id));
      this.toast.show('Correo ignorado', 'No se ejecutará ninguna acción.');
    } catch (e) {
      this.toast.error('No se pudo ignorar', e instanceof Error ? e.message : String(e));
    } finally {
      this.accionando.set(false);
    }
  }

  protected async reclasificar(): Promise<void> {
    const c = this.seleccionado();
    if (!c) return;
    this.accionando.set(true);
    try {
      const r = await this.api.reclasificar(c.id);
      this.correos.update((l) => l.map((x) => (x.id === r.id ? r : x)));
      this.seleccionado.set(r);
      this.detalle.set(await this.api.obtenerCorreo(r.id));
      this.categoriaDecision = r.categoria_id ?? '';
      this.toast.show('Reclasificado', `${r.categoria_nombre} · ${Math.round((r.confianza ?? 0) * 100)}%`);
    } catch (e) {
      this.toast.error('No se pudo reclasificar', e instanceof Error ? e.message : String(e));
    } finally {
      this.accionando.set(false);
    }
  }

  // helpers de vista
  protected entradas(o: Record<string, unknown> | null): [string, string][] {
    return Object.entries(o ?? {}).map(([k, v]) => [k, v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'sí' : 'no') : String(v)]);
  }
  protected esEjecucion(a: unknown): a is { resultado: 'ok' | 'error' | 'simulado' } {
    return typeof a === 'object' && a !== null && 'resultado' in a;
  }
  protected claseResultado(r: string): string {
    return r === 'ok' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : r === 'error' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-slate-500/15 text-slate-600 dark:text-slate-300';
  }
  protected confianzaClase(c: number): string {
    return c >= 0.85 ? 'text-emerald-600' : c >= 0.7 ? 'text-amber-600' : 'text-rose-600';
  }
  protected hora(iso: string): string {
    const d = new Date(iso);
    const hoy = new Date().toDateString() === d.toDateString();
    return hoy ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  }
  protected fecha(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
