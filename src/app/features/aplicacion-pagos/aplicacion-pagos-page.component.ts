// App «Aplicación de Pagos» (Recaudos): carga del MAESTRO. El área de Calidad lo
// arma con un script de Python en local (sin alcance al backend); aquí un usuario
// lo sube, ve el resumen de la carga y el historial con sus errores. La
// identificación, conciliación y aplicación al crédito vienen en pantallas
// siguientes, sobre los pagos que entran por aquí.

import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { AplicacionPagosApi, Carga, ErrorCarga, PERM_VIEW, ResultadoCarga } from './aplicacion-pagos.api';

/** La auditoría se lee en hora de Colombia (el backend manda UTC). */
const ZONA = { timeZone: 'America/Bogota' } as const;

@Component({
  selector: 'alma-aplicacion-pagos-page',
  imports: [DecimalPipe, NgTemplateOutlet, RouterLink, LucideAngularModule, AccessDeniedComponent, AlmaLoaderComponent],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="mx-auto w-full max-w-6xl space-y-5 px-4 py-4 sm:px-6">
        <div class="flex flex-wrap items-center gap-3">
          <a routerLink="/" class="glass inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] hover:text-primary">
            <lucide-icon name="arrow-left" [size]="16" /> Inicio
          </a>
          <div>
            <h1 class="text-on-wallpaper text-2xl font-bold tracking-tight text-foreground">Aplicación de Pagos</h1>
            <p class="text-on-wallpaper text-sm text-foreground/80">Carga del MAESTRO de pagos del día.</p>
          </div>
        </div>

        <!-- Subir -->
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <label
            class="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors"
            [class]="arrastrando() ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'"
            (dragover)="$event.preventDefault(); arrastrando.set(true)"
            (dragleave)="arrastrando.set(false)"
            (drop)="soltar($event)"
          >
            <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <lucide-icon [name]="subiendo() ? 'loader-2' : 'folder-input'" [size]="22" [class.animate-spin]="subiendo()" />
            </span>
            <span class="text-sm font-semibold text-foreground">
              {{ subiendo() ? 'Cargando ' + (nombreArchivo() ?? '') + '…' : 'Arrastra el MAESTRO aquí o haz clic para elegirlo' }}
            </span>
            <span class="text-xs text-muted-foreground">
              Excel (.xlsx) con la hoja PAGOS. Si subes el mismo archivo otra vez, los registros que ya entraron no se duplican.
            </span>
            <input type="file" class="sr-only" accept=".xlsx,.xlsm" [disabled]="subiendo()" (change)="elegir($event)" />
          </label>

          @if (resultado(); as r) {
            <div class="mt-5 space-y-3">
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <lucide-icon [name]="r.errores_encontrados ? 'alert-triangle' : 'check-circle-2'" [size]="18"
                             [class]="r.errores_encontrados ? 'text-amber-600' : 'text-emerald-600'" />
                <span class="font-semibold text-foreground">{{ r.archivo }}</span>
                <span class="text-muted-foreground">· {{ r.fuente }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
                @for (k of kpis(); track k.label) {
                  <div class="rounded-xl bg-[var(--surface-sunken)] px-3 py-2" [attr.title]="k.ayuda">
                    <p class="text-[11px] text-muted-foreground">{{ k.label }}</p>
                    <p class="text-lg font-bold tabular-nums" [class]="k.clase">{{ k.valor | number }}</p>
                  </div>
                }
              </div>
              @if (r.errores.length) {
                <ng-container *ngTemplateOutlet="tablaErrores; context: { $implicit: r.errores }" />
              }
            </div>
          }
        </section>

        <!-- Historial -->
        <section class="glass overflow-hidden rounded-3xl shadow-[var(--shadow-sm)]">
          <header class="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <h2 class="text-sm font-bold text-foreground">Cargas recientes</h2>
            <button type="button" class="alma-btn alma-btn-ghost h-8 rounded-lg text-xs" [disabled]="cargando()" (click)="cargar()">
              <lucide-icon name="refresh-cw" [size]="14" [class.animate-spin]="cargando()" /> Actualizar
            </button>
          </header>
          @if (cargando() && !cargas().length) {
            <div class="flex justify-center py-10"><alma-loader [size]="56" label="Cargando…" /></div>
          } @else if (!cargas().length) {
            <p class="px-5 py-10 text-center text-sm text-muted-foreground">Todavía no se ha cargado ningún MAESTRO.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-[var(--table-header)] text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
                  <tr>
                    <th class="px-4 py-2">Fecha</th>
                    <th class="px-4 py-2">Archivo</th>
                    <th class="px-4 py-2 text-right">Leídos</th>
                    <th class="px-4 py-2 text-right">Cargados</th>
                    <th class="px-4 py-2 text-right">Ya estaban</th>
                    <th class="px-4 py-2 text-right">Por revisar</th>
                    <th class="px-4 py-2 text-right">Errores</th>
                    <th class="px-4 py-2">Cargó</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of cargas(); track c.id) {
                    <tr class="border-t border-border/50 hover:bg-accent/60" [class.cursor-pointer]="c.errores_encontrados > 0" (click)="alternar(c)">
                      <td class="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{{ fecha(c.fecha_carga) }}</td>
                      <td class="max-w-[16rem] truncate px-4 py-2 text-foreground" [title]="c.archivo">{{ c.archivo }}</td>
                      <td class="px-4 py-2 text-right tabular-nums">{{ c.registros_leidos | number }}</td>
                      <td class="px-4 py-2 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{{ c.registros_cargados | number }}</td>
                      <td class="px-4 py-2 text-right tabular-nums text-muted-foreground">{{ c.registros_omitidos | number }}</td>
                      <td class="px-4 py-2 text-right tabular-nums" [class.text-amber-600]="c.duplicados_detectados > 0">{{ c.duplicados_detectados | number }}</td>
                      <td class="px-4 py-2 text-right tabular-nums" [class.text-destructive]="c.errores_encontrados > 0">
                        {{ c.errores_encontrados | number }}
                        @if (c.errores_encontrados > 0) {
                          <lucide-icon [name]="abierta() === c.id ? 'chevron-down' : 'chevron-right'" [size]="12" class="ml-1 inline" />
                        }
                      </td>
                      <td class="px-4 py-2 text-xs text-muted-foreground">{{ c.cargado_por }}</td>
                    </tr>
                    @if (abierta() === c.id) {
                      <tr class="border-t border-border/50 bg-[var(--surface-sunken)]">
                        <td colspan="8" class="px-4 py-3">
                          @if (erroresAbiertos(); as errs) {
                            <ng-container *ngTemplateOutlet="tablaErrores; context: { $implicit: errs }" />
                          } @else {
                            <alma-loader [size]="32" label="Cargando errores…" />
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      </div>

      <ng-template #tablaErrores let-errores>
        <div class="max-h-72 overflow-auto rounded-xl border border-border/60">
          <table class="w-full text-xs">
            <thead class="sticky top-0 bg-[var(--table-header)] text-left font-semibold text-foreground/65">
              <tr><th class="px-3 py-1.5">Fila</th><th class="px-3 py-1.5">Campo</th><th class="px-3 py-1.5">Valor</th><th class="px-3 py-1.5">Motivo</th><th class="px-3 py-1.5">Origen</th></tr>
            </thead>
            <tbody>
              @for (e of errores; track $index) {
                <tr class="border-t border-border/40">
                  <td class="px-3 py-1.5 tabular-nums">{{ e.fila ?? '—' }}</td>
                  <td class="px-3 py-1.5">{{ e.campo ?? '—' }}</td>
                  <td class="max-w-[12rem] truncate px-3 py-1.5 font-mono" [title]="texto(e.valor)">{{ texto(e.valor) }}</td>
                  <td class="px-3 py-1.5">{{ e.descripcion ?? '—' }}</td>
                  <td class="px-3 py-1.5 text-muted-foreground">{{ origen(e) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </ng-template>
    }
  `,
})
export class AplicacionPagosPageComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AplicacionPagosApi);
  private readonly toast = inject(ToastService);

  protected readonly puedeVer = computed(() => this.auth.hasPermission(PERM_VIEW));

  protected readonly subiendo = signal(false);
  protected readonly arrastrando = signal(false);
  protected readonly nombreArchivo = signal<string | null>(null);
  protected readonly resultado = signal<ResultadoCarga | null>(null);

  protected readonly cargas = signal<Carga[]>([]);
  protected readonly cargando = signal(false);
  protected readonly abierta = signal<string | null>(null);
  protected readonly erroresAbiertos = signal<ErrorCarga[] | null>(null);

  protected readonly kpis = computed(() => {
    const r = this.resultado();
    if (!r) return [];
    return [
      { label: 'Leídos', valor: r.registros_leidos, clase: 'text-foreground', ayuda: 'Filas de la hoja PAGOS.' },
      { label: 'Cargados', valor: r.registros_cargados, clase: 'text-emerald-700 dark:text-emerald-400', ayuda: 'Registros nuevos que entraron.' },
      { label: 'Ya estaban', valor: r.registros_omitidos, clase: 'text-muted-foreground', ayuda: 'Su ID_Registro ya se había cargado: no se duplican.' },
      { label: 'Por revisar', valor: r.duplicados_detectados, clase: r.duplicados_detectados ? 'text-amber-600' : 'text-foreground', ayuda: 'Se parecen a otro pago (misma fecha, ciudad, valor y referencia): entran marcados para revisión.' },
      { label: 'Errores', valor: r.errores_encontrados, clase: r.errores_encontrados ? 'text-destructive' : 'text-foreground', ayuda: 'Filas que no entraron, con el motivo abajo.' },
    ];
  });

  constructor() {
    if (this.puedeVer()) void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.cargas.set(await this.api.listarCargas());
    } catch (e) {
      this.toast.error('No se pudieron cargar las cargas', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected elegir(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo
    if (archivo) void this.subir(archivo);
  }

  protected soltar(ev: DragEvent): void {
    ev.preventDefault();
    this.arrastrando.set(false);
    const archivo = ev.dataTransfer?.files?.[0];
    if (archivo) void this.subir(archivo);
  }

  private async subir(archivo: File): Promise<void> {
    if (!/\.xls[xm]$/i.test(archivo.name)) {
      this.toast.error('Archivo no válido', 'Sube el MAESTRO en Excel (.xlsx).');
      return;
    }
    this.subiendo.set(true);
    this.nombreArchivo.set(archivo.name);
    this.resultado.set(null);
    try {
      const r = await this.api.subirMaestro(archivo);
      this.resultado.set(r);
      this.toast.show(
        'MAESTRO cargado',
        `${r.registros_cargados} nuevos · ${r.registros_omitidos} ya estaban · ${r.errores_encontrados} con error`,
      );
      await this.cargar();
    } catch (e) {
      this.toast.error('No se pudo cargar el MAESTRO', e instanceof Error ? e.message : String(e));
    } finally {
      this.subiendo.set(false);
    }
  }

  protected async alternar(c: Carga): Promise<void> {
    if (!c.errores_encontrados) return;
    if (this.abierta() === c.id) {
      this.abierta.set(null);
      return;
    }
    this.abierta.set(c.id);
    this.erroresAbiertos.set(null);
    try {
      this.erroresAbiertos.set(await this.api.erroresDeCarga(c.id));
    } catch (e) {
      this.toast.error('No se pudieron cargar los errores', e instanceof Error ? e.message : String(e));
      this.abierta.set(null);
    }
  }

  protected fecha(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleString('es-CO', { ...ZONA, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  protected texto(v: unknown): string {
    return v === null || v === undefined || v === '' ? '—' : String(v);
  }

  protected origen(e: ErrorCarga): string {
    return e.tipo?.startsWith('script:') ? 'Script de Calidad' : 'Validación de Alma';
  }
}
