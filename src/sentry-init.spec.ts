import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));
vi.mock('@sentry/angular', () => sdk);

async function loadModule() {
  return import('./sentry-init');
}

describe('sentry-init (SDK chargé à la demande)', () => {
  beforeEach(() => {
    vi.resetModules();
    sdk.init.mockClear();
    sdk.captureException.mockClear();
    sdk.captureMessage.mockClear();
  });

  afterEach(() => {
    delete window.__BILLING__;
  });

  it('ne charge ni n’initialise rien sans DSN', async () => {
    const { initSentry, captureMessage } = await loadModule();
    expect(await initSentry()).toBeNull();
    captureMessage('rien', 'warning');
    await initSentry();
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureMessage).not.toHaveBeenCalled();
  });

  it('initialise une seule fois et transmet les erreurs mises en file', async () => {
    window.__BILLING__ = { sentryDsn: 'https://public@example.invalid/1', sentryEnv: 'test' };
    const { initSentry, captureException, LazySentryErrorHandler } = await loadModule();
    const err = new Error('boom');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Capturée avant la fin du chargement : elle attend sur la promesse.
    new LazySentryErrorHandler().handleError(err);
    captureException('autre');
    await initSentry();
    await initSentry();

    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init.mock.calls[0][0]).toMatchObject({ environment: 'test', sendDefaultPii: false });
    expect(sdk.captureException).toHaveBeenCalledWith(err);
    expect(sdk.captureException).toHaveBeenCalledWith('autre');
    expect(consoleError).toHaveBeenCalledWith(err);
    consoleError.mockRestore();
  });
});
