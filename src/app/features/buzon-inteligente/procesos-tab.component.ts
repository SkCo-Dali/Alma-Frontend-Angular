// Pestaña «Procesos» de la configuración de un buzón (2.0): cada trámite que el
// área reconoce (4X1000, PAC…), con sus señales, exclusiones, datos a extraer y
// etiquetas. «Leer el prompt del área» le pide a la IA que proponga la estructura
// a partir del prompt con el que el área ya trabaja; el editor la revisa (puede
// renombrar y quitar procesos, etiquetas y datos) y la aplica. Nada se guarda sin
// que el editor acepte.

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { AlmaSwitchComponent } from '../../shared/components/alma-switch.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import { Buzon, BuzonApi, CampoProceso, Categoria, CategoriaIn, Proceso, ProcesoIn, PropuestaProcesos } from './buzon.api';

const PALETA = ['#1976D2', '#7B1FA2', '#00796B', '#D32F2F', '#F57C00', '#0097A7', '#5D4037', '#C2185B'];
const RE_CLAVE = /^[A-Z0-9_-]{2,80}$/;
const RE_CAMPO = /^[a-z0-9_]{1,60}$/;

type PasoPrompt = 'prompt' | 'leyendo' | 'revision';

interface ProcesoForm {
  nombre: string;
  clave: string;
  color: string;
  descripcion: string;
  exclusiones: string;
  activo: boolean;
  campos: CampoProceso[];
  etiquetas: string[]; // ids de categorías
}

function claveDe(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

@Component({
  selector: 'alma-procesos-tab',
  imports: [FormsModule, LucideAngularModule, AlmaLoaderComponent, AlmaSwitchComponent, TooltipDirective],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="max-w-3xl text-sm text-muted-foreground">
        Cada proceso es un trámite que el área reconoce (por ejemplo 4X1000 o PAC). Agrupa sus etiquetas y define qué datos
        extrae Alma de cada correo.
      </p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="alma-btn alma-btn-primary rounded-xl" (click)="abrirPrompt()">
          <lucide-icon name="sparkles" [size]="16" /> Leer el prompt del área
        </button>
        <button type="button" class="alma-btn alma-btn-outline rounded-xl" (click)="nuevo()">
          <lucide-icon name="plus" [size]="16" /> Nuevo proceso
        </button>
      </div>
    </div>

    @if (sinProceso().length) {
      <p class="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
        <lucide-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0" />
        <span>Etiquetas sin proceso: <b>{{ sinProceso().join(', ') }}</b>. Asígnalas editando un proceso.</span>
      </p>
    }

    @if (cargando()) {
      <div class="flex justify-center py-12"><alma-loader [size]="56" label="Cargando procesos…" /></div>
    } @else if (error(); as e) {
      <div class="glass flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
        <lucide-icon name="alert-triangle" [size]="24" class="text-rose-500" />
        <p class="text-sm text-foreground">No se pudieron cargar los procesos.</p>
        <p class="text-xs text-muted-foreground">{{ e }}</p>
        <button type="button" class="alma-btn alma-btn-outline mt-1" (click)="cargar()"><lucide-icon name="refresh-cw" [size]="15" /> Reintentar</button>
      </div>
    } @else if (!procesos().length) {
      <div class="glass flex flex-col items-center gap-3 rounded-3xl p-10 text-center">
        <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><lucide-icon name="workflow" [size]="26" /></span>
        <p class="text-sm font-semibold text-foreground">Aún no hay procesos</p>
        <p class="max-w-md text-xs text-muted-foreground">Pega el prompt con el que el área ya clasifica sus correos: Alma lo lee y propone los procesos, sus etiquetas y los datos a extraer. Tú decides qué se queda.</p>
        <button type="button" class="alma-btn alma-btn-primary rounded-xl" (click)="abrirPrompt()"><lucide-icon name="sparkles" [size]="16" /> Leer el prompt del área</button>
      </div>
    } @else {
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        @for (p of procesos(); track p.id) {
          <article class="glass flex flex-col gap-3 rounded-2xl p-4 shadow-[var(--shadow-sm)]" [class.opacity-60]="!p.activo">
            <div class="flex items-start gap-3">
              <span class="mt-0.5 h-9 w-1.5 shrink-0 rounded-full" [style.background]="p.color || '#8E8E93'"></span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-sm font-bold text-foreground">{{ p.nombre }}</h3>
                  <span class="rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{{ p.clave }}</span>
                  @if (!p.activo) { <span class="alma-badge bg-zinc-500/15 text-zinc-600 dark:text-zinc-300">Inactivo</span> }
                </div>
                @if (p.descripcion) { <p class="mt-1 line-clamp-3 text-xs leading-snug text-muted-foreground" [almaTooltip]="p.descripcion">{{ p.descripcion }}</p> }
                @if (p.exclusiones) {
                  <p class="mt-1 flex items-start gap-1 text-[11px] leading-snug text-rose-700 dark:text-rose-300">
                    <lucide-icon name="x-circle" [size]="12" class="mt-0.5 shrink-0" /> <span class="line-clamp-2">{{ p.exclusiones }}</span>
                  </p>
                }
              </div>
              <div class="flex shrink-0 gap-0.5">
                <button type="button" class="alma-btn alma-btn-ghost" almaTooltip="Editar" [attr.aria-label]="'Editar ' + p.nombre" (click)="editar(p)"><lucide-icon name="pencil" [size]="15" /></button>
                <button type="button" class="alma-btn alma-btn-ghost text-destructive" almaTooltip="Eliminar" [attr.aria-label]="'Eliminar ' + p.nombre" (click)="eliminar(p)"><lucide-icon name="trash-2" [size]="15" /></button>
              </div>
            </div>
            <div>
              <p class="text-[11px] font-semibold text-muted-foreground">Etiquetas</p>
              <div class="mt-1 flex flex-wrap gap-1.5">
                @for (e of p.etiquetas; track e) {
                  <span class="inline-flex items-center gap-1 rounded-full border border-border/60 bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] text-foreground">
                    <span class="h-2 w-2 rounded-full" [style.background]="colorEtiqueta(e) || p.color || '#8E8E93'"></span> {{ e }}
                  </span>
                } @empty {
                  <span class="text-[11px] italic text-muted-foreground">Sin etiquetas: edita el proceso para asignarle tipos de correo.</span>
                }
              </div>
            </div>
            <div>
              <p class="text-[11px] font-semibold text-muted-foreground">Datos a extraer ({{ p.campos_extraer.length }})</p>
              <div class="mt-1 flex flex-wrap gap-1.5">
                @for (c of p.campos_extraer; track c.clave) {
                  <span class="inline-flex items-center gap-1 rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[11px] text-foreground" [almaTooltip]="c.descripcion">
                    {{ c.clave }}
                    @if (c.critico) { <span class="rounded bg-amber-500/20 px-1 font-sans text-[10px] font-semibold text-amber-700 dark:text-amber-300">crítico</span> }
                  </span>
                } @empty {
                  <span class="text-[11px] italic text-muted-foreground">Solo categoriza: no extrae datos.</span>
                }
              </div>
            </div>
          </article>
        }
      </div>
    }

    <!-- Editor de proceso -->
    @if (form(); as f) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cerrarEditor()">
        <div class="surface-solid flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-2xl border border-border shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-labelledby="pe-titulo" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <h2 id="pe-titulo" class="text-sm font-semibold text-foreground">{{ editando() ? 'Editar proceso' : 'Nuevo proceso' }}</h2>
            <button type="button" class="alma-btn alma-btn-ghost" aria-label="Cerrar" (click)="cerrarEditor()"><lucide-icon name="x" [size]="16" /></button>
          </div>
          <div class="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="alma-label" for="pe-nombre">Nombre *</label>
                <input id="pe-nombre" class="alma-input" [(ngModel)]="f.nombre" (ngModelChange)="sugerirClave()" placeholder="Planes colectivos (PAC)" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="alma-label" for="pe-clave">Clave *</label>
                <input id="pe-clave" class="alma-input font-mono uppercase" [(ngModel)]="f.clave" (ngModelChange)="claveManual = true" placeholder="PAC" />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <span class="alma-label">Color</span>
              <div class="flex flex-wrap items-center gap-1.5">
                @for (c of paleta; track c) {
                  <button type="button" class="h-7 w-7 rounded-full border-2 transition-transform" [style.background]="c" [class]="f.color === c ? 'scale-110 border-foreground' : 'border-transparent'" [attr.aria-label]="'Color ' + c" [attr.aria-pressed]="f.color === c" (click)="f.color = c"></button>
                }
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="pe-desc">Señales: cómo se reconoce</label>
              <textarea id="pe-desc" class="alma-input min-h-20 py-2 text-sm" [(ngModel)]="f.descripcion" placeholder="Contrato que empieza por PC, planilla o soporte de pago de una empresa…"></textarea>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="pe-excl">Exclusiones: cuándo NO es este proceso</label>
              <textarea id="pe-excl" class="alma-input min-h-16 py-2 text-sm" [(ngModel)]="f.exclusiones" placeholder="No es PAC si la empresa pide un retiro o una certificación."></textarea>
            </div>

            <div>
              <div class="flex items-center justify-between">
                <span class="alma-label">Datos a extraer</span>
                <button type="button" class="alma-btn alma-btn-ghost h-7 text-xs" (click)="agregarCampo(f)"><lucide-icon name="plus" [size]="14" /> Agregar dato</button>
              </div>
              <div class="mt-1.5 space-y-1.5">
                @for (c of f.campos; track $index; let i = $index) {
                  <div class="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface-sunken)] p-2">
                    <input class="alma-input h-8 w-40 font-mono text-xs" [(ngModel)]="c.clave" [attr.aria-label]="'Clave del dato ' + (i + 1)" placeholder="codigo_pac" />
                    <input class="alma-input h-8 min-w-[160px] flex-1 text-xs" [(ngModel)]="c.descripcion" [attr.aria-label]="'Descripción del dato ' + (i + 1)" placeholder="Qué es y en qué formato" />
                    <label class="flex items-center gap-1.5 text-xs text-muted-foreground" almaTooltip="Lo usan validaciones cruzadas o identifica el caso">
                      <alma-switch [checked]="c.critico" (checkedChange)="c.critico = $event" [ariaLabel]="'Dato crítico ' + (c.clave || i + 1)" /> Crítico
                    </label>
                    <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0 text-destructive" [attr.aria-label]="'Quitar dato ' + (c.clave || i + 1)" (click)="f.campos.splice(i, 1)"><lucide-icon name="x" [size]="14" /></button>
                  </div>
                } @empty {
                  <p class="text-xs italic text-muted-foreground">Sin datos: el proceso solo categoriza.</p>
                }
              </div>
            </div>

            <div>
              <span class="alma-label">Etiquetas del proceso</span>
              <p class="text-[11px] text-muted-foreground">Los tipos de correo que pertenecen a este proceso. Una etiqueta pertenece a un solo proceso.</p>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                @for (c of etiquetasElegibles(); track c.id) {
                  <button type="button" class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors" [class]="f.etiquetas.includes(c.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'" [attr.aria-pressed]="f.etiquetas.includes(c.id)" (click)="alternarEtiqueta(f, c.id)">
                    <span class="h-2 w-2 rounded-full" [style.background]="c.color || '#8E8E93'"></span> {{ c.clave }}
                    @if (otroProceso(c); as o) { <span class="text-[10px] opacity-70">(en {{ o }})</span> }
                  </button>
                } @empty {
                  <span class="text-xs italic text-muted-foreground">El buzón aún no tiene tipos de correo.</span>
                }
              </div>
            </div>
            <label class="flex items-center gap-2 text-sm"><alma-switch [checked]="f.activo" (checkedChange)="f.activo = $event" ariaLabel="Proceso activo" /> Proceso activo</label>
            @if (errorForm(); as e) { <p class="text-xs text-destructive">{{ e }}</p> }
          </div>
          <div class="flex justify-end gap-2 border-t border-border/60 px-5 py-3">
            <button type="button" class="alma-btn alma-btn-outline" (click)="cerrarEditor()">Cancelar</button>
            <button type="button" class="alma-btn alma-btn-primary" [disabled]="guardando()" (click)="guardar(f)">
              <lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardando()" /> Guardar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Leer el prompt del área -->
    @if (pasoPrompt(); as paso) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cerrarPrompt()">
        <div class="surface-solid flex max-h-[94dvh] w-full max-w-4xl flex-col rounded-2xl border border-border shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-labelledby="pp-titulo" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
            <div>
              <h2 id="pp-titulo" class="flex items-center gap-2 text-sm font-semibold text-foreground"><lucide-icon name="sparkles" [size]="16" class="text-primary" /> Leer el prompt del área</h2>
              <p class="text-xs text-muted-foreground">
                @switch (paso) {
                  @case ('prompt') { Pega el prompt con el que el área ya clasifica sus correos. Alma lo lee y propone procesos, etiquetas y datos. }
                  @case ('leyendo') { Alma está leyendo el prompt. }
                  @case ('revision') { Revisa la propuesta: renombra o quita lo que no aplique. Nada se guarda hasta que la apliques. }
                }
              </p>
            </div>
            <button type="button" class="alma-btn alma-btn-ghost" aria-label="Cerrar" [disabled]="paso === 'leyendo' || aplicando()" (click)="cerrarPrompt()"><lucide-icon name="x" [size]="16" /></button>
          </div>

          <div class="min-h-0 flex-1 overflow-auto px-5 py-4">
            @switch (paso) {
              @case ('prompt') {
                <label class="alma-label" for="pp-texto">Prompt del área</label>
                <textarea id="pp-texto" class="alma-input mt-1.5 min-h-72 py-2 font-mono text-xs leading-relaxed" [(ngModel)]="textoPrompt" placeholder="Eres el asistente que clasifica los correos del buzón… PASO 1. Reconoce el proceso: - 4X1000: … - PAC: …"></textarea>
                <p class="mt-1.5 text-[11px] text-muted-foreground">Se guarda como el prompt del área al aplicar la propuesta. Puede tener secciones, pasos, reglas de etiqueta y el JSON de salida de ejemplo.</p>
              }
              @case ('leyendo') {
                <div class="flex flex-col items-center gap-3 py-16 text-center" role="status" aria-live="polite">
                  <alma-loader [size]="80" />
                  <p class="text-sm font-medium text-foreground">Leyendo el prompt con la IA…</p>
                  <p class="max-w-sm text-xs text-muted-foreground">Suele tardar entre 10 y 30 segundos. No cierres esta ventana.</p>
                </div>
              }
              @case ('revision') {
                @if (propuesta(); as pr) {
                  <div class="space-y-3">
                    <div class="flex flex-wrap gap-2 text-xs">
                      <span class="rounded-full bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-300">{{ resumenPropuesta().nuevos }} procesos nuevos</span>
                      <span class="rounded-full bg-sky-500/15 px-2.5 py-1 font-medium text-sky-700 dark:text-sky-300">{{ resumenPropuesta().actualiza }} actualizan uno existente</span>
                      <span class="rounded-full bg-violet-500/15 px-2.5 py-1 font-medium text-violet-700 dark:text-violet-300">{{ resumenPropuesta().etiquetas }} etiquetas</span>
                    </div>
                    @if (pr.instrucciones) {
                      <div class="rounded-xl bg-[var(--surface-sunken)] p-3">
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reglas generales que leyó</p>
                        <p class="mt-1 whitespace-pre-line text-xs text-foreground">{{ pr.instrucciones }}</p>
                      </div>
                    }
                    @for (p of pr.procesos; track $index; let i = $index) {
                      <article class="rounded-2xl border border-border/60 p-4">
                        <div class="flex flex-wrap items-start gap-2">
                          <span class="mt-1 h-8 w-1.5 shrink-0 rounded-full" [style.background]="p.color || '#8E8E93'"></span>
                          <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                              <input class="alma-input h-8 min-w-[180px] flex-1 text-sm font-semibold" [(ngModel)]="p.nombre" [attr.aria-label]="'Nombre del proceso ' + p.clave" />
                              <span class="rounded-md bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{{ p.clave }}</span>
                              @if (existe(p.clave)) {
                                <span class="alma-badge bg-sky-500/15 text-sky-700 dark:text-sky-300">Actualiza el existente</span>
                              } @else {
                                <span class="alma-badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Nuevo</span>
                              }
                            </div>
                          </div>
                          <button type="button" class="alma-btn alma-btn-ghost text-destructive" [attr.aria-label]="'Quitar el proceso ' + p.clave" almaTooltip="Quitar de la propuesta" (click)="quitarProceso(i)"><lucide-icon name="trash-2" [size]="15" /></button>
                        </div>
                        <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <div class="flex flex-col gap-1">
                            <label class="text-[11px] font-semibold text-muted-foreground" [attr.for]="'pp-d-' + i">Señales</label>
                            <textarea [id]="'pp-d-' + i" class="alma-input min-h-16 py-1.5 text-xs" [(ngModel)]="p.descripcion"></textarea>
                          </div>
                          <div class="flex flex-col gap-1">
                            <label class="text-[11px] font-semibold text-muted-foreground" [attr.for]="'pp-e-' + i">Exclusiones</label>
                            <textarea [id]="'pp-e-' + i" class="alma-input min-h-16 py-1.5 text-xs" [(ngModel)]="p.exclusiones" placeholder="Sin exclusiones"></textarea>
                          </div>
                        </div>
                        <p class="mt-3 text-[11px] font-semibold text-muted-foreground">Etiquetas</p>
                        <div class="mt-1 space-y-1">
                          @for (e of p.etiquetas; track $index; let j = $index) {
                            <div class="flex flex-wrap items-center gap-2">
                              <span class="w-44 shrink-0 truncate font-mono text-[11px] text-foreground" [title]="e.clave">{{ e.clave }}</span>
                              <input class="alma-input h-7 min-w-[140px] flex-1 text-xs" [(ngModel)]="e.nombre" [attr.aria-label]="'Nombre de la etiqueta ' + e.clave" />
                              @if (existeEtiqueta(e.clave)) { <span class="text-[10px] text-sky-700 dark:text-sky-300">existe</span> } @else { <span class="text-[10px] text-emerald-700 dark:text-emerald-300">nueva</span> }
                              <button type="button" class="alma-btn alma-btn-ghost h-7 w-7 p-0 text-destructive" [attr.aria-label]="'Quitar la etiqueta ' + e.clave" (click)="p.etiquetas.splice(j, 1)"><lucide-icon name="x" [size]="13" /></button>
                            </div>
                          } @empty {
                            <p class="text-[11px] italic text-amber-700 dark:text-amber-300">Sin etiquetas: al aplicar se crea una con la clave del proceso.</p>
                          }
                        </div>
                        <p class="mt-3 text-[11px] font-semibold text-muted-foreground">Datos a extraer</p>
                        <div class="mt-1 flex flex-wrap gap-1.5">
                          @for (c of p.campos; track $index; let j = $index) {
                            <span class="inline-flex items-center gap-1 rounded-md bg-[var(--surface-sunken)] py-0.5 pl-1.5 pr-0.5 font-mono text-[11px] text-foreground" [almaTooltip]="c.descripcion">
                              {{ c.clave }}
                              <button type="button" class="rounded px-1 font-sans text-[10px] font-semibold" [class]="c.critico ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'text-muted-foreground hover:bg-black/5'" [attr.aria-pressed]="c.critico" [attr.aria-label]="'Marcar ' + c.clave + ' como crítico'" (click)="c.critico = !c.critico">crítico</button>
                              <button type="button" class="rounded p-0.5 text-muted-foreground hover:text-destructive" [attr.aria-label]="'Quitar el dato ' + c.clave" (click)="p.campos.splice(j, 1)"><lucide-icon name="x" [size]="11" /></button>
                            </span>
                          } @empty {
                            <span class="text-[11px] italic text-muted-foreground">Solo categoriza.</span>
                          }
                        </div>
                      </article>
                    } @empty {
                      <p class="rounded-xl bg-amber-500/10 p-4 text-center text-xs text-amber-800 dark:text-amber-200">Quitaste todos los procesos. Vuelve al prompt para leerlo de nuevo.</p>
                    }
                  </div>
                }
              }
            }
            @if (errorPrompt(); as e) {
              <p class="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"><lucide-icon name="alert-triangle" [size]="13" class="mt-0.5 shrink-0" /> {{ e }}</p>
            }
          </div>

          <div class="flex flex-wrap justify-end gap-2 border-t border-border/60 px-5 py-3">
            @switch (paso) {
              @case ('prompt') {
                <button type="button" class="alma-btn alma-btn-outline" (click)="cerrarPrompt()">Cancelar</button>
                <button type="button" class="alma-btn alma-btn-primary" [disabled]="textoPrompt.trim().length < 20" (click)="leerPrompt()">
                  <lucide-icon name="sparkles" [size]="15" /> Leer con IA
                </button>
              }
              @case ('revision') {
                <button type="button" class="alma-btn alma-btn-outline mr-auto" [disabled]="aplicando()" (click)="pasoPrompt.set('prompt')"><lucide-icon name="arrow-left" [size]="15" /> Volver al prompt</button>
                <button type="button" class="alma-btn alma-btn-outline" [disabled]="aplicando()" (click)="cerrarPrompt()">Descartar</button>
                <button type="button" class="alma-btn alma-btn-primary" [disabled]="aplicando() || !propuesta()?.procesos?.length" (click)="aplicar()">
                  <lucide-icon [name]="aplicando() ? 'loader-2' : 'check'" [size]="15" [class.animate-spin]="aplicando()" /> Aplicar propuesta
                </button>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class ProcesosTabComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly categorias = input<Categoria[]>([]);
  /** Algo cambió fuera de los procesos (etiquetas, prompt del área): el padre recarga. */
  readonly actualizado = output<void>();

  protected readonly paleta = PALETA;
  protected readonly procesos = signal<Proceso[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  // Editor
  protected readonly form = signal<ProcesoForm | null>(null);
  protected readonly editando = signal<Proceso | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorForm = signal<string | null>(null);
  protected claveManual = false;

  // Prompt
  protected readonly pasoPrompt = signal<PasoPrompt | null>(null);
  protected readonly propuesta = signal<PropuestaProcesos | null>(null);
  protected readonly aplicando = signal(false);
  protected readonly errorPrompt = signal<string | null>(null);
  protected textoPrompt = '';

  protected readonly sinProceso = computed(() =>
    this.categorias()
      .filter((c) => !c.proceso_id && !c.es_fallback && c.activa)
      .map((c) => c.clave),
  );

  protected readonly etiquetasElegibles = computed(() => this.categorias().filter((c) => !c.es_fallback));

  protected readonly resumenPropuesta = computed(() => {
    const pr = this.propuesta()?.procesos ?? [];
    const actualiza = pr.filter((p) => this.existe(p.clave)).length;
    return { nuevos: pr.length - actualiza, actualiza, etiquetas: pr.reduce((n, p) => n + p.etiquetas.length, 0) };
  });

  constructor() {
    queueMicrotask(() => void this.cargar());
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.procesos.set(await this.api.listarProcesos(this.buzon().id));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected colorEtiqueta(clave: string): string | null {
    return this.categorias().find((c) => c.clave === clave)?.color ?? null;
  }

  protected existe(clave: string): boolean {
    return this.procesos().some((p) => p.clave === clave);
  }

  protected existeEtiqueta(clave: string): boolean {
    return this.categorias().some((c) => c.clave === clave);
  }

  protected otroProceso(c: Categoria): string | null {
    if (!c.proceso_id || c.proceso_id === this.editando()?.id) return null;
    return this.procesos().find((p) => p.id === c.proceso_id)?.clave ?? null;
  }

  // ── Editor ──
  protected nuevo(): void {
    this.editando.set(null);
    this.claveManual = false;
    this.errorForm.set(null);
    this.form.set({
      nombre: '',
      clave: '',
      color: PALETA[this.procesos().length % PALETA.length],
      descripcion: '',
      exclusiones: '',
      activo: true,
      campos: [],
      etiquetas: [],
    });
  }

  protected editar(p: Proceso): void {
    this.editando.set(p);
    this.claveManual = true;
    this.errorForm.set(null);
    this.form.set({
      nombre: p.nombre,
      clave: p.clave,
      color: p.color ?? PALETA[0],
      descripcion: p.descripcion ?? '',
      exclusiones: p.exclusiones ?? '',
      activo: p.activo,
      campos: p.campos_extraer.map((c) => ({ ...c })),
      etiquetas: this.categorias().filter((c) => c.proceso_id === p.id).map((c) => c.id),
    });
  }

  protected cerrarEditor(): void {
    if (!this.guardando()) this.form.set(null);
  }

  protected sugerirClave(): void {
    const f = this.form();
    if (f && !this.claveManual) f.clave = claveDe(f.nombre);
  }

  protected agregarCampo(f: ProcesoForm): void {
    f.campos.push({ clave: '', descripcion: '', critico: false });
  }

  protected alternarEtiqueta(f: ProcesoForm, id: string): void {
    f.etiquetas = f.etiquetas.includes(id) ? f.etiquetas.filter((x) => x !== id) : [...f.etiquetas, id];
  }

  protected async guardar(f: ProcesoForm): Promise<void> {
    this.errorForm.set(null);
    const clave = f.clave.trim().toUpperCase().replace(/\s+/g, '_');
    if (f.nombre.trim().length < 2) return this.errorForm.set('Escribe el nombre del proceso.');
    if (!RE_CLAVE.test(clave)) return this.errorForm.set('La clave solo admite mayúsculas, números, guion y guion bajo (2 a 80).');
    const campos = f.campos.filter((c) => c.clave.trim()).map((c) => ({ clave: c.clave.trim().toLowerCase(), descripcion: c.descripcion.trim(), critico: c.critico }));
    const malo = campos.find((c) => !RE_CAMPO.test(c.clave));
    if (malo) return this.errorForm.set(`La clave del dato «${malo.clave}» solo admite minúsculas, números y guion bajo.`);
    if (new Set(campos.map((c) => c.clave)).size !== campos.length) return this.errorForm.set('Hay datos repetidos.');

    const body: ProcesoIn = {
      clave,
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim() || null,
      exclusiones: f.exclusiones.trim() || null,
      campos_extraer: campos,
      color: f.color,
      activo: f.activo,
    };
    this.guardando.set(true);
    try {
      const actual = this.editando();
      const p = actual ? await this.api.actualizarProceso(actual.id, body) : await this.api.crearProceso(this.buzon().id, body);
      const cambios = await this.sincronizarEtiquetas(p.id, f.etiquetas);
      this.toast.show(actual ? 'Proceso actualizado' : 'Proceso creado', `${p.nombre}${cambios ? ` · ${cambios} etiqueta(s) reasignadas` : ''}`);
      this.form.set(null);
      await this.cargar();
      if (cambios) this.actualizado.emit();
    } catch (e) {
      this.errorForm.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }

  /** Une o separa etiquetas del proceso (el PUT de la categoría la reemplaza completa). */
  private async sincronizarEtiquetas(procesoId: string, elegidas: string[]): Promise<number> {
    const cambios = this.categorias().filter((c) => (c.proceso_id === procesoId) !== elegidas.includes(c.id));
    for (const c of cambios) {
      await this.api.actualizarCategoria(c.id, this.categoriaIn(c, elegidas.includes(c.id) ? procesoId : null));
    }
    return cambios.length;
  }

  private categoriaIn(c: Categoria, procesoId: string | null): CategoriaIn {
    return {
      clave: c.clave,
      nombre: c.nombre,
      descripcion: c.descripcion,
      ejemplos: c.ejemplos,
      palabras_clave: c.palabras_clave,
      color: c.color,
      orden: c.orden,
      activa: c.activa,
      es_fallback: c.es_fallback,
      umbral_confianza: c.umbral_confianza,
      campos_extraer: c.campos_extraer,
      acciones: c.acciones,
      proceso_id: procesoId,
    };
  }

  protected async eliminar(p: Proceso): Promise<void> {
    if (!confirm(`¿Eliminar el proceso «${p.nombre}»? Sus etiquetas se conservan, solo quedan sin proceso.`)) return;
    try {
      await this.api.eliminarProceso(p.id);
      this.procesos.update((l) => l.filter((x) => x.id !== p.id));
      this.toast.show('Proceso eliminado', p.nombre);
      this.actualizado.emit();
    } catch (e) {
      this.toast.error('No se pudo eliminar', e instanceof Error ? e.message : String(e));
    }
  }

  // ── Prompt del área ──
  protected abrirPrompt(): void {
    this.textoPrompt = this.buzon().prompt_area ?? '';
    this.propuesta.set(null);
    this.errorPrompt.set(null);
    this.pasoPrompt.set('prompt');
  }

  protected cerrarPrompt(): void {
    if (this.pasoPrompt() === 'leyendo' || this.aplicando()) return;
    this.pasoPrompt.set(null);
  }

  protected async leerPrompt(): Promise<void> {
    this.errorPrompt.set(null);
    this.pasoPrompt.set('leyendo');
    try {
      const propuesta = await this.api.analizarPrompt(this.buzon().id, this.textoPrompt.trim());
      this.propuesta.set(propuesta);
      this.pasoPrompt.set('revision');
      if (!propuesta.procesos.length) this.errorPrompt.set('La IA no encontró procesos en el prompt. Revisa que describa cada trámite.');
    } catch (e) {
      this.errorPrompt.set(e instanceof Error ? e.message : String(e));
      this.pasoPrompt.set('prompt');
    }
  }

  protected quitarProceso(i: number): void {
    const pr = this.propuesta();
    if (!pr) return;
    this.propuesta.set({ ...pr, procesos: pr.procesos.filter((_, j) => j !== i) });
  }

  protected async aplicar(): Promise<void> {
    const pr = this.propuesta();
    if (!pr) return;
    this.aplicando.set(true);
    this.errorPrompt.set(null);
    try {
      const limpia: PropuestaProcesos = {
        instrucciones: pr.instrucciones,
        procesos: pr.procesos.map((p) => ({ ...p, nombre: p.nombre.trim() || p.clave })),
      };
      const r = await this.api.aplicarPropuesta(this.buzon().id, limpia, this.textoPrompt.trim());
      this.toast.show(
        'Propuesta aplicada',
        `${r.procesos_creados} procesos nuevos, ${r.procesos_actualizados} actualizados · ${r.etiquetas_creadas} etiquetas nuevas, ${r.etiquetas_actualizadas} actualizadas.`,
      );
      this.pasoPrompt.set(null);
      await this.cargar();
      this.actualizado.emit();
    } catch (e) {
      this.errorPrompt.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.aplicando.set(false);
    }
  }
}
