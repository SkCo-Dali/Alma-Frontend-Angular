// Estado del Launchpad (la vista de "Todas las aplicaciones"). Vive en un
// servicio de raíz porque lo abren varios lugares del shell: el Dock, el botón
// de cuadrícula del header y el chip "Más acciones" del inicio.

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LaunchpadService {
  readonly open = signal(false);
}
