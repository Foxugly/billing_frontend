import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../theme/theme.service';
import { LanguageSwitcherComponent } from '../../i18n/language-switcher/language-switcher.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

interface NavLink {
  label: string;
  icon: string;
  /** Internal route (routerLink). Omitted for external items. */
  link?: string;
  /** External URL (plain href, opens a new tab). */
  href?: string;
  exact?: boolean;
  /** Emerald-highlighted support CTA. */
  support?: boolean;
}

/**
 * Fleet-standard topmenu (STANDARD-frontend-layout.md §Topmenu): 3 zones
 * (brand / nav / actions), `[mode]` public|authenticated, borderless action
 * triggers (theme → language → user), a filled-emerald "Support" CTA, and a
 * responsive hamburger drawer below 1024px. SNAPSHOT of FoxRunner_frontend,
 * with FoxRunner's domain nav (scenarios/admin) replaced by the generic Foo.
 */
@Component({
  selector: 'app-topmenu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TooltipModule, TranslocoPipe, LanguageSwitcherComponent, UserMenuComponent],
  templateUrl: './topmenu.component.html',
  styleUrl: './topmenu.component.scss',
})
export class TopmenuComponent {
  readonly theme = inject(ThemeService);
  readonly menuOpen = signal(false);

  /** Fleet-standard chrome mode; drives which nav (public vs app) is shown. */
  readonly mode = input<'public' | 'authenticated'>('authenticated');

  /** Brand target: login for guests, the app for the authenticated shell. */
  readonly brandLink = computed(() => (this.mode() === 'public' ? '/login' : '/dashboard'));

  // The Support CTA points at an external sponsor page in this reference; a real
  // fleet app links it to its internal /soutenir route (support: true item).
  private readonly support: NavLink = {
    label: 'chrome.nav.soutenir',
    icon: 'pi pi-heart',
    href: 'https://github.com/Foxugly',
    support: true,
  };

  readonly links = computed<NavLink[]>(() => {
    if (this.mode() === 'public') {
      return [];
    }
    return [
      { label: 'chrome.nav.dashboard', icon: 'pi pi-chart-line', link: '/dashboard' },
      { label: 'chrome.nav.apps', icon: 'pi pi-th-large', link: '/apps' },
      { label: 'chrome.nav.customers', icon: 'pi pi-users', link: '/customers' },
      { label: 'chrome.nav.entitlements', icon: 'pi pi-key', link: '/entitlements' },
      { label: 'chrome.nav.deliveries', icon: 'pi pi-send', link: '/deliveries' },
    ];
  });

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
