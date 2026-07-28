import { Injectable, computed, effect, signal } from '@angular/core';

const STORAGE_KEY = 'theme';

type Mode = 'light' | 'dark';

function readInitialMode(): Mode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Fleet-standard theme service (STANDARD-frontend-layout.md §4): a signal that
 * persists to localStorage['theme'] and toggles `.dark-mode` on <html>, matching
 * `providePrimeNG({ theme: { options: { darkModeSelector: '.dark-mode' } } })`.
 * Falls back to `prefers-color-scheme` when nothing is stored. The anti-FOUC
 * inline script in index.html sets the class before bootstrap; this service then
 * takes over.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _mode = signal<Mode>(readInitialMode());
  readonly mode = this._mode.asReadonly();
  readonly isDark = computed(() => this._mode() === 'dark');

  constructor() {
    effect(() => {
      const dark = this._mode() === 'dark';
      const root = document.documentElement;
      root.classList.toggle('dark-mode', dark);
      try {
        localStorage.setItem(STORAGE_KEY, this._mode());
      } catch {
        /* no-op, private mode */
      }
    });
  }

  toggle(): void {
    this._mode.update((m) => (m === 'dark' ? 'light' : 'dark'));
  }

  set(mode: Mode): void {
    this._mode.set(mode);
  }
}
