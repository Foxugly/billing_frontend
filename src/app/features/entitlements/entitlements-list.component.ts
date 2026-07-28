import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import {
  AdminApiService,
  BillingApp,
  BillingPlan,
  Entitlement,
} from '../../core/api/admin-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * Les droits : qui a accès à quoi, et comment le lui donner à la main.
 *
 * « Offrir l'accès » passe l'entitlement en `source=manual`, la seule façon
 * correcte d'ouvrir un accès sans paiement : éditer les champs dérivés créerait
 * un état que le prochain webhook écraserait sans prévenir.
 *
 * Le dialogue impose de choisir des quotas. Un droit payé mais sans quota est
 * un piège : l'application le voit « à jour » et refuse quand même — c'est
 * exactement ce qui se passerait en offrant l'accès sans y penser.
 */
@Component({
  selector: 'app-entitlements-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TranslocoPipe,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    SkeletonModule,
    TableModule,
    TagModule,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <section>
      <app-page-header [icon]="'pi-key'" [title]="'entitlements.title' | transloco" />

      <div class="filters">
        <p-select
          [options]="appOptions()"
          [(ngModel)]="app"
          optionLabel="label"
          optionValue="value"
          [placeholder]="'entitlements.all_apps' | transloco"
          (onChange)="load()"
        />
        <input
          pInputText
          [(ngModel)]="user"
          [placeholder]="'entitlements.search_user' | transloco"
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
      } @else if (entitlements().length === 0) {
        <app-empty-state [icon]="'pi-key'" [title]="'entitlements.empty' | transloco" />
      } @else {
        <p-table [value]="entitlements()" [tableStyle]="{ 'min-width': '60rem' }">
          <ng-template #header>
            <tr>
              <th>{{ 'entitlements.target' | transloco }}</th>
              <th>{{ 'entitlements.access' | transloco }}</th>
              <th>{{ 'entitlements.plan' | transloco }}</th>
              <th>{{ 'entitlements.quotas' | transloco }}</th>
              <th>{{ 'entitlements.period_end' | transloco }}</th>
              <th>{{ 'entitlements.source' | transloco }}</th>
              <th class="actions-col">{{ 'common.actions' | transloco }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-e>
            <tr>
              <td>
                <code>{{ e.app_slug }}</code> · {{ e.external_user_id }}
              </td>
              <td>
                <p-tag
                  [severity]="e.is_paid ? 'success' : 'secondary'"
                  [value]="
                    (e.is_paid ? 'entitlements.open' : 'entitlements.closed') | transloco
                  "
                />
                @if (e.status) {
                  <span class="status">{{ e.status }}</span>
                }
              </td>
              <td>{{ e.plan_code || '—' }}{{ e.interval ? ' · ' + e.interval : '' }}</td>
              <td class="quotas">{{ describeQuotas(e) }}</td>
              <td>
                {{ e.current_period_end ? (e.current_period_end | date: 'short') : '—' }}
                <!-- La période de grâce explique un accès encore ouvert après
                     un échec de paiement : sans elle, l'état paraît incohérent. -->
                @if (e.grace_until) {
                  <span class="status">{{ 'entitlements.grace' | transloco }}</span>
                }
              </td>
              <td>
                <p-tag
                  [severity]="e.source === 'manual' ? 'info' : 'secondary'"
                  [value]="e.source"
                />
              </td>
              <td class="actions-col">
                <p-button
                  [label]="'entitlements.grant' | transloco"
                  icon="pi pi-gift"
                  severity="info"
                  [text]="true"
                  (onClick)="openGrant(e)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      }

      <p-dialog
        [header]="'entitlements.grant_title' | transloco"
        [modal]="true"
        [style]="{ width: '32rem' }"
        [(visible)]="grantOpen"
      >
        @if (target(); as t) {
          <p class="target">
            <code>{{ t.app_slug }}</code> · {{ t.external_user_id }}
          </p>

          <p-message severity="info" [text]="'entitlements.grant_hint' | transloco" />

          <label class="field">
            <span>{{ 'entitlements.grant_plan' | transloco }}</span>
            <p-select
              [options]="planOptions()"
              [(ngModel)]="planId"
              optionLabel="label"
              optionValue="value"
              [placeholder]="'entitlements.grant_pick_plan' | transloco"
            />
          </label>

          @if (selectedPlan(); as plan) {
            @if (plan.per_unit_quota_key) {
              <label class="field">
                <span>{{ 'entitlements.grant_units' | transloco }}</span>
                <p-inputNumber [(ngModel)]="units" [min]="1" [showButtons]="true" />
              </label>
            }
            <p class="preview">
              {{ 'entitlements.grant_result' | transloco }} <code>{{ quotasPreview() }}</code>
            </p>
          }

          @if (noQuota()) {
            <!-- Un droit ouvert sans quota est un piège : l'application le voit
                 à jour et refuse quand même. Mieux vaut bloquer ici. -->
            <p-message severity="warn" [text]="'entitlements.grant_no_quota' | transloco" />
          }
        }

        <ng-template #footer>
          <p-button
            [label]="'common.cancel' | transloco"
            [text]="true"
            severity="secondary"
            (onClick)="grantOpen = false"
          />
          <p-button
            [label]="'entitlements.grant' | transloco"
            icon="pi pi-gift"
            severity="success"
            [disabled]="!selectedPlan() || noQuota()"
            [loading]="granting()"
            (onClick)="confirmGrant()"
          />
        </ng-template>
      </p-dialog>
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
      .status {
        margin-left: 0.5rem;
        font-size: 0.8rem;
        color: var(--muted);
      }
      .quotas {
        font-size: 0.85rem;
      }
      .field {
        display: grid;
        gap: 0.3rem;
        margin: 1rem 0;
      }
      .field > span {
        font-size: 0.85rem;
        color: var(--muted);
      }
      .target,
      .preview {
        margin: 0 0 1rem;
      }
    `,
  ],
})
export class EntitlementsListComponent {
  private readonly api = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly entitlements = signal<Entitlement[]>([]);
  protected readonly apps = signal<BillingApp[]>([]);
  protected readonly loading = signal(true);
  protected readonly granting = signal(false);

  protected app = '';
  protected user = '';

  protected readonly target = signal<Entitlement | null>(null);
  protected readonly plans = signal<BillingPlan[]>([]);
  protected planId: number | null = null;
  protected units = 1;
  protected grantOpen = false;

  protected readonly appOptions = () => [
    { label: '—', value: '' },
    ...this.apps().map((a) => ({ label: a.name, value: a.slug })),
  ];

  protected readonly planOptions = () =>
    this.plans().map((p) => ({ label: `${p.name} (${p.code})`, value: p.id }));

  protected readonly selectedPlan = computed(
    () => this.plans().find((p) => p.id === this.planId) ?? null,
  );

  constructor() {
    // La page clients renvoie ici avec ?app=&user= : respecter ces filtres évite
    // d'atterrir sur une liste où le compte cherché est noyé.
    this.app = this.route.snapshot.queryParamMap.get('app') ?? '';
    this.user = this.route.snapshot.queryParamMap.get('user') ?? '';
    void this.init();
  }

  private async init(): Promise<void> {
    this.apps.set(await this.api.apps().catch(() => []));
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.entitlements.set(
        await this.api.entitlements({
          ...(this.app ? { app: this.app } : {}),
          ...(this.user.trim() ? { user: this.user.trim() } : {}),
        }),
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected describeQuotas(entitlement: Entitlement): string {
    const entries = Object.entries(entitlement.quotas ?? {});
    return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(', ') : '—';
  }

  /** Les quotas que l'octroi écrira, dérivés du plan choisi. */
  protected quotas(): Record<string, number> {
    const plan = this.selectedPlan();
    if (!plan) {
      return {};
    }
    return plan.per_unit_quota_key
      ? { [plan.per_unit_quota_key]: Math.max(1, this.units) }
      : { ...(plan.quotas ?? {}) };
  }

  protected quotasPreview(): string {
    const entries = Object.entries(this.quotas());
    return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '{}';
  }

  /** Un plan sans quota ni clé à l'unité n'ouvrirait rien : on refuse l'octroi. */
  protected noQuota(): boolean {
    return !!this.selectedPlan() && Object.keys(this.quotas()).length === 0;
  }

  protected async openGrant(entitlement: Entitlement): Promise<void> {
    this.target.set(entitlement);
    this.planId = null;
    this.units = 1;
    this.grantOpen = true;
    this.plans.set(await this.api.plans(entitlement.app_slug).catch(() => []));
  }

  protected async confirmGrant(): Promise<void> {
    const entitlement = this.target();
    if (!entitlement || !this.selectedPlan()) {
      return;
    }
    this.granting.set(true);
    try {
      await this.api.grantEntitlement(entitlement.id, this.quotas());
      this.messages.add({
        severity: 'success',
        summary: this.transloco.translate('entitlements.granted'),
      });
      this.grantOpen = false;
      await this.load();
    } catch {
      this.messages.add({
        severity: 'error',
        summary: this.transloco.translate('entitlements.grant_failed'),
      });
    } finally {
      this.granting.set(false);
    }
  }
}
