// App «Masesstory_HL» (Afiliaciones y Traslados del Obligatorio): valida los Excel de
// Historia Laboral (HL). El usuario sube los archivos (hasta ~480) por tandas; el
// servidor evalúa cada uno contra los umbrales y acumula un lote TEMPORAL (no se guarda
// en la base de datos). Al final se descargan dos Excel: la validación (OK / NO CUMPLE /
// NO DETERMINADO) y el consolidado de las hojas Resumen y Detalle mensajes.

import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import {
  CasoHl,
  EstadoConsolidado,
  MasesstoryHlApi,
  PERM_VIEW,
  RESULTADOS,
  Resultado,
  Totales,
  Umbrales,
} from './masesstory-hl.api';

/** Cada petición debe terminar rápido: tandas de ~20 archivos o 8 MB, lo que llegue antes. */
const TANDA_ARCHIVOS = 20;
const TANDA_BYTES = 8 * 1024 * 1024;
const POR_PAGINA = 50;
const CLAVE_LOTE = 'masesstory-hl:lote';
const ZONA = { timeZone: 'America/Bogota' } as const;
const SIN_TOTALES: Totales = { OK: 0, 'NO CUMPLE': 0, 'NO DETERMINADO': 0 };
const COMPONENTES = ['datos_basicos', 'aportes_afp', 'completitud', 'consistencia_total'] as const;

const esExcel = (f: File) => /\.xls[xm]$/i.test(f.name) && !f.name.startsWith('~$');
const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

@Component({
  selector: 'alma-masesstory-hl-page',
  imports: [DecimalPipe, RouterLink, LucideAngularModule, AccessDeniedComponent, AlmaLoaderComponent],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-[1800px] space-y-5 px-4 py-4 sm:px-6">
        <div class="flex flex-wrap items-center gap-3">
          <a routerLink="/" class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary">
            <lucide-icon name="arrow-left" [size]="16" /> Inicio
          </a>
          <div>
            <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground">Masesstory_HL</h1>
            <p class="text-on-wallpaper text-sm text-foreground/80">Validación de Historias Laborales: consolida y clasifica cada caso.</p>
          </div>
        </div>

        @if (recuperando()) {
          <div class="flex justify-center py-10"><alma-loader [size]="56" label="Recuperando tu validación…" /></div>
        } @else {
          <!-- Cargar -->
          <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <label
              class="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors"
              [class]="arrastrando() ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'"
              (dragover)="$event.preventDefault(); arrastrando.set(true)"
              (dragleave)="arrastrando.set(false)"
              (drop)="soltar($event)"
            >
              <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <lucide-icon [name]="procesando() ? 'loader-2' : 'upload-cloud'" [size]="22" [class.animate-spin]="procesando()" />
              </span>
              <span class="text-sm font-semibold text-foreground">Arrastra los Excel de Historia Laboral aquí o haz clic para elegirlos</span>
              <span class="text-xs text-muted-foreground">
                Archivos .xlsx con la hoja «Resumen» (y «Detalle mensajes»). Puedes subir hasta ~480 a la vez; se envían por tandas.
              </span>
              <input type="file" class="sr-only" multiple accept=".xlsx,.xlsm" [disabled]="procesando()" (change)="elegir($event)" />
            </label>
            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <label class="inline-flex cursor-pointer items-center gap-1 font-medium text-primary hover:underline">
                <lucide-icon name="folder-input" [size]="13" /> Elegir una carpeta completa
                <input type="file" class="sr-only" webkitdirectory [disabled]="procesando()" (change)="elegir($event)" />
              </label>
              <span class="inline-flex items-center gap-1">
                <lucide-icon name="info" [size]="13" />
                Los archivos no se guardan en la base de datos: el lote queda en el servidor solo para generar las descargas y se borra al terminar o a las 3 horas.
              </span>
            </div>

            @if (cola().length) {
              <div class="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--surface-sunken)] px-4 py-3">
                <lucide-icon name="file-spreadsheet" [size]="18" class="text-primary" />
                <p class="text-sm text-foreground">
                  <span class="font-semibold tabular-nums">{{ cola().length | number }}</span> archivo(s) listo(s) ·
                  <span class="tabular-nums">{{ colaMb() | number: '1.1-1' }}</span> MB
                  @if (ignorados()) {
                    <span class="text-muted-foreground"> · {{ ignorados() }} ignorado(s) por no ser Excel</span>
                  }
                </p>
                <span class="flex-1"></span>
                @if (!procesando()) {
                  <button type="button" class="alma-btn alma-btn-ghost h-9 w-auto rounded-lg px-3 text-xs" (click)="vaciarCola()">Vaciar selección</button>
                  <button type="button" class="alma-btn alma-btn-primary h-9 rounded-lg text-sm" (click)="validar()">
                    <lucide-icon name="clipboard-check" [size]="15" /> Validar
                  </button>
                }
              </div>
            }

            @if (procesando()) {
              <div class="mt-4 space-y-1.5" role="status" aria-live="polite">
                <div class="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Procesando… tanda {{ tandaActual() }} de {{ tandasTotal() }}</span>
                  <span class="tabular-nums">{{ progreso().hechos | number }} / {{ progreso().total | number }} archivos</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div class="h-full rounded-full bg-primary transition-all" [style.width.%]="porcentaje()"></div>
                </div>
              </div>
            }
            @if (errorCarga(); as e) {
              <p class="mt-3 flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <lucide-icon name="alert-triangle" [size]="16" class="mt-0.5 shrink-0" /> {{ e }}
              </p>
            }
          </section>

          <!-- Resultados -->
          @if (archivosTotal() > 0) {
            <section class="space-y-4">
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button type="button" class="glass rounded-2xl px-4 py-3 text-left shadow-[var(--shadow-sm)]" [class.ring-2]="pestana() === 'todos'" (click)="elegirPestana('todos')">
                  <p class="text-[11px] text-muted-foreground">Casos evaluados</p>
                  <p class="text-2xl font-bold tabular-nums text-foreground">{{ casos().length | number }}</p>
                  <p class="text-[11px] text-muted-foreground">{{ archivosTotal() | number }} archivo(s)</p>
                </button>
                @for (r of resultados; track r) {
                  <button type="button" class="glass rounded-2xl px-4 py-3 text-left shadow-[var(--shadow-sm)]" [class.ring-2]="pestana() === r" (click)="elegirPestana(r)">
                    <p class="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <lucide-icon [name]="icono(r)" [size]="12" [class]="colorTexto(r)" /> {{ r }}
                    </p>
                    <p class="text-2xl font-bold tabular-nums" [class]="colorTexto(r)">{{ totales()[r] | number }}</p>
                  </button>
                }
                <div class="glass col-span-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl px-4 py-3 shadow-[var(--shadow-sm)] sm:col-span-4">
                  <p class="min-w-[14rem] flex-1 text-xs text-muted-foreground">
                    @if (venceEn(); as v) { Se borra del servidor el {{ fechaHora(v) }} si no hay más actividad. }
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <button type="button" class="alma-btn alma-btn-primary h-9 shrink-0 whitespace-nowrap rounded-lg text-sm" [disabled]="!!descargando()" (click)="descargarEvaluado()">
                      <lucide-icon [name]="descargando() === 'evaluado' ? 'loader-2' : 'download'" [size]="15" [class.animate-spin]="descargando() === 'evaluado'" /> Descargar validación
                    </button>
                    <button type="button" class="alma-btn alma-btn-primary h-9 shrink-0 whitespace-nowrap rounded-lg text-sm" [disabled]="!!descargando() || procesando()" (click)="descargarConsolidado()">
                      <lucide-icon [name]="descargando() === 'consolidado' ? 'loader-2' : 'download'" [size]="15" [class.animate-spin]="descargando() === 'consolidado'" />
                      {{ etiquetaConsolidado() }}
                    </button>
                    @if (!confirmandoBorrar()) {
                      <button type="button" class="alma-btn alma-btn-ghost h-9 w-auto shrink-0 whitespace-nowrap rounded-lg px-3 text-xs" [disabled]="procesando() || !!descargando()" (click)="confirmandoBorrar.set(true)">
                        <lucide-icon name="trash-2" [size]="14" /> Nueva validación
                      </button>
                    } @else {
                      <span class="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive">
                        ¿Borrar este lote y empezar de cero?
                        <button type="button" class="alma-btn h-7 rounded-md px-2 text-xs font-semibold" (click)="nuevaValidacion()">Sí, borrar</button>
                        <button type="button" class="alma-btn alma-btn-ghost h-7 w-auto rounded-md px-2 text-xs" (click)="confirmandoBorrar.set(false)">Cancelar</button>
                      </span>
                    }
                  </div>
                </div>
              </div>

              @if (repetidos() > 0) {
                <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <lucide-icon name="info" [size]="13" /> {{ repetidos() }} archivo(s) ya estaban en el lote (mismo contenido) y no se duplicaron.
                </p>
              }

              <div class="glass overflow-hidden rounded-3xl shadow-[var(--shadow-sm)]">
                <header class="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
                  <h2 class="text-sm font-bold text-foreground">
                    {{ pestana() === 'todos' ? 'Todos los casos' : pestana() }}
                    <span class="font-normal text-muted-foreground">· {{ filtrados().length | number }}</span>
                  </h2>
                  <span class="flex-1"></span>
                  <label class="relative">
                    <lucide-icon name="search" [size]="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      class="h-9 w-64 rounded-lg border border-border bg-transparent pl-8 pr-3 text-sm outline-none focus:border-primary"
                      placeholder="Buscar archivo, cédula, nombre, AFP…"
                      [value]="filtro()"
                      (input)="cambiarFiltro($any($event.target).value)"
                    />
                  </label>
                </header>

                @if (!filtrados().length) {
                  <p class="px-5 py-10 text-center text-sm text-muted-foreground">No hay casos con ese filtro.</p>
                } @else {
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="bg-[var(--table-header)] text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
                        <tr>
                          <th class="px-3 py-2">Resultado</th>
                          <th class="px-3 py-2">Afiliado</th>
                          <th class="px-3 py-2">Archivo</th>
                          <th class="px-3 py-2">AFP / Estado</th>
                          <th class="px-2 py-2 text-right" [attr.title]="'Mínimo ' + minimo('datos_basicos') + '%'">Datos básicos</th>
                          <th class="px-2 py-2 text-right" [attr.title]="'Mínimo ' + minimo('aportes_afp') + '%'">Aportes</th>
                          <th class="px-2 py-2 text-right" [attr.title]="'Mínimo ' + minimo('completitud') + '%'">Completitud</th>
                          <th class="px-2 py-2 text-right" [attr.title]="'Mínimo ' + minimo('consistencia_total') + '%'">Consistencia</th>
                          <th class="px-3 py-2">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        <!-- Nada se trunca: nombre, archivo, estado y motivo hacen salto de línea. -->
                        @for (c of visibles(); track $index) {
                          <tr class="border-t border-border/50 align-top hover:bg-accent/60">
                            <td class="whitespace-nowrap px-3 py-2.5">
                              <span class="alma-badge inline-flex items-center gap-1" [class]="insignia(c.resultado)">
                                <lucide-icon [name]="icono(c.resultado)" [size]="12" /> {{ c.resultado }}
                              </span>
                            </td>
                            <td class="min-w-[9rem] px-3 py-2.5">
                              <p class="break-words font-medium text-foreground">{{ c.nombre }}</p>
                              <p class="text-xs tabular-nums text-muted-foreground">{{ c.identificacion }}</p>
                            </td>
                            <td class="min-w-[8rem] break-all px-3 py-2.5 text-xs">{{ c.archivo }}</td>
                            <td class="min-w-[6.5rem] px-3 py-2.5">
                              <p class="break-words font-medium text-foreground">{{ c.afp }}</p>
                              <p class="break-words text-xs text-muted-foreground">{{ c.estado }}</p>
                            </td>
                            @for (k of componentes; track k) {
                              <td class="whitespace-nowrap px-2 py-2.5 text-right tabular-nums" [class]="bajo(c, k) ? 'font-semibold text-destructive' : ''">{{ pct(c[k]) }}</td>
                            }
                            <td class="min-w-[12rem] break-words px-3 py-2.5 text-xs text-muted-foreground">{{ c.motivo }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  @if (totalPaginas() > 1) {
                    <footer class="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
                      <span>Página {{ pagina() + 1 }} de {{ totalPaginas() }}</span>
                      <span class="flex gap-1.5">
                        <button type="button" class="alma-btn alma-btn-ghost h-8 w-auto rounded-lg px-3 text-xs" [disabled]="pagina() === 0" (click)="pagina.set(pagina() - 1)">Anterior</button>
                        <button type="button" class="alma-btn alma-btn-ghost h-8 w-auto rounded-lg px-3 text-xs" [disabled]="pagina() + 1 >= totalPaginas()" (click)="pagina.set(pagina() + 1)">Siguiente</button>
                      </span>
                    </footer>
                  }
                }
              </div>
            </section>
          }
        }
      </div>
    }
  `,
})
export class MasesstoryHlPageComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MasesstoryHlApi);
  private readonly toast = inject(ToastService);
  private vivo = true;

  protected readonly puedeVer = computed(() => this.auth.hasPermission(PERM_VIEW));
  protected readonly resultados = RESULTADOS;
  protected readonly componentes = COMPONENTES;

  // Selección y proceso
  protected readonly cola = signal<File[]>([]);
  protected readonly ignorados = signal(0);
  protected readonly arrastrando = signal(false);
  protected readonly procesando = signal(false);
  protected readonly progreso = signal({ hechos: 0, total: 0 });
  protected readonly tandaActual = signal(0);
  protected readonly tandasTotal = signal(0);
  protected readonly errorCarga = signal<string | null>(null);

  // Lote
  protected readonly loteId = signal<string | null>(null);
  protected readonly casos = signal<CasoHl[]>([]);
  protected readonly totales = signal<Totales>({ ...SIN_TOTALES });
  protected readonly archivosTotal = signal(0);
  protected readonly repetidos = signal(0);
  protected readonly venceEn = signal<string | null>(null);
  protected readonly umbrales = signal<Umbrales | null>(null);
  protected readonly consolidado = signal<EstadoConsolidado>({ estado: 'sin_generar' });
  protected readonly recuperando = signal(false);
  protected readonly descargando = signal<'evaluado' | 'consolidado' | null>(null);
  protected readonly confirmandoBorrar = signal(false);

  // Vista
  protected readonly pestana = signal<Resultado | 'todos'>('todos');
  protected readonly filtro = signal('');
  protected readonly pagina = signal(0);

  protected readonly colaMb = computed(() => this.cola().reduce((s, f) => s + f.size, 0) / (1024 * 1024));
  protected readonly porcentaje = computed(() => {
    const p = this.progreso();
    return p.total ? Math.round((p.hechos / p.total) * 100) : 0;
  });
  protected readonly filtrados = computed(() => {
    const pest = this.pestana();
    const q = this.filtro().trim().toLowerCase();
    return this.casos().filter(
      (c) =>
        (pest === 'todos' || c.resultado === pest) &&
        (!q || [c.archivo, c.identificacion, c.nombre, c.afp, c.motivo].some((t) => t.toLowerCase().includes(q))),
    );
  });
  protected readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / POR_PAGINA)));
  protected readonly visibles = computed(() => {
    const ini = Math.min(this.pagina(), this.totalPaginas() - 1) * POR_PAGINA;
    return this.filtrados().slice(ini, ini + POR_PAGINA);
  });
  protected readonly etiquetaConsolidado = computed(() => {
    if (this.descargando() === 'consolidado') return 'Generando consolidado…';
    return this.consolidado().estado === 'listo' ? 'Descargar consolidado' : 'Generar y descargar consolidado';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.vivo = false));
    if (this.puedeVer()) void this.recuperar();
  }

  // ── Selección de archivos ────────────────────────────────────────────────────

  protected elegir(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = ''; // permite volver a elegir lo mismo
    this.agregar(archivos);
  }

  protected soltar(ev: DragEvent): void {
    ev.preventDefault();
    this.arrastrando.set(false);
    this.agregar(Array.from(ev.dataTransfer?.files ?? []));
  }

  private agregar(nuevos: File[]): void {
    if (!nuevos.length) return;
    const validos = nuevos.filter(esExcel);
    this.ignorados.set(nuevos.length - validos.length);
    const llave = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
    const ya = new Set(this.cola().map(llave));
    const agregados = validos.filter((f) => !ya.has(llave(f)));
    this.cola.update((q) => [...q, ...agregados]);
    if (!validos.length) this.toast.error('Archivos no válidos', 'Sube los Historias Laborales en Excel (.xlsx).');
  }

  protected vaciarCola(): void {
    this.cola.set([]);
    this.ignorados.set(0);
    this.errorCarga.set(null);
  }

  // ── Validar por tandas ───────────────────────────────────────────────────────

  private armarTandas(archivos: File[]): File[][] {
    const tandas: File[][] = [];
    let actual: File[] = [];
    let bytes = 0;
    for (const f of archivos) {
      if (actual.length && (actual.length >= TANDA_ARCHIVOS || bytes + f.size > TANDA_BYTES)) {
        tandas.push(actual);
        actual = [];
        bytes = 0;
      }
      actual.push(f);
      bytes += f.size;
    }
    if (actual.length) tandas.push(actual);
    return tandas;
  }

  protected async validar(): Promise<void> {
    const pendientes = [...this.cola()];
    if (!pendientes.length || this.procesando()) return;
    const tandas = this.armarTandas(pendientes);
    this.errorCarga.set(null);
    this.procesando.set(true);
    this.progreso.set({ hechos: 0, total: pendientes.length });
    this.tandasTotal.set(tandas.length);
    this.pestana.set('todos');
    let hechos = 0;
    try {
      for (const [i, tanda] of tandas.entries()) {
        if (!this.vivo) return;
        this.tandaActual.set(i + 1);
        const r = await this.enviar(tanda);
        this.loteId.set(r.lote_id);
        this.guardarLote(r.lote_id);
        this.casos.update((c) => [...c, ...r.casos]);
        this.totales.set(r.totales);
        this.archivosTotal.set(r.archivos_total);
        this.venceEn.set(r.vence_en);
        this.umbrales.set(r.umbrales);
        this.consolidado.set({ estado: 'sin_generar' }); // otra tanda invalida el consolidado
        this.repetidos.update((n) => n + r.repetidos.length);
        hechos += tanda.length;
        this.progreso.set({ hechos, total: pendientes.length });
        this.cola.update((q) => q.filter((f) => !tanda.includes(f)));
      }
      this.toast.show('Validación terminada', `${pendientes.length} archivo(s) enviados y evaluados.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/ya venció|no existe/i.test(msg)) {
        // El lote ya no está en el servidor: lo procesado antes se perdió con él.
        this.reiniciarLocal();
        this.errorCarga.set(`${msg} Selecciona de nuevo todos los archivos y pulsa Validar.`);
      } else {
        this.errorCarga.set(
          `${msg} Lo que ya se procesó queda en el lote; puedes volver a pulsar Validar para continuar con el resto.`,
        );
      }
    } finally {
      this.procesando.set(false);
      await this.sincronizar(); // el servidor es la fuente de verdad (p. ej. tras un reintento)
    }
  }

  /** Una tanda; un fallo de red o un tiempo agotado se reintenta una vez (el servidor no
   *  duplica un archivo que ya recibió: lo reconoce por su contenido). */
  private async enviar(tanda: File[]) {
    try {
      return await this.api.subirTanda(tanda, this.loteId());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/ya venció|no existe|demasiado grande|Máximo|supera|tamaño máximo/i.test(msg)) throw e;
      await esperar(2000);
      return await this.api.subirTanda(tanda, this.loteId());
    }
  }

  // ── Lote ─────────────────────────────────────────────────────────────────────

  private guardarLote(id: string | null): void {
    try {
      if (id) sessionStorage.setItem(CLAVE_LOTE, id);
      else sessionStorage.removeItem(CLAVE_LOTE);
    } catch {
      /* sin sessionStorage: solo se pierde la recuperación al recargar */
    }
  }

  private async recuperar(): Promise<void> {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(CLAVE_LOTE);
    } catch {
      /* sin sessionStorage */
    }
    if (!id) return;
    this.recuperando.set(true);
    try {
      this.aplicar(await this.api.verLote(id));
    } catch {
      this.guardarLote(null); // venció o ya no existe
    } finally {
      this.recuperando.set(false);
    }
  }

  private async sincronizar(): Promise<void> {
    const id = this.loteId();
    if (!id) return;
    try {
      this.aplicar(await this.api.verLote(id));
    } catch {
      /* se conserva lo que ya está en pantalla */
    }
  }

  private aplicar(l: { lote_id: string; casos: CasoHl[]; totales: Totales; archivos_total: number; vence_en: string; umbrales: Umbrales; consolidado: EstadoConsolidado }): void {
    this.loteId.set(l.lote_id);
    this.casos.set(l.casos);
    this.totales.set(l.totales);
    this.archivosTotal.set(l.archivos_total);
    this.venceEn.set(l.vence_en);
    this.umbrales.set(l.umbrales);
    this.consolidado.set(l.consolidado);
  }

  private reiniciarLocal(): void {
    this.guardarLote(null);
    this.loteId.set(null);
    this.casos.set([]);
    this.totales.set({ ...SIN_TOTALES });
    this.archivosTotal.set(0);
    this.repetidos.set(0);
    this.venceEn.set(null);
    this.consolidado.set({ estado: 'sin_generar' });
    this.pestana.set('todos');
    this.filtro.set('');
    this.pagina.set(0);
  }

  protected async nuevaValidacion(): Promise<void> {
    const id = this.loteId();
    this.confirmandoBorrar.set(false);
    try {
      if (id) await this.api.borrarLote(id);
    } catch {
      /* si ya no existe, da igual: se vence solo */
    }
    this.reiniciarLocal();
    this.vaciarCola();
  }

  // ── Descargas ────────────────────────────────────────────────────────────────

  protected async descargarEvaluado(): Promise<void> {
    const id = this.loteId();
    if (!id) return;
    this.descargando.set('evaluado');
    try {
      await this.api.descargar(id, 'evaluado', 'HL_CALIFICADA_EVALUADA.xlsx');
    } catch (e) {
      this.toast.error('No se pudo descargar la validación', e instanceof Error ? e.message : String(e));
    } finally {
      this.descargando.set(null);
    }
  }

  /** El consolidado se genera en segundo plano (hasta ~1 min con 480 archivos): se inicia,
   *  se consulta su estado y se descarga solo cuando está listo. */
  protected async descargarConsolidado(): Promise<void> {
    const id = this.loteId();
    if (!id) return;
    this.descargando.set('consolidado');
    try {
      if (this.consolidado().estado !== 'listo') {
        this.consolidado.set(await this.api.generarConsolidado(id));
        const limite = Date.now() + 10 * 60_000;
        while (this.vivo && this.consolidado().estado === 'generando' && Date.now() < limite) {
          await esperar(2500);
          this.consolidado.set((await this.api.estadoLote(id)).consolidado);
        }
      }
      const est = this.consolidado();
      if (est.estado === 'error') throw new Error(est.detalle ?? 'No se pudo generar el consolidado.');
      if (est.estado !== 'listo') throw new Error('El consolidado tarda más de lo normal. Intenta de nuevo en un momento.');
      await this.api.descargar(id, 'consolidado', 'HL_CALIFICADA_CONSOLIDADO.xlsx');
    } catch (e) {
      this.toast.error('No se pudo descargar el consolidado', e instanceof Error ? e.message : String(e));
    } finally {
      this.descargando.set(null);
    }
  }

  // ── Presentación ─────────────────────────────────────────────────────────────

  protected elegirPestana(p: Resultado | 'todos'): void {
    this.pestana.set(p);
    this.pagina.set(0);
  }

  protected cambiarFiltro(v: string): void {
    this.filtro.set(v);
    this.pagina.set(0);
  }

  protected minimo(k: (typeof COMPONENTES)[number]): number | string {
    return this.umbrales()?.[k] ?? '—';
  }

  protected pct(v: number | null): string {
    return v === null || v === undefined ? '—' : `${v.toFixed(2)}%`;
  }

  /** Un componente por debajo de su umbral se resalta en rojo. */
  protected bajo(c: CasoHl, k: (typeof COMPONENTES)[number]): boolean {
    const u = this.umbrales()?.[k];
    const v = c[k];
    return u !== undefined && v !== null && v < u;
  }

  protected icono(r: Resultado): string {
    return r === 'OK' ? 'check-circle-2' : r === 'NO CUMPLE' ? 'x-circle' : 'help-circle';
  }

  protected colorTexto(r: Resultado): string {
    return r === 'OK' ? 'text-emerald-700 dark:text-emerald-400' : r === 'NO CUMPLE' ? 'text-destructive' : 'text-amber-600';
  }

  protected insignia(r: Resultado): string {
    return r === 'OK'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
      : r === 'NO CUMPLE'
        ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
  }

  protected fechaHora(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleString('es-CO', { ...ZONA, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
