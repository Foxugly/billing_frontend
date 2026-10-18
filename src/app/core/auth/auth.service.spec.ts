import { HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService, CurrentUser, SESSION_HINT_KEY } from './auth.service';

const OPS: CurrentUser = {
  id: 1,
  email: 'ops@example.com',
  firstName: 'Ops',
  lastName: '',
  displayName: 'Ops',
  isStaff: true,
  isSuperuser: true,
};

const isRefresh = (r: HttpRequest<unknown>) => r.url.endsWith('/api/v1/auth/token/refresh/');
const isMe = (r: HttpRequest<unknown>) => r.url.endsWith('/api/v1/auth/me/');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Aucune valeur de stockage ne doit ressembler à un jeton. */
function storageValues(): string[] {
  const values: string[] = [];
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      values.push(store.getItem(store.key(i)!) ?? '');
    }
  }
  return values;
}

function expectCookieOptIn(req: HttpRequest<unknown>): void {
  expect(req.headers.get('X-Auth-Mode')).toBe('cookie');
  expect(req.withCredentials).toBe(true);
}

/**
 * Le refresh vit dans un cookie HttpOnly posé par billing-api (opt-in
 * `X-Auth-Mode: cookie`, billing_server `accounts/refresh_cookie.py`) ; l'accès
 * vit en mémoire seulement. Le stockage ne porte qu'un indice non secret.
 */
describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  function boot(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    boot();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks');
  });

  describe('login', () => {
    it("s'abonne au cookie, garde l'accès en mémoire et ne stocke aucun jeton", async () => {
      const login = service.login('ops@example.com', 'x', true);
      const req = http.expectOne((r) => r.url.endsWith('/api/v1/auth/token/'));
      expectCookieOptIn(req.request);
      expect(req.request.body).toEqual({
        email: 'ops@example.com',
        password: 'x',
        remember_me: true,
      });
      req.flush({ access: 'acces-1' });
      await tick();
      http.expectOne(isMe).flush(OPS);
      await login;

      expect(service.accessToken()).toBe('acces-1');
      expect(service.isLoggedIn()).toBe(true);
      expect(service.currentUser()?.email).toBe('ops@example.com');
      expect(localStorage.getItem(SESSION_HINT_KEY)).not.toBeNull();
      expect(storageValues()).not.toContain('acces-1');
    });

    it('transmet « se souvenir de moi » décoché au backend (cookie de session)', async () => {
      const login = service.login('ops@example.com', 'x', false);
      const req = http.expectOne((r) => r.url.endsWith('/api/v1/auth/token/'));
      expect(req.request.body).toEqual({
        email: 'ops@example.com',
        password: 'x',
        remember_me: false,
      });
      req.flush({ access: 'a' });
      await tick();
      http.expectOne(isMe).flush(OPS);
      await login;
    });
  });

  describe('refresh', () => {
    it('rafraîchit par le cookie, sans corps ni jeton stocké', async () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');

      const refreshed = service.refresh();
      const req = http.expectOne(isRefresh);
      expectCookieOptIn(req.request);
      expect(req.request.body).toEqual({});
      req.flush({ access: 'acces-neuf' });

      expect(await refreshed).toBe(true);
      expect(service.accessToken()).toBe('acces-neuf');
      expect(storageValues()).not.toContain('acces-neuf');
    });

    it('efface la session quand le refresh est refusé (401/403)', async () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');

      const refreshed = service.refresh();
      http
        .expectOne(isRefresh)
        .flush({ code: 'refresh_cookie_missing' }, { status: 401, statusText: 'Unauthorized' });

      expect(await refreshed).toBe(false);
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
      expect(service.isLoggedIn()).toBe(false);
    });

    it('garde la session sur une erreur serveur du refresh', async () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');

      const refreshed = service.refresh();
      http.expectOne(isRefresh).flush({}, { status: 502, statusText: 'Bad Gateway' });

      await expect(refreshed).rejects.toBeTruthy();
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
    });

    it('ne tente rien sans session', async () => {
      expect(await service.refresh()).toBe(false);
      http.expectNone(() => true);
    });

    it('ne lance qu’un seul refresh pour des demandes simultanées', async () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');

      const first = service.refresh();
      const second = service.refresh();
      http.expectOne(isRefresh).flush({ access: 'b' });

      expect(await first).toBe(true);
      expect(await second).toBe(true);
    });

    it('sérialise le refresh entre onglets avec un Web Lock', async () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');
      const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
      Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

      const refreshed = service.refresh();
      await tick();
      http.expectOne(isRefresh).flush({ access: 'b' });

      expect(await refreshed).toBe(true);
      expect(request).toHaveBeenCalledWith('billing.refresh', expect.any(Function));
    });
  });

  describe('migration du refresh hérité du localStorage', () => {
    it.each([
      ['localStorage', () => localStorage],
      ['sessionStorage', () => sessionStorage],
    ])('présente une fois le jeton de %s puis efface les anciennes clés', async (_n, store) => {
      store().setItem('billing.access', 'ancien-acces');
      store().setItem('billing.refresh', 'ancien-refresh');

      const refreshed = service.refresh();
      const req = http.expectOne(isRefresh);
      expectCookieOptIn(req.request);
      expect(req.request.body).toEqual({ refresh: 'ancien-refresh' });
      req.flush({ access: 'acces-neuf' });

      expect(await refreshed).toBe(true);
      expect(store().getItem('billing.refresh')).toBeNull();
      expect(store().getItem('billing.access')).toBeNull();
    });

    it('efface le jeton hérité quand il est refusé', async () => {
      localStorage.setItem('billing.refresh', 'perime');

      const refreshed = service.refresh();
      http.expectOne(isRefresh).flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(await refreshed).toBe(false);
      expect(localStorage.getItem('billing.refresh')).toBeNull();
    });

    it('garde le jeton hérité sur une erreur réseau', async () => {
      localStorage.setItem('billing.refresh', 'encore-bon');

      const refreshed = service.refresh();
      http.expectOne(isRefresh).error(new ProgressEvent('error'));

      await expect(refreshed).rejects.toBeTruthy();
      expect(localStorage.getItem('billing.refresh')).toBe('encore-bon');
    });

    it('annonce la session après la migration au démarrage', async () => {
      localStorage.setItem('billing.refresh', 'ancien');

      const restoring = service.restore();
      http.expectOne(isRefresh).flush({ access: 'a' });
      await tick();
      http.expectOne(isMe).flush(OPS);
      await restoring;

      expect(localStorage.getItem(SESSION_HINT_KEY)).not.toBeNull();
      expect(localStorage.getItem('billing.refresh')).toBeNull();
      expect(service.isLoggedIn()).toBe(true);
    });
  });

  describe('restauration silencieuse au démarrage', () => {
    it('ne fait aucun appel pour un visiteur sans session', async () => {
      await service.restore();
      http.expectNone(() => true);
      expect(service.isLoggedIn()).toBe(false);
    });

    it('récupère accès et profil depuis le cookie', async () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');

      const restoring = service.restore();
      http.expectOne(isRefresh).flush({ access: 'a' });
      await tick();
      http.expectOne(isMe).flush(OPS);
      await restoring;

      expect(service.isLoggedIn()).toBe(true);
      expect(service.currentUser()?.id).toBe(1);
    });

    it('termine la session quand le cookie est refusé', async () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');

      const restoring = service.restore();
      http.expectOne(isRefresh).flush({}, { status: 401, statusText: 'Unauthorized' });
      await restoring;

      expect(service.isLoggedIn()).toBe(false);
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
    });

    it("garde l'indice sur un 5xx, sans rejeter", async () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');

      const restoring = service.restore();
      http.expectOne(isRefresh).flush({}, { status: 503, statusText: 'Unavailable' });
      await restoring;

      expect(service.isLoggedIn()).toBe(false);
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
    });
  });

  describe('changement de mot de passe', () => {
    it('poste current_password et new_password avec le cookie', async () => {
      const changing = service.changePassword('ancien', 'nouveau');
      const req = http.expectOne((r) => r.url.endsWith('/api/v1/auth/password/change/'));
      expect(req.request.method).toBe('POST');
      expectCookieOptIn(req.request);
      expect(req.request.body).toEqual({ current_password: 'ancien', new_password: 'nouveau' });
      req.flush(null, { status: 204, statusText: 'No Content' });

      await changing;
    });

    it("adopte l'accès neuf (le backend a reposé le cookie) sans rien stocker", async () => {
      // Le backend révoque tous les refresh : garder l'ancien accès éjecterait l'opérateur.
      const changing = service.changePassword('ancien', 'nouveau');
      http
        .expectOne((r) => r.url.endsWith('/api/v1/auth/password/change/'))
        .flush({ access: 'acces-neuf' });
      await changing;

      expect(service.accessToken()).toBe('acces-neuf');
      expect(localStorage.getItem(SESSION_HINT_KEY)).not.toBeNull();
      expect(storageValues()).not.toContain('acces-neuf');
    });
  });

  it('se déconnecte par le cookie, sans Bearer, et prévient les autres onglets', () => {
    localStorage.setItem(SESSION_HINT_KEY, '1');
    localStorage.setItem('billing.refresh', 'reste-herite');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    service.logout();
    expect(navigate).toHaveBeenCalledWith(['/login']);

    const req = http.expectOne((r) => r.url.endsWith('/api/v1/auth/token/blacklist/'));
    expectCookieOptIn(req.request);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.body).toEqual({});
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
    expect(localStorage.getItem('billing.refresh')).toBeNull();
  });

  it('envoie le PATCH du profil et met à jour l’utilisateur courant', async () => {
    const saved = service.updateProfile({ firstName: 'Ada', lastName: 'Lovelace' });
    const req = http.expectOne(isMe);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    req.flush({ ...OPS, firstName: 'Ada', lastName: 'Lovelace', displayName: 'Ada Lovelace' });

    await saved;
    expect(service.currentUser()?.displayName).toBe('Ada Lovelace');
  });

  it('garde la session quand la lecture du profil échoue', async () => {
    localStorage.setItem(SESSION_HINT_KEY, '1');

    const loading = service.fetchProfile();
    http.expectOne(isMe).flush({}, { status: 500, statusText: 'Server Error' });

    await expect(loading).rejects.toBeTruthy();
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
  });

  describe('plusieurs onglets', () => {
    const storageEvent = (key: string | null, newValue: string | null) =>
      window.dispatchEvent(
        new StorageEvent('storage', { key, newValue, storageArea: localStorage }),
      );

    async function signedIn(): Promise<void> {
      localStorage.setItem(SESSION_HINT_KEY, '1');
      const restoring = service.restore();
      http.expectOne(isRefresh).flush({ access: 'a1' });
      await tick();
      http.expectOne(isMe).flush(OPS);
      await restoring;
    }

    it('suit la déconnexion faite dans un autre onglet', async () => {
      await signedIn();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      localStorage.removeItem(SESSION_HINT_KEY);
      storageEvent(SESSION_HINT_KEY, null);

      expect(service.isLoggedIn()).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('se restaure depuis le cookie partagé quand un autre onglet change la session', async () => {
      await signedIn();

      storageEvent(SESSION_HINT_KEY, String(Date.now()));
      http.expectOne(isRefresh).flush({ access: 'a2' });
      await tick();
      http.expectOne(isMe).flush(OPS);
      await tick();

      expect(service.accessToken()).toBe('a2');
    });

    it('ignore les clés étrangères à la session', async () => {
      await signedIn();

      storageEvent('theme', 'dark');

      http.expectNone(() => true);
      expect(service.accessToken()).toBe('a1');
    });

    it("ne place jamais de jeton dans l'événement de synchronisation", async () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      await signedIn();
      const changing = service.changePassword('x', 'y');
      http
        .expectOne((r) => r.url.endsWith('/api/v1/auth/password/change/'))
        .flush({ access: 'secret-acces' });
      await changing;

      for (const [, value] of setItem.mock.calls) {
        expect(value).not.toContain('secret-acces');
        expect(value).not.toContain('a1');
      }
      setItem.mockRestore();
    });
  });
});
