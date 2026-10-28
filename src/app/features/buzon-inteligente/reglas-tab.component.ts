// Pestaña «Reglas» del buzón — réplica de `tabReglas` del prototipo validado
// (contexto-recaudos-pac/buzon-inteligente-v2.html): entrada de reglas (pegar o subir
// el prompt, plantilla, proponer desde correos reales, proceso manual), procesos con su
// editor en línea, pendientes, secciones globales, orden de evaluación, discriminación y
// «Probar y publicar». Lo que se edita es el BORRADOR; publicar crea la versión vN que
// usa el worker (061). Con `modo="wiz"` es el paso 2 del asistente «Nuevo buzón»: cada
// proceso se acepta, no hay secciones globales ni publicación (la hace «Activar buzón»).

import { Component, computed, effect, inject, input, OnInit, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import {
  Buzon,
  BuzonApi,
  Categoria,
  EstadoReglas,
  Proceso,
  ProcesoPropuesto,
  PromptBuzon,
  ReglaFija,
} from './buzon.api';
import { BASE_FIELDS, ProcesoEditorComponent } from './proceso-editor.component';
import { EJEMPLO_PROMPT, PLANTILLA_PROMPT } from './reglas-plantilla';

type Modal = 'tpl' | 'ej' | 'pegar' | 'prompt' | 'global' | null;
type Global = 'contexto' | 'fijas' | 'exclusiones';
/** Estado de un proceso dentro del asistente (el borrador ya lo tiene guardado). */
type EstadoWiz = 'ok' | 'propuesta' | 'revisar';

interface Pendiente {
  icono: string;
  texto: string;
  bloquea: boolean;
}

interface FijaEd {
  nombre: string;
  campo: 'remitente_contiene' | 'asunto_contiene' | 'cuerpo_contiene';
  valor: string;
  categoria_id: string;
}

@Component({
  selector: 'alma-reglas-tab',
  imports: [FormsModule, LucideAngularModule, ProcesoEditorComponent],
  styleUrls: ['./buzon-proto.css'],
  template: `
    @let b = buzon();
    @if (cargando()) {
      <p class="xs muted">Cargando reglas…</p>
    } @else if (!esWiz() && !procesos().length && !b.version_reglas && !eligioClasificador()) {
      <!-- Buzón sin reglas: primero se elige quién clasifica. -->
      <div class="glass r-3xl stack" style="padding:24px">
        <div class="row" style="gap:12px">
          <div class="appicon" style="background:linear-gradient(150deg,#FF9F0A,#FF375F)"><lucide-icon name="scroll-text" [size]="20" /></div>
          <div>
            <h2 class="bb" style="font-size:1.1rem">Configura las reglas para empezar</h2>
            <p class="xs muted">El buzón no procesa correos hasta que publiques las reglas. Los demás módulos se activan después.</p>
          </div>
        </div>
        <p class="sm">¿Quién va a clasificar los correos de este buzón?</p>
        <div class="g2">
          <button type="button" class="optcard" (click)="elegirClasificador('prompt')">
            <span class="row sm b"><lucide-icon name="scroll-text" [size]="13" /> Prompt generado por Alma</span>
            <span class="xs muted">Describes los procesos y Alma arma el prompt. Las reglas se editan aquí.</span>
          </button>
          <button type="button" class="optcard" (click)="elegirClasificador('agente')">
            <span class="row sm b"><lucide-icon name="bot" [size]="13" /> Agente propio en Foundry</span>
            <span class="xs muted">Conectas un agente que tu área ya creó. Alma lo invoca y valida sus respuestas.</span>
          </button>
        </div>
      </div>
    } @else {
      @if (!esWiz()) {
        <div class="glass r-2xl stack" style="padding:16px">
          <div class="row between">
            <div>
              <p class="sm b">
                Reglas
                @if (est()?.borrador && b.version_reglas) { <span class="badge b-violet">Borrador v{{ siguiente() }}</span> sobre }
                @if (b.version_reglas) { <span class="badge b-emerald">Vigente v{{ b.version_reglas }}</span> }
                @else { <span class="badge b-slate">Sin versión publicada</span> }
              </p>
              <p class="xs muted" style="margin-top:4px">{{ infoClasificador() }} · {{ procesos().length }} procesos · {{ b.discriminacion.length }} pares de discriminación</p>
            </div>
            <div class="row">
              <button type="button" class="btn outline sm" (click)="abrirPrompt()"><lucide-icon name="eye" [size]="13" /> Ver prompt de este buzón</button>
            </div>
          </div>
          @if (!editable()) {
            <p class="note b-sky"><lucide-icon name="lock" [size]="13" /> <span>Las reglas de este buzón se administran en Foundry: aquí son de solo lectura. Cámbialo en Ajustes → Clasificador para editarlas desde Alma.</span></p>
          }
          <div class="flowsteps">
            @for (s of pasos(); track s[0]; let i = $index) {
              <div [class.done]="i + 1 < paso()" [class.on]="i + 1 === paso()"><b>{{ i + 1 }}. {{ s[0] }}</b><span>{{ s[1] }}</span></div>
            }
          </div>
        </div>
      }

      @if (editable()) {
        <div class="glass r-2xl stack" style="padding:14px 16px;gap:10px">
          <p class="cap"><lucide-icon name="log-in" [size]="13" /> Entrada de reglas · se pueden combinar</p>
          <div class="row">
            <button type="button" class="btn sm" [class.primary]="!esWiz()" [class.outline]="esWiz()" (click)="abrirPegar()"><lucide-icon name="clipboard-paste" [size]="13" /> Pegar o subir prompt</button>
            <button type="button" class="btn outline sm" (click)="modal.set('tpl')"><lucide-icon name="file-text" [size]="13" /> Plantilla de prompt</button>
            <button type="button" class="btn outline sm" [disabled]="proponiendo()" (click)="proponer()"><lucide-icon name="sparkles" [size]="13" /> {{ proponiendo() ? 'Leyendo correos…' : 'Proponer desde correos reales' }}</button>
            <button type="button" class="btn outline sm" (click)="editar(null)"><lucide-icon name="plus" [size]="13" /> Proceso manual</button>
          </div>
          <p class="xxs muted">✦ propuesta de Alma · ✎ ajustado por ti. Todo se puede aceptar tal cual o parametrizar.</p>
        </div>
      }

      <div [class]="editando() || esWiz() ? 'stack' : 'g2'" style="align-items:start">
        <div class="stack">
          @if (!esWiz()) { <h2 class="sm b on-wall">Procesos</h2> }
          @if (editando()?.nuevo) {
            <article class="glass r-2xl stack" style="padding:14px;box-shadow:0 0 0 2px var(--ring)">
              <p class="sm bb">Nuevo proceso</p>
              <alma-proceso-editor [buzon]="b" [procesos]="procesos()" [categorias]="categorias()" [modo]="esWiz() ? 'wiz' : 'buzon'" [siguiente]="siguiente()"
                (guardado)="alGuardar($event, true)" (cancelado)="editando.set(null)" />
            </article>
          }
          @for (p of propuestas(); track p.clave) {
            <article class="glass r-2xl stack" style="padding:14px;gap:8px;border-color:var(--violet)">
              <div class="row between" style="flex-wrap:nowrap;align-items:flex-start">
                <div style="min-width:0">
                  <p class="sm bb">{{ p.nombre }} <span class="key">{{ p.clave }}</span> <span class="badge b-violet"><lucide-icon name="sparkles" [size]="13" /> Propuesta</span>
                    @if (!p.campos.length) { <span class="badge b-sky">Solo categorización</span> }</p>
                  <p class="xs muted">{{ p.descripcion }}</p>
                  <p class="xxs" style="color:var(--violet)">{{ notaPropuesta(p) }}</p>
                </div>
                <div class="row" style="flex-wrap:nowrap">
                  <button type="button" class="btn primary sm" (click)="aceptarPropuesta(p)">Aceptar</button>
                  <button type="button" class="btn ghost danger" (click)="descartarPropuesta(p)" aria-label="Descartar"><lucide-icon name="x" [size]="13" /></button>
                </div>
              </div>
            </article>
          }
          @for (p of procesos(); track p.id) {
            @let abierto = editando()?.id === p.id;
            <article class="glass r-2xl stack" style="padding:14px;gap:8px" [style.opacity]="p.activo ? 1 : 0.6" [style.box-shadow]="abierto ? '0 0 0 2px var(--ring)' : null">
              <div class="row" style="flex-wrap:nowrap;gap:10px;align-items:flex-start">
                <span style="width:5px;height:30px;border-radius:999px;flex:none" [style.background]="p.color || '#5E81AC'"></span>
                <div style="flex:1;min-width:0">
                  <p class="sm bb">{{ p.nombre }} <span class="key">{{ p.clave }}</span>
                    @if (esWiz()) {
                      @switch (estadoWiz(p)) {
                        @case ('ok') { <span class="badge b-emerald"><lucide-icon name="check" [size]="13" /> Revisado</span> }
                        @case ('propuesta') { <span class="badge b-violet"><lucide-icon name="sparkles" [size]="13" /> Propuesta desde correos</span> }
                        @default { <span class="badge b-amber">Por revisar</span> }
                      }
                    }
                    @if (!p.campos_extraer.length) { <span class="badge b-sky">Solo categorización</span> }
                    @if (!p.activo) { <span class="badge b-slate">Desactivado</span> }
                  </p>
                  <p class="xs muted" [class.clamp3]="!verMas()[p.clave]">{{ p.descripcion }}</p>
                  @if ((p.descripcion || '').length > 220) {
                    <button type="button" class="linkbtn xs" style="justify-self:start" (click)="alternarVerMas(p.clave)">{{ verMas()[p.clave] ? 'Ver menos' : 'Ver más' }}</button>
                  }
                </div>
                <div class="row" style="gap:4px;flex-wrap:nowrap">
                  @if (editable()) {
                    <button type="button" class="btn outline sm" (click)="abierto ? editando.set(null) : editar(p)">
                      <lucide-icon [name]="abierto ? 'chevron-up' : 'pencil'" [size]="13" /> {{ abierto ? 'Cerrar' : esWiz() ? 'Abrir' : 'Editar' }}
                    </button>
                    @if (esWiz()) {
                      @if (estadoWiz(p) !== 'ok') { <button type="button" class="btn primary sm" (click)="aceptarWiz(p)">Aceptar</button> }
                      <button type="button" class="btn ghost danger" (click)="descartarWiz(p)" [attr.aria-label]="'Descartar ' + p.clave"><lucide-icon name="trash-2" [size]="13" /></button>
                    } @else {
                      <button type="button" class="btn ghost" (click)="editar(p, true)" [attr.aria-label]="'Duplicar ' + p.clave"><lucide-icon name="copy" [size]="16" /></button>
                      <button type="button" class="btn ghost" (click)="alternarActivo(p)" [attr.aria-label]="(p.activo ? 'Desactivar ' : 'Activar ') + p.clave"><lucide-icon [name]="p.activo ? 'eye-off' : 'eye'" [size]="16" /></button>
                    }
                  }
                  @if (!abierto && !esWiz()) {
                    <button type="button" class="btn ghost" (click)="alternarJson(p.clave)" [attr.aria-label]="'Ver formato JSON de ' + p.clave"><lucide-icon [name]="jsonAbierto() === p.clave ? 'chevron-up' : 'braces'" [size]="16" /></button>
                  }
                </div>
              </div>
              @if (abierto) {
                <alma-proceso-editor [buzon]="b" [proceso]="p" [duplicar]="!!editando()?.duplicar" [procesos]="procesos()" [categorias]="categorias()"
                  [modo]="esWiz() ? 'wiz' : 'buzon'" [siguiente]="siguiente()" (guardado)="alGuardar($event, !!editando()?.duplicar)" (cancelado)="editando.set(null)" />
              } @else {
                <div class="stack" style="gap:4px">
                  @for (e of etiquetasDe(p); track e.id) {
                    <div class="row xs" style="flex-wrap:nowrap;gap:6px">
                      <span class="orig" [class.user]="e.origen === 'user'" [class.ia]="e.origen !== 'user'" [title]="e.origen === 'user' ? 'Ajustado por ti' : 'Propuesta de Alma'">{{ e.origen === 'user' ? '✎' : '✦' }}</span>
                      <span class="chipo"><lucide-icon [name]="e.criterio === 'datos' ? 'filter' : 'sparkles'" [size]="13" /> {{ e.clave }}</span>
                      <span class="muted trunc" [title]="criterioTexto(e)">{{ criterioTexto(e) }}</span>
                    </div>
                  }
                </div>
                <p class="xxs muted"><lucide-icon name="braces" [size]="13" />
                  @if (p.campos_extraer.length) {
                    {{ p.campos_extraer.length }} datos · {{ resumenCampos(p) }}
                  } @else { Sin extracción: la salida es solo la base fija }
                </p>
                @if (jsonAbierto() === p.clave) {
                  <pre class="json"><span class="ln">{{ '{' }}</span><span class="ln base"><span class="c">  // base fija · la agrega Alma</span></span>@for (k of baseFields; track k; let i = $index) {<span class="ln base">  <span class="k">"{{ k }}"</span>: <span [class]="k === 'score_confianza' ? 'n' : 's'">{{ ejemploBase(k, p) }}</span>{{ i < baseFields.length - 1 || p.campos_extraer.length ? ',' : '' }}</span>}@if (p.campos_extraer.length) {<span class="ln"><span class="c">  // datos de interés</span></span>}@for (f of p.campos_extraer; track f.clave; let last = $last) {<span class="ln" [class.idf]="f.identificador">  <span class="k">"{{ f.clave }}"</span>: <span [class]="f.tipo === 'texto' || f.tipo === 'fecha' || !f.tipo ? 's' : 'n'">{{ ejemploCampo(f) }}</span>{{ last ? '' : ',' }}@if (f.critico) {<span class="c"> // crítico{{ f.alterno ? ' (basta uno del grupo)' : '' }}</span>}</span>}<span class="ln">{{ '}' }}</span></pre>
                }
              }
            </article>
          }
          @if (respaldo(); as r) {
            <article class="glass r-2xl stack" style="padding:14px;gap:8px">
              <div class="row" style="flex-wrap:nowrap;gap:10px;align-items:flex-start">
                <span style="width:5px;height:30px;border-radius:999px;flex:none" [style.background]="r.color || '#9E9E9E'"></span>
                <div style="flex:1;min-width:0">
                  <p class="sm bb">{{ r.nombre }} <span class="key">{{ r.clave }}</span></p>
                  <p class="xs muted">Respaldo: lo que no encaja en ningún proceso.</p>
                </div>
              </div>
              <div class="row xs" style="flex-wrap:nowrap;gap:6px"><span class="orig ia">✦</span><span class="chipo"><lucide-icon name="sparkles" [size]="13" /> {{ r.clave }}</span><span class="muted trunc">Respaldo · nunca pasa a Validar</span></div>
              <p class="xxs muted"><lucide-icon name="braces" [size]="13" /> Sin extracción: la salida es solo la base fija</p>
            </article>
          }
          @if (esWiz() && !procesos().length && !propuestas().length && !editando()) {
            <p class="xs muted">Sin procesos todavía.</p>
          }
        </div>

        @if (esWiz()) {
          @if (pendientesWiz().length) {
            <div class="stack" style="gap:6px">
              <div class="row between">
                <p class="xs b">Pendientes</p>
                <button type="button" class="btn outline sm" (click)="copiarPreguntas(pendientesWiz())"><lucide-icon name="copy" [size]="13" /> Copiar como preguntas para la IA</button>
              </div>
              @for (x of pendientesWiz(); track x.texto) {
                <p class="note" [class.b-amber]="x.bloquea" [class.b-sky]="!x.bloquea"><lucide-icon [name]="x.icono" [size]="13" /> <span>{{ x.texto }} @if (x.bloquea) { <b>(bloquea)</b> }</span></p>
              }
            </div>
          } @else if (procesos().length) {
            <p class="note b-emerald"><lucide-icon name="check" [size]="13" /> <span>Reglas completas: puedes continuar.</span></p>
          }
        } @else {
          <div class="stack">
            @if (est()?.borrador && est()!.cambios.length) {
              <div class="glass r-2xl stack" style="padding:16px">
                <div class="row between"><h2 class="sm b"><lucide-icon name="git-compare" [size]="13" /> Cambios en el prompt · borrador v{{ siguiente() }}</h2><span class="badge b-violet">{{ est()!.cambios.length }}</span></div>
                @for (x of est()!.cambios; track $index) {
                  <div class="diff">
                    <p class="xs b">{{ x[0] }}</p>
                    @if (x[1]) { <p class="del">− {{ x[1] }}</p> }
                    <p class="add">+ {{ x[2] }}</p>
                  </div>
                }
              </div>
            }
            <div class="glass r-2xl stack" style="padding:16px">
              <div class="row between">
                <h2 class="sm b"><lucide-icon name="alert-circle" [size]="13" /> Pendientes ({{ pendientes().length }})</h2>
                @if (pendientes().length) {
                  <button type="button" class="btn outline sm" (click)="copiarPreguntas(pendientes())"><lucide-icon name="copy" [size]="13" /> Copiar como preguntas para la IA</button>
                }
              </div>
              @for (x of pendientes(); track x.texto) {
                <p class="note b-amber"><lucide-icon [name]="x.icono" [size]="13" /> <span>{{ x.texto }}</span></p>
              } @empty {
                <p class="note b-emerald"><lucide-icon name="check" [size]="13" /> <span>Sin pendientes.</span></p>
              }
            </div>
            <div class="glass r-2xl stack" style="padding:16px">
              <h2 class="sm b">Secciones globales</h2>
              @for (g of globales(); track g.id) {
                <div class="row between sunk r-xl" style="padding:8px 12px;flex-wrap:nowrap;align-items:flex-start">
                  <div style="min-width:0"><p class="xs b">{{ g.titulo }}</p><p class="xxs muted">{{ g.texto }}</p></div>
                  @if (editable()) {
                    <button type="button" class="btn ghost" (click)="editarGlobal(g.id)" [attr.aria-label]="'Editar ' + g.titulo"><lucide-icon name="pencil" [size]="16" /></button>
                  }
                </div>
              }
              <div class="sunk r-xl" style="padding:8px 12px;display:grid;gap:6px">
                <p class="xs b">Orden de evaluación</p>
                <div class="row" style="gap:6px">
                  @for (p of procesos(); track p.id; let i = $index) {
                    <span class="chipo">{{ i + 1 }}. {{ p.clave }}
                      @if (editable()) {
                        <button type="button" class="mini" (click)="mover(i, -1)" [attr.aria-label]="'Subir ' + p.clave">‹</button>
                        <button type="button" class="mini" (click)="mover(i, 1)" [attr.aria-label]="'Bajar ' + p.clave">›</button>
                      }
                    </span>
                  }
                  @if (respaldo(); as r) { <span class="chipo">{{ procesos().length + 1 }}. {{ r.clave }}</span> }
                </div>
              </div>
            </div>
            @if (b.discriminacion.length) {
              <div class="glass r-2xl stack" style="padding:16px">
                <h2 class="sm b">Discriminación entre procesos</h2>
                @for (d of b.discriminacion; track $index) {
                  <div class="row between sunk r-xl" style="padding:8px 12px;flex-wrap:nowrap">
                    <div style="min-width:0"><p class="xs b"><span class="key">{{ d.a }}</span> ↔ <span class="key">{{ d.b }}</span></p><p class="xxs muted">{{ d.manda }}</p></div>
                    <span class="badge" [class.b-emerald]="!!d.manda.trim()" [class.b-amber]="!d.manda.trim()">{{ d.manda.trim() ? 'Definida' : 'Falta' }}</span>
                  </div>
                }
              </div>
            }
            <div class="glass r-2xl stack" style="padding:16px">
              <h2 class="sm b">Probar y publicar</h2>
              <p class="xs muted">Se prueba contra los últimos 30 correos que las analistas ya corrigieron.</p>
              <div class="row">
                <button type="button" class="btn outline sm" [disabled]="!est()?.borrador || probando()" (click)="probar()"><lucide-icon name="list-checks" [size]="13" /> {{ probando() ? 'Probando…' : 'Probar borrador' }}</button>
                <button type="button" class="btn primary sm" [disabled]="!puedePublicar() || publicando()" (click)="publicar()"><lucide-icon name="upload-cloud" [size]="13" /> Publicar v{{ siguiente() }}</button>
              </div>
              @if (!est()?.borrador) {
                <p class="xxs muted">Edita un proceso, acepta una propuesta o carga un prompt para crear un borrador.</p>
              }
              @if (est()?.prueba; as pr) {
                @if (pr.total) {
                  <div class="g2">
                    <div class="stat"><p class="l">Proceso correcto</p><p class="v">{{ pr.proceso_ok }}/{{ pr.total }}</p></div>
                    <div class="stat"><p class="l">Etiqueta correcta</p><p class="v">{{ pr.etiqueta_ok }}/{{ pr.total }}</p></div>
                  </div>
                  @for (f of pr.fallos; track f.correo_id) {
                    <p class="xxs muted trunc">✗ {{ f.asunto }} · esperaba <span class="key">{{ f.esperado }}</span> y salió <span class="key">{{ f.obtenido || '—' }}</span></p>
                  }
                } @else {
                  <p class="note b-sky"><lucide-icon name="info" [size]="13" /> <span>Aún no hay correos corregidos con qué comparar: puedes publicar.</span></p>
                }
              }
              @if (est()?.versiones?.length) {
                <p class="xxs muted">Historial: @for (v of est()!.versiones.slice(0, 5); track v.version; let last = $last) { v{{ v.version }} · {{ v.publicada_por }} · {{ fecha(v.publicada_en) }}{{ last ? '' : ' — ' }} }</p>
              }
            </div>
          </div>
        }
      </div>
    }

    <!-- ── Modales ── -->
    @if (modal()) {
      <div class="scrim" (click)="cerrarScrim($event)">
        @switch (modal()) {
          @case ('tpl') {
            <div class="modal solid" role="dialog" aria-modal="true" aria-label="Plantilla de prompt">
              <div class="row between"><div><h2 class="sm b">Plantilla de prompt</h2><p class="xs muted">Cópiala en la IA corporativa (Copilot o Claude). La PARTE A le dice a la IA cómo ayudarte; la PARTE B es lo que Alma lee.</p></div><button type="button" class="btn ghost" (click)="modal.set(null)" aria-label="Cerrar"><lucide-icon name="x" [size]="16" /></button></div>
              <pre class="tpl">{{ plantilla }}</pre>
              <div class="row between">
                <button type="button" class="btn outline sm" (click)="modal.set('ej')"><lucide-icon name="book-open" [size]="13" /> Ver ejemplo completo</button>
                <button type="button" class="btn primary sm" (click)="copiar(plantilla, 'Plantilla copiada')"><lucide-icon name="copy" [size]="13" /> Copiar plantilla</button>
              </div>
            </div>
          }
          @case ('ej') {
            <div class="modal solid" role="dialog" aria-modal="true" aria-label="Ejemplo de prompt">
              <div class="row between"><button type="button" class="btn outline sm" (click)="modal.set('tpl')"><lucide-icon name="arrow-left" [size]="13" /> Volver</button><button type="button" class="btn ghost" (click)="modal.set(null)" aria-label="Cerrar"><lucide-icon name="x" [size]="16" /></button></div>
              <h2 class="sm b">Ejemplo completo · Atención a Proveedores (ficticio)</h2>
              <p class="xs muted">Ejemplo inventado de un área ficticia, para ver cómo se llena la PARTE B. No corresponde a ningún buzón real.</p>
              <pre class="tpl">{{ ejemplo }}</pre>
              <div class="row" style="justify-content:flex-end"><button type="button" class="btn primary sm" (click)="usarEjemplo()"><lucide-icon name="clipboard-paste" [size]="13" /> Usar este ejemplo</button></div>
            </div>
          }
          @case ('pegar') {
            @if (analizando()) {
              <div class="modal solid" role="dialog" aria-modal="true" aria-label="Analizando">
                <h2 class="sm b">Alma está leyendo el prompt…</h2>
                <p class="xs muted">Separa procesos, etiquetas, datos a extraer, discriminación y Validar.</p>
              </div>
            } @else {
              <div class="modal solid" role="dialog" aria-modal="true" aria-label="Cargar prompt">
                <div class="row between"><div><h2 class="sm b">Pegar o subir prompt</h2><p class="xs muted">Pega la PARTE B de la plantilla o el prompt completo de tu agente, o sube el .txt / .md. Lo que Alma interprete llega como propuestas para aceptar.</p></div><button type="button" class="btn ghost" (click)="modal.set(null)" aria-label="Cerrar"><lucide-icon name="x" [size]="16" /></button></div>
                <textarea class="input mono" rows="14" style="height:auto" [(ngModel)]="textoPrompt" placeholder="1. CONTEXTO DEL ÁREA&#10;…"></textarea>
                <div class="row between">
                  <label class="btn outline sm" for="prompt-file"><lucide-icon name="file-up" [size]="13" /> Subir .txt o .md</label>
                  <input type="file" id="prompt-file" accept=".txt,.md" hidden (change)="subirPrompt($event)" />
                  <div class="row">
                    <button type="button" class="btn outline sm" (click)="textoPrompt = ejemplo; errorPrompt.set('')">Usar ejemplo</button>
                    <button type="button" class="btn primary sm" (click)="analizar()"><lucide-icon name="sparkles" [size]="13" /> Analizar con Alma</button>
                  </div>
                </div>
                @if (errorPrompt()) { <p class="err">{{ errorPrompt() }}</p> }
              </div>
            }
          }
          @case ('prompt') {
            <div class="modal solid" role="dialog" aria-modal="true" aria-label="Prompt vigente">
              <div class="row between"><h2 class="sm b">Prompt de {{ b.nombre }} · {{ prompt()?.version ? 'v' + prompt()!.version : 'borrador' }}</h2><button type="button" class="btn ghost" (click)="modal.set(null)" aria-label="Cerrar"><lucide-icon name="x" [size]="16" /></button></div>
              @if (b.version_reglas) {
                <div class="pills">
                  <button type="button" [attr.aria-selected]="promptCual() === 'vigente'" (click)="abrirPrompt('vigente')">Vigente v{{ b.version_reglas }}</button>
                  <button type="button" [attr.aria-selected]="promptCual() === 'borrador'" (click)="abrirPrompt('borrador')">Borrador</button>
                </div>
              }
              @if (b.modo_clasificacion === 'agente') {
                <p class="note b-sky"><lucide-icon name="bot" [size]="13" /> <span>Este buzón clasifica con un agente de Foundry: las instrucciones viven en el agente. Abajo, el prompt que Alma armaría con estas reglas.</span></p>
              }
              <pre class="tpl">{{ prompt()?.prompt ?? 'Cargando…' }}</pre>
            </div>
          }
          @case ('global') {
            <div class="modal solid" role="dialog" aria-modal="true" [attr.aria-label]="tituloGlobal()">
              <div class="row between"><h2 class="sm b">{{ tituloGlobal() }}</h2><button type="button" class="btn ghost" (click)="modal.set(null)" aria-label="Cerrar"><lucide-icon name="x" [size]="16" /></button></div>
              @if (globalEd() === 'fijas') {
                <p class="xs muted">Coincidencias exactas que no pasan por la IA: si el correo cumple, recibe la etiqueta.</p>
                @for (f of fijasEd; track $index; let i = $index) {
                  <div class="sunk r-xl" style="padding:10px 12px;display:grid;gap:6px">
                    <div class="row" style="flex-wrap:nowrap">
                      <input class="input sm" [(ngModel)]="f.nombre" placeholder="Nombre de la regla" aria-label="Nombre" />
                      <button type="button" class="btn ghost danger" (click)="fijasEd.splice(i, 1)" aria-label="Quitar"><lucide-icon name="x" [size]="13" /></button>
                    </div>
                    <div class="row" style="flex-wrap:nowrap">
                      <select class="input sm" style="width:auto" [(ngModel)]="f.campo" aria-label="Dónde buscar">
                        <option value="remitente_contiene">Remitente contiene</option><option value="asunto_contiene">Asunto contiene</option><option value="cuerpo_contiene">Cuerpo contiene</option>
                      </select>
                      <input class="input sm" [(ngModel)]="f.valor" placeholder="texto" aria-label="Texto" />
                      <span class="xs">→</span>
                      <select class="input sm" style="width:auto" [(ngModel)]="f.categoria_id" aria-label="Etiqueta">
                        @for (c of etiquetasActivas(); track c.id) { <option [value]="c.id">{{ c.clave }}</option> }
                      </select>
                    </div>
                  </div>
                }
                <button type="button" class="btn outline sm" style="justify-self:start" (click)="fijasEd.push({ nombre: '', campo: 'remitente_contiene', valor: '', categoria_id: etiquetasActivas()[0]?.id ?? '' })"><lucide-icon name="plus" [size]="13" /> Agregar regla fija</button>
              } @else {
                <textarea class="input" rows="8" style="height:auto" [(ngModel)]="textoGlobal"></textarea>
              }
              <div class="row" style="justify-content:flex-end">
                <button type="button" class="btn outline" (click)="modal.set(null)">Cancelar</button>
                <button type="button" class="btn primary" [disabled]="guardandoGlobal()" (click)="guardarGlobal()"><lucide-icon name="save" [size]="16" /> Guardar en el borrador</button>
              </div>
            </div>
          }
        }
      </div>
    }
  `,
})
export class ReglasTabComponent implements OnInit {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly modo = input<'buzon' | 'wiz'>('buzon');
  /** El buzón cambió (contexto, exclusiones, discriminación, clasificador, versión). */
  readonly buzonActualizado = output<Buzon>();
  /** Asistente: ¿se puede continuar al paso 3? */
  readonly listo = output<{ puedeSeguir: boolean; porque: string }>();

  protected readonly plantilla = PLANTILLA_PROMPT;
  protected readonly ejemplo = EJEMPLO_PROMPT;
  protected readonly baseFields = BASE_FIELDS;

  protected readonly cargando = signal(true);
  protected readonly procesos = signal<Proceso[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly fijas = signal<ReglaFija[]>([]);
  protected readonly est = signal<EstadoReglas | null>(null);
  protected readonly propuestas = signal<ProcesoPropuesto[]>([]);
  protected readonly editando = signal<{ id: string | null; nuevo?: boolean; duplicar?: boolean } | null>(null);
  protected readonly modal = signal<Modal>(null);
  protected readonly verMas = signal<Record<string, boolean>>({});
  protected readonly jsonAbierto = signal<string | null>(null);
  protected readonly eligioClasificador = signal(false);
  protected readonly analizando = signal(false);
  protected readonly proponiendo = signal(false);
  protected readonly probando = signal(false);
  protected readonly publicando = signal(false);
  protected readonly errorPrompt = signal('');
  protected readonly prompt = signal<PromptBuzon | null>(null);
  protected readonly promptCual = signal<'vigente' | 'borrador'>('vigente');
  protected readonly globalEd = signal<Global>('contexto');
  protected readonly guardandoGlobal = signal(false);
  /** Asistente: procesos aceptados y los que llegaron como propuesta desde correos. */
  protected readonly aceptados = signal<Set<string>>(new Set());
  private readonly desdeCorreos = signal<Set<string>>(new Set());
  protected textoPrompt = '';
  protected textoGlobal = '';
  protected fijasEd: FijaEd[] = [];

  protected readonly esWiz = computed(() => this.modo() === 'wiz');
  protected readonly siguiente = computed(() => this.est()?.siguiente ?? (this.buzon().version_reglas ?? 0) + 1);
  /** Con agente de Foundry y reglas administradas en Foundry, aquí son de solo lectura. */
  protected readonly editable = computed(() => this.buzon().modo_clasificacion !== 'agente' || this.buzon().reglas_admin === 'alma');
  protected readonly respaldo = computed(() => this.categorias().find((c) => c.es_fallback && c.activa && !this.procesos().some((p) => p.id === c.proceso_id)) ?? null);
  protected readonly etiquetasActivas = computed(() => this.categorias().filter((c) => c.activa));
  protected readonly infoClasificador = computed(() => {
    const b = this.buzon();
    return b.modo_clasificacion === 'agente' ? `Agente Foundry ${b.agente_nombre ?? ''}`.trim() : `Prompt de Alma · ${b.modelo ?? 'modelo de la plataforma'}`;
  });
  protected readonly pasos = computed<[string, string][]>(() => [
    ['Entrada', 'Prompt, correos o manual'],
    ['Revisión', 'Aceptar o parametrizar'],
    ['Discriminación', 'Qué diferencia los procesos'],
    ['Probar', 'Banco de casos'],
    ['Publicar', this.buzon().modo_clasificacion === 'agente' ? 'Al agente' : 'En Alma'],
  ]);
  protected readonly paso = computed(() => (this.est()?.prueba ? 5 : this.est()?.borrador ? 3 : this.procesos().length ? 2 : 1));
  protected readonly puedePublicar = computed(() => {
    const e = this.est();
    return !!e && e.borrador && (!!e.prueba || this.buzon().en_configuracion);
  });

  protected readonly globales = computed(() => {
    const b = this.buzon();
    const fijas = this.fijas().filter((f) => f.activa);
    return [
      { id: 'contexto' as Global, titulo: 'Contexto del área', texto: b.contexto || '—' },
      { id: 'fijas' as Global, titulo: 'Reglas fijas (sin IA)', texto: fijas.length ? fijas.map((f) => `${f.nombre} → ${f.categoria_clave}`).join(' · ') : 'Ninguna' },
      { id: 'exclusiones' as Global, titulo: 'Exclusiones globales', texto: b.exclusiones_globales || '—' },
    ];
  });
  protected readonly tituloGlobal = computed(() => ({ contexto: 'Contexto del área', fijas: 'Reglas fijas', exclusiones: 'Exclusiones globales' })[this.globalEd()]);

  /** Pares de procesos sin discriminación y procesos con una sola etiqueta sin criterio. */
  private readonly faltantes = computed<Pendiente[]>(() => {
    const out: Pendiente[] = [];
    const neg = this.procesos().filter((p) => p.activo);
    const disc = this.buzon().discriminacion;
    for (let i = 0; i < neg.length; i++) {
      for (let j = i + 1; j < neg.length; j++) {
        const [a, c] = [neg[i].clave, neg[j].clave];
        if (!disc.some((d) => (d.a === a && d.b === c) || (d.a === c && d.b === a))) {
          out.push({ icono: 'git-compare', texto: `Define qué diferencia a ${a} de ${c} (pestaña Discriminación).`, bloquea: false });
        }
      }
    }
    for (const c of this.categorias()) {
      if (c.activa && c.proceso_id && c.criterio !== 'datos' && !c.descripcion.trim()) {
        out.push({ icono: 'tag', texto: `La etiqueta ${c.clave} no tiene criterio.`, bloquea: true });
      }
    }
    return out;
  });
  protected readonly pendientes = computed<Pendiente[]>(() => {
    const out = [...this.faltantes()];
    if (this.procesos().filter((p) => p.activo).length === 1) {
      out.unshift({ icono: 'layers', texto: 'Solo hay 1 proceso. ¿El buzón recibe otros tipos de correo? Usa «Proponer desde correos reales».', bloquea: false });
    }
    return out;
  });
  protected readonly pendientesWiz = computed<Pendiente[]>(() => {
    const out: Pendiente[] = [];
    const n = this.procesos().length;
    if (!n) out.push({ icono: 'layers', texto: 'Aún no hay procesos. Pega el prompt, propón desde correos o crea uno manual.', bloquea: true });
    if (n === 1) out.push({ icono: 'layers', texto: 'Solo se detectó 1 proceso. ¿El buzón recibe otros tipos de correo?', bloquea: false });
    const porRevisar = this.procesos().filter((p) => this.estadoWiz(p) !== 'ok').length;
    if (porRevisar) out.push({ icono: 'eye', texto: `${porRevisar} proceso(s) por revisar: ábrelos y pulsa «Aceptar proceso».`, bloquea: true });
    if (this.propuestas().length) out.push({ icono: 'sparkles', texto: `${this.propuestas().length} propuesta(s) sin decidir: acéptalas o descártalas.`, bloquea: true });
    return out.concat(this.faltantes());
  });

  constructor() {
    // El asistente habilita «Continuar» cuando no queda nada que bloquee.
    effect(() => {
      if (!this.esWiz()) return;
      const bloquea = this.pendientesWiz().some((x) => x.bloquea);
      untracked(() => this.listo.emit({ puedeSeguir: !bloquea, porque: bloquea ? 'Acepta todos los procesos y resuelve los pendientes que bloquean' : '' }));
    });
  }

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    const id = this.buzon().id;
    try {
      const [procesos, categorias, fijas, est] = await Promise.all([
        this.api.listarProcesos(id),
        this.api.listarCategorias(id),
        this.api.listarReglas(id),
        this.esWiz() ? Promise.resolve(null) : this.api.estadoReglas(id),
      ]);
      this.procesos.set(procesos);
      this.categorias.set(categorias);
      this.fijas.set(fijas);
      this.est.set(est);
    } catch (e) {
      this.toast.error('No se pudieron cargar las reglas', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private async refrescarBuzon(): Promise<void> {
    this.buzonActualizado.emit(await this.api.obtenerBuzon(this.buzon().id));
  }

  // ── Procesos ──
  protected etiquetasDe(p: Proceso): Categoria[] {
    return this.categorias().filter((c) => c.proceso_id === p.id && c.activa).sort((a, c) => a.orden - c.orden);
  }

  protected criterioTexto(c: Categoria): string {
    return c.criterio === 'datos' && c.condicion ? `${c.condicion.campo} ${c.condicion.op} ${c.condicion.valor}` : c.descripcion;
  }

  protected resumenCampos(p: Proceso): string {
    const fs = p.campos_extraer;
    return fs.slice(0, 5).map((f) => (f.origen === 'user' ? '✎' : '✦') + f.clave).join(', ') + (fs.length > 5 ? '…' : '');
  }

  protected ejemploBase(k: string, p: Proceso): string {
    const etiquetas = this.etiquetasDe(p).map((e) => e.clave).join(' | ');
    return ({
      correlation_id: '"<id del correo>"', fecha_procesamiento: '"YYYY-MM-DD"', proceso: `"${p.clave}"`, score_confianza: '0.0',
      etiqueta: `"${etiquetas} | Validar"`, asunto_correo: '"<asunto exacto>"',
    } as Record<string, string>)[k];
  }

  protected ejemploCampo(f: Proceso['campos_extraer'][number]): string {
    if (f.tipo === 'tabla') return `[ { ${(f.campos ?? []).join(', ') || '…'} } ]`;
    if (f.tipo === 'lista') return '[]';
    if (f.tipo === 'booleano') return 'true | false';
    return `"<${f.descripcion.toLowerCase()} o vacío>"`;
  }

  protected alternarVerMas(k: string): void {
    this.verMas.update((v) => ({ ...v, [k]: !v[k] }));
  }

  protected alternarJson(k: string): void {
    this.jsonAbierto.update((v) => (v === k ? null : k));
  }

  protected editar(p: Proceso | null, duplicar = false): void {
    this.editando.set(p ? { id: p.id, duplicar } : { id: null, nuevo: true });
  }

  protected async alGuardar(p: Proceso, nuevo: boolean): Promise<void> {
    this.editando.set(null);
    if (this.esWiz()) this.aceptados.update((s) => new Set(s).add(p.clave));
    await this.recargar();
    this.toast.show(this.esWiz() ? `${p.clave} aceptado` : `${p.clave} ${nuevo ? 'creado' : 'actualizado'} en el borrador v${this.siguiente()}`);
  }

  private async recargar(): Promise<void> {
    await this.cargar();
    await this.refrescarBuzon();
  }

  protected async alternarActivo(p: Proceso): Promise<void> {
    try {
      await this.api.actualizarProceso(p.id, { ...p, activo: !p.activo });
      await this.recargar();
      this.toast.show(`${p.clave} ${p.activo ? 'desactivado' : 'activado'} en el borrador`);
    } catch (e) {
      this.toast.error('No se pudo cambiar el proceso', e instanceof Error ? e.message : String(e));
    }
  }

  protected async mover(i: number, d: number): Promise<void> {
    const lista = [...this.procesos()];
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    try {
      await Promise.all(lista.map((p, k) => (p.orden === k + 1 ? null : this.api.actualizarProceso(p.id, { ...p, orden: k + 1 }))));
      await this.recargar();
    } catch (e) {
      this.toast.error('No se pudo cambiar el orden', e instanceof Error ? e.message : String(e));
    }
  }

  // ── Asistente ──
  protected estadoWiz(p: Proceso): EstadoWiz {
    if (this.aceptados().has(p.clave)) return 'ok';
    return this.desdeCorreos().has(p.clave) ? 'propuesta' : 'revisar';
  }

  protected aceptarWiz(p: Proceso): void {
    this.aceptados.update((s) => new Set(s).add(p.clave));
    if (this.editando()?.id === p.id) this.editando.set(null);
    this.toast.show(`${p.clave} aceptado`);
  }

  protected async descartarWiz(p: Proceso): Promise<void> {
    try {
      const etiquetas = this.etiquetasDe(p);
      await this.api.eliminarProceso(p.id);
      // Las etiquetas del proceso quedan inactivas (no se borran: pueden tener historial).
      await Promise.all(etiquetas.map((c) => this.api.actualizarCategoria(c.id, { ...c, activa: false })));
      await this.recargar();
      this.toast.show(`${p.clave} descartado`);
    } catch (e) {
      this.toast.error('No se pudo descartar', e instanceof Error ? e.message : String(e));
    }
  }

  // ── Entrada de reglas ──
  protected elegirClasificador(modo: 'prompt' | 'agente'): void {
    this.eligioClasificador.set(true);
    if (modo !== this.buzon().modo_clasificacion) {
      void this.api.actualizarBuzon(this.buzon().id, { modo_clasificacion: modo }).then((b) => this.buzonActualizado.emit(b));
    }
  }

  protected abrirPegar(): void {
    this.textoPrompt = this.textoPrompt || this.buzon().prompt_area || '';
    this.errorPrompt.set('');
    this.modal.set('pegar');
  }

  protected usarEjemplo(): void {
    this.textoPrompt = this.ejemplo;
    this.errorPrompt.set('');
    this.modal.set('pegar');
  }

  protected subirPrompt(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    void f.text().then((t) => {
      this.textoPrompt = t;
      this.errorPrompt.set('');
    });
  }

  protected async analizar(): Promise<void> {
    if (!this.textoPrompt.trim()) {
      this.errorPrompt.set('Pega el prompt o sube el archivo antes de analizar.');
      return;
    }
    this.analizando.set(true);
    try {
      const r = await this.api.analizarPrompt(this.buzon().id, this.textoPrompt);
      if (!r.procesos.length) {
        this.errorPrompt.set('No reconocí procesos, etiquetas ni un JSON de salida en el texto. Revisa que incluya las etiquetas y los datos a extraer, o usa el ejemplo.');
        return;
      }
      this.modal.set(null);
      if (this.esWiz()) {
        // En el asistente se cargan de una vez y quedan «Por revisar».
        await this.api.aplicarPropuesta(this.buzon().id, r, this.textoPrompt);
        await this.recargar();
        this.toast.show(`Alma detectó ${r.procesos.length} proceso(s): revisa y acepta cada uno`);
      } else {
        await this.api.actualizarBuzon(this.buzon().id, { prompt_area: this.textoPrompt });
        this.propuestas.set(r.procesos);
        this.toast.show(`Alma detectó ${r.procesos.length} proceso(s): acéptalos para llevarlos al borrador`);
      }
    } catch (e) {
      this.errorPrompt.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.analizando.set(false);
    }
  }

  protected async proponer(): Promise<void> {
    this.proponiendo.set(true);
    try {
      const r = await this.api.proponerProcesos(this.buzon().id);
      if (this.esWiz()) {
        if (r.procesos.length) {
          await this.api.aplicarPropuesta(this.buzon().id, { procesos: r.procesos, instrucciones: r.instrucciones });
          this.desdeCorreos.update((s) => new Set([...s, ...r.procesos.map((p) => p.clave)]));
          await this.recargar();
        }
      } else {
        this.propuestas.update((v) => [...v, ...r.procesos.filter((p) => !v.some((x) => x.clave === p.clave))]);
      }
      this.toast.show(r.procesos.length ? `${r.procesos.length} propuesta(s) desde los últimos ${r.correos_leidos} correos` : 'Sin propuestas nuevas');
    } catch (e) {
      this.toast.error('No se pudieron leer los correos', e instanceof Error ? e.message : String(e));
    } finally {
      this.proponiendo.set(false);
    }
  }

  protected notaPropuesta(p: ProcesoPropuesto): string {
    return this.procesos().some((x) => x.clave === p.clave)
      ? `Ya existe: al aceptar reemplaza la versión actual de ${p.clave}`
      : 'Nuevo · ' + (p.campos.length ? `${p.campos.length} datos` : 'solo categorización');
  }

  protected async aceptarPropuesta(p: ProcesoPropuesto): Promise<void> {
    try {
      await this.api.aplicarPropuesta(this.buzon().id, { procesos: [p], instrucciones: '' });
      this.propuestas.update((v) => v.filter((x) => x.clave !== p.clave));
      await this.recargar();
      this.toast.show(`${p.clave} agregado al borrador v${this.siguiente()}`);
    } catch (e) {
      this.toast.error('No se pudo aceptar la propuesta', e instanceof Error ? e.message : String(e));
    }
  }

  protected descartarPropuesta(p: ProcesoPropuesto): void {
    this.propuestas.update((v) => v.filter((x) => x.clave !== p.clave));
    this.toast.show('Propuesta descartada');
  }

  protected copiarPreguntas(lista: Pendiente[]): void {
    this.copiar('Revisa la PARTE B y responde estas preguntas antes de devolverla:\n- ' + lista.map((x) => x.texto).join('\n- '), 'Preguntas copiadas: pégalas en la IA');
  }

  protected copiar(texto: string, aviso: string): void {
    void navigator.clipboard?.writeText(texto).then(
      () => this.toast.show(aviso),
      () => this.toast.error('No se pudo copiar al portapapeles'),
    );
  }

  // ── Secciones globales ──
  protected editarGlobal(s: Global): void {
    const b = this.buzon();
    this.globalEd.set(s);
    if (s === 'fijas') {
      this.fijasEd = this.fijas().map((f) => {
        const campo = f.remitente_contiene ? 'remitente_contiene' : f.asunto_contiene ? 'asunto_contiene' : 'cuerpo_contiene';
        return { nombre: f.nombre, campo, valor: f[campo] ?? '', categoria_id: f.categoria_id };
      });
    } else {
      this.textoGlobal = (s === 'contexto' ? b.contexto : b.exclusiones_globales) ?? '';
    }
    this.modal.set('global');
  }

  protected async guardarGlobal(): Promise<void> {
    const id = this.buzon().id;
    this.guardandoGlobal.set(true);
    try {
      const s = this.globalEd();
      if (s === 'fijas') {
        // Se reemplaza el conjunto: las que se quitaron se borran, las demás se recrean en orden.
        const validas = this.fijasEd.filter((f) => f.nombre.trim() && f.valor.trim() && f.categoria_id);
        await Promise.all(this.fijas().map((f) => this.api.eliminarRegla(f.id)));
        for (const [i, f] of validas.entries()) {
          await this.api.crearRegla(id, {
            nombre: f.nombre.trim(), remitente_contiene: null, asunto_contiene: null, cuerpo_contiene: null,
            [f.campo]: f.valor.trim(), categoria_id: f.categoria_id, orden: i + 1, activa: true,
          });
        }
      } else {
        const texto = this.textoGlobal.trim() || null;
        await this.api.actualizarBuzon(id, s === 'contexto' ? { contexto: texto } : { exclusiones_globales: texto });
      }
      this.modal.set(null);
      await this.recargar();
      this.toast.show(`${this.tituloGlobal()} guardado en el borrador`);
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardandoGlobal.set(false);
    }
  }

  // ── Probar, publicar y ver prompt ──
  protected async probar(): Promise<void> {
    this.probando.set(true);
    try {
      const r = await this.api.probarBorrador(this.buzon().id);
      this.est.set(await this.api.estadoReglas(this.buzon().id));
      this.toast.show(r.total ? `Prueba completada: ${r.proceso_ok}/${r.total} procesos correctos` : 'Aún no hay correos corregidos para comparar');
    } catch (e) {
      this.toast.error('No se pudo probar el borrador', e instanceof Error ? e.message : String(e));
    } finally {
      this.probando.set(false);
    }
  }

  protected async publicar(): Promise<void> {
    this.publicando.set(true);
    try {
      const r = await this.api.publicarReglas(this.buzon().id);
      await this.recargar();
      this.toast.show(`Reglas v${r.version} publicadas`);
    } catch (e) {
      this.toast.error('No se pudieron publicar las reglas', e instanceof Error ? e.message : String(e));
    } finally {
      this.publicando.set(false);
    }
  }

  protected async abrirPrompt(cual?: 'vigente' | 'borrador'): Promise<void> {
    const c = cual ?? (this.buzon().version_reglas ? 'vigente' : 'borrador');
    this.promptCual.set(c);
    this.prompt.set(null);
    this.modal.set('prompt');
    try {
      this.prompt.set(await this.api.verPrompt(this.buzon().id, c));
    } catch (e) {
      this.toast.error('No se pudo armar el prompt', e instanceof Error ? e.message : String(e));
    }
  }

  protected cerrarScrim(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget && !this.analizando()) this.modal.set(null);
  }

  protected fecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  }
}
