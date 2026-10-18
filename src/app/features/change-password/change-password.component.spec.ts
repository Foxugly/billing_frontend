import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { TranslocoHttpLoader } from '../../core/i18n/transloco-loader';
import { ChangePasswordComponent } from './change-password.component';

describe('ChangePasswordComponent', () => {
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let component: any;
  let auth: { changePassword: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = { changePassword: vi.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [ChangePasswordComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['fr'], defaultLang: 'fr' },
          loader: TranslocoHttpLoader,
        }),
        MessageService,
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePasswordComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function fill(current: string, next: string, confirm = next): void {
    component.form.setValue({
      currentPassword: current,
      newPassword: next,
      confirmPassword: confirm,
    });
  }

  it('renders one h1 and three labelled password fields', () => {
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('h1').length).toBe(1);
    for (const id of ['cp-current', 'cp-new', 'cp-confirm']) {
      expect(el.querySelector(`label[for="${id}"]`)).not.toBeNull();
      expect(el.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('refuses a mismatched confirmation without calling the API', async () => {
    fill('old', 'new-one', 'new-two');

    await component.submit();

    expect(auth.changePassword).not.toHaveBeenCalled();
    expect(component.errorKey()).toBe('change_password.errors.mismatch');
  });

  it('changes the password, confirms and goes back to the profile', async () => {
    const add = vi.spyOn(TestBed.inject(MessageService), 'add');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fill('old', 'new-one');

    await component.submit();

    expect(auth.changePassword).toHaveBeenCalledWith('old', 'new-one');
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    expect(navigate).toHaveBeenCalledWith(['/profile']);
  });

  it.each([
    ['current_password_invalid', 'change_password.errors.current_password_invalid'],
    ['password_unchanged', 'change_password.errors.password_unchanged'],
    ['something_else', 'change_password.errors.generic'],
  ])('maps the %s code to a translated message', async (code, key) => {
    auth.changePassword.mockRejectedValue(
      new HttpErrorResponse({ status: 400, error: { code, detail: 'raw backend text' } }),
    );
    fill('old', 'new-one');

    await component.submit();

    expect(component.errorKey()).toBe(key);
    expect(component.saving()).toBe(false);
  });

  it('lists the Django validator messages for password_invalid', async () => {
    auth.changePassword.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: { code: 'password_invalid', messages: ['Trop court.'] },
      }),
    );
    fill('old', '123');

    await component.submit();

    expect(component.errorKey()).toBe('change_password.errors.password_invalid');
    expect(component.serverMessages()).toEqual(['Trop court.']);
  });

  it('maps a 429 to the rate-limit message', async () => {
    auth.changePassword.mockRejectedValue(new HttpErrorResponse({ status: 429 }));
    fill('old', 'new-one');

    await component.submit();

    expect(component.errorKey()).toBe('change_password.errors.rate_limited');
  });
});
