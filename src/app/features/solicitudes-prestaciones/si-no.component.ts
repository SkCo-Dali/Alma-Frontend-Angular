// Respuesta Sí / No del cliente. Sin responder es un estado válido (null): el formato no se
// diligencia por el cliente, así que nada se marca por defecto. Volver a pulsar la opción
// elegida la deja sin responder.

import { Component, input, model } from '@angular/core';

@Component({
  selector: 'alma-si-no',
  template: `
    <div class="inline-flex overflow-hidden rounded-lg border border-border" role="radiogroup" [attr.aria-label]="rotulo()">
      <button
        type="button"
        role="radio"
        [attr.id]="id() || null"
        [attr.aria-checked]="valor() === true"
        class="h-8 min-w-12 px-3 text-sm font-medium transition-colors"
        [class]="valor() === true ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-accent/60'"
        (click)="valor.set(valor() === true ? null : true)"
      >Sí</button>
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="valor() === false"
        class="h-8 min-w-12 border-l border-border px-3 text-sm font-medium transition-colors"
        [class]="valor() === false ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-accent/60'"
        (click)="valor.set(valor() === false ? null : false)"
      >No</button>
    </div>
  `,
})
export class SiNoComponent {
  readonly valor = model<boolean | null | undefined>(null);
  readonly rotulo = input('');
  readonly id = input('');
}
