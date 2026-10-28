// Pestaña «Exportación» de la configuración de un buzón — réplica de `plantTab`
// del prototipo validado (contexto-recaudos-pac/buzon-inteligente-v2.html):
//  · Entrega del archivo: extensión y separador de la «tabla según el JSON»,
//    borrador en el hilo y descarga desde Alma (campos del buzón, 061).
//  · Pestañas por proceso y sus SALIDAS (alma-salidas-proceso): sin archivo,
//    tabla según el JSON o plantilla específica, para todas o algunas etiquetas.
//  · Debajo, la salida elegida: su tabla de ejemplo o el constructor de su plantilla.
// Todo se guarda solo (ExportacionEstado); el prototipo no tiene botón de guardar.

import { Component, DestroyRef, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { Buzon, BuzonApi, BuzonUpdate, Categoria } from './buzon.api';
import { referenciaPac, tablaJson } from './buzon-exportacion';
import { ExportacionEstado, ProcesoUI, conArchivo } from './exportacion-estado';
import { ModuloEstadoComponent } from './modulo-estado.component';
import { HojaVistaComponent, PlantillaBuilderComponent } from './plantilla-builder.component';
import { SalidasProcesoComponent } from './salidas-proceso.component';

/** Entrega del archivo (campos del buzón). */
export type EntregaExp = Pick<Buzon, 'tabla_formato' | 'tabla_separador' | 'borrador_en_hilo' | 'descarga_en_alma'>;

export function entregaDe(b: Buzon): EntregaExp {
  return {
    tabla_formato: b.tabla_formato ?? 'xlsx',
    tabla_separador: b.tabla_separador ?? ';',
    borrador_en_hilo: b.borrador_en_hilo ?? true,
    descarga_en_alma: b.descarga_en_alma ?? true,
  };
}

@Component({
  selector: 'alma-exportacion-tab',
  imports: [LucideAngularModule, AlmaLoaderComponent, SalidasProcesoComponent, PlantillaBuilderComponent, HojaVistaComponent, ModuloEstadoComponent],
  styleUrls: ['./buzon-proto.css'],
  styles: [':host { display: grid; gap: 16px; }'],
  template: `
    <alma-modulo-estado nombre="Exportación" [activo]="buzon().mod_exportacion" [puede]="puede()" (irAjustes)="irAModulos.emit()" />
    @if (est.cargando()) {
      <div class="glass r-2xl empty"><alma-loader [size]="56" label="Cargando exportación…" /></div>
    } @else if (est.error(); as e) {
      <div class="glass r-2xl empty">
        <div class="stack" style="justify-items:center">
          <p class="sm b">No se pudo cargar la exportación.</p>
          <p class="xs muted">{{ e }}</p>
          <button type="button" class="btn outline sm" (click)="cargar()"><lucide-icon name="refresh-cw" [size]="13" /> Reintentar</button>
        </div>
      </div>
    } @else if (!est.procesos().length) {
      <div class="glass r-3xl empty"><div><p class="sm b">No hay procesos activos</p></div></div>
    } @else {
      @let E = entrega();
      @let p = proceso()!;
      @let rev = est.version();
      <!-- Entrega del archivo -->
      <div class="glass r-2xl stack" style="padding:16px">
        <h2 class="sm b">Entrega del archivo</h2>
        <div class="g3">
          <div class="fld">
            <label class="label" for="ex-fmt">Extensión de la tabla según el JSON</label>
            <select class="input" id="ex-fmt" [disabled]="!puede()" (change)="guardarEntrega({ tabla_formato: $any(val($event)) })">
              @for (o of formatos; track o[0]) {
                <option [value]="o[0]" [selected]="E.tabla_formato === o[0]">{{ o[1] }}</option>
              }
            </select>
            <span class="xxs muted">Las plantillas específicas salen en .xlsx (con opción .csv).</span>
          </div>
          <div class="fld">
            <label class="label" for="ex-sep">Separador{{ E.tabla_formato === 'xlsx' ? ' (solo .csv y .txt)' : '' }}</label>
            <select class="input" id="ex-sep" [disabled]="E.tabla_formato === 'xlsx' || !puede()" (change)="guardarEntrega({ tabla_separador: $any(val($event)) })">
              @for (o of separadores; track o[0]) {
                <option [value]="o[0]" [selected]="E.tabla_separador === o[0]">{{ o[1] }}</option>
              }
            </select>
          </div>
          <div class="fld">
            <span class="label">Entrega</span>
            <label class="row sm" for="ex-h"><input type="checkbox" id="ex-h" [disabled]="!puede()" [checked]="E.borrador_en_hilo" (change)="guardarEntrega({ borrador_en_hilo: chk($event) })" /> Borrador en el hilo</label>
            <label class="row sm" for="ex-a"><input type="checkbox" id="ex-a" [disabled]="!puede()" [checked]="E.descarga_en_alma" (change)="guardarEntrega({ descarga_en_alma: chk($event) })" /> Descarga desde Alma</label>
          </div>
        </div>
        <p class="xxs muted">Un correo en Validar genera su archivo cuando se aprueba, con la salida de su etiqueta final.</p>
      </div>

      <!-- Procesos -->
      <div class="pills glass r-xl" style="padding:4px;justify-self:start" role="tablist" [attr.data-rev]="rev">
        @for (x of est.procesos(); track x.p.id) {
          <button type="button" role="tab" [attr.aria-selected]="x === p" (click)="pTab.set(x.p.id)">
            {{ x.p.clave }}
            @if (conArchivo(x); as n) {
              <span class="cnt">{{ n }}</span>
            }
          </button>
        }
      </div>

      <div class="glass r-2xl stack" style="padding:16px">
        <div>
          <h2 class="sm b">Archivos de {{ p.p.clave }}</h2>
          <p class="xs muted">Una salida puede aplicar a todas las etiquetas del proceso o solo a algunas. Las etiquetas sin salida no generan archivo.</p>
        </div>
        <alma-salidas-proceso [proceso]="p" [estado]="est" contexto="buzon" [sel]="selI()" (seleccionar)="seleccionar(p, $event)" />
      </div>

      @let s = p.salidas[selI()];
      @if (s?.modo === 'tabla') {
        @let tj = tabla(p);
        <div class="glass r-2xl stack" style="padding:16px">
          <h2 class="sm b">«{{ s.nombre }}» · tabla según el JSON</h2>
          <div class="sheet-wrap">
            <table class="sheet">
              <tr>
                <th class="rh"></th>
                @for (c of tj.cols; track $index) {
                  <th>{{ c }}</th>
                }
              </tr>
              @for (f of tj.filas; track $index; let i = $index) {
                <tr>
                  <td class="rh">{{ i + 1 }}</td>
                  @for (v of f; track $index) {
                    <td>{{ v }}</td>
                  }
                </tr>
              }
            </table>
          </div>
          <p class="xxs muted">Una columna por dato del JSON{{ p.listas.length ? '; una fila por elemento de «' + p.listas[0] + '»' : '; una fila por correo' }}. Datos ficticios.</p>
        </div>
      } @else if (s?.modo === 'plantilla' && s.tpl) {
        <div class="glass r-2xl stack" style="padding:16px">
          <h2 class="sm b">Plantilla específica · «{{ s.nombre }}»</h2>
          <alma-plantilla-builder
            [tpl]="s.tpl"
            [campos]="p.campos"
            [listas]="p.listas"
            [bases]="est.bases()"
            [proceso]="p.p.clave"
            (cambiado)="est.tocarTpl(p, s.tpl)"
            (verRef)="verRef.set(true)"
          />
        </div>
      } @else if (s) {
        <div class="glass r-2xl" style="padding:16px"><p class="sm muted">«{{ s.nombre }}» no genera archivo para sus etiquetas.</p></div>
      }
    }

    <!-- mRef: ejemplo de referencia (solo lectura, datos ficticios) -->
    @if (verRef()) {
      <div class="scrim" (click)="verRef.set(false)">
        <div class="modal solid xl" role="dialog" aria-modal="true" aria-label="Ejemplo de referencia" (click)="$event.stopPropagation()">
          <div class="row between">
            <div>
              <h2 class="sm b">Ejemplo de referencia · Cargue PAC</h2>
              <p class="xs muted">Solo lectura. Muestra una plantilla con encabezado, detalle por afiliado y cálculos.</p>
            </div>
            <button type="button" class="btn ghost" aria-label="Cerrar" (click)="verRef.set(false)"><lucide-icon name="x" [size]="16" /></button>
          </div>
          <alma-hoja-vista [hoja]="referencia" />
        </div>
      </div>
    }
  `,
})
export class ExportacionTabComponent {
  private readonly api = inject(BuzonApi);
  private readonly toast = inject(ToastService);

  readonly buzon = input.required<Buzon>();
  readonly categorias = input<Categoria[]>([]);
  /** El buzón cambió (entrega del archivo): el padre lo reemplaza. */
  readonly buzonActualizado = output<Buzon>();
  /** «Cambiar en Ajustes → Módulos». */
  readonly irAModulos = output<void>();

  protected readonly est = new ExportacionEstado(this.api, this.toast);
  protected readonly conArchivo = conArchivo;
  protected readonly referencia = referenciaPac('val');
  protected readonly formatos = [
    ['xlsx', 'Excel (.xlsx)'],
    ['csv', 'CSV (.csv)'],
    ['txt', 'Texto delimitado (.txt)'],
  ] as const;
  protected readonly separadores = [
    [';', 'Punto y coma ( ; )'],
    [',', 'Coma ( , )'],
    ['|', 'Barra ( | )'],
  ] as const;

  protected readonly pTab = signal<string | null>(null);
  /** Salida elegida por proceso. */
  private readonly salSel = signal<Record<string, number>>({});
  protected readonly verRef = signal(false);
  protected readonly entrega = linkedSignal(() => entregaDe(this.buzon()));
  protected readonly puede = computed(() => this.buzon().puede_administrar !== false);

  protected readonly proceso = computed<ProcesoUI | null>(() => {
    const l = this.est.procesos();
    return l.find((x) => x.p.id === this.pTab()) ?? l[0] ?? null;
  });
  protected readonly selI = computed(() => {
    this.est.version();
    const p = this.proceso();
    return p ? Math.max(0, Math.min(this.salSel()[p.p.id] ?? 0, p.salidas.length - 1)) : 0;
  });

  constructor() {
    queueMicrotask(() => void this.cargar());
    inject(DestroyRef).onDestroy(() => this.est.flush());
  }

  cargar(): Promise<void> {
    return this.est.cargar(this.buzon().id, 'ninguno');
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected chk(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected seleccionar(p: ProcesoUI, i: number): void {
    this.salSel.update((m) => ({ ...m, [p.p.id]: i }));
  }

  protected tabla(p: ProcesoUI) {
    return tablaJson(p.campos, p.listas);
  }

  protected async guardarEntrega(cambio: BuzonUpdate): Promise<void> {
    this.entrega.update((e) => ({ ...e, ...cambio }) as typeof e);
    try {
      const b = await this.api.actualizarBuzon(this.buzon().id, cambio);
      this.buzonActualizado.emit(b);
    } catch (e) {
      this.toast.error('No se pudo cambiar la entrega', e instanceof Error ? e.message : String(e));
      this.entrega.set(entregaDe(this.buzon()));
    }
  }
}
