import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

/**
 * Loader HTTP standard de la flotte (STANDARD-frontend-layout.md §5) : les
 * catalogues vivent dans `public/i18n/<lang>.json` et sont servis comme assets
 * statiques par le build Angular.
 *
 * Remplace le loader « bundlé » qui servait un objet TypeScript en mémoire
 * (`core/i18n/catalogs.ts`, supprimé). Ce choix était assumé — il permettait à
 * l'app de référence de tourner sans serveur — mais il faisait de billing le
 * seul front à ne pas suivre la norme, alors qu'il est justement celui qui la
 * documente.
 *
 * Les JSON ont été extraits par EXÉCUTION du module TypeScript, pas recopiés à
 * la main, pour que le `deepMerge` de nl / it / es sur en soit reproduit à
 * l'identique : 202 clés par langue, vérifié.
 */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(`/i18n/${lang}.json`);
  }
}
