import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

import { AdminApiService, Dashboard } from '../../core/api/admin-api.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/** Vue d'exploitation : ce qui rentre, et ce qui ne passe pas. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, TranslocoPipe, SkeletonModule, TagModule, PageHeaderComponent],
  template: `
    <section class="page">
      <app-page-header [icon]="'pi-chart-line'" [title]="'dashboard.title' | transloco" />

      @if (loading()) {
        <div class="tiles">
          @for (row of skeletons; track $index) {
            <p-skeleton height="6rem" />
          }
        </div>
      } @else if (data(); as d) {
        <div class="tiles">
          <article class="tile">
            <span class="tile__label">{{ 'dashboard.mrr' | transloco }}</span>
            <strong class="tile__value">{{ euros(d.mrr_cents) }}</strong>
          </article>
          <article class="tile">
            <span class="tile__label">{{ 'dashboard.customers' | transloco }}</span>
            <strong class="tile__value">{{ d.customers }}</strong>
          </article>
          <article class="tile">
            <span class="tile__label">{{ 'dashboard.pending' | transloco }}</span>
            <strong class="tile__value">{{ d.deliveries.pending }}</strong>
          </article>
          <!-- Les échecs sont la seule tuile cliquable : c'est la seule qui appelle
               une action. Zéro échec s'affiche en neutre, pas en rouge. -->
          <a class="tile tile--action" routerLink="/deliveries" [queryParams]="{ status: 'failed' }">
            <span class="tile__label">{{ 'dashboard.failed' | transloco }}</span>
            <strong class="tile__value" [class.tile__value--alert]="d.deliveries.failed > 0">
              {{ d.deliveries.failed }}
            </strong>
          </a>
        </div>

        <h2 class="section-title">{{ 'dashboard.per_app' | transloco }}</h2>
        <div class="apps">
          @for (app of d.apps; track app.slug) {
            <article class="app-row">
              <div class="app-row__main">
                <strong>{{ app.name }}</strong>
                <code>{{ app.slug }}</code>
              </div>
              <p-tag
                [severity]="app.active ? 'success' : 'secondary'"
                [value]="(app.active ? 'common.active' : 'common.inactive') | transloco"
              />
              <span class="app-row__counts">
                {{ app.paid }} / {{ app.total }} {{ 'dashboard.paid_of_known' | transloco }}
              </span>
            </article>
          } @empty {
            <p class="muted">{{ 'dashboard.no_app' | transloco }}</p>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }
      .tile {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 1.25rem;
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-md, 0.5rem);
        background: var(--surface-card);
        text-decoration: none;
        color: inherit;
      }
      .tile--action:hover {
        border-color: var(--primary-color);
      }
      .tile__label {
        font-size: 0.85rem;
        color: var(--text-color-secondary);
      }
      .tile__value {
        font-size: 1.75rem;
        line-height: 1.1;
      }
      .tile__value--alert {
        color: var(--red-500, #ef4444);
      }
      .section-title {
        font-size: 1.1rem;
        margin: 0 0 0.75rem;
      }
      .apps {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .app-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1rem;
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-md, 0.5rem);
        background: var(--surface-card);
      }
      .app-row__main {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      .app-row__counts {
        color: var(--text-color-secondary);
        font-size: 0.9rem;
      }
      .muted {
        color: var(--text-color-secondary);
      }
      @media (max-width: 600px) {
        .app-row {
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly api = inject(AdminApiService);

  protected readonly data = signal<Dashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly skeletons = Array.from({ length: 4 });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.data.set(await this.api.dashboard());
    } finally {
      this.loading.set(false);
    }
  }

  protected euros(cents: number): string {
    return (cents / 100).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' });
  }
}
