import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';

/**
 * Le backend **rote** les refresh tokens et met l'ancien sur liste noire. Un client
 * qui ne persiste pas le jeton roté fonctionne parfaitement… jusqu'au premier
 * rafraîchissement, puis éjecte l'opérateur. C'est un piège déjà rencontré
 * ailleurs dans la flotte : ces tests l'épinglent.
 */
describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  it('persiste le refresh roté renvoyé par le backend', async () => {
    localStorage.setItem('billing.access', 'ancien-acces');
    localStorage.setItem('billing.refresh', 'ancien-refresh');

    const refreshed = service.refresh();
    http
      .expectOne((r) => r.url.endsWith('/api/v1/auth/token/refresh/'))
      .flush({ access: 'nouvel-acces', refresh: 'nouveau-refresh' });

    expect(await refreshed).toBe(true);
    expect(localStorage.getItem('billing.refresh')).toBe('nouveau-refresh');
    expect(localStorage.getItem('billing.access')).toBe('nouvel-acces');
  });

  it("conserve le refresh existant si le backend n'en renvoie pas", async () => {
    sessionStorage.setItem('billing.access', 'a');
    sessionStorage.setItem('billing.refresh', 'refresh-inchange');

    const refreshed = service.refresh();
    http.expectOne((r) => r.url.endsWith('/api/v1/auth/token/refresh/')).flush({ access: 'b' });

    expect(await refreshed).toBe(true);
    expect(sessionStorage.getItem('billing.refresh')).toBe('refresh-inchange');
  });

  it('efface la session quand le refresh est refusé', async () => {
    localStorage.setItem('billing.access', 'a');
    localStorage.setItem('billing.refresh', 'perime');

    const refreshed = service.refresh();
    http
      .expectOne((r) => r.url.endsWith('/api/v1/auth/token/refresh/'))
      .flush({ detail: 'blacklisted' }, { status: 401, statusText: 'Unauthorized' });

    expect(await refreshed).toBe(false);
    expect(localStorage.getItem('billing.access')).toBeNull();
    expect(localStorage.getItem('billing.refresh')).toBeNull();
  });

  it('ne tente rien sans refresh stocké', async () => {
    expect(await service.refresh()).toBe(false);
    http.expectNone(() => true);
  });

  it('range les jetons en session quand « se souvenir » est décoché', async () => {
    const login = service.login('ops@example.com', 'x', false);
    http
      .expectOne((r) => r.url.endsWith('/api/v1/auth/token/'))
      .flush({ access: 'a', refresh: 'r' });
    // Le service enchaine sur /me/ apres un await : laisser la microtache passer.
    await new Promise((resolve) => setTimeout(resolve, 0));
    http
      .expectOne((r) => r.url.endsWith('/api/v1/auth/me/'))
      .flush({
        id: 1,
        email: 'ops@example.com',
        firstName: 'Ops',
        lastName: '',
        displayName: 'Ops',
        isStaff: true,
        isSuperuser: true,
      });
    await login;

    expect(sessionStorage.getItem('billing.access')).toBe('a');
    expect(localStorage.getItem('billing.access')).toBeNull();
  });

  it('envoie le PATCH du profil et met à jour l’utilisateur courant', async () => {
    const saved = service.updateProfile({ firstName: 'Ada', lastName: 'Lovelace' });
    const req = http.expectOne((r) => r.url.endsWith('/api/v1/auth/me/'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    req.flush({
      id: 1,
      email: 'ops@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      displayName: 'Ada Lovelace',
      isStaff: true,
      isSuperuser: false,
    });

    await saved;
    expect(service.currentUser()?.displayName).toBe('Ada Lovelace');
  });

  it('garde la session quand la lecture du profil échoue', async () => {
    localStorage.setItem('billing.access', 'a');

    const loading = service.fetchProfile();
    http
      .expectOne((r) => r.url.endsWith('/api/v1/auth/me/'))
      .flush({}, { status: 500, statusText: 'Server Error' });

    await expect(loading).rejects.toBeTruthy();
    expect(localStorage.getItem('billing.access')).toBe('a');
  });

  it('poste current_password et new_password au changement de mot de passe', async () => {
    const changing = service.changePassword('ancien', 'nouveau');
    const req = http.expectOne((r) => r.url.endsWith('/api/v1/auth/password/change/'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ current_password: 'ancien', new_password: 'nouveau' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    await changing;
  });

  it('stocke la paire neuve renvoyée par le changement de mot de passe', async () => {
    // Le backend révoque tous les refresh : garder l'ancien éjecterait l'opérateur.
    localStorage.setItem('billing.access', 'ancien-acces');
    localStorage.setItem('billing.refresh', 'ancien-refresh');

    const changing = service.changePassword('ancien', 'nouveau');
    http
      .expectOne((r) => r.url.endsWith('/api/v1/auth/password/change/'))
      .flush({ access: 'acces-neuf', refresh: 'refresh-neuf' });
    await changing;

    expect(localStorage.getItem('billing.refresh')).toBe('refresh-neuf');
    expect(localStorage.getItem('billing.access')).toBe('acces-neuf');
    expect(service.accessToken()).toBe('acces-neuf');
  });

  it('garde la session sur une erreur serveur du refresh', async () => {
    localStorage.setItem('billing.access', 'a');
    localStorage.setItem('billing.refresh', 'r');

    const refreshed = service.refresh();
    http
      .expectOne((r) => r.url.endsWith('/api/v1/auth/token/refresh/'))
      .flush({}, { status: 502, statusText: 'Bad Gateway' });

    await expect(refreshed).rejects.toBeTruthy();
    expect(localStorage.getItem('billing.refresh')).toBe('r');
  });

  it('ne lance qu’un seul refresh pour des demandes simultanées', async () => {
    localStorage.setItem('billing.access', 'a');
    localStorage.setItem('billing.refresh', 'r');

    const first = service.refresh();
    const second = service.refresh();
    http
      .expectOne((r) => r.url.endsWith('/api/v1/auth/token/refresh/'))
      .flush({ access: 'b', refresh: 'r2' });

    expect(await first).toBe(true);
    expect(await second).toBe(true);
  });

  it('met le refresh sur liste noire au logout', () => {
    localStorage.setItem('billing.access', 'a');
    localStorage.setItem('billing.refresh', 'r');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    service.logout();
    expect(navigate).toHaveBeenCalledWith(['/login']);

    const req = http.expectOne((r) => r.url.endsWith('/api/v1/auth/token/blacklist/'));
    expect(req.request.body).toEqual({ refresh: 'r' });
    req.flush({});
    expect(localStorage.getItem('billing.refresh')).toBeNull();
  });

  describe('plusieurs onglets', () => {
    const storageEvent = (key: string | null, newValue: string | null) =>
      window.dispatchEvent(
        new StorageEvent('storage', { key, newValue, storageArea: localStorage }),
      );

    afterEach(() => {
      Reflect.deleteProperty(navigator, 'locks');
    });

    it('suit la déconnexion faite dans un autre onglet', () => {
      localStorage.setItem('billing.access', 'a');
      localStorage.setItem('billing.refresh', 'r');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      });
      const tab = TestBed.inject(AuthService);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      expect(tab.isLoggedIn()).toBe(true);

      // L'autre onglet a tout effacé.
      localStorage.clear();
      storageEvent('billing.refresh', null);

      expect(tab.isLoggedIn()).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('adopte les jetons rotés par un autre onglet', () => {
      localStorage.setItem('billing.access', 'a1');
      localStorage.setItem('billing.refresh', 'r1');
      storageEvent('billing.access', 'a1');
      expect(service.accessToken()).toBe('a1');

      localStorage.setItem('billing.access', 'a2');
      localStorage.setItem('billing.refresh', 'r2');
      storageEvent('billing.refresh', 'r2');

      expect(service.accessToken()).toBe('a2');
    });

    it('ignore les clés étrangères à la session', () => {
      localStorage.setItem('billing.access', 'a');
      localStorage.setItem('billing.refresh', 'r');
      storageEvent('billing.refresh', 'r');
      localStorage.removeItem('billing.refresh');

      storageEvent('theme', 'dark');

      expect(service.accessToken()).toBe('a');
    });

    it('sérialise le refresh entre onglets avec un Web Lock', async () => {
      localStorage.setItem('billing.access', 'a');
      localStorage.setItem('billing.refresh', 'r');
      const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
      Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

      const refreshed = service.refresh();
      await new Promise((resolve) => setTimeout(resolve, 0));
      http
        .expectOne((r) => r.url.endsWith('/api/v1/auth/token/refresh/'))
        .flush({ access: 'b', refresh: 'r2' });

      expect(await refreshed).toBe(true);
      expect(request).toHaveBeenCalledWith('billing.refresh', expect.any(Function));
    });

    it("n'use pas un refresh déjà roté par l'onglet qui tenait le verrou", async () => {
      localStorage.setItem('billing.access', 'a1');
      localStorage.setItem('billing.refresh', 'r1');
      // Pendant l'attente du verrou, l'autre onglet a roté r1 en r2.
      const request = vi.fn(async (_name: string, task: () => Promise<unknown>) => {
        localStorage.setItem('billing.access', 'a2');
        localStorage.setItem('billing.refresh', 'r2');
        return task();
      });
      Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

      expect(await service.refresh()).toBe(true);

      http.expectNone((r) => r.url.endsWith('/api/v1/auth/token/refresh/'));
      expect(service.accessToken()).toBe('a2');
    });
  });
});
