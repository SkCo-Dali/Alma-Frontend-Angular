// Diálogo para crear o editar un estado del catálogo, con vista previa en vivo de la
// tarjeta y el badge. Emite el estado listo para guardar; la página llama al servicio.
//
// El formulario es un objeto plano con ngModel, así que la validez y la vista previa
// son MÉTODOS y no computed: en zoneless un computed no se entera de mutaciones de un
// objeto plano y se quedaría cacheado (ya pasó en Alma con un botón deshabilitado).

import { Component, OnInit, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { EstadoMeta, PATRON_CODIGO, PlantillaCorreo, estiloBadge } from './recaudos-pac.api';

/** Valor del <select> de transición: un código o este marcador para "sale de la bandeja". */
const CIERRA = '__cierra__';

@Component({
  selector: 'alma-estado-editor',
  imports: [FormsModule, LucideAngularModule],
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="cerrar.emit()">
      <div
        class="surface-solid flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border shadow-[var(--shadow-lg)]"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="esNuevo() ? 'Nuevo estado' : 'Editar estado'"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 class="text-sm font-semibold text-foreground">
            {{ esNuevo() ? 'Nuevo estado' : 'Editar estado · ' + form.corto }}
          </h2>
          <button type="button" class="alma-btn alma-btn-ghost" (click)="cerrar.emit()" aria-label="Cerrar">
            <lucide-icon name="x" [size]="16" />
          </button>
        </div>

        <div class="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_220px]">
          <!-- Formulario -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="est-codigo">Código *</label>
              <input
                id="est-codigo"
                class="alma-input font-mono"
                [(ngModel)]="form.codigo"
                [disabled]="!esNuevo()"
                placeholder="en_validacion"
              />
              <span class="text-[11px] text-muted-foreground">
                {{ esNuevo() ? 'El que llega en el pago. No se puede cambiar después.' : 'No se puede cambiar: lo usan los pagos.' }}
              </span>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="est-color">Color *</label>
              <div class="flex items-center gap-2">
                <input id="est-color" type="color" class="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1" [(ngModel)]="form.color" />
                <input class="alma-input font-mono uppercase" [(ngModel)]="form.color" aria-label="Color en hexadecimal" maxlength="7" />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="est-nombre">Nombre *</label>
              <input id="est-nombre" class="alma-input" [(ngModel)]="form.nombre" placeholder="Dinero referenciado en suspense" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="est-corto">Nombre corto (tarjeta) *</label>
              <input id="est-corto" class="alma-input" [(ngModel)]="form.corto" maxlength="18" placeholder="Referenciado" />
              <span class="text-[11px] text-muted-foreground">{{ form.corto.length }}/18 · cabe en la tarjeta</span>
            </div>
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label class="alma-label" for="est-accion">Texto del botón de acción *</label>
              <input id="est-accion" class="alma-input" [(ngModel)]="form.accion" maxlength="28" placeholder="Verificar acreditación" />
            </div>
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label class="alma-label" for="est-desc">Descripción (se muestra en el panel de acción)</label>
              <textarea id="est-desc" class="alma-input min-h-[72px] resize-y py-2" [(ngModel)]="form.descripcion"></textarea>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="est-plantilla">Correo a la empresa</label>
              <select id="est-plantilla" class="alma-input" [(ngModel)]="plantilla">
                <option value="">Ninguno</option>
                <option value="acreditacion">Confirmación de acreditación</option>
                <option value="solicitud_info">Solicitud de información</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="alma-label" for="est-siguiente">Al confirmar, el pago…</label>
              <select id="est-siguiente" class="alma-input" [(ngModel)]="alConfirmar">
                <option [value]="cierra">Sale de la bandeja (caso cerrado)</option>
                @for (e of destinos(); track e.codigo) {
                  <option [value]="e.codigo">Pasa a «{{ e.corto }}»{{ e.codigo === form.codigo ? ' (se queda)' : '' }}</option>
                }
              </select>
            </div>

            <label class="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 sm:col-span-2">
              <input type="checkbox" class="mt-0.5 h-4 w-4 accent-[var(--primary)]" [(ngModel)]="form.es_pipeline" />
              <span>
                <span class="block text-sm font-medium text-foreground">Va a Pipeline</span>
                <span class="text-xs text-muted-foreground">Muestra la ruta del archivo y la opción de verificar o notificar fallidos.</span>
              </span>
            </label>
            @if (form.es_pipeline) {
              <div class="flex flex-col gap-1.5 sm:col-span-2">
                <label class="alma-label" for="est-notificar">Si se notifican fallidos, el pago…</label>
                <select id="est-notificar" class="alma-input" [(ngModel)]="alNotificar">
                  <option [value]="cierra">Sale de la bandeja</option>
                  @for (e of destinos(); track e.codigo) {
                    <option [value]="e.codigo">Pasa a «{{ e.corto }}»</option>
                  }
                </select>
              </div>
            }
            <label class="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 sm:col-span-2">
              <input type="checkbox" class="mt-0.5 h-4 w-4 accent-[var(--primary)]" [(ngModel)]="form.gestion_manual" />
              <span>
                <span class="block text-sm font-medium text-foreground">Gestión manual</span>
                <span class="text-xs text-muted-foreground">Avisa que, al confirmar, el caso pasa a gestionarse fuera del sistema.</span>
              </span>
            </label>
          </div>

          <!-- Vista previa -->
          <div class="flex flex-col gap-3">
            <span class="alma-label">Vista previa</span>
            <div class="glass flex flex-col gap-2 rounded-xl border-2 border-transparent px-4 py-3 shadow-[var(--shadow-sm)]">
              <span class="flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap text-muted-foreground">
                <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="colorValido() ? form.color : '#8E8E93'"></span>
                {{ form.corto || 'Nombre corto' }}
              </span>
              <span class="text-2xl font-bold tabular-nums text-foreground">3</span>
            </div>
            <span class="alma-badge w-fit gap-1.5" [style]="badge(colorValido() ? form.color : '#8E8E93')">
              <span class="h-1.5 w-1.5 rounded-full" [style.background]="colorValido() ? form.color : '#8E8E93'"></span>
              {{ form.corto || 'Nombre corto' }}
            </span>
            <span class="alma-btn alma-btn-outline h-8 w-fit rounded-full border-primary px-4 text-xs text-primary">
              {{ form.accion || 'Texto del botón' }}
            </span>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          @if (errores().length) {
            <p class="mr-auto text-xs text-destructive">{{ errores()[0] }}</p>
          }
          <button type="button" class="alma-btn alma-btn-outline" (click)="cerrar.emit()">Cancelar</button>
          <button type="button" class="alma-btn alma-btn-primary" [disabled]="errores().length > 0 || guardando()" (click)="onGuardar()">
            @if (guardando()) {
              <lucide-icon name="loader-2" [size]="16" class="animate-spin" />
            } @else {
              <lucide-icon name="save" [size]="16" />
            }
            Guardar
          </button>
        </div>
      </div>
    </div>
  `,
})
export class EstadoEditorComponent implements OnInit {
  /** Estado a editar; si es null se crea uno nuevo. */
  readonly estado = input<EstadoMeta | null>(null);
  /** Código sugerido al crear (p. ej. al configurar un estado que llegó sin catálogo). */
  readonly codigoSugerido = input('');
  /** Catálogo actual, para las transiciones y validar códigos repetidos. */
  readonly catalogo = input.required<EstadoMeta[]>();
  readonly guardando = input(false);
  readonly guardar = output<EstadoMeta>();
  readonly cerrar = output<void>();

  protected readonly cierra = CIERRA;
  protected readonly badge = estiloBadge;

  protected form!: EstadoMeta;
  // Los <select> trabajan con texto: se traducen a null/código al guardar.
  protected plantilla = '';
  protected alConfirmar = CIERRA;
  protected alNotificar = CIERRA;

  ngOnInit(): void {
    const e = this.estado();
    this.form = e
      ? structuredClone(e)
      : {
          codigo: this.codigoSugerido(),
          orden: 0,
          nombre: '',
          corto: '',
          accion: '',
          descripcion: '',
          color: '#6D4AE0',
          plantilla_correo: null,
          es_pipeline: false,
          al_confirmar: null,
          gestion_manual: false,
          activo: true,
        };
    this.plantilla = this.form.plantilla_correo ?? '';
    this.alConfirmar = this.form.al_confirmar ?? CIERRA;
    this.alNotificar = this.form.al_notificar ?? CIERRA;
  }

  protected esNuevo(): boolean {
    return this.estado() === null;
  }

  /** Destinos posibles de una transición: estados activos (y el propio, para "se queda"). */
  protected destinos(): EstadoMeta[] {
    const propio = this.form?.codigo;
    return this.catalogo().filter((e) => e.activo || e.codigo === propio);
  }

  protected colorValido(): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(this.form.color);
  }

  protected errores(): string[] {
    const f = this.form;
    const errs: string[] = [];
    if (this.esNuevo()) {
      if (!PATRON_CODIGO.test(f.codigo)) errs.push('Código: solo minúsculas, números y guion bajo (ej. en_validacion).');
      else if (this.catalogo().some((e) => e.codigo === f.codigo)) errs.push(`Ya existe un estado con el código "${f.codigo}".`);
    }
    if (!f.nombre.trim()) errs.push('Falta el nombre.');
    if (!f.corto.trim()) errs.push('Falta el nombre corto.');
    if (!f.accion.trim()) errs.push('Falta el texto del botón.');
    if (!this.colorValido()) errs.push('El color debe ser un hexadecimal como #6D4AE0.');
    return errs;
  }

  protected onGuardar(): void {
    this.guardar.emit({
      ...this.form,
      nombre: this.form.nombre.trim(),
      corto: this.form.corto.trim(),
      accion: this.form.accion.trim(),
      descripcion: this.form.descripcion.trim(),
      color: this.form.color.toUpperCase(),
      plantilla_correo: (this.plantilla || null) as PlantillaCorreo | null,
      al_confirmar: this.alConfirmar === CIERRA ? null : this.alConfirmar,
      al_notificar: this.form.es_pipeline
        ? this.alNotificar === CIERRA
          ? null
          : this.alNotificar
        : undefined,
    });
  }
}
