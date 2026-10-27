// Constructor de plantillas de exportación (059), en tres pasos como el prototipo
// validado (ajustes 30/31):
//   ① Modelo: el área sube SU plantilla (.xlsx/.csv); Alma lee la hoja, la fila
//      de encabezados (lo de arriba se conserva como título) y propone de dónde
//      sale cada columna (✦). También se puede armar desde el JSON o en blanco.
//   ② Qué va en cada columna: dato del correo, texto fijo, columna de una base,
//      fórmula, información del correo o número de fila; formato y orden.
//   ③ Revisar: nombre, hoja, nombre del archivo con {campo}, formato, vista
//      previa con el último correo real del proceso y pendientes.

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import {
  Base,
  BuzonApi,
  COMPARACIONES,
  ColumnaPlantilla,
  DATOS_CORREO,
  FORMATOS_COLUMNA,
  ModeloLeido,
  ORIGENES,
  OrigenColumna,
  Plantilla,
  PlantillaIn,
  TipoOrigen,
  VistaPrevia,
} from './buzon.api';
import { faltaEnColumna, nombreArchivo, sugerirColumna } from './buzon-exportacion';

type Paso = 1 | 2 | 3;

interface ColumnaForm extends ColumnaPlantilla {
  sugerido?: boolean;
  ejemplo?: string;
}

interface PlantillaForm {
  nombre: string;
  formato: 'xlsx' | 'csv';
  separador: string;
  hoja: string;
  nombre_archivo: string;
  titulo: string[][];
  columnas: ColumnaForm[];
  detalle: string | null;
  modelo: string | null;
}

/** Procesos con sus datos, para el selector de campos y la vista previa. */
export interface ProcesoCampos {
  clave: string;
  nombre: string;
  campos: string[];
  /** Datos de su correo más reciente («Así se llamará»). */
  ejemplo: Record<string, unknown>;
}

const SEPARADORES = [
  { id: ';', nombre: 'Punto y coma ( ; )' },
  { id: ',', nombre: 'Coma ( , )' },
  { id: '|', nombre: 'Barra ( | )' },
  { id: '\t', nombre: 'Tabulación' },
];

function letra(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

@Component({
  selector: 'alma-plantilla-builder',
  imports: [FormsModule, LucideAngularModule, AlmaLoaderComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4" (click)="cerrar()">
      <div class="surface-solid flex h-[94dvh] w-full max-w-6xl flex-col rounded-2xl border border-border shadow-[var(--shadow-lg)]" role="dialog" aria-modal="true" aria-labelledby="tb-t" (click)="$event.stopPropagation()" (input)="tocar()" (change)="tocar()">
        <!-- Encabezado y pasos -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
          <div>
            <h2 id="tb-t" class="flex items-center gap-2 text-sm font-semibold text-foreground"><lucide-icon name="file-spreadsheet" [size]="16" class="text-emerald-600" /> {{ plantilla() ? 'Plantilla «' + plantilla()!.nombre + '»' : 'Nueva plantilla' }}</h2>
            <p class="text-xs text-muted-foreground">El archivo que el área ya usa, con cada columna llenada por Alma.</p>
          </div>
          <button type="button" class="alma-btn alma-btn-ghost" aria-label="Cerrar" [disabled]="guardando()" (click)="cerrar()"><lucide-icon name="x" [size]="16" /></button>
        </div>
        <div class="grid grid-cols-3 gap-1 border-b border-border/60 px-5 py-2" role="tablist" aria-label="Pasos">
          @for (p of pasos(); track p.n) {
            <button type="button" role="tab" class="flex flex-col items-start rounded-xl px-3 py-1.5 text-left transition-colors disabled:opacity-40" [attr.aria-selected]="paso() === p.n" [class]="paso() === p.n ? 'bg-primary/10 text-primary' : 'hover:bg-[var(--surface-sunken)]'" [disabled]="p.n > 1 && !f.columnas.length" (click)="paso.set(p.n)">
              <span class="text-xs font-semibold">{{ p.n }} · {{ p.nombre }}</span>
              <span class="text-[11px] text-muted-foreground">{{ p.estado }}</span>
            </button>
          }
        </div>

        <div class="min-h-0 flex-1 overflow-auto px-5 py-4">
          @switch (paso()) {
            <!-- ① MODELO -->
            @case (1) {
              <div class="grid gap-4">
                <label class="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border/80 p-6 text-center hover:border-primary" for="tb-file">
                  <lucide-icon name="upload" [size]="26" class="text-primary" />
                  <span class="text-sm font-semibold text-foreground">{{ f.columnas.length ? 'Reemplazar con mi plantilla (.xlsx / .csv)' : 'Subir mi plantilla (.xlsx / .csv)' }}</span>
                  <span class="max-w-lg text-xs text-muted-foreground">Alma lee tus hojas, encuentra la fila de encabezados y propone qué dato va en cada columna.@if (f.columnas.length) { Las columnas que coincidan por nombre conservan lo que ya asignaste.}</span>
                </label>
                <input id="tb-file" type="file" class="sr-only" accept=".xlsx,.xlsm,.csv" (change)="subirModelo($event)" />

                @if (leyendo()) {
                  <div class="flex justify-center py-6"><alma-loader [size]="48" label="Leyendo tu plantilla…" /></div>
                } @else if (modeloLeido(); as m) {
                  <div class="grid gap-3 rounded-2xl bg-[var(--surface-sunken)] p-4">
                    <p class="flex items-center gap-1.5 text-sm font-semibold text-foreground"><lucide-icon name="file-spreadsheet" [size]="15" /> {{ m.modelo }}</p>
                    <div class="flex flex-wrap items-end gap-3">
                      @if (m.hojas.length > 1) {
                        <div class="flex flex-col gap-1">
                          <label class="text-[11px] font-semibold text-muted-foreground" for="tb-mh">Hoja</label>
                          <select id="tb-mh" class="alma-input h-8 w-48 text-xs" [(ngModel)]="hojaModelo" (ngModelChange)="releerModelo(true)">
                            @for (h of m.hojas; track h) { <option [value]="h">{{ h }}</option> }
                          </select>
                        </div>
                      }
                      <div class="flex flex-col gap-1">
                        <label class="text-[11px] font-semibold text-muted-foreground" for="tb-mf">Fila de encabezados</label>
                        <input id="tb-mf" type="number" min="1" max="50" class="alma-input h-8 w-24 text-xs" [(ngModel)]="filaModelo" />
                      </div>
                      <button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" (click)="releerModelo(false)"><lucide-icon name="rotate-ccw" [size]="13" /> Volver a leer</button>
                    </div>
                    <div class="max-h-60 overflow-auto rounded-lg border border-border/60 bg-card/60">
                      <table class="alma-table text-[11px]">
                        <tbody>
                          @for (t of m.titulo; track $index; let i = $index) {
                            <tr><td class="w-8 text-right text-muted-foreground">{{ i + 1 }}</td>@for (c of t; track $index) { <td class="whitespace-nowrap italic text-muted-foreground">{{ c }}</td> }</tr>
                          }
                          <tr class="bg-primary/10"><td class="w-8 text-right text-muted-foreground">{{ m.fila_encabezado }}</td>@for (c of m.columnas; track $index) { <td class="whitespace-nowrap font-semibold">{{ c.encabezado }}</td> }</tr>
                          <tr><td class="w-8 text-right text-muted-foreground">{{ m.fila_encabezado + 1 }}</td>@for (c of m.columnas; track $index) { <td class="whitespace-nowrap">{{ c.ejemplo }}</td> }</tr>
                        </tbody>
                      </table>
                    </div>
                    <p class="text-[11px] text-muted-foreground">La fila resaltada es la de encabezados. Lo que esté arriba se conserva como título del archivo. {{ sugeridas(m) }} de {{ m.columnas.length }} columnas con propuesta de Alma (✦).</p>
                    <div class="flex justify-end">
                      <button type="button" class="alma-btn alma-btn-primary h-9 rounded-lg" (click)="usarModelo(m)"><lucide-icon name="check" [size]="15" /> Usar estas columnas</button>
                    </div>
                  </div>
                } @else {
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs text-muted-foreground">¿No tienes una plantilla?</span>
                    <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="!camposSimples().length" (click)="desdeJson()"><lucide-icon name="code" [size]="14" /> Armarla desde los datos del JSON</button>
                    <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" (click)="enBlanco()"><lucide-icon name="plus" [size]="14" /> Empezar en blanco</button>
                  </div>
                }
                @if (f.columnas.length && !modeloLeido()) {
                  <p class="flex items-start gap-1.5 rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-800 dark:text-sky-200">
                    <lucide-icon name="info" [size]="13" class="mt-0.5 shrink-0" />
                    <span>Esta plantilla tiene {{ f.columnas.length }} columnas{{ f.modelo ? ' (modelo ' + f.modelo + ')' : ' y no tiene un modelo cargado' }}. Si subes tu archivo, se conservan las columnas que coincidan por nombre.</span>
                  </p>
                  <div class="flex justify-end"><button type="button" class="alma-btn alma-btn-primary h-9 rounded-lg" (click)="paso.set(2)">Siguiente: qué va en cada columna <lucide-icon name="arrow-right" [size]="14" /></button></div>
                }
              </div>
            }

            <!-- ② QUÉ VA EN CADA COLUMNA -->
            @case (2) {
              <div class="grid gap-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-xs text-muted-foreground">Haz clic en un encabezado para decir qué va en esa columna. ✦ = propuesta de Alma por el nombre. En ámbar: sin asignar.</p>
                  <div class="flex flex-wrap gap-1.5">
                    <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" (click)="proponer()"><lucide-icon name="sparkles" [size]="14" /> Proponer lo que falta</button>
                    <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" (click)="agregarColumna()"><lucide-icon name="plus" [size]="14" /> Columna</button>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <label for="tb-det" class="text-muted-foreground">Detalle:</label>
                  <select id="tb-det" class="alma-input h-8 w-auto min-w-[260px] text-xs" [(ngModel)]="f.detalle">
                    <option [ngValue]="null">Una fila por correo</option>
                    @for (l of nombresListas(); track l) { <option [ngValue]="l">Una fila por elemento de «{{ l }}»</option> }
                  </select>
                  @if (!nombresListas().length) { <span class="text-[11px] text-muted-foreground">(aún no hay correos con listas de elementos en este buzón)</span> }
                </div>

                <div class="overflow-x-auto rounded-xl border border-border/60">
                  <table class="alma-table text-xs">
                    <thead>
                      <tr>
                        @for (c of f.columnas; track $index; let j = $index) {
                          <th class="min-w-[140px] p-1 align-top">
                            <button type="button" class="flex w-full flex-col items-start gap-1 rounded-lg px-2 py-1.5 text-left transition-colors" [class]="sel() === j ? 'bg-primary/15 ring-2 ring-primary' : 'hover:bg-[var(--surface-sunken)]'" [attr.aria-pressed]="sel() === j" (click)="sel.set(j)">
                              <span class="text-[10px] text-muted-foreground">{{ letra(j) }}</span>
                              <b class="text-foreground">{{ c.encabezado || '…' }}</b>
                              @if (c.origen.tipo === 'vacio') {
                                <span class="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Sin asignar</span>
                              } @else {
                                <span class="max-w-[160px] truncate rounded-full px-1.5 text-[10px] font-medium" [class]="c.sugerido ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'">{{ c.sugerido ? '✦ ' : '' }}{{ resumenOrigen(c.origen) }}</span>
                              }
                            </button>
                          </th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        @for (c of f.columnas; track $index) { <td class="whitespace-nowrap text-muted-foreground" [class.bg-amber-500/10]="c.origen.tipo === 'vacio'">{{ c.ejemplo || (c.origen.tipo === 'vacio' ? '¿de dónde sale?' : '') }}</td> }
                      </tr>
                    </tbody>
                  </table>
                </div>

                @if (columna(); as c) {
                  <section class="grid gap-3 rounded-2xl bg-[var(--surface-sunken)] p-4" aria-label="Columna seleccionada">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="text-sm font-semibold text-foreground">
                        Columna {{ letra(sel()) }} · {{ c.encabezado || '…' }}
                        @if (c.sugerido) { <span class="alma-badge ml-1 bg-violet-500/15 text-violet-700 dark:text-violet-300">✦ Propuesta de Alma</span> }
                      </p>
                      <div class="flex items-center gap-1">
                        @if (c.sugerido) { <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" (click)="c.sugerido = false; tocar()"><lucide-icon name="check" [size]="13" /> Aceptar propuesta</button> }
                        <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0" [disabled]="sel() === 0" aria-label="Mover a la izquierda" (click)="mover(-1)"><lucide-icon name="arrow-left" [size]="14" /></button>
                        <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0" [disabled]="sel() === f.columnas.length - 1" aria-label="Mover a la derecha" (click)="mover(1)"><lucide-icon name="arrow-right" [size]="14" /></button>
                        <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0 text-destructive" aria-label="Quitar columna" (click)="quitarColumna()"><lucide-icon name="trash-2" [size]="14" /></button>
                      </div>
                    </div>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div class="flex flex-col gap-1">
                        <label class="alma-label" for="tb-cn">Nombre en el archivo</label>
                        <input id="tb-cn" class="alma-input h-9" [(ngModel)]="c.encabezado" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="alma-label" for="tb-cf">Formato</label>
                        <select id="tb-cf" class="alma-input h-9" [(ngModel)]="c.formato">
                          @for (o of formatos; track o.id) { <option [value]="o.id">{{ o.nombre }}</option> }
                        </select>
                      </div>
                    </div>
                    <div>
                      <span class="alma-label">¿De dónde sale el valor?</span>
                      <div class="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Origen del valor">
                        @for (o of origenes; track o.id) {
                          <button type="button" role="radio" [attr.aria-checked]="c.origen.tipo === o.id" class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors" [class]="c.origen.tipo === o.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-card/60 text-foreground hover:border-primary/60'" (click)="cambiarOrigen(c, o.id)">
                            <lucide-icon [name]="o.icon" [size]="13" /> {{ o.nombre }}
                          </button>
                        }
                      </div>
                    </div>
                    @switch (c.origen.tipo) {
                      @case ('campo') {
                        <div class="flex flex-col gap-1">
                          <label class="alma-label" for="tb-campo">Dato del correo</label>
                          <input id="tb-campo" class="alma-input h-9 font-mono text-sm" list="tb-campos" [(ngModel)]="c.origen.campo" (ngModelChange)="c.sugerido = false" placeholder="codigo_pac" />
                          <datalist id="tb-campos">
                            @for (k of camposColumna(); track k) { <option [value]="k"></option> }
                          </datalist>
                          <p class="text-[11px] text-muted-foreground">{{ f.detalle ? 'Con el detalle «' + f.detalle + '», sus campos van como ' + f.detalle + '.campo.' : 'Los datos que extraen los procesos del buzón.' }}</p>
                        </div>
                      }
                      @case ('fijo') {
                        <div class="flex flex-col gap-1">
                          <label class="alma-label" for="tb-fijo">Texto que se repite en cada fila</label>
                          <input id="tb-fijo" class="alma-input h-9" [(ngModel)]="c.origen.valor" placeholder="Cargue automático" />
                        </div>
                      }
                      @case ('correo') {
                        <div class="flex flex-col gap-1">
                          <label class="alma-label" for="tb-dato">Información del correo</label>
                          <select id="tb-dato" class="alma-input h-9" [(ngModel)]="c.origen.dato">
                            <option [ngValue]="null">Elige…</option>
                            @for (o of datosCorreo; track o.id) { <option [ngValue]="o.id">{{ o.nombre }}</option> }
                          </select>
                        </div>
                      }
                      @case ('formula') {
                        <div class="flex flex-col gap-1">
                          <label class="alma-label" for="tb-form">Fórmula de Excel</label>
                          <input id="tb-form" class="alma-input h-9 font-mono text-sm" [(ngModel)]="c.origen.formula" placeholder="=F{fila}*1.004" />
                          <p class="text-[11px]" [class]="(c.origen.formula ?? '').startsWith('=') || !c.origen.formula ? 'text-muted-foreground' : 'text-destructive'">Debe empezar con «=». Usa {{ '{fila}' }} para el número de la fila de cada registro.</p>
                        </div>
                      }
                      @case ('fila') {
                        <p class="text-xs text-muted-foreground">1, 2, 3… un número por cada fila del archivo.</p>
                      }
                      @case ('base') {
                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div class="flex flex-col gap-1">
                            <label class="alma-label" for="tb-b">Base</label>
                            <select id="tb-b" class="alma-input h-9" [(ngModel)]="c.origen.base_id">
                              <option [ngValue]="null">{{ basesConColumnas().length ? 'Elige la base…' : 'Este buzón no tiene bases cargadas' }}</option>
                              @for (b of basesConColumnas(); track b.id) { <option [ngValue]="b.id">{{ b.nombre }}</option> }
                            </select>
                          </div>
                          <div class="flex flex-col gap-1">
                            <label class="alma-label" for="tb-bd">Dato del correo con el que se busca</label>
                            <input id="tb-bd" class="alma-input h-9 font-mono text-sm" list="tb-campos-b" [(ngModel)]="c.origen.campo" placeholder="codigo_pac" />
                            <datalist id="tb-campos-b">
                              @for (k of camposColumna(); track k) { <option [value]="k"></option> }
                            </datalist>
                          </div>
                          <div class="flex flex-col gap-1">
                            <label class="alma-label" for="tb-bb">Columna donde se busca</label>
                            <select id="tb-bb" class="alma-input h-9" [(ngModel)]="c.origen.columna_busqueda">
                              <option [ngValue]="null">Elige la columna…</option>
                              @for (col of columnasBase(c.origen.base_id); track col) { <option [ngValue]="col">{{ col }}</option> }
                            </select>
                          </div>
                          <div class="flex flex-col gap-1">
                            <label class="alma-label" for="tb-br">Columna que se trae</label>
                            <select id="tb-br" class="alma-input h-9" [(ngModel)]="c.origen.columna_resultado">
                              <option [ngValue]="null">Elige la columna…</option>
                              @for (col of columnasBase(c.origen.base_id); track col) { <option [ngValue]="col">{{ col }}</option> }
                            </select>
                          </div>
                          <div class="flex flex-col gap-1">
                            <label class="alma-label" for="tb-bc">Comparación</label>
                            <select id="tb-bc" class="alma-input h-9" [(ngModel)]="c.origen.comparacion">
                              @for (k of comparaciones; track k.id) { <option [value]="k.id">{{ k.nombre }}</option> }
                            </select>
                          </div>
                        </div>
                      }
                      @default {
                        <p class="text-xs text-amber-700 dark:text-amber-300">Elige de dónde sale el valor.</p>
                      }
                    }
                  </section>
                }
                <div class="flex justify-between">
                  <button type="button" class="alma-btn alma-btn-outline h-9 rounded-lg" (click)="paso.set(1)"><lucide-icon name="arrow-left" [size]="14" /> Modelo</button>
                  <button type="button" class="alma-btn alma-btn-primary h-9 rounded-lg" (click)="paso.set(3)">Siguiente: revisar <lucide-icon name="arrow-right" [size]="14" /></button>
                </div>
              </div>
            }

            <!-- ③ REVISAR -->
            @case (3) {
              <div class="grid gap-4">
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div class="flex flex-col gap-1">
                    <label class="alma-label" for="tb-n">Nombre de la plantilla *</label>
                    <input id="tb-n" class="alma-input" [(ngModel)]="f.nombre" placeholder="Cargue PAC" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="alma-label" for="tb-h">Nombre de la hoja</label>
                    <input id="tb-h" class="alma-input" maxlength="31" [(ngModel)]="f.hoja" [disabled]="f.formato === 'csv'" />
                  </div>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="alma-label" for="tb-arch">Nombre del archivo *</label>
                  <input id="tb-arch" class="alma-input font-mono text-sm" [(ngModel)]="f.nombre_archivo" placeholder="Cargue_{codigo_pac}_{fecha}" />
                  <div class="flex flex-wrap items-center gap-1">
                    <span class="text-[11px] text-muted-foreground">Clic para insertar:</span>
                    @for (k of insertables(); track k) {
                      <button type="button" class="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[11px] text-foreground hover:border-primary hover:text-primary" (click)="insertar(k)">{{ '{' + k + '}' }}</button>
                    }
                  </div>
                  <p class="text-[11px] text-muted-foreground">Así se llamará: <span class="font-mono text-foreground">{{ asiSeLlamara() }}</span></p>
                </div>
                <div class="flex flex-wrap items-end gap-4">
                  <fieldset class="flex items-center gap-3 text-sm">
                    <legend class="alma-label mb-1">Formato</legend>
                    <label class="flex items-center gap-1.5"><input type="radio" name="tb-fmt" value="xlsx" [(ngModel)]="f.formato" /> Excel (.xlsx)</label>
                    <label class="flex items-center gap-1.5"><input type="radio" name="tb-fmt" value="csv" [(ngModel)]="f.formato" /> CSV (.csv)</label>
                  </fieldset>
                  @if (f.formato === 'csv') {
                    <div class="flex flex-col gap-1">
                      <label class="alma-label" for="tb-sep">Separador</label>
                      <select id="tb-sep" class="alma-input h-9 w-52" [(ngModel)]="f.separador">
                        @for (s of separadores; track s.id) { <option [value]="s.id">{{ s.nombre }}</option> }
                      </select>
                    </div>
                  }
                </div>
                @if (f.titulo.length) {
                  <div class="rounded-xl bg-[var(--surface-sunken)] p-3">
                    <p class="text-[11px] font-semibold text-muted-foreground">Filas de título (arriba de los encabezados)</p>
                    @for (t of f.titulo; track $index; let i = $index) {
                      <div class="mt-1 flex items-center gap-2 text-xs">
                        <span class="min-w-0 flex-1 truncate">{{ t.join(' · ') || '(vacía)' }}</span>
                        <button type="button" class="rounded p-0.5 text-muted-foreground hover:text-destructive" [attr.aria-label]="'Quitar la fila de título ' + (i + 1)" (click)="f.titulo.splice(i, 1); tocar()"><lucide-icon name="x" [size]="12" /></button>
                      </div>
                    }
                  </div>
                }

                <!-- Vista previa -->
                <section class="grid gap-2 rounded-2xl border border-border/60 p-4">
                  <div class="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 class="text-sm font-semibold text-foreground">Vista previa</h3>
                      <p class="text-[11px] text-muted-foreground">Con el último correo real del proceso. Para verla, Alma guarda la plantilla.</p>
                    </div>
                    <div class="flex flex-wrap items-end gap-2">
                      <div class="flex flex-col gap-1">
                        <label class="text-[11px] font-semibold text-muted-foreground" for="tb-vp">Proceso</label>
                        <select id="tb-vp" class="alma-input h-8 w-44 text-xs" [(ngModel)]="procesoPrevia">
                          @for (p of procesos(); track p.clave) { <option [value]="p.clave">{{ p.clave }}</option> }
                        </select>
                      </div>
                      <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="previsualizando() || guardando() || !procesoPrevia" (click)="verPrevia()">
                        <lucide-icon [name]="previsualizando() ? 'loader-2' : 'eye'" [size]="14" [class.animate-spin]="previsualizando()" /> Guardar y ver vista previa
                      </button>
                    </div>
                  </div>
                  @if (previa(); as v) {
                    <p class="text-xs text-muted-foreground">
                      <span class="font-mono text-foreground">{{ v.nombre_archivo }}</span> · {{ v.total_filas }} {{ v.total_filas === 1 ? 'fila' : 'filas' }}
                      · {{ v.con_datos_reales ? 'datos del último correo de ' + procesoPrevia : 'sin correos de ' + procesoPrevia + ': columnas vacías' }}
                    </p>
                    <div class="max-h-72 overflow-auto rounded-lg border border-border/60">
                      <table class="alma-table text-[11px]">
                        <tbody>
                          @for (t of v.titulo; track $index) { <tr>@for (c of t; track $index) { <td class="whitespace-nowrap font-semibold">{{ c }}</td> }</tr> }
                          <tr class="bg-[var(--surface-sunken)]">@for (h of v.encabezados; track $index) { <th class="whitespace-nowrap">{{ h }}</th> }</tr>
                          @for (fila of v.filas; track $index) { <tr>@for (c of fila; track $index) { <td class="whitespace-nowrap">{{ c }}</td> }</tr> }
                        </tbody>
                      </table>
                    </div>
                  }
                </section>

                @if (pendientes().length) {
                  <div class="grid gap-0.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    <p class="font-semibold">Pendientes</p>
                    @for (p of pendientes(); track $index) { <p>• {{ p }}</p> }
                  </div>
                } @else {
                  <p class="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200"><lucide-icon name="check" [size]="13" /> Plantilla lista.</p>
                }
                <div><button type="button" class="alma-btn alma-btn-outline h-9 rounded-lg" (click)="paso.set(2)"><lucide-icon name="arrow-left" [size]="14" /> Columnas</button></div>
              </div>
            }
          }
          @if (error(); as e) {
            <p class="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"><lucide-icon name="alert-triangle" [size]="13" class="mt-0.5 shrink-0" /> {{ e }}</p>
          }
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 px-5 py-3">
          @if (pendientes().length && f.columnas.length) { <span class="mr-auto text-xs text-amber-700 dark:text-amber-300">{{ pendientes().length }} pendiente(s): se puede guardar y completar después.</span> }
          <button type="button" class="alma-btn alma-btn-outline" [disabled]="guardando()" (click)="cerrar()">Cancelar</button>
          <button type="button" class="alma-btn alma-btn-primary" [disabled]="guardando() || !f.columnas.length" (click)="guardar(true)">
            <lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardando()" /> Guardar plantilla
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PlantillaBuilderComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzonId = input.required<string>();
  /** null = nueva. */
  readonly plantilla = input<Plantilla | null>(null);
  readonly nombreSugerido = input('');
  readonly procesos = input<ProcesoCampos[]>([]);
  /** Listas del JSON (una fila por elemento) con los campos de sus elementos. */
  readonly listas = input<Record<string, string[]>>({});
  readonly bases = input<Base[]>([]);
  readonly guardada = output<Plantilla>();
  readonly cerrada = output<void>();

  protected readonly origenes = ORIGENES;
  protected readonly datosCorreo = DATOS_CORREO;
  protected readonly formatos = FORMATOS_COLUMNA;
  protected readonly comparaciones = COMPARACIONES;
  protected readonly separadores = SEPARADORES;
  protected readonly letra = letra;

  protected readonly paso = signal<Paso>(1);
  protected readonly sel = signal(0);
  /** Sube con cada cambio de columnas (los computed leen el formulario mutable). */
  private readonly version = signal(0);
  protected f: PlantillaForm = { nombre: '', formato: 'xlsx', separador: ';', hoja: 'Hoja1', nombre_archivo: '', titulo: [], columnas: [], detalle: null, modelo: null };
  private id: string | null = null;
  private sucio = false;

  // Modelo
  protected readonly modeloLeido = signal<ModeloLeido | null>(null);
  protected readonly leyendo = signal(false);
  private archivoModelo: File | null = null;
  protected hojaModelo: string | null = null;
  protected filaModelo: number | null = null;

  // Revisar
  protected readonly guardando = signal(false);
  protected readonly previsualizando = signal(false);
  protected readonly previa = signal<VistaPrevia | null>(null);
  protected readonly error = signal<string | null>(null);
  protected procesoPrevia = '';

  protected readonly camposSimples = computed(() => [...new Set(this.procesos().flatMap((p) => p.campos))].filter((c) => !(c in this.listas())));
  protected readonly nombresListas = computed(() => Object.keys(this.listas()));
  protected readonly basesConColumnas = computed(() => this.bases().filter((b) => b.columnas.length));

  constructor() {
    queueMicrotask(() => {
      const p = this.plantilla();
      this.procesoPrevia = this.procesos()[0]?.clave ?? '';
      if (p) {
        this.id = p.id;
        this.f = {
          nombre: p.nombre,
          formato: p.formato,
          separador: p.separador,
          hoja: p.hoja,
          nombre_archivo: p.nombre_archivo,
          titulo: p.titulo.map((t) => [...t]),
          columnas: p.columnas.map((c) => ({ ...c, origen: { ...c.origen } })),
          detalle: p.detalle,
          modelo: p.modelo,
        };
        this.paso.set(2);
      } else {
        this.f.nombre = this.nombreSugerido();
      }
      this.version.update((v) => v + 1);
    });
  }

  protected readonly pasos = computed(() => {
    this.version();
    const asignadas = this.f.columnas.filter((c) => !faltaEnColumna(c)).length;
    const pend = this.pendientes().length;
    return [
      { n: 1 as Paso, nombre: 'Modelo', estado: this.f.modelo ?? (this.f.columnas.length ? 'Sin modelo cargado' : 'Sube tu plantilla') },
      { n: 2 as Paso, nombre: 'Qué va en cada columna', estado: this.f.columnas.length ? `${asignadas} de ${this.f.columnas.length} completas` : '—' },
      { n: 3 as Paso, nombre: 'Revisar', estado: pend ? `${pend} pendiente(s)` : 'Lista' },
    ];
  });

  protected readonly columna = computed(() => {
    this.version();
    return this.f.columnas[this.sel()] ?? null;
  });

  /** Campos para una columna: los del detalle primero («lista.campo»), luego los simples. */
  protected readonly camposColumna = computed(() => {
    this.version();
    const det = this.f.detalle;
    const delDetalle = det ? (this.listas()[det] ?? []).map((k) => `${det}.${k}`) : [];
    return [...delDetalle, ...this.camposSimples()];
  });

  protected readonly insertables = computed(() => [...this.camposSimples().slice(0, 8), 'fecha', 'radicado', 'etiqueta', 'proceso']);

  protected readonly pendientes = computed(() => {
    this.version();
    const out: string[] = [];
    if (!this.f.nombre.trim()) out.push('Ponle nombre a la plantilla.');
    if (!this.f.columnas.length) out.push('Sube tu plantilla o agrega al menos una columna.');
    this.f.columnas.forEach((c, i) => {
      const falta = faltaEnColumna(c);
      if (falta) out.push(`${c.encabezado.trim() ? '«' + c.encabezado + '»' : 'Columna ' + letra(i)}: ${falta}.`);
    });
    if (!this.f.nombre_archivo.trim()) out.push('Define el nombre del archivo.');
    return out;
  });

  protected readonly asiSeLlamara = computed(() => {
    this.version();
    const p = this.procesos().find((x) => x.clave === this.procesoPrevia) ?? this.procesos()[0];
    const meta = { asunto: '', remitente: '', fecha: '', radicado: 'AB12CD34', etiqueta: p?.clave ?? '', proceso: p?.clave ?? '', hoy: new Date().toISOString().slice(0, 10) };
    return nombreArchivo(this.f.nombre_archivo || this.f.nombre || 'archivo', p?.ejemplo ?? {}, meta, this.f.formato);
  });

  /** Cualquier cambio en el formulario (los inputs mutan `f`): recalcula y marca sucio. */
  protected tocar(): void {
    this.sucio = true;
    this.version.update((v) => v + 1);
  }

  protected resumenOrigen(o: OrigenColumna): string {
    switch (o.tipo) {
      case 'campo':
        return o.campo || 'dato…';
      case 'fijo':
        return `«${o.valor ?? ''}»`;
      case 'correo':
        return DATOS_CORREO.find((d) => d.id === o.dato)?.nombre ?? 'correo…';
      case 'fila':
        return 'N.º de fila';
      case 'base':
        return o.columna_resultado ? `base · ${o.columna_resultado}` : 'base…';
      case 'formula':
        return o.formula || '=…';
      default:
        return '';
    }
  }

  protected sugeridas(m: ModeloLeido): number {
    return m.columnas.filter((c) => c.sugerido).length;
  }

  protected columnasBase(id: string | null | undefined): string[] {
    return this.bases().find((b) => b.id === id)?.columnas ?? [];
  }

  // ── ① Modelo ──
  protected async subirModelo(ev: Event): Promise<void> {
    const el = ev.target as HTMLInputElement;
    const archivo = el.files?.[0];
    el.value = '';
    if (!archivo) return;
    this.archivoModelo = archivo;
    this.hojaModelo = null;
    this.filaModelo = null;
    await this.leerModelo();
  }

  protected releerModelo(cambioHoja: boolean): void {
    if (cambioHoja) this.filaModelo = null;
    void this.leerModelo();
  }

  private async leerModelo(): Promise<void> {
    if (!this.archivoModelo) return;
    this.leyendo.set(true);
    this.error.set(null);
    try {
      const m = await this.api.leerModelo(this.buzonId(), this.archivoModelo, this.hojaModelo, this.filaModelo);
      this.modeloLeido.set(m);
      this.hojaModelo = m.hoja;
      this.filaModelo = m.fila_encabezado;
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.leyendo.set(false);
    }
  }

  protected usarModelo(m: ModeloLeido): void {
    const previas = new Map(this.f.columnas.map((c) => [c.encabezado.trim().toUpperCase(), c]));
    this.f.columnas = m.columnas.map((c) => {
      const previa = previas.get(c.encabezado.trim().toUpperCase());
      // Lo que ya se había asignado a mano gana sobre la propuesta.
      if (previa && previa.origen.tipo !== 'vacio') return { ...previa, encabezado: c.encabezado, ejemplo: c.ejemplo, sugerido: false };
      return { encabezado: c.encabezado, origen: { ...c.origen }, formato: c.formato, sugerido: c.sugerido, ejemplo: c.ejemplo };
    });
    this.f.titulo = m.titulo.map((t) => [...t]);
    this.f.formato = m.formato;
    if (m.hoja) this.f.hoja = m.hoja.slice(0, 31);
    this.f.modelo = m.modelo;
    if (!this.f.nombre.trim()) this.f.nombre = m.modelo.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    if (!this.f.nombre_archivo.trim()) this.f.nombre_archivo = `${m.modelo.replace(/\.[^.]+$/, '')}_{fecha}`;
    this.modeloLeido.set(null);
    this.sel.set(Math.max(0, this.f.columnas.findIndex((c) => c.origen.tipo === 'vacio')));
    this.tocar();
    this.paso.set(2);
  }

  protected desdeJson(): void {
    const det = this.nombresListas()[0] ?? null;
    const delDetalle = det ? (this.listas()[det] ?? []).map((k) => `${det}.${k}`) : [];
    this.f.detalle = det;
    this.f.columnas = [...this.camposSimples(), ...delDetalle].map((campo) => ({
      encabezado: (campo.split('.').pop() ?? campo).toUpperCase().replace(/_/g, ' '),
      origen: { tipo: 'campo', campo },
      formato: /valor|monto|aporte/.test(campo) ? 'moneda' : /fecha/.test(campo) ? 'fecha' : 'texto',
    }));
    if (!this.f.nombre_archivo.trim()) this.f.nombre_archivo = `${(this.f.nombre || 'Datos').replace(/\s+/g, '_')}_{fecha}`;
    this.sel.set(0);
    this.tocar();
    this.paso.set(2);
  }

  protected enBlanco(): void {
    this.f.columnas = [{ encabezado: 'COLUMNA 1', origen: { tipo: 'vacio' }, formato: 'texto' }];
    if (!this.f.nombre_archivo.trim()) this.f.nombre_archivo = `${(this.f.nombre || 'Archivo').replace(/\s+/g, '_')}_{fecha}`;
    this.sel.set(0);
    this.tocar();
    this.paso.set(2);
  }

  // ── ② Columnas ──
  protected cambiarOrigen(c: ColumnaForm, tipo: TipoOrigen): void {
    if (c.origen.tipo === tipo) return;
    const campoPrevio = c.origen.campo ?? null;
    c.origen =
      tipo === 'base'
        ? { tipo, campo: campoPrevio, base_id: this.basesConColumnas()[0]?.id ?? null, columna_busqueda: null, columna_resultado: null, comparacion: 'exacta' }
        : tipo === 'campo'
          ? { tipo, campo: campoPrevio }
          : tipo === 'formula'
            ? { tipo, formula: '=' }
            : { tipo };
    c.sugerido = false;
    this.tocar();
  }

  protected proponer(): void {
    const campos = this.camposColumna();
    let n = 0;
    this.f.columnas.forEach((c) => {
      if (c.origen.tipo !== 'vacio') return;
      const s = sugerirColumna(c.encabezado, campos);
      if (s) {
        c.origen = s;
        c.sugerido = true;
        n++;
      }
    });
    this.tocar();
    this.toast.show(n ? `Alma propuso ${n} columna(s)` : 'Nada nuevo que proponer', n ? 'Revisa las marcadas con ✦.' : 'Las columnas sin asignar no se parecen a ningún dato del buzón.');
  }

  protected agregarColumna(): void {
    this.f.columnas.push({ encabezado: `COLUMNA ${this.f.columnas.length + 1}`, origen: { tipo: 'vacio' }, formato: 'texto' });
    this.sel.set(this.f.columnas.length - 1);
    this.tocar();
  }

  protected quitarColumna(): void {
    this.f.columnas.splice(this.sel(), 1);
    this.sel.set(Math.max(0, Math.min(this.sel(), this.f.columnas.length - 1)));
    this.tocar();
  }

  protected mover(d: number): void {
    const i = this.sel();
    const [c] = this.f.columnas.splice(i, 1);
    this.f.columnas.splice(i + d, 0, c);
    this.sel.set(i + d);
    this.tocar();
  }

  // ── ③ Revisar ──
  protected insertar(k: string): void {
    this.f.nombre_archivo = `${this.f.nombre_archivo}${this.f.nombre_archivo && !/[_\-\s]$/.test(this.f.nombre_archivo) ? '_' : ''}{${k}}`;
    this.tocar();
  }

  private cuerpo(): PlantillaIn {
    const limpio = (o: OrigenColumna): OrigenColumna => {
      switch (o.tipo) {
        case 'campo':
          return { tipo: 'campo', campo: o.campo?.trim() || null };
        case 'fijo':
          return { tipo: 'fijo', valor: o.valor ?? '' };
        case 'correo':
          return { tipo: 'correo', dato: o.dato ?? null };
        case 'base':
          return { tipo: 'base', base_id: o.base_id ?? null, campo: o.campo?.trim() || null, columna_busqueda: o.columna_busqueda ?? null, columna_resultado: o.columna_resultado ?? null, comparacion: o.comparacion ?? 'exacta' };
        case 'formula':
          return { tipo: 'formula', formula: o.formula?.trim() ?? '' };
        default:
          return { tipo: o.tipo };
      }
    };
    return {
      nombre: this.f.nombre.trim(),
      formato: this.f.formato,
      separador: this.f.separador,
      hoja: (this.f.hoja.trim() || 'Hoja1').slice(0, 31),
      nombre_archivo: this.f.nombre_archivo.trim(),
      titulo: this.f.titulo.filter((t) => t.some((c) => c.trim())).slice(0, 10),
      // Una columna incompleta se guarda como «vacía» para no bloquear el guardado.
      columnas: this.f.columnas.map((c) => ({
        encabezado: c.encabezado.trim(),
        formato: c.formato,
        origen: faltaEnColumna(c) && c.encabezado.trim() ? { tipo: 'vacio' } : limpio(c.origen),
      })),
      detalle: this.f.detalle,
      modelo: this.f.modelo,
    };
  }

  /** Guarda (crea o actualiza). `cerrar` = también cierra el constructor. */
  protected async guardar(cerrar: boolean): Promise<Plantilla | null> {
    this.error.set(null);
    if (this.f.nombre.trim().length < 2) {
      this.paso.set(3);
      this.error.set('Ponle nombre a la plantilla (al menos 2 letras).');
      return null;
    }
    if (!this.f.nombre_archivo.trim()) {
      this.paso.set(3);
      this.error.set('Define el nombre del archivo.');
      return null;
    }
    if (this.f.columnas.some((c) => !c.encabezado.trim())) {
      this.paso.set(2);
      this.error.set('Todas las columnas necesitan un nombre.');
      return null;
    }
    this.guardando.set(true);
    try {
      const body = this.cuerpo();
      const t = this.id ? await this.api.actualizarPlantilla(this.id, body) : await this.api.crearPlantilla(this.buzonId(), body);
      this.id = t.id;
      this.sucio = false;
      this.guardada.emit(t);
      if (cerrar) {
        this.toast.show('Plantilla guardada', t.nombre);
        this.cerrada.emit();
      }
      return t;
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      this.guardando.set(false);
    }
  }

  protected async verPrevia(): Promise<void> {
    if (!this.id || this.sucio) {
      const t = await this.guardar(false);
      if (!t) return;
    }
    this.previsualizando.set(true);
    try {
      this.previa.set(await this.api.vistaPrevia(this.id!, { proceso_clave: this.procesoPrevia }));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.previsualizando.set(false);
    }
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    if (this.sucio && !confirm('¿Cerrar sin guardar los cambios de la plantilla?')) return;
    this.cerrada.emit();
  }
}
