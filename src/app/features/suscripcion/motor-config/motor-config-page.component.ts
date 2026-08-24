// Página de configuración del motor de suscripción (permiso
// app.suscripcion.motor.config). Renderiza los grupos de parámetros que entrega el
// backend (compartido / Crea Patrimonio / Crea Ahorro / mapeo de productos), con editor
// por tipo, dirty-tracking contra el snapshot original, confirmación con lista de
// cambios + comentario, y el historial de auditoría al final.

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { AccessDeniedComponent } from '../../../shared/components/access-denied.component';
import { AlmaLoaderComponent } from '../../../shared/components/alma-loader.component';
import { EnfermedadesEditorComponent } from './enfermedades-editor.component';
import { HistorialCambiosComponent } from './historial-cambios.component';
import { ListaEditorComponent } from './lista-editor.component';
import {
  GrupoConfig,
  LogItem,
  MotorConfigApiService,
  ParametroConfig,
  TipoParametro,
  ValorParametro,
} from './motor-config.api';

/** Opciones válidas del mapeo código Pipeline → reglas de producto del motor. */
const MAPA_OPCIONES: Record<string, string> = {
  crea_patrimonio: 'Crea Patrimonio',
  crea_ahorro: 'Crea Ahorro',
};

const GRUPO_ICONO: Record<string, string> = {
  compartido: 'sliders-horizontal',
  crea_patrimonio: 'landmark',
  crea_ahorro: 'piggy-bank',
  mapeo_productos: 'arrow-right-left',
};

const keyOf = (ambito: string, clave: string) => `${ambito}::${clave}`;

function sameValor(tipo: TipoParametro, a: ValorParametro, b: ValorParametro): boolean {
  if (tipo === 'lista') {
    const x = a as string[];
    const y = b as string[];
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  if (tipo === 'mapa') {
    const x = a as Record<string, string>;
    const y = b as Record<string, string>;
    const kx = Object.keys(x);
    return kx.length === Object.keys(y).length && kx.every((k) => x[k] === y[k]);
  }
  const na = a as number;
  const nb = b as number;
  return na === nb || (Number.isNaN(na) && Number.isNaN(nb));
}

/** Valor compacto para la lista de confirmación y la barra de cambios. */
function fmtValor(tipo: TipoParametro, v: ValorParametro): string {
  if (tipo === 'lista') {
    const arr = v as string[];
    return `${arr.length} ${arr.length === 1 ? 'ítem' : 'ítems'}`;
  }
  if (tipo === 'mapa') return 'mapeo';
  const n = v as number;
  return Number.isFinite(n) ? n.toLocaleString('es-CO') : '—';
}

/** Detalle del cambio (diff legible) para listas y mapas. */
function detalleCambio(
  tipo: TipoParametro,
  antes: ValorParametro,
  despues: ValorParametro,
): string | null {
  if (tipo === 'lista') {
    const a = antes as string[];
    const d = despues as string[];
    const agregados = d.filter((x) => !a.includes(x)).map((x) => `+${x}`);
    const quitados = a.filter((x) => !d.includes(x)).map((x) => `−${x}`);
    const partes = [...agregados, ...quitados];
    return partes.length ? partes.join(', ') : null;
  }
  if (tipo === 'mapa') {
    const a = antes as Record<string, string>;
    const d = despues as Record<string, string>;
    const partes = Object.keys(d)
      .filter((k) => a[k] !== d[k])
      .map(
        (k) =>
          `${k}: ${MAPA_OPCIONES[a[k]] ?? a[k] ?? '—'} → ${MAPA_OPCIONES[d[k]] ?? d[k]}`,
      );
    return partes.length ? partes.join(' · ') : null;
  }
  return null;
}

interface CambioUI {
  ambito: string;
  clave: string;
  valor: ValorParametro;
  tituloGrupo: string;
  etiqueta: string;
  tipo: TipoParametro;
  antes: ValorParametro;
  detalle: string | null;
  antesTxt: string;
  despuesTxt: string;
}

interface ParamVista {
  param: ParametroConfig;
  etiqueta: string;
  valor: ValorParametro;
  dirty: boolean;
  invalido: boolean;
}

interface GrupoVista {
  grupo: GrupoConfig;
  icono: string;
  numericos: ParamVista[];
  otros: ParamVista[];
}

@Component({
  selector: 'alma-motor-config-page',
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    AccessDeniedComponent,
    AlmaLoaderComponent,
    ListaEditorComponent,
    EnfermedadesEditorComponent,
    HistorialCambiosComponent,
  ],
  template: `
    @if (!puedeConfigurar()) {
      <alma-access-denied />
    } @else if (cargando()) {
      <div class="flex flex-col items-center gap-4 p-16">
        <alma-loader [size]="90" />
        <p class="text-sm text-muted-foreground">Cargando configuración del motor…</p>
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
          <a routerLink="/apps/suscripcion" class="alma-btn alma-btn-outline">
            <lucide-icon name="arrow-left" [size]="16" /> Volver
          </a>
          <button type="button" (click)="cargar()" class="alma-btn alma-btn-outline">
            <lucide-icon name="refresh-cw" [size]="16" /> Reintentar
          </button>
        </div>
      </div>
    } @else {
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <!-- Barra superior: volver a la landing de la App -->
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
            Configuración del motor de reglas
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
            Parámetros vigentes del motor de suscripción: edítalos sin depender de
            despliegues.
          </p>
        </div>

        <!-- Nota: vigencia inmediata -->
        <div
          class="flex items-start gap-2 rounded-xl border border-sky-200/60 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
        >
          <lucide-icon name="info" [size]="14" class="mt-0.5 shrink-0" />
          Los cambios rigen de inmediato para las evaluaciones nuevas del motor.
        </div>

        <!-- Grupos de parámetros -->
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
              <div
                class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3"
              >
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
                    <input
                      type="number"
                      [step]="p.param.tipo === 'entero' ? 1 : 'any'"
                      [value]="p.valor"
                      (input)="cambiarNumero(g.grupo, p.param, $any($event.target).value)"
                      class="alma-input h-9 rounded-xl text-sm"
                      [class.border-amber-500/60]="p.dirty"
                      [class.border-destructive]="p.invalido"
                    />
                  </div>
                }
              </div>
            }

            @for (p of g.otros; track p.param.clave) {
              <div [class.mt-4]="g.numericos.length > 0">
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

                @if (p.param.tipo === 'lista' && p.param.clave === 'enfermedades_flujo') {
                  <alma-enfermedades-editor
                    [value]="$any(p.valor)"
                    (valueChange)="setValor(g.grupo, p.param, $event)"
                  />
                } @else if (p.param.tipo === 'lista') {
                  <alma-lista-editor
                    [value]="$any(p.valor)"
                    (valueChange)="setValor(g.grupo, p.param, $event)"
                  />
                } @else {
                  <!-- Mapeo código Pipeline → reglas del motor -->
                  <div class="overflow-hidden rounded-xl border border-border/50">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b border-border/50 bg-muted/30 text-left">
                          <th
                            class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            Código Pipeline
                          </th>
                          <th
                            class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            Reglas del motor
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (codigo of codigosMapa(p.valor); track codigo) {
                          <tr class="border-b border-border/30 last:border-0">
                            <td class="px-3 py-1.5 font-mono text-xs text-foreground">
                              {{ codigo }}
                            </td>
                            <td class="px-3 py-1.5">
                              <select
                                class="alma-input h-8 w-56 rounded-lg text-xs"
                                [value]="valorMapa(p.valor, codigo)"
                                (change)="
                                  cambiarMapa(
                                    g.grupo,
                                    p.param,
                                    codigo,
                                    $any($event.target).value
                                  )
                                "
                              >
                                @for (op of opcionesMapa; track op.slug) {
                                  <option [value]="op.slug">{{ op.label }}</option>
                                }
                              </select>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Historial de auditoría -->
        <alma-historial-cambios
          [log]="log()"
          [cargando]="cargandoLog()"
          [error]="errorLog()"
          [ambitoTitulo]="ambitoTituloFn"
          [etiquetaDe]="etiquetaDeFn"
        />

        <!-- Barra fija inferior: visible solo con cambios sin guardar -->
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
                  <button
                    type="button"
                    (click)="descartar()"
                    class="alma-btn h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    <lucide-icon name="rotate-ccw" [size]="14" /> Descartar
                  </button>
                  <button
                    type="button"
                    [disabled]="errores().length > 0"
                    (click)="confirmOpen.set(true)"
                    class="alma-btn alma-btn-primary h-8 rounded-xl text-xs"
                  >
                    <lucide-icon name="save" [size]="14" /> Guardar cambios
                  </button>
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

        <!-- Confirmación: lista de cambios + comentario opcional -->
        @if (confirmOpen()) {
          <div
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            (click)="!guardando() && confirmOpen.set(false)"
          >
            <div
              class="surface-solid w-full max-w-lg rounded-2xl border border-border p-5 shadow-2xl"
              (click)="$event.stopPropagation()"
            >
              <h2 class="text-base font-bold">Confirmar cambios del motor</h2>
              <p class="mt-1 text-sm text-muted-foreground">
                Se aplicarán {{ cambios().length }}
                {{ cambios().length === 1 ? 'cambio' : 'cambios' }}. Rigen de inmediato
                para las evaluaciones nuevas.
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
                <label class="text-xs font-medium text-foreground" for="comentario-config">
                  Comentario (opcional)
                </label>
                <textarea
                  id="comentario-config"
                  [(ngModel)]="comentario"
                  placeholder="Por qué se hace este cambio (queda en el historial)…"
                  class="alma-input mt-1 min-h-20 rounded-xl py-2 text-sm"
                ></textarea>
              </div>

              <div class="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  [disabled]="guardando()"
                  (click)="confirmOpen.set(false)"
                  class="alma-btn alma-btn-outline rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  [disabled]="guardando()"
                  (click)="guardar()"
                  class="alma-btn alma-btn-primary rounded-xl"
                >
                  @if (guardando()) {
                    <lucide-icon name="refresh-cw" [size]="14" class="animate-spin" />
                  }
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class MotorConfigPageComponent {
  private readonly api = inject(MotorConfigApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly opcionesMapa = Object.entries(MAPA_OPCIONES).map(([slug, label]) => ({
    slug,
    label,
  }));

  protected readonly puedeConfigurar = computed(() =>
    this.auth.hasPermission('app.suscripcion.motor.config'),
  );

  protected readonly grupos = signal<GrupoConfig[]>([]);
  protected readonly log = signal<LogItem[]>([]);
  protected readonly cargando = signal(true);
  protected readonly cargandoLog = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly errorLog = signal(false);
  protected readonly guardando = signal(false);
  protected readonly confirmOpen = signal(false);
  protected comentario = '';

  /** Dirty tracking: solo los valores QUE EL USUARIO tocó; el snapshot original
   *  vive en grupos(). Descartar = vaciar el mapa. */
  private readonly edits = signal<Record<string, ValorParametro>>({});

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

  private valorActual(g: GrupoConfig, p: ParametroConfig): ValorParametro {
    const e = this.edits()[keyOf(g.ambito, p.clave)];
    return e !== undefined ? e : p.valor;
  }

  private esDirty(g: GrupoConfig, p: ParametroConfig): boolean {
    const e = this.edits()[keyOf(g.ambito, p.clave)];
    return e !== undefined && !sameValor(p.tipo, e, p.valor);
  }

  private invalido(p: ParametroConfig, v: ValorParametro): boolean {
    if (p.tipo !== 'numero' && p.tipo !== 'entero') return false;
    const n = v as number;
    return !Number.isFinite(n) || n <= 0 || (p.tipo === 'entero' && !Number.isInteger(n));
  }

  protected readonly gruposVista = computed<GrupoVista[]>(() =>
    this.grupos().map((grupo) => {
      const vista = (p: ParametroConfig): ParamVista => {
        const valor = this.valorActual(grupo, p);
        return {
          param: p,
          etiqueta: p.etiqueta || p.clave,
          valor,
          dirty: this.esDirty(grupo, p),
          invalido: this.invalido(p, valor),
        };
      };
      return {
        grupo,
        icono: GRUPO_ICONO[grupo.ambito] || 'sliders-horizontal',
        numericos: grupo.parametros
          .filter((p) => p.tipo === 'numero' || p.tipo === 'entero')
          .map(vista),
        otros: grupo.parametros
          .filter((p) => p.tipo === 'lista' || p.tipo === 'mapa')
          .map(vista),
      };
    }),
  );

  /** Cambios efectivos (edits que difieren del snapshot), con metadatos de UI. */
  protected readonly cambios = computed<CambioUI[]>(() => {
    const out: CambioUI[] = [];
    for (const g of this.grupos()) {
      for (const p of g.parametros) {
        const editado = this.edits()[keyOf(g.ambito, p.clave)];
        if (editado !== undefined && !sameValor(p.tipo, editado, p.valor)) {
          out.push({
            ambito: g.ambito,
            clave: p.clave,
            valor: editado,
            tituloGrupo: g.titulo,
            etiqueta: p.etiqueta || p.clave,
            tipo: p.tipo,
            antes: p.valor,
            detalle: detalleCambio(p.tipo, p.valor, editado),
            antesTxt: fmtValor(p.tipo, p.valor),
            despuesTxt: fmtValor(p.tipo, editado),
          });
        }
      }
    }
    return out;
  });

  /** Validaciones de cliente (el backend re-valida al guardar). */
  protected readonly errores = computed<string[]>(() => {
    const errs: string[] = [];
    const num = (g: GrupoConfig, clave: string): number | null => {
      const p = g.parametros.find((x) => x.clave === clave);
      return p ? (this.valorActual(g, p) as number) : null;
    };
    let edadMinima: number | null = null;

    for (const g of this.grupos()) {
      for (const p of g.parametros) {
        const etiqueta = p.etiqueta || p.clave;
        const v = this.valorActual(g, p);
        if (p.tipo === 'numero' || p.tipo === 'entero') {
          const n = v as number;
          if (!Number.isFinite(n) || n <= 0) {
            errs.push(`${g.titulo} · ${etiqueta}: debe ser un número mayor que 0.`);
          } else if (p.tipo === 'entero' && !Number.isInteger(n)) {
            errs.push(`${g.titulo} · ${etiqueta}: debe ser un número entero.`);
          }
          if (p.clave === 'edad_minima') edadMinima = n;
        } else if (p.tipo === 'lista') {
          const arr = v as string[];
          if (arr.length === 0)
            errs.push(`${g.titulo} · ${etiqueta}: la lista no puede quedar vacía.`);
          if (new Set(arr).size !== arr.length)
            errs.push(`${g.titulo} · ${etiqueta}: la lista tiene valores duplicados.`);
        }
      }
    }

    for (const g of this.grupos()) {
      const sumaMin = num(g, 'suma_min');
      const sumaMax = num(g, 'suma_max');
      if (
        sumaMin != null &&
        sumaMax != null &&
        Number.isFinite(sumaMin) &&
        Number.isFinite(sumaMax) &&
        sumaMin >= sumaMax
      ) {
        errs.push(`${g.titulo}: la suma mínima debe ser menor que la suma máxima.`);
      }
      const edadMaxAuto = num(g, 'edad_max_auto');
      const edadMaxSus = num(g, 'edad_max_sus');
      if (edadMaxAuto != null && edadMaxSus != null && edadMaxAuto > edadMaxSus) {
        errs.push(
          `${g.titulo}: la edad máxima delegada no puede superar la edad máxima de suscripción.`,
        );
      }
      if (edadMinima != null && edadMaxAuto != null && edadMinima > edadMaxAuto) {
        errs.push(
          `${g.titulo}: la edad mínima compartida no puede superar la edad máxima delegada.`,
        );
      }
    }
    return errs;
  });

  protected setValor(g: GrupoConfig, p: ParametroConfig, v: ValorParametro): void {
    this.edits.update((prev) => {
      const k = keyOf(g.ambito, p.clave);
      if (sameValor(p.tipo, v, p.valor)) {
        // Volvió al valor original → deja de estar sucio.
        const { [k]: _omitido, ...resto } = prev;
        void _omitido;
        return resto;
      }
      return { ...prev, [k]: v };
    });
  }

  protected cambiarNumero(g: GrupoConfig, p: ParametroConfig, texto: string): void {
    const n = p.tipo === 'entero' ? Number.parseInt(texto, 10) : Number.parseFloat(texto);
    this.setValor(g, p, Number.isNaN(n) ? NaN : n);
  }

  protected codigosMapa(v: ValorParametro): string[] {
    return Object.keys(v as Record<string, string>);
  }

  protected valorMapa(v: ValorParametro, codigo: string): string {
    return (v as Record<string, string>)[codigo];
  }

  protected cambiarMapa(
    g: GrupoConfig,
    p: ParametroConfig,
    codigo: string,
    slug: string,
  ): void {
    const actual = this.valorActual(g, p) as Record<string, string>;
    this.setValor(g, p, { ...actual, [codigo]: slug });
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
        `${res.cambios} ${res.cambios === 1 ? 'cambio aplicado' : 'cambios aplicados'}. El motor los usa de inmediato.`,
      );
      this.confirmOpen.set(false);
      this.comentario = '';
      this.edits.set({});
      await this.cargar();
    } catch (e) {
      this.toast.error(
        'No se pudo guardar',
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      this.guardando.set(false);
    }
  }
}
