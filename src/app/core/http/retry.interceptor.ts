// Retry con backoff exponencial ante 5xx/errores de red — mismo
// comportamiento que tenía `ComisionesHttp.fetchConRetry` antes de la
// migración a HttpClient (3 intentos, 2^i·1000ms). Opt-in vía HttpContext
// para no cambiar el comportamiento de las peticiones que nunca lo tuvieron
// (todo lo que pasa por ApiService).

import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError, timer } from 'rxjs';
import { retry } from 'rxjs/operators';

export const WITH_RETRY = new HttpContextToken<boolean>(() => false);

const RETRIES = 3;

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.context.get(WITH_RETRY)) {
    return next(req);
  }

  return next(req).pipe(
    retry({
      count: RETRIES - 1,
      delay: (error: unknown, retryCount: number) => {
        // Solo 5xx y errores de red (status 0); un 4xx se propaga tal cual.
        if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
          return throwError(() => error);
        }
        return timer(2 ** (retryCount - 1) * 1000);
      },
    }),
  );
};
