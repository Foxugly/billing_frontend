import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Three-column page header (STANDARD-frontend-layout.md §Page-header): optional
 * left slot (back button / breadcrumbs), centered <h1> title with an optional
 * [slot=title-after] (status badge), and an optional right slot (actions). The
 * ONE header for every routed page (list / form / detail). Actions and back
 * buttons are projected by the caller — no [backLink] input.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly icon = input<string>();
}
