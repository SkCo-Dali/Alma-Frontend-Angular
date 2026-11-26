// Bandeja del Buzón Inteligente 2.0 — réplica de la bandeja del prototipo validado con
// Recaudos (contexto-recaudos-pac/buzon-inteligente-v2.html, vBandeja + detalle):
// filtros Todos · Validar · Posibles duplicados · Ejecutados · Ignorados; lista de
// correos con proceso, confianza, «¿Duplicado?» y «Respondió»; detalle con la etiqueta,
// el proceso, la confianza, quién clasificó, a quién se asignó y por qué, las acciones
// (aprobar y ejecutar, reclasificar, ignorar, duplicado sí/no, ajuste manual) y las
// pestañas Lo que vio Alma · Asignación · Archivo · Hilo · Traza.

import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AccessDeniedComponent } from '../../shared/components/access-denied.component';
import { AttachmentPreviewComponent } from '../visor-comunicaciones/attachment-preview.component';
import { EmailFrameComponent } from '../visor-comunicaciones/email-frame.component';
import { EmlService } from '../visor-comunicaciones/eml.service';
import { ParsedEml } from '../visor-comunicaciones/eml.types';
import {
  ArchivoCorreo,
  Buzon,
  BuzonApi,
  CampoProceso,
  Categoria,
  CeldasArchivo,
  Correo,
  CorreoDetalle,
  EstadoCorreo,
  Grupo,
  HiloCorreo,
  PERM_VER_BUZON,
  Persona,
  Proceso,
  resumenAccion,
} from './buzon.api';
import { VolverInicioComponent } from '../../shared/components/volver-inicio.component';

type Filtro = 'todos' | 'validar' | 'duplicado' | 'ejecutado' | 'ignorado';
type Pestana = 'ia' | 'asig' | 'arch' | 'hilo' | 'traza';

/** Un campo en el editor de datos (modo tabla). */
interface CampoEdicion {
  clave: string;
  tipo: 'texto' | 'numero' | 'fecha' | 'booleano' | 'lista';
  valor: string;
  critico: boolean;
}

/** Celda de la vista previa del archivo. */
interface CeldaVista {
  v: string;
  cls: string;
  titulo?: string;
}

const COLOR_GRIS = '#8E8E93';
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

@Component({
  selector: 'alma-bandeja-buzon',
  imports: [VolverInicioComponent, FormsModule, RouterLink, LucideAngularModule, AccessDeniedComponent, EmailFrameComponent, AttachmentPreviewComponent],
  styleUrls: ['./buzon-proto.css'],
  styles: [
    `
      .md { display: flex; gap: 16px; height: calc(100dvh - 15rem); min-height: 600px; }
      .md aside { width: 380px; flex: none; display: flex; flex-direction: column; overflow: hidden; border-radius: 16px; }
      .md section { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: 16px; }
      @media (max-width: 900px) { .md { flex-direction: column; height: auto; } .md aside { width: 100%; max-height: 46vh; } .md section { min-height: 620px; } }
      .lh { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent); }
      .list { overflow-y: auto; flex: 1; }
      .mail-it { display: grid; gap: 4px; width: 100%; text-align: left; border: 0; border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent); background: transparent; padding: 12px 16px; cursor: pointer; }
      .mail-it:hover { background: var(--sunken); }
      .mail-it.sel { background: color-mix(in srgb, var(--primary) 10%, transparent); }
      .mail-it .top { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .dh { padding: 16px 20px; border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent); display: grid; gap: 12px; }
      .catpill { display: inline-flex; align-items: center; gap: 8px; border-radius: 12px; padding: 6px 12px; font-size: 0.875rem; font-weight: 650; color: #fff; }
      .infopill { display: inline-flex; align-items: center; gap: 6px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--border) 80%, transparent); padding: 6px 12px; font-size: 0.75rem; color: var(--muted-foreground); }
      .infopill b { color: var(--foreground); }
      .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; border-radius: 12px; background: var(--sunken); padding: 10px; }
      .dtabs { display: flex; gap: 4px; padding: 8px 20px; border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent); overflow-x: auto; }
      .dtabs button { display: flex; align-items: center; gap: 6px; border: 0; background: transparent; border-radius: 8px; padding: 6px 12px; font-size: 0.75rem; font-weight: 550; cursor: pointer; color: var(--muted-foreground); white-space: nowrap; }
      .dtabs button:hover { background: var(--accent); }
      .dtabs button[aria-selected='true'] { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary-ink); }
      .dtabs .dotb { width: 7px; height: 7px; border-radius: 50%; background: var(--amber); }
      .dbody { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
      .dbody > * { flex-shrink: 0; }
      /* Resumen y acciones lado a lado; los datos estructurados abajo, a todo el ancho. */
      .ia-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
      .ia-grid > .stack { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; align-items: start; }
      .ia-grid dl.kv dd .chipo { white-space: normal; overflow-wrap: anywhere; margin-bottom: 4px; }
      .ia-grid table.t td { white-space: nowrap; }
      /* Nada se sale del recuadro: lo ancho se desplaza dentro y el JSON parte las líneas largas. */
      .ia-grid .box { grid-template-columns: minmax(0, 1fr); }
      .ia-grid pre.json .ln { white-space: pre-wrap; overflow-wrap: anywhere; }
      .eml { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; min-height: 320px; display: flex; flex-direction: column; }
    `,
  ],
  template: `
    @if (!puedeVer()) {
      <alma-access-denied />
    } @else {
      <div class="page">
        <div class="row" style="flex-wrap:nowrap">
          <div class="flex shrink-0 items-center gap-2">
            <alma-volver-inicio />
            <a routerLink="/apps/buzon-inteligente" class="back glass"><lucide-icon name="arrow-left" [size]="16" /> Buzón Inteligente</a>
          </div>
          <label class="glass search" style="flex:1;min-width:220px" for="q">
            <lucide-icon name="search" [size]="16" class="muted" />
            <input id="q" type="search" placeholder="Buscar por asunto, remitente o resumen…" [(ngModel)]="q" (keyup.enter)="aplicar()" (search)="aplicar()" />
          </label>
          @if (buzones().length > 1) {
            <select id="f-buzon" class="input glass" style="width:200px" [(ngModel)]="buzonId" (ngModelChange)="cambiarBuzon()" aria-label="Buzón">
              <option value="">Todos los buzones</option>
              @for (b of buzones(); track b.id) { <option [value]="b.id">{{ b.nombre }}</option> }
            </select>
          }
          @if (opcionesProceso(); as ops) {
            @if (ops.length) {
              <select id="f-proceso" class="input glass" style="width:220px" [(ngModel)]="procesoSel" (ngModelChange)="aplicar()" aria-label="Proceso">
                <option value="">Todos los procesos</option>
                @for (p of ops; track p.clave) { <option [value]="p.clave">{{ p.nombre }} · {{ p.clave }}</option> }
                <option [value]="SIN_PROCESO">OTROS · sin proceso</option>
              </select>
            }
          }
          @if (api.modoDemo()) { <span class="demo"><lucide-icon name="flask-conical" [size]="12" /> Demostración</span> }
        </div>

        <div class="chipbar">
          @for (e of chips; track e.id) {
            <button type="button" [class.glass]="filtro !== e.id" [attr.aria-pressed]="filtro === e.id" (click)="cambiarFiltro(e.id)">
              <lucide-icon [name]="e.icon" [size]="13" /> {{ e.nombre }}
              @if (e.id === 'validar' && porValidar()) { <span class="n">{{ porValidar() }}</span> }
            </button>
          }
          <span class="sep"></span>
          <button type="button" [class.glass]="!sinAsignar" [attr.aria-pressed]="sinAsignar" (click)="alternarSinAsignar()" title="Correos de un grupo que quedaron sin responsable">
            <lucide-icon name="user-x" [size]="13" /> Sin asignar
          </button>
        </div>

        <div class="md">
          <!-- Lista -->
          <aside class="glass">
            <div class="lh">
              <div><p class="sm bb">Correos</p><p class="xs muted">{{ total() }} resultado{{ total() === 1 ? '' : 's' }}</p></div>
              <button type="button" class="btn ghost" aria-label="Actualizar" (click)="aplicar()"><lucide-icon name="refresh-cw" [size]="16" [class.animate-spin]="cargandoLista()" /></button>
            </div>
            <div class="list">
              @for (c of correos(); track c.id) {
                <button type="button" class="mail-it" [class.sel]="seleccionado()?.id === c.id" (click)="seleccionar(c)">
                  <div class="top">
                    <span class="dot" [style.background]="c.categoria_color || gris"></span>
                    <span class="trunc sm b" style="flex:1">{{ c.asunto || '(sin asunto)' }}</span>
                    <span class="xxs muted">{{ hora(c.recibido_en) }}</span>
                  </div>
                  <p class="trunc xs muted">{{ c.remitente_nombre || c.remitente }}</p>
                  <div class="row" style="gap:6px">
                    <span class="badge" [class]="'badge ' + estadoBadge(c.estado).cls">{{ estadoBadge(c.estado).nombre }}</span>
                    @if (etiquetaLista(c); as et) { <span class="chipo">{{ et }}</span> }
                    @if (c.duplicado_estado === 'posible') { <span class="badge b-violet">¿Duplicado?</span> }
                    @if (c.respuestas) { <span class="badge b-sky">Respondió</span> }
                    @if (c.confianza !== null) { <span class="xxs" style="margin-left:auto" [style.color]="colorConf(c.confianza)">{{ pct(c.confianza) }}</span> }
                    @if (c.tiene_adjuntos) { <lucide-icon name="paperclip" [size]="13" class="muted" [style.margin-left]="c.confianza === null ? 'auto' : '0'" /> }
                  </div>
                </button>
              } @empty {
                @if (!cargandoLista()) {
                  <div class="empty"><div><lucide-icon name="mail-check" [size]="22" /><p class="sm b" style="margin-top:8px">Nada pendiente aquí</p><p class="xs muted">Cambia los filtros para ver otros correos.</p></div></div>
                }
              }
              @if (hayMas()) {
                <div style="padding:10px;text-align:center"><button type="button" class="btn outline sm" (click)="masResultados()">Ver más</button></div>
              }
            </div>
          </aside>

          <!-- Detalle -->
          <section class="glass">
            @if (detalle(); as c) {
              <header class="dh">
                <div class="row between" style="align-items:flex-start;flex-wrap:nowrap">
                  <div style="min-width:0;flex:1">
                    <h2 style="font-size:1rem" class="bb">{{ c.asunto || '(sin asunto)' }}</h2>
                    <p class="xs muted" style="margin-top:2px">
                      <b style="color:var(--foreground)">{{ c.remitente_nombre || c.remitente }}</b> &lt;{{ c.remitente }}&gt; · {{ cuando(c.recibido_en) }} · buzón {{ c.buzon_nombre }} ·
                      <span class="mono">{{ c.id.slice(0, 8).toUpperCase() }}</span>
                    </p>
                  </div>
                  <span [class]="'badge ' + estadoBadge(c.estado).cls">{{ estadoBadge(c.estado).nombre }}</span>
                </div>

                <div class="row">
                  <span class="catpill" [style.background]="c.estado === 'revision' ? '#F57C00' : c.categoria_color || gris">
                    <lucide-icon name="tag" [size]="13" /> {{ c.estado === 'revision' ? 'Validar' : c.categoria_clave || 'Sin etiqueta' }}
                  </span>
                  @if (c.proceso_clave) { <span class="infopill"><lucide-icon name="layers" [size]="13" /> Proceso <b>{{ c.proceso_clave }}</b></span> }
                  @if (c.estado === 'revision' && c.categoria_clave) { <span class="infopill"><lucide-icon name="sparkles" [size]="13" /> Sugerida <b>{{ c.categoria_clave }}</b></span> }
                  @if (c.confianza !== null) { <span class="infopill"><lucide-icon name="gauge" [size]="13" /> <b [style.color]="colorConf(c.confianza)">{{ pct(c.confianza) }}</b></span> }
                  <span class="infopill"><lucide-icon [name]="c.origen === 'regla' ? 'list-filter' : 'sparkles'" [size]="13" /> {{ origenTexto(c) }}</span>
                  @if (asignadoTexto(c); as a) {
                    <span class="infopill"><lucide-icon [name]="a.icon" [size]="13" /> @if (a.quien) { Asignado a <b>{{ a.quien }}</b> · } {{ a.via }}</span>
                  }
                </div>

                @if (motivoValidar(c); as m) {
                  <p class="note b-amber"><lucide-icon name="alert-triangle" [size]="13" /> <span><b>Validar:</b> {{ m }}</span></p>
                }
                @if (c.duplicado_estado === 'posible') {
                  <p class="note b-violet"><lucide-icon name="copy" [size]="13" /> <span><b>Posible duplicado de «{{ c.duplicado_asunto }}».</b> Misma llave de negocio en otro correo.</span></p>
                }
                @if (c.estado === 'error' && c.error) {
                  <p class="note b-rose"><lucide-icon name="x-circle" [size]="13" /> <span><b>Error:</b> {{ c.error }}</span></p>
                }

                @if (c.estado === 'revision' || c.estado === 'error' || ajuste() === c.id) {
                  <div class="actions">
                    @if (c.estado === 'ejecutado') {
                      <span class="xs b" style="width:100%"><lucide-icon name="sliders-horizontal" [size]="13" /> Ajuste manual: cambia la etiqueta y vuelve a ejecutar sus acciones</span>
                    }
                    @if (c.duplicado_estado === 'posible') {
                      <button type="button" class="btn primary sm" [disabled]="accionando()" (click)="duplicado(true)"><lucide-icon name="copy-check" [size]="13" /> Es duplicado</button>
                      <button type="button" class="btn outline sm" [disabled]="accionando()" (click)="duplicado(false)">No es duplicado</button>
                    } @else {
                      <select class="input sm" id="cat-dec" style="width:230px" [(ngModel)]="categoriaDecision" aria-label="Etiqueta">
                        @for (g of etiquetasPorProceso(c.buzon_id); track g.proceso) {
                          <optgroup [label]="g.proceso">
                            @for (e of g.etiquetas; track e.id) { <option [value]="e.id">{{ e.clave }}</option> }
                          </optgroup>
                        }
                      </select>
                      <button type="button" class="btn primary sm" [disabled]="accionando() || !categoriaDecision || !!envio()" (click)="aprobar()"><lucide-icon name="check" [size]="13" /> Aprobar y ejecutar</button>
                      <button type="button" class="btn outline sm" [disabled]="accionando()" (click)="reclasificar()"><lucide-icon name="sparkles" [size]="13" /> Reclasificar</button>
                    }
                    @if (c.estado !== 'ejecutado') {
                      <button type="button" class="btn sm" style="margin-left:auto;color:var(--muted-foreground)" [disabled]="accionando()" (click)="ignorar()"><lucide-icon name="mail-x" [size]="13" /> Ignorar</button>
                    } @else {
                      <button type="button" class="btn sm" style="margin-left:auto;color:var(--muted-foreground)" (click)="ajuste.set(null)">Cancelar</button>
                    }
                  </div>
                  @if (envio(); as e) {
                    <div class="sunk r-xl stack" style="padding:12px;gap:8px" role="group" aria-label="Envío al aprobar">
                      <p class="sm b"><lucide-icon [name]="e.grupo.destino === 'reenviar' ? 'forward' : 'reply'" [size]="13" />
                        {{ e.grupo.destino === 'reenviar' ? 'Se reenviará a ' + (e.grupo.destinatarios ?? []).join(', ') : 'Se responderá a ' + c.remitente }}</p>
                      <p class="xxs muted">Grupo {{ e.grupo.nombre }} · sale desde la cuenta conectada al buzón y el correo se queda en la carpeta vigilada.</p>
                      @if (e.grupo.mensaje) { <p class="xs" style="white-space:pre-line;border-left:3px solid var(--border);padding-left:8px">{{ e.grupo.mensaje }}</p> }
                      <label class="label" for="msg-envio">Tu mensaje (opcional){{ e.grupo.destino === 'responder' ? ': por ejemplo, el motivo por el que no se acepta' : '' }}</label>
                      <textarea class="input sm" id="msg-envio" rows="3" maxlength="2000" [(ngModel)]="mensajeEnvio"></textarea>
                      <div class="row" style="justify-content:flex-end">
                        <button type="button" class="btn outline sm" [disabled]="accionando()" (click)="envio.set(null)">Cancelar</button>
                        <button type="button" class="btn primary sm" [disabled]="accionando()" (click)="confirmarEnvio()"><lucide-icon name="send" [size]="13" /> Enviar y ejecutar</button>
                      </div>
                    </div>
                  }
                } @else if (c.estado === 'ejecutado' && c.origen !== 'regla') {
                  <div class="row">
                    <button type="button" class="btn outline sm" (click)="iniciarAjuste(c)"><lucide-icon name="sliders-horizontal" [size]="13" /> Ajuste manual</button>
                    <span class="xxs muted">Ejecutado. Úsalo solo si la etiqueta quedó mal.</span>
                  </div>
                }
              </header>

              <div class="dtabs" role="tablist">
                @for (t of pestanas(); track t.id) {
                  <button type="button" role="tab" [attr.aria-selected]="pestana() === t.id" (click)="abrirPestana(t.id)">
                    <lucide-icon [name]="t.icon" [size]="13" /> {{ t.nombre }}
                    @if (t.id === 'arch' && borradorDesactualizado()) { <span class="dotb" title="Hay una versión nueva"></span> }
                  </button>
                }
              </div>

              <div class="dbody">
                @switch (pestana()) {
                  <!-- ── Lo que vio Alma ── -->
                  @case ('ia') {
                    @if (efecto(); as ef) {
                      <div class="stack" style="gap:8px">
                        <div class="note b-emerald"><lucide-icon name="check-circle-2" [size]="13" /> <span><b>Versión {{ versionDatos() }} guardada.</b> {{ ef.resumen }}</span></div>
                        @if (ef.archivo) {
                          <div class="effect">
                            <lucide-icon name="file-spreadsheet" [size]="15" />
                            <span style="flex:1">La vista previa del archivo ya está en v{{ ef.archivo }}.@if (borrador(); as b) { El borrador del hilo sigue con la v{{ b.version }}. }</span>
                            <button type="button" class="btn primary sm" (click)="abrirPestana('arch')">Ver archivo</button>
                          </div>
                        }
                        @if (ef.criticos.length) {
                          <div class="effect">
                            <lucide-icon name="route" [size]="15" />
                            <span style="flex:1">Cambió <b class="mono">{{ ef.criticos.join(', ') }}</b>. ¿Recalcular la asignación?</span>
                            <button type="button" class="btn outline sm" (click)="recalcular()">Recalcular</button>
                            <button type="button" class="btn sm" (click)="efecto.set(null)">Mantener</button>
                          </div>
                        }
                      </div>
                    }
                    <div class="ia-grid">
                      <div class="stack">
                        <div class="box sunk">
                          <p class="cap"><lucide-icon name="sparkles" [size]="13" /> Resumen de Nova</p>
                          <p class="sm">{{ c.resumen || 'Sin resumen.' }}</p>
                          @if (porQue(c); as pq) { <p class="cap" style="margin-top:6px">Por qué</p><p class="xs muted">{{ pq }}</p> }
                        </div>
                        <div class="box line">
                          <p class="cap"><lucide-icon name="zap" [size]="13" /> {{ c.estado === 'ejecutado' ? 'Acciones ejecutadas' : 'Acciones previstas' }}</p>
                          <div class="stack" style="gap:6px">
                            @for (a of acciones(c); track $index) {
                              <div class="row sm" style="flex-wrap:nowrap">
                                <lucide-icon [name]="a.icon" [size]="13" />
                                <span class="trunc" style="flex:1">{{ a.texto }}</span>
                                @if (a.estado) { <span class="badge" [class]="'badge ' + (a.estado === 'ok' ? 'b-emerald' : a.estado === 'error' ? 'b-rose' : 'b-slate')">{{ a.estado }}</span> }
                              </div>
                            } @empty {
                              <p class="xs muted">Sin acciones configuradas para esta etiqueta.</p>
                            }
                          </div>
                        </div>
                      </div>

                      <div class="box line">
                        <div class="row between">
                          <p class="cap"><lucide-icon name="braces" [size]="13" /> Datos estructurados (JSON)</p>
                          @if (editando()) { <span class="badge b-sky">Editando</span> }
                        </div>
                        @if (!editando()) {
                          @if (verJson()) {
                            <pre class="json">@for (l of jsonLineas(c); track $index) {<span class="ln" [class.base]="l.base">{{ l.texto }}</span>}</pre>
                            <p class="xxs muted">Salida tal como quedó guardada. Azul: base fija (proceso, etiqueta, confianza, asunto).</p>
                            <div class="row between"><button type="button" class="btn outline sm" (click)="verJson.set(false)"><lucide-icon name="table" [size]="13" /> Ver como tabla</button></div>
                          } @else {
                            @if (simples(c).length) {
                              <dl class="kv">
                                @for (kv of simples(c); track kv.clave) {
                                  <dt>{{ kv.clave }} @if (kv.critico) { <span title="Campo crítico" style="color:var(--amber)">*</span> }</dt>
                                  <dd>
                                    @if (kv.vacio) { <span class="badge b-amber">vacío</span> }
                                    @else if (kv.lista) { @for (x of kv.lista; track $index) { <span class="chipo" style="margin-right:4px">{{ x }}</span> } }
                                    @else if (kv.bool !== null) { <span [class]="'badge ' + (kv.bool ? 'b-emerald' : 'b-rose')">{{ kv.bool }}</span> }
                                    @else { {{ kv.valor }} }
                                  </dd>
                                }
                              </dl>
                            } @else {
                              <p class="xs muted">Este proceso solo se categoriza: no hay datos que corregir.</p>
                            }
                            @for (t of tablas(c); track t.clave) {
                              <p class="cap" style="margin-top:6px">{{ t.clave }} [{{ t.filas.length }}]</p>
                              <div class="scroll-x">
                                <table class="t">
                                  <thead><tr>@for (col of t.columnas; track col) { <th class="mono xxs">{{ col }}</th> }</tr></thead>
                                  <tbody>
                                    @for (f of t.filas; track $index) {
                                      <tr>@for (col of t.columnas; track col) { <td class="xs">@if (f[col]) { {{ f[col] }} } @else { <span class="badge b-amber">falta</span> }</td> }</tr>
                                    }
                                  </tbody>
                                </table>
                              </div>
                            }
                            @if (hayCriticos(c)) { <p class="xxs muted"><span style="color:var(--amber)">*</span> campo crítico según el prompt</p> }
                            <div class="row between">
                              <span class="stamp"><lucide-icon name="history" [size]="13" /> Versión {{ versionDatos() }} · {{ ultimaCorreccion() }}</span>
                              <div class="row">
                                <button type="button" class="btn outline sm" (click)="verJson.set(true)"><lucide-icon name="braces" [size]="13" /> Ver JSON completo</button>
                                @if (c.datos_extraidos) { <button type="button" class="btn outline sm" (click)="editar(c)"><lucide-icon name="pencil" [size]="13" /> Corregir datos</button> }
                              </div>
                            </div>
                          }
                        } @else {
                          <div class="row between">
                            <div class="pills">
                              <button type="button" [attr.aria-selected]="modoEdicion() === 'tabla'" (click)="cambiarModo('tabla')"><lucide-icon name="table" [size]="13" /> Tabla</button>
                              <button type="button" [attr.aria-selected]="modoEdicion() === 'json'" (click)="cambiarModo('json')"><lucide-icon name="braces" [size]="13" /> JSON</button>
                            </div>
                            <span class="xxs muted">Se valida contra el formato de {{ c.proceso_clave || 'la etiqueta' }}</span>
                          </div>
                          <div class="lock">
                            <span><lucide-icon name="lock" [size]="12" /> // base fija · solo lectura</span>
                            <span>"proceso": "{{ c.proceso_clave }}", "etiqueta": "{{ c.categoria_clave }}", "score_confianza": {{ c.confianza }}, "asunto_correo": "…"</span>
                          </div>
                          @if (modoEdicion() === 'json') {
                            <textarea class="code-ed" spellcheck="false" aria-label="JSON editable" [(ngModel)]="jsonTexto"></textarea>
                          } @else {
                            <div class="g2">
                              @for (f of campos(); track f.clave) {
                                <div class="fld">
                                  <label class="label mono" [for]="'tf-' + f.clave">{{ f.clave }}@if (f.critico) { * } @if (f.tipo === 'lista') { <span class="xxs">(separados por coma)</span> }</label>
                                  @if (f.tipo === 'booleano') {
                                    <select class="input sm" [id]="'tf-' + f.clave" [(ngModel)]="f.valor"><option value="true">true</option><option value="false">false</option></select>
                                  } @else {
                                    <input class="input sm" [id]="'tf-' + f.clave" [(ngModel)]="f.valor" [placeholder]="f.tipo === 'fecha' ? 'AAAA-MM-DD' : ''" />
                                  }
                                </div>
                              }
                            </div>
                            @for (t of tablasEdicion(); track t.clave) {
                              <p class="cap">{{ t.clave }} [{{ t.filas.length }}]</p>
                              <div class="scroll-x">
                                <table class="t">
                                  <thead><tr>@for (col of t.columnas; track col) { <th class="mono xxs">{{ col }}</th> }<th></th></tr></thead>
                                  <tbody>
                                    @for (f of t.filas; track $index; let i = $index) {
                                      <tr>
                                        @for (col of t.columnas; track col) {
                                          <td style="padding:4px"><input class="input sm" [style.min-width.px]="col === 'nombre' ? 170 : 80" [(ngModel)]="f[col]" [attr.aria-label]="col + ' fila ' + (i + 1)" /></td>
                                        }
                                        <td style="padding:4px"><button type="button" class="btn ghost danger" aria-label="Quitar fila" (click)="quitarFila(t.clave, i)"><lucide-icon name="trash-2" [size]="13" /></button></td>
                                      </tr>
                                    }
                                  </tbody>
                                </table>
                              </div>
                              <button type="button" class="btn outline sm" style="justify-self:start" (click)="agregarFila(t.clave)"><lucide-icon name="plus" [size]="13" /> Agregar fila</button>
                            }
                          }
                          @if (errores().length) {
                            <div class="note b-rose" style="display:grid">@for (e of errores(); track $index) { <span>• {{ e }}</span> }</div>
                          }
                          <div class="row" style="justify-content:flex-end">
                            <button type="button" class="btn outline sm" (click)="editando.set(false)">Cancelar</button>
                            <button type="button" class="btn primary sm" [disabled]="guardando()" (click)="guardar(c)"><lucide-icon name="save" [size]="13" /> Guardar corrección</button>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- ── Asignación ── -->
                  @case ('asig') {
                    <div class="g2" style="align-items:start">
                      <div class="box line">
                        <p class="cap"><lucide-icon name="route" [size]="13" /> Recorrido de la asignación</p>
                        @if (sinGrupoDe(c); as clave) {
                          <p class="xxs muted" style="margin:2px 0 6px">La etiqueta {{ clave }} no tiene grupo de Asignación ·
                            <a class="linkbtn xxs" [routerLink]="['/apps/buzon-inteligente/buzones', c.buzon_id]" [queryParams]="{ tab: 'asig' }">Configurar</a></p>
                        }
                        @if (c.asignacion_traza.length) {
                          <ol class="tl">
                            @for (t of c.asignacion_traza; track $index) { <li [class]="t.estado"><p class="sm b">{{ t.titulo }}</p>@if (t.detalle) { <p class="w">{{ t.detalle }}</p> }</li> }
                          </ol>
                        } @else {
                          <p class="xs muted">Este buzón aún no usa la asignación por grupos: se aplican las acciones de la etiqueta.</p>
                        }
                      </div>
                      <div class="box sunk">
                        <p class="cap"><lucide-icon name="folder-input" [size]="13" /> Resultado</p>
                        <p class="sm">{{ resultadoAsignacion(c) }}</p>
                        <p class="xs muted">Las respuestas en este hilo heredan esta asignación.</p>
                        <div class="row">
                          @if (puedeEditar(c.buzon_id) && equipo().length) {
                            @if (reasignando()) {
                              <select class="input sm" style="width:220px" [(ngModel)]="personaReasignar" aria-label="Persona">
                                @for (p of equipo(); track p.id) { <option [value]="p.id">{{ p.nombre }}{{ p.disponible ? '' : ' (ausente)' }}</option> }
                              </select>
                              <button type="button" class="btn primary sm" [disabled]="!personaReasignar || accionando()" (click)="reasignar()">Reasignar</button>
                              <button type="button" class="btn sm" (click)="reasignando.set(false)">Cancelar</button>
                            } @else {
                              <button type="button" class="btn outline sm" (click)="reasignando.set(true)"><lucide-icon name="user-cog" [size]="13" /> Reasignar</button>
                            }
                          }
                          @if (c.categoria_id && c.grupo_id && !reasignando()) {
                            <button type="button" class="btn outline sm" [disabled]="accionando()" (click)="recalcular()"><lucide-icon name="refresh-cw" [size]="13" /> Recalcular</button>
                          }
                        </div>
                      </div>
                    </div>
                  }

                  <!-- ── Archivo ── -->
                  @case ('arch') {
                    @if (vigente(); as a) {
                      <div class="row between">
                        <div class="row">
                          <lucide-icon name="file-spreadsheet" [size]="16" />
                          <b class="mono xs">{{ archivoVista().nombre }}</b>
                          <span [class]="'badge ' + (borradorDesactualizado() ? 'b-sky' : 'b-slate')">v{{ a.version }}{{ borradorDesactualizado() ? ' · vista previa' : '' }}</span>
                          @if (partesVigentes().length > 1) { <span class="badge b-violet">{{ partesVigentes().length }} archivos · uno por pago</span> }
                        </div>
                        <button type="button" class="btn primary sm" [disabled]="!borradorDesactualizado() || accionando()" (click)="pedirBorrador()">
                          <lucide-icon name="file-pen" [size]="13" /> Actualizar borrador{{ borradorDesactualizado() ? ' (v' + a.version + ')' : '' }}
                        </button>
                      </div>
                      @if (borradorDesactualizado()) {
                        <div class="note b-amber">
                          <lucide-icon name="alert-triangle" [size]="13" />
                          <span style="flex:1">
                            @if (borrador(); as b) { El borrador del hilo tiene la <b>v{{ b.version }}</b>. } @else { Aún no hay borrador en el hilo. }
                            La vista previa es la <b>v{{ a.version }}</b>, generada por {{ a.created_by }}. Las celdas que cambiaron están marcadas con ▲.
                          </span>
                        </div>
                      } @else if (borrador(); as b) {
                        <div class="note b-emerald"><lucide-icon name="check-circle-2" [size]="13" /> <span>El borrador del hilo tiene la versión vigente (v{{ b.version }}) · actualizado {{ cuando(b.borrador_en || b.created_at) }} por {{ b.created_by }}.</span></div>
                      }
                      @if (partesVigentes().length > 1) {
                        <!-- 082: un archivo por pago; se ve uno a la vez y van todos al borrador. -->
                        <div class="pills" role="tablist" aria-label="Archivos de esta versión">
                          @for (p of partesVigentes(); track p.id) {
                            <button type="button" role="tab" [attr.aria-selected]="(p.parte ?? 1) === parteSel()" (click)="verParte(p.parte ?? 1)">
                              Archivo {{ p.parte }}@if (p.grupo) { · pago {{ p.grupo }} } · {{ p.filas }} fila{{ p.filas === 1 ? '' : 's' }}
                              @if ((p.avisos ?? []).length) { <lucide-icon name="alert-triangle" [size]="12" /> }
                            </button>
                          }
                        </div>
                      }
                      @if (avisosArchivos().length) {
                        <div class="note b-amber" style="display:grid;gap:2px">
                          @for (t of avisosArchivos(); track $index) { <span><lucide-icon name="alert-triangle" [size]="12" /> {{ t }}</span> }
                          <span class="xs muted">Corrige el «pago» de cada persona en «Corregir datos» (pestaña IA) y vuelve a generar.</span>
                        </div>
                      }
                      @if (confirmarBorrador()) {
                        <div class="effect" style="border-color:var(--amber)">
                          <lucide-icon name="alert-triangle" [size]="15" />
                          <span style="flex:1">{{ advertenciasBorrador().join(' ') }} ¿Actualizar el borrador de todas formas?</span>
                          <button type="button" class="btn outline sm" (click)="revisarDatos()">Revisar datos</button>
                          <button type="button" class="btn primary sm" (click)="actualizarBorrador()">Actualizar igual</button>
                        </div>
                      }
                      @if (celdas(); as cel) {
                        <div class="glass r-2xl stack sheet-box" style="padding:14px 16px;gap:10px">
                          <div class="row between">
                            <p class="cap"><lucide-icon name="table" [size]="13" /> Vista previa · hoja «{{ cel.hoja }}» · {{ cel.filas }} fila{{ cel.filas === 1 ? '' : 's' }}</p>
                            <div class="pills">
                              <button type="button" [attr.aria-selected]="vistaHoja() === 'val'" (click)="vistaHoja.set('val')">Valores</button>
                              <button type="button" [attr.aria-selected]="vistaHoja() === 'form'" (click)="vistaHoja.set('form')">Fórmulas</button>
                            </div>
                          </div>
                          <div class="sheet-wrap">
                            <table class="sheet">
                              <tr><th class="rh"></th>@for (l of letras(); track l) { <th>{{ l }}</th> }</tr>
                              @for (f of hoja(); track $index; let i = $index) {
                                <tr [class.h]="f.encabezado" [class.newr]="f.nueva">
                                  <td class="rh">{{ i + 1 }}</td>
                                  @for (cc of f.celdas; track $index) { <td [class]="cc.cls" [attr.title]="cc.titulo">{{ cc.v }}</td> }
                                </tr>
                              }
                            </table>
                            <div class="sheet-tabs"><span class="on">{{ cel.hoja }}</span></div>
                          </div>
                        </div>
                        <div class="glass r-2xl stack" style="padding:14px 16px;gap:8px">
                          <div class="row between">
                            <p class="cap"><lucide-icon name="clipboard-check" [size]="13" /> Revisión del archivo</p>
                            <span class="row" style="gap:6px">
                              @if (advertencias().length) { <span class="badge b-amber">{{ advertencias().length }} advertencia{{ advertencias().length > 1 ? 's' : '' }}</span> }
                              <span class="badge b-emerald">{{ cel.anotaciones.length - advertencias().length }} correcto{{ cel.anotaciones.length - advertencias().length === 1 ? '' : 's' }}</span>
                            </span>
                          </div>
                          <ul class="rev">
                            @for (n of anotacionesOrdenadas(); track $index) { <li [class]="n.estado"><lucide-icon [name]="n.estado === 'ok' ? 'check' : 'alert-triangle'" [size]="13" /><span>{{ n.texto }}</span></li> }
                          </ul>
                        </div>
                      } @else {
                        <p class="xs muted">Cargando la vista previa…</p>
                      }
                      <div class="box sunk">
                        <div class="row between">
                          <p class="cap"><lucide-icon name="history" [size]="13" /> Versiones del archivo</p>
                          <button type="button" class="btn outline sm" [disabled]="accionando()" (click)="regenerar(c)"><lucide-icon name="refresh-cw" [size]="13" /> Generar de nuevo</button>
                        </div>
                        @for (v of archivos(); track v.id) {
                          <div class="row between xs">
                            <span><b>v{{ v.version }}</b>@if ((v.partes ?? 1) > 1) { <span class="muted"> · archivo {{ v.parte }} de {{ v.partes }}</span> } · {{ v.created_by }} · {{ cuando(v.created_at) }}</span>
                            <span class="row" style="gap:6px">
                              <span class="muted">{{ v.salida_nombre }} · {{ v.filas }} filas</span>
                              @if (v.borrador_en_hilo) { <b style="color:var(--emerald)">en el borrador</b> }
                              <button type="button" class="btn ghost" [attr.aria-label]="'Descargar v' + v.version + ((v.partes ?? 1) > 1 ? ' archivo ' + v.parte : '')" (click)="descargar(v)"><lucide-icon name="download" [size]="14" /></button>
                            </span>
                          </div>
                        }
                      </div>
                    }
                  }

                  <!-- ── Hilo ── -->
                  @case ('hilo') {
                    @if (hilo(); as h) {
                      <div class="thread">
                        <div class="crumb"><lucide-icon name="folder" [size]="13" /> {{ h.buzon.direccion }} › {{ carpetaHilo(c, h) }} › Conversación</div>
                        @for (m of h.items; track m.id) {
                          <div class="msg" [class.este]="m.es_este">
                            <div class="row between"><b>{{ m.remitente_nombre || m.remitente }}</b><span class="xs muted">{{ cuando(m.recibido_en) }}</span></div>
                            <span>{{ m.asunto }}</span>
                            @for (adj of m.adjuntos; track $index) { <span class="att"><lucide-icon name="paperclip" [size]="12" /> {{ adj }}</span> }
                            @if (!m.es_este && m.resumen) { <span class="xs muted">«{{ m.resumen }}»</span> }
                            @if (!m.es_este) { <span class="badge b-sky" style="justify-self:start"><lucide-icon name="link" [size]="12" /> Vinculada por la conversación · {{ m.asignado_a ? 'misma asignación' : 'sin asignar' }}</span> }
                            @if (m.es_este) {
                              <button type="button" class="btn outline sm" style="justify-self:start" (click)="alternarOriginal()">
                                <lucide-icon name="mail-open" [size]="13" /> {{ verOriginal() ? 'Ocultar el correo original' : 'Ver el correo original' }}
                              </button>
                            }
                          </div>
                        }
                        @if (h.borrador; as b) {
                          <div class="msg draft">
                            <div class="row between"><b style="color:var(--rose)">[Borrador] Nova · Buzón Inteligente</b><span class="xs muted">actualizado {{ cuando(b.borrador_en || b.created_at) }}</span></div>
                            <span>RE: {{ c.asunto }} · {{ b.salida_nombre || 'Archivo' }}</span>
                            <span class="att x"><lucide-icon name="file-spreadsheet" [size]="12" /> {{ b.nombre }} · v{{ b.version }}</span>
                            <span class="xs muted">Sin destinatarios · Nova reemplaza este borrador en cada versión que se actualice.</span>
                            @if (h.ultima_version && h.ultima_version > b.version) { <span class="badge b-amber" style="justify-self:start">Hay una versión más nueva (v{{ h.ultima_version }}) en la pestaña Archivo</span> }
                          </div>
                        }
                      </div>
                      @if (verOriginal()) {
                        <div class="eml">
                          @if (cargandoEml()) { <p class="xs muted" style="padding:16px">Cargando el correo…</p> }
                          @else if (errorEml()) { <p class="err" style="padding:16px">{{ errorEml() }}</p> }
                          @else if (eml(); as e) {
                            <alma-email-frame class="min-h-0 flex-1" style="min-height:320px" [html]="e.html" />
                            @if (e.attachments.length) {
                              <div class="row" style="padding:8px 12px;border-top:1px solid var(--border)">
                                @for (at of e.attachments; track $index) { <button type="button" class="att" (click)="adjunto.set(at)"><lucide-icon name="paperclip" [size]="12" /> {{ at.filename }}</button> }
                              </div>
                              @if (adjunto(); as at) { <alma-attachment-preview [attachment]="at" /> }
                            }
                          }
                        </div>
                      }
                    } @else {
                      <p class="xs muted">Cargando la conversación…</p>
                    }
                  }

                  <!-- ── Traza ── -->
                  @case ('traza') {
                    <ol class="tl">
                      <li class="ok"><p class="w">{{ cuando(c.recibido_en) }}</p><p class="sm b">Correo recibido en {{ c.buzon_nombre }}</p></li>
                      @if (c.categoria_clave || c.origen) {
                        <li class="ok"><p class="sm b">{{ c.origen === 'regla' ? 'Regla fija aplicada' : origenTexto(c) }}</p><p class="w">{{ c.proceso_clave || '—' }} · {{ c.categoria_clave || '—' }}@if (c.confianza !== null) { · {{ pct(c.confianza) }} }</p></li>
                      }
                      @if (motivoValidar(c); as m) { <li class="warn"><p class="sm b">Validar</p><p class="w">{{ m }}</p></li> }
                      @for (e of c.ejecuciones; track e.id) {
                        <li [class]="e.resultado === 'ok' ? 'ok' : e.resultado === 'error' ? 'bad' : 'skip'">
                          <p class="w">{{ cuando(e.ejecutado_en) }} · {{ e.ejecutado_por }}</p>
                          <p class="sm b">{{ nombreEjecucion(e.tipo) }}</p>
                          @if (e.detalle) { <p class="w">{{ e.detalle }}</p> }
                        </li>
                      }
                    </ol>
                  }
                }
              </div>
            } @else {
              <div class="empty">
                <div>
                  <div class="ei"><lucide-icon name="mail-open" [size]="22" /></div>
                  <p class="sm b">Selecciona un correo</p>
                  <p class="xs muted" style="max-width:360px">Verás qué decidió Nova, los datos que extrajo, a quién lo asignó y el archivo que generó.</p>
                </div>
              </div>
            }
          </section>
        </div>
      </div>
    }
  `,
})
export class BandejaBuzonComponent {
  private readonly auth = inject(AuthService);
  protected readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly emlSvc = inject(EmlService);

  protected readonly puedeVer = computed(() => this.auth.hasPermission(PERM_VER_BUZON));
  protected readonly gris = COLOR_GRIS;
  protected readonly chips: { id: Filtro; nombre: string; icon: string }[] = [
    { id: 'todos', nombre: 'Todos', icon: 'inbox' },
    { id: 'validar', nombre: 'Validar', icon: 'alert-triangle' },
    { id: 'duplicado', nombre: 'Posibles duplicados', icon: 'copy' },
    { id: 'ejecutado', nombre: 'Ejecutados', icon: 'mail-check' },
    { id: 'ignorado', nombre: 'Ignorados', icon: 'mail-x' },
  ];

  // Filtros y lista
  /** Etiquetas sin grupo por buzón (solo quien configura recibe la revisión; al resto le falla y no ve nada). */
  private readonly sinGrupoPorBuzon = signal<Record<string, string[]>>({});
  private readonly pidiendoSinGrupo = new Set<string>();

  protected sinGrupoDe(c: { buzon_id: string; categoria_clave: string | null }): string | null {
    const clave = (c.categoria_clave ?? '').toUpperCase();
    if (!clave) return null;
    const mapa = this.sinGrupoPorBuzon();
    if (!(c.buzon_id in mapa)) {
      if (!this.pidiendoSinGrupo.has(c.buzon_id)) {
        this.pidiendoSinGrupo.add(c.buzon_id);
        void this.api
          .revisionGrupos(c.buzon_id)
          .then((r) => (r.aplica ? r.sin_grupo.map((x) => x.clave.toUpperCase()) : []))
          .catch(() => [] as string[])
          .then((lista) => this.sinGrupoPorBuzon.update((m) => ({ ...m, [c.buzon_id]: lista })));
      }
      return null;
    }
    return mapa[c.buzon_id].includes(clave) ? clave : null;
  }

  protected q = '';
  protected buzonId = '';
  /** Filtro por proceso: '' = todos, SIN_PROCESO = OTROS / sin proceso, o la clave. */
  protected procesoSel = '';
  protected readonly SIN_PROCESO = '__sin_proceso__';
  // Se entra en «Todos»; Validar y los demás filtros se eligen arriba o llegan por ?estado=.
  protected filtro: Filtro = 'todos';
  protected sinAsignar = false;
  private offset = 0;
  private readonly limit = 50;
  protected readonly buzones = signal<Buzon[]>([]);
  private readonly categorias = signal<Categoria[]>([]);
  private readonly procesos = signal<Record<string, Proceso[]>>({});
  protected readonly correos = signal<Correo[]>([]);
  protected readonly total = signal(0);
  protected readonly porValidar = signal(0);
  protected readonly cargandoLista = signal(false);
  protected readonly hayMas = computed(() => this.correos().length < this.total());

  // Detalle
  protected readonly seleccionado = signal<Correo | null>(null);
  protected readonly detalle = signal<CorreoDetalle | null>(null);
  protected readonly pestana = signal<Pestana>('ia');
  protected readonly accionando = signal(false);
  protected readonly ajuste = signal<string | null>(null);
  protected categoriaDecision = '';
  /** 067: grupos por buzón (para saber si la etiqueta elegida reenvía o responde). */
  private readonly gruposDe = signal<Record<string, Grupo[]>>({});
  /** 067: envío que se confirma antes de aprobar (grupo «reenviar» o «responder»). */
  protected readonly envio = signal<{ grupo: Grupo } | null>(null);
  protected mensajeEnvio = '';

  // Datos: vista, edición y efecto de la corrección
  protected readonly verJson = signal(false);
  protected readonly editando = signal(false);
  protected readonly modoEdicion = signal<'tabla' | 'json'>('tabla');
  protected readonly campos = signal<CampoEdicion[]>([]);
  protected readonly tablasEdicion = signal<{ clave: string; columnas: string[]; filas: Record<string, string>[] }[]>([]);
  protected jsonTexto = '';
  protected readonly errores = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly efecto = signal<{ resumen: string; archivo: number | null; criticos: string[] } | null>(null);

  // Asignación
  protected readonly equipo = signal<Persona[]>([]);
  protected readonly reasignando = signal(false);
  protected personaReasignar = '';

  // Archivo
  protected readonly archivos = signal<ArchivoCorreo[]>([]);
  protected readonly celdas = signal<(CeldasArchivo & { filas: number }) | null>(null);
  private readonly celdasBorrador = signal<CeldasArchivo | null>(null);
  protected readonly vistaHoja = signal<'val' | 'form'>('val');
  protected readonly confirmarBorrador = signal(false);
  protected readonly vigente = computed(() => this.archivos()[0] ?? null);
  protected readonly borrador = computed(() => this.archivos().find((a) => a.borrador_en_hilo) ?? null);
  protected readonly borradorDesactualizado = computed(() => {
    const v = this.vigente();
    const b = this.borrador();
    const buzon = this.buzones().find((x) => x.id === this.detalle()?.buzon_id);
    return !!v && (b ? v.version > b.version : buzon?.borrador_en_hilo !== false);
  });
  /** 082: una versión puede tener N archivos (uno por pago): los de la versión vigente y el que se ve. */
  protected readonly parteSel = signal(1);
  protected readonly partesVigentes = computed(() => {
    const v = this.vigente();
    return v ? this.archivos().filter((a) => a.version === v.version).sort((a, b) => (a.parte ?? 1) - (b.parte ?? 1)) : [];
  });
  protected readonly archivoVista = computed(() => this.partesVigentes().find((a) => (a.parte ?? 1) === this.parteSel()) ?? this.vigente());
  /** 082: avisos guardados con cada archivo (p. ej. «el total no cuadra con el valor del pago»). */
  protected readonly avisosArchivos = computed(() =>
    this.partesVigentes().flatMap((a) => (a.avisos ?? []).filter((x) => x.estado === 'warn').map((x) => (this.partesVigentes().length > 1 ? `Archivo ${a.parte}: ${x.texto}` : x.texto))),
  );
  protected readonly advertencias = computed(() => (this.celdas()?.anotaciones ?? []).filter((a) => a.estado === 'warn').map((a) => a.texto));
  /** Lo que se le advierte a la analista antes de «Actualizar borrador» (082: también los avisos de cada archivo). */
  protected readonly advertenciasBorrador = computed(() => [...this.avisosArchivos(), ...this.advertencias()]);
  protected readonly anotacionesOrdenadas = computed(() =>
    [...(this.celdas()?.anotaciones ?? [])].sort((a, b) => (a.estado === 'warn' ? 0 : 1) - (b.estado === 'warn' ? 0 : 1)),
  );

  // Hilo y correo original
  protected readonly hilo = signal<HiloCorreo | null>(null);
  protected readonly verOriginal = signal(false);
  protected readonly eml = signal<ParsedEml | null>(null);
  protected readonly cargandoEml = signal(false);
  protected readonly errorEml = signal<string | null>(null);
  protected readonly adjunto = signal<ParsedEml['attachments'][number] | null>(null);

  protected readonly pestanas = computed(() => {
    const t: { id: Pestana; nombre: string; icon: string }[] = [
      { id: 'ia', nombre: 'Lo que vio Nova', icon: 'sparkles' },
      { id: 'asig', nombre: 'Asignación', icon: 'user-check' },
    ];
    if (this.archivos().length) t.push({ id: 'arch', nombre: 'Archivo', icon: 'file-spreadsheet' });
    t.push({ id: 'hilo', nombre: 'Hilo', icon: 'messages-square' }, { id: 'traza', nombre: 'Traza', icon: 'history' });
    return t;
  });

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    const estado = qp.get('estado');
    if (estado === 'revision') this.filtro = 'validar';
    else if (estado === 'ejecutado' || estado === 'ignorado') this.filtro = estado;
    else if (estado === '') this.filtro = 'todos';
    if (qp.get('buzon')) this.buzonId = qp.get('buzon')!;
    if (qp.get('proceso')) this.procesoSel = qp.get('proceso')!;
    if (qp.get('sin_asignar')) {
      this.sinAsignar = true;
      this.filtro = 'todos';
    }
    void this.inicial();
    inject(DestroyRef).onDestroy(() => this.emlSvc.revoke(this.eml()));
  }

  private async inicial(): Promise<void> {
    try {
      const buzones = await this.api.listarBuzones();
      this.buzones.set(buzones);
      this.porValidar.set(buzones.reduce((n, b) => n + b.en_revision, 0));
      // Una sola petición para todos los buzones: antes eran 2 por buzón a la vez
      // y, con muchos buzones, la ráfaga saturaba la BD (y el login con ella).
      const cat = await this.api.catalogo().catch(async () => {
        // Respaldo mientras el backend no tenga /catalogo (despliegues desfasados).
        const [cats, procs] = await Promise.all([
          Promise.all(buzones.map((b) => this.api.listarCategorias(b.id))),
          Promise.all(buzones.map((b) => this.api.listarProcesos(b.id).catch(() => [] as Proceso[]))),
        ]);
        return { categorias: cats.flat(), procesos: Object.fromEntries(buzones.map((b, i) => [b.id, procs[i]])) };
      });
      this.categorias.set(cat.categorias);
      this.procesos.set(cat.procesos);
    } catch {
      /* la lista principal informa el error */
    }
    await this.cargar();
  }

  // ── Lista ──
  protected cambiarFiltro(f: Filtro): void {
    this.filtro = f;
    this.sinAsignar = false;
    this.aplicar();
  }

  protected alternarSinAsignar(): void {
    this.sinAsignar = !this.sinAsignar;
    this.filtro = 'todos';
    this.aplicar();
  }

  /** Procesos del buzón elegido (o de todos, sin repetir clave) para el filtro. */
  protected opcionesProceso(): { clave: string; nombre: string }[] {
    const mapa = this.procesos();
    const lista = this.buzonId ? (mapa[this.buzonId] ?? []) : Object.values(mapa).flat();
    const vistos = new Map<string, { clave: string; nombre: string; orden: number }>();
    for (const p of [...lista].sort((a, b) => a.orden - b.orden)) {
      if (!vistos.has(p.clave)) vistos.set(p.clave, { clave: p.clave, nombre: p.nombre, orden: p.orden });
    }
    return [...vistos.values()];
  }

  protected cambiarBuzon(): void {
    // Si el proceso elegido no existe en el buzón nuevo, se quita el filtro.
    if (this.procesoSel && this.procesoSel !== this.SIN_PROCESO && !this.opcionesProceso().some((p) => p.clave === this.procesoSel)) {
      this.procesoSel = '';
    }
    this.aplicar();
  }

  protected aplicar(): void {
    this.offset = 0;
    this.seleccionado.set(null);
    void this.cargar();
  }

  protected masResultados(): void {
    this.offset += this.limit;
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargandoLista.set(true);
    const estado: EstadoCorreo | undefined = this.filtro === 'validar' ? 'revision' : this.filtro === 'ejecutado' || this.filtro === 'ignorado' ? this.filtro : undefined;
    try {
      const r = await this.api.listarCorreos({
        buzon_id: this.buzonId || undefined,
        estado,
        q: this.q.trim() || undefined,
        sin_asignar: this.sinAsignar || undefined,
        duplicado: this.filtro === 'duplicado' || undefined,
        proceso: this.procesoSel && this.procesoSel !== this.SIN_PROCESO ? this.procesoSel : undefined,
        sin_proceso: this.procesoSel === this.SIN_PROCESO || undefined,
        limit: this.limit,
        offset: this.offset,
      });
      this.correos.set(this.offset ? [...this.correos(), ...r.data] : r.data);
      this.total.set(r.total);
      if (!this.offset) {
        if (r.data.length) void this.seleccionar(r.data[0]);
        else this.detalle.set(null);
      }
    } catch (e) {
      this.toast.error('No se pudieron cargar los correos', e instanceof Error ? e.message : String(e));
    } finally {
      this.cargandoLista.set(false);
    }
  }

  // ── Detalle ──
  protected async seleccionar(c: Correo): Promise<void> {
    this.seleccionado.set(c);
    this.pestana.set('ia');
    this.ajuste.set(null);
    this.editando.set(false);
    this.verJson.set(false);
    this.efecto.set(null);
    this.reasignando.set(false);
    this.archivos.set([]);
    this.celdas.set(null);
    this.parteSel.set(1);
    this.hilo.set(null);
    this.verOriginal.set(false);
    this.emlSvc.revoke(this.eml());
    this.eml.set(null);
    this.adjunto.set(null);
    this.confirmarBorrador.set(false);
    try {
      const d = await this.api.obtenerCorreo(c.id);
      if (this.seleccionado()?.id !== c.id) return;
      this.detalle.set(d);
      this.categoriaDecision = d.categoria_id ?? this.etiquetasPorProceso(d.buzon_id)[0]?.etiquetas[0]?.id ?? '';
      this.envio.set(null);
      void this.cargarArchivos(d.id);
      if (this.puedeEditar(d.buzon_id)) void this.api.listarEquipo(d.buzon_id).then((l) => this.equipo.set(l)).catch(() => this.equipo.set([]));
    } catch (e) {
      this.toast.error('No se pudo cargar el detalle', e instanceof Error ? e.message : String(e));
    }
  }

  protected abrirPestana(t: Pestana): void {
    this.pestana.set(t);
    const d = this.detalle();
    if (!d) return;
    if (t === 'hilo' && !this.hilo()) void this.api.hilo(d.id).then((h) => this.hilo.set(h)).catch((e) => this.toast.error('No se pudo cargar el hilo', String(e)));
    if (t === 'arch' && !this.celdas()) void this.cargarCeldas();
  }

  private async refrescar(c: Correo): Promise<void> {
    this.correos.update((l) => l.map((x) => (x.id === c.id ? c : x)));
    this.seleccionado.set(c);
    const d = await this.api.obtenerCorreo(c.id);
    this.detalle.set(d);
    this.hilo.set(null);
    await this.cargarArchivos(c.id);
  }

  // ── Decisiones ──
  /** Grupo de la etiqueta elegida si reenvía o responde (067); null si no envía nada. */
  private async grupoConEnvio(buzonId: string, categoriaId: string): Promise<Grupo | null> {
    const clave = this.categorias().find((x) => x.id === categoriaId)?.clave;
    let grupos = this.gruposDe()[buzonId];
    if (!grupos) {
      grupos = await this.api.listarGrupos(buzonId).catch(() => [] as Grupo[]);
      this.gruposDe.update((m) => ({ ...m, [buzonId]: grupos! }));
    }
    const g = grupos.find((x) => x.activo && !!clave && x.etiquetas.includes(clave));
    return g && (g.destino === 'reenviar' || g.destino === 'responder') ? g : null;
  }

  protected async aprobar(): Promise<void> {
    const c = this.detalle();
    if (!c || !this.categoriaDecision) return;
    const grupo = await this.grupoConEnvio(c.buzon_id, this.categoriaDecision);
    if (grupo) {
      // Antes de ejecutar, se muestra a quién sale y se deja agregar un mensaje.
      this.mensajeEnvio = '';
      this.envio.set({ grupo });
      return;
    }
    await this.decidirYEjecutar(c);
  }

  protected async confirmarEnvio(): Promise<void> {
    const c = this.detalle();
    if (!c || !this.envio()) return;
    await this.decidirYEjecutar(c, this.mensajeEnvio.trim() || undefined);
  }

  private async decidirYEjecutar(c: CorreoDetalle, mensaje?: string): Promise<void> {
    await this.accion(async () => {
      const r = await this.api.decidir(c.id, this.categoriaDecision, true, undefined, mensaje);
      this.envio.set(null);
      if (c.estado === 'revision') this.porValidar.update((n) => Math.max(0, n - 1));
      this.ajuste.set(null);
      await this.refrescar(r);
      this.toast.show('Aprobado y ejecutado', `${r.categoria_clave ?? ''} · ${r.asignado_nombre ? 'asignado a ' + r.asignado_nombre : 'acciones ejecutadas'}`);
    }, 'No se pudo aprobar');
  }

  protected async reclasificar(): Promise<void> {
    const c = this.detalle();
    if (!c) return;
    await this.accion(async () => {
      const r = await this.api.reclasificar(c.id);
      await this.refrescar(r);
      this.categoriaDecision = r.categoria_id ?? this.categoriaDecision;
      this.toast.show('Reclasificado', `${r.categoria_clave ?? 'Sin etiqueta'} · ${this.pct(r.confianza ?? 0)}`);
    }, 'No se pudo reclasificar');
  }

  protected async ignorar(): Promise<void> {
    const c = this.detalle();
    if (!c) return;
    await this.accion(async () => {
      const r = await this.api.ignorar(c.id);
      if (c.estado === 'revision') this.porValidar.update((n) => Math.max(0, n - 1));
      await this.refrescar(r);
      this.toast.show('Correo ignorado', 'No se ejecutará ninguna acción.');
    }, 'No se pudo ignorar');
  }

  protected async duplicado(es: boolean): Promise<void> {
    const c = this.detalle();
    if (!c) return;
    await this.accion(async () => {
      const r = await this.api.decidirDuplicado(c.id, es);
      if (es && c.estado === 'revision') this.porValidar.update((n) => Math.max(0, n - 1));
      await this.refrescar(r);
      this.toast.show(es ? 'Marcado como duplicado' : 'No es duplicado', es ? 'Se ignoró y quedó vinculado al original.' : 'Ahora puedes aprobarlo como cualquier correo.');
    }, 'No se pudo guardar la decisión');
  }

  protected iniciarAjuste(c: CorreoDetalle): void {
    this.ajuste.set(c.id);
    this.categoriaDecision = c.categoria_id ?? '';
  }

  private async accion(fn: () => Promise<void>, error: string): Promise<void> {
    this.accionando.set(true);
    try {
      await fn();
    } catch (e) {
      this.toast.error(error, e instanceof Error ? e.message : String(e));
    } finally {
      this.accionando.set(false);
    }
  }

  // ── Asignación ──
  protected async reasignar(): Promise<void> {
    const c = this.detalle();
    if (!c || !this.personaReasignar) return;
    await this.accion(async () => {
      const r = await this.api.reasignar(c.id, this.personaReasignar);
      this.reasignando.set(false);
      await this.refrescar(r);
      this.toast.show('Reasignado', `Ahora lo gestiona ${r.asignado_nombre ?? r.asignado_a}.`);
    }, 'No se pudo reasignar');
  }

  protected async recalcular(): Promise<void> {
    const c = this.detalle();
    if (!c) return;
    await this.accion(async () => {
      const r = await this.api.recalcularAsignacion(c.id);
      this.efecto.set(null);
      await this.refrescar(r);
      this.toast.show('Asignación recalculada', r.asignado_nombre ? `Asignado a ${r.asignado_nombre}.` : r.asignado_a ?? 'Quedó sin asignar.');
    }, 'No se pudo recalcular');
  }

  // ── Datos: corrección ──
  protected editar(c: CorreoDetalle): void {
    const datos = c.datos_extraidos ?? {};
    const tipos = this.tiposCampos(c);
    this.campos.set(
      Object.entries(datos)
        .filter(([, v]) => !this.esTabla(v))
        .map(([clave, v]) => {
          const t = tipos[clave]?.tipo;
          const tipo: CampoEdicion['tipo'] =
            t === 'booleano' || typeof v === 'boolean' ? 'booleano' : t === 'lista' || Array.isArray(v) ? 'lista' : t === 'numero' || typeof v === 'number' ? 'numero' : t === 'fecha' ? 'fecha' : 'texto';
          return { clave, tipo, critico: !!tipos[clave]?.critico, valor: tipo === 'lista' ? (Array.isArray(v) ? v.join(', ') : String(v ?? '')) : v === null || v === undefined ? '' : String(v) };
        }),
    );
    this.tablasEdicion.set(
      Object.entries(datos)
        .filter(([, v]) => this.esTabla(v))
        .map(([clave, v]) => {
          const filas = (v as Record<string, unknown>[]).map((x) => Object.fromEntries(Object.entries(x).map(([k, val]) => [k, val === null || val === undefined ? '' : String(val)])));
          return { clave, columnas: [...new Set(filas.flatMap((f) => Object.keys(f)))], filas };
        }),
    );
    this.jsonTexto = JSON.stringify(datos, null, 2);
    this.modoEdicion.set('tabla');
    this.errores.set([]);
    this.editando.set(true);
  }

  protected cambiarModo(m: 'tabla' | 'json'): void {
    if (m === this.modoEdicion()) return;
    if (m === 'json') {
      this.jsonTexto = JSON.stringify(this.desdeTabla(), null, 2);
      this.modoEdicion.set('json');
      return;
    }
    try {
      const obj = JSON.parse(this.jsonTexto) as Record<string, unknown>;
      const d = this.detalle();
      if (d) this.editar({ ...d, datos_extraidos: obj });
      this.modoEdicion.set('tabla');
    } catch (e) {
      this.errores.set([`Corrige el JSON antes de cambiar a tabla: ${e instanceof Error ? e.message : String(e)}`]);
    }
  }

  protected agregarFila(clave: string): void {
    this.tablasEdicion.update((l) => l.map((t) => (t.clave === clave ? { ...t, filas: [...t.filas, Object.fromEntries(t.columnas.map((c) => [c, '']))] } : t)));
  }

  protected quitarFila(clave: string, i: number): void {
    this.tablasEdicion.update((l) => l.map((t) => (t.clave === clave ? { ...t, filas: t.filas.filter((_, j) => j !== i) } : t)));
  }

  private desdeTabla(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of this.campos()) {
      const v = f.valor.trim();
      out[f.clave] = f.tipo === 'booleano' ? v === 'true' : f.tipo === 'lista' ? (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []) : f.tipo === 'numero' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : v;
    }
    for (const t of this.tablasEdicion()) out[t.clave] = t.filas.map((f) => ({ ...f }));
    return out;
  }

  /** Validación contra el formato del proceso (tipos declarados en sus campos). */
  private validar(c: CorreoDetalle, obj: unknown): string[] {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['El JSON debe ser un objeto { … }.'];
    const errs: string[] = [];
    const tipos = this.tiposCampos(c);
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const t = tipos[k]?.tipo;
      if (['proceso', 'etiqueta', 'score_confianza', 'asunto_correo'].includes(k)) errs.push(`«${k}» es de la base fija y no se edita aquí.`);
      if (t === 'booleano' && typeof v !== 'boolean') errs.push(`«${k}» debe ser true o false, sin comillas.`);
      if ((t === 'lista' || t === 'tabla') && !Array.isArray(v)) errs.push(`«${k}» debe ser una lista [ … ].`);
      if (t === 'fecha' && typeof v === 'string' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errs.push(`«${k}» debe ser AAAA-MM-DD.`);
      if (t === 'numero' && v !== '' && v !== null && !Number.isFinite(Number(v))) errs.push(`«${k}» debe ser un número.`);
    }
    for (const [k, f] of Object.entries(tipos)) {
      if (f.critico && ((obj as Record<string, unknown>)[k] === undefined || (obj as Record<string, unknown>)[k] === '')) errs.push(`Falta «${k}»: es un campo crítico del proceso.`);
    }
    return errs;
  }

  protected async guardar(c: CorreoDetalle): Promise<void> {
    let obj: Record<string, unknown>;
    if (this.modoEdicion() === 'json') {
      try {
        obj = JSON.parse(this.jsonTexto) as Record<string, unknown>;
      } catch (e) {
        this.errores.set([`El JSON no es válido: ${e instanceof Error ? e.message : String(e)}`]);
        return;
      }
    } else obj = this.desdeTabla();
    const errs = this.validar(c, obj);
    if (errs.length) {
      this.errores.set(errs);
      return;
    }
    this.guardando.set(true);
    try {
      const r = await this.api.corregirDatos(c.id, obj);
      this.editando.set(false);
      await this.refrescar(r.correo);
      const cambios = r.cambios ?? [];
      this.efecto.set({
        resumen: cambios.length ? `Cambió ${cambios.slice(0, 6).join(', ')}${cambios.length > 6 ? '…' : ''}.` : 'Sin cambios de valores.',
        archivo: r.archivo?.version ?? null,
        criticos: r.correo.asignado_a && c.asignado_a ? r.cambios_criticos ?? [] : [],
      });
      this.celdas.set(null);
    } catch (e) {
      this.errores.set([e instanceof Error ? e.message : String(e)]);
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Archivo ──
  private async cargarArchivos(correoId: string): Promise<void> {
    try {
      const l = await this.api.archivosCorreo(correoId);
      if (this.seleccionado()?.id === correoId) this.archivos.set(l);
    } catch {
      this.archivos.set([]);
    }
  }

  private async cargarCeldas(): Promise<void> {
    const v = this.archivoVista();
    if (!v) return;
    try {
      const cel = await this.api.celdasArchivo(v.id);
      // 082: se compara contra la MISMA parte que está en el borrador (archivo 2 contra archivo 2).
      const b = this.archivos().find((a) => a.borrador_en_hilo && (a.parte ?? 1) === (v.parte ?? 1)) ?? null;
      this.celdasBorrador.set(b && b.id !== v.id ? await this.api.celdasArchivo(b.id).catch(() => null) : null);
      this.celdas.set({ ...cel, filas: Math.max(0, cel.celdas.length - cel.fila_encabezado - 1) });
    } catch (e) {
      this.toast.error('No se pudo leer el archivo', e instanceof Error ? e.message : String(e));
    }
  }

  protected letras(): string[] {
    const n = Math.max(0, ...(this.celdas()?.celdas ?? []).map((f) => f.length));
    return Array.from({ length: n }, (_, i) => (i < 26 ? LETRAS[i] : LETRAS[Math.floor(i / 26) - 1] + LETRAS[i % 26]));
  }

  /** Filas de la hoja: valores (con diferencias contra el borrador) o el origen de cada columna. */
  protected hoja(): { encabezado: boolean; nueva: boolean; celdas: CeldaVista[] }[] {
    const cel = this.celdas();
    if (!cel) return [];
    const ancho = this.letras().length;
    const pad = (f: string[]): string[] => [...f, ...Array(Math.max(0, ancho - f.length)).fill('')];
    const enc = cel.fila_encabezado;
    if (this.vistaHoja() === 'form') {
      const titulo = cel.celdas.slice(0, enc + 1).map((f, i) => ({ encabezado: i === enc, nueva: false, celdas: pad(f).map((v) => ({ v, cls: '' })) }));
      return [...titulo, { encabezado: false, nueva: false, celdas: pad(cel.origenes).map((v) => ({ v: v.startsWith('=') ? v : v, cls: v.startsWith('«') ? 'k' : 'f' })) }];
    }
    const viejo = this.borradorDesactualizado() ? this.celdasBorrador()?.celdas ?? null : null;
    return cel.celdas.map((f, i) => {
      const nueva = !!viejo && i > enc && !viejo[i];
      return {
        encabezado: i === enc,
        nueva,
        celdas: pad(f).map((v, j) => {
          const cambio = !!viejo && !nueva && i > enc && (viejo[i]?.[j] ?? '') !== v;
          const falta = i > enc && !v.trim() && ['campo', 'base'].some(() => (cel.origenes[j] ?? '').startsWith('←') || (cel.origenes[j] ?? '').includes(' ← base'));
          return { v: v + (cambio ? ' ▲' : ''), cls: cambio ? 'chg' : falta ? 'miss' : v.startsWith('=') ? 'f' : '', titulo: falta ? 'Falta el valor' : cambio ? `Antes: ${viejo?.[i]?.[j] ?? ''}` : undefined };
        }),
      };
    });
  }

  /** 082: ver otro de los archivos de la versión vigente. */
  protected verParte(n: number): void {
    if (n === this.parteSel()) return;
    this.parteSel.set(n);
    this.celdas.set(null);
    void this.cargarCeldas();
  }

  protected pedirBorrador(): void {
    if (this.advertenciasBorrador().length) this.confirmarBorrador.set(true);
    else void this.actualizarBorrador();
  }

  protected revisarDatos(): void {
    this.confirmarBorrador.set(false);
    const d = this.detalle();
    this.pestana.set('ia');
    if (d) this.editar(d);
  }

  protected async actualizarBorrador(): Promise<void> {
    const v = this.vigente();
    if (!v) return;
    this.confirmarBorrador.set(false);
    await this.accion(async () => {
      this.archivos.set(await this.api.actualizarBorrador(v.id));
      this.hilo.set(null);
      this.celdasBorrador.set(null);
      const n = this.partesVigentes().length;
      this.toast.show('Borrador actualizado', n > 1 ? `El borrador del hilo ya tiene los ${n} archivos de la v${v.version}.` : `El borrador del hilo ya tiene el archivo v${v.version}.`);
    }, 'No se pudo actualizar el borrador');
  }

  protected async regenerar(c: CorreoDetalle): Promise<void> {
    await this.accion(async () => {
      const a = await this.api.regenerarArchivo(c.id);
      await this.cargarArchivos(c.id);
      this.parteSel.set(1);
      this.celdas.set(null);
      void this.cargarCeldas();
      this.toast.show(
        (a.partes ?? 1) > 1 ? 'Archivos generados' : 'Archivo generado',
        (a.partes ?? 1) > 1 ? `${a.partes} archivos (uno por pago) · versión ${a.version} · ${a.filas} filas.` : `${a.nombre} · versión ${a.version} · ${a.filas} filas.`,
      );
    }, 'No se pudo generar el archivo');
  }

  protected async descargar(a: ArchivoCorreo): Promise<void> {
    try {
      await this.api.descargarArchivo(a);
    } catch (e) {
      this.toast.error('No se pudo descargar el archivo', e instanceof Error ? e.message : String(e));
    }
  }

  // ── Hilo: correo original ──
  protected alternarOriginal(): void {
    this.verOriginal.set(!this.verOriginal());
    const d = this.detalle();
    if (this.verOriginal() && d && !this.eml()) void this.cargarEml(d.id);
  }

  private async cargarEml(id: string): Promise<void> {
    this.cargandoEml.set(true);
    this.errorEml.set(null);
    try {
      const parsed = await this.emlSvc.parse(await this.api.obtenerMime(id));
      if (this.detalle()?.id !== id) return;
      this.eml.set(parsed);
      this.adjunto.set(parsed.attachments[0] ?? null);
    } catch (e) {
      this.errorEml.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargandoEml.set(false);
    }
  }

  // ── Ayudas de vista ──
  protected puedeEditar(buzonId: string): boolean {
    return !!this.buzones().find((b) => b.id === buzonId)?.puede_administrar;
  }

  protected etiquetasPorProceso(buzonId: string): { proceso: string; etiquetas: Categoria[] }[] {
    const cats = this.categorias().filter((c) => c.buzon_id === buzonId && c.activa);
    const procs = this.procesos()[buzonId] ?? [];
    const grupos = procs
      .filter((p) => p.activo !== false)
      .map((p) => ({ proceso: p.nombre || p.clave, etiquetas: cats.filter((c) => c.proceso_id === p.id) }))
      .filter((g) => g.etiquetas.length);
    const sueltas = cats.filter((c) => !procs.some((p) => p.id === c.proceso_id));
    return sueltas.length ? [...grupos, { proceso: grupos.length ? 'Otras etiquetas' : 'Etiquetas', etiquetas: sueltas }] : grupos;
  }

  private tiposCampos(c: Correo): Record<string, CampoProceso> {
    const cat = this.categorias().find((x) => x.id === c.categoria_id);
    const proc = (this.procesos()[c.buzon_id] ?? []).find((p) => p.id === cat?.proceso_id);
    return Object.fromEntries([...(cat?.campos_extraer ?? []).map((f) => ({ ...f, critico: false })), ...(proc?.campos_extraer ?? [])].map((f) => [f.clave, f as CampoProceso]));
  }

  protected hayCriticos(c: Correo): boolean {
    return Object.values(this.tiposCampos(c)).some((f) => f.critico);
  }

  /** Un elemento de lista como fila: objeto, o texto «clave=valor, clave=valor» (así llega a veces de Nova). */
  private filaDe(x: unknown): Record<string, unknown> | null {
    if (x !== null && typeof x === 'object' && !Array.isArray(x)) return x as Record<string, unknown>;
    if (typeof x !== 'string' || !/^\s*[\wáéíóúñ]+\s*=/i.test(x)) return null;
    const fila: Record<string, string> = {};
    for (const par of x.split(/,\s*(?=[\wáéíóúñ]+\s*=)/i)) {
      const i = par.indexOf('=');
      if (i < 1) return null;
      fila[par.slice(0, i).trim()] = par.slice(i + 1).trim();
    }
    return fila;
  }

  /** `textos`: también acepta filas «clave=valor» (solo para ver; al corregir se editan tal como están guardadas). */
  private esTabla(v: unknown, textos = false): boolean {
    return Array.isArray(v) && v.length > 0 && v.every((x) => (textos ? this.filaDe(x) !== null : x !== null && typeof x === 'object' && !Array.isArray(x)));
  }

  protected simples(c: Correo): { clave: string; valor: string; critico: boolean; vacio: boolean; lista: string[] | null; bool: boolean | null }[] {
    const tipos = this.tiposCampos(c);
    return Object.entries(c.datos_extraidos ?? {})
      .filter(([, v]) => !this.esTabla(v, true))
      .map(([clave, v]) => ({
        clave,
        valor: v === null || v === undefined ? '' : String(v),
        critico: !!tipos[clave]?.critico,
        vacio: v === null || v === undefined || v === '',
        lista: Array.isArray(v) ? v.map(String) : null,
        bool: typeof v === 'boolean' ? v : null,
      }));
  }

  protected tablas(c: Correo): { clave: string; columnas: string[]; filas: Record<string, string>[] }[] {
    return Object.entries(c.datos_extraidos ?? {})
      .filter(([, v]) => this.esTabla(v, true))
      .map(([clave, v]) => {
        const filas = (v as unknown[]).map((y) => this.filaDe(y) ?? {}).map((x) => Object.fromEntries(Object.entries(x).map(([k, val]) => [k, val === null || val === undefined ? '' : String(val)])));
        return { clave, columnas: [...new Set(filas.flatMap((f) => Object.keys(f)))], filas };
      });
  }

  /** Salida completa: base fija + datos extraídos (como la ve el agente). */
  protected jsonLineas(c: Correo): { texto: string; base: boolean }[] {
    const base = { proceso: c.proceso_clave, etiqueta: c.categoria_clave, score_confianza: c.confianza, asunto_correo: c.asunto };
    const o = { ...base, ...(c.datos_extraidos ?? {}) };
    return JSON.stringify(o, null, 2)
      .split('\n')
      .map((texto) => ({ texto, base: /^\s*"(proceso|etiqueta|score_confianza|asunto_correo)":/.test(texto) }));
  }

  protected versionDatos(): number {
    return 1 + (this.detalle()?.ejecuciones ?? []).filter((e) => e.tipo === 'datos').length;
  }

  protected ultimaCorreccion(): string {
    const d = this.detalle();
    const ult = [...(d?.ejecuciones ?? [])].reverse().find((e) => e.tipo === 'datos');
    return ult ? `${ult.ejecutado_por} · ${this.cuando(ult.ejecutado_en)}` : `Nova · ${this.cuando(d?.created_at ?? new Date().toISOString())}`;
  }

  protected acciones(c: CorreoDetalle): { icon: string; texto: string; estado: string | null }[] {
    if (c.estado === 'ejecutado' || c.ejecuciones.some((e) => !['decision', 'datos', 'duplicado'].includes(e.tipo))) {
      return c.ejecuciones
        .filter((e) => !['decision', 'datos', 'duplicado'].includes(e.tipo))
        .map((e) => ({ icon: this.iconoEjecucion(e.tipo), texto: e.detalle || this.nombreEjecucion(e.tipo), estado: e.resultado }));
    }
    const previstas = c.acciones_previstas.map((a) => ({ icon: this.iconoEjecucion(a.tipo), texto: resumenAccion(a), estado: null as string | null }));
    const asig = this.asignadoTexto(c);
    if (asig && asig.quien) previstas.push({ icon: 'folder-input', texto: `Asignado a ${asig.quien}`, estado: null });
    if (c.estado === 'revision') previstas.push({ icon: 'clock', texto: 'Al aprobar: acciones de la etiqueta elegida', estado: null });
    return previstas;
  }

  private iconoEjecucion(tipo: string): string {
    return { categorizar: 'tag', mover: 'folder-input', reenviar: 'forward', asignar: 'user-check', notificar_teams: 'bell', marcar_leido: 'mail-check', archivo: 'file-spreadsheet' }[tipo] ?? 'zap';
  }

  protected nombreEjecucion(tipo: string): string {
    return (
      { categorizar: 'Etiqueta en Outlook', mover: 'Movido a carpeta', reenviar: 'Reenviado', asignar: 'Asignación', notificar_teams: 'Aviso en Teams', marcar_leido: 'Marcado como leído', archivo: 'Archivo', decision: 'Decisión del revisor', datos: 'Datos corregidos', duplicado: 'Duplicado' } as Record<string, string>
    )[tipo] ?? tipo;
  }

  protected origenTexto(c: Correo): string {
    if (c.origen === 'regla') return 'Regla fija';
    if (c.origen === 'humano') return 'Ajustado manualmente';
    // 061: versión de las reglas con la que se clasificó (sin versión = borrador, antes de publicar).
    const v = c.reglas_version ? ` · v${c.reglas_version}` : '';
    if (c.modelo_ia?.startsWith('agente:')) return `Clasificado por el agente ${c.modelo_ia.slice(7)}${v}`;
    return `Clasificado por IA · Prompt de Nova${v}`;
  }

  protected asignadoTexto(c: Correo): { icon: string; quien: string | null; via: string } | null {
    const traza = c.asignacion_traza ?? [];
    // Vía como en el prototipo: «BASE PAC · codigo_pac», «Round-robin PAC», «Continuidad del hilo».
    const pasos = traza.filter((t) => t.estado === 'ok' && !t.titulo.startsWith('Movido'));
    const ultimo = pasos[pasos.length - 1]?.titulo ?? '';
    const cruce = [...pasos].reverse().find((t) => t.titulo.includes(' ↔ '))?.titulo.split(' ↔ ')[0];
    const via = /^(Asignado a|Respaldo)/.test(ultimo) && cruce ? cruce : ultimo.split(' → ')[0];
    // 082: en Validar no se asigna; se asigna al aprobar con la etiqueta final.
    if (!c.asignado_a && traza[0]?.titulo === 'Pendiente de aprobación') {
      const propuesta = traza.find((t) => t.titulo.startsWith('Al aprobar iría a '));
      return { icon: 'clock', quien: null, via: propuesta ? `Asignación pendiente de aprobación · ${propuesta.titulo.replace('Al aprobar iría a ', 'iría a ')}` : 'Asignación pendiente de aprobación' };
    }
    if (!c.asignado_a && traza.some((t) => t.titulo === 'Sin coincidencia en las bases → Validar'))
      return { icon: 'user-x', quien: null, via: 'Sin coincidencia en las bases: se asigna al aprobar' };
    if (c.asignado_nombre || (c.asignado_a && c.asignado_a.includes('@'))) return { icon: 'user', quien: c.asignado_nombre ?? c.asignado_a, via: via || 'asignación' };
    if (c.asignado_a?.startsWith('Carpeta')) return { icon: 'folder-input', quien: null, via: `Enviado a la ${c.asignado_a.toLowerCase()}` };
    if (c.asignado_a === 'Solo categorizar') return { icon: 'tag', quien: null, via: 'Solo categorizar' };
    if (c.grupo_id || traza.length) return { icon: 'user-x', quien: null, via: 'Sin asignar' };
    return null;
  }

  protected resultadoAsignacion(c: Correo): string {
    const a = this.asignadoTexto(c);
    if (!a) return 'Sin asignación: el buzón aún no tiene grupos.';
    if (a.quien) {
      const p = this.equipo().find((x) => x.id === c.asignado_persona_id);
      return `Asignado a ${a.quien}${p?.carpeta ? ` · carpeta «${p.carpeta}»` : ''} del buzón ${c.buzon_nombre}.`;
    }
    return `${a.via}.`;
  }

  protected motivoValidar(c: Correo): string | null {
    if (c.estado !== 'revision' || c.duplicado_estado === 'posible') return null;
    if (c.motivo_validacion?.trim()) return c.motivo_validacion.trim();
    const m = (c.justificacion ?? '').split('Requiere humano:')[1]?.trim();
    if (m) return m;
    if (c.confianza === null) return 'Pendiente de revisión.';
    const u = this.umbralDe(c);
    if (u !== null && c.confianza < u) return `Confianza ${this.pct(c.confianza)}, por debajo del umbral de ${this.pct(u)}.`;
    return `Confianza ${this.pct(c.confianza)}: alcanza el umbral; Nova lo ejecuta en el próximo ciclo.`;
  }

  /** Umbral que aplica (etiqueta → proceso → buzón), como en el worker. */
  private umbralDe(c: Correo): number | null {
    const cat = this.categorias().find((x) => x.id === c.categoria_id);
    if (cat?.umbral_confianza != null) return cat.umbral_confianza;
    const proc = (this.procesos()[c.buzon_id] ?? []).find((p) => p.id === cat?.proceso_id);
    if (proc?.umbral != null) return proc.umbral;
    return this.buzones().find((x) => x.id === c.buzon_id)?.umbral_confianza ?? null;
  }

  protected porQue(c: Correo): string | null {
    const j = (c.justificacion ?? '').split(' | Requiere humano:')[0].trim();
    return j || null;
  }

  protected etiquetaLista(c: Correo): string | null {
    return c.estado === 'revision' ? c.proceso_clave ?? c.categoria_clave : c.categoria_clave ?? c.proceso_clave;
  }

  protected carpetaHilo(c: Correo, h: HiloCorreo): string {
    const p = this.equipo().find((x) => x.id === c.asignado_persona_id);
    return p?.carpeta ?? h.buzon.carpeta_vigilada ?? 'Bandeja de entrada';
  }

  protected estadoBadge(e: EstadoCorreo): { nombre: string; cls: string } {
    return (
      {
        revision: { nombre: 'Validar', cls: 'b-amber' },
        ejecutado: { nombre: 'Ejecutado', cls: 'b-emerald' },
        ignorado: { nombre: 'Ignorado', cls: 'b-slate' },
        error: { nombre: 'Error', cls: 'b-rose' },
        pendiente: { nombre: 'Pendiente', cls: 'b-sky' },
      } as Record<EstadoCorreo, { nombre: string; cls: string }>
    )[e];
  }

  protected pct(c: number): string {
    return `${Math.round(c * 100)}%`;
  }

  protected colorConf(c: number): string {
    return c >= 0.8 ? 'var(--emerald)' : c >= 0.7 ? 'var(--amber)' : 'var(--rose)';
  }

  protected hora(iso: string): string {
    const d = new Date(iso);
    return new Date().toDateString() === d.toDateString()
      ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  }

  protected cuando(iso: string): string {
    const d = new Date(iso);
    const hoy = new Date().toDateString() === d.toDateString();
    return hoy ? `hoy ${d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
