import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

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
      .expectOne((r) => r.url.endsWith('/api/auth/token/refresh/'))
      .flush({ access: 'nouvel-acces', refresh: 'nouveau-refresh' });

    expect(await refreshed).toBe(true);
    expect(localStorage.getItem('billing.refresh')).toBe('nouveau-refresh');
    expect(localStorage.getItem('billing.access')).toBe('nouvel-acces');
  });

  it("conserve le refresh existant si le backend n'en renvoie pas", async () => {
    sessionStorage.setItem('billing.access', 'a');
    sessionStorage.setItem('billing.refresh', 'refresh-inchange');

    const refreshed = service.refresh();
    http.expectOne((r) => r.url.endsWith('/api/auth/token/refresh/')).flush({ access: 'b' });

    expect(await refreshed).toBe(true);
    expect(sessionStorage.getItem('billing.refresh')).toBe('refresh-inchange');
  });

  it('efface la session quand le refresh est refusé', async () => {
    localStorage.setItem('billing.access', 'a');
    localStorage.setItem('billing.refresh', 'perime');

    const refreshed = service.refresh();
    http
      .expectOne((r) => r.url.endsWith('/api/auth/token/refresh/'))
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
    http.expectOne((r) => r.url.endsWith('/api/auth/token/')).flush({ access: 'a', refresh: 'r' });
    // Le service enchaine sur /me/ apres un await : laisser la microtache passer.
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne((r) => r.url.endsWith('/api/auth/me/')).flush({
      id: 1,
      email: 'ops@example.com',
      displayName: 'Ops',
      isStaff: true,
      isSuperuser: true,
    });
    await login;

    expect(sessionStorage.getItem('billing.access')).toBe('a');
    expect(localStorage.getItem('billing.access')).toBeNull();
  });
});
