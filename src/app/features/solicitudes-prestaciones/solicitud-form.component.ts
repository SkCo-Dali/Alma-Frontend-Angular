// Formulario de la solicitud de prestaciones (FOR-0075, devolución de saldos por vejez).
//
// El asesor busca al afiliado por documento; Alma sugiere los datos que tiene (marcados
// «Sugerido» hasta que el asesor los confirma o los cambia), el asesor completa el resto y
// un panel le muestra errores y avisos mientras diligencia. Al final se genera el PDF oficial
// para imprimir y firmar: la firma, la huella y las respuestas del cliente nunca se marcan solas.
//
// Nada de lo digitado se guarda en Alma: vive en esta pantalla y viaja en cada petición.

import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaCheckboxComponent } from '../../shared/components/alma-checkbox.component';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { Analisis, Catalogos, Consulta, EstadoOrigen, Hallazgo, Opcion, PdfConErrores, PrestacionesApi } from './prestaciones.api';
import {
  CampoDef,
  Datos,
  beneficiarioVacio,
  datosParaEnviar,
  edadEn,
  escribir,
  leer,
  solicitudInicial,
} from './prestaciones.domain';
import { SiNoComponent } from './si-no.component';

const AFILIADO: CampoDef[] = [
  { clave: 'primer_nombre', rotulo: 'Primer nombre', tipo: 'texto', max: 60 },
  { clave: 'segundo_nombre', rotulo: 'Segundo nombre', tipo: 'texto', max: 60 },
  { clave: 'primer_apellido', rotulo: 'Primer apellido', tipo: 'texto', max: 60 },
  { clave: 'segundo_apellido', rotulo: 'Segundo apellido', tipo: 'texto', max: 60 },
  { clave: 'fecha_nacimiento', rotulo: 'Fecha de nacimiento', tipo: 'fecha' },
  { clave: 'ciudad_nacimiento', rotulo: 'Ciudad de nacimiento', tipo: 'texto', max: 80 },
  { clave: 'nacionalidad', rotulo: 'Nacionalidad', tipo: 'texto', max: 60 },
  { clave: 'genero', rotulo: 'Género', tipo: 'lista', catalogo: 'afiliado.genero' },
  { clave: 'estado_civil', rotulo: 'Estado civil', tipo: 'lista', catalogo: 'afiliado.estado_civil' },
  { clave: 'numero_hijos', rotulo: 'Número de hijos', tipo: 'numero', paso: '1', ayuda: '0 si no tiene' },
  { clave: 'ocupacion', rotulo: 'Ocupación', tipo: 'lista', catalogo: 'afiliado.ocupacion' },
];

const CONTACTO: CampoDef[] = [
  { clave: 'direccion', rotulo: 'Dirección de residencia', tipo: 'texto', max: 120, ancho: 2 },
  { clave: 'ciudad', rotulo: 'Ciudad', tipo: 'texto', max: 80 },
  { clave: 'departamento', rotulo: 'Departamento', tipo: 'texto', max: 80 },
  { clave: 'telefono_fijo', rotulo: 'Teléfono fijo', tipo: 'tel', max: 15 },
  { clave: 'celular', rotulo: 'Celular', tipo: 'tel', max: 15 },
  { clave: 'telefono_trabajo', rotulo: 'Teléfono del trabajo', tipo: 'tel', max: 15 },
  { clave: 'email', rotulo: 'Correo electrónico', tipo: 'email', max: 100, ancho: 2 },
  { clave: 'observacion', rotulo: 'Observación', tipo: 'texto', max: 120, ancho: 2 },
];

const BENEFICIARIO: CampoDef[] = [
  { clave: 'nombres_apellidos', rotulo: 'Nombres y apellidos', tipo: 'texto', max: 100, ancho: 2 },
  { clave: 'parentesco', rotulo: 'Parentesco', tipo: 'lista', catalogo: 'beneficiarios[].parentesco' },
  { clave: 'tipo_documento', rotulo: 'Tipo de documento', tipo: 'documento' },
  { clave: 'numero_documento', rotulo: 'Número de documento', tipo: 'texto', max: 20 },
  { clave: 'fecha_nacimiento', rotulo: 'Fecha de nacimiento', tipo: 'fecha' },
  { clave: 'genero', rotulo: 'Género', tipo: 'lista', catalogo: 'beneficiarios[].genero' },
  { clave: 'ciudad_nacimiento', rotulo: 'Ciudad de nacimiento', tipo: 'texto', max: 80 },
  { clave: 'direccion', rotulo: 'Dirección', tipo: 'texto', max: 120, ancho: 2 },
  { clave: 'ciudad', rotulo: 'Ciudad', tipo: 'texto', max: 80 },
  { clave: 'departamento', rotulo: 'Departamento', tipo: 'texto', max: 80 },
  { clave: 'telefono_fijo', rotulo: 'Teléfono fijo', tipo: 'tel', max: 15 },
  { clave: 'celular', rotulo: 'Celular', tipo: 'tel', max: 15 },
  { clave: 'email', rotulo: 'Correo electrónico', tipo: 'email', max: 100, ancho: 2 },
  { clave: 'invalidez', rotulo: '¿Presenta condición de invalidez?', tipo: 'sino', ancho: 2 },
  { clave: 'ley_2388', rotulo: 'Pregunta de la Ley 2388', tipo: 'sino', ancho: 2 },
];

const PRESTACIONES = [
  { clave: 'recibe_prestacion', rotulo: '¿Recibe actualmente otra prestación (pensión)?' },
  { clave: 'tramita_prestacion', rotulo: '¿Está tramitando otra prestación (pensión)?' },
];

const FINALIDADES = [
  { clave: 'finalidad_1', rotulo: '1. Fines necesarios para la ejecución del contrato y la prestación del servicio', obligatoria: true },
  { clave: 'finalidad_2', rotulo: '2. Tratamiento de los datos realizado por las Compañías Skandia', obligatoria: false },
  { clave: 'finalidad_3', rotulo: '3. Relacionamiento estratégico (invitaciones, mejora y oferta de productos)', obligatoria: false },
];

const REFRESCO_MS = 700;

@Component({
  selector: 'alma-solicitud-form',
  imports: [NgTemplateOutlet, LucideAngularModule, AlmaCheckboxComponent, AlmaLoaderComponent, SiNoComponent],
  template: `
    <!-- Campo genérico: se pinta según su definición. base = sección del dato ('afiliado', 'beneficiarios[0]', ''). -->
    <ng-template #campo let-def let-base="base">
      @let ruta = base ? base + '.' + def.clave : def.clave;
      @let hs = hallazgosDe(ruta);
      <div [class]="def.ancho === 4 ? 'sm:col-span-2 xl:col-span-3' : def.ancho === 2 ? 'sm:col-span-2' : ''">
        <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <label [attr.for]="'f-' + ruta">{{ def.rotulo }}</label>
          @if (esSugerido(ruta)) {
            <button type="button" class="alma-badge bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300" title="Dato sugerido por Alma: confírmalo con el cliente (clic para marcarlo como confirmado)" (click)="confirmar(ruta)">
              Sugerido · confirmar
            </button>
          }
        </div>
        <div class="mt-1">
          @switch (def.tipo) {
            @case ('sino') {
              <alma-si-no [id]="'f-' + ruta" [rotulo]="def.rotulo" [valor]="leerRuta(ruta)" (valorChange)="poner(ruta, $event)" />
            }
            @case ('lista') {
              <select class="alma-input" [id]="'f-' + ruta" [class.border-destructive]="hayError(hs)" (change)="poner(ruta, $any($event.target).value)">
                <option value="" [selected]="!leerRuta(ruta)">Elegir…</option>
                @for (o of opciones(def.catalogo); track o.valor) {
                  <option [value]="o.valor" [selected]="o.valor === leerRuta(ruta)">{{ o.rotulo }}</option>
                }
              </select>
            }
            @case ('documento') {
              <select class="alma-input" [id]="'f-' + ruta" [class.border-destructive]="hayError(hs)" (change)="poner(ruta, $any($event.target).value)">
                <option value="" [selected]="!leerRuta(ruta)">Elegir…</option>
                @for (t of tiposDocBeneficiario(); track t) {
                  <option [value]="t" [selected]="t === leerRuta(ruta)">{{ t }}</option>
                }
              </select>
            }
            @case ('fecha') {
              <input class="alma-input" type="date" [id]="'f-' + ruta" [value]="texto(ruta)" [class.border-destructive]="hayError(hs)" (input)="poner(ruta, $any($event.target).value)" />
              @if (edadDe(ruta); as e) {
                <span class="mt-0.5 block text-[11px] text-muted-foreground">Edad: {{ e }} años</span>
              }
            }
            @case ('numero') {
              <input class="alma-input" type="number" min="0" [step]="def.paso ?? '1'" inputmode="decimal" [id]="'f-' + ruta" [value]="texto(ruta)" [class.border-destructive]="hayError(hs)" (input)="poner(ruta, $any($event.target).value === '' ? null : +$any($event.target).value)" />
            }
            @default {
              <input class="alma-input" [type]="def.tipo === 'email' ? 'email' : def.tipo === 'tel' ? 'tel' : 'text'" [attr.maxlength]="def.max ?? 120" autocomplete="off" [id]="'f-' + ruta" [value]="texto(ruta)" [class.border-destructive]="hayError(hs)" (input)="poner(ruta, $any($event.target).value)" />
            }
          }
          @if (def.ayuda) {
            <span class="mt-0.5 block text-[11px] text-muted-foreground">{{ def.ayuda }}</span>
          }
          @for (h of hs; track h.regla + h.mensaje) {
            <span class="mt-0.5 block text-[11px]" [class]="h.gravedad === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'">{{ h.mensaje }}</span>
          }
        </div>
      </div>
    </ng-template>

    @if (cargandoCatalogos()) {
      <div class="flex justify-center py-16"><alma-loader [size]="56" label="Preparando el formulario…" /></div>
    } @else if (errorCatalogos(); as e) {
      <section class="glass rounded-3xl p-6 text-sm shadow-[var(--shadow-sm)]">
        <p class="flex items-start gap-2 text-foreground"><lucide-icon name="alert-triangle" [size]="18" class="mt-0.5 shrink-0 text-amber-600" /> <span>{{ e }}</span></p>
        <button type="button" class="alma-btn alma-btn-outline mt-4 h-9 rounded-xl text-sm" (click)="cargarCatalogos()"><lucide-icon name="refresh-cw" [size]="14" /> Reintentar</button>
      </section>
    } @else if (cat(); as c) {
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div class="space-y-4">
          <!-- 1. Búsqueda -->
          <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h2 class="text-sm font-bold text-foreground">1. ¿De quién es la solicitud?</h2>
            <div class="grid items-end gap-3 sm:grid-cols-[13rem_minmax(0,1fr)_auto]">
              <div>
                <label class="text-xs font-medium text-foreground" for="f-afiliado.tipo_documento">Tipo de documento</label>
                <select id="f-afiliado.tipo_documento" class="alma-input mt-1" (change)="poner('afiliado.tipo_documento', $any($event.target).value)">
                  @for (t of c.tipos_documento_afiliado; track t) {
                    <option [value]="t" [selected]="t === leerRuta('afiliado.tipo_documento')">{{ t }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="text-xs font-medium text-foreground" for="f-afiliado.numero_documento">Número de documento</label>
                <input id="f-afiliado.numero_documento" class="alma-input mt-1" maxlength="20" inputmode="numeric" autocomplete="off" [value]="texto('afiliado.numero_documento')" (input)="poner('afiliado.numero_documento', $any($event.target).value)" (keydown.enter)="buscar()" />
                @for (h of hallazgosDe('afiliado.numero_documento'); track h.regla) {
                  <span class="mt-0.5 block text-[11px]" [class]="h.gravedad === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'">{{ h.mensaje }}</span>
                }
              </div>
              <button type="button" class="alma-btn alma-btn-primary h-9 rounded-xl px-4 text-sm" [disabled]="!puedeBuscar() || buscando()" (click)="buscar()">
                <lucide-icon [name]="buscando() ? 'loader-2' : 'search'" [size]="15" [class.animate-spin]="buscando()" /> Buscar
              </button>
            </div>
            @if (!consultable()) {
              <p class="text-xs text-muted-foreground">Este tipo de documento no se consulta en las bases de origen: digita los datos del afiliado.</p>
            }
            @if (consulta(); as q) {
              <div class="flex flex-wrap gap-2 pt-1">
                @for (o of origenes(q); track o.nombre) {
                  <span class="alma-badge gap-1.5" [class]="o.clase">
                    <lucide-icon [name]="o.icono" [size]="13" /> {{ o.nombre }}: {{ o.texto }}
                  </span>
                }
              </div>
              @if (q.prellenado.nombres_para_revisar) {
                <p class="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"><lucide-icon name="info" [size]="14" class="mt-0.5 shrink-0" /> Los nombres vienen en un solo campo en la base de origen: revisa que cada uno quedó en su casilla.</p>
              }
            }
            <p class="text-[11px] text-muted-foreground">Lo que encuentra Alma es una sugerencia: confírmalo con el cliente. Lo que digites aquí no se guarda; vive solo en esta pantalla.</p>
          </section>

          <!-- 2. Solicitud -->
          <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h2 class="text-sm font-bold text-foreground">2. Solicitud</h2>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ng-container *ngTemplateOutlet="campo; context: { $implicit: defCiudad, base: '' }" />
              <ng-container *ngTemplateOutlet="campo; context: { $implicit: defFecha, base: '' }" />
              <div>
                <span class="text-xs font-medium text-foreground">Tipo de solicitud</span>
                <p class="mt-1 flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">Devolución de saldos por vejez</p>
              </div>
            </div>
          </section>

          <!-- 3. Afiliado -->
          <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h2 class="text-sm font-bold text-foreground">3. Datos del afiliado</h2>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              @for (d of defsAfiliado; track d.clave) {
                <ng-container *ngTemplateOutlet="campo; context: { $implicit: d, base: 'afiliado' }" />
              }
              @for (d of defsContacto; track d.clave) {
                <ng-container *ngTemplateOutlet="campo; context: { $implicit: d, base: 'afiliado' }" />
              }
            </div>
            <div class="grid gap-3 pt-2 md:grid-cols-2">
              @for (p of prestaciones; track p.clave) {
                <div class="space-y-2 rounded-2xl border border-border p-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="text-xs font-medium text-foreground">{{ p.rotulo }}</span>
                    <alma-si-no [id]="'f-afiliado.' + p.clave + '.respuesta'" [rotulo]="p.rotulo" [valor]="leerRuta('afiliado.' + p.clave + '.respuesta')" (valorChange)="poner('afiliado.' + p.clave + '.respuesta', $event)" />
                  </div>
                  @for (h of hallazgosDe('afiliado.' + p.clave + '.respuesta'); track h.regla) {
                    <span class="block text-[11px] text-destructive">{{ h.mensaje }}</span>
                  }
                  @if (leerRuta('afiliado.' + p.clave + '.respuesta') === true) {
                    <div class="grid gap-3 sm:grid-cols-3">
                      @for (d of defsPrestacion(p.clave); track d.clave) {
                        <ng-container *ngTemplateOutlet="campo; context: { $implicit: d, base: 'afiliado' }" />
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </section>

          <!-- 4. Beneficiarios -->
          <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-sm font-bold text-foreground">4. Beneficiarios de ley</h2>
              <button type="button" class="alma-btn alma-btn-outline h-8 rounded-lg text-xs" [disabled]="beneficiarios().length >= c.max_beneficiarios_por_hoja" (click)="agregarBeneficiario()">
                <lucide-icon name="plus" [size]="14" /> Agregar beneficiario
              </button>
            </div>
            <p class="text-[11px] text-muted-foreground">Cónyuge o compañero(a) permanente, hijos dependientes, padres dependientes y hermanos inválidos. El formato trae espacio para {{ c.max_beneficiarios_por_hoja }}; con más, se anexa copia de la hoja.</p>
            @for (h of hallazgosDe('beneficiarios'); track h.regla) {
              <p class="text-xs" [class]="h.gravedad === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'">{{ h.mensaje }}</p>
            }
            @for (b of beneficiarios(); track $index; let i = $index) {
              <div class="space-y-3 rounded-2xl border border-border p-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-foreground/70">Beneficiario {{ i + 1 }}</h3>
                  <button type="button" class="alma-btn alma-btn-ghost h-7 rounded-lg text-xs text-destructive" (click)="quitarBeneficiario(i)"><lucide-icon name="trash-2" [size]="13" /> Quitar</button>
                </div>
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  @for (d of defsBeneficiario; track d.clave) {
                    <ng-container *ngTemplateOutlet="campo; context: { $implicit: d, base: 'beneficiarios[' + i + ']' }" />
                  }
                </div>
              </div>
            } @empty {
              <p class="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Aún no hay beneficiarios. Agrega los que el cliente relacione.</p>
            }
          </section>

          <!-- 5. Bono -->
          <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h2 class="text-sm font-bold text-foreground">5. Bono pensional</h2>
            @if (estadoBono(); as eb) {
              <p class="text-xs text-muted-foreground">Estado del bono en la base de origen: <span class="font-semibold text-foreground">{{ eb === 'NB' ? 'sin derecho a bono' : 'código ' + eb }}</span>.</p>
            }
            <div class="flex items-start gap-2.5">
              <alma-checkbox id="f-bono.sin_derecho" [checked]="leerRuta('bono.sin_derecho') === true" (checkedChange)="poner('bono.sin_derecho', $event)" ariaLabel="No tiene derecho a bono pensional" />
              <label for="f-bono.sin_derecho" class="text-sm text-foreground">
                Aceptar que <strong>no tiene derecho a bono pensional</strong> (no cotizó al menos 150 semanas al Régimen de Prima Media antes de la fecha de corte).
                @if (esSugerido('bono.sin_derecho')) {
                  <button type="button" class="alma-badge ml-1 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300" (click)="confirmar('bono.sin_derecho')">Sugerido · confirmar</button>
                }
                <span class="block text-[11px] text-muted-foreground">Se diligencia únicamente si no tiene derecho; si tiene bono, déjalo sin marcar.</span>
              </label>
            </div>
            @for (h of hallazgosDe('bono.sin_derecho'); track h.regla) {
              <p class="text-xs text-amber-700 dark:text-amber-400">{{ h.mensaje }}</p>
            }
          </section>

          <!-- 6. Asesorías -->
          <section class="glass space-y-4 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h2 class="text-sm font-bold text-foreground">6. Asesorías y declaraciones del cliente</h2>
            <p class="text-[11px] text-muted-foreground">Las responde el cliente después de la asesoría: el asesor las registra tal como las da, sin responder por él.</p>
            <div class="space-y-3">
              @for (p of preguntas; track p.ruta) {
                @if (p.ruta !== 'convenios.accede_multilateral' || leerRuta('convenios.cotizo_otros_paises') === true) {
                <div class="flex flex-wrap items-start justify-between gap-3 border-t border-border/50 pt-3 first:border-t-0 first:pt-0">
                  <div class="min-w-0 flex-1">
                    <label class="text-sm text-foreground" [attr.for]="'f-' + p.ruta">{{ p.rotulo }}</label>
                    @if (p.ayuda) { <span class="block text-[11px] text-muted-foreground">{{ p.ayuda }}</span> }
                    @for (h of hallazgosDe(p.ruta); track h.regla) {
                      <span class="block text-[11px]" [class]="h.gravedad === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'">{{ h.mensaje }}</span>
                    }
                  </div>
                  @if (p.opciones) {
                    <select class="alma-input w-52" [id]="'f-' + p.ruta" (change)="poner(p.ruta, $any($event.target).value)">
                      <option value="" [selected]="!leerRuta(p.ruta)">Elegir…</option>
                      @for (o of opciones(p.opciones); track o.valor) {
                        <option [value]="o.valor" [selected]="o.valor === leerRuta(p.ruta)">{{ o.rotulo }}</option>
                      }
                    </select>
                  } @else {
                    <alma-si-no [id]="'f-' + p.ruta" [rotulo]="p.rotulo" [valor]="leerRuta(p.ruta)" (valorChange)="poner(p.ruta, $event)" />
                  }
                </div>
                }
                @if (p.ruta === 'convenios.cotizo_otros_paises' && leerRuta(p.ruta) === true) {
                  <div class="max-w-sm">
                    <ng-container *ngTemplateOutlet="campo; context: { $implicit: defPais, base: '' }" />
                  </div>
                }
              }
            </div>
          </section>

          <!-- 7. Historia laboral -->
          <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h2 class="text-sm font-bold text-foreground">7. Historia laboral</h2>
            <p class="text-xs text-muted-foreground">El cliente manifiesta estar de acuerdo con la historia laboral, «para un total de ___ semanas».</p>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ng-container *ngTemplateOutlet="campo; context: { $implicit: defSemanas, base: '' }" />
            </div>
            @if (semanasCorte(); as corte) {
              <p class="text-[11px] text-muted-foreground">Semanas al corte del {{ corte }} (reporte a la Superintendencia Financiera). Confírmalas con el cliente: pueden haber cambiado desde entonces.</p>
            }
          </section>

          <!-- 8. Datos personales -->
          <section class="glass space-y-3 rounded-3xl p-5 shadow-[var(--shadow-sm)]">
            <h2 class="text-sm font-bold text-foreground">8. Autorización para el tratamiento de datos</h2>
            <p class="text-[11px] text-muted-foreground">La autorización la da el cliente: el asesor solo registra lo que él decida.</p>
            <div>
              <span class="text-xs font-medium text-foreground">Responsable(s) del tratamiento</span>
              <div class="mt-2 grid gap-2 sm:grid-cols-2">
                @for (o of opciones('datos.responsables'); track o.valor) {
                  <label class="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
                    <alma-checkbox [checked]="responsableMarcado(o.valor)" (checkedChange)="alternarResponsable(o.valor, $event)" [ariaLabel]="o.rotulo" />
                    {{ o.rotulo }}
                  </label>
                }
              </div>
              @for (h of hallazgosDe('datos.responsables'); track h.regla) {
                <span class="mt-1 block text-[11px] text-destructive">{{ h.mensaje }}</span>
              }
            </div>
            <div class="space-y-3">
              @for (f of finalidades; track f.clave) {
                <div class="flex flex-wrap items-start justify-between gap-3 border-t border-border/50 pt-3">
                  <div class="min-w-0 flex-1">
                    <label class="text-sm text-foreground" [attr.for]="'f-datos.' + f.clave">{{ f.rotulo }}</label>
                    @if (f.obligatoria) { <span class="block text-[11px] text-muted-foreground">Sin esta autorización no se inicia el estudio de la solicitud.</span> }
                    @for (h of hallazgosDe('datos.' + f.clave); track h.regla) {
                      <span class="block text-[11px] text-destructive">{{ h.mensaje }}</span>
                    }
                  </div>
                  <alma-si-no [id]="'f-datos.' + f.clave" [rotulo]="f.rotulo" [valor]="leerRuta('datos.' + f.clave)" (valorChange)="poner('datos.' + f.clave, $event)" />
                </div>
              }
            </div>
          </section>
        </div>

        <!-- Panel de revisión -->
        <aside class="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
          <section class="glass space-y-2 rounded-3xl p-4 shadow-[var(--shadow-sm)]">
            <button type="button" class="alma-btn alma-btn-outline h-9 w-full rounded-xl text-sm" [disabled]="revisando()" (click)="revisar()"><lucide-icon name="shield-check" [size]="15" /> Revisar solicitud</button>
            <button type="button" class="alma-btn alma-btn-primary h-9 w-full rounded-xl text-sm" [disabled]="generando()" (click)="generar(false)">
              <lucide-icon [name]="generando() ? 'loader-2' : 'file-down'" [size]="15" [class.animate-spin]="generando()" /> Generar PDF
            </button>
            <button type="button" class="alma-btn alma-btn-ghost h-8 w-full rounded-xl text-xs" [disabled]="generando()" (click)="generar(true)">Descargar borrador (aunque tenga errores)</button>
            <button type="button" class="alma-btn alma-btn-ghost h-8 w-full rounded-xl text-xs text-destructive" (click)="nueva()"><lucide-icon name="refresh-cw" [size]="13" /> Nueva solicitud</button>
          </section>

          <section class="glass space-y-3 rounded-3xl p-4 shadow-[var(--shadow-sm)]">
            <h2 class="text-sm font-bold text-foreground">Revisión</h2>
            @if (analisis(); as a) {
              <div class="flex gap-2">
                <span class="alma-badge bg-destructive/10 text-destructive">{{ a.resumen.errores }} {{ a.resumen.errores === 1 ? 'error' : 'errores' }}</span>
                <span class="alma-badge bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{{ a.resumen.avisos }} {{ a.resumen.avisos === 1 ? 'aviso' : 'avisos' }}</span>
              </div>
              @if (a.hallazgos.length === 0) {
                <p class="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400"><lucide-icon name="check-circle-2" [size]="16" class="mt-0.5 shrink-0" /> Sin errores ni avisos: listo para imprimir.</p>
              } @else {
                <ul class="max-h-[40vh] space-y-1 overflow-y-auto pr-1">
                  @for (h of a.hallazgos; track h.regla + h.campo) {
                    <li>
                      <button type="button" class="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent/60" (click)="irA(h.campo)">
                        <span class="flex items-start gap-1.5">
                          <lucide-icon [name]="h.gravedad === 'error' ? 'x-circle' : 'alert-triangle'" [size]="13" class="mt-0.5 shrink-0" [class]="h.gravedad === 'error' ? 'text-destructive' : 'text-amber-600'" />
                          <span class="min-w-0">
                            <span class="block text-foreground">{{ h.mensaje }}</span>
                            @if (h.por_confirmar) { <span class="block text-[10px] text-muted-foreground">Regla por confirmar con Servicio al Cliente</span> }
                          </span>
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              }
              @if (revisando()) { <p class="text-[11px] text-muted-foreground">Actualizando…</p> }
            } @else {
              <p class="text-xs text-muted-foreground">Cuando termines de diligenciar, pulsa «Revisar solicitud». Desde ahí la revisión se actualiza sola mientras editas.</p>
            }
            @if (c.reglas_en_borrador) {
              <p class="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground"><lucide-icon name="info" [size]="13" class="mt-0.5 shrink-0" /> Las reglas de validación están en borrador: Servicio al Cliente las está revisando. Las marcadas «por confirmar» pueden cambiar.</p>
            }
          </section>

          <section class="glass space-y-2 rounded-3xl p-4 shadow-[var(--shadow-sm)]">
            <h2 class="text-sm font-bold text-foreground">Antes de entregar</h2>
            <ul class="space-y-1.5">
              @for (r of c.recordatorios; track r) {
                <li class="flex items-start gap-2 text-xs text-foreground"><lucide-icon name="clipboard-list" [size]="13" class="mt-0.5 shrink-0 text-muted-foreground" /> {{ r }}</li>
              }
            </ul>
          </section>
        </aside>
      </div>
    }
  `,
})
export class SolicitudFormComponent {
  private readonly api = inject(PrestacionesApi);
  private readonly toast = inject(ToastService);

  protected readonly defsAfiliado = AFILIADO;
  protected readonly defsContacto = CONTACTO;
  protected readonly defsBeneficiario = BENEFICIARIO;
  protected readonly prestaciones = PRESTACIONES;
  protected readonly finalidades = FINALIDADES;
  protected readonly defCiudad: CampoDef = { clave: 'ciudad', rotulo: 'Ciudad de la solicitud', tipo: 'texto', max: 80 };
  protected readonly defFecha: CampoDef = { clave: 'fecha_solicitud', rotulo: 'Fecha de la solicitud', tipo: 'fecha' };
  protected readonly defPais: CampoDef = { clave: 'convenios.pais', rotulo: 'País de las cotizaciones', tipo: 'texto', max: 60 };
  protected readonly defSemanas: CampoDef = { clave: 'semanas', rotulo: 'Total de semanas', tipo: 'numero', paso: '0.01', ayuda: 'Puede llevar hasta 2 decimales.' };

  /** Preguntas que responde el cliente (clave completa en `datos`). */
  protected readonly preguntas = [
    { ruta: 'beps.a_asesoria', rotulo: 'BEPS A — Recibió asesoría especializada sobre el programa BEPS (Decreto 0604 de 2013) y comprendió la información.', ayuda: 'Obligatorio en devolución de saldos por vejez.' },
    { ruta: 'beps.b_accede', rotulo: 'BEPS B — Con esa información, ¿accede a BEPS?', ayuda: 'Sí = accede a BEPS · No = no accede. Obligatorio en devolución de saldos por vejez.' },
    { ruta: 'beps.c_cotizo', rotulo: 'BEPS C — ¿Ha realizado cotizaciones al programa BEPS?', ayuda: 'El formato indica que C y D aplican solo a Garantía de Pensión Mínima; por confirmar con Servicio al Cliente.' },
    { ruta: 'beps.d_autoriza_traslado', rotulo: 'BEPS D — Si la respuesta a C es Sí: traslado de los recursos BEPS.', ayuda: 'Por confirmar con Servicio al Cliente.' },
    { ruta: 'gpm.asesorado', rotulo: 'Certifica que fue asesorado de la Garantía de Pensión Mínima (art. 65 de la Ley 100 de 1993) antes de decidir la devolución de saldos.' },
    { ruta: 'gpm.pension_familiar', rotulo: 'Pensión familiar (Ley 1580 de 2012): decidió…', opciones: 'gpm.pension_familiar' },
    { ruta: 'convenios.cotizo_otros_paises', rotulo: '¿Ha realizado cotizaciones de pensión en otros países?' },
    { ruta: 'convenios.accede_multilateral', rotulo: '¿Accede al convenio multilateral iberoamericano de seguridad social?' },
  ];

  protected readonly cat = signal<Catalogos | null>(null);
  protected readonly cargandoCatalogos = signal(true);
  protected readonly errorCatalogos = signal<string | null>(null);

  protected readonly datos = signal<Datos>(solicitudInicial());
  protected readonly sugeridos = signal<ReadonlySet<string>>(new Set());
  protected readonly consulta = signal<Consulta | null>(null);
  protected readonly buscando = signal(false);
  private ultimoDocumento = '';

  protected readonly analisis = signal<Analisis | null>(null);
  protected readonly revisando = signal(false);
  protected readonly generando = signal(false);
  private readonly revisado = signal(false);
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private secuencia = 0;

  protected readonly beneficiarios = computed(() => (this.datos()['beneficiarios'] as Datos[] | undefined) ?? []);
  protected readonly tiposDocBeneficiario = computed(() => this.cat()?.tipos_documento_beneficiario ?? []);
  protected readonly estadoBono = computed(() => (leer(this.datos(), 'bono.estado_fenix') as string | undefined) ?? null);
  protected readonly semanasCorte = computed(() => {
    const iso = this.consulta()?.prellenado.semanas_corte;
    return iso ? iso.slice(0, 10).split('-').reverse().join('/') : null;
  });
  protected readonly consultable = computed(() => {
    const tipo = String(leer(this.datos(), 'afiliado.tipo_documento') ?? '');
    return !!this.cat()?.tipos_consultables.includes(tipo);
  });
  protected readonly puedeBuscar = computed(
    () => this.consultable() && /^[0-9A-Za-z-]{4,20}$/.test(String(leer(this.datos(), 'afiliado.numero_documento') ?? '').trim()),
  );

  /** Hallazgos por campo, para pintarlos junto a cada casilla. */
  private readonly porCampo = computed(() => {
    const mapa = new Map<string, Hallazgo[]>();
    for (const h of this.analisis()?.hallazgos ?? []) mapa.set(h.campo, [...(mapa.get(h.campo) ?? []), h]);
    return mapa;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.temporizador && clearTimeout(this.temporizador));
    void this.cargarCatalogos();
    // Una vez revisada la solicitud, la revisión sigue al formulario (con una pausa para no consultar en cada tecla).
    effect(() => {
      const d = this.datos();
      if (!this.revisado()) return;
      if (this.temporizador) clearTimeout(this.temporizador);
      this.temporizador = setTimeout(() => void this.validar(d), REFRESCO_MS);
    });
  }

  protected async cargarCatalogos(): Promise<void> {
    this.cargandoCatalogos.set(true);
    this.errorCatalogos.set(null);
    try {
      this.cat.set(await this.api.catalogos());
    } catch (e) {
      this.errorCatalogos.set(e instanceof Error ? e.message : 'No se pudo preparar el formulario.');
    } finally {
      this.cargandoCatalogos.set(false);
    }
  }

  // ── Acceso a los datos ──────────────────────────────────────────────────────

  protected leerRuta(ruta: string): any {
    return leer(this.datos(), ruta);
  }

  protected texto(ruta: string): string {
    const v = leer(this.datos(), ruta);
    return v === null || v === undefined ? '' : String(v);
  }

  protected poner(ruta: string, valor: unknown): void {
    this.datos.update((d) => {
      let nuevo = escribir(d, ruta, valor);
      // Sin cotizaciones en otros países no hay país ni convenio multilateral que responder: se limpian
      // para que no queden respuestas viejas que el formato leería como contradicción.
      if (ruta === 'convenios.cotizo_otros_paises' && valor !== true) {
        nuevo = escribir(escribir(nuevo, 'convenios.pais', undefined), 'convenios.accede_multilateral', undefined);
      }
      return nuevo;
    });
    this.confirmar(ruta);
  }

  protected esSugerido(ruta: string): boolean {
    return this.sugeridos().has(ruta);
  }

  protected confirmar(ruta: string): void {
    if (!this.sugeridos().has(ruta)) return;
    const s = new Set(this.sugeridos());
    s.delete(ruta);
    this.sugeridos.set(s);
  }

  protected opciones(catalogo: string | undefined): Opcion[] {
    return (catalogo && this.cat()?.opciones[catalogo]) || [];
  }

  protected defsPrestacion(clave: string): CampoDef[] {
    return [
      { clave: `${clave}.entidad`, rotulo: 'Entidad', tipo: 'lista', catalogo: `afiliado.${clave}.entidad` },
      { clave: `${clave}.tipo`, rotulo: 'Tipo', tipo: 'lista', catalogo: `afiliado.${clave}.tipo` },
      { clave: `${clave}.origen`, rotulo: 'Origen', tipo: 'lista', catalogo: `afiliado.${clave}.origen` },
    ];
  }

  protected edadDe(ruta: string): number | null {
    if (!ruta.endsWith('fecha_nacimiento')) return null;
    return edadEn(leer(this.datos(), ruta), leer(this.datos(), 'fecha_solicitud'));
  }

  protected hallazgosDe(ruta: string): Hallazgo[] {
    return this.porCampo().get(ruta) ?? [];
  }

  protected hayError(hs: Hallazgo[]): boolean {
    return hs.some((h) => h.gravedad === 'error');
  }

  protected responsableMarcado(valor: string): boolean {
    return ((leer(this.datos(), 'datos.responsables') as string[] | undefined) ?? []).includes(valor);
  }

  protected alternarResponsable(valor: string, marcado: boolean): void {
    const actuales = ((leer(this.datos(), 'datos.responsables') as string[] | undefined) ?? []).filter((v) => v !== valor);
    this.poner('datos.responsables', marcado ? [...actuales, valor] : actuales);
  }

  protected agregarBeneficiario(): void {
    this.datos.update((d) => escribir(d, 'beneficiarios', [...this.beneficiarios(), beneficiarioVacio()]));
  }

  protected quitarBeneficiario(i: number): void {
    this.datos.update((d) => escribir(d, 'beneficiarios', this.beneficiarios().filter((_, j) => j !== i)));
  }

  // ── Búsqueda por documento ──────────────────────────────────────────────────

  protected origenes(q: Consulta): Array<{ nombre: string; texto: string; icono: string; clase: string }> {
    const ver = (nombre: string, o: EstadoOrigen, encontrado: string) => {
      if (o.estado === 'ok') return { nombre, texto: encontrado, icono: 'check-circle-2', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' };
      if (o.estado === 'no_encontrado') return { nombre, texto: 'no encontrado: digítalo', icono: 'info', clase: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300' };
      return { nombre, texto: 'no disponible por ahora', icono: 'alert-triangle', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' };
    };
    return [
      ver('Datos personales', q.origenes.persona, 'encontrados'),
      ver('Bono pensional', q.origenes.bono, 'encontrado'),
      ver('Semanas', q.origenes.semanas, 'encontradas'),
    ];
  }

  protected async buscar(): Promise<void> {
    if (!this.puedeBuscar() || this.buscando()) return;
    const tipo = String(leer(this.datos(), 'afiliado.tipo_documento'));
    const numero = String(leer(this.datos(), 'afiliado.numero_documento')).trim();
    this.buscando.set(true);
    try {
      const q = await this.api.consultar(tipo, numero);
      // Otra persona: lo que había de la anterior no debe quedar mezclado con la nueva.
      const clave = `${tipo}:${numero}`;
      if (this.ultimoDocumento && this.ultimoDocumento !== clave) this.reiniciar(tipo, numero);
      this.ultimoDocumento = clave;
      this.consulta.set(q);
      this.aplicar(q);
    } catch (e) {
      this.toast.error('No se pudo consultar', e instanceof Error ? e.message : String(e));
    } finally {
      this.buscando.set(false);
    }
  }

  /** Pone lo sugerido en los campos vacíos (o que siguen siendo sugerencias) y los marca como «Sugerido». */
  private aplicar(q: Consulta): void {
    let d = this.datos();
    const marcados = new Set(this.sugeridos());
    const sugerir = (ruta: string, valor: unknown) => {
      const actual = leer(d, ruta);
      if (actual === undefined || actual === null || actual === '' || marcados.has(ruta)) {
        d = escribir(d, ruta, valor);
        marcados.add(ruta);
      }
    };
    for (const [k, v] of Object.entries(q.prellenado.afiliado)) {
      if (k !== 'tipo_documento' && k !== 'numero_documento') sugerir(`afiliado.${k}`, v);
    }
    const bono = q.prellenado.bono;
    if (bono) {
      d = escribir(d, 'bono.estado_fenix', bono.estado_fenix);
      if (bono.sin_derecho) sugerir('bono.sin_derecho', true);
    }
    if (q.prellenado.semanas !== undefined) sugerir('semanas', q.prellenado.semanas);
    this.datos.set(d);
    this.sugeridos.set(marcados);
  }

  // ── Revisión y PDF ──────────────────────────────────────────────────────────

  protected async revisar(): Promise<void> {
    this.revisado.set(true);
    if (this.temporizador) clearTimeout(this.temporizador);
    await this.validar(this.datos());
  }

  private async validar(d: Datos): Promise<void> {
    const turno = ++this.secuencia;
    this.revisando.set(true);
    try {
      const a = await this.api.validar(datosParaEnviar(d));
      if (turno === this.secuencia) this.analisis.set(a);
    } catch (e) {
      if (turno === this.secuencia) this.toast.error('No se pudo revisar la solicitud', e instanceof Error ? e.message : String(e));
    } finally {
      if (turno === this.secuencia) this.revisando.set(false);
    }
  }

  protected async generar(borrador: boolean): Promise<void> {
    this.generando.set(true);
    try {
      const { blob, nombre } = await this.api.pdf(datosParaEnviar(this.datos()), borrador);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
      this.toast.show(borrador ? 'Borrador descargado' : 'PDF listo', 'Imprímelo para la firma y la huella del cliente.');
    } catch (e) {
      if (e instanceof PdfConErrores) {
        this.revisado.set(true);
        this.analisis.set(e.analisis);
        this.toast.error('La solicitud tiene errores', 'Corrígelos para generar el PDF, o descarga un borrador para revisarlo en papel.');
      } else {
        this.toast.error('No se pudo generar el PDF', e instanceof Error ? e.message : String(e));
      }
    } finally {
      this.generando.set(false);
    }
  }

  protected irA(campo: string): void {
    const el = document.getElementById(`f-${campo}`) ?? document.getElementById(`f-${campo.replace(/\.[^.]+$/, '')}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el as HTMLElement | null)?.focus?.({ preventScroll: true });
  }

  protected nueva(): void {
    const hayDatos = this.sugeridos().size > 0 || JSON.stringify(datosParaEnviar(this.datos())) !== JSON.stringify(datosParaEnviar(solicitudInicial()));
    if (hayDatos && !confirm('¿Empezar una solicitud nueva? Se borra lo que hay en pantalla (no se guarda en ningún lado).')) return;
    this.reiniciar('CC', '');
    this.ultimoDocumento = '';
  }

  private reiniciar(tipo: string, numero: string): void {
    this.secuencia++;
    const base = solicitudInicial();
    this.datos.set(escribir(escribir(base, 'afiliado.tipo_documento', tipo), 'afiliado.numero_documento', numero));
    this.sugeridos.set(new Set());
    this.consulta.set(null);
    this.analisis.set(null);
    this.revisado.set(false);
    this.revisando.set(false);
  }
}
