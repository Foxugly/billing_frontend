import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { AdminApiService, BillingApp, BillingCustomer } from '../../core/api/admin-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * Les clients : qui, dans quelle application, et rattaché à quelle fiche Stripe.
 *
 * C'est le point d'entrée du support. Depuis une ligne on saute au droit
 * correspondant, qui est l'endroit où l'on agit — cette page-ci ne modifie rien.
 */
@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TranslocoPipe,
    ButtonModule,
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
      <app-page-header [icon]="'pi-users'" [title]="'customers.title' | transloco" />

      <div class="filters">
        <p-select
          [options]="appOptions()"
          [(ngModel)]="app"
          optionLabel="label"
          optionValue="value"
          [placeholder]="'customers.all_apps' | transloco"
          (onChange)="load()"
        />
        <input
          pInputText
          [(ngModel)]="email"
          [placeholder]="'customers.search_email' | transloco"
          (keyup.enter)="load()"
        />
        <p-button
          [label]="'common.search' | transloco"
          icon="pi pi-search"
          [loading]="loading()"
          (onClick)="load()"
        />
      </div>

      @if (loading()) {
        <p-skeleton height="12rem" />
      } @else if (customers().length === 0) {
        <app-empty-state [icon]="'pi-users'" [title]="'customers.empty' | transloco" />
      } @else {
        <p-table [value]="customers()" [tableStyle]="{ 'min-width': '48rem' }">
          <ng-template #header>
            <tr>
              <th>{{ 'customers.email' | transloco }}</th>
              <th>{{ 'customers.app' | transloco }}</th>
              <th>{{ 'customers.user' | transloco }}</th>
              <th>{{ 'customers.stripe' | transloco }}</th>
              <th>{{ 'customers.created' | transloco }}</th>
              <th class="actions-col">{{ 'common.actions' | transloco }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-c>
            <tr>
              <td>{{ c.email || '—' }}</td>
              <td>
                @if (c.is_direct) {
                  <p-tag severity="secondary" [value]="'customers.direct' | transloco" />
                } @else {
                  <code>{{ c.app_slug }}</code>
                }
              </td>
              <td>{{ c.external_user_id || '—' }}</td>
              <td>
                <!-- Le rattachement à la fiche Stripe est posé par le webhook.
                     Son absence sur un client qui a payé signale une livraison
                     jamais arrivée : c'est un symptôme, pas un détail. -->
                @if (c.customer) {
                  <p-tag severity="success" icon="pi pi-link" [value]="'customers.linked' | transloco" />
                } @else {
                  <p-tag severity="warn" [value]="'customers.unlinked' | transloco" />
                }
              </td>
              <td>{{ c.created_at | date: 'short' }}</td>
              <td class="actions-col">
                <p-button
                  [label]="'customers.see_entitlement' | transloco"
                  icon="pi pi-arrow-right"
                  severity="info"
                  [text]="true"
                  [disabled]="c.is_direct"
                  (onClick)="openEntitlement(c)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      }
    </section>
  `,
  styles: [
    `
      .filters {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
      }
      .actions-col {
        white-space: nowrap;
        text-align: right;
      }
    `,
  ],
})
export class CustomersListComponent {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);

  protected readonly customers = signal<BillingCustomer[]>([]);
  protected readonly apps = signal<BillingApp[]>([]);
  protected readonly loading = signal(true);

  protected app = '';
  protected email = '';

  protected readonly appOptions = () => [
    { label: '—', value: '' },
    ...this.apps().map((a) => ({ label: a.name, value: a.slug })),
  ];

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    // Le catalogue d'apps n'est que du confort de filtrage : son échec ne doit
    // pas priver la page de sa liste.
    this.apps.set(await this.api.apps().catch(() => []));
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.customers.set(
        await this.api.customers({
          ...(this.app ? { app: this.app } : {}),
          ...(this.email.trim() ? { email: this.email.trim() } : {}),
        }),
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected openEntitlement(customer: BillingCustomer): void {
    void this.router.navigate(['/entitlements'], {
      queryParams: { app: customer.app_slug, user: customer.external_user_id },
    });
  }
}
