// Página de la app Agente Alma (paridad con routes/apps.agente-alma.tsx v2 — sin miga).

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
