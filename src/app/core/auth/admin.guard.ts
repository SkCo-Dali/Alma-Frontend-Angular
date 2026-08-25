// Guarda de la consola /admin: entran los admins de plataforma
// (platform.access/audit/metrics) y los admins de App (permiso comodín app.<slug>.*).
//
// Espera a que la sesión RESUELVA antes de decidir: en navegación directa por URL
// (o al recargar en /admin) los permisos aún no están cargados —status 'loading'—
// y evaluar de inmediato redirigía al home aunque el usuario sí tuviera acceso.

import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.status).pipe(
    // 'loading' = sesión aún resolviendo; esperamos a un estado definitivo.
    filter((estado) => estado !== 'loading'),
    take(1),
    map(() => {
      const esAdminDeApp = auth
        .user()
        .permissions.some((p) => p.startsWith('app.') && p.endsWith('.*'));
      const puede =
        auth.hasPermission('platform.access.view') ||
        auth.hasPermission('platform.audit.view') ||
        auth.hasPermission('platform.metrics.view') ||
        esAdminDeApp;
      return puede ? true : router.createUrlTree(['/']);
    }),
  );
};
