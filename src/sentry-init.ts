/**
 * Sentry, chargé à la demande : le SDK (`@sentry/angular`) n'est plus dans le
 * bundle initial — il arrive par `import()` dynamique, et seulement si un DSN est
 * configuré. Les erreurs survenues avant la fin du chargement attendent sur la
 * promesse puis partent dans l'ordre ; sans DSN, rien n'est chargé ni envoyé.
 *
 * `initSentry()` est appelé en tête de main.ts, avant le bootstrap Angular, pour
 * lancer le chargement au plus tôt. Aligné sur PushIT_frontend (audit billing
 * 2026-10-18, M9).
 *
 * Les valeurs viennent de la config runtime (`window.__BILLING__`, injectée par
 * nginx depuis SSM). DSN vide (dev, ou SSM non seedé) : le SDK n'est même pas
 * téléchargé, aucun appel réseau.
 *
 * Erreurs seulement, pas de tracing : le tracing ajouterait les en-têtes
 * `sentry-trace`/`baggage` aux appels vers billing-api, que sa politique CORS
 * n'autorise pas — la console tomberait sur un préflight refusé.
 */
import { ErrorHandler, Injectable } from '@angular/core';
import type { SeverityLevel } from '@sentry/angular';

import { getRuntimeConfig } from './app/core/runtime-config';
import { scrubBreadcrumb, scrubEvent } from './app/core/sentry-scrub';

type SentrySdk = typeof import('@sentry/angular');

let sdk: Promise<SentrySdk | null> | null = null;

/** Lance (une seule fois) le chargement et l'initialisation du SDK. */
export function initSentry(): Promise<SentrySdk | null> {
  if (sdk) {
    return sdk;
  }
  const config = getRuntimeConfig();
  if (!config.sentryDsn) {
    sdk = Promise.resolve(null);
    return sdk;
  }
  sdk = import('@sentry/angular')
    .then((Sentry) => {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: config.sentryEnv,
        release: config.sentryRelease || undefined,
        sendDefaultPii: false,
        // Jetons d'opérateur, en-têtes Authorization et paramètres sensibles masqués
        // dans les URL, messages, exceptions et breadcrumbs (sentry-scrub.ts).
        beforeSend: (event) => scrubEvent(event),
        beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
      });
      return Sentry;
    })
    .catch((err: unknown) => {
      // Chunk introuvable (déploiement entre deux chargements, réseau) : la
      // console doit continuer à fonctionner, sans remontée d'erreurs.
      console.error('Sentry indisponible', err);
      return null;
    });
  return sdk;
}

export function captureException(error: unknown): void {
  void initSentry().then((Sentry) => Sentry?.captureException(error));
}

export function captureMessage(message: string, level: SeverityLevel): void {
  void initSentry().then((Sentry) => Sentry?.captureMessage(message, level));
}

/**
 * Remplace `Sentry.createErrorHandler()` : journalise comme l'ErrorHandler
 * d'Angular, puis remonte l'erreur à Sentry une fois le SDK chargé.
 */
@Injectable()
export class LazySentryErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error(error);
    captureException(error);
  }
}
