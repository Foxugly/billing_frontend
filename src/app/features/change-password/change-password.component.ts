import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';

import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * Changement de mot de passe de l'opérateur connecté (POST /api/v1/auth/password/change/).
 * Mot de passe actuel + nouveau + confirmation : la concordance est vérifiée côté
 * client, la force par les validateurs Django côté serveur.
 */
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    ButtonModule,
    MessageModule,
    PasswordModule,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="change-password">
      <app-page-header [icon]="'pi-key'" [title]="'change_password.title' | transloco">
        <p-button
          slot="left"
          severity="secondary"
          [outlined]="true"
          icon="pi pi-arrow-left"
          [label]="'change_password.back' | transloco"
          routerLink="/profile"
        />
      </app-page-header>

      @if (errorKey(); as key) {
        <p-message severity="error" styleClass="change-password__message">
          <div>
            <p>{{ key | transloco }}</p>
            @if (serverMessages().length) {
              <ul>
                @for (m of serverMessages(); track m) {
                  <li>{{ m }}</li>
                }
              </ul>
            }
          </div>
        </p-message>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="change-password__form">
        <div class="change-password__field">
          <label for="cp-current">{{ 'change_password.current' | transloco }}</label>
          <p-password
            inputId="cp-current"
            formControlName="currentPassword"
            [feedback]="false"
            [toggleMask]="true"
            [fluid]="true"
            autocomplete="current-password"
          />
        </div>

        <div class="change-password__field">
          <label for="cp-new">{{ 'change_password.new' | transloco }}</label>
          <p-password
            inputId="cp-new"
            formControlName="newPassword"
            [feedback]="false"
            [toggleMask]="true"
            [fluid]="true"
            autocomplete="new-password"
          />
        </div>

        <div class="change-password__field">
          <label for="cp-confirm">{{ 'change_password.confirm' | transloco }}</label>
          <p-password
            inputId="cp-confirm"
            formControlName="confirmPassword"
            [feedback]="false"
            [toggleMask]="true"
            [fluid]="true"
            autocomplete="new-password"
          />
        </div>

        <div class="change-password__actions">
          <p-button
            type="submit"
            [label]="'change_password.submit' | transloco"
            icon="pi pi-check"
            [loading]="saving()"
            [disabled]="form.invalid"
          />
        </div>
      </form>
    </section>
  `,
  styles: [
    `
      .change-password {
        max-width: 36rem;
        margin: 0 auto;
      }
      .change-password__form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .change-password__field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .change-password__actions {
        display: flex;
        justify-content: flex-end;
      }
      :host ::ng-deep .change-password__message {
        margin-bottom: 1rem;
      }
      :host ::ng-deep .change-password__message p,
      :host ::ng-deep .change-password__message ul {
        margin: 0;
      }
    `,
  ],
})
export class ChangePasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly saving = signal(false);
  /** Clé i18n de l'erreur affichée ; une erreur ne disparaît jamais seule. */
  protected readonly errorKey = signal<string | null>(null);
  /** Messages des validateurs Django (code applicatif connu `password_invalid`). */
  protected readonly serverMessages = signal<string[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', Validators.required],
    confirmPassword: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue();
    this.serverMessages.set([]);
    if (newPassword !== confirmPassword) {
      this.errorKey.set('change_password.errors.mismatch');
      return;
    }
    this.saving.set(true);
    this.errorKey.set(null);
    try {
      await this.auth.changePassword(currentPassword, newPassword);
      this.messages.add({
        severity: 'success',
        summary: this.transloco.translate('change_password.success'),
      });
      void this.router.navigate(['/profile']);
    } catch (err) {
      this.applyError(err);
    } finally {
      this.saving.set(false);
    }
  }

  private applyError(err: unknown): void {
    const http = err instanceof HttpErrorResponse ? err : null;
    const body = (http?.error ?? null) as { code?: string; messages?: unknown } | null;
    if (http?.status === 429) {
      this.errorKey.set('change_password.errors.rate_limited');
    } else if (body?.code === 'current_password_invalid') {
      this.errorKey.set('change_password.errors.current_password_invalid');
    } else if (body?.code === 'password_unchanged') {
      this.errorKey.set('change_password.errors.password_unchanged');
    } else if (body?.code === 'password_invalid') {
      // Code applicatif connu : les messages des validateurs sont affichés tels quels.
      this.errorKey.set('change_password.errors.password_invalid');
      this.serverMessages.set(Array.isArray(body.messages) ? body.messages.map(String) : []);
    } else {
      this.errorKey.set('change_password.errors.generic');
    }
  }
}
