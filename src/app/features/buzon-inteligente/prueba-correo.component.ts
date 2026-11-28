// Paso 5 del asistente de procesos «simples» (095): probar con un correo de verdad del
// buzón. Se busca por asunto, se elige uno y el backend lo clasifica con el BORRADOR sin
// tocar Outlook ni guardar nada. El resultado se lee como la ficha aprobada
// (prototipos/ficha-prueba-paso-a-paso.html): A) qué proceso reconoce la IA, B) qué datos
// copió (solo copia, no decide), C) qué casillas pasan o fallan, y el resultado.

import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Buzon, BuzonApi, CorreoEncontrado, PruebaCorreo } from './buzon.api';

@Component({
  selector: 'alma-prueba-correo',
  imports: [FormsModule, LucideAngularModule],
  styleUrls: ['./buzon-proto.css'],
  styles: [
    `.paso { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 10px; padding: 10px 0; border-top: 1px solid var(--border); }
     .paso:first-child { border-top: 0; padding-top: 0; }
     .n { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 0.75rem; font-weight: 700;
          background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary-ink); }
     .ok { color: var(--emerald); } .no { color: var(--rose); }
     .correo { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 10px; background: var(--sunken); }`,
  ],
  template: `
    <div class="stack" style="gap:10px">
      <div class="row" style="flex-wrap:nowrap">
        <input class="input" [(ngModel)]="asunto" (keydown.enter)="buscar()" placeholder="Parte del asunto, p. ej. carta 4x1000" aria-label="Asunto del correo" />
        <button type="button" class="btn outline" [disabled]="buscando() || probando()" (click)="buscar()">
          <lucide-icon [name]="buscando() ? 'loader-2' : 'search'" [size]="14" [class.animate-spin]="buscando()" /> Buscar
        </button>
      </div>
      <p class="xxs muted">Se busca en todo el buzón. Probar no mueve, no etiqueta ni marca nada en Outlook.</p>
      @if (error()) { <p class="note b-rose"><lucide-icon name="alert-triangle" [size]="13" /> <span>{{ error() }}</span></p> }

      @if (resultados(); as lista) {
        @if (!lista.length) {
          <p class="xs muted">No encontré correos con «{{ ultimaBusqueda }}» en el asunto.</p>
        } @else if (!elegido()) {
          <div class="stack" style="gap:6px">
            @for (c of lista; track c.id) {
              <div class="correo">
                <lucide-icon name="mail" [size]="15" class="muted" />
                <div style="flex:1;min-width:0">
                  <p class="sm b trunc">{{ c.asunto }}</p>
                  <p class="xxs muted trunc">{{ c.remitente }} · {{ fecha(c.fecha) }} @if (c.adjuntos) { · <lucide-icon name="paperclip" [size]="11" /> adjuntos }</p>
                </div>
                <button type="button" class="btn primary sm" [disabled]="probando()" (click)="probar(c)"><lucide-icon name="play" [size]="13" /> Probar</button>
              </div>
            }
          </div>
        }
      }

      @if (elegido(); as c) {
        <div class="row between" style="flex-wrap:nowrap">
          <p class="xs" style="min-width:0"><lucide-icon name="mail" [size]="13" /> <b>{{ c.asunto }}</b> <span class="muted">· {{ c.remitente }} · {{ fecha(c.fecha) }}</span></p>
          @if (!probando()) { <button type="button" class="linkbtn xs" (click)="otro()">Probar otro</button> }
        </div>
      }

      @if (probando()) {
        <p class="note b-sky"><lucide-icon name="loader-2" [size]="13" class="animate-spin" />
          <span>Probando… Nova lee el correo y sus adjuntos. Puede tardar hasta un minuto.</span></p>
      } @else if (resultado(); as r) {
        <div class="sunk r-xl" style="padding:12px 14px">
          <div class="paso">
            <span class="n">A</span>
            <div class="stack" style="gap:4px">
              <p class="sm b">La IA lee el correo con tu texto</p>
              @if (r.proceso && r.proceso === proceso()) {
                <p class="xs"><span class="ok">✓</span> Encaja con «{{ nombre() || r.proceso }}»
                  @if (r.confianza !== null) { <span class="muted">· confianza {{ pct(r.confianza) }}@if (r.umbral !== null) { (mínimo {{ pct(r.umbral) }})}</span> }</p>
              } @else if (r.resultado === 'otros') {
                <p class="xs"><span class="no">✗</span> No encaja con ningún proceso: queda en OTROS.</p>
              } @else {
                <p class="xs"><span class="no">✗</span> No lo reconoce como este caso: lo toma el proceso <b>{{ r.proceso || r.etiqueta }}</b>.</p>
              }
              @if (r.justificacion) { <p class="xxs muted">{{ r.justificacion }}</p> }
            </div>
          </div>
          <div class="paso">
            <span class="n">B</span>
            <div class="stack" style="gap:4px">
              <p class="sm b">La IA copia lo que necesitan las casillas <span class="xs muted" style="font-weight:400">— solo copia, no decide</span></p>
              @for (d of datosDe(r); track d[0]) {
                <p class="xs"><span class="muted">{{ d[1] }}:</span> <b class="mono">{{ d[2] }}</b></p>
              } @empty {
                <p class="xs muted">Nada: este proceso no tiene casillas que pidan datos.</p>
              }
            </div>
          </div>
          <div class="paso">
            <span class="n">C</span>
            <div class="stack" style="gap:4px">
              <p class="sm b">Nova revisa cada casilla <span class="xs muted" style="font-weight:400">— con código, sin IA</span></p>
              @for (v of r.revisiones; track $index) {
                <p class="xs">@if (v.ok) { <span class="ok">✓</span> } @else { <span class="no">✗</span> } {{ v.nombre }}
                  @if (!v.ok && v.motivo) { <span class="muted">({{ queFallo(v) }})</span> }</p>
              } @empty {
                <p class="xs muted">No hay casillas que revisar.</p>
              }
            </div>
          </div>
          <div class="paso">
            <span class="n"><lucide-icon name="flag" [size]="13" /></span>
            <div class="stack" style="gap:4px">
              <p class="sm b">Resultado</p>
              @switch (r.resultado) {
                @case ('sale') { <p class="xs"><span class="ok">→ Sale solo:</span> etiqueta <b class="mono">{{ r.etiqueta }}</b>{{ r.destino ? ' → ' + r.destino : ' (solo se etiqueta)' }}.</p> }
                @case ('validar') { <p class="xs"><span class="no">→ Va a Validar</span>@if (r.motivo) {: «{{ r.motivo }}»}.</p> }
                @default { <p class="xs"><span class="no">→ Queda en OTROS</span>: ningún proceso lo reconoce.</p> }
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PruebaCorreoComponent {
  private readonly api = inject(BuzonApi);

  readonly buzon = input.required<Buzon>();
  /** Clave del proceso que se está probando. */
  readonly proceso = input('');
  readonly nombre = input('');
  /** Clave del dato → cómo lo llama el analista («cuenta_cliente» → «la cuenta del cliente»). */
  readonly nombresDatos = input<Record<string, string>>({});
  /** Antes de probar se guarda el borrador (el backend prueba con él). false = no se prueba. */
  readonly antesDeProbar = input<() => Promise<boolean>>(() => Promise.resolve(true));
  readonly probado = output<PruebaCorreo>();

  protected asunto = '';
  protected ultimaBusqueda = '';
  protected readonly buscando = signal(false);
  protected readonly probando = signal(false);
  protected readonly resultados = signal<CorreoEncontrado[] | null>(null);
  protected readonly elegido = signal<CorreoEncontrado | null>(null);
  protected readonly resultado = signal<PruebaCorreo | null>(null);
  protected readonly error = signal('');

  protected async buscar(): Promise<void> {
    const q = this.asunto.trim();
    if (q.length < 3) {
      this.error.set('Escribe al menos 3 letras del asunto.');
      return;
    }
    this.error.set('');
    this.buscando.set(true);
    this.elegido.set(null);
    this.resultado.set(null);
    try {
      this.resultados.set(await this.api.buscarCorreos(this.buzon().id, q));
      this.ultimaBusqueda = q;
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.buscando.set(false);
    }
  }

  protected async probar(c: CorreoEncontrado): Promise<void> {
    this.error.set('');
    this.elegido.set(c);
    this.resultado.set(null);
    this.probando.set(true);
    try {
      if (!(await this.antesDeProbar()())) {
        this.elegido.set(null);
        return;
      }
      const r = await this.api.probarCorreo(this.buzon().id, c.id);
      this.resultado.set(r);
      this.probado.emit(r);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.probando.set(false);
    }
  }

  protected otro(): void {
    this.elegido.set(null);
    this.resultado.set(null);
  }

  /** [clave, cómo lo llama el analista, valor copiado]. */
  protected datosDe(r: PruebaCorreo): [string, string, string][] {
    const nombres = this.nombresDatos();
    return Object.entries(r.datos ?? {}).map(([k, v]) => [
      k,
      nombres[k] ?? k.replace(/_/g, ' '),
      v === null || v === undefined || v === '' ? '(vacío)' : typeof v === 'object' ? JSON.stringify(v) : String(v),
    ]);
  }

  /** El motivo repite la frase de la casilla («No se cumple: <frase>. <detalle>»): al lado
   *  de la frase basta con el detalle. Un motivo escrito a mano se muestra completo. */
  protected queFallo(v: { nombre: string; motivo: string }): string {
    const prefijo = `No se cumple: ${v.nombre.charAt(0).toLowerCase()}${v.nombre.slice(1)}. `;
    return v.motivo.startsWith(prefijo) ? v.motivo.slice(prefijo.length) || v.motivo : v.motivo;
  }

  protected pct(x: number): string {
    return `${Math.round((x <= 1 ? x * 100 : x))} %`;
  }

  protected fecha(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
