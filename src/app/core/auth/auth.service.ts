import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { getRuntimeConfig } from '../runtime-config';

export interface CurrentUser {
  id: number;
  email: string;
  displayName: string;
  isStaff: boolean;
  isSuperuser: boolean;
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
 * dans la flotte.
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

  async login(email: string, password: string, remember: boolean): Promise<void> {
    const pair = await firstValueFrom(
      this.http.post<TokenPair>(`${this.base}/api/auth/token/`, { email, password }),
    );
    this.store(pair, remember);
    await this.loadCurrentUser();
  }

  async loadCurrentUser(): Promise<CurrentUser | null> {
    if (!this._access()) return null;
    try {
      const user = await firstValueFrom(this.http.get<CurrentUser>(`${this.base}/api/auth/me/`));
      this._user.set(user);
      return user;
    } catch {
      this.clear();
      return null;
    }
  }

  /** Rafraîchit l'accès. Renvoie false si la session est définitivement perdue. */
  async refresh(): Promise<boolean> {
    const refresh = read(REFRESH_KEY);
    if (!refresh) return false;
    try {
      const pair = await firstValueFrom(
        this.http.post<TokenPair>(`${this.base}/api/auth/token/refresh/`, { refresh }),
      );
      // Le refresh roté DOIT être persisté : l'ancien vient d'être blacklisté.
      this.store({ access: pair.access, refresh: pair.refresh ?? refresh }, isRemembered());
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  logout(): void {
    this.clear();
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

function isRemembered(): boolean {
  try {
    return localStorage.getItem(ACCESS_KEY) !== null;
  } catch {
    return false;
  }
}
