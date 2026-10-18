import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';

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

/** Réponse d'authentification en mode cookie : le refresh n'est jamais dans le corps. */
interface AccessResponse {
  access: string;
}

/**
 * Indice non secret « une session existe », dans le localStorage. Il dit à un
 * nouveau chargement s'il faut tenter la restauration silencieuse, et ses
 * événements `storage` disent aux autres onglets « session changée » (nouvelle
 * valeur) ou « déconnecté » (supprimé). Il ne porte **jamais** de jeton.
 */
export const SESSION_HINT_KEY = 'billing.session';

/** Clés d'avant le cookie : lues une fois pour la migration, puis effacées. */
const LEGACY_ACCESS_KEY = 'billing.access';
const LEGACY_REFRESH_KEY = 'billing.refresh';

/** Verrou Web Locks qui sérialise le refresh entre tous les onglets de l'origine. */
export const REFRESH_LOCK_NAME = 'billing.refresh';

/** Borne de la restauration au démarrage : une API muette ne bloque pas la console. */
const RESTORE_TIMEOUT_MS = 10_000;

/**
 * Opt-in au cookie HttpOnly du backend (billing_server `accounts/refresh_cookie.py`),
 * envoyé sur les appels d'authentification SEULEMENT : le refresh est alors posé
 * dans un cookie `HttpOnly; Secure; SameSite=Lax` limité à `/api/v1/auth/` sur
 * billing-api, et retiré du corps JSON. `withCredentials` laisse le navigateur
 * stocker / envoyer ce cookie sur ces appels cross-origin.
 */
export function cookieAuthOptions(): { headers: HttpHeaders; withCredentials: true } {
  return { headers: new HttpHeaders({ 'X-Auth-Mode': 'cookie' }), withCredentials: true };
}

/**
 * Authentification des opérateurs (JWT simplejwt), design du pilote PushIT
 * (PushIT_frontend #92).
 *
 * Ce service n'a ni inscription ni mot de passe oublié : le backend refuse
 * d'ailleurs tout compte non-staff. Les comptes sont créés par `createsuperuser`.
 *
 * - Le **refresh** vit dans un cookie HttpOnly : aucun script (ni XSS) ne le lit.
 *   Le backend le **rote** à chaque refresh et met l'ancien sur liste noire.
 * - L'**accès** vit en mémoire seulement. Au démarrage, `restore()` (initialiseur
 *   d'application) le récupère via le cookie, puis charge `/me/`.
 * - « Se souvenir de moi » part en `remember_me` : décoché, le backend pose un
 *   cookie de session.
 * - La session n'est effacée que sur un **401/403** du refresh, jamais sur une
 *   erreur réseau ou un 5xx (OPERATIONS.md §3.25).
 * - Plusieurs onglets : le refresh est sérialisé par un Web Lock (deux onglets ne
 *   présentent jamais le même cookie roté), et l'indice `billing.session` signale
 *   « session changée » ou « déconnecté » — jamais un jeton.
 * - Migration : un refresh resté en local/sessionStorage (ancienne console) est
 *   présenté **une fois** dans le corps avec l'opt-in cookie, puis effacé.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = getRuntimeConfig().apiBaseUrl;

  private readonly _access = signal<string | null>(null);
  private readonly _user = signal<CurrentUser | null>(null);

  readonly accessToken = this._access.asReadonly();
  readonly currentUser = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._access() !== null);

  /** Rafraîchissement en cours, partagé par tous ceux qui en ont besoin. */
  private refreshing: Promise<boolean> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const onStorage = (event: StorageEvent) => this.onStorageEvent(event);
      window.addEventListener('storage', onStorage);
      inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
    }
  }

  async login(email: string, password: string, remember: boolean): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<AccessResponse>(
        `${this.base}/api/v1/auth/token/`,
        { email, password, remember_me: remember },
        cookieAuthOptions(),
      ),
    );
    this._access.set(response.access);
    dropLegacyStorage();
    announceSessionChange();
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
   * Restauration silencieuse (initialiseur d'application, et quand un autre
   * onglet change la session) : refresh par le cookie, puis `/me/`. Ne rejette
   * jamais. Un refus (401/403) termine la session ; une erreur réseau ou un 5xx
   * garde l'indice, pour que le prochain chargement réessaie.
   */
  async restore(): Promise<void> {
    if (!hasSession(this._access())) return;
    try {
      const ok = await withTimeout(this.refresh(), RESTORE_TIMEOUT_MS);
      if (!ok) return;
      const user = await firstValueFrom(
        this.http
          .get<CurrentUser>(`${this.base}/api/v1/auth/me/`)
          .pipe(timeout(RESTORE_TIMEOUT_MS)),
      );
      this._user.set(user);
      // Migré depuis un jeton hérité : commencer à annoncer la session.
      if (readHint() === null) announceSessionChange();
    } catch (err) {
      if (isAuthRefusal(err)) {
        this.clear();
      } else {
        // Indice conservé, mais affiché déconnecté jusqu'au prochain essai.
        this._access.set(null);
      }
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
   * Le backend révoque tous les refresh existants, repose le cookie et renvoie un
   * accès neuf : il DOIT être adopté, sinon l'opérateur est éjecté à l'expiration.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<AccessResponse | null>(
        `${this.base}/api/v1/auth/password/change/`,
        { current_password: currentPassword, new_password: newPassword },
        cookieAuthOptions(),
      ),
    );
    if (response?.access) {
      this._access.set(response.access);
      announceSessionChange();
    }
  }

  /**
   * Rafraîchit l'accès par le cookie. Renvoie false si la session est
   * définitivement perdue (aucune session, ou refus 401/403). Une erreur réseau
   * ou un 5xx est propagée, session conservée : l'opérateur réessaiera.
   */
  refresh(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private doRefresh(): Promise<boolean> {
    if (!hasSession(this._access())) return Promise.resolve(false);
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks?.request) return this.postRefresh();
    // Le navigateur envoie le cookie courant au départ de la requête : l'onglet
    // qui attendait le verrou présente le jeton que l'autre vient de roter.
    // request() résout avec la valeur ATTENDUE du callback ; le typage DOM dit
    // Promise<Promise<boolean>>, d'où le passage par unknown.
    return locks.request(REFRESH_LOCK_NAME, () =>
      this.postRefresh(),
    ) as unknown as Promise<boolean>;
  }

  private async postRefresh(): Promise<boolean> {
    // Lu sous le verrou : un autre onglet a peut-être déjà migré ce jeton.
    const legacy = readLegacyRefresh();
    try {
      const response = await firstValueFrom(
        this.http.post<AccessResponse>(
          `${this.base}/api/v1/auth/token/refresh/`,
          legacy ? { refresh: legacy } : {},
          cookieAuthOptions(),
        ),
      );
      if (legacy) dropLegacyStorage();
      this._access.set(response.access);
      return true;
    } catch (err) {
      if (isAuthRefusal(err)) {
        this.clear();
        return false;
      }
      throw err;
    }
  }

  /**
   * Déconnexion : le backend met le cookie sur liste noire et l'efface (au mieux).
   * Sans Bearer : un accès expiré ne doit pas transformer le logout en 401.
   */
  logout(): void {
    this.clear();
    this.http
      .post(`${this.base}/api/v1/auth/token/blacklist/`, {}, cookieAuthOptions())
      .subscribe({ error: () => undefined });
    void this.router.navigate(['/login']);
  }

  /** Efface la session locale (mémoire + indice) ; les autres onglets suivent. */
  clear(): void {
    this._access.set(null);
    this._user.set(null);
    try {
      localStorage.removeItem(SESSION_HINT_KEY);
    } catch {
      /* stockage indisponible : rien à effacer */
    }
    dropLegacyStorage();
  }

  private onStorageEvent(event: StorageEvent): void {
    // key === null <=> storage.clear() dans un autre onglet.
    if (event.key !== null && event.key !== SESSION_HINT_KEY) return;
    if (event.newValue === null) {
      // Déconnecté ailleurs (le cookie est effacé aussi) : abandonner notre copie.
      const hadSession = this._access() !== null;
      this._access.set(null);
      this._user.set(null);
      if (hadSession) void this.router.navigate(['/login']);
      return;
    }
    // Connexion ou changement de mot de passe ailleurs : le cookie partagé porte
    // déjà la nouvelle session, la reprendre (accès + profil).
    void this.restore();
  }
}

function hasSession(access: string | null): boolean {
  return access !== null || readHint() !== null || readLegacyRefresh() !== null;
}

function readHint(): string | null {
  try {
    return localStorage.getItem(SESSION_HINT_KEY);
  } catch {
    return null;
  }
}

/** Nouvelle valeur d'indice -> un événement `storage` dans chaque autre onglet. */
function announceSessionChange(): void {
  try {
    localStorage.setItem(SESSION_HINT_KEY, String(Date.now()));
  } catch {
    /* stockage indisponible : pas de synchronisation entre onglets */
  }
}

function readLegacyRefresh(): string | null {
  try {
    return localStorage.getItem(LEGACY_REFRESH_KEY) ?? sessionStorage.getItem(LEGACY_REFRESH_KEY);
  } catch {
    return null;
  }
}

function dropLegacyStorage(): void {
  try {
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem(LEGACY_REFRESH_KEY);
      store.removeItem(LEGACY_ACCESS_KEY);
    }
  } catch {
    /* stockage indisponible : rien à effacer */
  }
}

function isAuthRefusal(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Restauration de session expirée')), ms);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}
