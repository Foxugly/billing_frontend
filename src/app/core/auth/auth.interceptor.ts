import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/** Chemins d'authentification : y attacher le jeton créerait une boucle. */
const AUTH_PATHS = ['/api/v1/auth/token/', '/api/v1/auth/token/refresh/'];

/**
 * Attache le jeton d'accès, et retente **une seule fois** après un 401 en
 * rafraîchissant. Une seule tentative : si le refresh échoue aussi, insister
 * ferait boucler l'interface au lieu de renvoyer l'opérateur au login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (AUTH_PATHS.some((path) => req.url.includes(path))) {
    return next(req);
  }

  const withToken = (token: string | null) =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(withToken(auth.accessToken())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return from(auth.refresh()).pipe(
        switchMap((ok) => {
          if (!ok) {
            auth.logout();
            return throwError(() => error);
          }
          return next(withToken(auth.accessToken()));
        }),
      );
    }),
  );
};
