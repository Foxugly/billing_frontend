import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import {
  AdminApiService,
  BillingApp,
  BillingPlan,
  StripePrice,
} from '../../core/api/admin-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/** Un plan vierge, prêt pour le formulaire de création. */
function planVide(appId: number | null): Partial<BillingPlan> {
  return {
    app: appId ?? undefined,
    code: '',
    name: '',
    description: '',
    price_monthly: null,
    price_yearly: null,
    quotas: {},
    per_unit_quota_key: '',
    trial_days: 0,
    sort_order: 0,
    public: true,
    active: true,
  };
}

/**
 * Le catalogue : ce que chaque application vend, et à quel prix Stripe c'est
 * adossé.
 *
 * Deux pièges que la page rend visibles plutôt que de les laisser se découvrir
 * au premier achat : un plan sans aucun prix configuré n'apparaît pas dans le
 * catalogue servi aux apps, et un plan facturé à l'unité tire ses quotas de la
 * quantité souscrite — ses `quotas` figés doivent rester vides.
 */
@Component({
  selector: 'app-plans-list',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoPipe,
    ButtonModule,
    CheckboxModule,
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
      <app-page-header [icon]="'pi-tags'" [title]="'plans.title' | transloco" />

      <div class="toolbar">
        <p-select
          [options]="apps()"
          [(ngModel)]="appFilter"
          optionLabel="slug"
          optionValue="slug"
          [showClear]="true"
          [placeholder]="'plans.all_apps' | transloco"
          (onChange)="load()"
        />
        <p-button [label]="'plans.new' | transloco" icon="pi pi-plus" (onClick)="openForm(null)" />
      </div>

      @if (loading()) {
        <p-skeleton height="12rem" />
      } @else if (plans().length === 0) {
        <app-empty-state [icon]="'pi-tags'" [title]="'plans.empty' | transloco" />
      } @else {
        <p-table [value]="plans()" [tableStyle]="{ 'min-width': '54rem' }">
          <ng-template #header>
            <tr>
              <th>{{ 'plans.plan' | transloco }}</th>
              <th>{{ 'plans.prices' | transloco }}</th>
              <th>{{ 'plans.quotas' | transloco }}</th>
              <th>{{ 'plans.trial' | transloco }}</th>
              <th>{{ 'common.status' | transloco }}</th>
              <th class="actions-col">{{ 'common.actions' | transloco }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-p>
            <tr>
              <td>
                <strong>{{ p.name }}</strong>
                <br />
                <code>{{ p.app_slug }} · {{ p.code }}</code>
              </td>
              <td>
                @if (!p.price_monthly && !p.price_yearly) {
                  <!-- Un plan sans prix est exclu du catalogue servi aux apps :
                       il ne se vendra jamais, autant le dire ici. -->
                  <p-tag severity="danger" [value]="'plans.no_price' | transloco" />
                } @else {
                  <span class="prices">
                    @if (p.price_monthly_amount !== null) {
                      {{ p.price_monthly_amount / 100 }} €/{{ 'plans.month' | transloco }}
                    }
                    @if (p.price_yearly_amount !== null) {
                      · {{ p.price_yearly_amount / 100 }} €/{{ 'plans.year' | transloco }}
                    }
                  </span>
                }
              </td>
              <td>
                @if (p.per_unit_quota_key) {
                  <code>{{ p.per_unit_quota_key }}</code>
                  <span class="hint">{{ 'plans.per_unit' | transloco }}</span>
                } @else {
                  <code>{{ quotasLabel(p) }}</code>
                }
              </td>
              <td>{{ p.trial_days || '—' }}</td>
              <td>
                <p-tag
                  [severity]="p.active ? 'success' : 'secondary'"
                  [value]="(p.active ? 'common.active' : 'common.inactive') | transloco"
                />
                @if (!p.public) {
                  <p-tag severity="warn" [value]="'plans.private' | transloco" />
                }
              </td>
              <td class="actions-col">
                <p-button icon="pi pi-pencil" [text]="true" (onClick)="openForm(p)" />
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  (onClick)="askDelete(p)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      }

      <p-dialog
        [visible]="formOpen()"
        (visibleChange)="!$event && formOpen.set(false)"
        [modal]="true"
        [style]="{ width: '46rem' }"
        [header]="(draft.id ? 'plans.edit' : 'plans.new') | transloco"
      >
        <div class="grid">
          <div class="field">
            <label for="app">{{ 'plans.app' | transloco }}</label>
            <p-select
              inputId="app"
              [options]="apps()"
              [(ngModel)]="draft.app"
              optionLabel="slug"
              optionValue="id"
            />
          </div>
          <div class="field">
            <label for="code">{{ 'plans.code' | transloco }}</label>
            <input pInputText id="code" [(ngModel)]="draft.code" />
          </div>
          <div class="field">
            <label for="name">{{ 'plans.name' | transloco }}</label>
            <input pInputText id="name" [(ngModel)]="draft.name" />
          </div>
          <div class="field">
            <label for="monthly">{{ 'plans.price_monthly' | transloco }}</label>
            <p-select
              inputId="monthly"
              [options]="monthlyPrices()"
              [(ngModel)]="draft.price_monthly"
              optionLabel="label"
              optionValue="id"
              [showClear]="true"
              [filter]="true"
            />
          </div>
          <div class="field">
            <label for="yearly">{{ 'plans.price_yearly' | transloco }}</label>
            <p-select
              inputId="yearly"
              [options]="yearlyPrices()"
              [(ngModel)]="draft.price_yearly"
              optionLabel="label"
              optionValue="id"
              [showClear]="true"
              [filter]="true"
            />
          </div>
          <div class="field">
            <label for="unit">{{ 'plans.per_unit_key' | transloco }}</label>
            <input pInputText id="unit" [(ngModel)]="draft.per_unit_quota_key" />
            <small>{{ 'plans.per_unit_hint' | transloco }}</small>
          </div>
          <div class="field">
            <label for="quotas">{{ 'plans.quotas_json' | transloco }}</label>
            <input pInputText id="quotas" [(ngModel)]="quotasText" [disabled]="!!draft.per_unit_quota_key" />
            @if (quotasError()) {
              <small class="error">{{ 'plans.quotas_invalid' | transloco }}</small>
            }
          </div>
          <div class="field">
            <label for="trial">{{ 'plans.trial' | transloco }}</label>
            <p-inputnumber inputId="trial" [(ngModel)]="draft.trial_days" [min]="0" />
          </div>
          <div class="field">
            <label for="order">{{ 'plans.sort_order' | transloco }}</label>
            <p-inputnumber inputId="order" [(ngModel)]="draft.sort_order" [min]="0" />
          </div>
          <div class="field checks">
            <p-checkbox [(ngModel)]="draft.public" [binary]="true" inputId="public" />
            <label for="public">{{ 'plans.public' | transloco }}</label>
            <p-checkbox [(ngModel)]="draft.active" [binary]="true" inputId="active" />
            <label for="active">{{ 'common.active' | transloco }}</label>
          </div>
        </div>

        <ng-template #footer>
          <p-button
            [label]="'common.cancel' | transloco"
            severity="secondary"
            [text]="true"
            (onClick)="formOpen.set(false)"
          />
          <p-button
            [label]="'common.save' | transloco"
            icon="pi pi-check"
            [loading]="saving()"
            [disabled]="!formValid()"
            (onClick)="save()"
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
        align-items: center;
      }
      .actions-col {
        white-space: nowrap;
        text-align: right;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .field.checks {
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
        grid-column: 1 / -1;
      }
      .hint,
      small {
        color: var(--muted);
        font-size: 0.85rem;
      }
      .hint {
        margin-left: 0.5rem;
      }
      .error {
        color: var(--danger, #b00);
      }
      @media (max-width: 40rem) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class PlansListComponent {
  private readonly api = inject(AdminApiService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly plans = signal<BillingPlan[]>([]);
  protected readonly apps = signal<BillingApp[]>([]);
  protected readonly prices = signal<StripePrice[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly quotasError = signal(false);

  protected appFilter: string | null = null;
  protected draft: Partial<BillingPlan> = planVide(null);
  /** Les quotas se saisissent en JSON : ce sont des clés libres, propres à chaque app. */
  protected quotasText = '{}';

  constructor() {
    void this.load();
  }

  protected monthlyPrices() {
    return this.pricesFor('month');
  }

  protected yearlyPrices() {
    return this.pricesFor('year');
  }

  private pricesFor(interval: string) {
    return this.prices()
      .filter((p) => p.interval === interval)
      .map((p) => ({
        id: p.id,
        label: `${p.product_name} — ${(p.unit_amount ?? 0) / 100} ${p.currency}`,
      }));
  }

  protected quotasLabel(plan: BillingPlan): string {
    const entries = Object.entries(plan.quotas ?? {});
    return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(' ') : '—';
  }

  protected formValid(): boolean {
    return !!this.draft.app && !!this.draft.code?.trim() && !!this.draft.name?.trim();
  }

  protected openForm(plan: BillingPlan | null) {
    this.draft = plan ? { ...plan } : planVide(this.apps()[0]?.id ?? null);
    this.quotasText = JSON.stringify(this.draft.quotas ?? {});
    this.quotasError.set(false);
    this.formOpen.set(true);
  }

  protected async load() {
    this.loading.set(true);
    try {
      const [plans, apps, prices] = await Promise.all([
        this.api.plans(this.appFilter ?? undefined),
        this.apps().length ? Promise.resolve(this.apps()) : this.api.apps(),
        this.prices().length ? Promise.resolve(this.prices()) : this.api.prices(),
      ]);
      this.plans.set(plans);
      this.apps.set(apps);
      this.prices.set(prices);
    } catch {
      this.messages.add({
        severity: 'error',
        summary: this.transloco.translate('plans.load_failed'),
      });
    } finally {
      this.loading.set(false);
    }
  }

  protected async save() {
    let quotas: Record<string, number>;
    try {
      quotas = JSON.parse(this.quotasText || '{}');
    } catch {
      this.quotasError.set(true);
      return;
    }
    this.quotasError.set(false);

    this.saving.set(true);
    try {
      // Un plan à l'unité tire ses quotas de la quantité souscrite : garder des
      // quotas figés à côté donnerait deux sources de vérité, et c'est la mauvaise
      // qui gagnerait au premier recalcul.
      await this.api.savePlan({
        ...this.draft,
        quotas: this.draft.per_unit_quota_key ? {} : quotas,
      });
      this.formOpen.set(false);
      await this.load();
      this.messages.add({ severity: 'success', summary: this.transloco.translate('plans.saved') });
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: this.transloco.translate('plans.save_failed'),
        detail: (error as { error?: { detail?: string } })?.error?.detail,
      });
    } finally {
      this.saving.set(false);
    }
  }

  protected askDelete(plan: BillingPlan) {
    this.confirm.confirm({
      message: this.transloco.translate('plans.delete_confirm', { name: plan.name }),
      accept: async () => {
        try {
          await this.api.deletePlan(plan.id);
          await this.load();
        } catch {
          this.messages.add({
            severity: 'error',
            summary: this.transloco.translate('plans.delete_failed'),
          });
        }
      },
    });
  }
}
