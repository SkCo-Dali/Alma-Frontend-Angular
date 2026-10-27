// Pestaña «Exportación» de la configuración de un buzón (059, ajustes 30/31 del
// prototipo): el archivo que el área necesita por cada correo.
//  · Entrega: borrador de respuesta en el hilo con el archivo adjunto.
//  · Por proceso, sus SALIDAS: sin archivo, tabla según el JSON o una plantilla
//    del área, para todas las etiquetas del proceso o solo algunas. Si una
//    etiqueta queda cubierta por dos salidas, manda la primera (aviso en ámbar).
//  · Plantillas del buzón: se diseñan con el constructor de tres pasos.

import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { AlmaSwitchComponent } from '../../shared/components/alma-switch.component';
import { TooltipDirective } from '../../shared/tooltip.directive';
import { Base, Buzon, BuzonApi, Categoria, Exportacion, ModoSalida, Plantilla, ProcesoExportacion, SalidaIn } from './buzon.api';
import { listasDelJson } from './buzon-exportacion';
import { PlantillaBuilderComponent, ProcesoCampos } from './plantilla-builder.component';

interface SalidaForm {
  nombre: string;
  modo: ModoSalida;
  /** true = todas las etiquetas del proceso (null en la API). */
  todas: boolean;
  etiquetas: string[];
  plantilla_id: string | null;
  activa: boolean;
}

const MODOS: { id: ModoSalida; nombre: string }[] = [
  { id: 'ninguno', nombre: 'Sin archivo' },
  { id: 'tabla', nombre: 'Tabla según el JSON' },
  { id: 'plantilla', nombre: 'Plantilla específica' },
];

@Component({
  selector: 'alma-exportacion-tab',
  imports: [DatePipe, FormsModule, LucideAngularModule, AlmaLoaderComponent, AlmaSwitchComponent, TooltipDirective, PlantillaBuilderComponent],
  template: `
    @if (cargando()) {
      <div class="flex justify-center py-12"><alma-loader [size]="56" label="Cargando exportación…" /></div>
    } @else if (error(); as e) {
      <div class="glass flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
        <lucide-icon name="alert-triangle" [size]="24" class="text-rose-500" />
        <p class="text-sm text-foreground">No se pudo cargar la exportación.</p>
        <p class="text-xs text-muted-foreground">{{ e }}</p>
        <button type="button" class="alma-btn alma-btn-outline mt-1" (click)="cargar()"><lucide-icon name="refresh-cw" [size]="15" /> Reintentar</button>
      </div>
    } @else if (datos(); as x) {
      <!-- Entrega -->
      <section class="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 shadow-[var(--shadow-sm)]">
        <div class="max-w-3xl">
          <h2 class="text-sm font-semibold text-foreground">Entrega del archivo</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">
            El archivo queda siempre en Alma (se descarga desde la bandeja, con sus versiones). Además puede quedar como
            <b class="text-foreground">borrador de respuesta en el hilo</b> del correo, con el archivo adjunto, para revisarlo y enviarlo desde Outlook.
          </p>
          <p class="mt-1 text-[11px] text-muted-foreground">Un correo en Validar genera su archivo al aprobarlo, con la salida de su etiqueta final.</p>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <alma-switch [checked]="x.borrador_en_hilo" (checkedChange)="cambiarBorrador($event)" [disabled]="guardandoBorrador()" ariaLabel="Borrador en el hilo" />
          Borrador en el hilo
        </label>
      </section>

      @if (!procesos().length) {
        <div class="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No hay procesos activos. Créalos en «Procesos» para definir sus archivos.</div>
      } @else {
        <!-- Procesos -->
        <div class="glass inline-flex max-w-full flex-wrap gap-1 rounded-xl p-1" role="tablist" aria-label="Proceso">
          @for (p of procesos(); track p.id) {
            <button type="button" role="tab" class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors" [attr.aria-selected]="p.id === proceso()?.id" [class]="p.id === proceso()?.id ? 'bg-primary text-primary-foreground shadow-[var(--shadow-sm)]' : 'text-muted-foreground hover:text-foreground'" (click)="elegirProceso(p.id)">
              {{ p.clave }}
              @if (conArchivo(p); as n) { <span class="rounded-full bg-black/10 px-1.5 text-[10px] tabular-nums" [attr.aria-label]="n + ' salidas con archivo'">{{ n }}</span> }
              @if (sucios().has(p.id)) { <span class="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Cambios sin guardar"></span> }
            </button>
          }
        </div>

        @if (proceso(); as p) {
          <section class="glass grid gap-3 rounded-2xl p-4 shadow-[var(--shadow-sm)]">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 class="text-sm font-semibold text-foreground">Archivos de {{ p.nombre }}</h2>
                <p class="text-xs text-muted-foreground">Una salida puede aplicar a todas las etiquetas del proceso o solo a algunas. Las etiquetas sin salida no generan archivo.</p>
              </div>
              <div class="flex gap-2">
                @if (sucios().has(p.id)) {
                  <button type="button" class="alma-btn alma-btn-outline h-9 rounded-lg text-xs" [disabled]="guardando()" (click)="descartar(p)">Descartar</button>
                }
                <button type="button" class="alma-btn alma-btn-primary h-9 rounded-lg" [disabled]="guardando() || !sucios().has(p.id)" (click)="guardarSalidas(p)">
                  <lucide-icon [name]="guardando() ? 'loader-2' : 'save'" [size]="15" [class.animate-spin]="guardando()" /> Guardar salidas
                </button>
              </div>
            </div>

            @if (!p.campos_extraer.length) {
              <p class="flex items-start gap-1.5 rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-800 dark:text-sky-200">
                <lucide-icon name="info" [size]="13" class="mt-0.5 shrink-0" /> Este proceso no extrae datos: solo categoriza, así que sus archivos saldrían vacíos.
              </p>
            }

            @for (s of salidasDe(p.id); track $index; let i = $index) {
              <div class="grid gap-2 rounded-xl border border-border/60 bg-card/50 p-3" [class.opacity-60]="!s.activa">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--surface-sunken)] text-[11px] font-bold">{{ i + 1 }}</span>
                  <input class="alma-input h-9 min-w-[180px] max-w-xs flex-1 text-sm" [attr.aria-label]="'Nombre de la salida ' + (i + 1)" [(ngModel)]="s.nombre" (ngModelChange)="marcar(p.id)" />
                  <select class="alma-input h-9 w-52 text-sm" [attr.aria-label]="'Formato de la salida ' + (i + 1)" [(ngModel)]="s.modo" (ngModelChange)="cambiarModo(p, s)">
                    @for (m of modos; track m.id) { <option [value]="m.id">{{ m.nombre }}</option> }
                  </select>
                  @if (s.modo === 'plantilla') {
                    <select class="alma-input h-9 w-52 text-sm" [attr.aria-label]="'Plantilla de la salida ' + (i + 1)" [ngModel]="s.plantilla_id ?? ''" (ngModelChange)="elegirPlantilla(p, s, $event)">
                      <option value="">Elige la plantilla…</option>
                      @for (t of x.plantillas; track t.id) { <option [value]="t.id">{{ t.nombre }}</option> }
                      <option value="__nueva">+ Nueva plantilla…</option>
                    </select>
                    @if (plantillaDe(s.plantilla_id); as t) {
                      <button type="button" class="alma-btn alma-btn-outline h-9 rounded-lg text-xs" (click)="editarPlantilla(t)"><lucide-icon name="pencil" [size]="13" /> Editar plantilla</button>
                      @if (incompleta(t)) { <span class="alma-badge bg-amber-500/15 text-amber-700 dark:text-amber-300" almaTooltip="Hay columnas sin origen: salen vacías">Incompleta</span> }
                    }
                  }
                  <span class="ml-auto flex items-center gap-0.5">
                    <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0" [disabled]="i === 0" aria-label="Subir salida" almaTooltip="Subir (la primera que cubre una etiqueta manda)" (click)="moverSalida(p, i, -1)"><lucide-icon name="arrow-up" [size]="14" /></button>
                    <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0" [disabled]="i === salidasDe(p.id).length - 1" aria-label="Bajar salida" (click)="moverSalida(p, i, 1)"><lucide-icon name="arrow-down" [size]="14" /></button>
                    <alma-switch [checked]="s.activa" (checkedChange)="s.activa = $event; marcar(p.id)" [ariaLabel]="'Salida ' + s.nombre + ' activa'" />
                    @if (salidasDe(p.id).length > 1) {
                      <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0 text-destructive" aria-label="Quitar salida" (click)="quitarSalida(p, i)"><lucide-icon name="x" [size]="14" /></button>
                    }
                  </span>
                </div>
                @if (p.etiquetas.length > 1) {
                  <div class="flex flex-wrap items-center gap-1.5 pl-8">
                    <span class="text-xs text-muted-foreground">Aplica a:</span>
                    <button type="button" class="rounded-full border px-2.5 py-0.5 text-xs transition-colors" [attr.aria-pressed]="s.todas" [class]="s.todas ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'" (click)="s.todas = !s.todas; marcar(p.id)">Todas las etiquetas</button>
                    @for (e of p.etiquetas; track e) {
                      <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-0.5 text-xs" [class.opacity-50]="s.todas">
                        <input type="checkbox" [checked]="s.todas || s.etiquetas.includes(e)" [disabled]="s.todas" (change)="alternarEtiqueta(p, s, e)" />
                        {{ e }}
                      </label>
                    }
                  </div>
                  @if (!s.todas && !s.etiquetas.length) {
                    <p class="pl-8 text-xs text-destructive">Esta salida no aplica a ninguna etiqueta: marca al menos una o «Todas».</p>
                  }
                }
              </div>
            }
            <button type="button" class="alma-btn alma-btn-outline h-8 justify-self-start rounded-lg text-xs" [disabled]="salidasDe(p.id).length >= 20" (click)="agregarSalida(p)"><lucide-icon name="plus" [size]="14" /> Agregar salida para otras etiquetas</button>

            <!-- Resultado por etiqueta -->
            <div class="grid gap-1.5 rounded-xl bg-[var(--surface-sunken)] p-3">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resultado por etiqueta</p>
              <div class="flex flex-wrap gap-1.5">
                @for (c of cobertura(p); track c.etiqueta) {
                  <span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs" [class]="c.salidas.length > 1 ? 'border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'border-border/60 bg-card/60 text-foreground'">
                    <b class="font-mono font-medium">{{ c.etiqueta }}</b> →
                    @if (c.salidas.length) { {{ c.salidas[0] }} } @else { <span class="text-muted-foreground">sin archivo</span> }
                  </span>
                }
              </div>
              @for (c of cobertura(p); track c.etiqueta) {
                @if (c.salidas.length > 1) {
                  <p class="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200">
                    <lucide-icon name="alert-triangle" [size]="13" class="mt-0.5 shrink-0" />
                    <span><b>{{ c.etiqueta }}</b> está en {{ c.salidas.length }} salidas ({{ c.salidas.join(' y ') }}): Alma usa solo la primera, «{{ c.salidas[0] }}». Cambia el orden o quita la etiqueta de una de ellas.</span>
                  </p>
                }
              }
            </div>
            @if (errorSalidas(); as e) { <p class="text-xs text-destructive">{{ e }}</p> }
          </section>
        }

        <!-- Plantillas del buzón -->
        <section class="glass grid gap-3 rounded-2xl p-4 shadow-[var(--shadow-sm)]">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-semibold text-foreground">Plantillas del buzón</h2>
              <p class="text-xs text-muted-foreground">Los archivos propios del área (cargues, planillas del banco…). Una plantilla puede servir a varias salidas.</p>
            </div>
            <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" (click)="nuevaPlantilla()"><lucide-icon name="plus" [size]="14" /> Nueva plantilla</button>
          </div>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
            @for (t of x.plantillas; track t.id) {
              <article class="flex items-start gap-3 rounded-xl bg-[var(--surface-sunken)] p-3">
                <lucide-icon name="file-spreadsheet" [size]="18" class="mt-0.5 shrink-0 text-emerald-600" />
                <div class="min-w-0 flex-1">
                  <p class="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                    {{ t.nombre }}
                    <span class="rounded bg-card px-1.5 font-mono text-[10px] font-normal text-muted-foreground">.{{ t.formato }}</span>
                    @if (incompleta(t)) { <span class="alma-badge bg-amber-500/15 text-amber-700 dark:text-amber-300">Incompleta</span> }
                  </p>
                  <p class="text-[11px] text-muted-foreground">
                    {{ t.columnas.length }} columnas{{ t.detalle ? ' · una fila por elemento de «' + t.detalle + '»' : ' · una fila por correo' }}{{ t.modelo ? ' · modelo ' + t.modelo : '' }}
                  </p>
                  <p class="truncate font-mono text-[11px] text-muted-foreground">{{ t.nombre_archivo }}</p>
                  <p class="text-[11px] text-muted-foreground">
                    {{ usosPlantilla(t.id) || 'Ninguna salida la usa' }}@if (t.updated_at) { · actualizada {{ t.updated_at | date: 'd MMM' }}}
                  </p>
                </div>
                <div class="flex shrink-0 gap-0.5">
                  <button type="button" class="alma-btn alma-btn-ghost" almaTooltip="Editar" [attr.aria-label]="'Editar ' + t.nombre" (click)="editarPlantilla(t)"><lucide-icon name="pencil" [size]="15" /></button>
                  <button type="button" class="alma-btn alma-btn-ghost text-destructive" almaTooltip="Eliminar" [attr.aria-label]="'Eliminar ' + t.nombre" (click)="eliminarPlantilla(t)"><lucide-icon name="trash-2" [size]="15" /></button>
                </div>
              </article>
            } @empty {
              <p class="text-xs text-muted-foreground md:col-span-2">Aún no hay plantillas. Si el área usa un archivo propio, súbelo como modelo y Alma lo llena con los datos de cada correo.</p>
            }
          </div>
        </section>
      }
    }

    @if (builder(); as b) {
      <alma-plantilla-builder
        [buzonId]="buzon().id"
        [plantilla]="b.plantilla"
        [nombreSugerido]="b.nombre"
        [procesos]="procesosCampos()"
        [listas]="listas()"
        [bases]="bases()"
        (guardada)="plantillaGuardada($event)"
        (cerrada)="builder.set(null)"
      />
    }
  `,
})
export class ExportacionTabComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly categorias = input<Categoria[]>([]);
  /** El buzón cambió (borrador en el hilo): el padre lo reemplaza. */
  readonly buzonActualizado = output<Buzon>();

  protected readonly modos = MODOS;
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly datos = signal<Exportacion | null>(null);
  protected readonly bases = signal<Base[]>([]);
  /** Datos de los correos recientes por proceso (listas del JSON y ejemplo para el nombre del archivo). */
  private readonly recientes = signal<Record<string, Record<string, unknown>>>({});
  protected readonly listas = signal<Record<string, string[]>>({});

  protected readonly procSel = signal<string | null>(null);
  /** Copia editable de las salidas por proceso. */
  private readonly formas = signal<Record<string, SalidaForm[]>>({});
  protected readonly sucios = signal<Set<string>>(new Set());
  /** Sube con cada edición (los formularios son mutables). */
  private readonly version = signal(0);
  protected readonly guardando = signal(false);
  protected readonly guardandoBorrador = signal(false);
  protected readonly errorSalidas = signal<string | null>(null);

  protected readonly builder = signal<{ plantilla: Plantilla | null; nombre: string; destino: { procesoId: string; indice: number } | null } | null>(null);

  protected readonly procesos = computed(() => (this.datos()?.procesos ?? []).filter((p) => p.activo));
  protected readonly proceso = computed<ProcesoExportacion | null>(() => {
    const l = this.procesos();
    return l.find((p) => p.id === this.procSel()) ?? l[0] ?? null;
  });

  protected readonly procesosCampos = computed<ProcesoCampos[]>(() =>
    this.procesos().map((p) => ({ clave: p.clave, nombre: p.nombre, campos: p.campos_extraer.map((c) => c.clave), ejemplo: this.recientes()[p.clave] ?? {} })),
  );

  constructor() {
    queueMicrotask(() => void this.cargar());
  }

  async cargar(): Promise<void> {
    const id = this.buzon().id;
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [x, bases, correos] = await Promise.all([
        this.api.exportacion(id),
        this.api.listarBases(id).catch(() => [] as Base[]),
        this.api.listarCorreos({ buzon_id: id, limit: 100 }).catch(() => ({ data: [], total: 0 })),
      ]);
      this.datos.set(x);
      this.bases.set(bases);
      this.formas.set(Object.fromEntries(x.procesos.map((p) => [p.id, this.aForma(p)])));
      this.sucios.set(new Set());
      // Correos recientes: listas de elementos (para «Detalle») y un ejemplo por proceso.
      const recientes: Record<string, Record<string, unknown>> = {};
      const listas: Record<string, string[]> = {};
      correos.data.forEach((c) => {
        if (!c.datos_extraidos) return;
        if (c.proceso_clave && !recientes[c.proceso_clave]) recientes[c.proceso_clave] = c.datos_extraidos;
        Object.entries(listasDelJson(c.datos_extraidos)).forEach(([k, campos]) => (listas[k] = [...new Set([...(listas[k] ?? []), ...campos])]));
      });
      this.recientes.set(recientes);
      this.listas.set(listas);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private aForma(p: ProcesoExportacion): SalidaForm[] {
    const l = p.salidas.map((s) => ({
      nombre: s.nombre,
      modo: s.modo,
      todas: s.etiquetas === null,
      etiquetas: [...(s.etiquetas ?? [])],
      plantilla_id: s.plantilla_id,
      activa: s.activa,
    }));
    // Sin salidas guardadas: el proceso no genera archivo (se propone una para editar).
    return l.length ? l : [{ nombre: 'Sin archivo', modo: 'ninguno', todas: true, etiquetas: [], plantilla_id: null, activa: true }];
  }

  protected salidasDe(procesoId: string): SalidaForm[] {
    this.version();
    return this.formas()[procesoId] ?? [];
  }

  protected conArchivo(p: ProcesoExportacion): number {
    return this.salidasDe(p.id).filter((s) => s.activa && s.modo !== 'ninguno').length;
  }

  protected plantillaDe(id: string | null): Plantilla | undefined {
    return this.datos()?.plantillas.find((t) => t.id === id);
  }

  protected incompleta(t: Plantilla): boolean {
    return t.columnas.some((c) => c.origen.tipo === 'vacio');
  }

  protected usosPlantilla(id: string): string {
    const usos = this.procesos().flatMap((p) => this.salidasDe(p.id).filter((s) => s.modo === 'plantilla' && s.plantilla_id === id).map((s) => `${p.clave} · ${s.nombre}`));
    return usos.length ? `La usa: ${usos.join(', ')}` : '';
  }

  /** Qué salida(s) cubren cada etiqueta, en orden (la primera manda). */
  protected cobertura(p: ProcesoExportacion): { etiqueta: string; salidas: string[] }[] {
    const salidas = this.salidasDe(p.id);
    return p.etiquetas.map((e) => ({
      etiqueta: e,
      salidas: salidas.filter((s) => s.activa && s.modo !== 'ninguno' && (s.todas || s.etiquetas.includes(e))).map((s) => s.nombre || 'salida sin nombre'),
    }));
  }

  // ── Edición de salidas ──
  protected marcar(procesoId: string): void {
    this.sucios.update((s) => new Set(s).add(procesoId));
    this.errorSalidas.set(null);
    this.version.update((v) => v + 1);
  }

  protected elegirProceso(id: string): void {
    this.procSel.set(id);
    this.errorSalidas.set(null);
  }

  protected cambiarModo(p: ProcesoExportacion, s: SalidaForm): void {
    if (s.modo === 'tabla' && (!s.nombre.trim() || s.nombre === 'Sin archivo')) s.nombre = `Tabla ${p.clave}`;
    if (s.modo === 'ninguno' && !s.nombre.trim()) s.nombre = 'Sin archivo';
    if (s.modo !== 'plantilla') s.plantilla_id = null;
    this.marcar(p.id);
  }

  protected elegirPlantilla(p: ProcesoExportacion, s: SalidaForm, id: string): void {
    if (id === '__nueva') {
      const indice = this.salidasDe(p.id).indexOf(s);
      this.builder.set({ plantilla: null, nombre: s.nombre && s.nombre !== 'Sin archivo' ? s.nombre : `Archivo ${p.clave}`, destino: { procesoId: p.id, indice } });
      return;
    }
    s.plantilla_id = id || null;
    const t = this.plantillaDe(s.plantilla_id);
    if (t && (!s.nombre.trim() || s.nombre === 'Sin archivo' || s.nombre.startsWith('Tabla '))) s.nombre = t.nombre;
    this.marcar(p.id);
  }

  protected alternarEtiqueta(p: ProcesoExportacion, s: SalidaForm, e: string): void {
    s.etiquetas = s.etiquetas.includes(e) ? s.etiquetas.filter((x) => x !== e) : [...s.etiquetas, e];
    this.marcar(p.id);
  }

  protected agregarSalida(p: ProcesoExportacion): void {
    const l = this.salidasDe(p.id);
    // Las etiquetas que ninguna salida activa cubre todavía.
    const libres = p.etiquetas.filter((e) => !l.some((s) => s.activa && (s.todas || s.etiquetas.includes(e))));
    l.push({ nombre: `Salida ${l.length + 1}`, modo: 'tabla', todas: false, etiquetas: libres, plantilla_id: null, activa: true });
    this.marcar(p.id);
  }

  protected quitarSalida(p: ProcesoExportacion, i: number): void {
    this.salidasDe(p.id).splice(i, 1);
    this.marcar(p.id);
  }

  protected moverSalida(p: ProcesoExportacion, i: number, d: number): void {
    const l = this.salidasDe(p.id);
    const [s] = l.splice(i, 1);
    l.splice(i + d, 0, s);
    this.marcar(p.id);
  }

  protected descartar(p: ProcesoExportacion): void {
    this.formas.update((m) => ({ ...m, [p.id]: this.aForma(p) }));
    this.sucios.update((s) => {
      const n = new Set(s);
      n.delete(p.id);
      return n;
    });
    this.errorSalidas.set(null);
    this.version.update((v) => v + 1);
  }

  protected async guardarSalidas(p: ProcesoExportacion): Promise<void> {
    this.errorSalidas.set(null);
    const l = this.salidasDe(p.id);
    for (const s of l) {
      if (!s.nombre.trim()) return this.errorSalidas.set('Cada salida necesita un nombre.');
      if (s.modo === 'plantilla' && !s.plantilla_id) return this.errorSalidas.set(`La salida «${s.nombre}» usa una plantilla: elígela.`);
      if (!s.todas && !s.etiquetas.length && p.etiquetas.length > 1) return this.errorSalidas.set(`La salida «${s.nombre}» no aplica a ninguna etiqueta.`);
    }
    const body: SalidaIn[] = l.map((s) => ({
      nombre: s.nombre.trim(),
      modo: s.modo,
      etiquetas: s.todas || p.etiquetas.length <= 1 ? null : s.etiquetas,
      plantilla_id: s.modo === 'plantilla' ? s.plantilla_id : null,
      activa: s.activa,
    }));
    this.guardando.set(true);
    try {
      const salidas = await this.api.guardarSalidas(p.id, body);
      const actualizado = { ...p, salidas };
      this.datos.update((x) => (x ? { ...x, procesos: x.procesos.map((q) => (q.id === p.id ? actualizado : q)) } : x));
      this.formas.update((m) => ({ ...m, [p.id]: this.aForma(actualizado) }));
      this.sucios.update((s) => {
        const n = new Set(s);
        n.delete(p.id);
        return n;
      });
      this.version.update((v) => v + 1);
      this.toast.show('Salidas guardadas', `${p.clave}: ${body.filter((s) => s.modo !== 'ninguno' && s.activa).length} con archivo.`);
    } catch (e) {
      this.errorSalidas.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Entrega ──
  protected async cambiarBorrador(v: boolean): Promise<void> {
    this.guardandoBorrador.set(true);
    try {
      const b = await this.api.actualizarBuzon(this.buzon().id, { borrador_en_hilo: v });
      this.datos.update((x) => (x ? { ...x, borrador_en_hilo: b.borrador_en_hilo } : x));
      this.buzonActualizado.emit(b);
      this.toast.show(v ? 'Borrador en el hilo activado' : 'Borrador en el hilo desactivado', v ? 'Cada archivo queda también como borrador de respuesta en el correo.' : 'Los archivos quedan solo en Alma.');
    } catch (e) {
      this.toast.error('No se pudo cambiar la entrega', e instanceof Error ? e.message : String(e));
      this.datos.update((x) => (x ? { ...x } : x));
    } finally {
      this.guardandoBorrador.set(false);
    }
  }

  // ── Plantillas ──
  protected nuevaPlantilla(): void {
    this.builder.set({ plantilla: null, nombre: '', destino: null });
  }

  protected editarPlantilla(t: Plantilla): void {
    this.builder.set({ plantilla: t, nombre: t.nombre, destino: null });
  }

  protected plantillaGuardada(t: Plantilla): void {
    this.datos.update((x) =>
      x ? { ...x, plantillas: x.plantillas.some((p) => p.id === t.id) ? x.plantillas.map((p) => (p.id === t.id ? t : p)) : [...x.plantillas, t] } : x,
    );
    // Se creó desde una salida: queda elegida en ella (falta «Guardar salidas»).
    const destino = this.builder()?.destino;
    if (destino) {
      const s = this.salidasDe(destino.procesoId)[destino.indice];
      if (s) {
        s.plantilla_id = t.id;
        s.modo = 'plantilla';
        if (!s.nombre.trim() || s.nombre === 'Sin archivo' || s.nombre.startsWith('Tabla ')) s.nombre = t.nombre;
        this.marcar(destino.procesoId);
      }
      this.builder.set({ ...this.builder()!, plantilla: t, destino: null });
    }
  }

  protected async eliminarPlantilla(t: Plantilla): Promise<void> {
    const usos = this.usosPlantilla(t.id);
    if (!confirm(`¿Eliminar la plantilla «${t.nombre}»?${usos ? ` ${usos}: esas salidas quedan «Sin archivo».` : ''}`)) return;
    try {
      await this.api.eliminarPlantilla(t.id);
      await this.cargar();
      this.toast.show('Plantilla eliminada', t.nombre);
    } catch (e) {
      this.toast.error('No se pudo eliminar la plantilla', e instanceof Error ? e.message : String(e));
    }
  }
}
