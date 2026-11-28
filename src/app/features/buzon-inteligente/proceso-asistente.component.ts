// Asistente de procesos «simples» (095): un proceso = un prompt + casillas. Es el MISMO
// para crear y para editar (prototipo aprobado: prototipos/asistente-proceso.html): una
// pregunta por pantalla; al editar llega lleno, con los pasos ✓ y salto libre, y cambiar
// un paso no reescribe los demás. El prompt se guarda TAL CUAL (sin «Analizar con Nova»)
// y el analista no ve JSON ni «datos a extraer»: cada casilla declara el dato que copia la IA.

import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { aGrupoIn } from './buzon-asignacion';
import { Buzon, BuzonApi, Categoria, Grupo, Proceso, ProcesoCompletoIn } from './buzon.api';
import {
  Casilla,
  FRASES,
  OPERADORES_SI,
  SUGERENCIAS_DATOS,
  SUGERENCIAS_DOCS,
  TipoFrase,
  aRevision,
  comoAuto,
  datosUsados,
  deRevision,
  errorCasilla,
  frase,
  nuevaCasilla,
  primerParrafo,
  repetidasEnTexto,
  textoCasilla,
} from './buzon-casillas';
import { PruebaCorreoComponent } from './prueba-correo.component';

const PASOS = ['Nombre', 'Cómo se reconoce', 'Qué revisar', 'A dónde va', 'Probar', 'Publicar'];

/** «4X1000 Bancolombia» → 4X1000_BANCOLOMBIA (clave del proceso y de su etiqueta). */
function claveProceso(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

/** Cómo sale el correo con cada grupo de Asignación. */
export function destinoGrupo(g: Grupo): string {
  switch (g.destino) {
    case 'personas': return 'Se reparte entre las personas del grupo';
    case 'carpeta': return `Va a la carpeta «${g.carpeta ?? ''}»`;
    case 'reenviar': return `Se reenvía a ${(g.destinatarios ?? []).join(', ') || 'los destinatarios del grupo'}`;
    case 'responder': return 'Se responde con el mensaje del grupo';
    default: return 'Solo se etiqueta';
  }
}

@Component({
  selector: 'alma-proceso-asistente',
  imports: [FormsModule, LucideAngularModule, PruebaCorreoComponent],
  styleUrls: ['./buzon-proto.css'],
  styles: [
    `.pasos { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
     .pasos button { border: 1px solid transparent; border-radius: 10px; padding: 6px 8px; background: var(--sunken); color: var(--muted-foreground);
                     font: inherit; font-size: 0.72rem; font-weight: 650; cursor: pointer; text-align: center; }
     .pasos button.on { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary-ink); border-color: var(--primary); }
     .pasos button.ok { color: var(--emerald); }
     .pasos button:disabled { opacity: 0.5; cursor: not-allowed; }
     @media (max-width: 700px) { .pasos { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
     .q { font-size: 1.05rem; font-weight: 650; }
     .casilla { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 10px; background: var(--sunken); }
     .casilla.off { opacity: 0.6; }
     textarea.prompt { min-height: 260px; font-size: 0.85rem; line-height: 1.55; resize: vertical; height: auto; padding: 10px 12px; }`,
  ],
  template: `
    <div class="glass r-2xl stack" style="padding:18px;gap:14px">
      <div class="row between">
        <p class="xs muted">{{ esNuevo() ? 'Nuevo proceso' : 'Editando «' + (proceso()?.nombre ?? '') + '»' }}</p>
        <button type="button" class="btn outline sm" (click)="cerrar()"><lucide-icon name="arrow-left" [size]="13" /> Volver a la lista</button>
      </div>

      <div class="pasos" role="tablist" aria-label="Pasos del proceso">
        @for (p of pasos; track p; let i = $index) {
          <button type="button" role="tab" [class.on]="i === paso()" [class.ok]="hechos().has(i) && i !== paso()" [attr.aria-selected]="i === paso()"
            [disabled]="!puedeIr(i)" (click)="ir(i)">{{ hechos().has(i) && i !== paso() ? '✓' : i + 1 + '.' }} {{ p }}</button>
        }
      </div>

      <div class="stack" style="gap:10px;min-height:220px">
        @switch (paso()) {
          @case (0) {
            <p class="q">¿Cómo se llama este caso?</p>
            <p class="xs muted">Un nombre corto que el equipo reconozca.</p>
            <input class="input" style="max-width:480px" [(ngModel)]="nombre" (ngModelChange)="cambio()" placeholder="4X1000 Bancolombia" aria-label="Nombre del caso" />
            <label class="fld" style="max-width:480px">
              <span class="label">Familia (opcional): para ver juntos en la lista los casos parecidos</span>
              <input class="input" list="pa-familias" [(ngModel)]="familia" (ngModelChange)="cambio()" placeholder="4X1000" aria-label="Familia del caso" />
            </label>
            <datalist id="pa-familias">@for (f of familias(); track f) { <option [value]="f"></option> }</datalist>
            @if (etiquetaFinal()) {
              <span class="row xs muted" style="gap:6px"><lucide-icon name="tag" [size]="12" /> Etiqueta en Outlook: <span class="key">{{ etiquetaFinal() }}</span>
                @if (!esNuevo() && !cambiandoEt) { <button type="button" class="linkbtn xs" (click)="abrirCambioEt()">Cambiar la etiqueta</button> }</span>
              @if (!esNuevo() && !cambiandoEt) {
                <p class="xxs muted">Se creó con el primer nombre del caso y no cambia al renombrarlo, para no perder los correos ya etiquetados ni su grupo.</p>
              }
              @if (cambiandoEt) {
                <div class="sunk r-xl stack" style="padding:10px 12px;gap:6px">
                  <label class="fld"><span class="label">Nueva etiqueta (en MAYÚSCULAS, sin espacios ni tildes)</span>
                    <input class="input mono" style="max-width:360px" [(ngModel)]="nuevaEtiqueta" (ngModelChange)="cambio()" aria-label="Nueva etiqueta" /></label>
                  <p class="xxs muted">Los correos que ya tienen <span class="key">{{ etiqueta() }}</span> en Outlook la conservan. El grupo de Asignación y el historial en Nova pasan a la nueva.</p>
                  <button type="button" class="linkbtn xs" style="justify-self:start" (click)="cancelarCambioEt()">No cambiarla</button>
                </div>
              }
            }
          }
          @case (1) {
            <p class="q">¿Cómo reconozco este caso?</p>
            <p class="xs muted">Explícalo como a una persona nueva. Empieza con una frase que diga qué es y con qué NO se debe confundir.</p>
            <textarea class="input prompt" [(ngModel)]="texto" (ngModelChange)="cambio()" aria-label="Cómo se reconoce el caso"
              placeholder="Carta del cliente para que Bancolombia traslade plata sin cobrar el 4x1000… Si el banco ya contestó, NO es este caso."></textarea>
            <div class="row between">
              <span class="xxs muted">{{ texto.length.toLocaleString('es-CO') }} letras · se guarda tal cual, sin cambiarle nada</span>
            </div>
            <p class="note b-sky"><lucide-icon name="info" [size]="13" />
              <span>Aquí solo va qué es el caso. Lo que debe cumplir (dígitos, fechas, que coincida) se marca en el siguiente paso.</span></p>
            @if (primero()) {
              <div class="sunk r-xl" style="padding:8px 12px">
                <p class="xxs muted b">Con esta primera parte Nova elige el proceso:</p>
                <p class="xs">{{ primero() }}</p>
              </div>
            }
            @if (repetidas().length) {
              <p class="note b-amber"><lucide-icon name="alert-triangle" [size]="13" />
                <span>Tu texto también pide «{{ repetidas().join('», «') }}», y eso ya lo revisa una casilla. Puedes quitarlo del texto para que no se decida dos veces.</span></p>
            }
          }
          @case (2) {
            <p class="q">¿Qué tiene que cumplir para salir solo?</p>
            <p class="xs muted">Marca lo que Nova debe revisar siempre. Si algo no se cumple, el correo va a Validar con esa frase.</p>
            @for (c of casillas; track $index; let i = $index) {
              <div class="casilla" [class.off]="!c.activa">
                <input type="checkbox" [(ngModel)]="c.activa" (ngModelChange)="cambio()" [attr.aria-label]="'Revisar: ' + textoCasilla(c)" />
                <span class="sm" style="flex:1;min-width:0">{{ textoCasilla(c) }}
                  @if (c.tipo === 'otra') { <span class="badge b-slate" title="Se creó fuera del asistente: solo se puede activar o quitar">Hecha aparte</span> }</span>
                @if (c.tipo !== 'otra') {
                  <button type="button" class="btn ghost" (click)="editar(i)" [attr.aria-label]="'Editar ' + textoCasilla(c)"><lucide-icon name="pencil" [size]="13" /></button>
                }
                <button type="button" class="btn ghost danger" (click)="quitar(i)" [attr.aria-label]="'Quitar ' + textoCasilla(c)"><lucide-icon name="x" [size]="13" /></button>
              </div>
            } @empty {
              @if (!ed) { <p class="xs muted">Todavía no hay casillas: sin ellas, el correo sale solo cuando la IA está segura.</p> }
            }

            @if (ed; as e) {
              <div class="sunk r-xl stack" style="padding:12px;gap:10px">
                @if (!elegida) {
                  <p class="sm b">¿Qué quieres que revise Nova?</p>
                  <div class="g2">
                    @for (f of frases; track f.tipo) {
                      <button type="button" class="optcard" (click)="elegir(f.tipo)">
                        <span class="sm b">{{ f.molde }}</span><span class="xs muted">{{ f.ejemplo }}</span>
                      </button>
                    }
                  </div>
                } @else {
                  @if (e.tipo !== 'firmada') {
                    <div class="g2">
                      <label class="fld"><span class="label">{{ e.tipo === 'fecha' ? 'La fecha' : 'El dato' }}</span>
                        <input class="input" list="pa-datos" [(ngModel)]="e.dato" [placeholder]="e.tipo === 'fecha' ? 'la fecha de la carta' : 'la cuenta del cliente'" /></label>
                      @switch (e.tipo) {
                        @case ('digitos') { <label class="fld"><span class="label">¿Cuántos dígitos?</span><input class="input" inputmode="numeric" [(ngModel)]="e.numero" placeholder="11" /></label> }
                        @case ('fecha') { <label class="fld"><span class="label">¿Cuántos días hacia atrás? (0 = solo hoy, 1 = hoy o ayer)</span><input class="input" inputmode="numeric" [(ngModel)]="e.numero" placeholder="1" /></label> }
                        @case ('empieza') { <label class="fld"><span class="label">¿Con qué números empieza?</span><input class="input" inputmode="numeric" [(ngModel)]="e.numero" placeholder="10000" /></label> }
                        @case ('distintos') { <label class="fld"><span class="label">¿Distinto de qué otro dato?</span><input class="input" list="pa-datos" [(ngModel)]="e.datoB" placeholder="la cuenta de Skandia" /></label> }
                        @case ('no_permitido') { <label class="fld"><span class="label">¿Qué valor no se permite?</span><input class="input" [(ngModel)]="e.valor" placeholder="Bancolombia" /></label> }
                      }
                    </div>
                    @if (e.tipo === 'iguales') {
                      <div class="g2">
                        <label class="fld"><span class="label">En este documento…</span><input class="input" list="pa-docs" [(ngModel)]="e.docA" placeholder="la carta" /></label>
                        <label class="fld"><span class="label">…y en este otro</span><input class="input" list="pa-docs" [(ngModel)]="e.docB" placeholder="el certificado" /></label>
                      </div>
                    }
                  } @else {
                    <p class="xs muted">Nova mira el espacio de la firma de la carta. Si solo tiene el texto y no puede ver la firma, no lo cuenta como falla.</p>
                  }
                  <div class="stack" style="gap:2px">
                    <p class="xs">Así se verá: <b>«{{ textoCasilla(e) }}»</b></p>
                    <p class="xxs muted">Si no se cumple, va a Validar con: «No se cumple: {{ frase(e) }}».</p>
                  </div>
                  <details>
                    <summary class="xs muted" style="cursor:pointer">Avanzado</summary>
                    <div class="stack" style="gap:8px;margin-top:8px">
                      <div class="row" style="gap:6px">
                        <span class="xs">Solo cuando</span>
                        <input class="input sm" style="max-width:200px" list="pa-datos" [ngModel]="e.si?.dato ?? ''" (ngModelChange)="siDato(e, $event)" placeholder="el banco" aria-label="Dato de «Solo cuando»" />
                        @if (e.si) {
                          <select class="input sm" style="width:auto" [(ngModel)]="e.si.op" aria-label="Condición">
                            @for (o of operadoresSi; track o.op) { <option [value]="o.op">{{ o.texto }}</option> }
                          </select>
                          @if (conValor(e)) { <input class="input sm" style="max-width:200px" [(ngModel)]="e.si.valor" [placeholder]="e.si.op === 'en' ? 'valor1, valor2' : 'valor'" aria-label="Valor de «Solo cuando»" /> }
                        }
                      </div>
                      @if (e.tipo === 'iguales') {
                        <label class="row xs" style="gap:6px">Comparar
                          <select class="input sm" style="width:auto" [(ngModel)]="e.como" aria-label="Cómo comparar">
                            <option value="">automático ({{ comoTexto(comoAuto(e.dato)) }})</option>
                            <option value="numero">como número</option>
                            <option value="texto">como texto</option>
                            <option value="palabras">por palabras, en cualquier orden</option>
                          </select>
                        </label>
                      }
                    </div>
                  </details>
                  @if (errorEd()) { <p class="xs" style="color:var(--rose)">{{ errorEd() }}</p> }
                }
                <div class="row" style="justify-content:flex-end">
                  <button type="button" class="btn outline sm" (click)="cancelarEd()">Cancelar</button>
                  @if (elegida) { <button type="button" class="btn primary sm" (click)="listoEd()"><lucide-icon name="check" [size]="13" /> Listo</button> }
                </div>
              </div>
            } @else {
              <button type="button" class="btn outline sm" style="justify-self:start" (click)="agregar()"><lucide-icon name="plus" [size]="13" /> Agregar revisión</button>
            }
            @if (repetidas().length) {
              <p class="note b-amber"><lucide-icon name="alert-triangle" [size]="13" />
                <span>Tu texto del paso 2 también pide «{{ repetidas().join('», «') }}». Lo revisa una casilla: puedes quitarlo del texto.</span></p>
            }
            <datalist id="pa-datos">@for (d of sugerenciasDatos(); track d) { <option [value]="d"></option> }</datalist>
            <datalist id="pa-docs">@for (d of sugerenciasDocs; track d) { <option [value]="d"></option> }</datalist>
          }
          @case (3) {
            <p class="q">¿A dónde va cuando sale solo?</p>
            <p class="xs muted">La etiqueta <span class="key">{{ etiqueta() }}</span> se pone sola en Outlook. Elige qué más pasa con el correo.</p>
            @if (!buzon().mod_asignacion) {
              <p class="note b-sky"><lucide-icon name="info" [size]="13" />
                <span>La Asignación está apagada: cuando sale solo, el correo queda con su etiqueta en Outlook. Para mandarlo a una carpeta o a personas, activa el módulo «Asignación» con el botón «Activar módulo».</span></p>
            } @else {
              <div class="g2">
                <button type="button" class="optcard" [attr.aria-pressed]="grupoId === ''" (click)="elegirGrupo('')">
                  <span class="sm b"><lucide-icon name="tag" [size]="13" /> Solo ponerle la etiqueta</span>
                  <span class="xs muted">No se mueve ni se asigna a nadie.</span>
                </button>
                @for (g of grupos(); track g.id) {
                  <button type="button" class="optcard" [attr.aria-pressed]="grupoId === g.id" (click)="elegirGrupo(g.id)">
                    <span class="sm b"><lucide-icon name="users" [size]="13" /> {{ g.nombre }}</span>
                    <span class="xs muted">{{ destinoGrupo(g) }}</span>
                    @if (otrasDe(g); as otras) { <span class="xxs muted trunc">Con: {{ otras }}</span> }
                  </button>
                }
              </div>
              <p class="xxs muted">¿Necesitas un grupo nuevo? Créalo en la pestaña Asignación y vuelve aquí.</p>
            }
          }
          @case (4) {
            <p class="q">Probemos con un correo de verdad</p>
            <p class="xs muted">Busca por asunto en el buzón. Al probar se guarda lo que llevas en el borrador (todavía no se publica).</p>
            <alma-prueba-correo [buzon]="buzon()" [proceso]="claveGuardada() ?? clave()" [nombre]="nombre" [nombresDatos]="nombresDatos()"
              [antesDeProbar]="antesDeProbar" (probado)="alProbar()" />
          }
          @case (5) {
            <p class="q">Revisa y publica</p>
            @if (publicado()) {
              <p class="note b-emerald"><lucide-icon name="check-circle-2" [size]="13" />
                <span><b>Publicado.</b> Nova ya usa este caso. Para cambiarlo, ábrelo y edita solo el paso que necesites.</span></p>
            } @else {
              <div class="sunk r-xl stack" style="padding:12px 14px;gap:8px">
                <p class="sm"><b>{{ nombre || '(sin nombre)' }}</b> <span class="key">{{ etiquetaFinal() }}</span>
                  @if (familia.trim()) { <span class="badge b-slate"><lucide-icon name="layers" [size]="12" /> {{ familia.trim() }}</span> }</p>
                <p class="xs"><span class="muted">Se reconoce:</span> {{ resumenTexto() }}</p>
                <div class="xs"><span class="muted">Revisa:</span>
                  @for (c of activas(); track $index) { <div>☑ {{ textoCasilla(c) }}</div> } @empty { nada; sale solo cuando la IA está segura. }
                </div>
                <p class="xs"><span class="muted">Va a:</span> {{ destinoElegido() }}</p>
                @if (probado()) {
                  <p class="xs" style="color:var(--emerald)"><lucide-icon name="check" [size]="12" /> Probado con un correo</p>
                } @else {
                  <p class="xs" style="color:var(--amber)"><lucide-icon name="alert-triangle" [size]="12" /> Aún no lo has probado ·
                    <button type="button" class="linkbtn xs" (click)="ir(4)">Probar ahora</button></p>
                }
              </div>
              <p class="xxs muted">{{ sucio() ? 'Tienes cambios sin guardar.' : 'Guardado en el borrador.' }}
                Publicar sube todo el borrador del buzón: también los cambios pendientes de otros procesos.</p>
            }
          }
        }
        @if (error()) { <p class="note b-rose"><lucide-icon name="alert-triangle" [size]="13" /> <span>{{ error() }}</span></p> }
      </div>

      @if (!publicado()) {
        <div class="row between" style="border-top:1px solid var(--border);padding-top:12px">
          <button type="button" class="btn outline" [style.visibility]="paso() ? 'visible' : 'hidden'" (click)="atras()"><lucide-icon name="arrow-left" [size]="14" /> Atrás</button>
          <div class="row">
            @if (paso() === 5) {
              <button type="button" class="btn outline" [disabled]="ocupado()" (click)="guardarSolo()"><lucide-icon name="save" [size]="14" /> Guardar en el borrador</button>
              <button type="button" class="btn primary" [disabled]="ocupado()" (click)="publicar()">
                <lucide-icon [name]="publicando() ? 'loader-2' : 'upload-cloud'" [size]="14" [class.animate-spin]="publicando()" /> {{ publicando() ? 'Publicando…' : 'Publicar' }}</button>
            } @else {
              @if (!esNuevo() && sucio()) {
                <button type="button" class="btn outline" [disabled]="ocupado()" (click)="guardarSolo()"><lucide-icon name="save" [size]="14" /> Guardar</button>
              }
              <button type="button" class="btn primary" [disabled]="ocupado()" (click)="siguiente()">Siguiente <lucide-icon name="arrow-right" [size]="14" /></button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ProcesoAsistenteComponent implements OnInit {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  /** null = proceso nuevo. */
  readonly proceso = input<Proceso | null>(null);
  readonly procesos = input<Proceso[]>([]);
  readonly categorias = input<Categoria[]>([]);
  readonly grupos = input<Grupo[]>([]);
  readonly pasoInicial = input(0);
  /** Proceso nuevo desde «+ Nuevo en <familia>»: llega con la familia puesta. */
  readonly familiaInicial = input('');
  /** Se guardó en el borrador (la lista debe recargarse). */
  readonly guardado = output<Proceso>();
  readonly publicadoEv = output<void>({ alias: 'publicado' });
  readonly cerrado = output<void>();
  /** Se probó con un correo (clave del proceso): la ficha lo muestra en esta sesión. */
  readonly probo = output<string>();

  protected readonly pasos = PASOS;
  protected readonly frases = FRASES;
  protected readonly operadoresSi = OPERADORES_SI;
  protected readonly sugerenciasDocs = SUGERENCIAS_DOCS;
  protected readonly textoCasilla = textoCasilla;
  protected readonly frase = frase;
  protected readonly comoAuto = comoAuto;
  protected readonly destinoGrupo = destinoGrupo;

  // Lo que se edita va en propiedades simples con ngModel; cada cambio marca «sucio».
  protected nombre = '';
  protected familia = '';
  protected texto = '';
  protected casillas: Casilla[] = [];
  protected grupoId = '';
  private grupoInicial = '';
  /** «Cambiar la etiqueta» (solo al editar): renombra el proceso y su etiqueta juntos. */
  protected cambiandoEt = false;
  protected nuevaEtiqueta = '';
  /** Casilla abierta en el editor (copia) y su posición; -1 = nueva. */
  protected ed: Casilla | null = null;
  protected elegida = false;
  private edIdx = -1;

  protected readonly paso = signal(0);
  protected readonly hechos = signal<Set<number>>(new Set());
  protected readonly sucio = signal(false);
  protected readonly probado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly publicando = signal(false);
  protected readonly publicado = signal(false);
  protected readonly error = signal('');
  protected readonly errorEd = signal('');
  /** Clave con la que quedó guardado (null = aún no existe en el borrador). */
  protected readonly claveGuardada = signal<string | null>(null);
  private readonly guardadoProc = signal<Proceso | null>(null);
  /** Sube en cada cambio para que los computed que leen propiedades simples se recalculen. */
  private readonly version = signal(0);

  protected readonly esNuevo = computed(() => !this.proceso());
  protected readonly ocupado = computed(() => this.guardando() || this.publicando());
  private readonly base = computed(() => this.guardadoProc() ?? this.proceso());
  protected readonly clave = computed(() => (this.version(), this.base()?.clave ?? claveProceso(this.nombre)));
  /** Etiquetas activas del proceso guardado; un proceso nuevo lleva una con su misma clave. */
  private readonly etiquetasProceso = computed(() => {
    const b = this.base();
    return b ? this.categorias().filter((c) => c.proceso_id === b.id && c.activa && !c.es_fallback) : [];
  });
  protected readonly etiqueta = computed(() => this.etiquetasProceso()[0]?.clave ?? this.clave());
  /** La que quedará: la nueva si se está cambiando, si no la de ahora. */
  protected readonly etiquetaFinal = computed(() => (this.version(), this.cambiandoEt ? claveProceso(this.nuevaEtiqueta) : this.etiqueta()));
  /** Se está cambiando a una clave distinta de la actual. */
  private readonly renombra = computed(() => (this.version(), this.cambiandoEt && !!this.etiquetaFinal() && this.etiquetaFinal() !== this.etiqueta()));
  protected readonly primero = computed(() => (this.version(), primerParrafo(this.texto)));
  protected readonly repetidas = computed(() => (this.version(), repetidasEnTexto(this.texto, this.casillas)));
  protected readonly sugerenciasDatos = computed(() => (this.version(), [...new Set([...datosUsados(this.casillas), ...SUGERENCIAS_DATOS])]));
  /** Clave del dato → cómo lo llama el analista, para mostrar lo que copió la IA al probar. */
  protected readonly nombresDatos = computed(() => {
    this.version();
    const m: Record<string, string> = {};
    for (const c of this.casillas) {
      for (const d of aRevision(c).datos ?? []) {
        m[d.clave] = d.clave === 'carta_firmada' ? 'la carta está firmada' : d.descripcion.replace(/,\s*(tal como aparece|la fecha IMPRESA)[\s\S]*$/, '').toLowerCase();
      }
    }
    return m;
  });
  protected readonly activas = computed(() => (this.version(), this.casillas.filter((c) => c.activa)));
  /** Familias que ya existen, para escribir la misma (sin duplicarla con otra ortografía). */
  protected readonly familias = computed(() => [...new Set(this.procesos().map((p) => (p.familia ?? '').trim()).filter(Boolean))].sort());

  /** El paso 5 guarda el borrador antes de probar (el backend prueba con él). */
  protected readonly antesDeProbar = async (): Promise<boolean> => (this.sucio() || !this.claveGuardada() ? this.guardar() : true);

  ngOnInit(): void {
    const p = this.proceso();
    if (p) {
      this.nombre = p.nombre;
      this.familia = p.familia ?? '';
      this.texto = p.reglas ?? '';
      this.casillas = (p.revisiones ?? []).map(deRevision);
      const et = this.etiquetasProceso().map((c) => c.clave);
      this.grupoId = this.grupoInicial = this.grupos().find((g) => g.etiquetas.some((e) => et.includes(e)))?.id ?? '';
      this.claveGuardada.set(p.clave);
      this.hechos.set(new Set(PASOS.map((_, i) => i)));
      this.paso.set(Math.min(Math.max(this.pasoInicial(), 0), PASOS.length - 1));
    } else {
      this.familia = this.familiaInicial();
      this.sucio.set(true);
    }
    this.version.update((v) => v + 1);
  }

  protected abrirCambioEt(): void {
    this.cambiandoEt = true;
    this.nuevaEtiqueta = claveProceso(this.nombre) || this.etiqueta();
    this.cambio();
  }

  protected cancelarCambioEt(): void {
    this.cambiandoEt = false;
    this.nuevaEtiqueta = '';
    this.cambio();
  }

  protected alProbar(): void {
    this.probado.set(true);
    this.probo.emit(this.claveGuardada() ?? this.clave());
  }

  protected cambio(): void {
    this.sucio.set(true);
    this.version.update((v) => v + 1);
  }

  // ── Navegación ──
  protected puedeIr(i: number): boolean {
    return !this.esNuevo() || i <= Math.max(-1, ...this.hechos()) + 1;
  }

  protected ir(i: number): void {
    if (!this.puedeIr(i) || this.ocupado()) return;
    this.error.set('');
    this.paso.set(i);
  }

  protected atras(): void {
    if (this.paso() > 0) this.ir(this.paso() - 1);
  }

  protected siguiente(): void {
    const e = this.errorPaso(this.paso());
    if (e) {
      this.error.set(e);
      return;
    }
    this.error.set('');
    this.hechos.update((s) => new Set(s).add(this.paso()));
    this.paso.update((p) => Math.min(p + 1, PASOS.length - 1));
  }

  private errorPaso(i: number): string {
    if (i === 0) {
      if (!this.nombre.trim()) return 'Escribe un nombre para el caso.';
      if (!this.clave()) return 'El nombre debe tener letras o números.';
      const id = this.base()?.id;
      if (this.procesos().some((p) => p.clave === this.clave() && p.id !== id)) return `Ya existe un proceso «${this.clave()}». Usa otro nombre.`;
      if (!this.base() && this.categorias().some((c) => c.clave === this.clave() && c.activa && c.proceso_id)) return `Ya hay una etiqueta «${this.clave()}» en otro proceso. Usa otro nombre.`;
      if (this.cambiandoEt) {
        const k = this.etiquetaFinal();
        if (!k) return 'Escribe la etiqueta nueva o pulsa «No cambiarla».';
        if (this.renombra()) {
          if (this.procesos().some((p) => p.clave === k && p.id !== id)) return `Ya existe un proceso «${k}». Usa otra etiqueta.`;
          if (this.categorias().some((c) => c.clave === k && c.activa && c.proceso_id !== id)) return `Ya hay una etiqueta «${k}» en otro proceso. Usa otra.`;
        }
      }
    }
    if (i === 1 && this.texto.trim().length < 20) return 'Escribe cómo se reconoce el caso (al menos una frase).';
    if (i === 2 && this.ed) return 'Termina o cancela la revisión que estás editando.';
    return '';
  }

  // ── Casillas (paso 3) ──
  protected agregar(): void {
    this.ed = nuevaCasilla('digitos');
    this.elegida = false;
    this.edIdx = -1;
    this.errorEd.set('');
  }

  protected elegir(t: TipoFrase): void {
    if (!this.ed) return;
    this.ed = { ...nuevaCasilla(t), dato: this.ed.dato };
    this.elegida = true;
  }

  protected editar(i: number): void {
    this.ed = { ...this.casillas[i], si: this.casillas[i].si ? { ...this.casillas[i].si! } : null };
    this.elegida = true;
    this.edIdx = i;
    this.errorEd.set('');
  }

  protected cancelarEd(): void {
    this.ed = null;
    this.errorEd.set('');
  }

  protected listoEd(): void {
    const e = this.ed;
    if (!e) return;
    if (e.si && !e.si.dato.trim()) e.si = null;
    const err = errorCasilla(e);
    if (err) {
      this.errorEd.set(err);
      return;
    }
    const c: Casilla = { ...e, editada: true };
    if (this.edIdx < 0) this.casillas = [...this.casillas, c];
    else this.casillas = this.casillas.map((x, j) => (j === this.edIdx ? c : x));
    this.ed = null;
    this.errorEd.set('');
    this.cambio();
  }

  protected quitar(i: number): void {
    this.casillas = this.casillas.filter((_, j) => j !== i);
    this.cambio();
  }

  protected siDato(e: Casilla, dato: string): void {
    e.si = dato.trim() ? { dato, op: e.si?.op ?? '=', valor: e.si?.valor ?? '' } : null;
  }

  protected conValor(e: Casilla): boolean {
    return !!e.si && !!OPERADORES_SI.find((o) => o.op === e.si!.op)?.valor;
  }

  protected comoTexto(c: string): string {
    return ({ numero: 'como número', texto: 'como texto', palabras: 'por palabras' } as Record<string, string>)[c] ?? c;
  }

  // ── A dónde va (paso 4) ──
  protected elegirGrupo(id: string): void {
    this.grupoId = id;
    this.cambio();
  }

  protected otrasDe(g: Grupo): string {
    const propia = this.etiqueta();
    const otras = g.etiquetas.filter((e) => e !== propia);
    return otras.slice(0, 4).join(', ') + (otras.length > 4 ? '…' : '');
  }

  protected destinoElegido(): string {
    if (!this.buzon().mod_asignacion) return 'Solo se etiqueta (la Asignación está apagada)';
    const g = this.grupos().find((x) => x.id === this.grupoId);
    return g ? `${g.nombre}: ${destinoGrupo(g).toLowerCase()}` : 'Solo se etiqueta';
  }

  protected resumenTexto(): string {
    const p = primerParrafo(this.texto);
    return (p.length > 220 ? p.slice(0, 220) + '…' : p || '(sin texto)') + ` (${this.texto.length.toLocaleString('es-CO')} letras)`;
  }

  // ── Guardar y publicar ──
  /** Guarda el proceso en el borrador (y su grupo, si cambió). false = no se pudo. */
  private async guardar(): Promise<boolean> {
    for (const i of [0, 1]) {
      const e = this.errorPaso(i);
      if (e) {
        this.paso.set(i);
        this.error.set(e);
        return false;
      }
    }
    this.guardando.set(true);
    this.error.set('');
    try {
      const b = this.base();
      const renombra = this.renombra();
      const anterior = this.etiqueta();
      // Al cambiar la etiqueta, el proceso toma la misma clave nueva (un proceso = una etiqueta).
      const clave = renombra ? this.etiquetaFinal() : this.clave();
      const existentes = this.etiquetasProceso();
      // Las etiquetas que ya tiene se reenvían tal cual (con sus condiciones, aunque sean compuestas);
      // la que se renombra lleva `original`: el backend conserva su id, acciones e historial.
      const etiquetas: ProcesoCompletoIn['etiquetas'] = existentes.length
        ? existentes.map((c) => ({
            clave: renombra && c.clave === anterior ? clave : c.clave, ...(renombra && c.clave === anterior ? { original: anterior } : {}),
            nombre: c.nombre, descripcion: c.descripcion, criterio: c.criterio ?? 'ia', condicion: c.condicion ?? null, origen: c.origen ?? 'user',
          }))
        : [{ clave, nombre: this.nombre.trim(), descripcion: primerParrafo(this.texto).slice(0, 2000) || this.nombre.trim(), criterio: 'ia', origen: 'user' }];
      const g = await this.api.guardarProcesoCompleto(this.buzon().id, {
        original: this.claveGuardada(),
        proceso: {
          clave, nombre: this.nombre.trim(), descripcion: b?.descripcion ?? null, exclusiones: b?.exclusiones ?? null,
          campos_extraer: [], color: b?.color ?? null, activo: b?.activo ?? true, umbral: b?.umbral ?? null,
          causas_validar: b?.causas_validar ?? [],
          // TAL CUAL: sin recortar ni condensar.
          reglas: this.texto, modo: 'simple', revisiones: this.casillas.map(aRevision),
          // Misma ortografía que la familia que ya existe (sin importar mayúsculas).
          familia: this.familias().find((f) => f.toLowerCase() === this.familia.trim().toLowerCase()) ?? (this.familia.trim() || null),
        },
        etiquetas,
      });
      // Tras un renombre los grupos ya tienen la clave nueva (lo hace el backend): se leen de nuevo.
      const grupos = renombra && this.buzon().mod_asignacion ? await this.api.listarGrupos(this.buzon().id) : this.grupos();
      await this.guardarGrupo(etiquetas[0].clave, grupos);
      this.guardadoProc.set(g);
      this.claveGuardada.set(g.clave);
      if (renombra) {
        this.cambiandoEt = false;
        this.nuevaEtiqueta = '';
        this.version.update((v) => v + 1);
        this.toast.show(`Etiqueta cambiada: ${anterior} → ${clave}`, 'Publica para que Nova use la nueva.');
      }
      this.sucio.set(false);
      this.guardado.emit(g);
      return true;
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  /** Pone la etiqueta en el grupo elegido y la saca de los demás (solo si cambió). */
  private async guardarGrupo(et: string, grupos: Grupo[]): Promise<void> {
    if (!this.buzon().mod_asignacion || this.grupoId === this.grupoInicial) return;
    for (const g of grupos) {
      const tiene = g.etiquetas.includes(et);
      if (g.id === this.grupoId && !tiene) await this.api.actualizarGrupo(g.id, aGrupoIn(g, { etiquetas: [...g.etiquetas, et] }));
      else if (g.id !== this.grupoId && tiene) await this.api.actualizarGrupo(g.id, aGrupoIn(g, { etiquetas: g.etiquetas.filter((x) => x !== et) }));
    }
    this.grupoInicial = this.grupoId;
  }

  protected async guardarSolo(): Promise<void> {
    if (await this.guardar()) this.toast.show(`«${this.nombre.trim()}» guardado en el borrador`, 'Publica para que Nova lo use.');
  }

  protected async publicar(): Promise<void> {
    if ((this.sucio() || !this.claveGuardada()) && !(await this.guardar())) return;
    this.publicando.set(true);
    try {
      const est = await this.api.estadoReglas(this.buzon().id);
      const n = est.cambios.length;
      if (!confirm(`¿Publicar v${est.siguiente}?${n ? ` Se publican ${n} cambio(s) del borrador, incluidos los de otros procesos.` : ''} Desde ya Nova clasifica los correos nuevos con estas reglas.`)) return;
      const r = await this.api.publicarReglas(this.buzon().id);
      this.publicado.set(true);
      this.toast.show(`Reglas v${r.version} publicadas`, `«${this.nombre.trim()}» ya está en uso.`);
      this.publicadoEv.emit();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.publicando.set(false);
    }
  }

  protected cerrar(): void {
    if (this.sucio() && !this.esNuevo() && !confirm('Tienes cambios sin guardar. ¿Salir sin guardarlos?')) return;
    if (this.sucio() && this.esNuevo() && (this.nombre.trim() || this.texto.trim()) && !confirm('El proceso nuevo no se ha guardado. ¿Salir sin guardarlo?')) return;
    this.cerrado.emit();
  }
}
