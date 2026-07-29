import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApiService, Delivery } from '../../core/api/admin-api.service';
import { TranslocoHttpLoader } from '../../core/i18n/transloco-loader';
import { DeliveriesListComponent } from './deliveries-list.component';

function delivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: 'd1',
    app_slug: 'poker',
    external_user_id: '42',
    status: 'failed',
    attempts: 3,
    last_error: 'HTTPError: 500',
    next_retry_at: null,
    delivered_at: null,
    created_at: '2026-07-28T10:00:00Z',
    payload: {},
    ...overrides,
  };
}

describe('DeliveriesListComponent', () => {
  let fixture: ComponentFixture<DeliveriesListComponent>;
  let component: any;
  let api: { deliveries: ReturnType<typeof vi.fn>; replayDelivery: ReturnType<typeof vi.fn> };

  async function setup(queryParams: Record<string, string> = {}): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DeliveriesListComponent],
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
        { provide: AdminApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeliveriesListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(() => {
    api = {
      deliveries: vi.fn().mockResolvedValue([delivery()]),
      replayDelivery: vi.fn().mockResolvedValue({ id: 'd1', status: 'pending' }),
    };
  });

  it('honours the ?status=failed the dashboard sends', async () => {
    // Sans ca on atterrit sur la liste complete, ou l'echec cherche est noye.
    await setup({ status: 'failed' });

    expect(component.status).toBe('failed');
    expect(api.deliveries).toHaveBeenCalledWith({ status: 'failed' });
  });

  it('asks for everything when no status is given', async () => {
    await setup();

    expect(api.deliveries).toHaveBeenCalledWith({});
  });

  it('colours the statuses by what they demand of the operator', async () => {
    await setup();

    expect(component.severity('delivered')).toBe('success');
    expect(component.severity('pending')).toBe('warn');
    // Tout le reste est un echec : mieux vaut alarmer a tort sur un statut
    // inconnu que de le peindre en vert.
    expect(component.severity('failed')).toBe('danger');
    expect(component.severity('inconnu')).toBe('danger');
  });

  it('reloads after a replay, since the status changes', async () => {
    await setup();
    api.deliveries.mockClear();

    await component.replay(delivery());

    expect(api.replayDelivery).toHaveBeenCalledWith('d1');
    expect(api.deliveries).toHaveBeenCalled();
  });

  it('clears the replay spinner even when the replay fails', async () => {
    await setup();
    api.replayDelivery.mockRejectedValue(new Error('503'));

    await component.replay(delivery());

    expect(component.replaying()).toBeNull();
  });
});
