import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import { CATALOGS } from './catalogs';

/**
 * BUNDLED Transloco loader (STANDARD-frontend-layout.md §5): serves the
 * in-memory catalogs instead of fetching /i18n/<lang>.json over HTTP, so the
 * reference app runs fully offline. A real fleet app usually keeps the HTTP
 * loader (JSON in public/i18n/); this variant is used here to stay server-free.
 */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    return of<Translation>(CATALOGS[lang] ?? CATALOGS['fr']);
  }
}
