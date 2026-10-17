import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, combineLatest, of, switchMap, take } from 'rxjs';

/**
 * Titre d'onglet « {titre de la page} — {nom de l'app} » (WCAG 2.4.2), composé
 * depuis `data.titleKey` de la route la plus profonde. Se recalcule quand la
 * langue change. Sans `titleKey`, l'onglet affiche le nom de l'app seul.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private readonly pageKey$ = new BehaviorSubject<string | null>(null);

  constructor() {
    super();
    combineLatest([this.transloco.langChanges$, this.pageKey$])
      .pipe(
        // selectTranslate attend le chargement du JSON de la langue active.
        switchMap(([, key]) =>
          combineLatest([
            this.transloco.selectTranslate('app.title'),
            key ? this.transloco.selectTranslate(key) : of(''),
          ]).pipe(take(1)),
        ),
      )
      .subscribe(([app, page]) => this.title.setTitle(page ? `${page} — ${app}` : app));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let route = snapshot.root;
    while (route.firstChild) route = route.firstChild;
    this.pageKey$.next((route.data['titleKey'] as string | undefined) ?? null);
  }
}
