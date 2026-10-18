import type { Breadcrumb, ErrorEvent } from '@sentry/angular';
import { describe, expect, it } from 'vitest';

import { FILTERED, scrubBreadcrumb, scrubEvent, scrubText } from './sentry-scrub';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE3MDAwMDAwMDB9.c2lnbmF0dXJlLWZhdXNzZQ';

describe('sentry-scrub', () => {
  it('masque un JWT où qu’il apparaisse', () => {
    expect(scrubText(`refresh failed for ${JWT} now`)).toBe(`refresh failed for ${FILTERED} now`);
  });

  it('masque un en-tête Bearer', () => {
    expect(scrubText('Authorization: Bearer abc.def-ghi')).toBe(
      `Authorization: Bearer ${FILTERED}`,
    );
  });

  it('masque les paramètres sensibles d’une URL', () => {
    expect(
      scrubText('https://billing-api.foxugly.com/x?token=abc&page=2&refresh=r1&shared_secret=s'),
    ).toBe(
      `https://billing-api.foxugly.com/x?token=${FILTERED}&page=2&refresh=${FILTERED}&shared_secret=${FILTERED}`,
    );
  });

  it('laisse intacte une chaîne sans secret', () => {
    expect(scrubText('/api/v1/admin/apps/?page=2')).toBe('/api/v1/admin/apps/?page=2');
  });

  it('nettoie un événement : URL, en-têtes, message, exception, breadcrumbs', () => {
    const event = {
      request: {
        url: 'https://billing.foxugly.com/login?token=t',
        headers: { Authorization: `Bearer ${JWT}`, Referer: 'https://billing.foxugly.com/?code=c' },
        cookies: { sessionid: 'x' },
      },
      message: `boom ${JWT}`,
      exception: { values: [{ type: 'Error', value: `HTTP 401 Bearer ${JWT}` }] },
      breadcrumbs: [{ category: 'fetch', data: { url: '/api/v1/auth/token/refresh/?refresh=r' } }],
      extra: { body: { refresh: JWT } },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);

    expect(out.request?.url).toBe(`https://billing.foxugly.com/login?token=${FILTERED}`);
    expect(out.request?.headers?.['Authorization']).toBeUndefined();
    expect(out.request?.headers?.['Referer']).toBe(`https://billing.foxugly.com/?code=${FILTERED}`);
    expect(out.request?.cookies).toBeUndefined();
    expect(out.message).toBe(`boom ${FILTERED}`);
    expect(out.exception?.values?.[0].value).toBe(`HTTP 401 Bearer ${FILTERED}`);
    expect(out.breadcrumbs?.[0].data?.['url']).toBe(
      `/api/v1/auth/token/refresh/?refresh=${FILTERED}`,
    );
    expect(JSON.stringify(out)).not.toContain(JWT);
  });

  it('nettoie un breadcrumb de console', () => {
    const crumb: Breadcrumb = { category: 'console', message: `token ${JWT}` };
    expect(scrubBreadcrumb(crumb).message).toBe(`token ${FILTERED}`);
  });
});
