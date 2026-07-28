import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/** Stub privacy page so the footer "Privacy" link resolves (fleet /privacy). */
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [TranslocoPipe, PageHeaderComponent],
  template: `
    <app-page-header [title]="'privacy.title' | transloco" icon="pi-shield" />
    <article class="privacy">
      <p class="privacy__lead">{{ 'privacy.lead' | transloco }}</p>
      <p>{{ 'privacy.body' | transloco }}</p>
    </article>
  `,
  styles: [
    `
      .privacy {
        max-width: 46rem;
        margin: 0 auto;
        color: var(--ink-soft);
        line-height: 1.6;
      }
      .privacy__lead {
        font-size: 1.05rem;
        color: var(--ink);
      }
    `,
  ],
})
export class PrivacyComponent {}
