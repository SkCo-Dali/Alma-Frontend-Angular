// Salidas de un proceso — réplica de `salidasUI` del prototipo validado: el mismo
// componente en la pestaña «Exportación» del buzón (ctx 'buzon': se elige la
// salida para ver su tabla o su plantilla debajo) y en el paso 5 del asistente
// (ctx 'wiz': «Diseñar»/«Editar» abre el constructor). Cada salida aplica a todas
// las etiquetas del proceso o solo a algunas; abajo, el resultado por etiqueta.

import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ModoSalida } from './buzon.api';
import { SalidaUI, coberturaExp, extrae, salidaCubre, tplIncompleto } from './buzon-exportacion';
import { ExportacionEstado, ProcesoUI } from './exportacion-estado';

@Component({
  selector: 'alma-salidas-proceso',
  imports: [LucideAngularModule],
  styleUrls: ['./buzon-proto.css'],
  template: `
    @let pu = proceso();
    @let ctx = contexto();
    @let ex = extrae(pu.p);
    <div class="stack" style="gap:8px" [attr.data-rev]="estado().version()">
      @for (s of pu.salidas; track s.uid; let i = $index) {
        <div class="salida" [class.on]="ctx === 'buzon' && i === sel()">
          <div class="row" style="flex-wrap:nowrap;gap:8px">
            @if (ctx === 'buzon') {
              <button type="button" class="btn ghost" [attr.aria-label]="'Ver salida ' + (i + 1)" (click)="seleccionar.emit(i)">
                <lucide-icon [name]="i === sel() ? 'circle-dot' : 'circle'" [size]="13" />
              </button>
            } @else {
              <span class="key">{{ i + 1 }}</span>
            }
            <input class="input sm" style="max-width:260px" aria-label="Nombre de la salida" [value]="s.nombre" (input)="s.nombre = val($event)" (change)="estado().tocar(pu)" />
            <select class="input sm" style="width:auto;min-width:200px" aria-label="Formato" [disabled]="!ex" (change)="modo(s, i, val($event))">
              <option value="ninguno" [selected]="s.modo === 'ninguno'">Sin archivo</option>
              <option value="tabla" [selected]="s.modo === 'tabla'">Tabla según el JSON</option>
              <option value="plantilla" [selected]="s.modo === 'plantilla'">Plantilla específica</option>
            </select>
            @if (s.modo === 'plantilla') {
              @let falt = incompleta(s);
              <span class="badge" [class.b-amber]="falt" [class.b-emerald]="!falt">{{ falt ? 'Incompleta' : 'Lista' }}</span>
              @if (ctx === 'wiz') {
                <button type="button" class="btn outline sm" (click)="disenar.emit(i)">
                  <lucide-icon name="layout-template" [size]="13" /> {{ s.tpl?.columnas?.length ? 'Editar' : 'Diseñar' }}
                </button>
              } @else if (i !== sel()) {
                <button type="button" class="btn outline sm" (click)="seleccionar.emit(i)"><lucide-icon name="layout-template" [size]="13" /> Editar plantilla</button>
              }
            }
            <span style="flex:1"></span>
            @if (pu.salidas.length > 1) {
              <button type="button" class="btn ghost danger" aria-label="Quitar salida" (click)="quitar(i)"><lucide-icon name="x" [size]="13" /></button>
            }
          </div>
          @if (ex && pu.p.etiquetas.length > 1) {
            <div class="row" style="gap:6px;padding-left:4px">
              <span class="xs muted">Aplica a:</span>
              <button type="button" class="chipo pick" [attr.aria-pressed]="s.etiquetas === 'todas'" (click)="estado().alternarTodas(pu, s)">Todas las etiquetas</button>
              @for (e of pu.p.etiquetas; track e) {
                <label class="chipo pick" [class.dim]="s.etiquetas === 'todas'">
                  <input type="checkbox" [checked]="cubre(s, e)" (change)="estado().marcarEtiqueta(pu, s, e, chk($event))" /> {{ e }}
                </label>
              }
            </div>
          }
        </div>
      }
      @if (ex) {
        <button type="button" class="btn outline sm" style="justify-self:start" (click)="agregar()"><lucide-icon name="plus" [size]="13" /> Agregar salida para otras etiquetas</button>
        <div class="row" style="gap:6px">
          <span class="xs muted">Resultado por etiqueta:</span>
          @for (c of cobertura(); track c[0]) {
            <span class="chipo">
              {{ c[0] }} →
              @if (c[1].length) {
                {{ nombres(c[1], ' + ') }}
              } @else {
                <span class="muted">sin archivo</span>
              }
            </span>
          }
        </div>
        @for (c of cobertura(); track c[0]) {
          @if (c[1].length > 1) {
            <p class="note b-amber">
              <lucide-icon name="copy" [size]="13" />
              <span><b>{{ c[0] }}</b> genera {{ c[1].length }} archivos ({{ comillas(c[1]) }}). ¿Es lo que necesitas?</span>
            </p>
          }
        }
      } @else {
        <p class="xs muted">Solo categorización: el proceso no extrae datos, así que no genera archivo.</p>
      }
      @switch (pu.estado) {
        @case ('guardando') {
          <p class="xxs muted">Guardando…</p>
        }
        @case ('pendiente') {
          <p class="xxs muted">Sin guardar: {{ pu.motivo }}</p>
        }
        @case ('error') {
          <p class="err">No se pudo guardar: {{ pu.motivo }}</p>
        }
      }
    </div>
  `,
})
export class SalidasProcesoComponent {
  readonly proceso = input.required<ProcesoUI>();
  readonly estado = input.required<ExportacionEstado>();
  readonly contexto = input<'buzon' | 'wiz'>('buzon');
  /** Salida seleccionada (solo en el buzón). */
  readonly sel = input(-1);
  readonly seleccionar = output<number>();
  /** Abrir el constructor de la plantilla de la salida (solo en el asistente). */
  readonly disenar = output<number>();

  protected readonly extrae = extrae;
  protected readonly cubre = salidaCubre;

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected chk(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected incompleta(s: SalidaUI): boolean {
    return tplIncompleto(s.tpl).length > 0;
  }

  protected cobertura(): [string, SalidaUI[]][] {
    const pu = this.proceso();
    return coberturaExp(pu.p, pu.salidas);
  }

  protected nombres(l: SalidaUI[], sep: string): string {
    return l.map((s) => s.nombre).join(sep);
  }

  protected comillas(l: SalidaUI[]): string {
    return l.map((s) => `«${s.nombre}»`).join(' y ');
  }

  protected modo(s: SalidaUI, i: number, v: string): void {
    s.modo = v as ModoSalida;
    if (this.contexto() === 'buzon') this.seleccionar.emit(i);
    this.estado().cambiarModo(this.proceso(), s);
  }

  protected agregar(): void {
    const pu = this.proceso();
    this.estado().agregarSalida(pu);
    if (this.contexto() === 'buzon') this.seleccionar.emit(pu.salidas.length - 1);
  }

  protected quitar(i: number): void {
    this.estado().quitarSalida(this.proceso(), i);
    if (this.contexto() === 'buzon') this.seleccionar.emit(0);
  }
}
