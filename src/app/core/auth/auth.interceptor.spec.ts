import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authInterceptor } from './auth.interceptor';
import { AuthService, SESSION_HINT_KEY } from './auth.service';

/** Le cookie de refresh ne voyage que sur les appels d'auth ; le reste est en Bearer. */
describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let auth: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);

    localStorage.setItem(SESSION_HINT_KEY, '1');
    const refreshed = auth.refresh();
    http.expectOne((r) => r.url.endsWith('/api/v1/auth/token/refresh/')).flush({ access: 'a1' });
    await refreshed;
  });

  it('attache le Bearer sans credentials aux appels ordinaires', () => {
    client.get('/api/v1/admin/apps/').subscribe();
    const req = http.expectOne('/api/v1/admin/apps/');
    expect(req.request.headers.get('Authorization')).toBe('Bearer a1');
    expect(req.request.withCredentials).toBe(false);
    req.flush([]);
  });

  it("n'attache pas de Bearer aux appels de refresh et de logout", () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.logout();
    const req = http.expectOne((r) => r.url.endsWith('/api/v1/auth/token/blacklist/'));
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.withCredentials).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('rafraîchit par le cookie après un 401 puis rejoue la requête', async () => {
    let body: unknown;
    client.get('/api/v1/admin/apps/').subscribe((b) => (body = b));
    http.expectOne('/api/v1/admin/apps/').flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresh = http.expectOne((r) => r.url.endsWith('/api/v1/auth/token/refresh/'));
    expect(refresh.request.withCredentials).toBe(true);
    refresh.flush({ access: 'a2' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const retry = http.expectOne('/api/v1/admin/apps/');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer a2');
    retry.flush(['ok']);
    expect(body).toEqual(['ok']);
  });
});
