import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { ConfirmationService, MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApiService, BillingApp } from '../../core/api/admin-api.service';
import { TranslocoHttpLoader } from '../../core/i18n/transloco-loader';
import { AppsListComponent } from './apps-list.component';

const APP: BillingApp = {
  id: 1,
  slug: 'poker',
  name: 'Poker',
  base_url: 'https://poker-api.foxugly.invalid',
  entitlement_path: '/api/v1/billing/entitlement/',
  entitlement_url: 'https://poker-api.foxugly.invalid/api/v1/billing/entitlement/',
  active: true,
  plans_count: 2,
  secret_rotated_at: null,
  created_at: '2026-07-28T10:00:00Z',
};

describe('AppsListComponent', () => {
  let fixture: ComponentFixture<AppsListComponent>;
  let component: any;
  let api: {
    apps: ReturnType<typeof vi.fn>;
    pingApp: ReturnType<typeof vi.fn>;
    rotateSecret: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    api = {
      apps: vi.fn().mockResolvedValue([APP]),
      pingApp: vi.fn().mockResolvedValue({ ok: true, detail: 'HTTP 200' }),
      rotateSecret: vi
        .fn()
        .mockResolvedValue({ slug: 'poker', shared_secret: 'sec_r3t', warning: 'une seule fois' }),
    };

    await TestBed.configureTestingModule({
      imports: [AppsListComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['fr'], defaultLang: 'fr' },
          loader: TranslocoHttpLoader,
        }),
        MessageService,
        ConfirmationService,
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppsListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('reports a refused ping as an error, not as a success', async () => {
    // Le point subtil : l'appel HTTP a reussi, c'est la signature qui a ete
    // refusee. Un toast vert ici ferait conclure que le cablage est bon.
    api.pingApp.mockResolvedValue({ ok: false, detail: 'HTTP 401' });
    const messages = TestBed.inject(MessageService);
    const add = vi.spyOn(messages, 'add');

    await component.ping(APP);

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'HTTP 401' }),
    );
  });

  it('reports a successful ping as a success', async () => {
    const messages = TestBed.inject(MessageService);
    const add = vi.spyOn(messages, 'add');

    await component.ping(APP);

    expect(add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('clears the ping spinner even when the call blows up', async () => {
    api.pingApp.mockRejectedValue(new Error('reseau'));

    await component.ping(APP);

    expect(component.pinging()).toBeNull();
  });

  it('reveals the rotated secret, since it is never readable again', async () => {
    await component['rotate'](APP);

    expect(component.revealed()).toBe('sec_r3t');
  });

  it('asks before rotating — the app is on borrowed time until the new secret is deployed', () => {
    const confirm = TestBed.inject(ConfirmationService);
    const ask = vi.spyOn(confirm, 'confirm');

    component.askRotate(APP);

    expect(ask).toHaveBeenCalled();
    expect(api.rotateSecret).not.toHaveBeenCalled();
  });
});
