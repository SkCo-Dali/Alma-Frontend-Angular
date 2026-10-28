// Aviso de buenas prácticas para las cuentas genéricas conectadas con la cuenta
// del buzón (su propio inicio de sesión, sin consentimiento de administrador).
// Se muestra en el asistente antes de conectar y en Ajustes mientras siga así.

import { Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { BUENAS_PRACTICAS_CUENTA_BUZON } from './buzon.api';

@Component({
  selector: 'alma-aviso-cuenta-buzon',
  imports: [LucideAngularModule],
  styleUrls: ['./buzon-proto.css'],
  template: `
    <div class="note b-amber" role="note">
      <lucide-icon name="shield-alert" [size]="13" />
      <div style="display:grid;gap:4px">
        <span class="b">Buenas prácticas al usar la cuenta de {{ direccion() || 'la genérica' }}</span>
        <ul style="margin:0;padding-left:16px;display:grid;gap:2px">
          @for (p of practicas; track p) {
            <li>{{ p }}</li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class AvisoCuentaBuzonComponent {
  readonly direccion = input<string>('');
  protected readonly practicas = BUENAS_PRACTICAS_CUENTA_BUZON;
}
