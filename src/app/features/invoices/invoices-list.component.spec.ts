import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { ConfirmationService, MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApiService, Invoice } from '../../core/api/admin-api.service';
import { TranslocoHttpLoader } from '../../core/i18n/transloco-loader';
import { InvoicesListComponent } from './invoices-list.component';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'in_1',
    number: '0001',
    status: 'draft',
    currency: 'eur',
    subtotal: 150000,
    tax: 31500,
    total: 181500,
    amount_due: 181500,
    hosted_invoice_url: null,
    invoice_pdf: null,
    created: '2026-07-29T10:00:00Z',
    customer_email: 'client@exemple.be',
    origin: 'direct',
    ...overrides,
  };
}

describe('InvoicesListComponent', () => {
  let fixture: ComponentFixture<InvoicesListComponent>;
  let component: any;
  let api: {
    invoices: ReturnType<typeof vi.fn>;
    createInvoice: ReturnType<typeof vi.fn>;
    invoiceAction: ReturnType<typeof vi.fn>;
    taxCodes: ReturnType<typeof vi.fn>;
    exportInvoices: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    api = {
      invoices: vi.fn().mockResolvedValue([invoice()]),
      createInvoice: vi.fn().mockResolvedValue(invoice()),
      invoiceAction: vi.fn().mockResolvedValue(invoice({ status: 'open' })),
      taxCodes: vi.fn().mockResolvedValue([{ id: 'txcd_1', name: 'Conseil' }]),
      exportInvoices: vi.fn().mockResolvedValue(new Blob([''])),
    };

    await TestBed.configureTestingModule({
      imports: [InvoicesListComponent],
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

    fixture = TestBed.createComponent(InvoicesListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('sends amounts in cents, rounded — a cent lost here is a wrong invoice', async () => {
    component.openForm();
    component.email = 'client@exemple.be';
    component.lines.set([
      { description: 'Audit', quantity: 2, unit_euros: 75.1, tax_code: 'txcd_1' },
    ]);

    await component.submit();

    expect(api.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [{ description: 'Audit', quantity: 2, unit_amount: 7510, tax_code: 'txcd_1' }],
      }),
    );
  });

  it('refuses to submit a line without an amount', () => {
    component.email = 'client@exemple.be';
    component.lines.set([{ description: 'Audit', quantity: 1, unit_euros: null, tax_code: '' }]);

    expect(component.formValid()).toBe(false);
  });

  it('refuses to submit without a customer address', () => {
    component.email = '';
    component.lines.set([{ description: 'Audit', quantity: 1, unit_euros: 100, tax_code: '' }]);

    expect(component.formValid()).toBe(false);
  });

  it('totals the lines by quantity', () => {
    component.lines.set([
      { description: 'Audit', quantity: 2, unit_euros: 750, tax_code: '' },
      { description: 'Atelier', quantity: 1, unit_euros: 500, tax_code: '' },
    ]);

    expect(component.subtotalEuros()).toBe(2000);
  });

  it('leaves the form open when the server refuses the draft', async () => {
    // Sinon la saisie est perdue et l'opérateur retape tout.
    api.createInvoice.mockRejectedValue({ error: { detail: 'montant manquant' } });
    component.openForm();
    component.email = 'client@exemple.be';
    component.lines.set([{ description: 'Audit', quantity: 1, unit_euros: 100, tax_code: '' }]);

    await component.submit();

    expect(component.formOpen()).toBe(true);
  });

  it('survives a tax-code catalogue that is not available yet', async () => {
    // Les clés Stripe n'arrivent qu'au lot L6 : le formulaire doit rester utilisable.
    api.taxCodes.mockRejectedValue(new Error('503'));

    component.openForm();
    await fixture.whenStable();

    expect(component.taxCodes()).toEqual([]);
  });
});
