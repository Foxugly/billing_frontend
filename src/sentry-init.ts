/**
 * Initialisation de Sentry AVANT le bootstrap Angular (importé en tête de
 * main.ts) afin de capter les erreurs survenant pendant l'init de l'app.
 * Aligné sur PushIT_frontend (audit billing 2026-10-18, M9).
 *
 * Les valeurs viennent de la config runtime (`window.__BILLING__`, injectée par
 * nginx depuis SSM). DSN vide (dev, ou SSM non seedé) : `Sentry.init` n'est pas
 * appelé, le SDK reste inerte, aucun appel réseau.
 *
 * Erreurs seulement, pas de tracing : le tracing ajouterait les en-têtes
 * `sentry-trace`/`baggage` aux appels vers billing-api, que sa politique CORS
 * n'autorise pas — la console tomberait sur un préflight refusé.
 */
import * as Sentry from '@sentry/angular';

import { getRuntimeConfig } from './app/core/runtime-config';
import { scrubBreadcrumb, scrubEvent } from './app/core/sentry-scrub';

const config = getRuntimeConfig();

if (config.sentryDsn) {
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
}
