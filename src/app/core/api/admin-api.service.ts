import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as Sentry from '@sentry/angular';
import { firstValueFrom } from 'rxjs';

import { getRuntimeConfig } from '../runtime-config';

export interface DashboardApp {
  slug: string;
  name: string;
  active: boolean;
  paid: number;
  total: number;
}

export interface Dashboard {
  mrr_cents: number;
  apps: DashboardApp[];
  deliveries: { pending: number; failed: number };
  customers: number;
}

export interface BillingApp {
  id: number;
  slug: string;
  name: string;
  base_url: string;
  entitlement_path: string;
  entitlement_url: string;
  /** Hôtes vers lesquels Stripe peut renvoyer le client (audit M2). Vide = checkout refusé. */
  return_hosts: string[];
  active: boolean;
  plans_count: number;
  secret_rotated_at: string | null;
  created_at: string;
}

export interface BillingPlan {
  id: number;
  app: number;
  app_slug: string;
  code: string;
  name: string;
  description: string;
  price_monthly: string | null;
  price_yearly: string | null;
  price_monthly_amount: number | null;
  price_yearly_amount: number | null;
  quotas: Record<string, number>;
  /** Non vide = plan facture a l'unite : le quota suit la quantite souscrite,
   *  et `quotas` est vide. Offrir l'acces demande alors un nombre d'unites. */
  per_unit_quota_key: string;
  trial_days: number;
  sort_order: number;
  public: boolean;
  active: boolean;
}

/** Un evenement Stripe recu, et ce que le service en a fait. */
export interface StripeEvent {
  id: string;
  type: string;
  created: string | null;
  livemode: boolean;
  /** Faux = ce type d'evenement ne declenche aucun recalcul chez nous. */
  handled: boolean;
  /** Vide = evenement non attribuable a une app : le webhook l'a ignore. */
  app_slug: string;
  external_user_id: string;
}

/** Un prix Stripe mire, tel que le selecteur de la page Plans l'affiche. */
export interface StripePrice {
  id: string;
  unit_amount: number | null;
  currency: string;
  /** '' pour un prix ponctuel : il n'y a pas d'intervalle a afficher. */
  interval: string;
  nickname: string;
  product_name: string;
}

export interface BillingCustomer {
  id: number;
  app: number | null;
  app_slug: string | null;
  is_direct: boolean;
  external_user_id: string;
  email: string;
  customer: string | null;
  created_at: string;
}

export interface Entitlement {
  id: number;
  app_slug: string;
  external_user_id: string;
  is_paid: boolean;
  status: string;
  plan_code: string;
  interval: string;
  quotas: Record<string, number>;
  current_period_end: string | null;
  grace_until: string | null;
  stripe_customer_id: string;
  source: string;
  computed_at: string;
}

export interface Delivery {
  id: string;
  app_slug: string;
  external_user_id: string;
  status: string;
  attempts: number;
  last_error: string;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
  payload: Record<string, unknown>;
}

/** Une facture, telle que le miroir dj-stripe la restitue. Montants en centimes. */
export interface Invoice {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  amount_due: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  created: string | null;
  customer_email: string;
  /** 'direct' pour une prestation, sinon le slug de l'app qui a vendu. */
  origin: string;
}

export interface InvoiceLineDraft {
  description: string;
  quantity: number;
  /** En centimes : un montant facturé ne se manipule pas en flottant. */
  unit_amount: number;
  tax_code?: string;
}

export interface InvoiceDraft {
  customer: { email: string; name?: string; address?: Record<string, string> };
  lines: InvoiceLineDraft[];
  days_until_due: number;
  description?: string;
}

export interface TaxCode {
  id: string;
  name: string;
  description?: string;
}

/**
 * Plafond de lignes chargées pour une liste. Le backend pagine (audit M5) ; la
 * console suit `next` jusqu'à ce plafond — au-delà, affiner les filtres.
 */
export const MAX_LIST_ROWS = 1000;
const PAGE_SIZE = 200;
/** Garde-fou contre un serveur qui renverrait des pages vides avec un `next`. */
export const MAX_LIST_PAGES = Math.ceil(MAX_LIST_ROWS / PAGE_SIZE) + 1;
/** Seuls paramètres repris de `next` : la requête est reconstruite, jamais suivie telle quelle. */
const PAGING_PARAMS = ['page', 'cursor'] as const;

type ListBody<T> = T[] | { results: T[]; next: string | null };

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = getRuntimeConfig().apiBaseUrl + '/api/v1/admin';

  /**
   * GET d'une liste paginée, pages suivies jusqu'à MAX_LIST_ROWS / MAX_LIST_PAGES.
   * Accepte aussi une liste nue.
   *
   * `next` n'est jamais suivi tel quel : l'intercepteur y attacherait le jeton
   * d'opérateur, et un `next` vers une autre origine le ferait fuiter. On exige
   * la même origine et le même chemin de liste, puis on RECONSTRUIT la requête
   * sur `${base}/${path}/` en ne reprenant que `page`/`cursor`.
   */
  private async list<T>(
    path: string,
    filters: Record<string, string | undefined> = {},
  ): Promise<T[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    params.set('page_size', String(PAGE_SIZE));
    const listUrl = `${this.base}/${path}/`;
    let url: string | null = `${listUrl}?${params}`;
    const rows: T[] = [];
    for (let pages = 0; url && pages < MAX_LIST_PAGES && rows.length < MAX_LIST_ROWS; pages++) {
      const body: ListBody<T> = await firstValueFrom(this.http.get<ListBody<T>>(url));
      if (Array.isArray(body)) return body;
      const results = body?.results ?? [];
      if (results.length === 0) break;
      rows.push(...results);
      url = body?.next ? nextPageUrl(body.next, listUrl, params) : null;
    }
    return rows.slice(0, MAX_LIST_ROWS);
  }

  dashboard() {
    return firstValueFrom(this.http.get<Dashboard>(`${this.base}/dashboard/`));
  }

  apps(): Promise<BillingApp[]> {
    return this.list<BillingApp>('apps');
  }

  plans(appSlug?: string): Promise<BillingPlan[]> {
    return this.list<BillingPlan>('plans', { app: appSlug });
  }

  events(filters: { type?: string; handled?: boolean } = {}): Promise<StripeEvent[]> {
    return this.list<StripeEvent>('events', {
      type: filters.type,
      handled: filters.handled ? 'true' : undefined,
    });
  }

  replayEvent(id: string) {
    return firstValueFrom(
      this.http.post<{ id: string; delivery: string | null; detail: string }>(
        `${this.base}/events/${id}/replay/`,
        {},
      ),
    );
  }

  prices(): Promise<StripePrice[]> {
    return this.list<StripePrice>('prices');
  }

  savePlan(plan: Partial<BillingPlan>) {
    return plan.id
      ? firstValueFrom(this.http.patch<BillingPlan>(`${this.base}/plans/${plan.id}/`, plan))
      : firstValueFrom(this.http.post<BillingPlan>(`${this.base}/plans/`, plan));
  }

  deletePlan(id: number) {
    return firstValueFrom(this.http.delete<void>(`${this.base}/plans/${id}/`));
  }

  customers(filters: { app?: string; email?: string } = {}): Promise<BillingCustomer[]> {
    return this.list<BillingCustomer>('customers', filters);
  }

  entitlements(filters: { app?: string; user?: string } = {}): Promise<Entitlement[]> {
    return this.list<Entitlement>('entitlements', filters);
  }

  deliveries(filters: { status?: string; app?: string } = {}): Promise<Delivery[]> {
    return this.list<Delivery>('deliveries', filters);
  }

  replayDelivery(id: string) {
    return firstValueFrom(
      this.http.post<{ id: string; status: string }>(`${this.base}/deliveries/${id}/replay/`, {}),
    );
  }

  grantEntitlement(id: number, quotas?: Record<string, number>) {
    return firstValueFrom(
      this.http.post<Entitlement>(
        `${this.base}/entitlements/${id}/grant/`,
        quotas ? { quotas } : {},
      ),
    );
  }

  pingApp(id: number) {
    return firstValueFrom(
      this.http.post<{ ok: boolean; detail: string }>(`${this.base}/apps/${id}/ping/`, {}),
    );
  }

  invoices(origin?: string): Promise<Invoice[]> {
    return this.list<Invoice>('invoices', { origin });
  }

  createInvoice(draft: InvoiceDraft) {
    return firstValueFrom(this.http.post<Invoice>(`${this.base}/invoices/`, draft));
  }

  /** finalize · send · mark_paid · void — le cycle de vie vit chez Stripe. */
  invoiceAction(id: string, action: 'finalize' | 'send' | 'mark_paid' | 'void') {
    return firstValueFrom(this.http.post<Invoice>(`${this.base}/invoices/${id}/${action}/`, {}));
  }

  /** L'export part en CSV : on le récupère en blob pour déclencher un téléchargement. */
  exportInvoices(from?: string, to?: string) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString() ? `?${params}` : '';
    return firstValueFrom(
      this.http.get(`${this.base}/invoices/export/${query}`, { responseType: 'blob' }),
    );
  }

  /** Les codes fiscaux viennent de Stripe : en inventer un donnerait une TVA fausse. */
  async taxCodes(search: string): Promise<TaxCode[]> {
    const query = search ? `?q=${encodeURIComponent(search)}` : '';
    return firstValueFrom(this.http.get<TaxCode[]>(`${this.base}/tax-codes/${query}`));
  }

  /** Le secret n'est renvoyé qu'ici, une seule fois : il n'est plus relisible ensuite. */
  rotateSecret(id: number) {
    return firstValueFrom(
      this.http.post<{ slug: string; shared_secret: string; warning: string }>(
        `${this.base}/apps/${id}/rotate_secret/`,
        {},
      ),
    );
  }
}

/**
 * URL de la page suivante reconstruite sur `listUrl`, ou null si `next` sort de
 * l'origine ou du chemin de la liste (signalé : c'est une anomalie du serveur).
 */
export function nextPageUrl(next: string, listUrl: string, params: URLSearchParams): string | null {
  const here = globalThis.location?.href;
  let candidate: URL;
  let expected: URL;
  try {
    expected = new URL(listUrl, here);
    candidate = new URL(next, expected);
  } catch {
    return refuseNext(next);
  }
  if (candidate.origin !== expected.origin || !candidate.pathname.startsWith(expected.pathname)) {
    return refuseNext(next);
  }
  const rebuilt = new URLSearchParams(params);
  let paged = false;
  for (const key of PAGING_PARAMS) {
    const value = candidate.searchParams.get(key);
    if (value) {
      rebuilt.set(key, value);
      paged = true;
    }
  }
  return paged ? `${listUrl}?${rebuilt}` : null;
}

function refuseNext(next: string): null {
  const message = 'admin-api: lien de pagination hors origine ou hors liste, ignoré';
  console.error(message, next);
  Sentry.captureMessage(message, 'warning');
  return null;
}
