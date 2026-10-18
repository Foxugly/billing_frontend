import { afterEach, describe, expect, it } from 'vitest';

import { sentryReleaseFor } from './build-info';
import { getRuntimeConfig, resolveSentryRelease } from './runtime-config';

describe('runtime-config', () => {
  afterEach(() => {
    delete window.__BILLING__;
  });

  it('nomme la release Sentry d’après le SHA du build', () => {
    expect(sentryReleaseFor('abc123')).toBe('billing-frontend@abc123');
    expect(resolveSentryRelease('abc123', '1.2.3')).toBe('billing-frontend@abc123');
  });

  it('retombe sur la version runtime sans SHA de build', () => {
    expect(resolveSentryRelease('', ' 1.2.3 ')).toBe('1.2.3');
  });

  it('n’invente pas de release en dev', () => {
    expect(resolveSentryRelease('', 'dev')).toBe('');
    expect(resolveSentryRelease('', undefined)).toBe('');
  });

  it('expose la release résolue (hors CI : pas de SHA compilé)', () => {
    window.__BILLING__ = { version: '2026.10.18' };
    expect(getRuntimeConfig().sentryRelease).toBe('2026.10.18');
  });
});
