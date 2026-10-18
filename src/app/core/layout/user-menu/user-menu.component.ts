import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService, passwordChangeUrl } from '../../auth/auth.service';

/**
 * Polymorphic user slot — the last of the topmenu actions (fleet standard §6).
 * Logged out → a "Sign in" button (outlined emerald) routing to /login.
 * Logged in  → a custom dropdown (Profile / Change password / Logout) anchored
 *              to the right. « Changer de mot de passe » ouvre le Django admin :
 *              le backend n'a pas d'endpoint dédié. Closes on outside click and on Escape, like the
 *              sibling language-switcher.
 */
@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class UserMenuComponent {
  readonly auth = inject(AuthService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly open = signal(false);
  protected readonly passwordUrl = passwordChangeUrl();

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const root = this.elementRef.nativeElement;
    if (!root.contains(event.target as Node)) {
      this.close();
    }
  }

  protected logout(): void {
    this.close();
    this.auth.logout();
  }
}
