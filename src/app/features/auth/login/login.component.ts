import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from '@openng/optimus-ui/button';
import { CheckboxModule } from '@openng/optimus-ui/checkbox';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { MessageService } from '@openng/optimus-ui/api';
import { PasswordModule } from '@openng/optimus-ui/password';
import { AuthCardComponent } from '../../../shared/components/auth-card/auth-card.component';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Login de la console (STANDARD-frontend-layout.md §Auth) : auth-card, e-mail,
 * p-password, « se souvenir de moi » et bouton de connexion. Le backend est réel
 * et refuse les comptes non-opérateurs ; ni inscription, ni mot de passe oublié,
 * ni lien magique. Les erreurs restent affichées dans un p-message (pas de toast).
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    MessageModule,
    PasswordModule,
    AuthCardComponent,
  ],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [true],
  });

  protected readonly submitting = signal(false);
  /** Clé i18n de l'erreur affichée ; vide quand il n'y a rien à montrer. */
  protected readonly errorKey = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password, remember } = this.form.getRawValue();
    this.submitting.set(true);
    this.errorKey.set(null);
    try {
      await this.auth.login(email, password, remember);
      this.messages.add({
        severity: 'success',
        summary: this.transloco.translate('login.success'),
      });
      void this.router.navigate(['/dashboard']);
    } catch (err) {
      // Un compte non-operateur est refuse par le backend : le dire clairement
      // vaut mieux qu'un jeton valide mais inerte. Le `detail` brut du backend
      // n'est jamais affiche : seul le code HTTP choisit le texte traduit.
      this.errorKey.set(loginErrorKey(err));
    } finally {
      this.submitting.set(false);
    }
  }
}

function loginErrorKey(err: unknown): string {
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  if (status === 429) return 'login.rate_limited';
  if (status === 400 || status === 401 || status === 403) return 'login.failed';
  return 'login.error_generic';
}
