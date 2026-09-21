// Render del cuerpo HTML del correo en un iframe AISLADO.
//  - sandbox="" (sin allow-*): nada de scripts, formularios ni navegación; el CSS
//    y el HTML del correo no pueden ver ni tocar la app.
//  - CSP inyectada en el srcdoc: bloquea recursos remotos (píxeles de rastreo,
//    imágenes externas). NO es opcional: el visor audita qué se envió, y cargar
//    los recursos le avisaría al remitente que alguien está mirando el mensaje.
//  - Las imágenes inline (cid:) ya vienen embebidas como data URLs (siempre visibles).
//
// Hubo un input `loadRemote` que levantaba esta CSP. Se quitó porque NO PODÍA
// FUNCIONAR: un iframe con `srcdoc` hereda la CSP de la página que lo contiene,
// y la de Alma solo admite 'self', data:, blob: y dos dominios corporativos. Las
// dos políticas se intersectan, así que el botón «Cargar imágenes» prometía algo
// que el navegador bloqueaba de todos modos.

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

  private readonly sanitizer = inject(DomSanitizer);

  protected readonly srcdoc = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.documento(this.html() ?? '')),
  );

  private documento(cuerpo: string): string {
    // default-src 'none' ⇒ sin scripts ni conexiones; solo lo que habilitamos.
    const csp = [
      `default-src 'none'`,
      `img-src data:`,
      `media-src data:`,
      `style-src 'unsafe-inline'`,
      `font-src data:`,
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
  /* Imagen remota no cargada (ver eml.service): se deja el hueco con el texto
     alternativo, para que se vea que falta algo a propósito y no que el correo
     enviado estuviera roto. */
  img[data-remoto]{min-width:24px;min-height:24px;box-sizing:border-box;
    border:1px dashed #cbd5e1;border-radius:4px;background:#f8fafc;
    padding:2px;color:#94a3b8;font-size:11px;font-style:italic}
  a{color:#0a66c2}
  table{max-width:100%}
</style></head><body>${cuerpo}</body></html>`;
  }
}
