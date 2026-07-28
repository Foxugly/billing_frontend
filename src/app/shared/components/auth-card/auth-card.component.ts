import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardModule } from 'primeng/card';

/**
 * Shared auth card shell (STANDARD-frontend-layout.md §Auth): the centred
 * <p-card> (~420px) with a branded header (icon + title, centered) used by every
 * auth screen (login, register, forgot/reset password). The form body is
 * projected via <ng-content>.
 */
@Component({
  selector: 'app-auth-card',
  standalone: true,
  imports: [CardModule],
  template: `
    <div class="auth-card">
      <p-card>
        <ng-template pTemplate="header">
          <div class="card-header">
            <i [class]="icon()" class="auth-brand-icon" aria-hidden="true"></i>
            <span class="brand fox-brand">{{ title() }}</span>
          </div>
        </ng-template>
        <ng-content />
      </p-card>
    </div>
  `,
  styleUrl: './auth-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCardComponent {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
}
