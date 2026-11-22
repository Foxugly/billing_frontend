import { TestBed } from '@angular/core/testing';
import {
  provideTransloco,
  Translation,
  TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { TRANSLOCO_CONFIG } from './transloco-config';

const requested: string[] = [];

/** Loader dont le catalogue `en` est injoignable (réseau, 404, déploiement…). */
class EnFailingLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    requested.push(lang);
    return lang === 'en'
      ? throwError(() => new Error('en.json injoignable'))
      : of({ greeting: `bonjour-${lang}` });
  }
}

describe('TRANSLOCO_CONFIG', () => {
  it('retombe sur le catalogue fr quand celui de la langue active échoue (BILLING-FRONTEND-2)', async () => {
    requested.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { ...TRANSLOCO_CONFIG, failedRetries: 0 },
          loader: EnFailingLoader,
        }),
      ],
    });
    const transloco = TestBed.inject(TranslocoService);

    const translation = await firstValueFrom(transloco.load('en'));

    expect(translation).toEqual({ greeting: 'bonjour-fr' });
    expect(requested).toEqual(['en', 'fr']);
  });

  it('a fr comme langue de repli, distincte de en', () => {
    expect(TRANSLOCO_CONFIG.fallbackLang).toBe('fr');
    expect(TRANSLOCO_CONFIG.defaultLang).toBe('fr');
  });
});
