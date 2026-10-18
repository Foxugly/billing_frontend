import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { AuthService, CurrentUser } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * Profil de l'opérateur connecté : email en lecture seule (c'est l'identifiant de
 * connexion), prénom et nom modifiables, lien vers /change-password. Pas de suppression de compte ni de
 * préférence de langue : les comptes opérateurs se gèrent par `createsuperuser`.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    ButtonModule,
    InputTextModule,
    MessageModule,
    SkeletonModule,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="profile">
      <app-page-header [icon]="'pi-user'" [title]="'profile.title' | transloco" />

      @if (errorKey(); as key) {
        <p-message severity="error" [text]="key | transloco" styleClass="profile__message" />
      }

      @if (loading()) {
        <p-skeleton height="14rem" />
      } @else if (user()) {
        <form [formGroup]="form" (ngSubmit)="save()" class="profile__form">
          <div class="profile__field">
            <label for="profile-email">{{ 'profile.email' | transloco }}</label>
            <input
              pInputText
              id="profile-email"
              type="email"
              [value]="user()!.email"
              autocomplete="email"
              readonly
              aria-describedby="profile-email-hint"
            />
            <small id="profile-email-hint" class="profile__hint">
              {{ 'profile.email_readonly' | transloco }}
            </small>
          </div>

          <div class="profile__field">
            <label for="profile-first-name">{{ 'profile.first_name' | transloco }}</label>
            <input
              pInputText
              id="profile-first-name"
              formControlName="firstName"
              autocomplete="given-name"
              maxlength="150"
            />
          </div>

          <div class="profile__field">
            <label for="profile-last-name">{{ 'profile.last_name' | transloco }}</label>
            <input
              pInputText
              id="profile-last-name"
              formControlName="lastName"
              autocomplete="family-name"
              maxlength="150"
            />
          </div>

          <div class="profile__actions">
            <p-button
              type="submit"
              [label]="'common.save' | transloco"
              icon="pi pi-save"
              [loading]="saving()"
              [disabled]="form.pristine || form.invalid"
            />
          </div>
        </form>

        <h2 class="profile__subtitle">{{ 'profile.security' | transloco }}</h2>
        <a class="profile__link" routerLink="/change-password">
          <i class="pi pi-key" aria-hidden="true"></i>
          <span>{{ 'chrome.user.change_password' | transloco }}</span>
        </a>
      }
    </section>
  `,
  styles: [
    `
      .profile {
        max-width: 36rem;
        margin: 0 auto;
      }
      .profile__form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .profile__field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .profile__field input[readonly] {
        color: var(--muted);
      }
      .profile__hint {
        color: var(--muted);
      }
      .profile__actions {
        display: flex;
        justify-content: flex-end;
      }
      .profile__subtitle {
        margin: 2rem 0 0.5rem;
        font-size: 1.1rem;
      }
      .profile__link {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--accent);
      }
      :host ::ng-deep .profile__message {
        margin-bottom: 1rem;
      }
    `,
  ],
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly user = signal<CurrentUser | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  /** Clé i18n de l'erreur affichée ; une erreur ne disparaît jamais seule. */
  protected readonly errorKey = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.maxLength(150)],
    lastName: ['', Validators.maxLength(150)],
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.fill(await this.auth.fetchProfile());
    } catch (err) {
      this.errorKey.set(profileErrorKey(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    const { firstName, lastName } = this.form.getRawValue();
    this.saving.set(true);
    this.errorKey.set(null);
    try {
      this.fill(
        await this.auth.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() }),
      );
      this.messages.add({
        severity: 'success',
        summary: this.transloco.translate('profile.saved'),
      });
    } catch (err) {
      this.errorKey.set(profileErrorKey(err));
    } finally {
      this.saving.set(false);
    }
  }

  private fill(user: CurrentUser): void {
    this.user.set(user);
    this.form.reset({ firstName: user.firstName, lastName: user.lastName });
  }
}

/** Le `detail` brut du backend n'est jamais affiché : seul le code HTTP choisit le texte. */
function profileErrorKey(err: unknown): string {
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  if (status === 400) return 'profile.errors.invalid';
  if (status === 429) return 'profile.errors.rate_limited';
  return 'profile.errors.generic';
}
