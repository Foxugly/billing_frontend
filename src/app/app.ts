import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { LanguageService } from './core/i18n/language.service';
import { StaleChunkService } from './core/app-update/stale-chunk.service';

/**
 * Root: the router outlet (layouts wrap the routes) plus the single global
 * <p-toast/> and <p-confirmdialog/> (fleet standard — one toast at the root).
 * Injecting LanguageService initialises the active language at startup.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
  template: `
    <router-outlet />
    <p-toast />
    <p-confirmdialog />
  `,
})
export class App {
  // Eagerly construct the language service so i18n is applied before first paint.
  private readonly language = inject(LanguageService);
  // Recovers tabs opened before a deploy, whose lazy chunks are gone server-side.
  private readonly staleChunk = inject(StaleChunkService).init();
}
