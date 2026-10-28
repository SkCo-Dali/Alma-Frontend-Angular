// Aviso para las cuentas genéricas: se conectan iniciando sesión con la cuenta
// del buzón (igual que las personales). Se muestra en el asistente antes de
// conectar y en Ajustes.

import { Component } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'alma-aviso-cuenta-buzon',
  imports: [LucideAngularModule],
  styleUrls: ['./buzon-proto.css'],
  template: `
    <p class="note b-amber" role="note">
      <lucide-icon name="shield-alert" [size]="13" />
      <span>
        <b>Inicia sesión con la cuenta del buzón, no con la tuya.</b> Su contraseña y MFA los custodia el responsable
        del área: no los compartas. Si cambian, reconecta el buzón desde Ajustes.
      </span>
    </p>
  `,
})
export class AvisoCuentaBuzonComponent {}
