// Modal de carga masiva de ajustes de comisiones: plantilla, preview local
// del Excel, validación con errores por fila y confirmación del archivo.

import {
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import * as XLSX from 'xlsx';
import { AlmaLoaderComponent } from '../../../shared/components/alma-loader.component';
import { isApiValidationError } from '../api-error';
import { ComisionesToast } from '../comisiones-toast.service';
import { ParametrizacionApi } from './parametrizacion.api';

export interface PreviewColumn {
  key: string;
  label: string;
}

export interface PreviewRow extends Record<string, unknown> {
  /** Número de fila en el Excel (1 = encabezado). */
  __rowNumber: number;
  /** Errores por clave de columna (celda). */
  __celdasError?: Record<string, string[]>;
  /** Errores que no se pudieron asociar a una columna. */
  __erroresSinColumna?: string[];
}

interface FilaErrorValidacion {
  row_number: number;
  errors: string[];
}

@Component({
  selector: 'alma-ajustes-carga-masiva-dialog',
  imports: [LucideAngularModule, AlmaLoaderComponent],
  template: `
    <div
      class="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-3 sm:p-4"
      (click)="cerrar()"
    >
      <div
        class="surface-solid flex w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-border shadow-2xl"
        style="height: 90vh; max-height: 90vh"
        (click)="$event.stopPropagation()"
      >
        <!-- Cabecera -->
        <div class="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div class="min-w-0">
            <h2 class="text-lg font-bold tracking-tight">Carga Masiva</h2>
            <p class="mt-0.5 text-sm text-muted-foreground">
              Ajustes de comisiones · carga y validación de archivo Excel
            </p>
          </div>
          <button
            type="button"
            (click)="cerrar()"
            class="alma-btn alma-btn-ghost h-9 w-9 shrink-0 rounded-full p-0 text-muted-foreground"
            aria-label="Cerrar"
          >
            <lucide-icon name="x" [size]="18" />
          </button>
        </div>

        <!-- Acciones superiores -->
        <div
          class="flex shrink-0 flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <button
            type="button"
            (click)="descargarPlantilla()"
            [disabled]="descargandoPlantilla()"
            class="alma-btn alma-btn-outline h-10 shrink-0 rounded-xl px-4"
          >
            <lucide-icon name="download" [size]="16" class="mr-2" />
            {{ descargandoPlantilla() ? 'Descargando…' : 'Descargar Plantilla' }}
          </button>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              (click)="validarArchivo()"
              [disabled]="!puedeValidar() || validando()"
              class="alma-btn h-10 rounded-xl px-4 text-white"
              [class]="
                puedeValidar() && !validando()
                  ? 'bg-muted-foreground hover:bg-muted-foreground/90'
                  : 'cursor-not-allowed bg-muted text-muted-foreground'
              "
            >
              {{ validando() ? 'Validando…' : 'Validar Archivo' }}
            </button>
            <button
              type="button"
              (click)="guardarAjustes()"
              [disabled]="!puedeGuardar() || guardando()"
              class="alma-btn h-10 rounded-xl px-4 text-primary-foreground"
              [class]="
                puedeGuardar() && !guardando()
                  ? 'alma-btn-primary'
                  : 'cursor-not-allowed bg-primary/40'
              "
            >
              {{ guardando() ? 'Guardando…' : 'Guardar Ajustes' }}
            </button>
          </div>
        </div>

        <!-- Cuerpo: scroll vertical de toda la modal -->
        <div class="scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div class="flex flex-col gap-4">
          @if (hayErrores()) {
            <div
              class="flex shrink-0 items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3"
            >
              <lucide-icon
                name="alert-triangle"
                [size]="18"
                class="mt-0.5 shrink-0 text-destructive"
              />
              <div class="min-w-0 text-sm">
                <p class="font-semibold text-destructive">
                  Se encontraron {{ filasError().length }} fila{{
                    filasError().length === 1 ? '' : 's'
                  }}
                  con errores
                </p>
                <p class="mt-0.5 text-destructive/90">
                  Corrija el Excel y vuelva a cargar el archivo para validarlo de nuevo.
                </p>
              </div>
            </div>
          }

          @if (archivoValidado()) {
            <div
              class="flex shrink-0 items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
            >
              <lucide-icon
                name="check-circle-2"
                [size]="18"
                class="mt-0.5 shrink-0 text-emerald-600"
              />
              <div class="min-w-0 text-sm">
                <p class="font-semibold text-emerald-700 dark:text-emerald-300">
                  Archivo validado sin errores
                </p>
                <p class="mt-0.5 text-emerald-700/90 dark:text-emerald-300/90">
                  Ya puede guardar los ajustes con el botón
                  <span class="font-medium">Guardar Ajustes</span>.
                </p>
              </div>
            </div>
          }

          <!-- Zona de carga: visible al inicio o tras errores (hay que recargar) -->
          @if (mostrarZonaCarga()) {
            <div
              class="relative flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 transition-colors"
              [class]="
                (arrastrando()
                  ? 'border-primary bg-primary/5'
                  : hayErrores()
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-border bg-[var(--surface-sunken)]/40') +
                (hayErrores() ? ' py-4' : ' py-8 gap-3')
              "
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
            >
              @if (subiendo()) {
                <alma-loader [size]="hayErrores() ? 40 : 56" label="Cargando archivo…" />
              } @else {
                @if (!hayErrores()) {
                  <div
                    class="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"
                  >
                    <lucide-icon name="arrow-up" [size]="22" />
                  </div>
                }
                <div class="text-center">
                  <p class="text-sm font-semibold">
                    {{
                      hayErrores()
                        ? 'Arrastre aquí el archivo .xlsx corregido'
                        : 'Arrastre aquí su archivo .xlsx'
                    }}
                  </p>
                  <p class="mt-1 text-xs text-muted-foreground">
                    o use el botón para seleccionar desde el explorador
                  </p>
                </div>
                <button
                  type="button"
                  (click)="abrirExplorador()"
                  class="alma-btn alma-btn-primary h-10 rounded-xl px-5"
                >
                  Subir Archivo
                </button>
              }
              <input
                #fileInput
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                class="hidden"
                (change)="onFileSelected($event)"
              />
            </div>
          } @else if (archivoNombre()) {
            <div
              class="flex shrink-0 flex-col gap-3 rounded-2xl border border-border bg-[var(--surface-sunken)]/40 p-3 sm:flex-row sm:items-start sm:gap-3 sm:px-4 sm:py-3"
            >
              <div class="flex min-w-0 items-start gap-3">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                >
                  <lucide-icon name="file-text" [size]="18" />
                </div>
                <div class="min-w-0 flex-1">
                  <p
                    class="break-all text-sm font-semibold leading-snug sm:truncate sm:break-normal"
                    [title]="archivoNombre()!"
                  >
                    {{ archivoNombre() }}
                  </p>
                  <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                    @if (archivoValidado()) {
                      Archivo listo para guardar.
                    } @else {
                      Archivo cargado. Revise la tabla de previsualización y luego use
                      <span class="font-medium text-foreground">Validar Archivo</span>.
                    }
                  </p>
                </div>
              </div>
              <button
                type="button"
                (click)="eliminarArchivo()"
                class="alma-btn alma-btn-outline h-10 w-full shrink-0 rounded-xl px-3 text-destructive hover:bg-destructive/5 sm:h-9 sm:w-auto"
                title="Eliminar archivo y volver a cargar"
              >
                <lucide-icon name="trash-2" [size]="16" class="mr-1.5" />
                Eliminar
              </button>
            </div>
          }

          @if (errorExtension(); as err) {
            <div
              class="shrink-0 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {{ err }}
            </div>
          }

          <!-- Tabla de previsualización -->
          <div class="flex min-h-[420px] flex-col gap-2">
            <div class="flex shrink-0 flex-wrap items-center gap-2">
              <h3 class="text-sm font-bold">Tabla de previsualización</h3>
              <span
                class="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                [class]="
                  hayErrores()
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-muted text-muted-foreground'
                "
              >
                @if (filasVisibles().length === 0) {
                  Sin datos
                } @else if (hayErrores()) {
                  {{ filasVisibles().length }} con error{{
                    filasVisibles().length === 1 ? '' : 'es'
                  }}
                } @else {
                  {{ filasVisibles().length }} registro{{
                    filasVisibles().length === 1 ? '' : 's'
                  }}
                }
              </span>
            </div>

            <div
              class="flex min-h-[380px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-[var(--table-surface)]"
              [class.border-destructive/40]="hayErrores()"
              style="height: min(55vh, 560px)"
            >
              @if (cargandoColumnas() && columnasVisibles().length === 0) {
                <div class="flex flex-1 items-center justify-center py-10">
                  <alma-loader [size]="48" label="Cargando columnas…" />
                </div>
              } @else {
                <div class="scrollbar relative min-h-0 flex-1 overflow-auto">
                  <table class="alma-table w-max min-w-full border-separate border-spacing-0">
                    <thead class="sticky top-0 z-10 bg-[var(--table-header)]">
                      <tr>
                        @if (hayErrores()) {
                          <th
                            class="sticky left-0 z-20 h-10 whitespace-nowrap border-b border-border bg-[var(--table-header)] px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shadow-[6px_0_10px_-4px_rgba(0,0,0,.35)]"
                          >
                            Fila
                          </th>
                        }
                        @for (col of columnasVisibles(); track col.key) {
                          <th
                            class="h-10 whitespace-nowrap border-b border-border bg-[var(--table-header)] px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65"
                          >
                            {{ col.label }}
                          </th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @if (filasVisibles().length === 0) {
                        <tr>
                          <td
                            [attr.colspan]="
                              columnasVisibles().length + (hayErrores() ? 1 : 0) || 1
                            "
                            class="px-3 py-10 text-center text-sm text-muted-foreground"
                          >
                            {{
                              archivoNombre() || hayErrores()
                                ? 'No hay filas para mostrar.'
                                : 'Suba un archivo .xlsx para ver la previsualización.'
                            }}
                          </td>
                        </tr>
                      } @else {
                        @for (row of filasVisibles(); track row.__rowNumber) {
                          <tr class="transition-colors hover:bg-primary/5">
                            @if (hayErrores()) {
                              <td
                                class="sticky left-0 z-10 whitespace-nowrap px-3 py-2 text-xs font-semibold shadow-[6px_0_10px_-4px_rgba(0,0,0,.35)]"
                                [class]="
                                  (row.__erroresSinColumna?.length ?? 0) > 0
                                    ? 'cursor-help rounded-md border-2 border-destructive bg-card text-destructive'
                                    : 'border-b border-border bg-card text-foreground'
                                "
                                (mouseenter)="
                                  abrirTooltipCelda(
                                    $event,
                                    row.__rowNumber,
                                    row.__erroresSinColumna ?? []
                                  )
                                "
                                (mousemove)="moverTooltipError($event)"
                                (mouseleave)="cerrarTooltipError()"
                              >
                                {{ row.__rowNumber }}
                              </td>
                            }
                            @for (col of columnasVisibles(); track col.key) {
                              @let errsCelda = erroresDeCelda(row, col.key);
                              <td
                                class="max-w-[220px] truncate whitespace-nowrap px-3 py-2 text-xs"
                                [class]="
                                  errsCelda.length
                                    ? 'cursor-help rounded-md border-2 border-destructive bg-card font-medium text-destructive shadow-sm'
                                    : 'border-b border-border/60'
                                "
                                [title]="
                                  errsCelda.length ? '' : textoCelda(row, col.key)
                                "
                                (mouseenter)="
                                  errsCelda.length &&
                                    abrirTooltipCelda($event, row.__rowNumber, errsCelda, col.label)
                                "
                                (mousemove)="errsCelda.length && moverTooltipError($event)"
                                (mouseleave)="cerrarTooltipError()"
                              >
                                {{ textoCelda(row, col.key) }}
                              </td>
                            }
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>

                @if (tooltipError(); as tip) {
                  <div
                    class="pointer-events-none fixed z-[120] max-w-sm rounded-xl border border-destructive/40 bg-card px-3 py-2.5 shadow-xl"
                    [style.left.px]="tip.x"
                    [style.top.px]="tip.y"
                  >
                    <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">
                      @if (tip.campo) {
                        {{ tip.campo }} · fila {{ tip.fila }}
                      } @else {
                        Fila {{ tip.fila }}
                      }
                    </p>
                    <ul class="space-y-1.5">
                      @for (err of tip.errores; track $index) {
                        <li
                          class="rounded-lg border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] leading-snug text-destructive"
                        >
                          {{ err }}
                        </li>
                      }
                    </ul>
                  </div>
                }
                <div
                  class="flex shrink-0 items-center border-t border-border px-3 py-2 text-xs text-muted-foreground"
                >
                  <span>
                    @if (hayErrores()) {
                      Mostrando solo filas con errores:
                      <span class="font-semibold text-destructive">{{
                        filasVisibles().length
                      }}</span>
                      de
                      <span class="font-semibold text-foreground">{{ filas().length }}</span>
                    } @else {
                      Total:
                      <span class="font-semibold text-foreground">{{
                        filasVisibles().length
                      }}</span>
                      registro{{ filasVisibles().length === 1 ? '' : 's' }}
                    }
                  </span>
                </div>
              }
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AjustesCargaMasivaDialogComponent implements OnInit {
  private readonly api = inject(ParametrizacionApi);
  private readonly toast = inject(ComisionesToast);

  readonly closed = output<void>();
  /** Emite los IDs creados (si el confirm los trae) al guardar con éxito. */
  readonly guardado = output<string[]>();

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  private readonly columnasApi = signal<PreviewColumn[]>([]);
  private readonly columnasExcel = signal<PreviewColumn[]>([]);

  protected readonly filas = signal<PreviewRow[]>([]);
  protected readonly filasError = signal<PreviewRow[]>([]);
  protected readonly cargandoColumnas = signal(false);
  protected readonly descargandoPlantilla = signal(false);
  protected readonly subiendo = signal(false);
  protected readonly validando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly arrastrando = signal(false);
  protected readonly archivoNombre = signal<string | null>(null);
  protected readonly errorExtension = signal<string | null>(null);
  protected readonly archivoValidado = signal(false);
  /** Tras errores, hay que volver a subir el Excel. */
  protected readonly requiereNuevaCarga = signal(false);
  protected readonly tooltipError = signal<{
    x: number;
    y: number;
    fila: number;
    campo?: string;
    errores: string[];
  } | null>(null);

  private archivo: File | null = null;

  protected readonly hayErrores = computed(() => this.filasError().length > 0);

  protected readonly filasVisibles = computed(() =>
    this.hayErrores() ? this.filasError() : this.filas(),
  );

  protected columnasVisibles(): PreviewColumn[] {
    const excel = this.columnasExcel();
    if (excel.length) return excel;
    return this.columnasApi();
  }

  protected mostrarZonaCarga(): boolean {
    return !this.archivo || this.requiereNuevaCarga();
  }

  protected puedeValidar(): boolean {
    return !!this.archivo && !this.subiendo() && !this.requiereNuevaCarga() && !this.archivoValidado();
  }

  protected puedeGuardar(): boolean {
    return !!this.archivo && this.archivoValidado() && !this.hayErrores();
  }

  ngOnInit(): void {
    void this.cargarColumnas();
  }

  protected cerrar(): void {
    this.closed.emit();
  }

  protected async descargarPlantilla(): Promise<void> {
    this.descargandoPlantilla.set(true);
    try {
      await this.api.descargarPlantillaAjustes();
      this.toast.ok('Descarga exitosa');
    } catch {
      this.toast.errorGenericoConMensaje('Falló la descarga del archivo');
    } finally {
      this.descargandoPlantilla.set(false);
    }
  }

  protected abrirExplorador(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.procesarArchivo(file);
  }

  protected onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.arrastrando.set(true);
  }

  protected onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.arrastrando.set(false);
  }

  protected onDrop(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.arrastrando.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (file) void this.procesarArchivo(file);
  }

  protected eliminarArchivo(): void {
    this.resetEstadoArchivo();
    this.filas.set([]);
    this.filasError.set([]);
    this.columnasExcel.set([]);
    this.cerrarTooltipError();
  }

  protected async validarArchivo(): Promise<void> {
    if (!this.archivo) return;
    this.validando.set(true);
    try {
      const res = await this.api.validateAjustesBatch(this.archivo);
      const errores = extraerErroresValidacion(res);

      if (errores.length > 0) {
        this.mostrarErroresValidacion(errores);
        return;
      }

      this.filasError.set([]);
      this.archivoValidado.set(true);
      this.requiereNuevaCarga.set(false);
      this.toast.ok('Archivo validado exitosamente');
    } catch (e) {
      if (isApiValidationError(e)) {
        const errores = extraerErroresValidacion(e.body);
        if (errores.length > 0) {
          this.mostrarErroresValidacion(errores);
          return;
        }
      }
      this.toast.errorGenericoConMensaje('Falló la validación del archivo');
    } finally {
      this.validando.set(false);
    }
  }

  private mostrarErroresValidacion(errores: FilaErrorValidacion[]): void {
    this.aplicarErrores(errores);
    this.archivoValidado.set(false);
    this.requiereNuevaCarga.set(true);
    this.archivo = null;
    this.archivoNombre.set(null);
    this.toast.errorGenericoConMensaje('El archivo tiene errores de validación');
  }

  protected async guardarAjustes(): Promise<void> {
    if (!this.archivo || !this.puedeGuardar()) return;
    this.guardando.set(true);
    try {
      const res = await this.api.confirmAjustesBatch(this.archivo);
      const ids = extraerIdsConfirm(res);
      this.toast.ok('Ajustes guardados exitosamente');
      this.guardado.emit(ids);
      this.closed.emit();
    } catch {
      this.toast.errorGenericoConMensaje('Falló el guardado de los ajustes');
    } finally {
      this.guardando.set(false);
    }
  }

  protected textoCelda(row: PreviewRow, key: string): string {
    const v = row[key];
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    return String(v);
  }

  protected erroresDeCelda(row: PreviewRow, key: string): string[] {
    return row.__celdasError?.[key] ?? [];
  }

  protected abrirTooltipCelda(
    ev: MouseEvent,
    fila: number,
    errores: string[],
    campo?: string,
  ): void {
    if (!errores.length) return;
    this.tooltipError.set({
      x: ev.clientX + 14,
      y: ev.clientY + 14,
      fila,
      campo,
      errores,
    });
  }

  protected moverTooltipError(ev: MouseEvent): void {
    const tip = this.tooltipError();
    if (!tip) return;
    const maxX = window.innerWidth - 380;
    const maxY = window.innerHeight - 220;
    this.tooltipError.set({
      ...tip,
      x: Math.min(ev.clientX + 14, maxX),
      y: Math.min(ev.clientY + 14, maxY),
    });
  }

  protected cerrarTooltipError(): void {
    this.tooltipError.set(null);
  }

  private aplicarErrores(errores: FilaErrorValidacion[]): void {
    const columnas = this.columnasVisibles();
    const porFila = new Map(errores.map((e) => [e.row_number, e.errors]));

    const conError: PreviewRow[] = this.filas()
      .filter((f) => porFila.has(f.__rowNumber))
      .map((f) => {
        const msgs = porFila.get(f.__rowNumber) ?? [];
        const celdas: Record<string, string[]> = {};
        const sinColumna: string[] = [];

        for (const msg of msgs) {
          const campo = extraerCampoDeError(msg);
          const key = campo ? claveColumnaPorCampo(campo, columnas) : null;
          if (key) {
            (celdas[key] ??= []).push(msg);
          } else {
            sinColumna.push(msg);
          }
        }

        return {
          ...f,
          __celdasError: celdas,
          __erroresSinColumna: sinColumna,
        };
      });

    for (const e of errores) {
      if (conError.some((f) => f.__rowNumber === e.row_number)) continue;
      const celdas: Record<string, string[]> = {};
      const sinColumna: string[] = [];
      for (const msg of e.errors) {
        const campo = extraerCampoDeError(msg);
        const key = campo ? claveColumnaPorCampo(campo, columnas) : null;
        if (key) (celdas[key] ??= []).push(msg);
        else sinColumna.push(msg);
      }
      conError.push({
        __rowNumber: e.row_number,
        __celdasError: celdas,
        __erroresSinColumna: sinColumna,
      });
    }

    conError.sort((a, b) => a.__rowNumber - b.__rowNumber);
    this.filasError.set(conError);
  }

  private resetEstadoArchivo(): void {
    this.archivo = null;
    this.archivoNombre.set(null);
    this.archivoValidado.set(false);
    this.requiereNuevaCarga.set(false);
    this.errorExtension.set(null);
  }

  private async cargarColumnas(): Promise<void> {
    this.cargandoColumnas.set(true);
    try {
      const raw = await this.api.getAjustesTemplateColumns();
      this.columnasApi.set(normalizarColumnas(raw));
    } catch {
      this.columnasApi.set([]);
    } finally {
      this.cargandoColumnas.set(false);
    }
  }

  private async procesarArchivo(file: File): Promise<void> {
    this.errorExtension.set(null);

    if (!esXlsx(file)) {
      this.errorExtension.set(
        'Solo se pueden subir archivos con la extensión .xlsx.',
      );
      return;
    }

    this.subiendo.set(true);
    await esperar(600);

    try {
      const { columnas, filas } = await leerExcelCompleto(file, this.columnasApi());
      this.archivo = file;
      this.archivoNombre.set(file.name);
      this.columnasExcel.set(columnas);
      this.filas.set(filas);
      this.filasError.set([]);
      this.archivoValidado.set(false);
      this.requiereNuevaCarga.set(false);
      this.cerrarTooltipError();
      this.toast.ok('Archivo cargado exitosamente');
    } catch {
      this.resetEstadoArchivo();
      this.filas.set([]);
      this.filasError.set([]);
      this.columnasExcel.set([]);
      this.toast.errorGenericoConMensaje('Falló la carga del archivo');
    } finally {
      this.subiendo.set(false);
    }
  }
}

function esXlsx(file: File): boolean {
  return file.name.toLowerCase().endsWith('.xlsx');
}

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extraerErroresValidacion(raw: unknown): FilaErrorValidacion[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const detail =
    obj['detail'] && typeof obj['detail'] === 'object' && !Array.isArray(obj['detail'])
      ? (obj['detail'] as Record<string, unknown>)
      : null;
  const lista =
    obj['errors'] ??
    obj['Errors'] ??
    detail?.['errors'] ??
    detail?.['Errors'] ??
    (Array.isArray(obj['detail']) ? obj['detail'] : null);
  if (!Array.isArray(lista)) return [];

  return lista
    .map((item): FilaErrorValidacion | null => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const row = Number(o['row_number'] ?? o['rowNumber'] ?? o['row'] ?? 0);
      const errs = o['errors'] ?? o['messages'] ?? o['details'];
      if (!row || !Array.isArray(errs)) return null;
      return {
        row_number: row,
        errors: errs.map((e) => String(e)),
      };
    })
    .filter((e): e is FilaErrorValidacion => !!e && e.errors.length > 0);
}

/** Extrae el nombre del campo del mensaje: 'Valor prima' tiene… */
function extraerCampoDeError(mensaje: string): string | null {
  const m = mensaje
    .trim()
    .match(/^['\u2018\u2019"\u201C\u201D«»](.+?)['\u2018\u2019"\u201C\u201D«»]/);
  return m?.[1]?.trim() || null;
}

function claveColumnaPorCampo(
  campo: string,
  columnas: PreviewColumn[],
): string | null {
  const n = normalizarClave(campo);
  if (!n) return null;

  const exacta = columnas.find(
    (c) => normalizarClave(c.label) === n || normalizarClave(c.key) === n,
  );
  if (exacta) return exacta.key;

  const parcial = columnas.find((c) => {
    const nl = normalizarClave(c.label);
    return nl.includes(n) || n.includes(nl);
  });
  return parcial?.key ?? null;
}

function extraerIdsConfirm(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const lista =
    obj['items'] ??
    obj['created'] ??
    obj['records'] ??
    obj['data'] ??
    obj['ids'] ??
    [];

  if (!Array.isArray(lista)) return [];

  return lista
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item);
      if (item && typeof item === 'object') {
        const id = (item as Record<string, unknown>)['id'];
        return id !== undefined && id !== null ? String(id) : '';
      }
      return '';
    })
    .filter(Boolean);
}

/** Lee todas las filas del primer sheet (sin límite). */
async function leerExcelCompleto(
  file: File,
  columnasApi: PreviewColumn[],
): Promise<{ columnas: PreviewColumn[]; filas: PreviewRow[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { columnas: [], filas: [] };

  const sheet = workbook.Sheets[sheetName];
  const matriz = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
    sheet,
    { header: 1, defval: '', raw: false },
  );

  if (!matriz.length) return { columnas: [], filas: [] };

  const encabezados = (matriz[0] ?? []).map((h, i) => {
    const label = String(h ?? '').trim() || `Columna ${i + 1}`;
    return label;
  });

  let ultimo = encabezados.length - 1;
  while (ultimo >= 0 && !String(matriz[0]?.[ultimo] ?? '').trim()) ultimo--;
  const headers = encabezados.slice(0, ultimo + 1);

  const labelApiPorKey = new Map(
    columnasApi.map((c) => [normalizarClave(c.key), c.label]),
  );
  const labelApiPorLabel = new Map(
    columnasApi.map((c) => [normalizarClave(c.label), c.label]),
  );

  const columnas: PreviewColumn[] = headers.map((label, i) => {
    const key = `c${i}`;
    const preferido =
      labelApiPorLabel.get(normalizarClave(label)) ??
      labelApiPorKey.get(normalizarClave(label));
    return { key, label: preferido ?? label };
  });

  const filas: PreviewRow[] = [];
  for (let r = 1; r < matriz.length; r++) {
    const filaRaw = matriz[r] ?? [];
    const vacia = headers.every((_, i) => String(filaRaw[i] ?? '').trim() === '');
    if (vacia) continue;
    const row: PreviewRow = { __rowNumber: r + 1 };
    headers.forEach((_, i) => {
      row[`c${i}`] = filaRaw[i] ?? '';
    });
    filas.push(row);
  }

  return { columnas, filas };
}

function normalizarClave(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizarColumnas(raw: unknown): PreviewColumn[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map((item, i) => columnaDeItem(item, i)).filter(Boolean) as PreviewColumn[];
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const lista =
      obj['columns'] ?? obj['items'] ?? obj['data'] ?? obj['headers'] ?? obj['fields'];
    if (Array.isArray(lista)) {
      return lista.map((item, i) => columnaDeItem(item, i)).filter(Boolean) as PreviewColumn[];
    }
  }

  return [];
}

function columnaDeItem(item: unknown, index: number): PreviewColumn | null {
  if (typeof item === 'string') {
    return { key: item, label: item };
  }
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    const key = String(
      o['key'] ?? o['name'] ?? o['field'] ?? o['column'] ?? o['id'] ?? `col_${index}`,
    );
    const label = String(o['label'] ?? o['title'] ?? o['header'] ?? o['name'] ?? key);
    return { key, label };
  }
  return null;
}
