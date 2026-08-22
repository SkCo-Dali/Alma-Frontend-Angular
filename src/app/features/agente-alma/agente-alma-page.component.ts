// Página de la app Agente Alma (paridad con routes/apps.agente-alma.tsx).

import { Component } from '@angular/core';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb.component';
import { ChatAgenteComponent } from './chat-agente.component';

@Component({
  selector: 'alma-agente-page',
  imports: [BreadcrumbComponent, ChatAgenteComponent],
  template: `
    <div class="flex flex-col gap-4">
      <alma-breadcrumb current="Agente Alma" />
      <alma-chat-agente />
    </div>
  `,
})
export class AgenteAlmaPageComponent {}
