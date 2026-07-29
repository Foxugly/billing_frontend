import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { ConfirmationService, MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AdminApiService,
  BillingApp,
  BillingPlan,
  StripePrice,
} from '../../core/api/admin-api.service';
import { TranslocoHttpLoader } from '../../core/i18n/transloco-loader';
import { PlansListComponent } from './plans-list.component';

function plan(overrides: Partial<BillingPlan> = {}): BillingPlan {
  return {
    id: 1,
    app: 1,
    app_slug: 'poker',
    code: 'team1',
    name: 'Une équipe',
    description: '',
    price_monthly: 'price_m',
    price_yearly: null,
    price_monthly_amount: 500,
    price_yearly_amount: null,
    quotas: { teams: 1 },
    per_unit_quota_key: '',
    trial_days: 0,
    sort_order: 1,
    public: true,
    active: true,
    ...overrides,
  };
}

const APP: BillingApp = {
  id: 1,
  slug: 'poker',
  name: 'Poker',
  base_url: 'https://poker-api.foxugly.com',
  entitlement_path: '/api/v1/billing/entitlement/',
  entitlement_url: 'https://poker-api.foxugly.com/api/v1/billing/entitlement/',
  active: true,
  plans_count: 2,
  secret_rotated_at: null,
  created_at: '2026-07-28T10:00:00Z',
};

const PRICES: StripePrice[] = [
  { id: 'price_m', unit_amount: 500, currency: 'EUR', interval: 'month', nickname: '', product_name: 'Une équipe' },
  { id: 'price_y', unit_amount: 5000, currency: 'EUR', interval: 'year', nickname: '', product_name: 'Une équipe' },
  { id: 'price_one', unit_amount: 9900, currency: 'EUR', interval: '', nickname: '', product_name: 'Audit' },
];

describe('PlansListComponent', () => {
  let fixture: ComponentFixture<PlansListComponent>;
  let component: any;
  let api: {
    plans: ReturnType<typeof vi.fn>;
    apps: ReturnType<typeof vi.fn>;
    prices: ReturnType<typeof vi.fn>;
    savePlan: ReturnType<typeof vi.fn>;
    deletePlan: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    api = {
      plans: vi.fn().mockResolvedValue([plan()]),
      apps: vi.fn().mockResolvedValue([APP]),
      prices: vi.fn().mockResolvedValue(PRICES),
      savePlan: vi.fn().mockResolvedValue(plan()),
      deletePlan: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [PlansListComponent],
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

    fixture = TestBed.createComponent(PlansListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('never offers a one-off price as a subscription price', () => {
    // Un prix sans récurrence rendrait le plan invendable en abonnement.
    expect(component.monthlyPrices().map((p: { id: string }) => p.id)).toEqual(['price_m']);
    expect(component.yearlyPrices().map((p: { id: string }) => p.id)).toEqual(['price_y']);
  });

  it('drops the fixed quotas on a per-unit plan', async () => {
    // Sinon deux sources de vérité cohabitent, et c'est la mauvaise qui gagne
    // au premier recalcul.
    component.openForm(plan({ per_unit_quota_key: 'applications' }));
    component.quotasText = '{"applications": 5}';

    await component.save();

    expect(api.savePlan).toHaveBeenCalledWith(expect.objectContaining({ quotas: {} }));
  });

  it('keeps the fixed quotas on a plan billed per period', async () => {
    component.openForm(plan());
    component.quotasText = '{"teams": 3}';

    await component.save();

    expect(api.savePlan).toHaveBeenCalledWith(expect.objectContaining({ quotas: { teams: 3 } }));
  });

  it('refuses to save invalid JSON quotas rather than wiping them', async () => {
    component.openForm(plan());
    component.quotasText = '{teams: 3';

    await component.save();

    expect(api.savePlan).not.toHaveBeenCalled();
    expect(component.quotasError()).toBe(true);
  });

  it('requires an app, a code and a name', () => {
    component.openForm(null);
    component.draft.code = '';

    expect(component.formValid()).toBe(false);

    component.draft.code = 'team1';
    component.draft.name = 'Une équipe';

    expect(component.formValid()).toBe(true);
  });
});
