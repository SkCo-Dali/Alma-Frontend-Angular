// «Configuración» de la Agenda (administrador), dividida en módulos con un menú propio:
//   · Tipos de cita       duración, márgenes, ventana horaria y formulario que abre cada tipo
//   · Formularios         datos que pide el sitio en cada servicio (solo lectura)
//   · Asesores y turnos   quién atiende, qué tipos y en qué horario; estado de su Outlook
//   · Ausencias           rangos en los que un asesor no recibe citas
//   · Política de datos   texto que acepta la persona al agendar
// Todo sale de un solo GET /configuracion; cada módulo guarda por su cuenta.

import { Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import {
  AgendaApi, Asesor, Configuracion, DIAS_SEMANA, FormularioDatos, FormularioServicio, Servicio, TipoCita, TipoNuevo,
  PALETA_TIPOS, TurnoEntrada, fechaHoraColombia, identificador, leerFormulario,
} from './agenda.api';
import { FormularioEditorComponent } from './formulario-editor.component';
import { SelectorColorComponent } from './selector-color.component';

type Modulo = 'tipos' | 'formularios' | 'asesores' | 'ausencias' | 'politica';

interface ModuloMenu {
  id: Modulo;
  rotulo: string;
  icono: string;
  resumen: string;
  alerta: string | null;   // algo que pide atención (se ve en el menú)
}

interface NuevoServicioForm {
  Titulo: string;
  Slug: string;
  slugManual: boolean;
  Encabezado: string;
  Descripcion: string;
}

type NuevoTipoForm = TipoNuevo & { slugManual: boolean; Resumen: string; Color: string; DuracionMin: number };

interface EditorFormulario {
  clave: number;                       // recrea el editor al abrir otro
  formulario: FormularioDatos | null;  // null = nuevo
  copiaDe: FormularioDatos | null;
}

interface TurnoForm {
  dia: number;
  inicio: string;  // HH:MM
  fin: string;
}

interface AsesorForm {
  id: number | null;
  correo: string;
  nombre: string;
  activo: boolean;
  tipos: number[];
  turnos: TurnoForm[];
}

const CAMPOS_TIPO: { campo: keyof TipoCita; rotulo: string; ayuda: string; min: number; max: number }[] = [
  { campo: 'DuracionMin', rotulo: 'Duración (min)', ayuda: 'Largo de cada cita y paso del calendario.', min: 10, max: 240 },
  { campo: 'BufferMin', rotulo: 'Margen entre citas (min)', ayuda: 'Tiempo libre antes y después de cada cita.', min: 0, max: 120 },
  { campo: 'AnticipacionMinHoras', rotulo: 'Anticipación mínima (h)', ayuda: 'Cuántas horas antes se puede agendar.', min: 0, max: 720 },
  { campo: 'HorizonteDias', rotulo: 'Agendar hasta (días)', ayuda: 'Hasta cuántos días adelante.', min: 1, max: 180 },
];

@Component({
  selector: 'alma-configuracion-agenda',
  imports: [LucideAngularModule, AlmaLoaderComponent, FormularioEditorComponent, SelectorColorComponent],
  template: `
    @if (!cfg()) {
      <div class="flex justify-center py-10"><alma-loader [size]="56" label="Cargando…" /></div>
    } @else {
      <div class="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <!-- Menú de módulos: columna en escritorio, carrusel horizontal en móvil -->
        <nav class="glass flex gap-1 overflow-x-auto rounded-3xl p-2 shadow-[var(--shadow-sm)] lg:sticky lg:top-4 lg:flex-col lg:self-start lg:overflow-visible"
             aria-label="Módulos de configuración">
          @for (m of menu(); track m.id) {
            <button type="button" class="flex min-w-[11rem] shrink-0 items-start gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors lg:min-w-0"
                    [class]="claseModulo(m.id)" [attr.aria-current]="modulo() === m.id ? 'page' : null" (click)="irA(m.id)">
              <lucide-icon [name]="m.icono" [size]="18" class="mt-0.5 shrink-0" [class.text-primary]="modulo() === m.id" />
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold">{{ m.rotulo }}</span>
                <span class="block truncate text-[11px] text-muted-foreground">{{ m.resumen }}</span>
                @if (m.alerta) {
                  <span class="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    <lucide-icon name="alert-triangle" [size]="12" class="shrink-0" /> <span class="truncate">{{ m.alerta }}</span>
                  </span>
                }
              </span>
            </button>
          }
        </nav>

        <div class="min-w-0">
        @switch (modulo()) {

        <!-- ═══════════ Tipos de cita ═══════════ -->
        @case ('tipos') {
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <header class="mb-4 flex flex-wrap items-start gap-2">
            <div class="mr-auto max-w-2xl">
              <h2 class="text-base font-bold text-foreground">Tipos de cita</h2>
              <p class="text-xs text-muted-foreground">Lo que ve la persona en el sitio. Cada servicio es una página del widget con sus tipos. Un tipo inactivo deja de ofrecerse; sus citas siguen vigentes.</p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" (click)="abrirNuevoServicio()"><lucide-icon name="plus" [size]="14" /> Nuevo servicio</button>
              <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="!cfg()!.servicios.length" (click)="abrirNuevoTipo()"><lucide-icon name="plus" [size]="14" /> Nuevo tipo</button>
            </div>
          </header>

          <!-- Nuevo servicio -->
          @if (nuevoServicio(); as ns) {
            <div class="mb-4 rounded-2xl border border-primary/40 bg-primary/[0.03] p-4">
              <h3 class="mb-1 text-sm font-semibold text-foreground">Nuevo servicio</h3>
              <p class="mb-3 text-[11px] text-muted-foreground">Una página nueva del widget, con su propio enlace. Aparece en el sitio cuando tenga al menos un tipo de cita activo.</p>
              <div class="grid gap-3 md:grid-cols-2">
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="ns-titulo">Título</label>
                  <input id="ns-titulo" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="150" placeholder="p. ej. Asesoría para empresas"
                         [value]="ns.Titulo" (input)="editarNuevoServicio({ Titulo: $any($event.target).value })" />
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="ns-slug">Identificador del enlace</label>
                  <input id="ns-slug" class="alma-input mt-0.5 h-8 w-full font-mono text-xs" maxlength="40"
                         [value]="ns.Slug" (input)="editarNuevoServicio({ Slug: $any($event.target).value, slugManual: true })" />
                  <p class="mt-0.5 text-[11px] text-muted-foreground">Va en el código del sitio (<code class="font-mono">servicio: '{{ ns.Slug || '…' }}'</code>); no se puede cambiar después.</p>
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="ns-encab">Encabezado del widget</label>
                  <input id="ns-encab" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="150" placeholder="p. ej. Agende su asesoría"
                         [value]="ns.Encabezado" (input)="editarNuevoServicio({ Encabezado: $any($event.target).value })" />
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="ns-desc">Descripción <span class="text-muted-foreground">(panel izquierdo del widget)</span></label>
                  <textarea id="ns-desc" class="alma-input mt-0.5 min-h-8 w-full text-xs" maxlength="1000"
                            [value]="ns.Descripcion" (input)="editarNuevoServicio({ Descripcion: $any($event.target).value })"></textarea>
                </div>
              </div>
              <div class="mt-3 flex gap-2">
                <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="crearServicio()"><lucide-icon name="save" [size]="14" /> Crear servicio</button>
                <button type="button" class="alma-btn alma-btn-ghost w-auto px-3 h-8 text-xs" (click)="nuevoServicio.set(null)">Cancelar</button>
              </div>
            </div>
          }

          <!-- Nuevo tipo -->
          @if (nuevoTipo(); as nt) {
            <div class="mb-4 rounded-2xl border border-primary/40 bg-primary/[0.03] p-4">
              <h3 class="mb-3 text-sm font-semibold text-foreground">Nuevo tipo de cita</h3>
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="nt-srv">Servicio</label>
                  <select id="nt-srv" class="alma-input mt-0.5 h-8 w-full text-xs" (change)="editarNuevoTipo({ ServicioId: +$any($event.target).value })">
                    @for (srv of cfg()!.servicios; track srv.Id) { <option [value]="srv.Id" [selected]="nt.ServicioId === srv.Id">{{ srv.Titulo }}</option> }
                  </select>
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="nt-titulo">Título</label>
                  <input id="nt-titulo" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="150" placeholder="p. ej. Asesoría por videollamada"
                         [value]="nt.Titulo" (input)="editarNuevoTipo({ Titulo: $any($event.target).value })" />
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="nt-slug">Identificador</label>
                  <input id="nt-slug" class="alma-input mt-0.5 h-8 w-full font-mono text-xs" maxlength="40"
                         [value]="nt.Slug" (input)="editarNuevoTipo({ Slug: $any($event.target).value, slugManual: true })" />
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="nt-canal">Canal</label>
                  <input id="nt-canal" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="80" list="nt-canales" placeholder="p. ej. Llamada telefónica"
                         [value]="nt.Canal" (input)="editarNuevoTipo({ Canal: $any($event.target).value })" />
                  <datalist id="nt-canales">
                    @for (c of canales(); track c) { <option [value]="c"></option> }
                  </datalist>
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="nt-dur">Duración (min)</label>
                  <input id="nt-dur" type="number" min="10" max="240" class="alma-input mt-0.5 h-8 w-full text-xs"
                         [value]="nt.DuracionMin" (input)="editarNuevoTipo({ DuracionMin: +$any($event.target).value })" />
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="nt-form">Formulario de datos</label>
                  <select id="nt-form" class="alma-input mt-0.5 h-8 w-full text-xs" (change)="editarNuevoTipo({ FormularioDatosId: +$any($event.target).value || null })">
                    <option value="" [selected]="!nt.FormularioDatosId">El del servicio</option>
                    @for (f of formulariosActivos(); track f.Id) { <option [value]="f.Id" [selected]="nt.FormularioDatosId === f.Id">{{ f.Nombre }}</option> }
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="text-[11px] font-medium text-foreground" for="nt-res">Resumen <span class="text-muted-foreground">(debajo del título en el sitio)</span></label>
                  <input id="nt-res" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="300" placeholder="p. ej. Un asesor lo llama a la hora agendada."
                         [value]="nt.Resumen" (input)="editarNuevoTipo({ Resumen: $any($event.target).value })" />
                </div>
                <div>
                  <span class="text-[11px] font-medium text-foreground">Color <span class="text-muted-foreground">(sugeridos: paleta Skandia)</span></span>
                  <div class="mt-1"><alma-selector-color [color]="nt.Color" etiqueta="Color del tipo nuevo" (cambio)="editarNuevoTipo({ Color: $event })" /></div>
                </div>
              </div>
              <label class="mt-3 flex items-center gap-1.5 text-xs text-foreground">
                <input type="checkbox" [checked]="nt.asignarATodos" (change)="editarNuevoTipo({ asignarATodos: $any($event.target).checked })" />
                Lo atienden todos los asesores activos <span class="text-muted-foreground">(si no, asígnelo en Asesores y turnos)</span>
              </label>
              <p class="mt-1 text-[11px] text-muted-foreground">Margen, anticipación, horizonte y ventana horaria toman los valores de siempre (0 min, 12 h, 45 días, sin ventana); se ajustan después en la tarjeta del tipo.</p>
              <div class="mt-3 flex gap-2">
                <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="crearTipo()"><lucide-icon name="save" [size]="14" /> Crear tipo</button>
                <button type="button" class="alma-btn alma-btn-ghost w-auto px-3 h-8 text-xs" (click)="nuevoTipo.set(null)">Cancelar</button>
              </div>
            </div>
          }

          <div class="mb-4 inline-flex flex-wrap gap-1 rounded-2xl bg-muted/50 p-1" role="tablist" aria-label="Servicio">
            @for (srv of cfg()!.servicios; track srv.Id) {
              <button type="button" role="tab" class="h-8 rounded-xl px-3 text-xs font-medium transition-colors" [class]="claseServicio(srv.Id)"
                      [attr.aria-selected]="servicioActual()?.Id === srv.Id" (click)="servicioSel.set(srv.Id); servicioEdit.set(null)">
                {{ srv.Titulo }} <span class="ml-1 opacity-70">{{ cuentaTipos(srv.Id) }}</span>
              </button>
            }
          </div>
          @if (servicioActual(); as srv) {
          <!-- El servicio: enlace y datos de su página -->
          <div class="mb-4 rounded-2xl border border-border/60 p-3">
            @if (servicioEdit(); as se) {
              <div class="grid gap-3 md:grid-cols-2">
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="se-titulo">Título</label>
                  <input id="se-titulo" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="150" [value]="se.Titulo" (input)="servicioEdit.set({ ...se, Titulo: $any($event.target).value })" />
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="se-encab">Encabezado del widget</label>
                  <input id="se-encab" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="150" [value]="se.Encabezado" (input)="servicioEdit.set({ ...se, Encabezado: $any($event.target).value })" />
                </div>
                <div class="md:col-span-2">
                  <label class="text-[11px] font-medium text-foreground" for="se-desc">Descripción</label>
                  <textarea id="se-desc" class="alma-input mt-0.5 min-h-16 w-full text-xs" maxlength="1000" [value]="se.Descripcion" (input)="servicioEdit.set({ ...se, Descripcion: $any($event.target).value })"></textarea>
                </div>
              </div>
              <label class="mt-2 flex items-center gap-1.5 text-xs text-foreground">
                <input type="checkbox" [checked]="se.Activo" (change)="servicioEdit.set({ ...se, Activo: $any($event.target).checked })" /> Activo <span class="text-muted-foreground">· inactivo, el enlace deja de mostrar la página</span>
              </label>
              <div class="mt-3 flex gap-2">
                <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="guardarServicio(srv.Id)"><lucide-icon name="save" [size]="14" /> Guardar</button>
                <button type="button" class="alma-btn alma-btn-ghost w-auto px-3 h-8 text-xs" (click)="servicioEdit.set(null)">Cancelar</button>
              </div>
            } @else {
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span class="font-semibold text-foreground">{{ srv.Encabezado }}</span>
                <span class="text-muted-foreground">Enlace: <code class="font-mono text-foreground">servicio: '{{ srv.Slug }}'</code></span>
                @if (!srv.Activo) { <span class="alma-badge bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300">Inactivo</span> }
                @if (!tiposDe(srv.Id).length) { <span class="text-amber-700 dark:text-amber-400">Sin tipos: aún no aparece en el sitio</span> }
                <button type="button" class="alma-btn alma-btn-ghost w-auto px-3 ml-auto h-7 text-xs" (click)="editarServicio(srv)"><lucide-icon name="pencil" [size]="13" /> Editar servicio</button>
              </div>
            }
          </div>
          @if (!tiposDe(srv.Id).length) {
            <p class="rounded-2xl border border-dashed border-border/70 py-6 text-center text-sm text-muted-foreground">Este servicio aún no tiene tipos de cita. Use «Nuevo tipo».</p>
          }
          <div class="grid gap-3 xl:grid-cols-2">
            @for (t of tiposDe(srv.Id); track t.Id) {
              <article class="rounded-2xl border p-4 transition-colors" [class]="cambiosTipo()[t.Id] ? 'border-primary/60 bg-primary/[0.03]' : 'border-border/60'">
                <header class="mb-3 flex items-center gap-2">
                  <span class="h-3 w-3 shrink-0 rounded-full" [style.background]="valorTipo(t, 'Color')" aria-hidden="true"></span>
                  <h3 class="mr-auto text-sm font-semibold text-foreground" [class.text-muted-foreground]="!valorTipo(t, 'Activo')">{{ t.Titulo }}</h3>
                  <label class="flex items-center gap-1.5 text-xs text-foreground">
                    <input type="checkbox" [checked]="valorTipo(t, 'Activo')" (change)="cambiarTipo(t, 'Activo', $any($event.target).checked)" /> Activo
                  </label>
                </header>
                <div class="grid grid-cols-2 gap-3">
                  @for (c of camposTipo; track c.campo) {
                    <div>
                      <label class="text-[11px] font-medium text-foreground" [for]="'t' + t.Id + c.campo">{{ c.rotulo }}</label>
                      <input [id]="'t' + t.Id + c.campo" type="number" class="alma-input mt-0.5 h-8 w-full text-xs" [min]="c.min" [max]="c.max"
                             [value]="valorTipo(t, c.campo)" (input)="cambiarTipo(t, c.campo, +$any($event.target).value)" [title]="c.ayuda" />
                    </div>
                  }
                </div>
                <div class="mt-3 grid grid-cols-3 gap-3">
                  <div>
                    <label class="text-[11px] font-medium text-foreground" [for]="'t' + t.Id + 'vi'">Desde las</label>
                    <input [id]="'t' + t.Id + 'vi'" type="time" class="alma-input mt-0.5 h-8 w-full text-xs" title="Ventana horaria del tipo. Vacío = solo los turnos de los asesores."
                           [value]="valorTipo(t, 'VentanaInicio') ?? ''" (change)="cambiarTipo(t, 'VentanaInicio', $any($event.target).value || null)" />
                  </div>
                  <div>
                    <label class="text-[11px] font-medium text-foreground" [for]="'t' + t.Id + 'vf'">Hasta las</label>
                    <input [id]="'t' + t.Id + 'vf'" type="time" class="alma-input mt-0.5 h-8 w-full text-xs" title="Vacío = solo los turnos de los asesores."
                           [value]="valorTipo(t, 'VentanaFin') ?? ''" (change)="cambiarTipo(t, 'VentanaFin', $any($event.target).value || null)" />
                  </div>
                  <div>
                    <label class="text-[11px] font-medium text-foreground" [for]="'t' + t.Id + 'form'" title="Formulario de Nova que el asesor abre desde la cita">Abre en Nova</label>
                    <select [id]="'t' + t.Id + 'form'" class="alma-input mt-0.5 h-8 w-full text-xs" (change)="cambiarTipo(t, 'Formulario', $any($event.target).value || null)">
                      <option value="" [selected]="!valorTipo(t, 'Formulario')">Ninguno</option>
                      <option value="for-0075" [selected]="valorTipo(t, 'Formulario') === 'for-0075'">FOR-0075 (Solicitudes)</option>
                    </select>
                  </div>
                </div>
                <div class="mt-3">
                  <span class="text-[11px] font-medium text-foreground">Color</span>
                  <div class="mt-1"><alma-selector-color [color]="valorTipo(t, 'Color')" [etiqueta]="'Color de ' + t.Titulo" (cambio)="cambiarTipo(t, 'Color', $event)" /></div>
                </div>
                <label class="mt-3 block text-[11px] font-medium text-foreground" [for]="'t' + t.Id + 'fd'">Formulario de datos <span class="text-muted-foreground">(lo que pide el sitio)</span></label>
                <select [id]="'t' + t.Id + 'fd'" class="alma-input mt-0.5 h-8 w-full text-xs" (change)="cambiarTipo(t, 'FormularioDatosId', +$any($event.target).value || null)">
                  <option value="" [selected]="!valorTipo(t, 'FormularioDatosId')">El del servicio</option>
                  @for (f of cfg()!.formularios; track f.Id) {
                    @if (f.Activo || valorTipo(t, 'FormularioDatosId') === f.Id) {
                      <option [value]="f.Id" [selected]="valorTipo(t, 'FormularioDatosId') === f.Id">{{ f.Nombre }}{{ f.Activo ? '' : ' (inactivo)' }}</option>
                    }
                  }
                </select>
                <label class="mt-3 block text-[11px] font-medium text-foreground" [for]="'t' + t.Id + 'conf'">Texto de confirmación ({{ '{' }}celular{{ '}' }} se reemplaza)</label>
                <input [id]="'t' + t.Id + 'conf'" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="400"
                       [value]="valorTipo(t, 'TextoConfirmacion') ?? ''" (input)="cambiarTipo(t, 'TextoConfirmacion', $any($event.target).value)" />
                @if (cambiosTipo()[t.Id]) {
                  <div class="mt-3 flex items-center gap-2">
                    <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="guardarTipo(t)"><lucide-icon name="save" [size]="14" /> Guardar</button>
                    <button type="button" class="alma-btn alma-btn-ghost w-auto px-3 h-8 text-xs" (click)="descartarTipo(t)">Descartar</button>
                    <span class="text-[11px] text-muted-foreground">Cambios sin guardar</span>
                  </div>
                }
              </article>
            }
          </div>
          }
        </section>
        }

        <!-- ═══════════ Formularios ═══════════ -->
        @case ('formularios') {
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          @if (editorFormulario(); as ed) {
            <header class="mb-4 flex items-center gap-2">
              <button type="button" class="alma-btn alma-btn-ghost h-8 w-8 p-0" aria-label="Volver a los formularios" (click)="editorFormulario.set(null)"><lucide-icon name="arrow-left" [size]="16" /></button>
              <h2 class="text-base font-bold text-foreground">{{ ed.formulario ? 'Editar formulario' : 'Nuevo formulario' }}</h2>
            </header>
            @for (k of [ed.clave]; track k) {
              <alma-formulario-editor [formulario]="ed.formulario" [copiaDe]="ed.copiaDe"
                                      (guardado)="formularioGuardado()" (cancelado)="editorFormulario.set(null)" />
            }
          } @else {
            <header class="mb-4 flex flex-wrap items-start gap-2">
              <div class="mr-auto max-w-2xl">
                <h2 class="text-base font-bold text-foreground">Formularios</h2>
                <p class="text-xs text-muted-foreground">Datos que pide el sitio al agendar. Cada tipo de cita elige su formulario y varios tipos pueden compartir uno. Nombre, correo, celular y la autorización de datos se piden siempre.</p>
              </div>
              <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" (click)="abrirEditor(null)"><lucide-icon name="plus" [size]="14" /> Nuevo formulario</button>
            </header>
            @if (!cfg()!.formularios.length) {
              <p class="rounded-2xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">Aún no hay formularios. Los tipos sin formulario piden el del servicio.</p>
            }
            <div class="grid gap-3 xl:grid-cols-2">
              @for (f of cfg()!.formularios; track f.Id) {
                <article class="flex flex-col rounded-2xl border border-border/60 p-4" [class.opacity-60]="!f.Activo">
                  <header class="mb-2 flex items-start gap-2">
                    <div class="mr-auto min-w-0">
                      <h3 class="text-sm font-semibold text-foreground">{{ f.Nombre }}</h3>
                      @if (f.Descripcion) { <p class="text-[11px] text-muted-foreground">{{ f.Descripcion }}</p> }
                    </div>
                    @if (!f.Activo) { <span class="alma-badge bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300">Inactivo</span> }
                  </header>
                  @if (formularioDe(f.DefinicionJson); as d) {
                    <p class="mb-1 text-[11px] text-muted-foreground">
                      Documento {{ d.documento?.requerido === false ? 'opcional' : 'obligatorio' }} ({{ (d.documento?.tipos ?? []).join(', ') }}) · {{ d.preguntas?.length ?? 0 }} {{ (d.preguntas?.length ?? 0) === 1 ? 'pregunta' : 'preguntas' }}
                    </p>
                    @if (d.preguntas?.length) {
                      <ul class="mb-2 space-y-0.5 text-xs text-foreground">
                        @for (p of d.preguntas!; track p.id) {
                          <li class="truncate">· {{ p.etiqueta }} <span class="text-muted-foreground">({{ tipoPregunta(p.tipo) }}{{ p.requerido ? ', obligatoria' : '' }})</span></li>
                        }
                      </ul>
                    }
                  }
                  <p class="mt-auto pt-2 text-[11px] text-muted-foreground">
                    @if (tiposConFormulario(f.Id).length; as n) {
                      Lo usan: {{ tiposConFormulario(f.Id).join(' · ') }}
                    } @else {
                      Ningún tipo lo usa todavía.
                    }
                  </p>
                  <div class="mt-3 flex gap-2">
                    <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" (click)="abrirEditor(f)"><lucide-icon name="pencil" [size]="14" /> Editar</button>
                    <button type="button" class="alma-btn alma-btn-ghost w-auto px-3 h-8 text-xs" (click)="abrirEditor(null, f)"><lucide-icon name="copy" [size]="14" /> Duplicar</button>
                  </div>
                </article>
              }
            </div>
          }
        </section>
        }

        <!-- ═══════════ Asesores y turnos ═══════════ -->
        @case ('asesores') {
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <header class="mb-4 flex flex-wrap items-start gap-2">
            <div class="mr-auto max-w-2xl">
              <h2 class="text-base font-bold text-foreground">Asesores y turnos</h2>
              <p class="text-xs text-muted-foreground">Los cupos salen de estos turnos (hora de Colombia), sin festivos, menos lo que el asesor tenga ocupado en su Outlook (se actualiza cada 5 minutos). El correo debe ser el mismo con el que entra a Nova.</p>
            </div>
            @if (!form()) {
              <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" (click)="nuevoAsesor()"><lucide-icon name="user-plus" [size]="14" /> Agregar asesor</button>
            }
          </header>

          @if (form(); as f) {
            <div class="mb-4 rounded-2xl border border-primary/40 bg-primary/[0.03] p-4">
              <h3 class="mb-3 text-sm font-semibold text-foreground">{{ f.id ? 'Editar asesor' : 'Nuevo asesor' }}</h3>
              <div class="grid gap-3 md:grid-cols-3">
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="as-nombre">Nombre</label>
                  <input id="as-nombre" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="200" [value]="f.nombre" (input)="editarForm({ nombre: $any($event.target).value })" />
                </div>
                <div>
                  <label class="text-[11px] font-medium text-foreground" for="as-correo">Correo</label>
                  <input id="as-correo" type="email" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="200" [value]="f.correo" (input)="editarForm({ correo: $any($event.target).value })" />
                </div>
                <div class="flex items-end gap-4 pb-1.5">
                  <label class="flex items-center gap-1.5 text-xs text-foreground">
                    <input type="checkbox" [checked]="f.activo" (change)="editarForm({ activo: $any($event.target).checked })" /> Activo
                  </label>
                </div>
              </div>
              <fieldset class="mt-4">
                <legend class="text-[11px] font-medium text-foreground">Atiende</legend>
                @for (srv of cfg()!.servicios; track srv.Id) {
                  <p class="mt-2 text-[11px] text-muted-foreground">{{ srv.Titulo }}</p>
                  <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    @for (t of tiposDe(srv.Id); track t.Id) {
                      <label class="flex items-center gap-1.5 text-xs text-foreground">
                        <input type="checkbox" [checked]="f.tipos.includes(t.Id)" (change)="alternarTipo(t.Id)" /> {{ t.Titulo }}
                      </label>
                    }
                  </div>
                }
              </fieldset>
              <fieldset class="mt-4">
                <legend class="text-[11px] font-medium text-foreground">Turnos semanales</legend>
                <div class="mt-1 space-y-2">
                  @for (tu of f.turnos; track $index; let i = $index) {
                    <div class="flex flex-wrap items-center gap-2">
                      <select class="alma-input h-8 w-32 text-xs" aria-label="Día" (change)="editarTurno(i, { dia: +$any($event.target).value })">
                        @for (d of dias; track $index; let di = $index) { <option [value]="di" [selected]="tu.dia === di">{{ d }}</option> }
                      </select>
                      <input type="time" class="alma-input h-8 w-28 text-xs" aria-label="Desde" [value]="tu.inicio" (change)="editarTurno(i, { inicio: $any($event.target).value })" />
                      <span class="text-xs text-muted-foreground">a</span>
                      <input type="time" class="alma-input h-8 w-28 text-xs" aria-label="Hasta" [value]="tu.fin" (change)="editarTurno(i, { fin: $any($event.target).value })" />
                      <button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" aria-label="Quitar turno" (click)="quitarTurno(i)"><lucide-icon name="trash-2" [size]="14" /></button>
                    </div>
                  } @empty {
                    <p class="text-xs text-amber-700 dark:text-amber-400">Sin turnos: este asesor no recibirá citas.</p>
                  }
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" (click)="agregarTurno()"><lucide-icon name="plus" [size]="14" /> Turno</button>
                    <button type="button" class="alma-btn alma-btn-outline h-8 text-xs" (click)="horarioOficina()">Lunes a viernes 8–12 y 14–17</button>
                  </div>
                </div>
              </fieldset>
              <div class="mt-4 flex gap-2">
                <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="guardarAsesor()"><lucide-icon name="save" [size]="14" /> Guardar</button>
                <button type="button" class="alma-btn alma-btn-ghost w-auto px-3 h-8 text-xs" (click)="form.set(null)">Cancelar</button>
              </div>
            </div>
          }

          @if (!cfg()!.asesores.length) {
            <p class="py-6 text-center text-sm text-muted-foreground">Aún no hay asesores. Sin asesores con turno, el sitio no muestra cupos.</p>
          } @else {
            <div class="overflow-x-auto rounded-2xl border border-border/60">
              <table class="w-full text-sm">
                <thead class="bg-[var(--table-header)] text-left text-[11px] font-semibold text-foreground/65">
                  <tr><th class="px-4 py-2">Asesor</th><th class="px-4 py-2">Atiende</th><th class="px-4 py-2">Turnos</th><th class="px-4 py-2">Outlook</th><th class="px-4 py-2">Estado</th><th class="px-4 py-2"><span class="sr-only">Acciones</span></th></tr>
                </thead>
                <tbody>
                  @for (a of cfg()!.asesores; track a.Id) {
                    <tr class="border-t border-border/50 align-top" [class.opacity-60]="!a.Activo">
                      <td class="px-4 py-2 text-foreground">{{ a.Nombre }}<span class="block text-xs text-muted-foreground">{{ a.Correo }}</span></td>
                      <td class="px-4 py-2 text-xs text-foreground">{{ nombresTipos(a.tipos) }}</td>
                      <td class="px-4 py-2 text-xs text-foreground" [class]="estadoTurnos(a)">{{ resumenTurnos(a) }}</td>
                      <td class="px-4 py-2 text-xs">
                        @if (a.OutlookError) {
                          <span class="text-amber-700 dark:text-amber-400" [title]="a.OutlookError">No se pudo leer su calendario</span>
                        } @else if (a.OutlookSincronizadoUtc) {
                          <span class="text-foreground" title="Lo ocupado en su Outlook descuenta cupos">Al día · {{ fechaHora(a.OutlookSincronizadoUtc) }}</span>
                        } @else {
                          <span class="text-muted-foreground">Pendiente</span>
                        }
                      </td>
                      <td class="px-4 py-2"><span class="alma-badge" [class]="a.Activo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300'">{{ a.Activo ? 'Activo' : 'Inactivo' }}</span></td>
                      <td class="px-4 py-2 text-right"><button type="button" class="alma-btn alma-btn-ghost w-auto px-3 h-8 text-xs" (click)="editarAsesor(a)"><lucide-icon name="pencil" [size]="14" /> Editar</button></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
        }

        <!-- ═══════════ Ausencias ═══════════ -->
        @case ('ausencias') {
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <header class="mb-4">
            <h2 class="text-base font-bold text-foreground">Ausencias</h2>
            <p class="text-xs text-muted-foreground">Vacaciones, incapacidades o capacitaciones: en ese rango el asesor no recibe citas. Las ya agendadas no se mueven solas; reasígnelas en Citas. Lo que el asesor marque en su Outlook también se descuenta sin registrarlo aquí.</p>
          </header>
          <div class="mb-5 rounded-2xl border border-border/60 p-4">
            <h3 class="mb-3 text-sm font-semibold text-foreground">Registrar ausencia</h3>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-[12rem_auto_auto_1fr_auto] xl:items-end">
              <div>
                <label class="text-[11px] font-medium text-foreground" for="au-asesor">Asesor</label>
                <select id="au-asesor" class="alma-input mt-0.5 h-8 w-full text-xs" (change)="ausencia.set({ ...ausencia(), asesorId: +$any($event.target).value || null })">
                  <option value="">Elegir…</option>
                  @for (a of cfg()!.asesores; track a.Id) { <option [value]="a.Id">{{ a.Nombre }}</option> }
                </select>
              </div>
              <div>
                <label class="text-[11px] font-medium text-foreground" for="au-desde">Desde</label>
                <input id="au-desde" type="datetime-local" class="alma-input mt-0.5 h-8 w-full text-xs" (change)="ausencia.set({ ...ausencia(), desde: $any($event.target).value })" />
              </div>
              <div>
                <label class="text-[11px] font-medium text-foreground" for="au-hasta">Hasta</label>
                <input id="au-hasta" type="datetime-local" class="alma-input mt-0.5 h-8 w-full text-xs" (change)="ausencia.set({ ...ausencia(), hasta: $any($event.target).value })" />
              </div>
              <div>
                <label class="text-[11px] font-medium text-foreground" for="au-motivo">Motivo</label>
                <input id="au-motivo" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="200" placeholder="Opcional" (input)="ausencia.set({ ...ausencia(), motivo: $any($event.target).value })" />
              </div>
              <button type="button" class="alma-btn alma-btn-primary h-8 text-xs" [disabled]="guardando()" (click)="crearAusencia()"><lucide-icon name="plus" [size]="14" /> Agregar</button>
            </div>
          </div>
          <h3 class="mb-2 text-sm font-semibold text-foreground">Vigentes y próximas</h3>
          @if (ausenciasVigentes().length) {
            <ul class="divide-y divide-border/50 rounded-2xl border border-border/60 text-sm">
              @for (au of ausenciasVigentes(); track au.Id) {
                <li class="flex flex-wrap items-center gap-3 px-4 py-2">
                  <span class="font-medium text-foreground">{{ nombreAsesor(au.AsesorId) }}</span>
                  <span class="text-xs text-foreground">{{ fechaHora(au.InicioUtc) }} → {{ fechaHora(au.FinUtc) }}</span>
                  <span class="mr-auto text-xs text-muted-foreground">{{ au.Motivo ?? '' }}</span>
                  <button type="button" class="alma-btn alma-btn-ghost h-8 text-xs" aria-label="Quitar ausencia" (click)="borrarAusencia(au.Id)"><lucide-icon name="trash-2" [size]="14" /></button>
                </li>
              }
            </ul>
          } @else {
            <p class="rounded-2xl border border-dashed border-border/70 py-6 text-center text-sm text-muted-foreground">No hay ausencias vigentes ni próximas.</p>
          }
          @if (ausenciasPasadas().length) {
            <details class="mt-4">
              <summary class="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Ver pasadas ({{ ausenciasPasadas().length }})</summary>
              <ul class="mt-2 divide-y divide-border/50 text-sm opacity-75">
                @for (au of ausenciasPasadas(); track au.Id) {
                  <li class="flex flex-wrap items-center gap-3 py-2">
                    <span class="font-medium text-foreground">{{ nombreAsesor(au.AsesorId) }}</span>
                    <span class="text-xs text-foreground">{{ fechaHora(au.InicioUtc) }} → {{ fechaHora(au.FinUtc) }}</span>
                    <span class="text-xs text-muted-foreground">{{ au.Motivo ?? '' }}</span>
                  </li>
                }
              </ul>
            </details>
          }
        </section>
        }

        <!-- ═══════════ Política de datos ═══════════ -->
        @case ('politica') {
        <section class="glass rounded-3xl p-5 shadow-[var(--shadow-sm)]">
          <header class="mb-4">
            <h2 class="text-base font-bold text-foreground">Política de tratamiento de datos</h2>
            <p class="text-xs text-muted-foreground">Texto de la casilla que acepta la persona al agendar. Cada cita guarda la versión que aceptó; para cambiar el texto se publica una versión nueva.</p>
          </header>
          @if (cfg()!.politicas[0]; as p) {
            <div class="mb-5 rounded-2xl border border-border/60 p-4 text-sm">
              <p class="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span class="alma-badge bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">Vigente</span>
                Versión {{ p.Version }} · desde {{ fechaHora(p.VigenteDesde) }}
              </p>
              <p class="text-foreground">{{ p.Texto }}</p>
              @if (p.Url) {
                <a class="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" [href]="p.Url" target="_blank" rel="noopener">{{ p.Url }} <lucide-icon name="external-link" [size]="12" /></a>
              } @else {
                <p class="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><lucide-icon name="alert-triangle" [size]="12" /> Sin enlace a la política completa.</p>
              }
            </div>
          }
          <div class="rounded-2xl border border-border/60 p-4">
            <h3 class="mb-3 text-sm font-semibold text-foreground">Publicar versión nueva</h3>
            <div class="grid gap-3 md:grid-cols-[10rem_1fr]">
              <div>
                <label class="text-[11px] font-medium text-foreground" for="po-version">Versión</label>
                <input id="po-version" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="20" placeholder="p. ej. 2027-01" (input)="politica.set({ ...politica(), version: $any($event.target).value })" />
              </div>
              <div>
                <label class="text-[11px] font-medium text-foreground" for="po-url">Enlace a la política completa</label>
                <input id="po-url" class="alma-input mt-0.5 h-8 w-full text-xs" maxlength="400" placeholder="https://…" (input)="politica.set({ ...politica(), url: $any($event.target).value })" />
              </div>
              <div class="md:col-span-2">
                <label class="text-[11px] font-medium text-foreground" for="po-texto">Texto de la casilla</label>
                <textarea id="po-texto" class="alma-input mt-0.5 min-h-20 w-full text-xs" maxlength="1000" (input)="politica.set({ ...politica(), texto: $any($event.target).value })"></textarea>
              </div>
            </div>
            <button type="button" class="alma-btn alma-btn-outline mt-3 h-8 text-xs" [disabled]="guardando()" (click)="crearPolitica()">Publicar versión nueva</button>
          </div>
        </section>
        }
        }
        </div>
      </div>
    }
  `,
})
export class ConfiguracionAgendaComponent {
  private readonly api = inject(AgendaApi);
  private readonly toast = inject(ToastService);

  protected readonly cfg = signal<Configuracion | null>(null);
  protected readonly modulo = signal<Modulo>(leerModulo());
  protected readonly servicioSel = signal<number | null>(null);
  protected readonly nuevoServicio = signal<NuevoServicioForm | null>(null);
  protected readonly nuevoTipo = signal<NuevoTipoForm | null>(null);
  protected readonly servicioEdit = signal<{ Titulo: string; Encabezado: string; Descripcion: string; Activo: boolean } | null>(null);
  protected readonly editorFormulario = signal<EditorFormulario | null>(null);
  protected readonly guardando = signal(false);
  protected readonly cambiosTipo = signal<Record<number, Partial<TipoCita>>>({});
  protected readonly form = signal<AsesorForm | null>(null);
  protected readonly ausencia = signal<{ asesorId: number | null; desde: string; hasta: string; motivo: string }>(
    { asesorId: null, desde: '', hasta: '', motivo: '' });
  protected readonly politica = signal({ version: '', texto: '', url: '' });

  protected readonly camposTipo = CAMPOS_TIPO;
  protected readonly dias = DIAS_SEMANA;
  protected readonly fechaHora = fechaHoraColombia;
  private readonly tiposPorId = computed(() => new Map((this.cfg()?.tipos ?? []).map((t) => [t.Id, t])));

  /** Servicio que se ve en Tipos de cita (el primero si no se ha elegido). */
  protected readonly servicioActual = computed<Configuracion['servicios'][number] | null>(() => {
    const srv = this.cfg()?.servicios ?? [];
    return srv.find((x) => x.Id === this.servicioSel()) ?? (srv.length ? srv[0] : null);
  });

  /** Ausencias que todavía no terminan; las pasadas se muestran aparte. */
  protected readonly ausenciasVigentes = computed(() => (this.cfg()?.ausencias ?? []).filter((a) => !yaPaso(a.FinUtc)));
  protected readonly ausenciasPasadas = computed(() => (this.cfg()?.ausencias ?? []).filter((a) => yaPaso(a.FinUtc)));

  protected readonly menu = computed<ModuloMenu[]>(() => {
    const c = this.cfg();
    if (!c) return [];
    const activos = c.tipos.filter((t) => t.Activo).length;
    const asesoresActivos = c.asesores.filter((a) => a.Activo);
    const sinTurno = asesoresActivos.filter((a) => !a.turnos.length).length;
    const sinOutlook = asesoresActivos.filter((a) => a.OutlookError).length;
    const pol = c.politicas[0];
    const formularios = c.formularios.filter((f) => f.Activo).length;
    const sinUso = c.formularios.filter((f) => f.Activo && !f.Tipos).length;
    const pendientes = Object.keys(this.cambiosTipo()).length;
    const vigentes = this.ausenciasVigentes().length;
    return [
      { id: 'tipos', rotulo: 'Tipos de cita', icono: 'calendar-clock',
        resumen: `${c.servicios.length} servicios · ${activos} de ${c.tipos.length} tipos activos`,
        alerta: pendientes ? `${pendientes} con cambios sin guardar` : null },
      { id: 'formularios', rotulo: 'Formularios', icono: 'clipboard-list',
        resumen: `${formularios} ${formularios === 1 ? 'activo' : 'activos'}`,
        alerta: sinUso ? `${sinUso} sin usar en ningún tipo` : null },
      { id: 'asesores', rotulo: 'Asesores y turnos', icono: 'users',
        resumen: `${asesoresActivos.length} activos de ${c.asesores.length}`,
        alerta: !asesoresActivos.length ? 'Sin asesores activos'
          : sinTurno ? `${sinTurno} sin turnos` : sinOutlook ? `${sinOutlook} sin leer su Outlook` : null },
      { id: 'ausencias', rotulo: 'Ausencias', icono: 'plane',
        resumen: vigentes ? `${vigentes} vigentes o próximas` : 'Ninguna próxima', alerta: null },
      { id: 'politica', rotulo: 'Política de datos', icono: 'shield-check',
        resumen: pol ? `Versión ${pol.Version}` : 'Sin versión',
        alerta: !pol ? 'Falta publicar una versión' : !pol.Url ? 'Sin enlace a la política' : null },
    ];
  });

  constructor() {
    void this.cargar();
  }

  protected irA(m: Modulo): void {
    this.modulo.set(m);
    try { sessionStorage.setItem(CLAVE_MODULO, m); } catch { /* sin almacenamiento: solo no se recuerda */ }
  }

  protected claseModulo(m: Modulo): string {
    return this.modulo() === m
      ? 'bg-primary/10 text-foreground ring-1 ring-primary/40'
      : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground';
  }

  protected claseServicio(id: number): string {
    return this.servicioActual()?.Id === id
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground';
  }

  protected cuentaTipos(servicioId: number): string {
    const t = this.tiposDe(servicioId);
    return `${t.filter((x) => x.Activo).length}/${t.length}`;
  }

  protected estadoTurnos(a: Asesor): string {
    return a.turnos.length ? '' : 'text-amber-700 dark:text-amber-400';
  }

  private enfocarFormulario(): void {
    setTimeout(() => document.getElementById('as-nombre')?.focus());
  }

  private async cargar(): Promise<void> {
    try {
      this.cfg.set(await this.api.configuracion());
    } catch (e) {
      this.toast.error('No se pudo cargar la configuración', e instanceof Error ? e.message : String(e));
    }
  }

  private async guardar(hacer: () => Promise<unknown>, ok: string): Promise<boolean> {
    this.guardando.set(true);
    try {
      await hacer();
      this.toast.show(ok);
      await this.cargar();
      return true;
    } catch (e) {
      this.toast.error('No se pudo guardar', e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Tipos ──
  protected formularioDe(json: string | null): FormularioServicio | null {
    return leerFormulario(json);
  }

  protected tipoPregunta(t: string): string {
    return ({ texto: 'texto', texto_largo: 'texto largo', numero: 'número', fecha: 'fecha', opciones: 'una opción',
              si_no: 'sí o no' } as Record<string, string>)[t] ?? t;
  }

  protected tiposDe(servicioId: number): TipoCita[] {
    return (this.cfg()?.tipos ?? []).filter((t) => t.ServicioId === servicioId);
  }

  protected valorTipo<K extends keyof TipoCita>(t: TipoCita, campo: K): TipoCita[K] {
    const c = this.cambiosTipo()[t.Id];
    return (c && campo in c ? c[campo] : t[campo]) as TipoCita[K];
  }

  protected cambiarTipo(t: TipoCita, campo: keyof TipoCita, valor: unknown): void {
    this.cambiosTipo.update((c) => ({ ...c, [t.Id]: { ...(c[t.Id] ?? {}), [campo]: valor } }));
  }

  protected descartarTipo(t: TipoCita): void {
    this.cambiosTipo.update((c) => { const n = { ...c }; delete n[t.Id]; return n; });
  }

  protected async guardarTipo(t: TipoCita): Promise<void> {
    const cambios = this.cambiosTipo()[t.Id];
    if (!cambios) return;
    for (const c of CAMPOS_TIPO) {
      const v = cambios[c.campo] as number | undefined;
      if (v !== undefined && (!Number.isFinite(v) || v < c.min || v > c.max)) {
        this.toast.error('Valor fuera de rango', `${c.rotulo}: entre ${c.min} y ${c.max}.`);
        return;
      }
    }
    const vi = this.valorTipo(t, 'VentanaInicio'), vf = this.valorTipo(t, 'VentanaFin');
    if (vi && vf && vf <= vi) {
      this.toast.error('Revise la ventana horaria', 'La hora final debe ser posterior a la inicial.');
      return;
    }
    if (await this.guardar(() => this.api.actualizarTipo(t.Id, cambios), 'Tipo de cita guardado')) this.descartarTipo(t);
  }

  /** El primer color de la paleta que no use otro tipo del servicio. */
  private colorLibre(servicioId: number): string {
    const usados = new Set(this.tiposDe(servicioId).map((t) => t.Color.toLowerCase()));
    return (PALETA_TIPOS.find((c) => !usados.has(c.valor)) ?? PALETA_TIPOS[0]).valor;
  }

  protected readonly formulariosActivos = computed(() => (this.cfg()?.formularios ?? []).filter((f) => f.Activo));
  protected readonly canales = computed(() => [...new Set((this.cfg()?.tipos ?? []).map((t) => t.Canal))]);

  protected tiposConFormulario(id: number): string[] {
    return (this.cfg()?.tipos ?? []).filter((t) => t.FormularioDatosId === id).map((t) => t.Titulo);
  }

  // ── Servicios ──
  protected abrirNuevoServicio(): void {
    this.nuevoTipo.set(null);
    this.nuevoServicio.set({ Titulo: '', Slug: '', slugManual: false, Encabezado: '', Descripcion: '' });
    setTimeout(() => document.getElementById('ns-titulo')?.focus());
  }

  protected editarNuevoServicio(c: Partial<NuevoServicioForm>): void {
    this.nuevoServicio.update((f) => {
      if (!f) return f;
      const n = { ...f, ...c };
      if ('Slug' in c) n.Slug = identificador(c.Slug ?? '', '-');
      else if ('Titulo' in c && !n.slugManual) n.Slug = identificador(n.Titulo, '-');
      return n;
    });
  }

  protected async crearServicio(): Promise<void> {
    const f = this.nuevoServicio();
    if (!f) return;
    if (f.Titulo.trim().length < 3 || f.Encabezado.trim().length < 3 || f.Slug.length < 3) {
      this.toast.error('Revise el servicio', 'Título, identificador (mínimo 3 caracteres) y encabezado.');
      return;
    }
    let id = 0;
    const ok = await this.guardar(async () => {
      id = (await this.api.crearServicio({ Slug: f.Slug, Titulo: f.Titulo.trim(), Encabezado: f.Encabezado.trim(),
                                           Descripcion: f.Descripcion.trim() || null })).id;
    }, 'Servicio creado: agréguele tipos de cita');
    if (ok) {
      this.nuevoServicio.set(null);
      this.servicioSel.set(id);
    }
  }

  protected editarServicio(srv: Servicio): void {
    this.servicioEdit.set({ Titulo: srv.Titulo, Encabezado: srv.Encabezado, Descripcion: srv.Descripcion ?? '', Activo: srv.Activo });
  }

  protected async guardarServicio(id: number): Promise<void> {
    const se = this.servicioEdit();
    if (!se) return;
    if (se.Titulo.trim().length < 3 || se.Encabezado.trim().length < 3) {
      this.toast.error('Revise el servicio', 'Título y encabezado de al menos 3 caracteres.');
      return;
    }
    const ok = await this.guardar(() => this.api.actualizarServicio(id, {
      Titulo: se.Titulo.trim(), Encabezado: se.Encabezado.trim(), Descripcion: se.Descripcion.trim() || null, Activo: se.Activo,
    }), 'Servicio guardado');
    if (ok) this.servicioEdit.set(null);
  }

  // ── Tipo nuevo ──
  protected abrirNuevoTipo(): void {
    this.nuevoServicio.set(null);
    const srv = this.servicioActual();
    if (!srv) return;
    // Por defecto, el formulario que ya usan los tipos de ese servicio.
    const comun = this.tiposDe(srv.Id).map((t) => t.FormularioDatosId).find((x) => x != null) ?? null;
    this.nuevoTipo.set({ ServicioId: srv.Id, Titulo: '', Slug: '', slugManual: false, Canal: 'Llamada telefónica', Resumen: '',
                         Color: this.colorLibre(srv.Id), DuracionMin: 30, FormularioDatosId: comun, asignarATodos: true });
    setTimeout(() => document.getElementById('nt-titulo')?.focus());
  }

  protected editarNuevoTipo(c: Partial<NuevoTipoForm>): void {
    this.nuevoTipo.update((f) => {
      if (!f) return f;
      const n = { ...f, ...c };
      if ('Slug' in c) n.Slug = identificador(c.Slug ?? '', '-');
      else if ('Titulo' in c && !n.slugManual) n.Slug = identificador(n.Titulo, '-');
      return n;
    });
  }

  protected async crearTipo(): Promise<void> {
    const f = this.nuevoTipo();
    if (!f) return;
    if (f.Titulo.trim().length < 3 || f.Slug.length < 2 || f.Canal.trim().length < 2) {
      this.toast.error('Revise el tipo', 'Título (mínimo 3 letras), identificador y canal.');
      return;
    }
    if (!Number.isFinite(f.DuracionMin) || f.DuracionMin < 10 || f.DuracionMin > 240) {
      this.toast.error('Revise la duración', 'Entre 10 y 240 minutos.');
      return;
    }
    const { slugManual: _s, ...datos } = f;
    const ok = await this.guardar(() => this.api.crearTipo({ ...datos, Titulo: f.Titulo.trim(), Canal: f.Canal.trim(),
                                                             Resumen: f.Resumen.trim() || null }), 'Tipo de cita creado');
    if (ok) {
      this.servicioSel.set(f.ServicioId);
      this.nuevoTipo.set(null);
    }
  }

  // ── Formularios ──
  protected abrirEditor(formulario: FormularioDatos | null, copiaDe: FormularioDatos | null = null): void {
    this.editorFormulario.set({ clave: Date.now(), formulario, copiaDe });
  }

  protected async formularioGuardado(): Promise<void> {
    this.editorFormulario.set(null);
    await this.cargar();
  }

  // ── Asesores ──
  protected nombresTipos(ids: number[]): string {
    const todos = this.cfg()?.tipos ?? [];
    if (todos.length && todos.every((t) => ids.includes(t.Id))) return 'Todos los tipos';
    return ids.map((id) => this.tiposPorId().get(id)?.Titulo ?? `#${id}`).join(' · ') || '—';
  }

  protected nombreAsesor(id: number): string {
    return this.cfg()?.asesores.find((a) => a.Id === id)?.Nombre ?? `#${id}`;
  }

  protected resumenTurnos(a: Asesor): string {
    if (!a.turnos.length) return 'Sin turnos';
    const porDia = new Map<number, string[]>();
    for (const t of a.turnos) porDia.set(t.DiaSemana, [...(porDia.get(t.DiaSemana) ?? []), `${t.HoraInicio.slice(0, 5)}–${t.HoraFin.slice(0, 5)}`]);
    // Días seguidos con el mismo horario se agrupan: «Lun a Vie 08:00–12:00, 14:00–17:00».
    const dias = [...porDia].sort((x, y) => x[0] - y[0]).map(([d, h]) => ({ d, h: h.sort().join(', ') }));
    const grupos: { desde: number; hasta: number; h: string }[] = [];
    for (const x of dias) {
      const g = grupos[grupos.length - 1];
      if (g && g.h === x.h && g.hasta === x.d - 1) g.hasta = x.d;
      else grupos.push({ desde: x.d, hasta: x.d, h: x.h });
    }
    const dia = (d: number) => DIAS_SEMANA[d].slice(0, 3);
    return grupos.map((g) => `${g.desde === g.hasta ? dia(g.desde) : `${dia(g.desde)} a ${dia(g.hasta)}`} ${g.h}`).join(' · ');
  }

  protected nuevoAsesor(): void {
    this.enfocarFormulario();
    this.form.set({ id: null, correo: '', nombre: '', activo: true, tipos: (this.cfg()?.tipos ?? []).map((t) => t.Id), turnos: [] });
  }

  protected editarAsesor(a: Asesor): void {
    this.enfocarFormulario();
    this.form.set({
      id: a.Id, correo: a.Correo, nombre: a.Nombre, activo: a.Activo, tipos: [...a.tipos],
      turnos: a.turnos.map((t) => ({ dia: t.DiaSemana, inicio: t.HoraInicio.slice(0, 5), fin: t.HoraFin.slice(0, 5) })),
    });
  }

  protected editarForm(cambios: Partial<AsesorForm>): void {
    this.form.update((f) => (f ? { ...f, ...cambios } : f));
  }

  protected alternarTipo(id: number): void {
    this.form.update((f) => f && { ...f, tipos: f.tipos.includes(id) ? f.tipos.filter((x) => x !== id) : [...f.tipos, id] });
  }

  protected agregarTurno(): void {
    this.form.update((f) => f && { ...f, turnos: [...f.turnos, { dia: 0, inicio: '08:00', fin: '12:00' }] });
  }

  protected horarioOficina(): void {
    const turnos: TurnoForm[] = [];
    for (let d = 0; d < 5; d++) turnos.push({ dia: d, inicio: '08:00', fin: '12:00' }, { dia: d, inicio: '14:00', fin: '17:00' });
    this.form.update((f) => f && { ...f, turnos });
  }

  protected editarTurno(i: number, cambios: Partial<TurnoForm>): void {
    this.form.update((f) => f && { ...f, turnos: f.turnos.map((t, j) => (j === i ? { ...t, ...cambios } : t)) });
  }

  protected quitarTurno(i: number): void {
    this.form.update((f) => f && { ...f, turnos: f.turnos.filter((_, j) => j !== i) });
  }

  protected async guardarAsesor(): Promise<void> {
    const f = this.form();
    if (!f) return;
    if (f.nombre.trim().length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.trim())) {
      this.toast.error('Revise los datos', 'Nombre (mínimo 3 letras) y un correo válido.');
      return;
    }
    if (f.turnos.some((t) => !t.inicio || !t.fin || t.fin <= t.inicio)) {
      this.toast.error('Revise los turnos', 'La hora final de cada turno debe ser posterior a la inicial.');
      return;
    }
    const datos = { correo: f.correo.trim().toLowerCase(), nombre: f.nombre.trim(), activo: f.activo, tipos: f.tipos };
    const turnos: TurnoEntrada[] = f.turnos.map((t) => ({ dia_semana: t.dia, hora_inicio: t.inicio, hora_fin: t.fin }));
    const ok = await this.guardar(async () => {
      const id = f.id ?? (await this.api.crearAsesor(datos)).id;
      if (f.id) await this.api.actualizarAsesor(f.id, datos);
      await this.api.guardarTurnos(id, turnos);
    }, f.id ? 'Asesor actualizado' : 'Asesor agregado');
    if (ok) this.form.set(null);
  }

  // ── Ausencias ──
  protected async crearAusencia(): Promise<void> {
    const a = this.ausencia();
    if (!a.asesorId || !a.desde || !a.hasta || a.hasta <= a.desde) {
      this.toast.error('Revise la ausencia', 'Elija el asesor y un rango en el que el fin sea posterior al inicio.');
      return;
    }
    await this.guardar(() => this.api.crearAusencia({ asesorId: a.asesorId!, desde: a.desde, hasta: a.hasta, motivo: a.motivo.trim() || null }),
      'Ausencia agregada');
  }

  protected async borrarAusencia(id: number): Promise<void> {
    if (!confirm('¿Quitar esta ausencia? El asesor vuelve a recibir citas en ese rango.')) return;
    await this.guardar(() => this.api.borrarAusencia(id), 'Ausencia quitada');
  }

  // ── Política ──
  protected async crearPolitica(): Promise<void> {
    const p = this.politica();
    if (!/^[A-Za-z0-9._-]{3,20}$/.test(p.version.trim()) || p.texto.trim().length < 20) {
      this.toast.error('Revise la política', 'Versión de 3 a 20 caracteres (letras, números, punto o guion) y un texto de al menos 20.');
      return;
    }
    if (p.url && !p.url.startsWith('https://')) {
      this.toast.error('Revise el enlace', 'Debe empezar por https://');
      return;
    }
    if (!confirm('Desde ahora las personas aceptarán este texto. ¿Publicar?')) return;
    await this.guardar(() => this.api.crearPolitica({ version: p.version.trim(), texto: p.texto.trim(), url: p.url.trim() || null }),
      'Política publicada');
  }
}

const CLAVE_MODULO = 'alma.agenda.config.modulo';
const MODULOS: Modulo[] = ['tipos', 'formularios', 'asesores', 'ausencias', 'politica'];

function leerModulo(): Modulo {
  try {
    const m = sessionStorage.getItem(CLAVE_MODULO) as Modulo | null;
    return m && MODULOS.includes(m) ? m : 'tipos';
  } catch {
    return 'tipos';
  }
}

/** ¿La fecha UTC del backend (con o sin zona) ya pasó? */
function yaPaso(utc: string): boolean {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(utc) ? utc : `${utc}Z`).getTime() <= Date.now();
}
