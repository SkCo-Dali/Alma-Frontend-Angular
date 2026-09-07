// Render del cuerpo HTML del correo en un iframe AISLADO.
//  - sandbox="" (sin allow-*): nada de scripts, formularios ni navegación; el CSS
//    y el HTML del correo no pueden ver ni tocar la app.
//  - CSP inyectada en el srcdoc: bloquea recursos remotos (píxeles de rastreo,
//    imágenes externas) por defecto; el visor puede permitirlos con `loadRemote`.
//  - Las imágenes inline (cid:) ya vienen embebidas como data URLs (siempre visibles).

import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'alma-email-frame',
  template: `
    <iframe
      [srcdoc]="srcdoc()"
      sandbox=""
      referrerpolicy="no-referrer"
      title="Contenido del correo"
      class="h-full w-full border-0 bg-white"
    ></iframe>
  `,
  styles: `:host { display: block; height: 100%; }`,
})
export class EmailFrameComponent {
  readonly html = input<string | null>(null);
  /** Si true, la CSP permite cargar imágenes/recursos remotos del correo. */
  readonly loadRemote = input(false);

  private readonly sanitizer = inject(DomSanitizer);

  protected readonly srcdoc = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.documento(this.html() ?? '', this.loadRemote())),
  );

  private documento(cuerpo: string, remoto: boolean): string {
    const img = remoto ? 'data: https: http:' : 'data:';
    const font = remoto ? 'data: https: http:' : 'data:';
    // default-src 'none' ⇒ sin scripts ni conexiones; solo lo que habilitamos.
    const csp = [
      `default-src 'none'`,
      `img-src ${img}`,
      `media-src ${img}`,
      `style-src 'unsafe-inline'`,
      `font-src ${font}`,
    ].join('; ');
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<base target="_blank">
<style>
  html,body{margin:0}
  body{padding:20px;background:#fff;color:#111;
    font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    font-size:14px;line-height:1.5;-webkit-text-size-adjust:100%;word-break:break-word}
  img{max-width:100%;height:auto}
  a{color:#0a66c2}
  table{max-width:100%}
</style></head><body>${cuerpo}</body></html>`;
  }
}
