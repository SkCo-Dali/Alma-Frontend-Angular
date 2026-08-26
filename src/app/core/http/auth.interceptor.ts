// Adjunta el Bearer token de Entra a toda petición hacia el backend de Alma
// (mismo origen que environment.apiUrl). Las peticiones a otros orígenes
// (Microsoft Graph, apps remotas con su propia base) pasan sin tocar: cada
// una gestiona su propio token (ver AuthService.getAccessToken/getDirectoryToken).
//
// Nota de arquitectura: el lineamiento de la organización pide además un
// interceptor de cifrado JWE (`encryptInterceptorSkLibrary`, Sensedia). Esa
// librería vive en el mismo feed privado que sk-components-angular y no está
// disponible en este entorno — ver docs/design-system-adoption.md. Este
// interceptor sólo resuelve la autenticación; el cifrado queda pendiente de
// esa dependencia.

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from '../auth/auth.service';

const API_BASE_URL = environment.apiUrl.replace(/\/+$/, '');

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE_URL)) {
    return next(req);
  }

  const auth = inject(AuthService);
  return from(auth.getAccessToken()).pipe(
    switchMap((token) => {
      if (!token) return next(req);
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    }),
  );
};
