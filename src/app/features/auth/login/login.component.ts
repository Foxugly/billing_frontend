import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { PasswordModule } from 'primeng/password';
import { AuthCardComponent } from '../../../shared/components/auth-card/auth-card.component';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Login demo (STANDARD-frontend-layout.md §Auth): the canonical login layout —
 * auth-card, email, p-password, remember-me + forgot on a meta row, emerald
 * sign-in, "ou" divider, magic-link button (inline mode), register alt link.
 * Auth is MOCKED (any credentials sign in). Forgot/register are stubs (toast).
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
    PasswordModule,
    AuthCardComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  /** Inline magic-link mode (email only), toggled from the login card. */
  protected readonly magicMode = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [true],
  });

  protected readonly submitting = signal(false);

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password, remember } = this.form.getRawValue();
    this.submitting.set(true);
    try {
      await this.auth.login(email, password, remember);
      this.messages.add({ severity: 'success', summary: this.transloco.translate('login.success') });
      void this.router.navigate(['/dashboard']);
    } catch {
      // Un compte non-operateur est refuse par le backend : le dire clairement
      // vaut mieux qu'un jeton valide mais inerte.
      this.messages.add({
        severity: 'error',
        summary: this.transloco.translate('login.failed'),
      });
    } finally {
      this.submitting.set(false);
    }
  }

  protected toggleMagic(): void {
    this.magicMode.update((v) => !v);
  }

  protected sendMagic(): void {
    if (this.form.controls.email.invalid) {
      this.form.controls.email.markAsTouched();
      return;
    }
    this.messages.add({ severity: 'info', summary: this.transloco.translate('login.magic_sent') });
    this.magicMode.set(false);
  }

  /** Register / forgot-password are not built in this reference — inform the user. */
  protected stub(): void {
    this.messages.add({ severity: 'info', summary: this.transloco.translate('login.demo_hint') });
  }
}
