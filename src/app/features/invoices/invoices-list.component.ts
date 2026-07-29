import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import {
  AdminApiService,
  Invoice,
  InvoiceLineDraft,
  TaxCode,
} from '../../core/api/admin-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

type Severity = 'success' | 'info' | 'warn' | 'danger';

/** Une ligne du formulaire. Le montant y est saisi en euros — la conversion en
 *  centimes se fait au dernier moment, à l'envoi. */
interface LigneSaisie {
  description: string;
  quantity: number;
  unit_euros: number | null;
  tax_code: string;
}

function ligneVide(): LigneSaisie {
  return { description: '', quantity: 1, unit_euros: null, tax_code: '' };
}

/**
 * Facturation directe de prestations (§16 du design).
 *
 * Le cycle de vie est celui de Stripe et il est volontairement manuel :
 * brouillon → finalisation → envoi. La finalisation est irréversible — c'est
 * elle qui attribue le numéro — d'où la confirmation avant de la déclencher.
 */
@Component({
  selector: 'app-invoices-list',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    TranslocoPipe,
    ButtonModule,
    DatePickerModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    TableModule,
    TagModule,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <section>
      <app-page-header [icon]="'pi-file'" [title]="'invoices.title' | transloco" />

      <div class="toolbar">
        <p-button
          [label]="'invoices.new' | transloco"
          icon="pi pi-plus"
          (onClick)="openForm()"
        />
        <p-button
          [label]="'invoices.export' | transloco"
          icon="pi pi-download"
          severity="secondary"
          [outlined]="true"
          [loading]="exporting()"
          (onClick)="exportCsv()"
        />
      </div>

      @if (loading()) {
        <p-skeleton height="12rem" />
      } @else if (invoices().length === 0) {
        <app-empty-state [icon]="'pi-file'" [title]="'invoices.empty' | transloco" />
      } @else {
        <p-table [value]="invoices()" [tableStyle]="{ 'min-width': '56rem' }">
          <ng-template #header>
            <tr>
              <th>{{ 'invoices.number' | transloco }}</th>
              <th>{{ 'invoices.customer' | transloco }}</th>
              <th>{{ 'invoices.origin' | transloco }}</th>
              <th>{{ 'common.status' | transloco }}</th>
              <th class="amount">{{ 'invoices.total' | transloco }}</th>
              <th>{{ 'invoices.issued' | transloco }}</th>
              <th class="actions-col">{{ 'common.actions' | transloco }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-f>
            <tr>
              <td>{{ f.number || ('invoices.draft' | transloco) }}</td>
              <td>{{ f.customer_email || '—' }}</td>
              <td><code>{{ f.origin }}</code></td>
              <td><p-tag [severity]="severity(f.status)" [value]="f.status" /></td>
              <td class="amount">{{ f.total / 100 | currency: f.currency.toUpperCase() }}</td>
              <td>{{ f.created ? (f.created | date: 'shortDate') : '—' }}</td>
              <td class="actions-col">
                @if (f.status === 'draft') {
                  <p-button
                    [label]="'invoices.finalize' | transloco"
                    icon="pi pi-lock"
                    [text]="true"
                    [loading]="busy() === f.id"
                    (onClick)="confirmFinalize(f)"
                  />
                }
                @if (f.status === 'open') {
                  <p-button
                    [label]="'invoices.send' | transloco"
                    icon="pi pi-send"
                    [text]="true"
                    [loading]="busy() === f.id"
                    (onClick)="run(f, 'send')"
                  />
                  <p-button
                    [label]="'invoices.mark_paid' | transloco"
                    icon="pi pi-check"
                    severity="success"
                    [text]="true"
                    [loading]="busy() === f.id"
                    (onClick)="run(f, 'mark_paid')"
                  />
                }
                @if (f.invoice_pdf) {
                  <a class="pdf" [href]="f.invoice_pdf" target="_blank" rel="noopener">
                    <i class="pi pi-file-pdf"></i> PDF
                  </a>
                }
              </td>
            </tr>
          </ng-template>
        </p-table>
      }

      <p-dialog
        [visible]="formOpen()"
        (visibleChange)="!$event && formOpen.set(false)"
        [modal]="true"
        [style]="{ width: '52rem' }"
        [header]="'invoices.new' | transloco"
      >
        <div class="field">
          <label for="email">{{ 'invoices.customer_email' | transloco }}</label>
          <input pInputText id="email" [(ngModel)]="email" type="email" />
        </div>
        <div class="field">
          <label for="name">{{ 'invoices.customer_name' | transloco }}</label>
          <input pInputText id="name" [(ngModel)]="name" />
        </div>

        <table class="lines">
          <thead>
            <tr>
              <th>{{ 'invoices.line_description' | transloco }}</th>
              <th>{{ 'invoices.line_quantity' | transloco }}</th>
              <th>{{ 'invoices.line_unit' | transloco }}</th>
              <th>{{ 'invoices.line_tax_code' | transloco }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (ligne of lines(); track $index) {
              <tr>
                <td><input pInputText [(ngModel)]="ligne.description" /></td>
                <td>
                  <p-inputnumber [(ngModel)]="ligne.quantity" [min]="1" [showButtons]="false" />
                </td>
                <td>
                  <p-inputnumber
                    [(ngModel)]="ligne.unit_euros"
                    mode="currency"
                    currency="EUR"
                    [minFractionDigits]="2"
                  />
                </td>
                <td>
                  <!-- Le catalogue vient de Stripe : inventer un code fiscal
                       donnerait une facture au mauvais régime de TVA, sans
                       que rien ne le signale. -->
                  <p-select
                    [options]="taxCodes()"
                    [(ngModel)]="ligne.tax_code"
                    optionLabel="name"
                    optionValue="id"
                    [filter]="true"
                    [showClear]="true"
                    [placeholder]="'invoices.line_tax_code' | transloco"
                  />
                </td>
                <td>
                  <p-button
                    icon="pi pi-trash"
                    severity="danger"
                    [text]="true"
                    [disabled]="lines().length === 1"
                    (onClick)="removeLine($index)"
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>

        <p-button
          [label]="'invoices.add_line' | transloco"
          icon="pi pi-plus"
          [text]="true"
          (onClick)="addLine()"
        />

        <p class="total">
          {{ 'invoices.subtotal' | transloco }} :
          <strong>{{ subtotalEuros() | currency: 'EUR' }}</strong>
          <span class="hint">{{ 'invoices.tax_hint' | transloco }}</span>
        </p>

        <ng-template #footer>
          <p-button
            [label]="'common.cancel' | transloco"
            severity="secondary"
            [text]="true"
            (onClick)="formOpen.set(false)"
          />
          <p-button
            [label]="'invoices.create_draft' | transloco"
            icon="pi pi-file-edit"
            [loading]="saving()"
            [disabled]="!formValid()"
            (onClick)="submit()"
          />
        </ng-template>
      </p-dialog>
    </section>
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .actions-col {
        white-space: nowrap;
        text-align: right;
      }
      .amount {
        text-align: right;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 0.75rem;
      }
      .lines {
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0 0.5rem;
      }
      .lines th {
        text-align: left;
        font-weight: 500;
        color: var(--muted);
        padding-bottom: 0.25rem;
      }
      .lines td {
        padding: 0.25rem 0.25rem 0.25rem 0;
      }
      .total {
        margin-top: 1rem;
        text-align: right;
      }
      .hint {
        display: block;
        color: var(--muted);
        font-size: 0.85rem;
      }
      .pdf {
        margin-left: 0.5rem;
        white-space: nowrap;
      }
      @media (max-width: 40rem) {
        .lines,
        .lines tbody,
        .lines tr,
        .lines td {
          display: block;
          width: 100%;
        }
        .lines thead {
          display: none;
        }
      }
    `,
  ],
})
export class InvoicesListComponent {
  private readonly api = inject(AdminApiService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly taxCodes = signal<TaxCode[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly exporting = signal(false);
  protected readonly busy = signal<string | null>(null);
  protected readonly formOpen = signal(false);

  protected email = '';
  protected name = '';
  protected readonly lines = signal<LigneSaisie[]>([ligneVide()]);

  protected readonly subtotalEuros = computed(() =>
    this.lines().reduce((somme, l) => somme + (l.unit_euros ?? 0) * (l.quantity || 0), 0),
  );

  constructor() {
    void this.load();
  }

  protected severity(status: string): Severity {
    if (status === 'paid') return 'success';
    if (status === 'open') return 'info';
    if (status === 'draft') return 'warn';
    return 'danger';
  }

  protected formValid(): boolean {
    return (
      this.email.includes('@') &&
      this.lines().every((l) => l.description.trim() !== '' && (l.unit_euros ?? 0) > 0)
    );
  }

  protected addLine() {
    this.lines.update((lignes) => [...lignes, ligneVide()]);
  }

  protected removeLine(index: number) {
    this.lines.update((lignes) => lignes.filter((_, i) => i !== index));
  }

  protected openForm() {
    this.email = '';
    this.name = '';
    this.lines.set([ligneVide()]);
    this.formOpen.set(true);
    void this.loadTaxCodes();
  }

  private async load() {
    this.loading.set(true);
    try {
      this.invoices.set(await this.api.invoices());
    } catch {
      this.toastError('invoices.load_failed');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadTaxCodes() {
    if (this.taxCodes().length > 0) return;
    try {
      this.taxCodes.set(await this.api.taxCodes(''));
    } catch {
      // Le catalogue est indisponible tant que les clés Stripe ne sont pas
      // posées (lot L6). Le reste du formulaire fonctionne sans.
      this.taxCodes.set([]);
    }
  }

  protected async submit() {
    this.saving.set(true);
    try {
      await this.api.createInvoice({
        customer: { email: this.email, name: this.name },
        lines: this.lines().map(
          (l): InvoiceLineDraft => ({
            description: l.description,
            quantity: l.quantity,
            // Arrondi explicite : 75.10 € vaut 7510 centimes, et un flottant
            // non arrondi donnerait 7509.
            unit_amount: Math.round((l.unit_euros ?? 0) * 100),
            tax_code: l.tax_code || undefined,
          }),
        ),
        days_until_due: 30,
      });
      this.formOpen.set(false);
      await this.load();
      this.toastSuccess('invoices.drafted');
    } catch (error) {
      this.toastError('invoices.create_failed', error);
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmFinalize(invoice: Invoice) {
    this.confirm.confirm({
      message: this.transloco.translate('invoices.finalize_confirm'),
      accept: () => void this.run(invoice, 'finalize'),
    });
  }

  protected async run(invoice: Invoice, action: 'finalize' | 'send' | 'mark_paid' | 'void') {
    this.busy.set(invoice.id);
    try {
      await this.api.invoiceAction(invoice.id, action);
      await this.load();
      this.toastSuccess(`invoices.${action}_done`);
    } catch (error) {
      this.toastError('invoices.action_failed', error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async exportCsv() {
    this.exporting.set(true);
    try {
      const blob = await this.api.exportInvoices();
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = 'factures.csv';
      lien.click();
      URL.revokeObjectURL(url);
    } catch {
      this.toastError('invoices.export_failed');
    } finally {
      this.exporting.set(false);
    }
  }

  private toastSuccess(key: string) {
    this.messages.add({ severity: 'success', summary: this.transloco.translate(key) });
  }

  private toastError(key: string, error?: unknown) {
    const detail = (error as { error?: { detail?: string } })?.error?.detail;
    this.messages.add({
      severity: 'error',
      summary: this.transloco.translate(key),
      detail,
    });
  }
}
