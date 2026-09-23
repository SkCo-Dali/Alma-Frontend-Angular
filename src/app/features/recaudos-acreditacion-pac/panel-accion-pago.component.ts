// Panel lateral de acción sobre un pago: explica qué pasa al confirmar, muestra la
// ruta del archivo y la acción posterior cuando va a Pipeline, el borrador de correo
// editable y el historial. La confirmación la ejecuta la página (emite `confirmar`).

import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CopyButtonComponent } from '../../shared/components/copy-button.component';
import { DatosExtraidosComponent } from './datos-extraidos.component';
import { HistorialPagoComponent } from './historial-pago.component';
import {
  AccionPipeline,
  ConfirmarAccionInput,
  PagoPac,
  RecaudosPacApi,
  borradorCorreo,
  estiloBadge,
  formatoMonto,
} from './recaudos-pac.api';

@Component({
  selector: 'alma-panel-accion-pago',
  imports: [FormsModule, LucideAngularModule, HistorialPagoComponent, CopyButtonComponent, DatosExtraidosComponent],
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
  template: `
    <div class="fixed inset-0 z-50 flex justify-end">
      <div class="absolute inset-0 bg-black/35" (click)="cerrar.emit()"></div>
      <aside
        class="surface-solid relative flex h-dvh w-full flex-col overflow-y-auto border-l border-border shadow-[var(--shadow-lg)] sm:w-[560px] sm:max-w-[92vw]"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="meta().accion"
      >
        <div class="flex flex-col gap-5 p-4 sm:p-6">
          <!-- Encabezado -->
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <span class="alma-badge mb-2 gap-1.5" [style]="badge(meta().color)">
                <span class="h-1.5 w-1.5 rounded-full" [style.background]="meta().color"></span>
                {{ meta().nombre }}
              </span>
              <h3 class="text-xl font-bold text-foreground">{{ meta().accion }}</h3>
              <p class="text-[13px] text-muted-foreground">
                {{ pago().empresa }} · {{ pago().referencia }} · {{ monto(pago().monto) }} · {{ pago().analista }}
              </p>
            </div>
            <button type="button" class="alma-btn alma-btn-ghost" (click)="cerrar.emit()" aria-label="Cerrar">
              <lucide-icon name="x" [size]="18" />
            </button>
          </div>

          <p class="rounded-lg bg-[var(--surface-sunken)] px-4 py-3 text-[13px] leading-relaxed text-foreground">
            {{ meta().descripcion }}
          </p>

          <alma-datos-extraidos [pago]="pago()" />

          <!-- Pipeline: ruta + acción posterior -->
          @if (meta().es_pipeline) {
            <div class="flex flex-col gap-1.5">
              <span class="alma-label">Ruta del archivo</span>
              <div class="flex items-center gap-2 rounded-lg border border-border bg-[var(--surface-sunken)] px-3 py-2">
                <lucide-icon name="file-text" [size]="16" class="shrink-0 text-muted-foreground" />
                <code class="min-w-0 flex-1 break-all text-[13px] text-foreground">{{ rutaArchivo() }}</code>
                <alma-copy-button [value]="rutaArchivo()" label="ruta" />
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <span class="alma-label">Acción posterior a subir</span>
              @for (op of opcionesPipeline; track op.id) {
                <label
                  class="flex cursor-pointer items-center gap-3 rounded-lg border-[1.5px] px-3.5 py-3 transition-colors"
                  [class]="
                    accionPipeline() === op.id
                      ? 'flex cursor-pointer items-center gap-3 rounded-lg border-[1.5px] px-3.5 py-3 transition-colors ' + op.activo
                      : 'flex cursor-pointer items-center gap-3 rounded-lg border-[1.5px] px-3.5 py-3 transition-colors border-border'
                  "
                >
                  <input
                    type="radio"
                    name="accionPipeline"
                    class="h-4 w-4 accent-[var(--primary)]"
                    [checked]="accionPipeline() === op.id"
                    (change)="accionPipeline.set(op.id)"
                  />
                  <span>
                    <span class="block text-sm font-semibold text-foreground">{{ op.titulo }}</span>
                    <span class="text-xs text-muted-foreground">{{ op.texto }}</span>
                  </span>
                </label>
              }
            </div>
          }

          @if (meta().gestion_manual) {
            <div class="flex items-start gap-2.5 rounded-lg border-l-4 border-amber-500 bg-amber-500/10 px-3.5 py-3">
              <lucide-icon name="alert-triangle" [size]="18" class="mt-px shrink-0 text-amber-600 dark:text-amber-400" />
              <p class="text-[13px] leading-relaxed text-foreground">
                Al confirmar, este pago será retirado de tu bandeja y pasará a gestión manual fuera del sistema.
              </p>
            </div>
          }

          <!-- Borrador de correo -->
          @if (borrador(); as b) {
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <lucide-icon name="mail" [size]="16" class="text-muted-foreground" />
                <span class="text-[13px] font-semibold text-foreground">Borrador de correo</span>
                <span class="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Editable</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="alma-label">Para</span>
                <div class="rounded-lg bg-[var(--surface-sunken)] px-3.5 py-2.5 text-sm text-foreground">{{ b.para }}</div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="alma-label" for="pac-asunto">Asunto</label>
                <input id="pac-asunto" class="alma-input" [ngModel]="asunto()" (ngModelChange)="asunto.set($event)" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="alma-label" for="pac-cuerpo">Cuerpo del correo</label>
                <textarea
                  id="pac-cuerpo"
                  class="alma-input min-h-[180px] resize-y py-2.5 leading-relaxed"
                  [ngModel]="cuerpo()"
                  (ngModelChange)="cuerpo.set($event)"
                ></textarea>
              </div>
              @if (tienePendientes()) {
                <p class="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <lucide-icon name="info" [size]="13" />
                  Reemplaza los textos entre corchetes antes de enviar.
                </p>
              }
            </div>
          }

          <!-- Acciones (un estado sin configurar no tiene: solo se puede cerrar) -->
          <div class="flex gap-2.5">
            @if (!meta().desconocido) {
            <button
              type="button"
              class="alma-btn alma-btn-primary h-11 flex-1 rounded-full"
              [disabled]="!puedeConfirmar() || enviando()"
              (click)="onConfirmar()"
            >
              @if (enviando()) {
                <lucide-icon name="loader-2" [size]="16" class="animate-spin" />
              }
              {{ etiquetaConfirmar() }}
            </button>
            }
            <button
              type="button"
              class="alma-btn alma-btn-outline h-11 rounded-full px-6"
              [class.flex-1]="meta().desconocido"
              (click)="cerrar.emit()"
            >
              {{ meta().desconocido ? 'Cerrar' : 'Cancelar' }}
            </button>
          </div>
        </div>

        <div class="border-t border-border px-4 py-5 sm:px-6">
          <alma-historial-pago [historial]="pago().historial" />
        </div>
      </aside>
    </div>
  `,
})
export class PanelAccionPagoComponent {
  readonly pago = input.required<PagoPac>();
  /** Lo pone la página mientras la confirmación está en curso. */
  readonly enviando = input(false);
  readonly cerrar = output<void>();
  readonly confirmar = output<ConfirmarAccionInput>();

  protected readonly monto = formatoMonto;
  protected readonly opcionesPipeline: {
    id: AccionPipeline;
    titulo: string;
    texto: string;
    activo: string;
  }[] = [
    {
      id: 'verificar',
      titulo: 'Verificar acreditación',
      texto: 'Confirma y envía correo de acreditación a la empresa',
      activo: 'border-emerald-500 bg-emerald-500/5',
    },
    {
      id: 'notificar',
      titulo: 'Notificar fallidos',
      texto: 'Envía notificación de fallo a la empresa',
      activo: 'border-amber-500 bg-amber-500/10',
    },
  ];

  private readonly api = inject(RecaudosPacApi);

  protected readonly badge = estiloBadge;
  protected readonly meta = computed(() => this.api.meta(this.pago().estado));
  protected readonly accionPipeline = signal<AccionPipeline>('verificar');
  protected readonly borrador = computed(() =>
    borradorCorreo(this.pago(), this.meta(), this.accionPipeline()),
  );

  // linkedSignal: el analista edita libremente, pero si cambia la acción de Pipeline
  // el borrador se regenera (el correo de acreditación y el de fallo son distintos).
  protected readonly asunto = linkedSignal(() => this.borrador()?.asunto ?? '');
  protected readonly cuerpo = linkedSignal(() => this.borrador()?.cuerpo ?? '');

  protected readonly rutaArchivo = computed(
    () => this.pago().ruta_archivo ?? `//skandia-fs/pac/${this.pago().referencia}.xlsx`,
  );

  // Los borradores traen marcadores "[Especificar …]" que no deben llegar a la empresa.
  protected readonly tienePendientes = computed(
    () => !!this.borrador() && /\[Especificar[^\]]*\]/.test(this.cuerpo()),
  );

  protected readonly puedeConfirmar = computed(() => {
    if (!this.borrador()) return true;
    return !!this.asunto().trim() && !!this.cuerpo().trim() && !this.tienePendientes();
  });

  protected readonly etiquetaConfirmar = computed(() => {
    const m = this.meta();
    if (m.es_pipeline) return `Subir y ${this.accionPipeline() === 'verificar' ? 'verificar' : 'notificar'}`;
    if (m.gestion_manual) return 'Confirmar y retirar';
    if (m.plantilla_correo) return 'Confirmar y enviar';
    return 'Confirmar';
  });

  protected onConfirmar(): void {
    const b = this.borrador();
    this.confirmar.emit({
      accion_pipeline: this.meta().es_pipeline ? this.accionPipeline() : undefined,
      correo: b ? { para: b.para, asunto: this.asunto().trim(), cuerpo: this.cuerpo() } : null,
    });
  }
}
