// Editor de un formulario de datos de la Agenda (migración 087): lo que pide el sitio público
// al agendar, además de los datos fijos (nombre, correo, celular y autorización).
//
// Las preguntas se identifican por su «id», que es la clave con la que se guardan las
// respuestas. Por eso el id se propone a partir del texto mientras la pregunta es nueva y
// queda fijo una vez guardada: cambiar el texto no rompe las respuestas de citas anteriores.
// A la derecha, una vista previa de cómo lo verá la persona.

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import {
  AgendaApi, FormularioDatos, FormularioServicio, PreguntaFormulario, TIPOS_DOCUMENTO, TIPOS_PREGUNTA, TipoPregunta,
  identificador, leerFormulario,
} from './agenda.api';

interface PreguntaEdit {
  clave: number;            // para el @for (el id puede cambiar mientras se escribe)
  id: string;
  idFijo: boolean;          // ya guardada: el id no se toca
  idManual: boolean;        // la persona escribió el id a mano
  etiqueta: string;
  tipo: TipoPregunta;
  requerido: boolean;
  opciones: string;         // una por línea
  min: string;
  max: string;
  ayuda: string;
}

interface Borrador {
  nombre: string;
  descripcion: string;
  activo: boolean;
  docRequerido: boolean;
  docTipos: string[];
  etiquetaTipo: string;
  etiquetaNumero: string;
  preguntas: PreguntaEdit[];
}

const MAX_PREGUNTAS = 25;
let secuencia = 0;

@Component({
  selector: 'alma-formulario-editor',
  imports: [LucideAngularModule],
  template: `
    <div class="grid gap-4 2xl:grid-cols-[1fr_22rem]">
      <div class="min-w-0 space-y-4">
        <!-- Datos generales -->
        <div class="rounded-2xl border border-border/60 p-4">
          <div class="grid gap-3 md:grid-cols-2">
            <div>
              <label class="text-[11px] font-medium text-foreground" for="fe-nombre">Nombre del formulario</label>
              <input id="fe-nombre" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="150" placeholder="p. ej. Datos para traslado"
                     [value]="b().nombre" (input)="cambiar({ nombre: $any($event.target).value })" />
            </div>
            <div>
              <label class="text-[11px] font-medium text-foreground" for="fe-desc">Para qué se usa <span class="text-muted-foreground">(opcional)</span></label>
              <input id="fe-desc" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="300"
                     [value]="b().descripcion" (input)="cambiar({ descripcion: $any($event.target).value })" />
            </div>
          </div>
          @if (formulario()) {
            <label class="mt-3 flex items-center gap-1.5 text-xs text-foreground">
              <input type="checkbox" [checked]="b().activo" (change)="cambiar({ activo: $any($event.target).checked })" />
              Activo <span class="text-muted-foreground">· inactivo, no se puede elegir en tipos nuevos (los que ya lo usan lo siguen pidiendo)</span>
            </label>
          }
        </div>

        <!-- Documento -->
        <div class="rounded-2xl border border-border/60 p-4">
          <h4 class="mb-1 text-sm font-semibold text-foreground">Documento de identidad</h4>
          <p class="mb-3 text-[11px] text-muted-foreground">Nombre completo, correo, celular y la autorización de datos se piden siempre.</p>
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label class="flex items-center gap-1.5 text-xs text-foreground">
              <input type="checkbox" [checked]="b().docRequerido" (change)="cambiar({ docRequerido: $any($event.target).checked })" /> Obligatorio
            </label>
            <span class="text-[11px] text-muted-foreground">Acepta:</span>
            @for (d of tiposDocumento; track d.valor) {
              <label class="flex items-center gap-1.5 text-xs text-foreground">
                <input type="checkbox" [checked]="b().docTipos.includes(d.valor)" (change)="alternarDoc(d.valor)" /> {{ d.rotulo }}
              </label>
            }
          </div>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label class="text-[11px] font-medium text-foreground" for="fe-etq-tipo">Texto del tipo de documento</label>
              <input id="fe-etq-tipo" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="80" placeholder="Tipo de identificación"
                     [value]="b().etiquetaTipo" (input)="cambiar({ etiquetaTipo: $any($event.target).value })" />
            </div>
            <div>
              <label class="text-[11px] font-medium text-foreground" for="fe-etq-num">Texto del número</label>
              <input id="fe-etq-num" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="80" placeholder="Número de identificación"
                     [value]="b().etiquetaNumero" (input)="cambiar({ etiquetaNumero: $any($event.target).value })" />
            </div>
          </div>
        </div>

        <!-- Preguntas -->
        <div class="rounded-2xl border border-border/60 p-4">
          <header class="mb-3 flex items-center gap-2">
            <h4 class="mr-auto text-sm font-semibold text-foreground">Preguntas <span class="font-normal text-muted-foreground">({{ b().preguntas.length }} de {{ maxPreguntas }})</span></h4>
            <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" [disabled]="b().preguntas.length >= maxPreguntas" (click)="agregar()">
              <lucide-icon name="plus" [size]="14" /> Pregunta
            </button>
          </header>
          <ol class="space-y-3">
            @for (p of b().preguntas; track p.clave; let i = $index, primero = $first, ultimo = $last) {
              <li class="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div class="flex items-start gap-2">
                  <span class="mt-1.5 w-5 shrink-0 text-xs font-semibold text-muted-foreground">{{ i + 1 }}.</span>
                  <div class="min-w-0 flex-1 space-y-2">
                    <div class="grid gap-2 md:grid-cols-[1fr_12rem]">
                      <input class="alma-input h-8 w-full text-xs" maxlength="200" placeholder="Texto de la pregunta" [attr.aria-label]="'Pregunta ' + (i + 1)"
                             [value]="p.etiqueta" (input)="cambiarEtiqueta(i, $any($event.target).value)" />
                      <select class="alma-input h-8 w-full text-xs" aria-label="Tipo de respuesta" (change)="cambiarPregunta(i, { tipo: $any($event.target).value })">
                        @for (t of tiposPregunta; track t.valor) { <option [value]="t.valor" [selected]="p.tipo === t.valor">{{ t.rotulo }}</option> }
                      </select>
                    </div>
                    @if (p.tipo === 'opciones') {
                      <textarea class="alma-input min-h-20 w-full text-xs" placeholder="Una opción por línea (entre 2 y 20)" aria-label="Opciones"
                                [value]="p.opciones" (input)="cambiarPregunta(i, { opciones: $any($event.target).value })"></textarea>
                    }
                    @if (p.tipo === 'numero') {
                      <div class="flex flex-wrap items-center gap-2 text-xs">
                        <span class="text-muted-foreground">Entre</span>
                        <input type="number" class="alma-input h-8 w-24 text-xs" placeholder="mín." aria-label="Mínimo" [value]="p.min" (input)="cambiarPregunta(i, { min: $any($event.target).value })" />
                        <span class="text-muted-foreground">y</span>
                        <input type="number" class="alma-input h-8 w-24 text-xs" placeholder="máx." aria-label="Máximo" [value]="p.max" (input)="cambiarPregunta(i, { max: $any($event.target).value })" />
                      </div>
                    }
                    @if (p.tipo === 'texto' || p.tipo === 'texto_largo') {
                      <div class="flex flex-wrap items-center gap-2 text-xs">
                        <span class="text-muted-foreground">Máximo</span>
                        <input type="number" class="alma-input h-8 w-24 text-xs" min="1" [max]="p.tipo === 'texto' ? 150 : 1000" [placeholder]="p.tipo === 'texto' ? '150' : '1000'"
                               aria-label="Largo máximo" [value]="p.max" (input)="cambiarPregunta(i, { max: $any($event.target).value })" />
                        <span class="text-muted-foreground">caracteres</span>
                      </div>
                    }
                    <input class="alma-input h-8 w-full text-xs" maxlength="200" placeholder="Ayuda debajo del campo (opcional)" aria-label="Ayuda"
                           [value]="p.ayuda" (input)="cambiarPregunta(i, { ayuda: $any($event.target).value })" />
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <label class="flex items-center gap-1.5 text-foreground">
                        <input type="checkbox" [checked]="p.requerido" (change)="cambiarPregunta(i, { requerido: $any($event.target).checked })" /> Obligatoria
                      </label>
                      <span class="flex items-center gap-1 text-muted-foreground">
                        Identificador:
                        @if (p.idFijo) {
                          <code class="rounded bg-muted px-1 font-mono text-[11px] text-foreground" title="Ya guardada: el identificador no cambia para no perder las respuestas de citas anteriores.">{{ p.id }}</code>
                        } @else {
                          <input class="alma-input h-7 w-40 font-mono text-[11px]" maxlength="40" aria-label="Identificador" [value]="p.id"
                                 (input)="cambiarId(i, $any($event.target).value)" />
                        }
                      </span>
                    </div>
                  </div>
                  <div class="flex shrink-0 flex-col gap-1">
                    <button type="button" class="alma-btn alma-btn-ghost h-7 w-7 p-0" aria-label="Subir" [disabled]="primero" (click)="mover(i, -1)"><lucide-icon name="arrow-up" [size]="14" /></button>
                    <button type="button" class="alma-btn alma-btn-ghost h-7 w-7 p-0" aria-label="Bajar" [disabled]="ultimo" (click)="mover(i, 1)"><lucide-icon name="arrow-down" [size]="14" /></button>
                    <button type="button" class="alma-btn alma-btn-ghost h-7 w-7 p-0 text-destructive" aria-label="Quitar pregunta" (click)="quitar(i)"><lucide-icon name="trash-2" [size]="14" /></button>
                  </div>
                </div>
              </li>
            } @empty {
              <li class="rounded-xl border border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground">Sin preguntas adicionales: solo se piden los datos fijos.</li>
            }
          </ol>
        </div>

        @if (formulario(); as f) {
          @if (f.Tipos) {
            <p class="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <lucide-icon name="alert-triangle" [size]="14" class="shrink-0" />
              Lo usan {{ f.Tipos }} {{ f.Tipos === 1 ? 'tipo' : 'tipos' }} de cita: al guardar, el sitio lo pide así de inmediato. Las citas ya agendadas conservan sus respuestas.
            </p>
          }
        }
        <div class="flex flex-wrap gap-2">
          <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="guardar()">
            <lucide-icon name="save" [size]="14" /> {{ formulario() ? 'Guardar cambios' : 'Crear formulario' }}
          </button>
          <button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" (click)="cancelado.emit()">Cancelar</button>
        </div>
      </div>

      <!-- Vista previa -->
      <aside class="2xl:sticky 2xl:top-4 2xl:self-start">
        <p class="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-foreground/65"><lucide-icon name="eye" [size]="13" /> Así lo verá la persona</p>
        <div class="rounded-2xl border border-border/60 bg-white p-4 text-[13px] text-[#404040] shadow-sm" style="font-family: 'Open Sans', system-ui, sans-serif">
          <p class="mb-3 text-[15px] font-bold" style="font-family: Montserrat, system-ui, sans-serif">Sus datos</p>
          @for (c of ['Nombre completo', 'Correo electrónico']; track c) {
            <p class="mb-1 font-semibold">{{ c }}</p><div class="mb-3 h-8 rounded border border-[#dddddd]"></div>
          }
          <p class="mb-1 font-semibold">{{ b().etiquetaTipo || 'Tipo de identificación' }} @if (!b().docRequerido) { <span class="text-[11px] font-normal text-[#666]">(opcional)</span> }</p>
          @for (d of b().docTipos; track d) { <p class="mb-1 flex items-center gap-1.5"><span class="h-3 w-3 rounded-full border border-[#878787]"></span>{{ rotuloDoc(d) }}</p> }
          <p class="mb-1 mt-3 font-semibold">{{ b().etiquetaNumero || 'Número de identificación' }} @if (!b().docRequerido) { <span class="text-[11px] font-normal text-[#666]">(opcional)</span> }</p>
          <div class="mb-3 h-8 rounded border border-[#dddddd]"></div>
          <p class="mb-1 font-semibold">Celular</p><div class="mb-3 h-8 rounded border border-[#dddddd]"></div>
          @for (p of b().preguntas; track p.clave) {
            <p class="mb-1 font-semibold">{{ p.etiqueta || 'Pregunta sin texto' }} @if (!p.requerido) { <span class="text-[11px] font-normal text-[#666]">(opcional)</span> }</p>
            @switch (p.tipo) {
              @case ('opciones') {
                @for (o of lineas(p.opciones); track $index) { <p class="mb-1 flex items-center gap-1.5"><span class="h-3 w-3 shrink-0 rounded-full border border-[#878787]"></span>{{ o }}</p> }
              }
              @case ('si_no') {
                <p class="mb-1 flex items-center gap-1.5"><span class="h-3 w-3 rounded-full border border-[#878787]"></span>Sí</p>
                <p class="mb-1 flex items-center gap-1.5"><span class="h-3 w-3 rounded-full border border-[#878787]"></span>No</p>
              }
              @case ('texto_largo') { <div class="h-16 rounded border border-[#dddddd]"></div> }
              @case ('fecha') { <div class="flex h-8 items-center rounded border border-[#dddddd] px-2 text-[#a5a5a5]">dd/mm/aaaa</div> }
              @default { <div class="h-8 rounded border border-[#dddddd]"></div> }
            }
            @if (p.ayuda) { <p class="mt-1 text-[11px] text-[#666]">{{ p.ayuda }}</p> }
            <div class="mb-3"></div>
          }
          <p class="flex items-start gap-1.5"><span class="mt-0.5 h-3 w-3 shrink-0 rounded-sm border border-[#878787]"></span>Autorizo a Skandia a tratar mis datos personales…</p>
          <div class="mt-3 inline-flex h-9 items-center rounded-full bg-[#00c73d] px-5 text-[12px] font-bold text-white" style="font-family: Montserrat, system-ui, sans-serif">Confirmar cita</div>
        </div>
      </aside>
    </div>
  `,
})
export class FormularioEditorComponent {
  private readonly api = inject(AgendaApi);
  private readonly toast = inject(ToastService);

  /** El formulario a editar; null = uno nuevo. */
  readonly formulario = input<FormularioDatos | null>(null);
  /** Para «Duplicar»: definición de partida de un formulario nuevo. */
  readonly copiaDe = input<FormularioDatos | null>(null);
  readonly guardado = output<number>();
  readonly cancelado = output<void>();

  protected readonly tiposPregunta = TIPOS_PREGUNTA;
  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly maxPreguntas = MAX_PREGUNTAS;
  protected readonly guardando = signal(false);
  private readonly editado = signal<Borrador | null>(null);

  /** El borrador: lo que la persona va cambiando, o lo que viene del formulario. */
  protected readonly b = computed<Borrador>(() => this.editado() ?? this.inicial());

  private inicial(): Borrador {
    const f = this.formulario(), copia = this.copiaDe();
    const def: FormularioServicio = leerFormulario((f ?? copia)?.DefinicionJson) ?? {};
    const doc = def.documento ?? {};
    return {
      nombre: f?.Nombre ?? (copia ? `Copia de ${copia.Nombre}`.slice(0, 150) : ''),
      descripcion: (f ?? copia)?.Descripcion ?? '',
      activo: f?.Activo ?? true,
      docRequerido: doc.requerido ?? true,
      docTipos: doc.tipos?.length ? [...doc.tipos] : ['CC', 'CE'],
      etiquetaTipo: doc.etiquetaTipo ?? '',
      etiquetaNumero: doc.etiquetaNumero ?? '',
      // En una copia las preguntas son nuevas: sus ids aún se pueden cambiar.
      preguntas: (def.preguntas ?? []).map((p) => aEdicion(p, !!f)),
    };
  }

  private editar(fn: (b: Borrador) => Borrador): void {
    this.editado.set(fn(this.b()));
  }

  protected cambiar(c: Partial<Borrador>): void {
    this.editar((b) => ({ ...b, ...c }));
  }

  protected alternarDoc(v: string): void {
    this.editar((b) => ({
      ...b, docTipos: b.docTipos.includes(v) ? b.docTipos.filter((x) => x !== v)
        : TIPOS_DOCUMENTO.map((d) => d.valor).filter((x) => x === v || b.docTipos.includes(x)),
    }));
  }

  protected cambiarPregunta(i: number, c: Partial<PreguntaEdit>): void {
    this.editar((b) => ({ ...b, preguntas: b.preguntas.map((p, j) => (j === i ? { ...p, ...c } : p)) }));
  }

  /** Mientras la pregunta es nueva y nadie tocó el id, el id sigue al texto. */
  protected cambiarEtiqueta(i: number, etiqueta: string): void {
    const p = this.b().preguntas[i];
    const id = p.idFijo || p.idManual ? p.id : this.idLibre(identificador(etiqueta, '_') || 'pregunta', i);
    this.cambiarPregunta(i, { etiqueta, id });
  }

  protected cambiarId(i: number, id: string): void {
    this.cambiarPregunta(i, { id: id.toLowerCase().replace(/[^a-z0-9_]/g, ''), idManual: true });
  }

  private idLibre(base: string, i: number): string {
    const usados = new Set(this.b().preguntas.filter((_, j) => j !== i).map((p) => p.id));
    let id = base.slice(0, 40), n = 2;
    while (usados.has(id)) id = `${base.slice(0, 37)}_${n++}`;
    return id;
  }

  protected agregar(): void {
    const id = this.idLibre('pregunta', -1);
    this.editar((b) => ({ ...b, preguntas: [...b.preguntas, { ...aEdicion({ id, etiqueta: '', tipo: 'texto' }, false) }] }));
  }

  protected quitar(i: number): void {
    const p = this.b().preguntas[i];
    if (p.idFijo && !confirm(`¿Quitar «${p.etiqueta}»? Las citas que ya la respondieron conservan su respuesta.`)) return;
    this.editar((b) => ({ ...b, preguntas: b.preguntas.filter((_, j) => j !== i) }));
  }

  protected mover(i: number, d: -1 | 1): void {
    this.editar((b) => {
      const ps = [...b.preguntas];
      [ps[i], ps[i + d]] = [ps[i + d], ps[i]];
      return { ...b, preguntas: ps };
    });
  }

  protected lineas(texto: string): string[] {
    return texto.split('\n').map((x) => x.trim()).filter(Boolean);
  }

  protected rotuloDoc(v: string): string {
    return TIPOS_DOCUMENTO.find((d) => d.valor === v)?.rotulo ?? v;
  }

  protected async guardar(): Promise<void> {
    const b = this.b();
    const error = revisar(b);
    if (error) {
      this.toast.error('Revise el formulario', error);
      return;
    }
    const definicion: FormularioServicio = {
      documento: { requerido: b.docRequerido, tipos: b.docTipos, etiquetaTipo: b.etiquetaTipo.trim() || undefined,
                   etiquetaNumero: b.etiquetaNumero.trim() || undefined },
      preguntas: b.preguntas.map(aDefinicion),
    };
    const datos = { nombre: b.nombre.trim(), descripcion: b.descripcion.trim() || null, definicion };
    this.guardando.set(true);
    try {
      const f = this.formulario();
      if (f) {
        await this.api.actualizarFormulario(f.Id, { ...datos, activo: b.activo });
        this.toast.show('Formulario guardado');
        this.guardado.emit(f.Id);
      } else {
        const { id } = await this.api.crearFormulario(datos);
        this.toast.show('Formulario creado');
        this.guardado.emit(id);
      }
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }
}

function aEdicion(p: PreguntaFormulario, guardada: boolean): PreguntaEdit {
  return {
    clave: ++secuencia, id: p.id, idFijo: guardada, idManual: !guardada && !!p.etiqueta, etiqueta: p.etiqueta,
    tipo: (TIPOS_PREGUNTA.some((t) => t.valor === p.tipo) ? p.tipo : 'texto') as TipoPregunta,
    requerido: !!p.requerido, opciones: (p.opciones ?? []).join('\n'),
    min: p.min?.toString() ?? '', max: p.max?.toString() ?? '', ayuda: p.ayuda ?? '',
  };
}

function aDefinicion(p: PreguntaEdit): PreguntaFormulario {
  const q: PreguntaFormulario = { id: p.id, etiqueta: p.etiqueta.trim(), tipo: p.tipo, requerido: p.requerido };
  if (p.ayuda.trim()) q.ayuda = p.ayuda.trim();
  if (p.tipo === 'opciones') q.opciones = p.opciones.split('\n').map((x) => x.trim()).filter(Boolean);
  if (p.tipo === 'numero') {
    if (p.min.trim()) q.min = +p.min;
    if (p.max.trim()) q.max = +p.max;
  }
  if ((p.tipo === 'texto' || p.tipo === 'texto_largo') && p.max.trim()) q.max = +p.max;
  return q;
}

/** Lo mismo que revisa el backend, para avisar antes de enviar. */
function revisar(b: Borrador): string | null {
  if (b.nombre.trim().length < 3) return 'Escriba un nombre de al menos 3 letras.';
  if (!b.docTipos.length) return 'Elija al menos un tipo de documento.';
  const ids = new Set<string>();
  for (const [i, p] of b.preguntas.entries()) {
    const n = `Pregunta ${i + 1}`;
    if (!p.etiqueta.trim()) return `${n}: escriba el texto de la pregunta.`;
    if (!/^[a-z0-9_]{1,40}$/.test(p.id)) return `${n}: el identificador solo admite minúsculas, números y _.`;
    if (ids.has(p.id)) return `${n}: el identificador «${p.id}» está repetido.`;
    ids.add(p.id);
    if (p.tipo === 'opciones') {
      const ops = new Set(p.opciones.split('\n').map((x) => x.trim()).filter(Boolean));
      if (ops.size < 2 || ops.size > 20) return `${n}: escriba entre 2 y 20 opciones distintas, una por línea.`;
    }
    if (p.tipo === 'numero' && p.min.trim() && p.max.trim() && +p.min > +p.max) return `${n}: el mínimo es mayor que el máximo.`;
  }
  return null;
}
