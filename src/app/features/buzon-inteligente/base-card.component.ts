// Tarjeta de una base de responsables (2.0): estado de la última carga (aceptada o
// rechazada con su motivo), filas, quién y cuándo la cargó, subir un archivo nuevo
// (eligiendo hoja y fila de encabezados con la vista previa de /bases/leer),
// sincronizar desde SharePoint y ver las filas. En las columnas de responsable, los
// valores que no se reconocen en el equipo se pueden «Vincular a…» una persona.

import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { Base, BuzonApi, FilaBase, LecturaArchivo, Persona } from './buzon.api';
import { nrm, reconocer } from './buzon-asignacion';

@Component({
  selector: 'alma-base-card',
  imports: [DatePipe, DecimalPipe, FormsModule, LucideAngularModule],
  template: `
    @let b = base();
    <div class="flex flex-col gap-2 rounded-xl bg-[var(--surface-sunken)] px-3 py-2.5" [class.ring-2]="abierta()" [class.ring-ring]="abierta()">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
            <lucide-icon name="file-spreadsheet" [size]="15" class="text-emerald-600" /> {{ b.nombre }}
            @if (b.archivo) { <span class="font-mono text-[11px] font-normal text-muted-foreground">{{ b.archivo }}@if (b.hoja) { · hoja «{{ b.hoja }}»}</span> }
          </p>
          <p class="text-[11px] text-muted-foreground">
            {{ b.origen === 'sharepoint' ? 'SharePoint' : 'Archivo subido' }} · {{ b.total_filas | number }} filas
            @if (b.cargada_en) { · cargada {{ b.cargada_en | date: 'd MMM, h:mm a' }}@if (b.cargada_por) { por {{ b.cargada_por }}} }
            @if (otrosUsos()) { · {{ otrosUsos() }} }
          </p>
        </div>
        @switch (b.estado) {
          @case ('ok') {
            <span class="alma-badge gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><lucide-icon name="check" [size]="12" /> {{ b.origen === 'sharepoint' ? 'Sincronizada' : 'Cargada' }}</span>
          }
          @case ('rechazado') {
            <span class="alma-badge gap-1 bg-rose-500/15 text-rose-700 dark:text-rose-300"><lucide-icon name="x-circle" [size]="12" /> Carga rechazada</span>
          }
          @default {
            <span class="alma-badge gap-1 bg-zinc-500/15 text-zinc-600 dark:text-zinc-300"><lucide-icon name="circle-dashed" [size]="12" /> Sin cargar</span>
          }
        }
      </div>
      @if (b.motivo) {
        <p class="flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-300">
          <lucide-icon name="x-circle" [size]="13" class="mt-0.5 shrink-0" />
          <span>{{ b.motivo }}@if (b.estado === 'ok') { <span class="text-muted-foreground"> · Las reglas siguen usando la carga anterior.</span> }</span>
        </p>
      }

      <div class="flex flex-wrap items-center gap-1.5">
        <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [attr.aria-expanded]="abierta()" [disabled]="!b.total_filas" (click)="alternarDatos()">
          <lucide-icon [name]="abierta() ? 'chevron-up' : 'eye'" [size]="14" /> {{ abierta() ? 'Ocultar datos' : 'Ver datos' }}@if (!abierta() && noReconocidos().length) { ({{ noReconocidos().length }} por vincular)}
        </button>
        @if (editable()) {
          <label class="alma-btn alma-btn-outline h-8 cursor-pointer rounded-lg text-xs" [attr.for]="'bf-' + b.id">
            <lucide-icon name="upload" [size]="14" /> {{ b.total_filas ? 'Actualizar base' : 'Subir archivo' }}
          </label>
          <input type="file" class="sr-only" [id]="'bf-' + b.id" accept=".xlsx,.xlsm,.csv" (change)="elegirArchivo($event)" />
          @if (b.origen === 'sharepoint') {
            <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="sincronizando()" (click)="sincronizar()">
              <lucide-icon name="refresh-cw" [size]="14" [class.animate-spin]="sincronizando()" /> Sincronizar ahora
            </button>
          }
        }
        @if (b.sharepoint_url) {
          <a class="alma-btn alma-btn-ghost h-8 rounded-lg text-xs" [href]="b.sharepoint_url" target="_blank" rel="noopener noreferrer"><lucide-icon name="external-link" [size]="14" /> Abrir en SharePoint</a>
        }
        <ng-content />
      </div>

      <!-- Carga: elegir hoja y fila de encabezados -->
      @if (lectura(); as l) {
        <div class="grid gap-2 rounded-xl border border-border/60 bg-card/60 p-3">
          <p class="text-xs font-semibold text-foreground">Vista previa · {{ archivo()?.name }}</p>
          <div class="flex flex-wrap items-end gap-2">
            @if (l.hojas.length > 1) {
              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-semibold text-muted-foreground" [attr.for]="'bh-' + b.id">Hoja</label>
                <select class="alma-input h-8 w-44 text-xs" [id]="'bh-' + b.id" [(ngModel)]="hoja" (ngModelChange)="releer(true)">
                  @for (h of l.hojas; track h) { <option [value]="h">{{ h }}</option> }
                </select>
              </div>
            }
            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-semibold text-muted-foreground" [attr.for]="'be-' + b.id">Fila de encabezados</label>
              <input type="number" min="1" max="200" class="alma-input h-8 w-24 text-xs" [id]="'be-' + b.id" [(ngModel)]="filaEncabezado" />
            </div>
            <button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" [disabled]="leyendo()" (click)="releer(false)"><lucide-icon name="rotate-ccw" [size]="13" /> Volver a leer</button>
            <span class="text-[11px] text-muted-foreground">{{ l.total_filas | number }} filas · {{ l.columnas.length }} columnas</span>
          </div>
          @if (l.titulo) { <p class="text-[11px] text-muted-foreground">Encima de los encabezados (se ignora): {{ l.titulo }}</p> }
          <div class="max-h-48 overflow-auto rounded-lg border border-border/60">
            <table class="alma-table text-[11px]">
              <thead><tr>@for (c of l.columnas; track $index) { <th class="whitespace-nowrap" [class.text-amber-700]="faltantes().includes(c)">{{ c }}</th> }</tr></thead>
              <tbody>
                @for (f of l.muestra.slice(0, 5); track $index) {
                  <tr>@for (c of l.columnas; track $index) { <td class="whitespace-nowrap">{{ f[c] }}</td> }</tr>
                }
              </tbody>
            </table>
          </div>
          @if (faltantes().length) {
            <p class="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200">
              <lucide-icon name="alert-triangle" [size]="13" class="mt-0.5 shrink-0" />
              Las búsquedas usan {{ faltantes().length === 1 ? 'la columna' : 'las columnas' }} <b>{{ faltantes().join(', ') }}</b> y este archivo no {{ faltantes().length === 1 ? 'la trae' : 'las trae' }}: la carga se rechazará.
            </p>
          }
          <div class="flex justify-end gap-2">
            <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" [disabled]="cargando()" (click)="cancelarCarga()">Cancelar</button>
            <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="cargando() || leyendo()" (click)="cargar()">
              <lucide-icon [name]="cargando() ? 'loader-2' : 'upload'" [size]="14" [class.animate-spin]="cargando()" /> Cargar en la base
            </button>
          </div>
        </div>
      } @else if (leyendo()) {
        <p class="text-xs text-muted-foreground">Leyendo el archivo…</p>
      }

      <!-- Datos -->
      @if (abierta()) {
        <div class="grid gap-2 border-t border-border/60 pt-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-[11px] text-muted-foreground">Solo lectura · muestra de {{ filas().length }} de {{ b.total_filas | number }} filas · en ámbar lo que afecta la asignación</p>
            <form class="flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2" (submit)="$event.preventDefault(); cargarFilas()">
              <lucide-icon name="search" [size]="13" class="text-muted-foreground" />
              <input type="search" name="q" class="w-40 border-none bg-transparent text-xs outline-none" placeholder="Buscar en la base" [(ngModel)]="q" aria-label="Buscar en la base" />
            </form>
          </div>
          @if (cargandoFilas()) {
            <p class="text-xs text-muted-foreground">Cargando filas…</p>
          } @else {
            <div class="max-h-80 overflow-auto rounded-lg border border-border/60">
              <table class="alma-table text-[11px]">
                <thead>
                  <tr>
                    @for (c of b.columnas; track c) {
                      <th class="whitespace-nowrap">
                        {{ c }}
                        @if (columnasResponsable().includes(c)) { <span class="ml-1 rounded bg-violet-500/15 px-1 text-[10px] font-semibold text-violet-700 dark:text-violet-300">resp.</span> }
                        @if (columnasCruce().includes(c)) { <span class="ml-1 rounded bg-sky-500/15 px-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300">cruce</span> }
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (f of filas(); track $index) {
                    <tr>
                      @for (c of b.columnas; track c) {
                        @let v = f[c];
                        @if (columnasResponsable().includes(c) && v && !reconocido(v)) {
                          <td class="whitespace-nowrap bg-amber-500/10">
                            <span class="text-amber-800 dark:text-amber-200">{{ v }}</span>
                            <span class="block text-[10px] text-amber-700 dark:text-amber-300">no se reconoce en el equipo</span>
                            @if (editable()) {
                              <select class="alma-input mt-1 h-7 min-w-[150px] text-[11px]" [attr.aria-label]="'Vincular ' + v" [ngModel]="''" (ngModelChange)="vincular(v, $event)" [disabled]="vinculando()">
                                <option value="">Vincular a…</option>
                                @for (p of equipo(); track p.id) { <option [value]="p.correo">{{ p.nombre }}</option> }
                              </select>
                            }
                          </td>
                        } @else if (columnasResponsable().includes(c) && !v) {
                          <td class="whitespace-nowrap bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">vacío → siguiente búsqueda</td>
                        } @else {
                          <td class="whitespace-nowrap">{{ v }}</td>
                        }
                      }
                    </tr>
                  } @empty {
                    <tr><td [attr.colspan]="b.columnas.length || 1" class="text-center text-muted-foreground">Sin filas para mostrar.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @if (vinculos().length) {
            <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <lucide-icon name="link" [size]="12" /> Vínculos guardados:
              @for (v of vinculos(); track v.clave) {
                <span class="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
                  {{ v.clave }} = {{ v.persona }}
                  @if (editable()) {
                    <button type="button" class="text-muted-foreground hover:text-destructive" [attr.aria-label]="'Quitar vínculo ' + v.clave" (click)="desvincular(v.clave)"><lucide-icon name="x" [size]="11" /></button>
                  }
                </span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class BaseCardComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly base = input.required<Base>();
  readonly equipo = input<Persona[]>([]);
  readonly editable = input(true);
  /** Columnas que usan las búsquedas como responsable / respaldo y como cruce. */
  readonly columnasResponsable = input<string[]>([]);
  readonly columnasCruce = input<string[]>([]);
  /** Texto de otros grupos que la usan («también la usa: PAC»). */
  readonly otrosUsos = input('');
  readonly baseChange = output<Base>();

  protected readonly abierta = signal(false);
  protected readonly filas = signal<FilaBase[]>([]);
  protected readonly cargandoFilas = signal(false);
  protected q = '';

  protected readonly archivo = signal<File | null>(null);
  protected readonly lectura = signal<LecturaArchivo | null>(null);
  protected readonly leyendo = signal(false);
  protected readonly cargando = signal(false);
  protected readonly sincronizando = signal(false);
  protected readonly vinculando = signal(false);
  protected hoja: string | null = null;
  protected filaEncabezado: number | null = null;

  protected readonly noReconocidos = computed(() => {
    const cols = this.columnasResponsable();
    const vistos = new Set<string>();
    this.filas().forEach((f) => cols.forEach((c) => f[c] && !this.reconocido(f[c]) && vistos.add(f[c])));
    return [...vistos];
  });

  protected readonly faltantes = computed(() => {
    const l = this.lectura();
    if (!l) return [];
    return [...new Set([...this.columnasResponsable(), ...this.columnasCruce()])].filter((c) => c && !l.columnas.includes(c));
  });

  protected readonly vinculos = computed(() =>
    Object.entries(this.base().vinculos ?? {}).map(([clave, correo]) => ({
      clave,
      persona: this.equipo().find((p) => p.correo.toLowerCase() === correo.toLowerCase())?.nombre ?? correo,
    })),
  );

  protected reconocido(v: string): boolean {
    return !!reconocer(v, this.equipo(), this.base().vinculos);
  }

  protected alternarDatos(): void {
    this.abierta.update((x) => !x);
    if (this.abierta() && !this.filas().length) void this.cargarFilas();
  }

  async cargarFilas(): Promise<void> {
    this.cargandoFilas.set(true);
    try {
      const r = await this.api.filasBase(this.base().id, this.q.trim() || undefined, 100);
      this.filas.set(r.items);
    } catch (e) {
      this.toast.error('No se pudieron leer las filas', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargandoFilas.set(false);
    }
  }

  protected async elegirArchivo(ev: Event): Promise<void> {
    const inputEl = ev.target as HTMLInputElement;
    const f = inputEl.files?.[0];
    inputEl.value = '';
    if (!f) return;
    this.archivo.set(f);
    this.hoja = null;
    this.filaEncabezado = null;
    await this.leer();
  }

  protected releer(cambioHoja: boolean): void {
    if (cambioHoja) this.filaEncabezado = null; // otra hoja: que Alma detecte de nuevo la fila
    void this.leer();
  }

  private async leer(): Promise<void> {
    const f = this.archivo();
    if (!f) return;
    this.leyendo.set(true);
    try {
      const l = await this.api.leerArchivo(f, this.hoja, this.filaEncabezado);
      this.lectura.set(l);
      this.hoja = l.hoja;
      this.filaEncabezado = l.fila_encabezado;
    } catch (e) {
      this.toast.error('No se pudo leer el archivo', e instanceof Error ? e.message : String(e));
      if (!this.lectura()) this.archivo.set(null);
    } finally {
      this.leyendo.set(false);
    }
  }

  protected cancelarCarga(): void {
    this.lectura.set(null);
    this.archivo.set(null);
  }

  protected async cargar(): Promise<void> {
    const f = this.archivo();
    if (!f) return;
    this.cargando.set(true);
    try {
      const r = await this.api.cargarBase(this.base().id, f, this.hoja, this.filaEncabezado);
      this.baseChange.emit(r.base);
      if (r.aceptada) {
        this.toast.show('Base cargada', `${r.base.nombre}: ${r.total_filas.toLocaleString('es-CO')} filas.`);
        this.cancelarCarga();
        if (this.abierta()) void this.cargarFilas();
      } else {
        this.toast.error('Carga rechazada', r.motivo ?? 'El archivo no sirve para esta base. Se conserva la carga anterior.');
      }
    } catch (e) {
      this.toast.error('No se pudo cargar la base', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async sincronizar(): Promise<void> {
    this.sincronizando.set(true);
    try {
      const r = await this.api.sincronizarBase(this.base().id);
      this.baseChange.emit(r.base);
      if (r.aceptada) this.toast.show('Base sincronizada', `${r.base.nombre}: ${r.total_filas.toLocaleString('es-CO')} filas.`);
      else this.toast.error('Sincronización rechazada', r.motivo ?? 'Se conserva la carga anterior.');
      if (this.abierta()) void this.cargarFilas();
    } catch (e) {
      this.toast.error('No se pudo sincronizar', e instanceof Error ? e.message : String(e));
    } finally {
      this.sincronizando.set(false);
    }
  }

  protected async vincular(valor: string, correo: string): Promise<void> {
    if (!correo) return;
    this.vinculando.set(true);
    try {
      const b = await this.api.vincular(this.base().id, valor, correo);
      this.baseChange.emit(b);
      const p = this.equipo().find((x) => x.correo === correo);
      this.toast.show('Vínculo guardado', `«${valor}» = ${p?.nombre ?? correo} en ${b.nombre}.`);
    } catch (e) {
      this.toast.error('No se pudo vincular', e instanceof Error ? e.message : String(e));
    } finally {
      this.vinculando.set(false);
    }
  }

  protected async desvincular(clave: string): Promise<void> {
    try {
      // La clave ya está normalizada (nrm es idempotente): el backend la vuelve a normalizar igual.
      const b = await this.api.vincular(this.base().id, nrm(clave), null);
      this.baseChange.emit(b);
    } catch (e) {
      this.toast.error('No se pudo quitar el vínculo', e instanceof Error ? e.message : String(e));
    }
  }
}
