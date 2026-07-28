import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';

import { AdminApiService, Delivery } from '../../core/api/admin-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

type Severity = 'success' | 'warn' | 'danger';

/** Les livraisons de droits vers les applications, et leur rejeu. */
@Component({
  selector: 'app-deliveries-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TranslocoPipe,
    ButtonModule,
    SelectButtonModule,
    SkeletonModule,
    TableModule,
    TagModule,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <section class="page">
      <app-page-header [icon]="'pi-send'" [title]="'deliveries.title' | transloco" />

      <p-selectbutton
        [options]="filters"
        [(ngModel)]="status"
        optionLabel="label"
        optionValue="value"
        (onChange)="load()"
        [allowEmpty]="false"
      />

      @if (loading()) {
        <p-skeleton height="12rem" />
      } @else if (deliveries().length === 0) {
        <app-empty-state [icon]="'pi-send'" [title]="'deliveries.empty' | transloco" />
      } @else {
        <p-table [value]="deliveries()" [tableStyle]="{ 'min-width': '52rem' }">
          <ng-template #header>
            <tr>
              <th>{{ 'deliveries.target' | transloco }}</th>
              <th>{{ 'common.status' | transloco }}</th>
              <th>{{ 'deliveries.attempts' | transloco }}</th>
              <th>{{ 'deliveries.last_error' | transloco }}</th>
              <th>{{ 'deliveries.created' | transloco }}</th>
              <th class="actions-col">{{ 'common.actions' | transloco }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-d>
            <tr>
              <td>
                <code>{{ d.app_slug }}</code> · {{ d.external_user_id }}
              </td>
              <td><p-tag [severity]="severity(d.status)" [value]="d.status" /></td>
              <td>{{ d.attempts }}</td>
              <td class="error">{{ d.last_error || '—' }}</td>
              <td>{{ d.created_at | date: 'short' }}</td>
              <td class="actions-col">
                <!-- Rejouer est sans risque : l'application dédoublonne sur le
                     delivery_id et répond 409 si elle l'a déjà vu. -->
                <p-button
                  [label]="'deliveries.replay' | transloco"
                  icon="pi pi-replay"
                  severity="info"
                  [text]="true"
                  [disabled]="d.status === 'delivered'"
                  [loading]="replaying() === d.id"
                  (onClick)="replay(d)"
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
      p-selectbutton {
        display: block;
        margin-bottom: 1rem;
      }
      .actions-col {
        white-space: nowrap;
        text-align: right;
      }
      .error {
        max-width: 18rem;
        font-size: 0.85rem;
        color: var(--text-color-secondary);
        word-break: break-word;
      }
    `,
  ],
})
export class DeliveriesListComponent {
  private readonly api = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly deliveries = signal<Delivery[]>([]);
  protected readonly loading = signal(true);
  protected readonly replaying = signal<string | null>(null);

  protected status = '';
  protected readonly filters = [
    { label: this.transloco.translate('deliveries.all'), value: '' },
    { label: this.transloco.translate('deliveries.pending'), value: 'pending' },
    { label: this.transloco.translate('deliveries.failed'), value: 'failed' },
    { label: this.transloco.translate('deliveries.delivered'), value: 'delivered' },
  ];

  constructor() {
    // Le tableau de bord renvoie ici avec ?status=failed : respecter ce filtre
    // évite d'atterrir sur une liste où l'échec cherché est noyé.
    this.status = this.route.snapshot.queryParamMap.get('status') ?? '';
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.deliveries.set(await this.api.deliveries(this.status ? { status: this.status } : {}));
    } finally {
      this.loading.set(false);
    }
  }

  protected severity(status: string): Severity {
    return status === 'delivered' ? 'success' : status === 'pending' ? 'warn' : 'danger';
  }

  protected async replay(delivery: Delivery): Promise<void> {
    this.replaying.set(delivery.id);
    try {
      await this.api.replayDelivery(delivery.id);
      this.messages.add({
        severity: 'success',
        summary: this.transloco.translate('deliveries.replayed'),
      });
      await this.load();
    } catch {
      this.messages.add({
        severity: 'error',
        summary: this.transloco.translate('deliveries.replay_failed'),
      });
    } finally {
      this.replaying.set(null);
    }
  }
}
