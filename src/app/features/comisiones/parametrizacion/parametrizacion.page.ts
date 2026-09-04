// Parametrización del Motor de Comisiones: pestañas que agrupan secciones, cada una
// con su búsqueda, su tabla y sus diálogos de crear/editar/eliminar.

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { AccessDeniedComponent } from '../../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../../shared/components/alma-loader.component';
import { CommissionPlansApi } from '../planes/commission-plans.api';
import {
  ParamField,
  ParamFormDialogComponent,
  ParamValues,
} from './param-form-dialog.component';
import { ParamRow, ParamTableComponent } from './param-table.component';
import { FormCtx, SECCIONES, SeccionSpec, VISTAS } from './param-specs';
import {
  ACCOUNTING_CATEGORY_LABELS,
  AccountingCategory,
  CATEGORIES,
} from './parametrizacion.domain';
import { ParametrizacionStore, SeccionId } from './parametrizacion.store';

@Component({
  selector: 'alma-parametrizacion-page',
  providers: [ParametrizacionStore],
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    AccessDeniedComponent,
    AlmaLoaderComponent,
    ParamTableComponent,
    ParamFormDialogComponent,
  ],
  template: `
    @if (!tieneAcceso()) {
      <alma-access-denied />
    } @else {
      <div class="w-full max-w-full space-y-4 overflow-x-hidden px-4 py-4 lg:overflow-visible">
        <div class="flex items-center gap-3">
          <a
            routerLink="/apps/motor-comisiones"
            class="alma-btn shrink-0 gap-2 px-3 text-muted-foreground hover:text-foreground"
          >
            <lucide-icon name="arrow-left" [size]="16" />
            <span class="hidden sm:inline">Volver</span>
          </a>
          <h1 class="truncate text-lg font-bold tracking-tight sm:text-xl">Parametrización</h1>
        </div>

        <!-- Pestañas: selector en móvil, pills en escritorio -->
        <select
          class="alma-input cursor-pointer lg:hidden"
          [ngModel]="vista()"
          (ngModelChange)="cambiarVista($event)"
        >
          @for (v of vistas; track v.value) {
            <option [value]="v.value">{{ v.label }}</option>
          }
        </select>

        <div
          class="glass hidden w-fit gap-1 rounded-full bg-[var(--surface-sunken)] p-1 lg:inline-flex"
        >
          @for (v of vistas; track v.value) {
            <button
              type="button"
              (click)="cambiarVista(v.value)"
              class="cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-all"
              [class]="
                vista() === v.value
                  ? 'bg-card text-foreground shadow-[var(--shadow-sm)]'
                  : 'text-muted-foreground hover:text-foreground'
              "
            >
              {{ v.label }}
            </button>
          }
        </div>

        <!-- Secciones de la pestaña activa -->
        @for (id of seccionesVisibles(); track id) {
          @let spec = seccion(id);
          <div class="space-y-3 pt-2">
            <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 class="text-base font-bold">{{ spec.titulo }}</h2>
                @if (spec.subtitulo) {
                  <p class="text-xs text-muted-foreground">{{ spec.subtitulo }}</p>
                }
              </div>
              @if (spec.botonCrear) {
                <button
                  type="button"
                  (click)="abrirCrear(id)"
                  class="alma-btn alma-btn-primary h-10 shrink-0 rounded-xl px-4"
                >
                  <lucide-icon name="plus" [size]="16" class="mr-2" />
                  {{ spec.botonCrear }}
                </button>
              }
            </div>

            <!-- Búsqueda y rango de fechas -->
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div class="relative flex w-full items-center sm:max-w-md">
                <span class="pointer-events-none absolute left-3 z-20 flex items-center">
                  <lucide-icon name="search" [size]="16" class="text-muted-foreground" />
                </span>
                <input
                  class="alma-input pl-10"
                  [placeholder]="spec.placeholderBusqueda"
                  [ngModel]="busqueda()[id] || ''"
                  (ngModelChange)="setBusqueda(id, $event)"
                />
              </div>

              @if (spec.conRangoFechas) {
                <div class="flex items-center gap-2">
                  <input type="date" class="alma-input h-10 w-[150px]" [(ngModel)]="desde" />
                  <span class="text-xs text-muted-foreground">a</span>
                  <input type="date" class="alma-input h-10 w-[150px]" [(ngModel)]="hasta" />
                  <button
                    type="button"
                    (click)="consultarRango()"
                    [disabled]="!desde || !hasta || store.loading()[id]"
                    class="alma-btn alma-btn-primary h-10 rounded-lg px-4"
                  >
                    Consultar
                  </button>
                </div>
              }

              @if (busqueda()[id]) {
                <button
                  type="button"
                  (click)="limpiar(id)"
                  title="Limpiar filtros"
                  class="alma-btn alma-btn-outline h-10 shrink-0 text-muted-foreground"
                >
                  <lucide-icon name="x" [size]="16" class="mr-2" />
                  Limpiar
                </button>
              }
            </div>

            <!-- Sub-pestañas por compañía -->
            @if (spec.porCategoria) {
              <div class="flex flex-wrap gap-2">
                @for (c of categorias; track c) {
                  <button
                    type="button"
                    (click)="setCategoria(id, c)"
                    class="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all"
                    [class]="
                      categoria(id) === c
                        ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent'
                    "
                  >
                    {{ etiquetaCategoria(c) }}
                    <span
                      class="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      [class]="
                        categoria(id) === c
                          ? 'bg-white/25 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      "
                    >
                      {{ conteo(id, c) }}
                    </span>
                  </button>
                }
              </div>
            }

            @if (store.loading()[id]) {
              <div class="flex items-center justify-center py-16">
                <alma-loader [size]="72" label="Cargando registros…" />
              </div>
            } @else {
              @if (id === 'casosEspeciales' && store.errorCasosEspeciales()) {
                <div
                  class="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  No se pudo consultar la API de casos especiales. Revisa la consola para
                  validar la respuesta del servicio.
                </div>
              }
              @if (id === 'exclusionContratos' && store.errorExclusionContratos()) {
                <div
                  class="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  No se pudo consultar la API de exclusión de contratos. Revisa la consola
                  para validar la respuesta del servicio.
                </div>
              }
              <alma-param-table
                [columns]="spec.columnas"
                [rows]="filas(id)"
                [page]="pagina(id)"
                [itemsPerPage]="porPagina(id)"
                [conAcciones]="!spec.soloLectura"
                [anchoMinimo]="spec.anchoMinimo"
                (pageChange)="setPagina(id, $event)"
                (itemsPerPageChange)="setPorPagina(id, $event)"
                (editar)="abrirEditar(id, $event)"
                (eliminar)="porBorrar.set({ seccion: id, row: $event })"
                (alternar)="alternar(id, $event.row, $event.activo)"
              />
            }
          </div>
        }
      </div>

      <!-- Formulario -->
      @if (formulario(); as f) {
        <alma-param-form-dialog
          [titulo]="f.titulo"
          [descripcion]="f.descripcion"
          [fields]="f.campos"
          [valores]="f.valores"
          [columnas]="f.columnas"
          [ancho]="f.ancho"
          [textoGuardar]="f.editando ? 'Guardar Cambios' : 'Crear Registro'"
          [derivar]="f.derivar"
          [validarExtra]="f.validar"
          (guardar)="guardarFormulario($event)"
          (closed)="formulario.set(null)"
        />
      }

      <!-- Confirmación de borrado -->
      @if (porBorrar(); as sel) {
        <div
          class="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          (click)="porBorrar.set(null)"
        >
          <div
            class="surface-solid w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-lg font-bold">¿Estás seguro?</h2>
            <p class="mt-2 text-sm text-muted-foreground">
              Esto eliminará permanentemente el registro. Esta acción no se puede deshacer.
            </p>
            <div class="mt-6 flex justify-end gap-2">
              <button
                type="button"
                (click)="porBorrar.set(null)"
                class="alma-btn alma-btn-outline"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmarBorrado(sel.seccion, sel.row)"
                [disabled]="borrando()"
                class="alma-btn bg-destructive text-white hover:bg-destructive/90"
              >
                {{ borrando() ? 'Eliminando…' : 'Eliminar' }}
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class ParametrizacionPageComponent implements OnInit {
  protected readonly store = inject(ParametrizacionStore);
  private readonly auth = inject(AuthService);
  private readonly planesApi = inject(CommissionPlansApi);

  protected readonly vistas = VISTAS;
  protected readonly categorias = CATEGORIES;

  protected readonly vista = signal('contabilidad');
  protected readonly busqueda = signal<Record<string, string>>({});
  protected readonly categoriaPorSeccion = signal<Record<string, AccountingCategory>>({});
  protected readonly paginas = signal<Record<string, number>>({});
  protected readonly tamanos = signal<Record<string, number>>({});
  protected readonly borrando = signal(false);

  protected desde = '';
  protected hasta = '';

  protected readonly porBorrar = signal<{ seccion: SeccionId; row: ParamRow } | null>(null);
  protected readonly formulario = signal<{
    seccion: SeccionId;
    editando: ParamRow | null;
    titulo: string;
    descripcion: string;
    campos: ParamField[];
    valores: ParamValues;
    columnas: 2 | 3;
    ancho: string;
    derivar: (key: string, v: ParamValues) => ParamValues;
    validar: (v: ParamValues) => Record<string, string>;
  } | null>(null);

  /** Planes publicados: los selectores de tipo de comisión y regla los usan. */
  private readonly planes = signal<{ id: string; name: string }[]>([]);

  protected readonly tieneAcceso = computed(() =>
    this.auth.hasPermission('app.motor-comisiones.view'),
  );

  protected readonly seccionesVisibles = computed(
    () => VISTAS.find((v) => v.value === this.vista())?.secciones ?? [],
  );

  ngOnInit(): void {
    this.store.cargarPestana(this.vista());
    void this.cargarPlanes();
  }

  private async cargarPlanes(): Promise<void> {
    try {
      const res = await this.planesApi.list(1, 200, 'published');
      this.planes.set(res.items.map((p) => ({ id: p.id, name: p.name })));
    } catch (e) {
      console.error('No se pudieron cargar los planes publicados:', e);
    }
  }

  protected seccion(id: SeccionId): SeccionSpec {
    return SECCIONES[id];
  }

  protected etiquetaCategoria(c: AccountingCategory): string {
    return ACCOUNTING_CATEGORY_LABELS[c];
  }

  protected cambiarVista(v: string): void {
    this.vista.set(v);
    this.store.cargarPestana(v);
  }

  protected categoria(id: SeccionId): AccountingCategory {
    return this.categoriaPorSeccion()[id] ?? 'seguros';
  }

  protected setCategoria(id: SeccionId, c: AccountingCategory): void {
    this.categoriaPorSeccion.update((prev) => ({ ...prev, [id]: c }));
    this.setPagina(id, 1);
  }

  protected setBusqueda(id: SeccionId, texto: string): void {
    this.busqueda.update((prev) => ({ ...prev, [id]: texto }));
    this.setPagina(id, 1);
  }

  protected limpiar(id: SeccionId): void {
    this.busqueda.update((prev) => ({ ...prev, [id]: '' }));
    this.setPagina(id, 1);
  }

  private claveEstado(id: SeccionId): string {
    const spec = this.seccion(id);
    return spec.porCategoria ? `${id}:${this.categoria(id)}` : id;
  }

  protected pagina(id: SeccionId): number {
    return this.paginas()[this.claveEstado(id)] ?? 1;
  }

  protected setPagina(id: SeccionId, p: number): void {
    this.paginas.update((prev) => ({ ...prev, [this.claveEstado(id)]: p }));
  }

  protected porPagina(id: SeccionId): number {
    return this.tamanos()[this.claveEstado(id)] ?? 20;
  }

  protected setPorPagina(id: SeccionId, n: number): void {
    this.tamanos.update((prev) => ({ ...prev, [this.claveEstado(id)]: n }));
    this.setPagina(id, 1);
  }

  /** Filas de la sección: categoría activa + búsqueda libre. */
  protected filas(id: SeccionId): ParamRow[] {
    const spec = this.seccion(id);
    let filas = this.store.datos(id) as ParamRow[];
    if (spec.porCategoria) {
      const c = this.categoria(id);
      filas = filas.filter((r) => r['category'] === c);
    }
    const q = (this.busqueda()[id] ?? '').trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((r) =>
      spec
        .buscarEn(r)
        .some((v) => String(v ?? '').toLowerCase().includes(q)),
    );
  }

  /** Badge de la sub-pestaña: contabilidad respeta la búsqueda; tipos, no. */
  protected conteo(id: SeccionId, c: AccountingCategory): number {
    const spec = this.seccion(id);
    const filas = (this.store.datos(id) as ParamRow[]).filter((r) => r['category'] === c);
    if (id !== 'contabilidad') return filas.length;
    const q = (this.busqueda()[id] ?? '').trim().toLowerCase();
    if (!q) return filas.length;
    return filas.filter((r) =>
      spec.buscarEn(r).some((v) => String(v ?? '').toLowerCase().includes(q)),
    ).length;
  }

  protected consultarRango(): void {
    if (!this.desde || !this.hasta) return;
    void this.store.cargarDiferidos(this.desde, this.hasta);
  }

  // ── Formulario ────────────────────────────────────────────────────────────

  private ctx(id: SeccionId): FormCtx {
    return { categoria: this.categoria(id), planes: this.planes() };
  }

  protected abrirCrear(id: SeccionId): void {
    const spec = this.seccion(id);
    if (!spec.campos || !spec.aFormulario) return;
    const ctx = this.ctx(id);
    this.formulario.set({
      seccion: id,
      editando: null,
      titulo: spec.tituloCrear ?? 'Crear registro',
      descripcion: spec.descCrear ?? '',
      campos: spec.campos(ctx),
      valores: spec.aFormulario(null, ctx),
      columnas: spec.formColumnas ?? 2,
      ancho: spec.formAncho ?? '640px',
      derivar: (key, v) => (spec.derivar ? spec.derivar(key, v, ctx) : v),
      validar: (v) => (spec.validar ? spec.validar(v) : {}),
    });
  }

  protected abrirEditar(id: SeccionId, row: ParamRow): void {
    const spec = this.seccion(id);
    if (!spec.campos || !spec.aFormulario) return;
    const ctx = this.ctx(id);
    this.formulario.set({
      seccion: id,
      editando: row,
      titulo: spec.tituloEditar ?? 'Editar registro',
      descripcion: spec.descEditar ? spec.descEditar(row) : '',
      campos: spec.campos(ctx),
      valores: spec.aFormulario(row, ctx),
      columnas: spec.formColumnas ?? 2,
      ancho: spec.formAncho ?? '640px',
      derivar: (key, v) => (spec.derivar ? spec.derivar(key, v, ctx) : v),
      validar: (v) => (spec.validar ? spec.validar(v) : {}),
    });
  }

  protected async guardarFormulario(valores: ParamValues): Promise<void> {
    const f = this.formulario();
    if (!f) return;
    const spec = this.seccion(f.seccion);
    if (!spec.aRegistro) return;
    const datos = spec.aRegistro(valores, this.ctx(f.seccion));

    const ok = f.editando
      ? await this.store.actualizar(f.seccion, String(f.editando['id']), datos)
      : await this.store.crear(f.seccion, datos);
    if (ok) this.formulario.set(null);
  }

  protected async confirmarBorrado(seccion: SeccionId, row: ParamRow): Promise<void> {
    this.borrando.set(true);
    try {
      if (await this.store.eliminar(seccion, String(row['id']))) this.porBorrar.set(null);
    } finally {
      this.borrando.set(false);
    }
  }

  protected alternar(seccion: SeccionId, row: ParamRow, activo: boolean): void {
    void this.store.alternar(seccion, String(row['id']), activo);
  }
}
