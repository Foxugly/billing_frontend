import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { AdminApiService, BillingApp } from '../../core/api/admin-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/** Les applications de la flotte branchées sur le service de facturation. */
@Component({
  selector: 'app-apps-list',
  standalone: true,
  imports: [
    TranslocoPipe,
    ButtonModule,
    DialogModule,
    SkeletonModule,
    TableModule,
    TagModule,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <section>
      <app-page-header [icon]="'pi-th-large'" [title]="'apps.title' | transloco" />

      @if (loading()) {
        <p-skeleton height="12rem" />
      } @else if (apps().length === 0) {
        <app-empty-state [icon]="'pi-th-large'" [title]="'apps.empty' | transloco" />
      } @else {
        <p-table [value]="apps()" [tableStyle]="{ 'min-width': '48rem' }">
          <ng-template #header>
            <tr>
              <th>{{ 'apps.slug' | transloco }}</th>
              <th>{{ 'apps.endpoint' | transloco }}</th>
              <th>{{ 'apps.plans' | transloco }}</th>
              <th>{{ 'common.status' | transloco }}</th>
              <th class="actions-col">{{ 'common.actions' | transloco }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-app>
            <tr>
              <td>
                <strong>{{ app.name }}</strong>
                <br />
                <code>{{ app.slug }}</code>
              </td>
              <td class="endpoint"><code>{{ app.entitlement_url }}</code></td>
              <td>{{ app.plans_count }}</td>
              <td>
                <p-tag
                  [severity]="app.active ? 'success' : 'secondary'"
                  [value]="(app.active ? 'common.active' : 'common.inactive') | transloco"
                />
              </td>
              <td class="actions-col">
                <p-button
                  [label]="'apps.ping' | transloco"
                  icon="pi pi-bolt"
                  severity="info"
                  [text]="true"
                  [loading]="pinging() === app.id"
                  (onClick)="ping(app)"
                />
                <p-button
                  [label]="'apps.rotate' | transloco"
                  icon="pi pi-refresh"
                  severity="danger"
                  [text]="true"
                  (onClick)="askRotate(app)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      }

      <!-- Le secret n'est affiché qu'ici, une seule fois : il n'est plus relisible
           ensuite, et il ne doit surtout pas être mis en cache par l'application. -->
      <p-dialog
        [visible]="revealed() !== null"
        (visibleChange)="!$event && revealed.set(null)"
        [modal]="true"
        [style]="{ width: '34rem' }"
        [header]="'apps.new_secret' | transloco"
      >
        @if (revealed(); as secret) {
          <p class="warn">{{ 'apps.secret_warning' | transloco }}</p>
          <pre class="secret">{{ secret }}</pre>
        }
        <ng-template #footer>
          <p-button [label]="'common.close' | transloco" (onClick)="revealed.set(null)" />
        </ng-template>
      </p-dialog>
    </section>
  `,
  styles: [
    `
      .actions-col {
        white-space: nowrap;
        text-align: right;
      }
      .endpoint code {
        font-size: 0.8rem;
        word-break: break-all;
      }
      .secret {
        padding: 0.75rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface-2);
        white-space: pre-wrap;
        word-break: break-all;
      }
      .warn {
        color: var(--muted);
      }
    `,
  ],
})
export class AppsListComponent {
  private readonly api = inject(AdminApiService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly apps = signal<BillingApp[]>([]);
  protected readonly loading = signal(true);
  protected readonly pinging = signal<number | null>(null);
  protected readonly revealed = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.apps.set(await this.api.apps());
    } finally {
      this.loading.set(false);
    }
  }

  protected async ping(app: BillingApp): Promise<void> {
    this.pinging.set(app.id);
    try {
      const result = await this.api.pingApp(app.id);
      this.messages.add({
        severity: result.ok ? 'success' : 'error',
        summary: app.slug,
        detail: result.detail,
      });
    } catch {
      this.messages.add({
        severity: 'error',
        summary: app.slug,
        detail: this.transloco.translate('apps.ping_failed'),
      });
    } finally {
      this.pinging.set(null);
    }
  }

  protected askRotate(app: BillingApp): void {
    // Confirmation obligatoire : tant que le nouveau secret n'est pas posé dans le
    // SSM de l'application, seule la fenêtre de grâce de 24 h la maintient à flot.
    this.confirm.confirm({
      header: this.transloco.translate('apps.rotate'),
      message: this.transloco.translate('apps.rotate_confirm', { slug: app.slug }),
      acceptButtonProps: { severity: 'danger' },
      accept: () => void this.rotate(app),
    });
  }

  private async rotate(app: BillingApp): Promise<void> {
    try {
      const result = await this.api.rotateSecret(app.id);
      this.revealed.set(result.shared_secret);
      await this.load();
    } catch {
      this.messages.add({
        severity: 'error',
        summary: app.slug,
        detail: this.transloco.translate('apps.rotate_failed'),
      });
    }
  }
}
