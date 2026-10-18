/**
 * Identité du build, figée à la compilation.
 *
 * `BILLING_BUILD_SHA` est remplacé par esbuild quand la CI passe
 * `ng build --define BILLING_BUILD_SHA="'<sha>'"` (cf. deploy.yml). Hors CI (dev,
 * tests unitaires), le symbole n'est pas défini : le `typeof` évite la
 * ReferenceError et on retombe sur une chaîne vide.
 */
declare const BILLING_BUILD_SHA: string | undefined;

export const BUILD_SHA: string =
  typeof BILLING_BUILD_SHA === 'string' ? BILLING_BUILD_SHA.trim() : '';

/** Nom de release Sentry : `billing-frontend@<sha>` (même schéma que PushIT_frontend). */
export function sentryReleaseFor(sha: string): string {
  return `billing-frontend@${sha}`;
}
