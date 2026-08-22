// Guarda de la consola /admin (paridad con el <Navigate to="/"> del React):
// entran los admins de plataforma (platform.access/audit/metrics) y los admins
// de App (permiso comodín app.<slug>.*).

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const esAdminDeApp = auth
    .user()
    .permissions.some((p) => p.startsWith('app.') && p.endsWith('.*'));
  const puede =
    auth.hasPermission('platform.access.view') ||
    auth.hasPermission('platform.audit.view') ||
    auth.hasPermission('platform.metrics.view') ||
    esAdminDeApp;
  return puede ? true : router.createUrlTree(['/']);
};
