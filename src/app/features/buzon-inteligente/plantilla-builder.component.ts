// Constructor de plantillas de exportación — réplica de `tplBuilder` del prototipo
// validado (contexto-recaudos-pac/buzon-inteligente-v2.html), en tres pasos:
//   ① Modelo: el área sube SU plantilla (.xlsx/.csv); Alma lee las hojas en el
//      navegador, encuentra la fila de encabezados (lo de arriba es el título) y
//      propone qué dato va en cada columna (✦). También: desde el JSON, en blanco
//      o con una plantilla de ejemplo.
//   ② Qué va en cada columna: dato del JSON, texto fijo, columna de una base,
//      fórmula (FILA() = número de fila), cálculo de Nova o información del correo;
//      formato y orden. Opcional: fila de lote antes del detalle (074, «Cargue PAC»).
//   ③ Revisar: nombre, hoja, nombre del archivo con {campo}, título, detalle y
//      vista previa con datos ficticios.
// Edita en sitio el `TplForm` que recibe (como S.tb.t del prototipo) y avisa con
// `cambiado`; quien lo usa decide cuándo guardar (ExportacionEstado).

import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { Base, COMPARACIONES, Comparacion, DATOS_CORREO, DatoCorreo, FORMATOS_COLUMNA, FormatoColumna, OrigenColumna } from './buzon.api';
import {
  CampoExp,
  ColForm,
  HojaVista,
  ModeloVista,
  ORIGENES_TPL,
  PasoTpl,
  TplForm,
  VistaCeldas,
  aplicarModelo,
  colFalta,
  filaEncabezado,
  fmtV,
  leerModeloArchivo,
  letra,
  modeloDemo,
  nombreArchivoEj,
  origenTpl,
  previewTpl,
  sugerirCol,
  tplGuardable,
  tplIncompleto,
  tplNuevo,
  valorColEj,
} from './buzon-exportacion';

const SEPARADORES = [
  { id: ';', nombre: 'Punto y coma ( ; )' },
  { id: ',', nombre: 'Coma ( , )' },
  { id: '|', nombre: 'Barra ( | )' },
  { id: '\t', nombre: 'Tabulación' },
];

let siguienteId = 0;

/** Hoja de cálculo de la vista previa (`previewTpl` del prototipo). */
@Component({
  selector: 'alma-hoja-vista',
  styleUrls: ['./buzon-proto.css'],
  styles: [':host { display: grid; gap: 12px; min-width: 0; }'],
  template: `
    @let h = hoja();
    <div class="sheet-wrap">
      <table class="sheet">
        <tr>
          <th class="rh"></th>
          @for (l of h.letras; track $index) {
            <th>{{ l }}</th>
          }
        </tr>
        @for (f of h.filas; track $index; let i = $index) {
          <tr [class.h]="f.h">
            <td class="rh">{{ i + 1 }}</td>
            @for (c of f.celdas; track $index) {
              @if (c.th) {
                <th>{{ c.v }}</th>
              } @else {
                <td [class]="c.cls ?? ''" [attr.colspan]="c.span ?? null">
                  @if (c.b) {
                    <b>{{ c.v }}</b>
                  } @else {
                    {{ c.v }}
                  }
                </td>
              }
            }
          </tr>
        }
      </table>
      <div class="sheet-tabs">
        @for (s of h.hojas; track $index; let first = $first) {
          <span [class.on]="first">{{ s }}</span>
        }
      </div>
    </div>
    <p class="xxs muted">
      Datos ficticios armados con el JSON de este buzón · archivo: <span class="mono">{{ h.archivo }}</span>{{ h.detalle ? ' · una fila por elemento de «' + h.detalle + '»' : ' · una fila por correo' }}
    </p>
  `,
})
export class HojaVistaComponent {
  readonly hoja = input.required<HojaVista>();
}

@Component({
  selector: 'alma-plantilla-builder',
  imports: [NgTemplateOutlet, LucideAngularModule, HojaVistaComponent],
  styleUrls: ['./buzon-proto.css'],
  template: `
    @let t = tpl();
    <div class="stack" style="gap:12px" [attr.data-rev]="version()">
      <div class="tbsteps" role="tablist">
        @for (p of pasos(); track p.n) {
          <button type="button" role="tab" [attr.aria-selected]="t.paso === p.n" [disabled]="p.n > 1 && !t.columnas.length" (click)="ir(p.n)">
            <b>{{ p.n }} · {{ p.nombre }}</b><span>{{ p.estado }}</span>
          </button>
        }
      </div>
      @if (t.msg) {
        <p class="note b-amber"><lucide-icon name="alert-triangle" [size]="13" /> <span>{{ t.msg }}</span></p>
      }

      <!-- ① Modelo -->
      @if (t.paso === 1) {
        @if (t.vista; as M) {
          <div class="sunk r-xl stack" style="padding:12px 14px;gap:10px">
            <div class="row between">
              <p class="sm b">
                <lucide-icon name="file-spreadsheet" [size]="13" /> {{ M.file }}
                @if (M.demo) {
                  <span class="badge b-amber">vista de ejemplo</span>
                }
              </p>
            </div>
            <div class="g2">
              <div class="fld">
                <label class="label" [for]="ids + 'mhoja'">Hoja</label>
                <select class="input sm" [id]="ids + 'mhoja'" (change)="cambiarHoja(val($event))">
                  @for (h of M.orden; track h) {
                    <option [value]="h" [selected]="h === M.hoja">{{ h }}</option>
                  }
                </select>
              </div>
              <div class="fld">
                <label class="label" [for]="ids + 'mfila'">Fila de encabezados</label>
                <select class="input sm" [id]="ids + 'mfila'" (change)="cambiarFila(+val($event))">
                  @for (r of filasModelo(M); track $index; let i = $index) {
                    <option [value]="i" [selected]="i === M.fila">Fila {{ i + 1 }}{{ r ? ': ' + r : ' (vacía)' }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="sheet-wrap">
              <div class="grid-scroll" style="max-height:220px">
                <table class="sheet">
                  @for (r of filasHoja(M); track $index; let i = $index) {
                    <tr [class.h]="i === M.fila">
                      <td class="rh">{{ i + 1 }}</td>
                      @for (v of r.slice(0, 14); track $index) {
                        <td>{{ v }}</td>
                      }
                    </tr>
                  }
                </table>
              </div>
            </div>
            <p class="xxs muted">La fila resaltada es la de encabezados. Lo que esté arriba se toma como título.</p>
          </div>
          <ng-container *ngTemplateOutlet="subir; context: { $implicit: t }" />
        } @else if (t.modelo && t.columnas.length) {
          <div class="sunk r-xl stack" style="padding:12px 14px;gap:10px">
            <p class="sm b"><lucide-icon name="file-spreadsheet" [size]="13" /> {{ t.modelo }}</p>
          </div>
          <ng-container *ngTemplateOutlet="subir; context: { $implicit: t }" />
        } @else {
          <ng-container *ngTemplateOutlet="subir; context: { $implicit: t }" />
          <div class="row">
            <span class="xs muted">¿No tienes una plantilla?</span>
            <button type="button" class="btn outline sm" (click)="desde('json')"><lucide-icon name="braces" [size]="13" /> Armarla desde los datos del JSON</button>
            <button type="button" class="btn outline sm" (click)="desde('cero')"><lucide-icon name="file-plus-2" [size]="13" /> Empezar en blanco</button>
            <button type="button" class="btn sm" (click)="probarEjemplo()">Probar con una plantilla de ejemplo</button>
          </div>
          @if (t.columnas.length) {
            <p class="note b-sky">
              <lucide-icon name="info" [size]="13" />
              <span>Esta plantilla tiene {{ t.columnas.length }} columnas y no tiene un modelo cargado. Si subes tu archivo, se conservan las columnas que coincidan por nombre.</span>
            </p>
          }
        }
        <p class="xxs muted">Ejemplo de referencia: <button type="button" class="linkbtn" (click)="verRef.emit()">ver «Cargue PAC» (solo lectura)</button></p>
        @if (t.columnas.length) {
          <div class="row" style="justify-content:flex-end">
            <button type="button" class="btn sm danger" (click)="vaciar()">Vaciar plantilla</button>
            <button type="button" class="btn primary sm" (click)="ir(2)">Siguiente: qué va en cada columna →</button>
          </div>
        }
      }

      <!-- ② Qué va en cada columna -->
      @if (t.paso === 2) {
        <div class="row between">
          <p class="xs muted">Haz clic en un encabezado para decir qué va en esa columna. ✦ = propuesta de Nova por el nombre. En ámbar: sin asignar.</p>
          <div class="row">
            <button type="button" class="btn outline sm" (click)="proponer()"><lucide-icon name="sparkles" [size]="13" /> Proponer lo que falta</button>
            <button type="button" class="btn outline sm" (click)="agregar()"><lucide-icon name="plus" [size]="13" /> Columna</button>
          </div>
        </div>
        <!-- 074: «Fila de resumen» (una sola, antes del detalle), como el encabezado del «Cargue PAC».
             Plegada: solo se despliega si la plantilla la usa o si el usuario la agrega. -->
        @if (t.lote.length || verResumen()) {
          <div class="sunk r-xl stack" style="padding:10px 12px;gap:8px">
            <div class="row between">
              <p class="xs"><b>Fila de resumen (opcional)</b> <span class="muted">· una fila arriba del detalle con totales o datos de control (por ejemplo, cantidad de registros y valor total). Úsala solo si el sistema que recibe el archivo la pide.</span></p>
              <button type="button" class="btn outline sm" (click)="agregarLote()"><lucide-icon name="plus" [size]="13" /> Celda</button>
            </div>
            @if (t.lote.length) {
              <!-- Misma grilla que las columnas del detalle: una celda por columna del resumen. -->
              <div class="sheet-wrap">
                <div class="grid-scroll">
                  <table class="sheet mapgrid">
                    <tr>
                      <th class="rh">R</th>
                      @for (x of t.lote; track $index; let j = $index) {
                        <th>
                          <button type="button" class="colhead" [class.on]="t.zona === 'lote' && t.selLote === j" (click)="elegirLote(j)">
                            <b>{{ x.encabezado || '…' }}</b>
                            <ng-container *ngTemplateOutlet="chip; context: { $implicit: x }" />
                          </button>
                        </th>
                      }
                    </tr>
                  </table>
                </div>
              </div>
            }
          </div>
        } @else {
          <button type="button" class="btn ghost sm" style="justify-self:start" (click)="verResumen.set(true); agregarLote()" title="Una fila arriba del detalle con totales o datos de control, si el sistema que recibe el archivo la pide"><lucide-icon name="plus" [size]="13" /> Agregar fila de resumen</button>
        }
        @if (t.columnas.length) {
          <div class="sheet-wrap">
            <div class="grid-scroll">
              <table class="sheet mapgrid">
                <tr>
                  <th class="rh"></th>
                  @for (x of t.columnas; track $index; let j = $index) {
                    <th>
                      <button type="button" class="colhead" [class.on]="t.zona !== 'lote' && t.sel === j" (click)="elegirCol(j)">
                        <b>{{ x.encabezado || '…' }}</b>
                        <ng-container *ngTemplateOutlet="chip; context: { $implicit: x }" />
                      </button>
                    </th>
                  }
                </tr>
                @for (i of [0, 1]; track i) {
                  <tr>
                    <td class="rh">{{ i + 1 }}</td>
                    @for (x of t.columnas; track $index; let j = $index) {
                      <td [class.miss]="x.origen.tipo === 'vacio'">{{ muestra(t, j, i) }}</td>
                    }
                  </tr>
                }
              </table>
            </div>
          </div>
        } @else {
          <p class="note b-amber"><lucide-icon name="info" [size]="13" /> <span>Aún no hay columnas. Vuelve al paso 1 o agrega una.</span></p>
        }

        @if (seleccionada(t); as c) {
          <div class="sunk r-xl stack" style="padding:12px 14px;gap:10px">
            <div class="row between">
              <p class="sm b">
                {{ t.zona === 'lote' ? 'Fila de resumen · celda ' + (t.selLote + 1) : 'Columna ' + letra(t.sel) }} · {{ c.encabezado || '…' }}
                @if (c.sug) {
                  <span class="badge b-violet">✦ Propuesta de Nova</span>
                }
              </p>
              <div class="row" style="gap:4px">
                @if (c.sug) {
                  <button type="button" class="btn outline sm" (click)="c.sug = false; cambio()"><lucide-icon name="check" [size]="13" /> Aceptar propuesta</button>
                }
                <button type="button" class="mini" aria-label="Mover a la izquierda" (click)="mover(-1)">‹</button>
                <button type="button" class="mini" aria-label="Mover a la derecha" (click)="mover(1)">›</button>
                <button type="button" class="btn ghost danger" aria-label="Quitar columna" (click)="quitar()"><lucide-icon name="trash-2" [size]="13" /></button>
              </div>
            </div>
            <div class="g2">
              <div class="fld">
                <label class="label" [for]="ids + 'n'">Nombre en el archivo</label>
                <input class="input sm" [id]="ids + 'n'" [value]="c.encabezado" (input)="c.encabezado = val($event); cambio()" />
              </div>
              <div class="fld">
                <label class="label" [for]="ids + 'f'">Formato</label>
                <select class="input sm" [id]="ids + 'f'" (change)="formato(c, val($event))">
                  @for (o of formatos; track o.id) {
                    <option [value]="o.id" [selected]="c.formato === o.id">{{ o.nombre }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="fld">
              <span class="label">¿De dónde sale el valor?</span>
              <div class="row" style="gap:6px">
                @for (o of origenes; track o.id) {
                  <button type="button" class="chipo pick" [attr.aria-pressed]="origenTpl(c.origen.tipo) === o.id" (click)="elegirOrigen(c, o.id)">
                    <lucide-icon [name]="o.icon" [size]="13" /> {{ o.nombre }}
                  </button>
                }
              </div>
            </div>
            @if (c.origen.tipo === 'vacio') {
              <p class="xs" style="color:var(--amber)">Elige de dónde sale el valor.</p>
            } @else {
              <div class="fld">
                <span class="label">{{ etiquetaValor(c) }}</span>
                @switch (c.origen.tipo) {
                  @case ('campo') {
                    <select class="input sm" aria-label="Dato" (change)="c.origen.campo = val($event); c.sug = false; cambio()">
                      <option value="">Elige el dato…</option>
                      @if (c.origen.campo && !tieneCampo(c.origen.campo)) {
                        <option [value]="c.origen.campo" selected>{{ c.origen.campo }}</option>
                      }
                      @for (f of campos(); track f[0]) {
                        <option [value]="f[0]" [selected]="c.origen.campo === f[0]">{{ f[0] }}</option>
                      }
                    </select>
                    <!-- 074: si el correo no trae el dato, se busca en una base (p. ej. el código PC por NIT). -->
                    <label class="row xs" style="gap:6px"><input type="checkbox" [checked]="!!c.origen.si_vacio" (change)="respaldo(c, chk($event))" /> Si viene vacío, buscarlo en una base</label>
                    @if (c.origen.si_vacio; as r) {
                      <div class="g2">
                        <select class="input sm" aria-label="Columna de la base si viene vacío" (change)="baseRespaldo(r, val($event))">
                          <option value="">{{ basesBuzon().length ? 'Base y columna con el valor…' : 'Este buzón no tiene bases' }}</option>
                          @for (b of basesBuzon(); track b.id) {
                            <optgroup [label]="b.nombre">
                              @for (col of b.columnas; track col) {
                                <option [value]="b.id + '|' + col" [selected]="r.base_id === b.id && r.columna_resultado === col">{{ col }}</option>
                              }
                            </optgroup>
                          }
                        </select>
                        <select class="input sm" aria-label="Dato del correo con el que se busca" (change)="r.campo = val($event) || null; cambio()">
                          <option value="">Se busca con el dato…</option>
                          @for (f of camposSimples(); track f[0]) {
                            <option [value]="f[0]" [selected]="r.campo === f[0]">{{ f[0] }}</option>
                          }
                        </select>
                        <select class="input sm" aria-label="Columna donde se busca" (change)="r.columna_busqueda = val($event) || null; cambio()">
                          <option value="">…en la columna</option>
                          @for (col of columnasBase(r.base_id); track col) {
                            <option [value]="col" [selected]="r.columna_busqueda === col">{{ col }}</option>
                          }
                        </select>
                        <select class="input sm" aria-label="Comparación" (change)="r.comparacion = $any(val($event)); cambio()">
                          @for (k of comparaciones; track k.id) {
                            <option [value]="k.id" [selected]="(r.comparacion ?? 'doc') === k.id">{{ k.nombre }}</option>
                          }
                        </select>
                      </div>
                    }
                  }
                  @case ('calculo') {
                    <input class="input sm mono" aria-label="Cálculo" placeholder="SUMA(afiliados.valor_aporte)" [value]="c.origen.expresion ?? ''" (input)="c.origen.expresion = val($event); c.sug = false; cambio()" />
                    <span class="xxs muted">CONTAR(lista) · SUMA(lista.campo) · REDONDEAR(valor;decimales) · + − * / con datos del JSON. Ej.: REDONDEAR(valor_aporte*pct_retencion/100;0)</span>
                    <label class="row xs" style="gap:6px">Comparar con lo que declara el correo
                      <select class="input sm" style="width:auto" aria-label="Dato del correo para comparar" (change)="c.origen.contra = val($event) || null; cambio()">
                        <option value="">No comparar</option>
                        @for (f of camposSimples(); track f[0]) {
                          <option [value]="f[0]" [selected]="c.origen.contra === f[0]">{{ f[0] }}</option>
                        }
                      </select>
                    </label>
                  }
                  @case ('correo') {
                    <select class="input sm" aria-label="Información del correo" (change)="dato(c, val($event))">
                      <option value="">Elige…</option>
                      @for (f of datosCorreo; track f.id) {
                        <option [value]="f.id" [selected]="c.origen.dato === f.id">{{ f.nombre }}</option>
                      }
                    </select>
                  }
                  @case ('base') {
                    <select class="input sm" aria-label="Columna de base" (change)="baseColumna(c, val($event))">
                      <option value="">{{ basesBuzon().length ? 'Elige base y columna…' : 'Este buzón no tiene bases' }}</option>
                      @for (b of basesBuzon(); track b.id) {
                        <optgroup [label]="b.nombre">
                          @for (col of b.columnas; track col) {
                            <option [value]="b.id + '|' + col" [selected]="c.origen.base_id === b.id && c.origen.columna_resultado === col">{{ col }}</option>
                          }
                        </optgroup>
                      }
                    </select>
                    @if (c.origen.base_id) {
                      <div class="g3">
                        <div class="fld">
                          <label class="label" [for]="ids + 'bd'">Dato del correo con el que se busca</label>
                          <select class="input sm" [id]="ids + 'bd'" (change)="c.origen.campo = val($event) || null; cambio()">
                            <option value="">Elige el dato…</option>
                            @for (f of campos(); track f[0]) {
                              <option [value]="f[0]" [selected]="c.origen.campo === f[0]">{{ f[0] }}</option>
                            }
                          </select>
                        </div>
                        <div class="fld">
                          <label class="label" [for]="ids + 'bb'">Columna donde se busca</label>
                          <select class="input sm" [id]="ids + 'bb'" (change)="c.origen.columna_busqueda = val($event) || null; cambio()">
                            <option value="">Elige la columna…</option>
                            @for (col of columnasBase(c.origen.base_id); track col) {
                              <option [value]="col" [selected]="c.origen.columna_busqueda === col">{{ col }}</option>
                            }
                          </select>
                        </div>
                        <div class="fld">
                          <label class="label" [for]="ids + 'bc'">Comparación</label>
                          <select class="input sm" [id]="ids + 'bc'" (change)="comparacion(c, val($event))">
                            @for (k of comparaciones; track k.id) {
                              <option [value]="k.id" [selected]="(c.origen.comparacion ?? 'exacta') === k.id">{{ k.nombre }}</option>
                            }
                          </select>
                        </div>
                      </div>
                    }
                  }
                  @case ('fijo') {
                    <input class="input sm" aria-label="Valor" placeholder="Texto que se repite en cada fila" [value]="c.origen.valor ?? ''" (input)="c.origen.valor = val($event); c.sug = false; cambio()" />
                  }
                  @default {
                    <input class="input sm mono" aria-label="Valor" [placeholder]="'=E{fila}*4/100 · FILA()'" [value]="formulaTexto(c)" (input)="formula(c, val($event))" />
                  }
                }
              </div>
            }
          </div>
        }

        <div class="row between">
          <button type="button" class="btn sm" (click)="adv.set(!adv())"><lucide-icon [name]="adv() ? 'chevron-up' : 'list'" [size]="13" /> {{ adv() ? 'Ocultar vista avanzada' : 'Vista avanzada (tabla)' }}</button>
          <div class="row">
            <button type="button" class="btn outline sm" (click)="ir(1)">← Modelo</button>
            <button type="button" class="btn primary sm" (click)="ir(3)">Siguiente: revisar →</button>
          </div>
        </div>
        @if (adv()) {
          <div class="scroll-x">
            <table class="t">
              <thead>
                <tr><th>Columna</th><th>¿De dónde sale?</th><th>Valor</th><th>Formato</th></tr>
              </thead>
              <tbody>
                @for (x of t.columnas; track $index) {
                  <tr>
                    <td style="padding:4px"><input class="input sm" style="min-width:140px" aria-label="Nombre" [value]="x.encabezado" (input)="x.encabezado = val($event); cambio()" /></td>
                    <td style="padding:4px">
                      <select class="input sm" style="min-width:190px" aria-label="Origen" (change)="elegirOrigen(x, val($event), true)">
                        <option value="">Elige…</option>
                        @for (o of origenes; track o.id) {
                          <option [value]="o.id" [selected]="origenTpl(x.origen.tipo) === o.id">{{ o.nombre }}</option>
                        }
                      </select>
                    </td>
                    <td style="padding:4px" class="xs"><ng-container *ngTemplateOutlet="chip; context: { $implicit: x }" /></td>
                    <td style="padding:4px">
                      <select class="input sm" style="min-width:150px" aria-label="Formato" (change)="formato(x, val($event))">
                        @for (o of formatos; track o.id) {
                          <option [value]="o.id" [selected]="x.formato === o.id">{{ o.nombre }}</option>
                        }
                      </select>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- ③ Revisar -->
      @if (t.paso === 3) {
        <!-- Acciones arriba: se ven sin bajar hasta la vista previa. La plantilla también se
             guarda sola a los pocos segundos de cada cambio; «Guardar plantilla» lo hace ya. -->
        <div class="row between">
          <button type="button" class="btn outline sm" (click)="ir(2)">← Columnas</button>
          <button type="button" class="btn primary sm" [disabled]="!guardable(t)" (click)="guardarTpl.emit()"><lucide-icon name="save" [size]="13" /> Guardar plantilla</button>
        </div>
        <div class="g2">
          <div class="fld">
            <label class="label" [for]="ids + 'nombre'">Nombre de la plantilla</label>
            <input class="input" [id]="ids + 'nombre'" [value]="t.nombre" (input)="t.nombre = val($event); cambio()" />
          </div>
          <div class="fld">
            <label class="label" [for]="ids + 'hoja'">Nombre de la hoja</label>
            <input class="input" maxlength="31" [id]="ids + 'hoja'" [value]="t.hoja" (input)="t.hoja = val($event); cambio()" />
          </div>
        </div>
        <div class="fld">
          <label class="label" [for]="ids + 'arch'">Nombre del archivo</label>
          <input class="input mono" [id]="ids + 'arch'" [placeholder]="'Ej.: {nit_empresa}_{fecha}'" [value]="t.nombre_archivo" (input)="t.nombre_archivo = val($event); cambio()" />
          <div class="row" style="gap:4px">
            <span class="xxs muted">Clic para insertar:</span>
            @for (k of insertables(); track k) {
              <button type="button" class="chipo" (click)="insertar(k)">{{ '{' + k + '}' }}</button>
            }
          </div>
          <span class="xxs muted">Así se llamará: <span class="mono">{{ archivoEj(t) || '—' }}.{{ t.formato }}</span></span>
        </div>
        <div class="g3">
          <label class="optcard" [for]="ids + 'tit'" style="cursor:pointer">
            <span class="row sm b"><input type="checkbox" [id]="ids + 'tit'" [checked]="t.titulo.length > 0" (change)="alternarTitulo()" /> Título</span>
            <span class="xs muted">Una fila arriba con el nombre de la plantilla.</span>
          </label>
          <label class="optcard" [for]="ids + 'enc'" style="cursor:pointer">
            <span class="row sm b"><input type="checkbox" [id]="ids + 'enc'" [checked]="t.encabezados" (change)="t.encabezados = chk($event); cambio()" /> Fila de encabezados</span>
            <span class="xs muted">Los nombres de las columnas sobre el detalle. Apágala si el sistema de cargue no la espera.</span>
          </label>
          <label class="optcard" [for]="ids + 'obs'" style="cursor:pointer">
            <span class="row sm b"><input type="checkbox" [id]="ids + 'obs'" [checked]="t.observaciones && t.formato === 'xlsx'" [disabled]="t.formato === 'csv'" (change)="t.observaciones = chk($event); cambio()" /> Hoja «Observaciones»</span>
            <span class="xs muted">{{ t.formato === 'csv' ? 'Solo en .xlsx: un .csv tiene una sola hoja.' : 'Por qué quedó en Validar, totales contra lo declarado, opciones de la base y celdas vacías.' }}</span>
          </label>
        </div>
        <div class="row">
          <label class="xs" [for]="ids + 'det'">Filas del detalle:</label>
          <select class="input sm" [id]="ids + 'det'" style="width:auto;min-width:260px" (change)="t.detalle = val($event) || null; cambio()">
            <option value="">Una fila por correo</option>
            @if (t.detalle && !listas().includes(t.detalle)) {
              <option [value]="t.detalle" selected>Una fila por elemento de «{{ t.detalle }}»</option>
            }
            @for (l of listas(); track l) {
              <option [value]="l" [selected]="t.detalle === l">Una fila por elemento de «{{ l }}»</option>
            }
          </select>
          <label class="row xs" [for]="ids + 'csv'"><input type="checkbox" [id]="ids + 'csv'" [checked]="t.formato === 'csv'" (change)="t.formato = chk($event) ? 'csv' : 'xlsx'; cambio()" /> Generar el archivo en .csv (en lugar de .xlsx)</label>
          @if (t.formato === 'csv') {
            <select class="input sm" style="width:auto;min-width:180px" aria-label="Separador" (change)="t.separador = val($event); cambio()">
              @for (s of separadores; track s.id) {
                <option [value]="s.id" [selected]="t.separador === s.id">{{ s.nombre }}</option>
              }
            </select>
          }
        </div>
        <div class="row between">
          <p class="xs b">Vista previa con datos ficticios</p>
          <div class="pills">
            <button type="button" [attr.aria-selected]="sv() === 'val'" (click)="sv.set('val')">Valores</button>
            <button type="button" [attr.aria-selected]="sv() === 'form'" (click)="sv.set('form')">Fórmulas</button>
          </div>
        </div>
        <alma-hoja-vista [hoja]="vista()" />
        @if (faltan(t); as falt) {
          @if (falt.length) {
            <div class="note b-amber" style="display:grid">
              @for (x of falt; track $index) {
                <span>• {{ x }}</span>
              }
            </div>
          } @else {
            <p class="note b-emerald"><lucide-icon name="check" [size]="13" /> <span>Plantilla lista.</span></p>
          }
        }
      }
    </div>

    <ng-template #subir let-t>
      <label class="upcard" [for]="ids + 'file'">
        <lucide-icon name="upload" [size]="20" />
        <span class="sm b">{{ t.vista || t.columnas.length ? 'Reemplazar con mi plantilla (.xlsx / .csv)' : 'Subir mi plantilla (.xlsx / .csv)' }}</span>
        <span class="xs muted">Nova lee tus hojas, encuentra la fila de encabezados y propone qué dato va en cada columna.{{ t.columnas.length ? ' Las columnas que coincidan por nombre conservan lo que ya asignaste.' : '' }}</span>
      </label>
      <input type="file" [id]="ids + 'file'" accept=".xlsx,.xls,.csv" hidden (change)="subirModelo($event)" />
    </ng-template>

    <ng-template #chip let-x>
      @if (x.origen.tipo === 'vacio') {
        <span class="mapchip miss">Sin asignar</span>
      } @else {
        <span class="mapchip" [class.sug]="x.sug">{{ x.sug ? '✦ ' : '' }}{{ resumen(x) }}</span>
      }
    </ng-template>
  `,
})
export class PlantillaBuilderComponent {
  private readonly toast = inject(ToastService);

  /** La plantilla en edición: se modifica en sitio. */
  readonly tpl = input.required<TplForm>();
  /** Datos del JSON del proceso ([ruta, lista]). */
  readonly campos = input<CampoExp[]>([]);
  /** Listas de objetos del JSON (una fila por elemento). */
  readonly listas = input<string[]>([]);
  readonly bases = input<Base[]>([]);
  /** Clave del proceso (para «Así se llamará»). */
  readonly proceso = input('');
  /** Algo cambió en la plantilla (quien la usa la guarda). */
  readonly cambiado = output<void>();
  /** «ver «Cargue PAC» (solo lectura)». */
  readonly verRef = output<void>();
  /** «Guardar plantilla» (paso ③): quien la usa la guarda ya. */
  readonly guardarTpl = output<void>();

  protected readonly ids = `tb${++siguienteId}-`;
  protected readonly origenes = ORIGENES_TPL;
  protected readonly formatos = FORMATOS_COLUMNA;
  protected readonly datosCorreo = DATOS_CORREO;
  protected readonly comparaciones = COMPARACIONES;
  protected readonly separadores = SEPARADORES;
  protected readonly letra = letra;
  protected readonly origenTpl = origenTpl;
  protected readonly faltan = tplIncompleto;
  protected readonly guardable = tplGuardable;

  /** Sube con cada cambio: la plantilla es mutable. */
  protected readonly version = signal(0);
  /** Vista previa: valores o fórmulas. */
  protected readonly sv = signal<VistaCeldas>('val');
  protected readonly adv = signal(false);
  /** «Agregar fila de resumen»: despliega el bloque aunque aún no tenga celdas. */
  protected readonly verResumen = signal(false);

  protected readonly basesBuzon = computed(() => this.bases().filter((b) => b.columnas.length));
  protected readonly vista = computed(() => {
    this.version();
    return previewTpl(this.tpl(), this.sv(), this.proceso());
  });

  protected pasos(): { n: PasoTpl; nombre: string; estado: string }[] {
    const t = this.tpl();
    const n = t.columnas.length;
    const asignadas = t.columnas.filter((c) => !colFalta(c)).length;
    const falt = tplIncompleto(t).length;
    return [
      { n: 1, nombre: 'Modelo', estado: t.vista?.file ?? t.modelo ?? (n ? 'Sin modelo cargado' : 'Sube tu plantilla') },
      { n: 2, nombre: 'Qué va en cada columna', estado: n ? `${asignadas} de ${n} asignadas` : '—' },
      { n: 3, nombre: 'Revisar', estado: falt ? `${falt} pendiente(s)` : 'Lista' },
    ];
  }

  protected cambio(): void {
    this.version.update((v) => v + 1);
    this.cambiado.emit();
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected chk(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected ir(p: PasoTpl): void {
    this.tpl().paso = p;
    this.version.update((v) => v + 1);
  }

  // ── ① Modelo ──
  protected async subirModelo(ev: Event): Promise<void> {
    const el = ev.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    if (!f) return;
    const t = this.tpl();
    const { mod, aviso } = await leerModeloArchivo(f);
    const h = mod.orden[0];
    const cons = aplicarModelo(t, mod, h, filaEncabezado(mod.hojas[h] ?? []), this.campos());
    t.paso = 1;
    t.msg = aviso;
    this.cambio();
    this.toast.show(`${f.name} leído: ${t.columnas.length} columnas${cons ? ` · ${cons} conservadas` : ''}`);
  }

  protected filasHoja(M: ModeloVista): string[][] {
    return (M.hojas[M.hoja] ?? []).slice(0, 8);
  }

  protected filasModelo(M: ModeloVista): string[] {
    return (M.hojas[M.hoja] ?? []).slice(0, 10).map((r) =>
      r
        .filter((c) => String(c).trim())
        .join(' · ')
        .slice(0, 60),
    );
  }

  protected cambiarHoja(h: string): void {
    const t = this.tpl();
    const M = t.vista!;
    aplicarModelo(t, M, h, filaEncabezado(M.hojas[h] ?? []), this.campos());
    this.cambio();
  }

  protected cambiarFila(i: number): void {
    const t = this.tpl();
    const M = t.vista!;
    aplicarModelo(t, M, M.hoja, i, this.campos());
    this.cambio();
  }

  protected desde(d: 'json' | 'cero'): void {
    const t = this.tpl();
    const nt = tplNuevo(d, this.campos(), this.listas(), t.nombre || `Plantilla ${this.proceso()}`);
    Object.assign(t, { ...nt, id: t.id });
    this.cambio();
  }

  protected probarEjemplo(): void {
    const t = this.tpl();
    const md = modeloDemo('MODELO_CARGUE.xlsx');
    aplicarModelo(t, md, md.orden[0], filaEncabezado(md.hojas[md.orden[0]]), this.campos());
    t.paso = 1;
    t.msg = '';
    this.cambio();
    this.toast.show(`Plantilla de ejemplo leída: ${t.columnas.length} columnas`);
  }

  protected vaciar(): void {
    Object.assign(this.tpl(), { columnas: [], titulo: [], lote: [], paso: 1, vista: null, modelo: null, muestra: [], msg: '', sel: 0, zona: 'col', selLote: 0 });
    this.cambio();
  }

  // ── ② Columnas ──
  protected muestra(t: TplForm, j: number, i: number): string {
    const c = t.columnas[j];
    const mv = t.muestra[i]?.[j];
    return mv && c.origen.tipo === 'vacio' ? mv : fmtV(valorColEj(c, i, this.sv()), c.formato);
  }

  protected resumen(x: ColForm): string {
    const o = x.origen;
    switch (o.tipo) {
      case 'fijo':
        return `«${o.valor ?? ''}»`;
      case 'correo':
        return DATOS_CORREO.find((d) => d.id === o.dato)?.nombre ?? '…';
      case 'base':
        return o.columna_resultado || 'base';
      case 'formula':
        return '= ' + (o.formula ?? '').replace(/^=/, '');
      case 'fila':
        return '= FILA()';
      case 'calculo':
        return '= ' + (o.expresion ?? '');
      default:
        return ((o.campo ?? '').split('.').pop() || '…') + (o.si_vacio ? ' · o base' : '');
    }
  }

  // ── 074: fila de lote y selección por zona ──
  protected seleccionada(t: TplForm): ColForm | undefined {
    return t.zona === 'lote' ? t.lote[t.selLote] : t.columnas[t.sel];
  }

  protected elegirCol(j: number): void {
    const t = this.tpl();
    t.zona = 'col';
    t.sel = j;
    this.version.update((v) => v + 1);
  }

  protected elegirLote(j: number): void {
    const t = this.tpl();
    t.zona = 'lote';
    t.selLote = j;
    this.version.update((v) => v + 1);
  }

  protected agregarLote(): void {
    const t = this.tpl();
    t.lote.push({ encabezado: `Resumen ${t.lote.length + 1}`, origen: { tipo: 'vacio' }, formato: 'texto' });
    t.zona = 'lote';
    t.selLote = t.lote.length - 1;
    this.cambio();
  }

  protected camposSimples(): CampoExp[] {
    return this.campos().filter((c) => !c[1]);
  }

  protected respaldo(c: ColForm, on: boolean): void {
    c.origen.si_vacio = on ? { tipo: 'base', base_id: null, campo: null, columna_busqueda: null, columna_resultado: null, comparacion: 'doc' } : null;
    this.cambio();
  }

  protected baseRespaldo(r: OrigenColumna, v: string): void {
    const i = v.indexOf('|');
    r.base_id = i > 0 ? v.slice(0, i) : null;
    r.columna_resultado = i > 0 ? v.slice(i + 1) : null;
    if (r.columna_busqueda && !this.columnasBase(r.base_id).includes(r.columna_busqueda)) r.columna_busqueda = null;
    this.cambio();
  }

  protected etiquetaValor(c: ColForm): string {
    return ORIGENES_TPL.find((o) => o.id === origenTpl(c.origen.tipo))?.campo ?? '';
  }

  protected tieneCampo(k: string): boolean {
    return this.campos().some((f) => f[0] === k);
  }

  protected columnasBase(id: string | null | undefined): string[] {
    return this.bases().find((b) => b.id === id)?.columnas ?? [];
  }

  protected proponer(): void {
    const t = this.tpl();
    let na = 0;
    t.columnas.forEach((c, j) => {
      if (c.origen.tipo !== 'vacio') return;
      const sg = sugerirCol(c.encabezado, this.campos());
      if (sg.origen.tipo !== 'vacio') {
        t.columnas[j] = { ...sg, encabezado: c.encabezado };
        na++;
      }
    });
    this.cambio();
    this.toast.show(na ? `Nova propuso ${na} columna(s): revísalas (✦)` : 'No encontré propuestas para las columnas que faltan');
  }

  protected agregar(): void {
    const t = this.tpl();
    t.columnas.push({ encabezado: `Columna ${t.columnas.length + 1}`, origen: { tipo: 'vacio' }, formato: 'texto' });
    t.sel = t.columnas.length - 1;
    this.cambio();
  }

  protected quitar(): void {
    const t = this.tpl();
    if (t.zona === 'lote') {
      t.lote.splice(t.selLote, 1);
      t.selLote = Math.max(0, t.selLote - 1);
      if (!t.lote.length) t.zona = 'col';
    } else {
      t.columnas.splice(t.sel, 1);
      t.sel = Math.max(0, t.sel - 1);
    }
    this.cambio();
  }

  protected mover(d: number): void {
    const t = this.tpl();
    const lista = t.zona === 'lote' ? t.lote : t.columnas;
    const a = t.zona === 'lote' ? t.selLote : t.sel;
    const b = a + d;
    if (b < 0 || b >= lista.length) return;
    [lista[a], lista[b]] = [lista[b], lista[a]];
    if (t.zona === 'lote') t.selLote = b;
    else t.sel = b;
    this.cambio();
  }

  /** Chip de origen (`tb-orig`) o selector de la vista avanzada (`data-tbo`, siempre reinicia el valor). */
  protected elegirOrigen(c: ColForm, id: string, reiniciar = false): void {
    if (!id) c.origen = { tipo: 'vacio' };
    else if (reiniciar || origenTpl(c.origen.tipo) !== id) {
      c.origen =
        id === 'correo'
          ? { tipo: 'correo', dato: 'fecha' }
          : id === 'base'
            ? { tipo: 'base', base_id: null, campo: null, columna_busqueda: null, columna_resultado: null, comparacion: 'exacta' }
            : id === 'formula'
              ? { tipo: 'formula', formula: '' }
              : id === 'calculo'
                ? { tipo: 'calculo', expresion: '', contra: null }
              : id === 'fijo'
                ? { tipo: 'fijo', valor: '' }
                : { tipo: 'campo', campo: '' };
    }
    c.sug = false;
    this.cambio();
  }

  protected formato(c: ColForm, f: string): void {
    c.formato = f as FormatoColumna;
    this.cambio();
  }

  protected dato(c: ColForm, d: string): void {
    c.origen.dato = (d || null) as DatoCorreo | null;
    c.sug = false;
    this.cambio();
  }

  protected baseColumna(c: ColForm, v: string): void {
    const i = v.indexOf('|');
    c.origen.base_id = i > 0 ? v.slice(0, i) : null;
    c.origen.columna_resultado = i > 0 ? v.slice(i + 1) : null;
    if (c.origen.columna_busqueda && !this.columnasBase(c.origen.base_id).includes(c.origen.columna_busqueda)) c.origen.columna_busqueda = null;
    c.sug = false;
    this.cambio();
  }

  protected comparacion(c: ColForm, v: string): void {
    c.origen.comparacion = v as Comparacion;
    this.cambio();
  }

  protected formulaTexto(c: ColForm): string {
    return c.origen.tipo === 'fila' ? 'FILA()' : (c.origen.formula ?? '');
  }

  /** FILA() es el número de fila; cualquier otra cosa, una fórmula de Excel. */
  protected formula(c: ColForm, v: string): void {
    c.origen = /^=?\s*FILA\(\)\s*$/i.test(v) ? { tipo: 'fila' } : { tipo: 'formula', formula: v };
    c.sug = false;
    this.cambio();
  }

  // ── ③ Revisar ──
  protected insertables(): string[] {
    return [
      ...this.campos()
        .filter((c) => !c[1])
        .slice(0, 6)
        .map((c) => c[0]),
      'fecha',
      'proceso',
    ];
  }

  protected insertar(k: string): void {
    const t = this.tpl();
    t.nombre_archivo = (t.nombre_archivo ? t.nombre_archivo + (/[_-]$/.test(t.nombre_archivo) ? '' : '_') : '') + `{${k}}`;
    this.cambio();
  }

  protected archivoEj(t: TplForm): string {
    return nombreArchivoEj(t, this.proceso());
  }

  protected alternarTitulo(): void {
    const t = this.tpl();
    t.titulo = t.titulo.length ? [] : [[t.nombre]];
    this.cambio();
  }
}
