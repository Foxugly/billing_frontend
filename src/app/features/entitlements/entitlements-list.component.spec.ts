import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from '../../core/i18n/transloco-loader';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApiService, BillingPlan, Entitlement } from '../../core/api/admin-api.service';
import { EntitlementsListComponent } from './entitlements-list.component';

function plan(overrides: Partial<BillingPlan> = {}): BillingPlan {
  return {
    id: 1,
    app: 1,
    app_slug: 'pushit',
    code: 'app',
    name: 'Par application',
    description: '',
    price_monthly: null,
    price_yearly: null,
    price_monthly_amount: 200,
    price_yearly_amount: null,
    quotas: {},
    per_unit_quota_key: 'applications',
    trial_days: 30,
    sort_order: 1,
    public: true,
    active: true,
    ...overrides,
  };
}

function entitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    id: 7,
    app_slug: 'pushit',
    external_user_id: '42',
    is_paid: false,
    status: '',
    plan_code: '',
    interval: '',
    quotas: {},
    current_period_end: null,
    grace_until: null,
    stripe_customer_id: '',
    source: 'stripe',
    computed_at: '2026-07-28T10:00:00Z',
    ...overrides,
  };
}

describe('EntitlementsListComponent', () => {
  let fixture: ComponentFixture<EntitlementsListComponent>;
  let component: any;
  let api: {
    apps: ReturnType<typeof vi.fn>;
    entitlements: ReturnType<typeof vi.fn>;
    plans: ReturnType<typeof vi.fn>;
    grantEntitlement: ReturnType<typeof vi.fn>;
  };

  async function setup(queryParams: Record<string, string> = {}): Promise<void> {
    api = {
      apps: vi.fn().mockResolvedValue([]),
      entitlements: vi.fn().mockResolvedValue([entitlement()]),
      plans: vi.fn().mockResolvedValue([plan()]),
      grantEntitlement: vi.fn().mockResolvedValue(entitlement({ is_paid: true })),
    };

    await TestBed.configureTestingModule({
      imports: [EntitlementsListComponent],
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

    fixture = TestBed.createComponent(EntitlementsListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  it('honours the filters passed by the customers page', async () => {
    // Sans ça on atterrit sur la liste complète, où le compte cherché est noyé.
    await setup({ app: 'pushit', user: '42' });

    expect(api.entitlements).toHaveBeenCalledWith({ app: 'pushit', user: '42' });
  });

  it('derives the quotas from the number of units on a per-unit plan', async () => {
    await setup();
    await component.openGrant(entitlement());
    component.planId = 1;
    component.units = 3;

    expect(component.quotas()).toEqual({ applications: 3 });
  });

  it('takes the flat quotas as they are on a plan billed per period', async () => {
    await setup();
    api.plans.mockResolvedValue([
      plan({ id: 2, code: 'unlimited', per_unit_quota_key: '', quotas: { applications: 10000 } }),
    ]);
    await component.openGrant(entitlement());
    component.planId = 2;

    expect(component.quotas()).toEqual({ applications: 10000 });
  });

  it('refuses to grant a plan that defines no quota at all', async () => {
    // Un droit paye mais sans quota est un piege : l'application le voit a jour
    // et refuse quand meme. Mieux vaut bloquer ici que livrer un acces inerte.
    await setup();
    api.plans.mockResolvedValue([plan({ id: 3, per_unit_quota_key: '', quotas: {} })]);
    await component.openGrant(entitlement());
    component.planId = 3;

    expect(component.noQuota()).toBe(true);
  });

  it('never grants without a plan chosen', async () => {
    await setup();
    await component.openGrant(entitlement());

    await component.confirmGrant();

    expect(api.grantEntitlement).not.toHaveBeenCalled();
  });

  it('sends the derived quotas along with the grant', async () => {
    await setup();
    await component.openGrant(entitlement());
    component.planId = 1;
    component.units = 5;

    await component.confirmGrant();

    expect(api.grantEntitlement).toHaveBeenCalledWith(7, { applications: 5 });
  });

  it('keeps the dialog open when the grant fails', async () => {
    // La refermer laisserait croire que c'est passe.
    await setup();
    api.grantEntitlement.mockRejectedValue(new Error('boom'));
    await component.openGrant(entitlement());
    component.planId = 1;

    await component.confirmGrant();

    expect(component.grantOpen).toBe(true);
  });

  it('still lists entitlements when the app catalogue cannot be loaded', async () => {
    // Le catalogue n'est qu'un confort de filtrage.
    api = {
      apps: vi.fn().mockRejectedValue(new Error('down')),
      entitlements: vi.fn().mockResolvedValue([entitlement()]),
      plans: vi.fn().mockResolvedValue([]),
      grantEntitlement: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [EntitlementsListComponent],
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
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(EntitlementsListComponent);
    await f.whenStable();

    expect(api.entitlements).toHaveBeenCalled();
  });
});
