import { Component, Input } from '@angular/core';

type EmptyTone = 'emerald' | 'rose' | 'gray';

/**
 * Shared empty-state (STANDARD-frontend-layout.md §Empty-state): an icon in a
 * soft tone pill + title + optional subtitle, with a projected call-to-action.
 * Use for genuinely empty collections, not for loading (loading = skeleton).
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty-state">
      <span class="empty-pill" [class]="'empty-pill--' + tone">
        <i [class]="'pi ' + (icon ?? 'pi-inbox')"></i>
      </span>
      <h3 class="empty-state__title">{{ title }}</h3>
      @if (subtitle ?? message; as sub) {
        <p class="empty-state__subtitle">{{ sub }}</p>
      }
      <ng-content />
    </div>
  `,
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  @Input({ required: true }) title = '';
  /** Preferred secondary line; `message` kept as a back-compat alias. */
  @Input() subtitle?: string;
  @Input() message?: string;
  @Input() icon?: string;
  @Input() tone: EmptyTone = 'emerald';
}
