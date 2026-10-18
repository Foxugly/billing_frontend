/**
 * Retire des événements Sentry ce qui ouvrirait la console à qui les lit.
 *
 * La console pilote Stripe en live : un jeton d'opérateur (JWT d'accès ou de
 * refresh) qui fuit dans un message d'erreur, un breadcrumb ou une URL suffit à
 * l'usurper. On masque donc tout JWT et tout `Bearer …` où qu'ils apparaissent,
 * les paramètres d'URL sensibles, et on retire les en-têtes `Authorization` et
 * les cookies. `sendDefaultPii: false` (sentry-init.ts) couvre le reste.
 */
import type { Breadcrumb, Event } from '@sentry/angular';

export const FILTERED = '[Filtered]';

const JWT = /eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g;
const BEARER = /(Bearer\s+)[^\s"',]+/gi;
const SENSITIVE_QUERY =
  /([?&](?:token|access|refresh|code|secret|shared_secret|password|key|sentry_key)=)[^&#\s"']*/gi;

/** Masque JWT, jetons Bearer et paramètres sensibles dans une chaîne. */
export function scrubText(value: string): string;
export function scrubText(value: string | undefined): string | undefined;
export function scrubText(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  return value
    .replace(BEARER, (_m, prefix: string) => `${prefix}${FILTERED}`)
    .replace(JWT, FILTERED)
    .replace(SENSITIVE_QUERY, (_m, prefix: string) => `${prefix}${FILTERED}`);
}

/** Parcourt récursivement un objet de données et masque chaque chaîne. */
function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > 6 || value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return scrubText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubDeep(item, depth + 1)) as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = scrubDeep(item, depth + 1);
    }
    return out as T;
  }
  return value;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.message) {
    breadcrumb.message = scrubText(breadcrumb.message);
  }
  if (breadcrumb.data) {
    breadcrumb.data = scrubDeep(breadcrumb.data);
  }
  return breadcrumb;
}

/** Nettoie les champs communs aux erreurs et aux transactions. */
export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) {
    event.request.url = scrubText(event.request.url);
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = scrubText(`?${event.request.query_string}`).slice(1);
    }
    if (event.request.headers) {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(event.request.headers)) {
        if (name.toLowerCase() === 'authorization' || name.toLowerCase() === 'cookie') {
          continue;
        }
        headers[name] = scrubText(value);
      }
      event.request.headers = headers;
    }
    delete event.request.cookies;
    delete event.request.data;
  }
  if (event.message) {
    event.message = scrubText(event.message);
  }
  if (event.transaction) {
    event.transaction = scrubText(event.transaction);
  }
  for (const exception of event.exception?.values ?? []) {
    exception.value = scrubText(exception.value);
  }
  event.breadcrumbs?.forEach(scrubBreadcrumb);
  if (event.extra) {
    event.extra = scrubDeep(event.extra);
  }
  if (event.contexts) {
    event.contexts = scrubDeep(event.contexts);
  }
  return event;
}
