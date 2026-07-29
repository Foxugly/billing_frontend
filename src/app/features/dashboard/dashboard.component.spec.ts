import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApiService, Dashboard } from '../../core/api/admin-api.service';
import { TranslocoHttpLoader } from '../../core/i18n/transloco-loader';
import { DashboardComponent } from './dashboard.component';

const DASHBOARD: Dashboard = {
  mrr_cents: 123456,
  apps: [{ slug: 'poker', name: 'Poker', active: true, paid: 2, total: 5 }],
  deliveries: { pending: 1, failed: 3 },
  customers: 7,
};

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: any;
  let api: { dashboard: ReturnType<typeof vi.fn> };

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
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

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(() => {
    api = { dashboard: vi.fn().mockResolvedValue(DASHBOARD) };
  });

  it('renders cents as euros, not as a raw integer', async () => {
    await setup();

    // 123456 centimes = 1 234,56 EUR. Afficher les centimes tels quels ferait
    // lire un MRR cent fois trop gros.
    expect(component.euros(123456)).toContain('234,56');
  });

  it('stops loading once the figures are in', async () => {
    await setup();

    expect(component.loading()).toBe(false);
    expect(component.data()?.mrr_cents).toBe(123456);
  });

  it('stops loading even when the figures cannot be fetched', async () => {
    // Sinon la page reste un squelette indefiniment, sans rien dire.
    api.dashboard.mockRejectedValue(new Error('503'));

    await setup();

    expect(component.loading()).toBe(false);
    expect(component.data()).toBeNull();
  });
});
