import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService, CurrentUser } from '../../core/auth/auth.service';
import { TranslocoHttpLoader } from '../../core/i18n/transloco-loader';
import { ProfileComponent } from './profile.component';

const USER: CurrentUser = {
  id: 1,
  email: 'ops@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  displayName: 'Ada Lovelace',
  isStaff: true,
  isSuperuser: true,
};

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let component: any;
  let auth: { fetchProfile: ReturnType<typeof vi.fn>; updateProfile: ReturnType<typeof vi.fn> };

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
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

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    auth = {
      fetchProfile: vi.fn().mockResolvedValue(USER),
      updateProfile: vi
        .fn()
        .mockResolvedValue({ ...USER, firstName: 'Grace', displayName: 'Grace Lovelace' }),
    };
  });

  it('fills the form from the profile and keeps the email read-only', async () => {
    await create();
    const el: HTMLElement = fixture.nativeElement;

    expect(component.form.getRawValue()).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    const email = el.querySelector<HTMLInputElement>('#profile-email')!;
    expect(email.value).toBe('ops@example.com');
    expect(email.readOnly).toBe(true);
    expect(el.querySelectorAll('h1').length).toBe(1);
  });

  it('links to the password change page', async () => {
    await create();
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.profile__link',
    )!;

    expect(link.href).toContain('/admin/password_change/');
  });

  it('saves trimmed names and confirms with a toast', async () => {
    await create();
    const add = vi.spyOn(TestBed.inject(MessageService), 'add');
    component.form.setValue({ firstName: ' Grace ', lastName: 'Lovelace' });

    await component.save();

    expect(auth.updateProfile).toHaveBeenCalledWith({ firstName: 'Grace', lastName: 'Lovelace' });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    expect(component.form.pristine).toBe(true);
    expect(component.errorKey()).toBeNull();
  });

  it('maps a 400 to a translated page message, never the raw detail', async () => {
    await create();
    auth.updateProfile.mockRejectedValue(
      new HttpErrorResponse({ status: 400, error: { firstName: ['raw backend text'] } }),
    );

    await component.save();

    expect(component.errorKey()).toBe('profile.errors.invalid');
    expect(component.saving()).toBe(false);
  });

  it('shows a generic error when the profile cannot be loaded', async () => {
    auth.fetchProfile.mockRejectedValue(new HttpErrorResponse({ status: 0 }));
    await create();

    expect(component.errorKey()).toBe('profile.errors.generic');
    expect(component.loading()).toBe(false);
  });
});
