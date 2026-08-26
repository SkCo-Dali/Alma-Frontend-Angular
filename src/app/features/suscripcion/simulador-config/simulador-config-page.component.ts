// Página "Configuración del Simulador de asegurabilidad" (permiso
// app.suscripcion.simulador.config). Mismo patrón que la config del motor: grupos que
// entrega el backend, dirty-tracking contra el snapshot original, confirmación con lista
// de cambios + comentario, e historial de auditoría. Cambian los editores: catálogos
// (tabla buscable), segmentos de IMC, matriz de exámenes y paquetes.

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent, SkInputComponent, SkTextareaComponent } from '@skandia/ui';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { AccessDeniedComponent } from '../../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../../shared/components/alma-loader.component';
import { HistorialCambiosComponent } from '../motor-config/historial-cambios.component';
import {
  CatalogoEditorComponent,
  ListaTextoEditorComponent,
  MatrizEditorComponent,
  PaquetesEditorComponent,
  SegmentosEditorComponent,
} from './editores.component';
import {
  GrupoSimConfig,
  ItemCatalogo,
  ParametroSimConfig,
  SegmentoImc,
  SimLogItem,
  SimuladorConfigApiService,
  TipoParametroSim,
  ValorParametroSim,
} from './simulador-config.api';

const GRUPO_ICONO: Record<string, string> = {
  generales: 'sliders-horizontal',
  imc: 'activity',
  catalogos: 'list-checks',
  examenes: 'flask-conical',
};

const keyOf = (ambito: string, clave: string) => `${ambito}::${clave}`;

const sameValor = (a: ValorParametroSim, b: ValorParametroSim): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** Valor compacto para la lista de confirmación. */
function fmtValor(tipo: TipoParametroSim, v: ValorParametroSim): string {
  if (tipo === 'catalogo') return `${(v as ItemCatalogo[]).length} ítems`;
  if (tipo === 'segmentos') return `${(v as SegmentoImc[]).length} segmentos`;
  if (tipo === 'matriz') return `${(v as unknown[]).length} filas`;
  if (tipo === 'paquetes')
    return `${Object.keys(v as Record<string, string[]>).length} paquetes`;
  if (tipo === 'lista_texto') return `${(v as string[]).length} textos`;
  if (tipo === 'texto') {
    const t = v as string;
    return t.length > 40 ? `${t.slice(0, 40)}…` : t;
  }
  const n = v as number;
  return Number.isFinite(n) ? n.toLocaleString('es-CO') : '—';
}

/** Diff legible de catálogos (+altas, −bajas, ~ediciones). */
function detalleCambio(
  tipo: TipoParametroSim,
  antes: ValorParametroSim,
  despues: ValorParametroSim,
): string | null {
  if (tipo !== 'catalogo') return null;
  const a = antes as ItemCatalogo[];
  const d = despues as ItemCatalogo[];
  const mapaA = new Map(a.map((x) => [x.nombre.toLowerCase(), x]));
  const mapaD = new Map(d.map((x) => [x.nombre.toLowerCase(), x]));
  const partes: string[] = [];
  for (const [k, x] of mapaD) if (!mapaA.has(k)) partes.push(`+${x.nombre}`);
  for (const [k, x] of mapaA) if (!mapaD.has(k)) partes.push(`−${x.nombre}`);
  for (const [k, x] of mapaD) {
    const prev = mapaA.get(k);
    if (prev && (prev.resultado !== x.resultado || prev.requisito !== x.requisito))
      partes.push(`~${x.nombre}`);
  }
  return partes.length
    ? partes.slice(0, 12).join(', ') + (partes.length > 12 ? '…' : '')
    : null;
}

interface CambioUI {
  ambito: string;
  clave: string;
  valor: ValorParametroSim;
  tituloGrupo: string;
  etiqueta: string;
  tipo: TipoParametroSim;
  detalle: string | null;
  antesTxt: string;
  despuesTxt: string;
}

interface ParamVista {
  param: ParametroSimConfig;
  etiqueta: string;
  valor: ValorParametroSim;
  dirty: boolean;
  invalido: boolean;
}

interface GrupoVista {
  grupo: GrupoSimConfig;
  icono: string;
  numericos: ParamVista[];
  otros: ParamVista[];
}

@Component({
  selector: 'alma-simulador-config-page',
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    AccessDeniedComponent,
    AlmaLoaderComponent,
    SkButtonComponent,
    SkInputComponent,
    SkTextareaComponent,
    HistorialCambiosComponent,
    ListaTextoEditorComponent,
    SegmentosEditorComponent,
    CatalogoEditorComponent,
    MatrizEditorComponent,
    PaquetesEditorComponent,
  ],
  template: `
    @if (!puedeConfigurar()) {
      <alma-access-denied />
    } @else if (cargando()) {
      <div class="flex flex-col items-center gap-4 p-16">
        <alma-loader [size]="90" />
        <p class="text-sm text-muted-foreground">Cargando configuración del simulador…</p>
      </div>
    } @else if (errorCarga(); as err) {
      <div
        class="mx-auto max-w-lg rounded-xl border-2 border-dashed border-border/50 bg-muted/20 p-12 text-center"
      >
        <p class="text-lg font-medium text-foreground">
          No fue posible cargar la configuración
        </p>
        <p class="mt-1 text-sm text-muted-foreground">{{ err }}</p>
        <div class="mt-4 flex justify-center gap-2">
          <sk-button variant="secondary" type="button" label="Volver" (clicked)="volver()" />
          <sk-button
            variant="secondary"
            type="button"
            label="Reintentar"
            (clicked)="cargar()"
          />
        </div>
      </div>
    } @else {
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div class="flex items-center gap-3">
          <a
            routerLink="/apps/suscripcion"
            class="flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <lucide-icon name="arrow-left" [size]="16" />
            Suscripción de Seguros
          </a>
        </div>

        <div>
          <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Configuración del Simulador de asegurabilidad
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tablas de IMC, catálogos de evaluación, exámenes médicos y textos del
            simulador: edítalos sin depender de despliegues.
          </p>
        </div>

        <div
          class="flex items-start gap-2 rounded-xl border border-sky-200/60 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
        >
          <lucide-icon name="info" [size]="14" class="mt-0.5 shrink-0" />
          Los cambios rigen de inmediato para las simulaciones nuevas (panel y
          pre-análisis del worker). Todo cambio queda en el historial con usuario y
          comentario.
        </div>

        @for (g of gruposVista(); track g.grupo.ambito) {
          <div class="glass rounded-2xl p-4 shadow-[var(--shadow-sm)]">
            <div class="mb-3 flex items-center gap-2">
              <lucide-icon [name]="g.icono" [size]="14" class="text-muted-foreground" />
              <p
                class="text-[10px] font-semibold uppercase tracking-wider text-foreground/65"
              >
                {{ g.grupo.titulo }}
              </p>
            </div>

            @if (g.numericos.length > 0) {
              <div class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                @for (p of g.numericos; track p.param.clave) {
                  <div class="min-w-0">
                    <div class="mb-2">
                      <p
                        class="flex items-center gap-1.5 text-sm font-medium text-foreground"
                      >
                        {{ p.etiqueta }}
                        @if (p.dirty) {
                          <span
                            class="h-1.5 w-1.5 rounded-full bg-amber-500"
                            title="Cambio sin guardar"
                          ></span>
                        }
                      </p>
                      @if (p.param.descripcion) {
                        <p class="text-xs text-muted-foreground">
                          {{ p.param.descripcion }}
                        </p>
                      }
                    </div>
                    <sk-input
                      type="number"
                      [ngModel]="p.valor"
                      (ngModelChange)="cambiarNumero(g.grupo, p.param, $event)"
                      [invalid]="p.invalido"
                      fluid
                    />
                  </div>
                }
              </div>
            }

            @for (p of g.otros; track p.param.clave) {
              <div [class.mt-4]="g.numericos.length > 0 || !$first">
                <div class="mb-2">
                  <p class="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    {{ p.etiqueta }}
                    @if (p.dirty) {
                      <span
                        class="h-1.5 w-1.5 rounded-full bg-amber-500"
                        title="Cambio sin guardar"
                      ></span>
                    }
                  </p>
                  @if (p.param.descripcion) {
                    <p class="text-xs text-muted-foreground">{{ p.param.descripcion }}</p>
                  }
                </div>

                @switch (p.param.tipo) {
                  @case ('texto') {
                    <sk-textarea
                      [ngModel]="$any(p.valor)"
                      (ngModelChange)="setValor(g.grupo, p.param, $event)"
                      fluid
                    />
                  }
                  @case ('lista_texto') {
                    <alma-lista-texto-editor
                      [value]="$any(p.valor)"
                      (valueChange)="setValor(g.grupo, p.param, $event)"
                    />
                  }
                  @case ('segmentos') {
                    <alma-segmentos-editor
                      [value]="$any(p.valor)"
                      (valueChange)="setValor(g.grupo, p.param, $event)"
                    />
                  }
                  @case ('catalogo') {
                    <alma-catalogo-editor
                      [value]="$any(p.valor)"
                      (valueChange)="setValor(g.grupo, p.param, $event)"
                    />
                  }
                  @case ('matriz') {
                    <alma-matriz-editor
                      [value]="$any(p.valor)"
                      (valueChange)="setValor(g.grupo, p.param, $event)"
                    />
                  }
                  @case ('paquetes') {
                    <alma-paquetes-editor
                      [value]="$any(p.valor)"
                      (valueChange)="setValor(g.grupo, p.param, $event)"
                    />
                  }
                }
              </div>
            }
          </div>
        }

        <alma-historial-cambios
          [log]="$any(log())"
          [cargando]="cargandoLog()"
          [error]="errorLog()"
          [ambitoTitulo]="ambitoTituloFn"
          [etiquetaDe]="etiquetaDeFn"
        />

        @if (cambios().length > 0) {
          <div class="sticky bottom-2 z-30">
            <div
              class="surface-solid flex flex-col gap-2 rounded-2xl border border-border px-4 py-3 shadow-[var(--shadow-lg)]"
            >
              <div class="flex flex-wrap items-center gap-3">
                <p class="text-sm font-semibold text-foreground">
                  {{ cambios().length }}
                  {{ cambios().length === 1 ? 'cambio sin guardar' : 'cambios sin guardar' }}
                </p>
                <div class="ml-auto flex items-center gap-2">
                  <sk-button
                    variant="tertiary"
                    type="button"
                    size="small"
                    icon="undo"
                    label="Descartar"
                    (clicked)="descartar()"
                  />
                  <sk-button
                    variant="primary"
                    type="button"
                    size="small"
                    label="Guardar cambios"
                    [disabled]="errores().length > 0"
                    (clicked)="confirmOpen.set(true)"
                  />
                </div>
              </div>
              @if (errores().length > 0) {
                <ul class="space-y-1">
                  @for (e of errores(); track $index) {
                    <li class="flex items-start gap-1.5 text-xs text-destructive">
                      <lucide-icon
                        name="alert-triangle"
                        [size]="14"
                        class="mt-0.5 shrink-0"
                      />
                      {{ e }}
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        }

        @if (confirmOpen()) {
          <div
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            (click)="!guardando() && confirmOpen.set(false)"
          >
            <div
              class="surface-solid w-full max-w-lg rounded-2xl border border-border p-5 shadow-2xl"
              (click)="$event.stopPropagation()"
            >
              <h2 class="text-base font-bold">Confirmar cambios del simulador</h2>
              <p class="mt-1 text-sm text-muted-foreground">
                Se aplicarán {{ cambios().length }}
                {{ cambios().length === 1 ? 'cambio' : 'cambios' }}. Rigen de inmediato
                para las simulaciones nuevas.
              </p>

              <ul
                class="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-3"
              >
                @for (c of cambios(); track c.ambito + '::' + c.clave) {
                  <li class="text-xs">
                    <span class="text-muted-foreground">{{ c.tituloGrupo }} · </span>
                    <span class="font-semibold text-foreground">{{ c.etiqueta }}</span>
                    <span class="text-muted-foreground">
                      : {{ c.antesTxt }} → {{ c.despuesTxt }}
                    </span>
                    @if (c.detalle) {
                      <p class="mt-0.5 break-words text-[11px] text-muted-foreground">
                        {{ c.detalle }}
                      </p>
                    }
                  </li>
                }
              </ul>

              <div class="mt-3">
                <sk-textarea
                  label="Comentario (opcional)"
                  [(ngModel)]="comentario"
                  placeholder="Por qué se hace este cambio (queda en el historial)…"
                  fluid
                />
              </div>

              <div class="mt-4 flex justify-end gap-2">
                <sk-button
                  variant="secondary"
                  type="button"
                  label="Cancelar"
                  [disabled]="guardando()"
                  (clicked)="confirmOpen.set(false)"
                />
                <sk-button
                  variant="primary"
                  type="button"
                  label="Guardar cambios"
                  [loading]="guardando()"
                  [disabled]="guardando()"
                  (clicked)="guardar()"
                />
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class SimuladorConfigPageComponent {
  private readonly api = inject(SimuladorConfigApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected volver(): void {
    this.router.navigateByUrl('/apps/suscripcion');
  }

  protected readonly puedeConfigurar = computed(() =>
    this.auth.hasPermission('app.suscripcion.simulador.config'),
  );

  protected readonly grupos = signal<GrupoSimConfig[]>([]);
  protected readonly log = signal<SimLogItem[]>([]);
  protected readonly cargando = signal(true);
  protected readonly cargandoLog = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly errorLog = signal(false);
  protected readonly guardando = signal(false);
  protected readonly confirmOpen = signal(false);
  protected comentario = '';

  private readonly edits = signal<Record<string, ValorParametroSim>>({});

  protected readonly ambitoTituloFn = (ambito: string): string =>
    this.grupos().find((g) => g.ambito === ambito)?.titulo ?? ambito;

  protected readonly etiquetaDeFn = (ambito: string, clave: string): string => {
    const p = this.grupos()
      .find((g) => g.ambito === ambito)
      ?.parametros.find((x) => x.clave === clave);
    return p?.etiqueta || clave;
  };

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      const cfg = await this.api.getConfig();
      this.grupos.set(cfg.grupos);
      this.edits.set({});
    } catch (e) {
      this.errorCarga.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
    try {
      this.log.set(await this.api.getLog(100));
    } catch {
      this.errorLog.set(true);
    } finally {
      this.cargandoLog.set(false);
    }
  }

  private valorActual(g: GrupoSimConfig, p: ParametroSimConfig): ValorParametroSim {
    const e = this.edits()[keyOf(g.ambito, p.clave)];
    return e !== undefined ? e : p.valor;
  }

  private esDirty(g: GrupoSimConfig, p: ParametroSimConfig): boolean {
    const e = this.edits()[keyOf(g.ambito, p.clave)];
    return e !== undefined && !sameValor(e, p.valor);
  }

  protected readonly gruposVista = computed<GrupoVista[]>(() =>
    this.grupos().map((grupo) => {
      const vista = (p: ParametroSimConfig): ParamVista => {
        const valor = this.valorActual(grupo, p);
        const numerico = p.tipo === 'numero' || p.tipo === 'entero';
        const n = valor as number;
        return {
          param: p,
          etiqueta: p.etiqueta || p.clave,
          valor,
          dirty: this.esDirty(grupo, p),
          invalido: numerico && (!Number.isFinite(n) || n <= 0),
        };
      };
      return {
        grupo,
        icono: GRUPO_ICONO[grupo.ambito] || 'sliders-horizontal',
        numericos: grupo.parametros
          .filter((p) => p.tipo === 'numero' || p.tipo === 'entero')
          .map(vista),
        otros: grupo.parametros
          .filter((p) => p.tipo !== 'numero' && p.tipo !== 'entero')
          .map(vista),
      };
    }),
  );

  protected readonly cambios = computed<CambioUI[]>(() => {
    const out: CambioUI[] = [];
    for (const g of this.grupos()) {
      for (const p of g.parametros) {
        const editado = this.edits()[keyOf(g.ambito, p.clave)];
        if (editado !== undefined && !sameValor(editado, p.valor)) {
          out.push({
            ambito: g.ambito,
            clave: p.clave,
            valor: editado,
            tituloGrupo: g.titulo,
            etiqueta: p.etiqueta || p.clave,
            tipo: p.tipo,
            detalle: detalleCambio(p.tipo, p.valor, editado),
            antesTxt: fmtValor(p.tipo, p.valor),
            despuesTxt: fmtValor(p.tipo, editado),
          });
        }
      }
    }
    return out;
  });

  /** Validaciones de cliente (el backend re-valida tipo + coherencia). */
  protected readonly errores = computed<string[]>(() => {
    const errs: string[] = [];
    for (const g of this.grupos()) {
      for (const p of g.parametros) {
        const etiqueta = `${g.titulo} · ${p.etiqueta || p.clave}`;
        const v = this.valorActual(g, p);
        if (p.tipo === 'numero' || p.tipo === 'entero') {
          const n = v as number;
          if (!Number.isFinite(n) || n <= 0)
            errs.push(`${etiqueta}: debe ser un número mayor que 0.`);
        } else if (p.tipo === 'texto') {
          if (!String(v ?? '').trim())
            errs.push(`${etiqueta}: el texto no puede quedar vacío.`);
        } else if (p.tipo === 'lista_texto') {
          if ((v as string[]).length === 0)
            errs.push(`${etiqueta}: la lista no puede quedar vacía.`);
        } else if (p.tipo === 'catalogo') {
          const items = v as ItemCatalogo[];
          if (items.length === 0)
            errs.push(`${etiqueta}: el catálogo no puede quedar vacío.`);
          if (items.some((x) => !x.nombre.trim()))
            errs.push(`${etiqueta}: hay ítems sin nombre.`);
          const nombres = items.map((x) => x.nombre.trim().toLowerCase());
          if (new Set(nombres).size !== nombres.length)
            errs.push(`${etiqueta}: hay nombres duplicados.`);
        } else if (p.tipo === 'segmentos') {
          const segs = [...(v as SegmentoImc[])].sort((x, y) => x.desde - y.desde);
          if (segs.length === 0) errs.push(`${etiqueta}: debe haber al menos un segmento.`);
          for (let i = 0; i < segs.length; i++) {
            if (segs[i].desde > segs[i].hasta) {
              errs.push(`${etiqueta}: segmento ${segs[i].desde}–${segs[i].hasta} invertido.`);
              break;
            }
            if (i > 0 && segs[i].desde !== segs[i - 1].hasta + 1) {
              errs.push(
                `${etiqueta}: los segmentos deben ser contiguos (revisa ${segs[i - 1].hasta} → ${segs[i].desde}).`,
              );
              break;
            }
          }
        }
      }
    }
    return errs;
  });

  protected setValor(
    g: GrupoSimConfig,
    p: ParametroSimConfig,
    v: ValorParametroSim,
  ): void {
    this.edits.update((prev) => {
      const k = keyOf(g.ambito, p.clave);
      if (sameValor(v, p.valor)) {
        const { [k]: _omitido, ...resto } = prev;
        void _omitido;
        return resto;
      }
      return { ...prev, [k]: v };
    });
  }

  protected cambiarNumero(
    g: GrupoSimConfig,
    p: ParametroSimConfig,
    texto: string,
  ): void {
    const n = p.tipo === 'entero' ? Number.parseInt(texto, 10) : Number.parseFloat(texto);
    this.setValor(g, p, Number.isNaN(n) ? NaN : n);
  }

  protected descartar(): void {
    this.edits.set({});
  }

  protected async guardar(): Promise<void> {
    this.guardando.set(true);
    try {
      const res = await this.api.saveConfig(
        this.cambios().map(({ ambito, clave, valor }) => ({ ambito, clave, valor })),
        this.comentario.trim() || undefined,
      );
      this.toast.show(
        'Configuración guardada',
        `${res.cambios} ${res.cambios === 1 ? 'cambio aplicado' : 'cambios aplicados'}. El simulador los usa de inmediato.`,
      );
      this.confirmOpen.set(false);
      this.comentario = '';
      this.edits.set({});
      await this.cargar();
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
