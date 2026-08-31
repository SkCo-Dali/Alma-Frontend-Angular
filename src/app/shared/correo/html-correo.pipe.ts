// Render fiel del HTML de correos/plantillas de Suscripción. El sanitizador
// de Angular quita los estilos inline y aplana las tablas de las plantillas
// brandeadas (estructura tipo correo de 600px); Dali las renderiza sin
// sanitizar (dangerouslySetInnerHTML). Este HTML es interno: viene de
// suscripcion.CorreoPlantillas (editable solo con solicitudes.manage) o del
// propio editor del usuario — nunca de un tercero.

import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'htmlCorreo' })
export class HtmlCorreoPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(html: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html ?? '');
  }
}
