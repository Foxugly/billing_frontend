import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AVAILABLE_LANGUAGES, LanguageCode } from './available-languages';

const STORAGE_KEY = 'lang';
const DEFAULT_LANG: LanguageCode = 'fr';

/**
 * Source of truth for the active UI language (STANDARD-frontend-layout.md §5).
 *
 * Persists the choice in localStorage['lang'] and keeps Transloco in sync.
 * On startup the initial language is resolved as:
 *   localStorage['lang'] → browser language → 'fr'.
 * Deliberately dependency-free (no API/toast) so i18n can be wired before the
 * rest of the app has any translations.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);

  private readonly _activeLang = signal<LanguageCode>(DEFAULT_LANG);
  readonly activeLang = this._activeLang.asReadonly();

  constructor() {
    const initial = this.resolveInitialLang();
    this.applyLanguage(initial);
  }

  /** Switch the active language, apply it to Transloco and persist it. */
  switchLanguage(code: LanguageCode): void {
    if (code === this._activeLang()) return;
    this.applyLanguage(code);
  }

  private applyLanguage(code: LanguageCode): void {
    this.transloco.setActiveLang(code);
    this._activeLang.set(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // localStorage unavailable (private mode / SSR) — non-fatal.
    }
  }

  private resolveInitialLang(): LanguageCode {
    const stored = this.readStored();
    if (stored) return stored;

    const browser = this.readBrowser();
    if (browser) return browser;

    return DEFAULT_LANG;
  }

  private readStored(): LanguageCode | null {
    try {
      return this.normalize(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  private readBrowser(): LanguageCode | null {
    if (typeof navigator === 'undefined') return null;
    return this.normalize(navigator.language);
  }

  private normalize(value: string | null | undefined): LanguageCode | null {
    if (!value) return null;
    const code = value.slice(0, 2).toLowerCase();
    return AVAILABLE_LANGUAGES.some((l) => l.code === code) ? (code as LanguageCode) : null;
  }
}
