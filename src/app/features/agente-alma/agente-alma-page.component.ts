// Página de la app Agente Alma.

import { Component } from '@angular/core';
import { ChatAgenteComponent } from './chat-agente.component';

@Component({
  selector: 'alma-agente-page',
  imports: [ChatAgenteComponent],
  template: `
    <div class="flex flex-col gap-4">
      <alma-chat-agente />
    </div>
  `,
})
export class AgenteAlmaPageComponent {}
