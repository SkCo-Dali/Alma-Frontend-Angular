// Editor de correos — el MISMO stack del RichTextEditor de Dali: TipTap
// (@tiptap/core 3.x) con las mismas extensiones (StarterKit, Underline,
// TextStyle, Color, Highlight, FontFamily, FontSize custom de Dali, TextAlign,
// LinkWithStyles/SpanWithStyles, PreserveStyles, Div, TableWithStyles) y el
// mismo picker de emojis (emoji-mart). Las extensiones custom y el
// htmlStylePreserver están COPIADOS de Dali (src/extensions) en ./tiptap.
// Lo único distinto son los campos dinámicos: aquí son las {{variables}} de
// la cotización, con la misma banda de chips de colores de Dali.

import {
  HostListener,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { FontSize } from './tiptap/FontSizeExtension';
import { PreserveStylesExtension, LinkWithStyles, SpanWithStyles } from './tiptap/PreserveStylesExtension';
import { DivExtension } from './tiptap/DivExtension';
import { TableWithStyles, TableBody, TableRow, TableCell } from './tiptap/TableWithStylesExtension';
import {
  ExtractedTemplate,
  extractTemplateSections,
  reconstructFullHtml,
} from './tiptap/htmlStylePreserver';

// Idénticos a los de Dali (RichTextEditor.tsx)
const FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
];
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

// Paleta de campos de Dali (EmailComposer.fieldColors), rotada sobre los de Alma.
const CAMPO_ETIQUETAS: Record<string, string> = {
  asegurado: 'Asegurado', cedula: 'Cédula', nro_cotizacion: 'N° Cotización',
  contrato: 'Contrato',
  producto: 'Producto', suma_asegurada: 'Suma Asegurada', prima: 'Prima',
  fp: 'Nombre FP', director: 'Director Comercial', agencia: 'Agencia',
  analista: 'Analista', fecha: 'Fecha', mensaje: 'Mensaje',
};
const CAMPO_COLORES: Array<{ bg: string; text: string }> = [
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#e5e7eb', text: '#374151' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#e9d5ff', text: '#6b21a8' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#cffafe', text: '#155e75' },
  { bg: '#ffedd5', text: '#9a3412' },
];

@Component({
  selector: 'alma-editor-correo',
  imports: [FormsModule, LucideAngularModule],
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    /* Réplica del layout de Dali: barra, asunto y campos quedan FIJOS y solo
       el lienzo scrollea. El alto viene del contenedor (el modal), no de vh
       fijos; min-height como piso para hosts sin altura definida. */
    .raiz { flex: 1; min-height: 0; }
    /* flex-wrap + overflow visible: los dropdowns son hijos absolute y un
       overflow-x:auto los recortaba dentro de la barra. */
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
    .asunto { border-bottom: 1px solid color-mix(in oklab, var(--border) 50%, transparent); }
    .asunto:focus-within { border-color: var(--primary); }
    .asunto input { width: 100%; height: 36px; border: 0; outline: none;
      background: transparent; color: var(--foreground); font-size: 14px; }
    .campos { background: color-mix(in oklab, var(--muted) 35%, transparent);
      border: 1px solid color-mix(in oklab, var(--border) 40%, transparent);
      border-radius: 10px; padding: 8px 10px; }
    .chip { display: inline-flex; align-items: center; border: 0; cursor: move;
      padding: 5px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 500;
      transition: transform .15s; }
    .chip:hover { transform: scale(1.05); }
    .zona { position: relative; background: #fff; flex: 1; min-height: 200px;
      display: flex; flex-direction: column;
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
    /* Lienzo TipTap (mismo look del prose de Dali). OJO encapsulación de
       Angular: el div .tiptap lo crea ProseMirror en runtime SIN el atributo
       de scoping del componente, así que sus reglas van con ::ng-deep — sin
       eso el editor nace SIN altura y el modal de envío se ve aplastado. El
       min-height también vive en el wrapper .lienzo (que sí es del template)
       como doble seguro. */
    .lienzo { background: #fff; flex: 1; min-height: 0; display: flex;
      flex-direction: column; }
    .lienzo > div { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    :host ::ng-deep .lienzo .tiptap { flex: 1; min-height: 0;
      overflow-y: auto; padding: 18px 20px 48px; color: #1f2937; outline: none;
      font-family: Arial, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.55; }
    :host ::ng-deep .lienzo .tiptap p { margin: 0 0 .6em; }
    :host ::ng-deep .lienzo .tiptap img { max-width: 100%; height: auto; }
    :host ::ng-deep .lienzo .tiptap ul { list-style: disc; padding-left: 1.4em; }
    :host ::ng-deep .lienzo .tiptap ol { list-style: decimal; padding-left: 1.4em; }
    :host ::ng-deep .lienzo .ProseMirror { outline: none; }
    textarea.codigo { display: block; width: 100%; flex: 1; min-height: 0;
      border: 0; border-radius: 6px; resize: none; padding: 14px 16px;
      background: #101613; color: #d1fae5;
      font-family: ui-monospace, Consolas, monospace; font-size: 12px; line-height: 1.5; }
    .panel { position: absolute; z-index: 40; margin-top: 4px; min-width: 150px;
      border: 1px solid var(--border); border-radius: 10px; padding: 4px;
      background: var(--background); box-shadow: 0 8px 24px rgb(0 0 0 / .16); }
    .panel button { display: block; width: 100%; text-align: left; border: 0;
      background: transparent; padding: 6px 10px; border-radius: 6px;
      font-size: 13px; color: var(--foreground); cursor: pointer; }
    .panel button:hover { background: color-mix(in oklab, var(--muted) 60%, transparent); }
    .panel.emoji-host { padding: 0; border: 0; background: transparent; box-shadow: none; }
    .colorA { position: relative; display: inline-flex; flex-direction: column;
      align-items: center; justify-content: center; }
    .colorA b { font-size: 13px; line-height: 1; font-weight: 700; }
    .colorA i { display: block; width: 14px; height: 3px; border-radius: 2px; margin-top: 1px; }
  `],
  template: `
    <div class="raiz relative flex min-h-0 flex-col gap-2">
      <!-- ── Barra (misma estructura del RichTextEditor de Dali) ── -->
      <div class="barra">
        <button type="button" class="tb" title="Negrita" (mousedown)="cmd($event, 'bold')"><b>B</b></button>
        <button type="button" class="tb italic" title="Cursiva" (mousedown)="cmd($event, 'italic')"><i>I</i></button>
        <button type="button" class="tb underline" title="Subrayado" (mousedown)="cmd($event, 'underline')"><u>U</u></button>
        <span class="sep"></span>

        <span class="relative pop-anchor">
          <button type="button" class="tb txt" (mousedown)="$event.preventDefault(); abrirPanel('fuente')">
            Fuente <lucide-icon name="chevron-down" [size]="12" />
          </button>
          @if (panel() === 'fuente') {
            <div class="panel">
              @for (f of fuentes; track f.value) {
                <button type="button" [style.fontFamily]="f.value" (mousedown)="setFuente($event, f.value)">{{ f.label }}</button>
              }
            </div>
          }
        </span>
        <span class="relative pop-anchor">
          <button type="button" class="tb txt" (mousedown)="$event.preventDefault(); abrirPanel('tamano')">
            Tamaño <lucide-icon name="chevron-down" [size]="12" />
          </button>
          @if (panel() === 'tamano') {
            <div class="panel">
              @for (t of tamanos; track t) {
                <button type="button" (mousedown)="setTamano($event, t)">{{ t }}</button>
              }
            </div>
          }
        </span>
        <span class="sep"></span>

        <label class="tb colorA" title="Color de texto">
          <b>A</b><i [style.background]="color()"></i>
          <input type="color" [value]="color()" (change)="setColor($any($event.target).value)"
                 style="position:absolute;inset:0;opacity:0;cursor:pointer;" />
        </label>
        <span class="sep"></span>

        <button type="button" class="tb" title="Lista" (mousedown)="cmd($event, 'bulletList')"><lucide-icon name="list" [size]="15" /></button>
        <button type="button" class="tb" title="Lista numerada" (mousedown)="cmd($event, 'orderedList')"><lucide-icon name="list-ordered" [size]="15" /></button>
        <span class="sep"></span>

        <button type="button" class="tb" title="Alinear izquierda" (mousedown)="alinear($event, 'left')"><lucide-icon name="align-left" [size]="15" /></button>
        <button type="button" class="tb" title="Centrar" (mousedown)="alinear($event, 'center')"><lucide-icon name="align-center" [size]="15" /></button>
        <button type="button" class="tb" title="Alinear derecha" (mousedown)="alinear($event, 'right')"><lucide-icon name="align-right" [size]="15" /></button>
        <button type="button" class="tb" title="Justificar" (mousedown)="alinear($event, 'justify')"><lucide-icon name="align-justify" [size]="15" /></button>
        <span class="sep"></span>

        <button type="button" class="tb" title="Insertar imagen" (mousedown)="imagen($event)"><lucide-icon name="image" [size]="15" /></button>
        <span class="relative pop-anchor">
          <button type="button" class="tb" title="Insertar emoji" (mousedown)="$event.preventDefault(); toggleEmoji()"><lucide-icon name="smile" [size]="15" /></button>
          <div class="panel emoji-host" [hidden]="panel() !== 'emoji'" #emojiHost></div>
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

      <!-- ── Asunto ── -->
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

      <!-- ── Banda de campos (chips de colores de Dali) ── -->
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

      <!-- ── Lienzo TipTap + conmutador Visual/HTML flotante ── -->
      <div class="zona">
        <div class="toggle">
          <button type="button" [class.on]="modo() === 'visual'" (click)="cambiarModo('visual')">
            <lucide-icon name="eye" [size]="12" /> Visual
          </button>
          <button type="button" [class.on]="modo() === 'html'" (click)="cambiarModo('html')">
            <lucide-icon name="code" [size]="12" /> HTML
          </button>
        </div>
        <div class="lienzo" [hidden]="modo() !== 'visual'" (click)="objetivo = 'cuerpo'">
          <div #lienzo></div>
        </div>
        @if (modo() === 'html') {
          <textarea
            class="codigo"
            [ngModel]="htmlCompleto()"
            (ngModelChange)="escribirHtml($event)"
            placeholder="Código HTML…"
            spellcheck="false"
            (focus)="objetivo = 'cuerpo'"
          ></textarea>
        }
      </div>
    </div>
  `,
})
export class EditorCorreoComponent implements OnDestroy {
  readonly asunto = model<string>('');
  readonly value = model<string>('');
  readonly variables = input<Record<string, string>>({});
  readonly conPlantillas = input<boolean>(true);
  readonly abrirPlantillas = output<void>();

  protected readonly modo = signal<'visual' | 'html'>('visual');
  protected readonly panel = signal<null | 'fuente' | 'tamano' | 'emoji'>(null);
  protected readonly color = signal('#000000');
  protected readonly camposVisibles = signal(false);
  protected readonly htmlCompleto = signal('');
  protected objetivo: 'asunto' | 'cuerpo' = 'cuerpo';

  protected readonly fuentes = FONT_FAMILIES;
  protected readonly tamanos = FONT_SIZES;

  private readonly lienzo = viewChild<ElementRef<HTMLDivElement>>('lienzo');
  private readonly emojiHost = viewChild<ElementRef<HTMLDivElement>>('emojiHost');

  private editor: Editor | null = null;
  private emojiPicker: unknown = null;
  private ultimoExterno = '';

  /** Cierra los popovers (fuente/tamaño/emoji) al hacer clic FUERA de su
      ancla — como en Dali. Los clics dentro del ancla (.pop-anchor) no
      cierran: ahí viven el botón y el propio panel/picker. */
  @HostListener('document:mousedown', ['$event'])
  protected cerrarPopovers(event: MouseEvent): void {
    if (this.panel() === null) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest?.('.pop-anchor')) this.panel.set(null);
  }
  // Preservación de head/style de plantillas HTML completas (como Dali).
  private estructura: ExtractedTemplate | null = null;

  constructor() {
    effect(() => {
      const el = this.lienzo()?.nativeElement;
      if (el && !this.editor) this.crearEditor(el);
    });
    effect(() => {
      const v = this.value() ?? '';
      if (v === this.ultimoExterno || !this.editor) return;
      this.ultimoExterno = v;
      this.editor.commands.setContent(this.cuerpoDe(v));
      this.htmlCompleto.set(v);
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  // ── Núcleo TipTap (las mismas extensiones del RichTextEditor de Dali) ──────
  private crearEditor(element: HTMLElement): void {
    this.editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        FontFamily,
        FontSize,
        TextAlign.configure({ types: ['paragraph'] }),
        LinkWithStyles.configure({ openOnClick: false }),
        SpanWithStyles,
        Image.configure({ inline: false, allowBase64: true }),
        PreserveStylesExtension,
        DivExtension,
        TableWithStyles,
        TableBody,
        TableRow,
        TableCell,
      ],
      content: this.cuerpoDe(this.value() ?? ''),
      editorProps: {
        attributes: { class: 'tiptap' },
      },
      onUpdate: ({ editor }) => {
        const completo = this.htmlDe(editor.getHTML());
        this.ultimoExterno = completo;
        this.htmlCompleto.set(completo);
        this.value.set(completo);
      },
      onFocus: () => { this.objetivo = 'cuerpo'; },
    });
    this.htmlCompleto.set(this.value() ?? '');
  }

  /** Extrae el body de un HTML completo, preservando head/style (Dali). */
  private cuerpoDe(html: string): string {
    const extraida = extractTemplateSections(html);
    if (extraida.hasFullStructure) {
      this.estructura = extraida;
      return extraida.bodyContent;
    }
    return html;
  }

  private htmlDe(body: string): string {
    if (this.estructura?.hasFullStructure) {
      return reconstructFullHtml(this.estructura, body);
    }
    return body;
  }

  protected listaVariables(): Array<{
    clave: string; etiqueta: string; titulo: string; bg: string; text: string;
  }> {
    return Object.entries(this.variables()).map(([clave, titulo], i) => {
      const c = CAMPO_COLORES[i % CAMPO_COLORES.length];
      return {
        clave,
        etiqueta: CAMPO_ETIQUETAS[clave] ?? clave,
        titulo: `${titulo} — inserta {{${clave}}}`,
        bg: c.bg,
        text: c.text,
      };
    });
  }

  protected abrirPanel(p: 'fuente' | 'tamano'): void {
    this.panel.set(this.panel() === p ? null : p);
  }

  protected cambiarModo(m: 'visual' | 'html'): void {
    this.panel.set(null);
    if (m === 'html' && this.editor) {
      this.htmlCompleto.set(this.htmlDe(this.editor.getHTML()));
    }
    if (m === 'visual' && this.editor) {
      this.editor.commands.setContent(this.cuerpoDe(this.htmlCompleto()));
    }
    this.modo.set(m);
  }

  protected escribirHtml(v: string): void {
    this.htmlCompleto.set(v);
    this.ultimoExterno = v;
    this.value.set(v);
  }

  // ── Comandos (idénticos a los chains de Dali) ───────────────────────────────
  protected cmd(ev: Event, que: 'bold' | 'italic' | 'underline' | 'bulletList' | 'orderedList'): void {
    ev.preventDefault();
    this.panel.set(null);
    const c = this.editor?.chain().focus();
    if (!c) return;
    ({
      bold: () => c.toggleBold(),
      italic: () => c.toggleItalic(),
      underline: () => c.toggleUnderline(),
      bulletList: () => c.toggleBulletList(),
      orderedList: () => c.toggleOrderedList(),
    })[que]().run();
  }

  protected alinear(ev: Event, dir: 'left' | 'center' | 'right' | 'justify'): void {
    ev.preventDefault();
    this.editor?.chain().focus().setTextAlign(dir).run();
  }

  protected setFuente(ev: Event, familia: string): void {
    ev.preventDefault();
    this.panel.set(null);
    this.editor?.chain().focus().setFontFamily(familia).run();
  }

  protected setTamano(ev: Event, px: string): void {
    ev.preventDefault();
    this.panel.set(null);
    this.editor?.chain().focus().setFontSize(px).run();
  }

  protected setColor(valor: string): void {
    this.color.set(valor);
    this.editor?.chain().focus().setColor(valor).run();
  }

  /** emoji-mart (la misma librería de Dali), montado perezosamente. */
  protected async toggleEmoji(): Promise<void> {
    if (this.panel() === 'emoji') {
      this.panel.set(null);
      return;
    }
    this.panel.set('emoji');
    if (this.emojiPicker) return;
    const host = this.emojiHost()?.nativeElement;
    if (!host) return;
    const [{ Picker }, dataMod, i18nMod] = await Promise.all([
      import('emoji-mart'),
      import('@emoji-mart/data'),
      import('@emoji-mart/data/i18n/es.json'),
    ]);
    this.emojiPicker = new Picker({
      data: (dataMod as { default?: unknown }).default ?? dataMod,
      i18n: (i18nMod as { default?: unknown }).default ?? i18nMod,
      locale: 'es',
      previewPosition: 'none',
      onEmojiSelect: (emoji: { native: string }) => {
        this.editor?.chain().focus().insertContent(emoji.native).run();
        this.panel.set(null);
      },
    });
    host.appendChild(this.emojiPicker as unknown as Node);
  }

  protected enBlanco(ev: Event): void {
    ev.preventDefault();
    this.asunto.set('');
    this.estructura = null;
    this.editor?.commands.setContent('');
    this.htmlCompleto.set('');
    this.ultimoExterno = '';
    this.value.set('');
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
        this.editor?.chain().focus().setImage({ src: String(r.result) }).run();
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

  insertarTexto(texto: string): void {
    if (this.modo() === 'html') {
      this.escribirHtml(this.htmlCompleto() + texto);
      return;
    }
    this.editor?.chain().focus().insertContent(texto).run();
  }

  /** Reemplaza asunto+cuerpo (al elegir una plantilla de la galería). */
  cargar(asunto: string, cuerpoHtml: string): void {
    this.asunto.set(asunto);
    this.ultimoExterno = cuerpoHtml;
    this.htmlCompleto.set(cuerpoHtml);
    this.value.set(cuerpoHtml);
    this.estructura = null;
    this.editor?.commands.setContent(this.cuerpoDe(cuerpoHtml));
  }
}
