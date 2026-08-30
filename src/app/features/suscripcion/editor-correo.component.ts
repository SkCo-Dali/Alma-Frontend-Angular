// Editor de correos — réplica 1:1 del RichTextEditor + toolbar del módulo de
// correos de Dali (EmailComposer/EditTemplateDialog), portada a Angular sin
// dependencias: misma barra (B/I/U, Fuente ▾, Tamaño ▾, color A, listas,
// alineaciones, imagen, emoji, "En Blanco" ámbar, acciones "Plantillas" y
// "+ Campos"), asunto sin borde debajo de la barra, banda de campos
// arrastrables y lienzo blanco tipo página con el conmutador Visual/HTML
// flotante. Lo único distinto a Dali son los campos: aquí son las variables
// {{...}} de la cotización.

import {
  Component,
  ElementRef,
  effect,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

const FUENTES = [
  ['Arial', 'Arial, sans-serif'],
  ['Times New Roman', 'Times New Roman, serif'],
  ['Courier New', 'Courier New, monospace'],
  ['Georgia', 'Georgia, serif'],
  ['Verdana', 'Verdana, sans-serif'],
  ['Tahoma', 'Tahoma, sans-serif'],
] as const;

// execCommand usa tamaños 1–7; se muestran los px equivalentes (como Dali).
const TAMANOS = [
  ['1', '10px'], ['2', '13px'], ['3', '16px'], ['4', '18px'],
  ['5', '24px'], ['6', '32px'], ['7', '48px'],
] as const;

// Etiquetas y colores de los campos (mismo patrón de Dali: cada campo con su
// pareja pastel bg/text; el chip muestra el nombre humano, no el {{token}}).
const CAMPO_ETIQUETAS: Record<string, string> = {
  asegurado: 'Asegurado', cedula: 'Cédula', nro_cotizacion: 'N° Cotización',
  producto: 'Producto', suma_asegurada: 'Suma Asegurada', prima: 'Prima',
  fp: 'Nombre FP', director: 'Director Comercial', agencia: 'Agencia',
  analista: 'Analista', fecha: 'Fecha', mensaje: 'Mensaje',
};
const CAMPO_COLORES: Array<{ bg: string; text: string }> = [
  { bg: '#dbeafe', text: '#1e40af' }, // azul
  { bg: '#e5e7eb', text: '#374151' }, // gris
  { bg: '#fef3c7', text: '#92400e' }, // ámbar
  { bg: '#e9d5ff', text: '#6b21a8' }, // violeta
  { bg: '#dcfce7', text: '#166534' }, // verde
  { bg: '#fce7f3', text: '#9d174d' }, // rosa
  { bg: '#cffafe', text: '#155e75' }, // cian
  { bg: '#ffedd5', text: '#9a3412' }, // naranja
];

const EMOJIS = [
  '😀', '😄', '🙂', '😉', '😍', '🤝', '👋', '👍',
  '🙏', '👏', '💪', '🎉', '🎯', '✨', '✅', '☑️',
  '⚠️', '❗', '📌', '📎', '📅', '🗓️', '⏰', '📈',
  '💚', '💼', '📄', '📝', '✉️', '📣', '🛡️', '☂️',
];

@Component({
  selector: 'alma-editor-correo',
  imports: [FormsModule, LucideAngularModule],
  styles: [`
    :host { display: block; }
    /* Barra de herramientas (Dali: bg-muted/30, borde suave, una sola fila) */
    /* flex-wrap + overflow visible: los dropdowns (fuente/tamaño/emoji) son
       hijos absolute y un overflow-x:auto los recortaba dentro de la barra. */
    .barra { display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
      overflow: visible;
      background: color-mix(in oklab, var(--muted) 30%, transparent);
      border: 1px solid color-mix(in oklab, var(--border) 50%, transparent);
      border-radius: 10px; padding: 6px; }
    .tb { display: inline-flex; align-items: center; justify-content: center;
      height: 28px; min-width: 28px; padding: 0 4px; border: 0; border-radius: 8px;
      background: transparent; color: var(--foreground); cursor: pointer;
      font-size: 12px; flex-shrink: 0; }
    .tb:hover { background: color-mix(in oklab, var(--muted) 70%, transparent); }
    .tb.txt { padding: 0 8px; gap: 2px; }
    .tb.ambar { color: #d97706; gap: 4px; padding: 0 8px; }
    .tb.ambar:hover { background: #fef3c7; color: #b45309; }
    .sep { width: 1px; height: 20px; flex-shrink: 0; margin: 0 2px;
      background: color-mix(in oklab, var(--border) 80%, transparent); }
    /* Botones de acción a la derecha (pill glass, como Dali) */
    .acciones { display: flex; align-items: center; gap: 2px; flex-shrink: 0;
      margin-left: auto; padding: 2px;
      background: color-mix(in oklab, var(--background) 40%, transparent);
      border: 1px solid color-mix(in oklab, var(--border) 60%, transparent);
      border-radius: 8px; }
    .accion { display: inline-flex; align-items: center; gap: 4px; border: 0;
      padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500;
      background: transparent; color: var(--muted-foreground); cursor: pointer;
      white-space: nowrap; }
    .accion:hover { color: var(--foreground);
      background: color-mix(in oklab, var(--muted) 70%, transparent); }
    .accion.activa { background: color-mix(in oklab, var(--primary) 15%, transparent);
      color: var(--primary); }
    /* Asunto sin borde con línea inferior (Dali) */
    .asunto { border-bottom: 1px solid color-mix(in oklab, var(--border) 50%, transparent); }
    .asunto:focus-within { border-color: var(--primary); }
    .asunto input { width: 100%; height: 36px; border: 0; outline: none;
      background: transparent; color: var(--foreground); font-size: 14px; }
    /* Banda de campos (Dali: caja gris con chips) */
    .campos { background: color-mix(in oklab, var(--muted) 35%, transparent);
      border: 1px solid color-mix(in oklab, var(--border) 40%, transparent);
      border-radius: 10px; padding: 8px 10px; }
    .chip { display: inline-flex; align-items: center; border: 0; cursor: move;
      padding: 5px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 500;
      transition: transform .15s; }
    .chip:hover { transform: scale(1.05); }
    /* Lienzo: área gris con página blanca centrada + toggle flotante (Dali) */
    .zona { position: relative; background: #fff;
      border: 1px solid color-mix(in oklab, var(--border) 50%, transparent);
      border-radius: 10px; overflow: hidden; }
    .toggle { position: absolute; top: 8px; right: 8px; z-index: 10;
      display: flex; align-items: center; overflow: hidden; font-size: 12px;
      border: 1px solid var(--border); border-radius: 8px;
      background: color-mix(in oklab, var(--background) 85%, transparent);
      backdrop-filter: blur(4px); box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
    .toggle button { display: inline-flex; align-items: center; gap: 4px;
      border: 0; padding: 4px 10px; background: transparent; cursor: pointer;
      color: var(--muted-foreground); font-size: 12px; font-weight: 500; }
    .toggle button.on { background: var(--primary); color: #fff; }
    .pagina { background: #fff; color: #1f2937; width: 100%;
      min-height: 46vh; max-height: 58vh; overflow-y: auto;
      padding: 18px 20px 48px;
      font-family: Arial, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.55; }
    .pagina:focus { outline: none; }
    .pagina img { max-width: 100%; }
    textarea.codigo { display: block; width: 100%; min-height: 46vh; max-height: 58vh;
      border: 0; border-radius: 6px; resize: vertical; padding: 14px 16px;
      background: #101613; color: #d1fae5;
      font-family: ui-monospace, Consolas, monospace; font-size: 12px; line-height: 1.5; }
    /* Paneles flotantes (dropdowns propios) */
    .panel { position: absolute; z-index: 40; margin-top: 4px; min-width: 150px;
      border: 1px solid var(--border); border-radius: 10px; padding: 4px;
      background: var(--background); box-shadow: 0 8px 24px rgb(0 0 0 / .16); }
    .panel button { display: block; width: 100%; text-align: left; border: 0;
      background: transparent; padding: 6px 10px; border-radius: 6px;
      font-size: 13px; color: var(--foreground); cursor: pointer; }
    .panel button:hover { background: color-mix(in oklab, var(--muted) 60%, transparent); }
    .panel.emojis { display: grid; grid-template-columns: repeat(8, 32px); gap: 2px; }
    .panel.emojis button { padding: 0; height: 32px; text-align: center; font-size: 17px; }
    .colorA { position: relative; display: inline-flex; flex-direction: column;
      align-items: center; justify-content: center; }
    .colorA b { font-size: 13px; line-height: 1; font-weight: 700; }
    .colorA i { display: block; width: 14px; height: 3px; border-radius: 2px; margin-top: 1px; }
  `],
  template: `
    <div class="relative flex min-h-0 flex-col gap-2">
      <!-- ── Barra de herramientas (una sola fila, como Dali) ── -->
      <div class="barra">
        <button type="button" class="tb" title="Negrita" (mousedown)="cmd($event, 'bold')"><b>B</b></button>
        <button type="button" class="tb italic" title="Cursiva" (mousedown)="cmd($event, 'italic')"><i>I</i></button>
        <button type="button" class="tb underline" title="Subrayado" (mousedown)="cmd($event, 'underline')"><u>U</u></button>
        <span class="sep"></span>

        <span class="relative">
          <button type="button" class="tb txt" (mousedown)="$event.preventDefault(); abrirPanel('fuente')">
            Fuente <lucide-icon name="chevron-down" [size]="12" />
          </button>
          @if (panel() === 'fuente') {
            <div class="panel">
              @for (f of fuentes; track f[0]) {
                <button type="button" [style.fontFamily]="f[1]" (mousedown)="elegir($event, 'fontName', f[1])">{{ f[0] }}</button>
              }
            </div>
          }
        </span>
        <span class="relative">
          <button type="button" class="tb txt" (mousedown)="$event.preventDefault(); abrirPanel('tamano')">
            Tamaño <lucide-icon name="chevron-down" [size]="12" />
          </button>
          @if (panel() === 'tamano') {
            <div class="panel">
              @for (t of tamanos; track t[0]) {
                <button type="button" (mousedown)="elegir($event, 'fontSize', t[0])">{{ t[1] }}</button>
              }
            </div>
          }
        </span>
        <span class="sep"></span>

        <label class="tb colorA" title="Color de texto">
          <b>A</b><i [style.background]="color()"></i>
          <input type="color" [value]="color()" (change)="cambiarColor($any($event.target).value)"
                 style="position:absolute;inset:0;opacity:0;cursor:pointer;" />
        </label>
        <span class="sep"></span>

        <button type="button" class="tb" title="Lista" (mousedown)="cmd($event, 'insertUnorderedList')"><lucide-icon name="list" [size]="15" /></button>
        <button type="button" class="tb" title="Lista numerada" (mousedown)="cmd($event, 'insertOrderedList')"><lucide-icon name="list-ordered" [size]="15" /></button>
        <span class="sep"></span>

        <button type="button" class="tb" title="Alinear izquierda" (mousedown)="cmd($event, 'justifyLeft')"><lucide-icon name="align-left" [size]="15" /></button>
        <button type="button" class="tb" title="Centrar" (mousedown)="cmd($event, 'justifyCenter')"><lucide-icon name="align-center" [size]="15" /></button>
        <button type="button" class="tb" title="Alinear derecha" (mousedown)="cmd($event, 'justifyRight')"><lucide-icon name="align-right" [size]="15" /></button>
        <button type="button" class="tb" title="Justificar" (mousedown)="cmd($event, 'justifyFull')"><lucide-icon name="align-justify" [size]="15" /></button>
        <span class="sep"></span>

        <button type="button" class="tb" title="Insertar imagen" (mousedown)="imagen($event)"><lucide-icon name="image" [size]="15" /></button>
        <span class="relative">
          <button type="button" class="tb" title="Insertar emoji" (mousedown)="$event.preventDefault(); abrirPanel('emoji')"><lucide-icon name="smile" [size]="15" /></button>
          @if (panel() === 'emoji') {
            <div class="panel emojis">
              @for (e of emojis; track e) {
                <button type="button" (mousedown)="insertarEmoji($event, e)">{{ e }}</button>
              }
            </div>
          }
        </span>
        <span class="sep"></span>

        <button type="button" class="tb ambar" title="Limpiar todo el contenido" (mousedown)="enBlanco($event)">
          <lucide-icon name="eraser" [size]="14" /> En Blanco
        </button>

        <div class="acciones">
          @if (conPlantillas()) {
            <button type="button" class="accion" (click)="abrirPlantillas.emit()">
              <lucide-icon name="file-text" [size]="14" /> Plantillas
            </button>
          }
          <button type="button" class="accion" [class.activa]="camposVisibles()" (click)="camposVisibles.set(!camposVisibles())">
            <lucide-icon name="plus" [size]="14" /> Campos
          </button>
        </div>
      </div>

      <!-- ── Asunto (línea sin borde, como Dali) ── -->
      <div class="asunto">
        <input
          [ngModel]="asunto()"
          (ngModelChange)="asunto.set($event)"
          placeholder="Escribe un Asunto"
          maxlength="250"
          (focus)="objetivo = 'asunto'"
          (dragover)="$event.preventDefault()"
        />
      </div>

      <!-- ── Banda de campos dinámicos ── -->
      @if (camposVisibles()) {
        <div class="campos">
          <div class="flex flex-wrap gap-1.5">
            @for (v of listaVariables(); track v.clave) {
              <button
                type="button"
                class="chip"
                draggable="true"
                [style.background]="v.bg"
                [style.color]="v.text"
                [title]="v.titulo"
                (dragstart)="arrastrar($event, v.clave)"
                (click)="insertarVariable(v.clave)"
              >
                {{ v.etiqueta }}
              </button>
            }
          </div>
          <p class="mt-1.5 text-[11px] text-muted-foreground">
            Arrastra los campos al asunto o contenido del email para insertarlos
          </p>
        </div>
      }

      <!-- ── Lienzo con conmutador Visual/HTML flotante ── -->
      <div class="zona">
        <div class="toggle">
          <button type="button" [class.on]="modo() === 'visual'" (click)="cambiarModo('visual')">
            <lucide-icon name="eye" [size]="12" /> Visual
          </button>
          <button type="button" [class.on]="modo() === 'html'" (click)="cambiarModo('html')">
            <lucide-icon name="code" [size]="12" /> HTML
          </button>
        </div>
        @if (modo() === 'visual') {
          <div
            #lienzo
            class="pagina"
            contenteditable="true"
            (input)="sincronizar()"
            (focus)="objetivo = 'cuerpo'"
          ></div>
        } @else {
          <textarea
            class="codigo"
            [ngModel]="value()"
            (ngModelChange)="escribirHtml($event)"
            placeholder="Código HTML…"
            spellcheck="false"
          ></textarea>
        }
      </div>
    </div>
  `,
})
export class EditorCorreoComponent {
  /** Asunto y cuerpo como modelos two-way. */
  readonly asunto = model<string>('');
  readonly value = model<string>('');
  /** Variables {{clave}} → descripción (los campos de Alma). */
  readonly variables = input<Record<string, string>>({});
  /** Mostrar el botón "Plantillas" (el padre abre su galería). */
  readonly conPlantillas = input<boolean>(true);
  readonly abrirPlantillas = output<void>();

  protected readonly modo = signal<'visual' | 'html'>('visual');
  protected readonly panel = signal<null | 'fuente' | 'tamano' | 'emoji'>(null);
  protected readonly color = signal('#000000');
  protected readonly camposVisibles = signal(true);
  protected objetivo: 'asunto' | 'cuerpo' = 'cuerpo';

  protected readonly fuentes = FUENTES;
  protected readonly tamanos = TAMANOS;
  protected readonly emojis = EMOJIS;

  private readonly lienzo = viewChild<ElementRef<HTMLDivElement>>('lienzo');
  private ultimoExterno = '';

  constructor() {
    effect(() => {
      const v = this.value() ?? '';
      if (v === this.ultimoExterno) return;
      this.ultimoExterno = v;
      queueMicrotask(() => {
        const el = this.lienzo()?.nativeElement;
        if (el && el.innerHTML !== v) el.innerHTML = v;
      });
    });
  }

  protected listaVariables(): Array<{
    clave: string; etiqueta: string; titulo: string; bg: string; text: string;
  }> {
    return Object.entries(this.variables()).map(([clave, titulo], i) => {
      const color = CAMPO_COLORES[i % CAMPO_COLORES.length];
      return {
        clave,
        etiqueta: CAMPO_ETIQUETAS[clave] ?? clave,
        titulo: `${titulo} — inserta {{${clave}}}`,
        bg: color.bg,
        text: color.text,
      };
    });
  }

  private emitir(html: string): void {
    this.ultimoExterno = html;
    this.value.set(html);
  }

  protected sincronizar(): void {
    const el = this.lienzo()?.nativeElement;
    if (el) this.emitir(el.innerHTML);
  }

  protected escribirHtml(v: string): void {
    this.emitir(v);
  }

  protected cambiarModo(m: 'visual' | 'html'): void {
    this.modo.set(m);
    this.panel.set(null);
    if (m === 'visual') {
      queueMicrotask(() => {
        const el = this.lienzo()?.nativeElement;
        if (el) el.innerHTML = this.value();
      });
    }
  }

  protected abrirPanel(p: 'fuente' | 'tamano' | 'emoji'): void {
    this.panel.set(this.panel() === p ? null : p);
  }

  protected cmd(ev: Event, comando: string): void {
    ev.preventDefault();
    this.panel.set(null);
    this.lienzo()?.nativeElement.focus();
    document.execCommand(comando, false);
    this.sincronizar();
  }

  protected elegir(ev: Event, comando: string, valor: string): void {
    ev.preventDefault();
    this.panel.set(null);
    this.lienzo()?.nativeElement.focus();
    document.execCommand(comando, false, valor);
    this.sincronizar();
  }

  protected cambiarColor(valor: string): void {
    this.color.set(valor);
    this.lienzo()?.nativeElement.focus();
    document.execCommand('foreColor', false, valor);
    this.sincronizar();
  }

  protected insertarEmoji(ev: Event, emoji: string): void {
    ev.preventDefault();
    this.panel.set(null);
    this.insertarTexto(emoji);
  }

  protected enBlanco(ev: Event): void {
    ev.preventDefault();
    this.asunto.set('');
    const el = this.lienzo()?.nativeElement;
    if (el) el.innerHTML = '';
    this.emitir('');
  }

  /** Como Dali: la imagen se sube desde el equipo y viaja embebida (data URI). */
  protected imagen(ev: Event): void {
    ev.preventDefault();
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        this.lienzo()?.nativeElement.focus();
        document.execCommand('insertImage', false, String(r.result));
        this.sincronizar();
      };
      r.readAsDataURL(f);
    };
    inp.click();
  }

  protected arrastrar(ev: DragEvent, clave: string): void {
    ev.dataTransfer?.setData('text/plain', `{{${clave}}}`);
  }

  protected insertarVariable(clave: string): void {
    const token = `{{${clave}}}`;
    if (this.objetivo === 'asunto') {
      this.asunto.set(`${this.asunto()}${token}`);
      return;
    }
    this.insertarTexto(token);
  }

  /** Inserta texto en el cursor del modo activo. */
  insertarTexto(texto: string): void {
    if (this.modo() === 'html') {
      this.emitir(this.value() + texto);
      return;
    }
    const el = this.lienzo()?.nativeElement;
    if (!el) return;
    el.focus();
    document.execCommand('insertText', false, texto);
    this.sincronizar();
  }

  /** Reemplaza asunto+cuerpo (al elegir una plantilla de la galería). */
  cargar(asunto: string, cuerpoHtml: string): void {
    this.asunto.set(asunto);
    this.emitir(cuerpoHtml);
    queueMicrotask(() => {
      const el = this.lienzo()?.nativeElement;
      if (el) el.innerHTML = cuerpoHtml;
    });
  }
}
