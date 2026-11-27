// De dónde toman sus springs las piezas de movimiento compartidas
// (novaPress, nova-dialog…).
//
// Por defecto, lo publicado para toda la app (MotionConfigService). El
// laboratorio /lab/motion provee su borrador en su lugar, para que sus
// controles muevan también los componentes reales mientras se previsualiza.

import { InjectionToken, inject } from '@angular/core';
import { MotionConfigService } from './motion-config.service';
import { SpringName, SpringParams } from './spring';

export interface SpringSource {
  spring(nombre: SpringName): SpringParams;
}

export const SPRING_SOURCE = new InjectionToken<SpringSource>('SPRING_SOURCE', {
  providedIn: 'root',
  factory: () => inject(MotionConfigService),
});
