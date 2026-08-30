// Editor enriquecido de plantillas de correo — réplica del editor del módulo
// de correos de Dali: barra de formato (negrita/cursiva/subrayado, fuente,
// tamaño, color, listas, alineación, imagen, emoji), "En Blanco", alternador
// Visual/HTML y campos dinámicos insertables al cursor (clic o arrastre).
// El HTML resultante se guarda tal cual; las variables {{clave}} las renderiza
// el backend con los datos reales de la cotización al enviar.

import {
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

const FUENTES = ['Segoe UI', 'Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'Courier New'];
// execCommand fontSize usa 1–7; etiquetas legibles como en Dali.
const TAMANOS: Array<[string, string]> = [
  ['1', 'Muy pequeño'], ['2', 'Pequeño'], ['3', 'Normal'],
  ['4', 'Mediano'], ['5', 'Grande'], ['6', 'Muy grande'], ['7', 'Enorme'],
];
const EMOJIS = ['😀', '🙂', '👍', '🙏', '🎉', '✅', '⚠️', '📌', '📎', '📅', '💚', '🌱', '💼', '📈', '☂️', '🛡️'];

@Component({
  selector: 'alma-editor-correo',
  imports: [FormsModule, LucideAngularModule],
  styles: [`
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px;
      border: 1px solid var(--border); border-bottom: 0; border-radius: 12px 12px 0 0;
      padding: 6px 8px; background: color-mix(in oklab, var(--muted) 22%, transparent); }
    .tb { display: inline-flex; align-items: center; justify-content: center;
      min-width: 30px; height: 30px; padding: 0 7px; border-radius: 8px; border: 0;
      background: transparent; color: var(--foreground); cursor: pointer; font-size: 13px; }
    .tb:hover { background: color-mix(in oklab, var(--muted) 55%, transparent); }
    .tb.on { background: var(--primary); color: #fff; }
    .tb-sep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
    select.tb-sel { height: 30px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--background); color: var(--foreground); font-size: 12.5px; padding: 0 4px; }
    .lienzo { min-height: 260px; max-height: 46vh; overflow-y: auto;
      border: 1px solid var(--border); border-radius: 0 0 12px 12px; padding: 14px 16px;
      background: #fff; color: #1c1c1c; font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 14px; line-height: 1.5; }
    .lienzo:focus { outline: 2px solid var(--primary); outline-offset: -2px; }
    textarea.html { min-height: 260px; max-height: 46vh; width: 100%; resize: vertical;
      border: 1px solid var(--border); border-radius: 0 0 12px 12px; padding: 12px 14px;
      background: var(--background); color: var(--foreground);
      font-family: ui-monospace, Consolas, monospace; font-size: 12px; line-height: 1.5; }
    .emoji-pop { position: absolute; z-index: 30; margin-top: 4px; display: grid;
      grid-template-columns: repeat(8, 30px); gap: 2px; padding: 8px;
      border: 1px solid var(--border); border-radius: 12px; background: var(--background);
      box-shadow: 0 8px 24px rgb(0 0 0 / .18); }
    .emoji-pop button { border: 0; background: transparent; font-size: 17px;
      height: 30px; border-radius: 6px; cursor: pointer; }
    .emoji-pop button:hover { background: color-mix(in oklab, var(--muted) 55%, transparent); }
  `],
  template: `
    <div class="relative">
      <div class="toolbar">
        <button type="button" class="tb font-bold" title="Negrita" (mousedown)="cmd($event, 'bold')">B</button>
        <button type="button" class="tb italic" title="Cursiva" (mousedown)="cmd($event, 'italic')">I</button>
        <button type="button" class="tb underline" title="Subrayado" (mousedown)="cmd($event, 'underline')">U</button>
        <span class="tb-sep"></span>
        <select class="tb-sel" title="Fuente" (change)="cmdValor('fontName', $any($event.target).value); $any($event.target).value=''">
          <option value="" disabled selected>Fuente</option>
          @for (f of fuentes; track f) { <option [value]="f">{{ f }}</option> }
        </select>
        <select class="tb-sel" title="Tamaño" (change)="cmdValor('fontSize', $any($event.target).value); $any($event.target).value=''">
          <option value="" disabled selected>Tamaño</option>
          @for (t of tamanos; track t[0]) { <option [value]="t[0]">{{ t[1] }}</option> }
        </select>
        <label class="tb" title="Color de texto" style="padding:0 4px;">
          <lucide-icon name="baseline" [size]="15" />
          <input type="color" (change)="cmdValor('foreColor', $any($event.target).value)"
                 style="width:18px;height:18px;border:0;background:transparent;padding:0;margin-left:2px;cursor:pointer;" />
        </label>
        <span class="tb-sep"></span>
        <button type="button" class="tb" title="Lista con viñetas" (mousedown)="cmd($event, 'insertUnorderedList')"><lucide-icon name="list" [size]="16" /></button>
        <button type="button" class="tb" title="Lista numerada" (mousedown)="cmd($event, 'insertOrderedList')"><lucide-icon name="list-ordered" [size]="16" /></button>
        <span class="tb-sep"></span>
        <button type="button" class="tb" title="Alinear a la izquierda" (mousedown)="cmd($event, 'justifyLeft')"><lucide-icon name="align-left" [size]="16" /></button>
        <button type="button" class="tb" title="Centrar" (mousedown)="cmd($event, 'justifyCenter')"><lucide-icon name="align-center" [size]="16" /></button>
        <button type="button" class="tb" title="Alinear a la derecha" (mousedown)="cmd($event, 'justifyRight')"><lucide-icon name="align-right" [size]="16" /></button>
        <button type="button" class="tb" title="Justificar" (mousedown)="cmd($event, 'justifyFull')"><lucide-icon name="align-justify" [size]="16" /></button>
        <span class="tb-sep"></span>
        <button type="button" class="tb" title="Insertar imagen (URL o archivo)" (mousedown)="imagen($event)"><lucide-icon name="image" [size]="16" /></button>
        <button type="button" class="tb" title="Emoji" (mousedown)="$event.preventDefault(); emojiAbierto.set(!emojiAbierto())"><lucide-icon name="smile" [size]="16" /></button>
        <span class="tb-sep"></span>
        <button type="button" class="tb" title="Vaciar el contenido" (mousedown)="enBlanco($event)">
          <lucide-icon name="eraser" [size]="15" />&nbsp;En Blanco
        </button>
        <span style="flex:1"></span>
        <button type="button" class="tb" [class.on]="modo() === 'visual'" (click)="cambiarModo('visual')">
          <lucide-icon name="eye" [size]="14" />&nbsp;Visual
        </button>
        <button type="button" class="tb" [class.on]="modo() === 'html'" (click)="cambiarModo('html')">
          <lucide-icon name="code" [size]="14" />&nbsp;HTML
        </button>
      </div>

      @if (emojiAbierto()) {
        <div class="emoji-pop">
          @for (e of emojis; track e) {
            <button type="button" (mousedown)="insertarEmoji($event, e)">{{ e }}</button>
          }
        </div>
      }

      @if (modo() === 'visual') {
        <!-- El correo se ve sobre blanco (como lo verá el destinatario). -->
        <div
          #lienzo
          class="lienzo"
          contenteditable="true"
          (input)="sincronizarDesdeVisual()"
          (focus)="focusEditor.emit()"
        ></div>
      } @else {
        <textarea
          class="html"
          [ngModel]="valorHtml()"
          (ngModelChange)="escribirHtml($event)"
          (focus)="focusEditor.emit()"
          spellcheck="false"
        ></textarea>
      }
    </div>
  `,
})
export class EditorCorreoComponent {
  /** HTML inicial (se re-aplica cuando cambia desde afuera). */
  readonly value = input<string>('');
  readonly valueChange = output<string>();
  /** El padre lo usa para dirigir la inserción de campos (asunto vs cuerpo). */
  readonly focusEditor = output<void>();

  protected readonly modo = signal<'visual' | 'html'>('visual');
  protected readonly valorHtml = signal<string>('');
  protected readonly emojiAbierto = signal(false);
  protected readonly fuentes = FUENTES;
  protected readonly tamanos = TAMANOS;
  protected readonly emojis = EMOJIS;

  private readonly lienzo = viewChild<ElementRef<HTMLDivElement>>('lienzo');
  private ultimoValueExterno = '';

  constructor() {
    // input() no es two-way: cuando el padre cambia `value` (abrir otra
    // plantilla), se re-pinta el lienzo; las ediciones propias no rebotan
    // porque `ultimoValueExterno` las filtra.
    effect(() => {
      this.value();
      this.aplicarValorExterno();
    });
  }

  private aplicarValorExterno(): void {
    const v = this.value() ?? '';
    if (v === this.ultimoValueExterno) return;
    this.ultimoValueExterno = v;
    this.valorHtml.set(v);
    queueMicrotask(() => {
      const el = this.lienzo()?.nativeElement;
      if (el && el.innerHTML !== v) el.innerHTML = v;
    });
  }

  private emitir(html: string): void {
    this.valorHtml.set(html);
    this.ultimoValueExterno = html;
    this.valueChange.emit(html);
  }

  protected sincronizarDesdeVisual(): void {
    const el = this.lienzo()?.nativeElement;
    if (el) this.emitir(el.innerHTML);
  }

  protected escribirHtml(v: string): void {
    this.emitir(v);
  }

  protected cambiarModo(m: 'visual' | 'html'): void {
    this.modo.set(m);
    this.emojiAbierto.set(false);
    if (m === 'visual') {
      queueMicrotask(() => {
        const el = this.lienzo()?.nativeElement;
        if (el) el.innerHTML = this.valorHtml();
      });
    }
  }

  /** mousedown + preventDefault conserva la selección del lienzo. */
  protected cmd(ev: Event, comando: string): void {
    ev.preventDefault();
    document.execCommand(comando, false);
    this.sincronizarDesdeVisual();
  }

  protected cmdValor(comando: string, valor: string): void {
    if (!valor) return;
    this.lienzo()?.nativeElement.focus();
    document.execCommand(comando, false, valor);
    this.sincronizarDesdeVisual();
  }

  protected insertarEmoji(ev: Event, emoji: string): void {
    ev.preventDefault();
    this.emojiAbierto.set(false);
    this.insertarTexto(emoji);
  }

  protected enBlanco(ev: Event): void {
    ev.preventDefault();
    const el = this.lienzo()?.nativeElement;
    if (el) el.innerHTML = '';
    this.emitir('');
  }

  protected imagen(ev: Event): void {
    ev.preventDefault();
    const url = window.prompt(
      'URL de la imagen (o deja vacío para subir un archivo):', '');
    if (url === null) return;
    if (url.trim()) {
      document.execCommand('insertImage', false, url.trim());
      this.sincronizarDesdeVisual();
      return;
    }
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
        this.sincronizarDesdeVisual();
      };
      r.readAsDataURL(f);
    };
    inp.click();
  }

  /** Inserta texto en el cursor del modo activo (lo usan los chips de campos). */
  insertarTexto(texto: string): void {
    if (this.modo() === 'html') {
      this.emitir(this.valorHtml() + texto);
      return;
    }
    const el = this.lienzo()?.nativeElement;
    if (!el) return;
    el.focus();
    document.execCommand('insertText', false, texto);
    this.sincronizarDesdeVisual();
  }
}
