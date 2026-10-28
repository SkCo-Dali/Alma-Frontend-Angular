// Paso 5 «Exportación» del asistente «Nuevo buzón» — réplica de `mNuevoBuzon`
// (m.step === 5) y de sus subvistas `nbSub` 'tb' (constructor de la plantilla de
// una salida) y 'ref' (ejemplo de referencia) del prototipo validado.
// En Alma el asistente trabaja sobre un buzón real en configuración: la respuesta
// Sí/No es `mod_exportacion`, la entrega son campos del buzón y las salidas y
// plantillas se guardan con la misma API que la pestaña (ExportacionEstado).
//
// Con una subvista abierta (`subvista()` ≠ null) el componente pinta SOLO la
// subvista, como el prototipo (el modal muestra nbSub sin encabezado, pasos ni
// pie): el asistente debe ocultar su encabezado y su pie mientras tanto.

import { Component, DestroyRef, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { Buzon, BuzonApi, BuzonUpdate, Categoria } from './buzon.api';
import { extrae, referenciaPac, salidasFaltan, tplVacia } from './buzon-exportacion';
import { ExportacionEstado } from './exportacion-estado';
import { entregaDe } from './exportacion-tab.component';
import { HojaVistaComponent, PlantillaBuilderComponent } from './plantilla-builder.component';
import { SalidasProcesoComponent } from './salidas-proceso.component';

/** Lo que el asistente necesita para su pie («Siguiente» y el estado del paso). */
export interface EstadoPasoExportacion {
  puedeSeguir: boolean;
  /** Por qué no puede seguir ('' si puede). */
  porque: string;
  /** true = «No» (paso omitido) · false = «Sí» · null = sin responder. */
  omitido: boolean | null;
}

export type SubvistaExportacion = 'tb' | 'ref' | null;

@Component({
  selector: 'alma-exportacion-wizard',
  imports: [LucideAngularModule, AlmaLoaderComponent, SalidasProcesoComponent, PlantillaBuilderComponent, HojaVistaComponent],
  styleUrls: ['./buzon-proto.css'],
  styles: [':host { display: grid; gap: 16px; }'],
  template: `
    @let rev = est.version();
    @if (subvista() === 'tb' && tbSalida(); as x) {
      <div class="row between" [attr.data-rev]="rev">
        <button type="button" class="btn outline sm" title="Volver a exportación" (click)="abrir(null)"><lucide-icon name="arrow-left" [size]="13" /> Volver</button>
        <button type="button" class="btn ghost" aria-label="Cerrar" (click)="cerrar.emit()"><lucide-icon name="x" [size]="16" /></button>
      </div>
      <h3 class="sm b">Plantilla específica · {{ x.pu.p.clave }} · «{{ x.s.nombre }}»</h3>
      <alma-plantilla-builder
        [tpl]="x.s.tpl!"
        [campos]="x.pu.campos"
        [listas]="x.pu.listas"
        [bases]="est.bases()"
        [proceso]="x.pu.p.clave"
        (cambiado)="est.tocarTpl(x.pu, x.s.tpl!)"
        (verRef)="abrir('ref')"
      />
    } @else if (subvista() === 'ref') {
      <div class="row between">
        <button type="button" class="btn outline sm" title="Volver a la plantilla" (click)="abrir('tb')"><lucide-icon name="arrow-left" [size]="13" /> Volver</button>
        <button type="button" class="btn ghost" aria-label="Cerrar" (click)="cerrar.emit()"><lucide-icon name="x" [size]="16" /></button>
      </div>
      <h3 class="sm b">Ejemplo de referencia · Cargue PAC (solo lectura)</h3>
      <p class="xs muted">Así se ve una plantilla con encabezado, detalle por afiliado y cálculos. Úsala como guía para la tuya.</p>
      <alma-hoja-vista [hoja]="referencia" />
    } @else {
      <p class="sm">¿Necesitas un archivo con la información de los correos?</p>
      <div class="g2">
        <button type="button" class="optcard" [attr.aria-pressed]="exp() === true" (click)="responder(true)">
          <span class="row sm b"><lucide-icon name="check" [size]="13" /> Sí, exportar</span>
          <span class="xs muted">Por proceso: tabla según el JSON o tu propia plantilla.</span>
        </button>
        <button type="button" class="optcard" [attr.aria-pressed]="exp() === false" (click)="responder(false)">
          <span class="row sm b"><lucide-icon name="skip-forward" [size]="13" /> No</span>
          <span class="xs muted">Se activa después si se necesita.</span>
        </button>
      </div>
      @if (exp()) {
        @let E = entrega();
        <div class="g3">
          <div class="fld">
            <label class="label" for="nb-fmt">Extensión de la tabla según el JSON</label>
            <select class="input" id="nb-fmt" (change)="guardarEntrega({ tabla_formato: $any(val($event)) })">
              @for (o of formatos; track o[0]) {
                <option [value]="o[0]" [selected]="E.tabla_formato === o[0]">{{ o[1] }}</option>
              }
            </select>
          </div>
          <div class="fld">
            <label class="label" for="nb-sep">Separador</label>
            <select class="input" id="nb-sep" [disabled]="E.tabla_formato === 'xlsx'" (change)="guardarEntrega({ tabla_separador: $any(val($event)) })">
              @for (s of separadores; track s) {
                <option [value]="s" [selected]="E.tabla_separador === s">{{ s }}</option>
              }
            </select>
          </div>
          <div class="fld">
            <span class="label">Entrega</span>
            <label class="row xs" for="nb-eh"><input type="checkbox" id="nb-eh" [checked]="E.borrador_en_hilo" (change)="guardarEntrega({ borrador_en_hilo: chk($event) })" /> Borrador en el hilo</label>
            <label class="row xs" for="nb-ea"><input type="checkbox" id="nb-ea" [checked]="E.descarga_en_alma" (change)="guardarEntrega({ descarga_en_alma: chk($event) })" /> Descarga en Alma</label>
          </div>
        </div>
        @if (est.cargando()) {
          <div class="empty"><alma-loader [size]="48" label="Cargando procesos…" /></div>
        } @else if (est.error(); as e) {
          <p class="err">No se pudo cargar la exportación: {{ e }}</p>
        } @else {
          <div class="stack" style="gap:8px" [attr.data-rev]="rev">
            <p class="xs b">Archivos por proceso · cada salida puede aplicar a todas las etiquetas o solo a algunas</p>
            @for (pu of est.procesos(); track pu.p.id) {
              <div class="sunk r-xl stack" style="padding:10px 12px;gap:8px">
                <p class="sm b">
                  {{ pu.p.clave }}
                  @if (!extrae(pu.p)) {
                    <span class="badge b-sky">Solo categorización</span>
                  }
                </p>
                <alma-salidas-proceso [proceso]="pu" [estado]="est" contexto="wiz" (disenar)="disenar(pu.p.id, $event)" />
              </div>
            }
          </div>
        }
      }
    }
  `,
})
export class ExportacionWizardComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  /** El buzón que se está creando (en configuración). */
  readonly buzon = input.required<Buzon>();
  readonly categorias = input<Categoria[]>([]);
  /** El buzón cambió (mod_exportacion o la entrega): el asistente lo reemplaza. */
  readonly buzonActualizado = output<Buzon>();
  /** Se abrió o cerró una subvista (constructor / referencia): el asistente oculta o muestra su encabezado y pie. */
  readonly subvistaChange = output<SubvistaExportacion>();
  /** La X de una subvista (cerrar el asistente, como el prototipo). */
  readonly cerrar = output<void>();

  protected readonly est = new ExportacionEstado(this.api, this.toast);
  protected readonly extrae = extrae;
  protected readonly referencia = referenciaPac('val');
  protected readonly formatos = [
    ['xlsx', 'Excel (.xlsx)'],
    ['csv', 'CSV (.csv)'],
    ['txt', 'Texto (.txt)'],
  ] as const;
  protected readonly separadores = [';', ',', '|'] as const;

  /** Respuesta Sí/No: un buzón nuevo empieza sin responder (mod_exportacion false = aún no). */
  protected readonly exp = linkedSignal<boolean, boolean | null>({
    source: () => !!this.buzon().mod_exportacion,
    // Lo respondido en este asistente se conserva aunque el buzón se recargue.
    computation: (mod, prev) => (mod ? true : prev?.value === false ? false : null),
  });
  protected readonly entrega = linkedSignal(() => entregaDe(this.buzon()));
  readonly subvista = signal<SubvistaExportacion>(null);
  private readonly tb = signal<{ procesoId: string; i: number } | null>(null);
  private cargado = false;

  protected readonly tbSalida = computed(() => {
    this.est.version();
    const t = this.tb();
    const pu = this.est.procesos().find((x) => x.p.id === t?.procesoId);
    const s = pu?.salidas[t?.i ?? -1];
    return pu && s?.tpl ? { pu, s } : null;
  });

  /** Lo que falta para seguir (nbExpFaltan). */
  readonly faltan = computed(() => {
    this.est.version();
    return this.est.procesos().flatMap((pu) => salidasFaltan(pu.p, pu.salidas));
  });

  /** Estado del paso para el pie del asistente. */
  readonly estado = computed<EstadoPasoExportacion>(() => {
    const exp = this.exp();
    const faltan = this.faltan();
    const cargando = exp === true && (this.est.cargando() || !!this.est.error());
    const puedeSeguir = exp === false || (exp === true && !cargando && !faltan.length);
    return {
      puedeSeguir,
      porque: puedeSeguir ? '' : exp === null ? 'Elige una opción' : cargando ? 'Cargando los procesos…' : `Completa la plantilla de: ${faltan.join(', ')}`,
      omitido: exp === null ? null : !exp,
    };
  });

  constructor() {
    queueMicrotask(() => {
      if (this.exp()) void this.cargar();
    });
    inject(DestroyRef).onDestroy(() => this.est.flush());
  }

  private cargar(): Promise<void> {
    this.cargado = true;
    // El asistente propone la «Tabla según el JSON» por proceso (y la guarda).
    return this.est.cargar(this.buzon().id, 'tabla');
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected chk(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected abrir(v: SubvistaExportacion): void {
    this.subvista.set(v);
    this.subvistaChange.emit(v);
  }

  /** «Diseñar» / «Editar» de una salida con plantilla (nb-tb). */
  protected disenar(procesoId: string, i: number): void {
    const pu = this.est.procesos().find((x) => x.p.id === procesoId);
    const s = pu?.salidas[i];
    if (!pu || !s) return;
    if (!s.tpl) s.tpl = tplVacia(s.nombre, pu.listas);
    this.tb.set({ procesoId, i });
    this.abrir('tb');
  }

  protected async responder(si: boolean): Promise<void> {
    this.exp.set(si);
    if (si && !this.cargado) void this.cargar();
    await this.guardar({ mod_exportacion: si }, 'No se pudo guardar la respuesta');
  }

  protected async guardarEntrega(cambio: BuzonUpdate): Promise<void> {
    this.entrega.update((e) => ({ ...e, ...cambio }) as typeof e);
    if (!(await this.guardar(cambio, 'No se pudo cambiar la entrega'))) this.entrega.set(entregaDe(this.buzon()));
  }

  private async guardar(cambio: BuzonUpdate, error: string): Promise<boolean> {
    try {
      this.buzonActualizado.emit(await this.api.actualizarBuzon(this.buzon().id, cambio));
      return true;
    } catch (e) {
      this.toast.error(error, e instanceof Error ? e.message : String(e));
      return false;
    }
  }
}
