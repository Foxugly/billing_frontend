import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApiService, BillingCustomer } from '../../core/api/admin-api.service';
import { TranslocoHttpLoader } from '../../core/i18n/transloco-loader';
import { CustomersListComponent } from './customers-list.component';

function customer(overrides: Partial<BillingCustomer> = {}): BillingCustomer {
  return {
    id: 1,
    app: 1,
    app_slug: 'poker',
    is_direct: false,
    external_user_id: '42',
    email: 'client@exemple.be',
    customer: 'cus_1',
    created_at: '2026-07-28T10:00:00Z',
    ...overrides,
  };
}

describe('CustomersListComponent', () => {
  let fixture: ComponentFixture<CustomersListComponent>;
  let component: any;
  let api: { customers: ReturnType<typeof vi.fn>; apps: ReturnType<typeof vi.fn> };

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CustomersListComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['fr'], defaultLang: 'fr' },
          loader: TranslocoHttpLoader,
        }),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomersListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(() => {
    api = {
      customers: vi.fn().mockResolvedValue([customer()]),
      apps: vi.fn().mockResolvedValue([]),
    };
  });

  it('asks without filters when none are set', async () => {
    // Envoyer `app: ''` ferait filtrer sur une app nommee chaine vide : liste vide.
    await setup();

    expect(api.customers).toHaveBeenCalledWith({});
  });

  it('trims the searched address before filtering', async () => {
    await setup();
    component.email = '  client@exemple.be  ';

    await component.load();

    expect(api.customers).toHaveBeenLastCalledWith({ email: 'client@exemple.be' });
  });

  it('ignores an address made only of spaces', async () => {
    await setup();
    component.email = '   ';

    await component.load();

    expect(api.customers).toHaveBeenLastCalledWith({});
  });

  it('still lists the customers when the app catalogue is unavailable', async () => {
    // Le catalogue n'est que du confort de filtrage : son echec ne doit pas
    // priver la page de sa raison d'etre.
    api.apps.mockRejectedValue(new Error('503'));

    await setup();

    expect(component.customers().length).toBe(1);
    expect(component.appOptions()).toEqual([{ label: '—', value: '' }]);
  });

  it('jumps to the entitlement of the chosen customer', async () => {
    await setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.openEntitlement(customer());

    expect(navigate).toHaveBeenCalledWith(['/entitlements'], {
      queryParams: { app: 'poker', user: '42' },
    });
  });
});
