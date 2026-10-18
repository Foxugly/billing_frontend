import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApiService, MAX_LIST_PAGES, MAX_LIST_ROWS } from './admin-api.service';

/** Le backend pagine les listes de la console (audit M5) : le service suit `next`. */
describe('AdminApiService pagination', () => {
  let api: AdminApiService;
  let http: HttpTestingController;
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('follows next until the last page', async () => {
    const result = api.events({ handled: true });

    const first = http.expectOne((r) => r.url.includes('/api/v1/admin/events/?handled=true'));
    first.flush({
      count: 3,
      next: 'http://127.0.0.1:8007/api/v1/admin/events/?handled=true&page=2',
      previous: null,
      results: [{ id: 'evt_1' }, { id: 'evt_2' }],
    });
    await tick();
    const second = http.expectOne((r) => r.url.includes('page=2'));
    // Requête reconstruite : filtres et page_size conservés, base de l'API.
    expect(second.request.url).toBe(
      'http://127.0.0.1:8007/api/v1/admin/events/?handled=true&page_size=200&page=2',
    );
    second.flush({ count: 3, next: null, previous: null, results: [{ id: 'evt_3' }] });

    expect((await result).map((e) => e.id)).toEqual(['evt_1', 'evt_2', 'evt_3']);
  });

  it('still accepts a bare list', async () => {
    const result = api.apps();
    http.expectOne((r) => r.url.includes('/api/v1/admin/apps/')).flush([{ id: 1 }]);
    expect(await result).toEqual([{ id: 1 }]);
  });

  it('stops at MAX_LIST_ROWS', async () => {
    const page = Array.from({ length: 200 }, (_, i) => ({ id: `evt_${i}` }));
    const result = api.events();
    for (let n = 1; n * 200 <= MAX_LIST_ROWS; n++) {
      await tick();
      http
        .expectOne((r) => r.url.includes('/api/v1/admin/events/'))
        .flush({
          count: 99999,
          next: `http://127.0.0.1:8007/api/v1/admin/events/?page=${n + 1}`,
          previous: null,
          results: page,
        });
    }
    expect((await result).length).toBe(MAX_LIST_ROWS);
    http.verify();
  });

  it('ne suit pas un next vers une autre origine (le jeton fuiterait)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = api.events();
    http
      .expectOne((r) => r.url.includes('/api/v1/admin/events/'))
      .flush({
        count: 2,
        next: 'https://attaquant.example/api/v1/admin/events/?page=2',
        previous: null,
        results: [{ id: 'evt_1' }],
      });

    expect((await result).map((e) => e.id)).toEqual(['evt_1']);
    http.verify();
    expect(error).toHaveBeenCalled();
  });

  it('ne suit pas un next de même origine hors du chemin de la liste', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = api.events();
    http
      .expectOne((r) => r.url.includes('/api/v1/admin/events/'))
      .flush({
        count: 2,
        next: 'http://127.0.0.1:8007/api/v1/admin/apps/?page=2',
        previous: null,
        results: [{ id: 'evt_1' }],
      });

    expect((await result).length).toBe(1);
    http.verify();
  });

  it('se termine sur une page vide malgré un next', async () => {
    const result = api.events();
    http
      .expectOne((r) => r.url.includes('/api/v1/admin/events/'))
      .flush({
        count: 99999,
        next: 'http://127.0.0.1:8007/api/v1/admin/events/?page=2',
        previous: null,
        results: [],
      });

    expect(await result).toEqual([]);
    http.verify();
  });

  it('borne le nombre de pages même si chaque page est minuscule', async () => {
    const result = api.events();
    for (let n = 1; n <= MAX_LIST_PAGES; n++) {
      await tick();
      http
        .expectOne((r) => r.url.includes('/api/v1/admin/events/'))
        .flush({
          count: 99999,
          next: `http://127.0.0.1:8007/api/v1/admin/events/?page=${n + 1}`,
          previous: null,
          results: [{ id: `evt_${n}` }],
        });
    }
    expect((await result).length).toBe(MAX_LIST_PAGES);
    await tick();
    http.verify();
  });
});
