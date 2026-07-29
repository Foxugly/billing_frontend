import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApiService, StripeEvent } from '../../core/api/admin-api.service';
import { TranslocoHttpLoader } from '../../core/i18n/transloco-loader';
import { EventsListComponent } from './events-list.component';

function event(overrides: Partial<StripeEvent> = {}): StripeEvent {
  return {
    id: 'evt_1',
    type: 'customer.subscription.updated',
    created: '2026-07-29T10:00:00Z',
    livemode: true,
    handled: true,
    app_slug: 'poker',
    external_user_id: '42',
    ...overrides,
  };
}

describe('EventsListComponent', () => {
  let fixture: ComponentFixture<EventsListComponent>;
  let component: any;
  let api: { events: ReturnType<typeof vi.fn>; replayEvent: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = {
      events: vi.fn().mockResolvedValue([event()]),
      replayEvent: vi
        .fn()
        .mockResolvedValue({ id: 'evt_1', delivery: 'd1', detail: 'Droit recalculé.' }),
    };

    await TestBed.configureTestingModule({
      imports: [EventsListComponent],
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EventsListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('asks for everything by default, ours and not ours', () => {
    // Restreindre d'office cacherait les événements non attribuables, qui sont
    // précisément le symptôme à repérer.
    expect(api.events).toHaveBeenCalledWith({ type: undefined, handled: false });
  });

  it('narrows to what we act on when asked', async () => {
    component.onlyHandled = true;
    component.typeFilter = 'subscription';

    await component.load();

    expect(api.events).toHaveBeenLastCalledWith({ type: 'subscription', handled: true });
  });

  it('relays what the server says it did after a replay', async () => {
    const messages = TestBed.inject(MessageService);
    const add = vi.spyOn(messages, 'add');

    await component.replay(event());

    // « Droit recalculé » et « rien à recalculer » sont deux résultats distincts :
    // les afficher tous les deux évite de croire à un rejeu utile qui n'a rien fait.
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', detail: 'Droit recalculé.' }),
    );
  });

  it('reloads the list after a replay, since the handling changes', async () => {
    api.events.mockClear();

    await component.replay(event());

    expect(api.events).toHaveBeenCalled();
  });

  it('jumps to the entitlement of the targeted user', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.openEntitlement(event());

    expect(navigate).toHaveBeenCalledWith(['/entitlements'], {
      queryParams: { app: 'poker', user: '42' },
    });
  });
});
