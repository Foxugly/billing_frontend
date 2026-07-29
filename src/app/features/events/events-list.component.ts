import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { AdminApiService, StripeEvent } from '../../core/api/admin-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * Les événements Stripe reçus, et leur rejeu.
 *
 * Le compte Stripe est partagé par toute la flotte : la liste contient donc
 * aussi des événements qui ne nous concernent pas. La page distingue deux cas
 * qui se ressemblent et n'ont rien à voir — un type dont nous ne faisons rien,
 * et un type que nous traitons mais qui n'est attribuable à aucune app. Le
 * second est un vrai symptôme : le webhook l'a ignoré en silence.
 */
@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TranslocoPipe,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    SkeletonModule,
    TableModule,
    TagModule,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  template: `
    <section>
      <app-page-header [icon]="'pi-bolt'" [title]="'events.title' | transloco" />

      <div class="toolbar">
        <input
          pInputText
          [(ngModel)]="typeFilter"
          [placeholder]="'events.filter_type' | transloco"
          (keyup.enter)="load()"
        />
        <label class="check">
          <p-checkbox [(ngModel)]="onlyHandled" [binary]="true" (onChange)="load()" />
          {{ 'events.only_handled' | transloco }}
        </label>
        <p-button icon="pi pi-search" [text]="true" (onClick)="load()" />
      </div>

      @if (loading()) {
        <p-skeleton height="12rem" />
      } @else if (events().length === 0) {
        <app-empty-state [icon]="'pi-bolt'" [title]="'events.empty' | transloco" />
      } @else {
        <p-table [value]="events()" [tableStyle]="{ 'min-width': '52rem' }">
          <ng-template #header>
            <tr>
              <th>{{ 'events.received' | transloco }}</th>
              <th>{{ 'events.type' | transloco }}</th>
              <th>{{ 'events.target' | transloco }}</th>
              <th>{{ 'events.handling' | transloco }}</th>
              <th class="actions-col">{{ 'common.actions' | transloco }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-e>
            <tr>
              <td>
                {{ e.created ? (e.created | date: 'short') : '—' }}
                @if (!e.livemode) {
                  <p-tag severity="secondary" [value]="'events.test_mode' | transloco" />
                }
              </td>
              <td><code>{{ e.type }}</code></td>
              <td>
                @if (e.app_slug) {
                  <a (click)="openEntitlement(e)">
                    <code>{{ e.app_slug }}</code> · {{ e.external_user_id }}
                  </a>
                } @else {
                  —
                }
              </td>
              <td>
                @if (!e.handled) {
                  <!-- Type dont nous ne faisons rien : normal sur un compte
                       Stripe partagé par toute la flotte. -->
                  <p-tag severity="secondary" [value]="'events.not_ours' | transloco" />
                } @else if (!e.app_slug) {
                  <!-- Traité mais non attribuable : le webhook l'a ignoré en
                       silence. C'est le cas à repérer. -->
                  <p-tag severity="danger" [value]="'events.unattributed' | transloco" />
                } @else {
                  <p-tag severity="success" [value]="'events.recomputed' | transloco" />
                }
              </td>
              <td class="actions-col">
                <p-button
                  [label]="'events.replay' | transloco"
                  icon="pi pi-replay"
                  [text]="true"
                  [disabled]="!e.handled"
                  [loading]="replaying() === e.id"
                  (onClick)="replay(e)"
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
      .toolbar {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .actions-col {
        white-space: nowrap;
        text-align: right;
      }
      a {
        cursor: pointer;
      }
    `,
  ],
})
export class EventsListComponent {
  private readonly api = inject(AdminApiService);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  protected readonly events = signal<StripeEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly replaying = signal<string | null>(null);

  protected typeFilter = '';
  protected onlyHandled = false;

  constructor() {
    void this.load();
  }

  protected async load() {
    this.loading.set(true);
    try {
      this.events.set(
        await this.api.events({ type: this.typeFilter || undefined, handled: this.onlyHandled }),
      );
    } catch {
      this.messages.add({
        severity: 'error',
        summary: this.transloco.translate('events.load_failed'),
      });
    } finally {
      this.loading.set(false);
    }
  }

  protected openEntitlement(event: StripeEvent) {
    void this.router.navigate(['/entitlements'], {
      queryParams: { app: event.app_slug, user: event.external_user_id },
    });
  }

  protected async replay(event: StripeEvent) {
    this.replaying.set(event.id);
    try {
      const result = await this.api.replayEvent(event.id);
      this.messages.add({
        severity: 'success',
        summary: this.transloco.translate('events.replayed'),
        // Le serveur dit ce qu'il a fait : droit recalculé, ou rien à recalculer
        // faute d'app identifiable. Les deux méritent d'être lus.
        detail: result.detail,
      });
      await this.load();
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: this.transloco.translate('events.replay_failed'),
        detail: (error as { error?: { detail?: string } })?.error?.detail,
      });
    } finally {
      this.replaying.set(null);
    }
  }
}
