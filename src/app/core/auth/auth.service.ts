import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { getRuntimeConfig } from '../runtime-config';

export interface CurrentUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  isStaff: boolean;
  isSuperuser: boolean;
}

/** Champs modifiables depuis la page Profil (l'email est l'identifiant : lecture seule). */
export interface ProfileUpdate {
  firstName: string;
  lastName: string;
}

interface TokenPair {
  access: string;
  refresh: string;
}

const ACCESS_KEY = 'billing.access';
const REFRESH_KEY = 'billing.refresh';

/**
 * Authentification des opérateurs (JWT simplejwt).
 *
 * Ce service n'a ni inscription ni mot de passe oublié : le backend refuse
 * d'ailleurs tout compte non-staff. Les comptes sont créés par `createsuperuser`.
 *
 * Le refresh est **roté** par le backend : chaque rafraîchissement renvoie un
 * nouveau refresh et met l'ancien sur liste noire. Ne pas persister le jeton roté
 * éjecterait l'opérateur à la première rotation — piège déjà rencontré ailleurs
 * dans la flotte. Pour la même raison, un seul rafraîchissement à la fois : deux
 * requêtes en 401 simultanées présenteraient le même refresh, et la seconde
 * serait refusée (jeton déjà roté).
 *
 * La session n'est effacée que sur un **401/403** du refresh, jamais sur une
 * erreur réseau ou un 5xx (OPERATIONS.md §3.25). Le changement de mot de passe
 * révoque tous les refresh côté serveur et renvoie une paire neuve, stockée ici.
 * Le logout met le refresh sur liste noire côté serveur.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = getRuntimeConfig().apiBaseUrl;

  private readonly _access = signal<string | null>(read(ACCESS_KEY));
  private readonly _user = signal<CurrentUser | null>(null);

  readonly accessToken = this._access.asReadonly();
  readonly currentUser = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._access() !== null);

  /** Rafraîchissement en cours, partagé par tous ceux qui en ont besoin. */
  private refreshing: Promise<boolean> | null = null;

  async login(email: string, password: string, remember: boolean): Promise<void> {
    const pair = await firstValueFrom(
      this.http.post<TokenPair>(`${this.base}/api/v1/auth/token/`, { email, password }),
    );
    this.store(pair, remember);
    await this.loadCurrentUser();
  }

  async loadCurrentUser(): Promise<CurrentUser | null> {
    if (!this._access()) return null;
    try {
      const user = await firstValueFrom(this.http.get<CurrentUser>(`${this.base}/api/v1/auth/me/`));
      this._user.set(user);
      return user;
    } catch (err) {
      // Une panne réseau ou un 5xx ne déconnecte pas : seul un refus le fait.
      if (isAuthRefusal(err)) this.clear();
      return null;
    }
  }

  /**
   * Relit le profil pour la page Profil. Contrairement à `loadCurrentUser`, une
   * erreur est propagée (et la session conservée) : la page l'affiche.
   */
  async fetchProfile(): Promise<CurrentUser> {
    const user = await firstValueFrom(this.http.get<CurrentUser>(`${this.base}/api/v1/auth/me/`));
    this._user.set(user);
    return user;
  }

  async updateProfile(changes: ProfileUpdate): Promise<CurrentUser> {
    const user = await firstValueFrom(
      this.http.patch<CurrentUser>(`${this.base}/api/v1/auth/me/`, changes),
    );
    this._user.set(user);
    return user;
  }

  /**
   * Erreurs 400 porteuses d'un `code` : current_password_invalid, password_unchanged, password_invalid.
   *
   * Le backend révoque tous les refresh existants et renvoie une paire neuve :
   * elle DOIT être stockée, sinon l'opérateur est éjecté à l'expiration de l'accès.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const pair = await firstValueFrom(
      this.http.post<TokenPair | null>(`${this.base}/api/v1/auth/password/change/`, {
        current_password: currentPassword,
        new_password: newPassword,
      }),
    );
    if (pair?.access && pair?.refresh) {
      this.store(pair, isRemembered());
    }
  }

  /**
   * Rafraîchit l'accès. Renvoie false si la session est définitivement perdue
   * (refresh absent, ou refusé par un 401/403). Une erreur réseau ou un 5xx est
   * propagée, session conservée : l'opérateur réessaiera.
   */
  refresh(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const refresh = read(REFRESH_KEY);
    if (!refresh) return false;
    try {
      const pair = await firstValueFrom(
        this.http.post<TokenPair>(`${this.base}/api/v1/auth/token/refresh/`, { refresh }),
      );
      // Le refresh roté DOIT être persisté : l'ancien vient d'être blacklisté.
      this.store({ access: pair.access, refresh: pair.refresh ?? refresh }, isRemembered());
      return true;
    } catch (err) {
      if (isAuthRefusal(err)) {
        this.clear();
        return false;
      }
      throw err;
    }
  }

  /** Déconnexion : le refresh est mis sur liste noire côté serveur (au mieux). */
  logout(): void {
    const refresh = read(REFRESH_KEY);
    this.clear();
    if (refresh) {
      this.http
        .post(`${this.base}/api/v1/auth/token/blacklist/`, { refresh })
        .subscribe({ error: () => undefined });
    }
    void this.router.navigate(['/login']);
  }

  clear(): void {
    this._access.set(null);
    this._user.set(null);
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem(ACCESS_KEY);
      store.removeItem(REFRESH_KEY);
    }
  }

  private store(pair: TokenPair, remember: boolean): void {
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    store.setItem(ACCESS_KEY, pair.access);
    store.setItem(REFRESH_KEY, pair.refresh);
    other.removeItem(ACCESS_KEY);
    other.removeItem(REFRESH_KEY);
    this._access.set(pair.access);
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function isAuthRefusal(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403);
}

function isRemembered(): boolean {
  try {
    return localStorage.getItem(ACCESS_KEY) !== null;
  } catch {
    return false;
  }
}
