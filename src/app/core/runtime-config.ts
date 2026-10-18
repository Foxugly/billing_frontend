/**
 * Configuration injectée au déploiement, jamais compilée dans le bundle.
 *
 * nginx substitue ces valeurs dans index.html à partir de `/billing-frontend/prod`
 * (SSM) : le même bundle peut donc être promu d'un environnement à l'autre sans
 * être reconstruit. C'est la convention de la flotte (OPERATIONS.md §3.14).
 */
import { BUILD_SHA, sentryReleaseFor } from './build-info';

export interface RuntimeConfig {
  apiBaseUrl: string;
  sentryDsn: string;
  sentryEnv: string;
  version: string;
  /** Release Sentry résolue (cf. resolveSentryRelease) ; vide = non renseignée. */
  sentryRelease: string;
}

declare global {
  interface Window {
    __BILLING__?: Partial<Omit<RuntimeConfig, 'sentryRelease'>>;
  }
}

const FALLBACK: RuntimeConfig = {
  // Repli de développement uniquement : en production nginx a toujours substitué.
  apiBaseUrl: 'http://127.0.0.1:8007',
  sentryDsn: '',
  sentryEnv: 'dev',
  version: 'dev',
  sentryRelease: '',
};

/**
 * Release Sentry : le SHA compilé par la CI (`billing-frontend@<sha>`), sinon la
 * version runtime injectée par nginx, sinon rien — jamais « dev ».
 */
export function resolveSentryRelease(buildSha: string, runtimeVersion: string | undefined): string {
  if (buildSha) {
    return sentryReleaseFor(buildSha);
  }
  const version = (runtimeVersion ?? '').trim();
  return version && version !== FALLBACK.version ? version : '';
}

export function getRuntimeConfig(): RuntimeConfig {
  const injected = window.__BILLING__ ?? {};
  // Une substitution nginx qui n'a pas eu lieu laisse le littéral `${VAR}` :
  // le détecter évite de partir en requête vers une URL absurde.
  const looksSubstituted = (value?: string) => !!value && !value.includes('${');
  const version = looksSubstituted(injected.version) ? injected.version! : FALLBACK.version;
  return {
    apiBaseUrl: looksSubstituted(injected.apiBaseUrl) ? injected.apiBaseUrl! : FALLBACK.apiBaseUrl,
    sentryDsn: looksSubstituted(injected.sentryDsn) ? injected.sentryDsn! : '',
    sentryEnv: looksSubstituted(injected.sentryEnv) ? injected.sentryEnv! : FALLBACK.sentryEnv,
    version,
    sentryRelease: resolveSentryRelease(BUILD_SHA, version),
  };
}
