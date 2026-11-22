import { isDevMode } from '@angular/core';
import { translocoConfig } from '@jsverse/transloco';

/**
 * Configuration Transloco de l'app (exportée pour être testée telle quelle).
 *
 * `fallbackLang` : sans elle, l'échec du chargement d'UN catalogue (après les
 * tentatives de Transloco) lève une `TranslationLoadError` non gérée et l'UI
 * reste sans textes (Sentry BILLING-FRONTEND-2, `en.json` le 02/11). Avec elle,
 * Transloco charge le catalogue de repli et affiche l'app dans cette langue.
 * Repli = `fr`, la langue par défaut et la source des autres catalogues — pas
 * `en` comme PushIT / QuizOnline : un navigateur en anglais (cas de l'incident)
 * retomberait alors sur le fichier même qui vient d'échouer.
 */
export const TRANSLOCO_CONFIG = translocoConfig({
  availableLangs: ['fr', 'nl', 'en', 'it', 'es'],
  defaultLang: 'fr',
  fallbackLang: 'fr',
  reRenderOnLangChange: true,
  prodMode: !isDevMode(),
});
