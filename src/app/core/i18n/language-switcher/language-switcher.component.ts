import { UpperCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { AVAILABLE_LANGUAGES, LanguageCode } from '../available-languages';
import { LanguageService } from '../language.service';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslocoPipe, TooltipModule, UpperCasePipe],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
    '(keydown.arrowdown)': 'onArrowDown($event)',
    '(keydown.arrowup)': 'onArrowUp($event)',
    '(keydown.home)': 'onHome($event)',
    '(keydown.end)': 'onEnd($event)',
    '(keydown.enter)': 'onEnter($event)',
  },
})
export class LanguageSwitcherComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly languageService = inject(LanguageService);

  protected readonly languages = AVAILABLE_LANGUAGES;
  protected readonly current = this.languageService.activeLang;
  /** Native name of the active language — shown as the trigger tooltip. */
  protected readonly currentNativeName = computed(
    () => this.languages.find((l) => l.code === this.current())?.nativeName ?? '',
  );
  protected readonly open = signal(false);
  protected readonly focusedIndex = signal<number | null>(null);

  private readonly menuItems = viewChildren<ElementRef<HTMLButtonElement>>('menuitem');

  protected toggle(): void {
    const willOpen = !this.open();
    this.open.set(willOpen);
    if (willOpen) {
      // Default focus to active language's index (or 0).
      const idx = this.languages.findIndex((l) => l.code === this.current());
      this.focusedIndex.set(idx >= 0 ? idx : 0);
      queueMicrotask(() => this.focusCurrent());
    } else {
      this.focusedIndex.set(null);
    }
  }

  protected close(): void {
    this.open.set(false);
    this.focusedIndex.set(null);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const root = this.elementRef.nativeElement;
    if (!root.contains(event.target as Node)) {
      this.close();
    }
  }

  protected select(code: LanguageCode): void {
    this.close();
    if (code === this.current()) return;
    this.languageService.switchLanguage(code);
  }

  protected onArrowDown(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    this.moveFocus('down');
  }

  protected onArrowUp(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    this.moveFocus('up');
  }

  protected onHome(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    this.focusedIndex.set(0);
    this.focusCurrent();
  }

  protected onEnd(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    this.focusedIndex.set(this.languages.length - 1);
    this.focusCurrent();
  }

  protected onEnter(event: Event): void {
    if (!this.open()) return;
    const idx = this.focusedIndex();
    if (idx === null) return;
    event.preventDefault();
    this.select(this.languages[idx].code);
  }

  protected moveFocus(direction: 'up' | 'down'): void {
    const len = this.languages.length;
    const current = this.focusedIndex() ?? 0;
    const next = direction === 'down' ? (current + 1) % len : (current - 1 + len) % len;
    this.focusedIndex.set(next);
    this.focusCurrent();
  }

  private focusCurrent(): void {
    const idx = this.focusedIndex();
    if (idx === null) return;
    const items = this.menuItems();
    items[idx]?.nativeElement.focus();
  }
}
