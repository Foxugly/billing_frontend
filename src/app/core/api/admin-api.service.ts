import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

/** DRF pagine parfois, parfois non : accepter les deux évite une page vide muette. */
function unwrap<T>(body: T[] | { results: T[] }): T[] {
  return Array.isArray(body) ? body : (body?.results ?? []);
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = getRuntimeConfig().apiBaseUrl + '/api/v1/admin';

  dashboard() {
    return firstValueFrom(this.http.get<Dashboard>(`${this.base}/dashboard/`));
  }

  async apps(): Promise<BillingApp[]> {
    return unwrap(await firstValueFrom(this.http.get<BillingApp[]>(`${this.base}/apps/`)));
  }

  async plans(appSlug?: string): Promise<BillingPlan[]> {
    const query = appSlug ? `?app=${encodeURIComponent(appSlug)}` : '';
    return unwrap(await firstValueFrom(this.http.get<BillingPlan[]>(`${this.base}/plans/${query}`)));
  }

  async customers(filters: { app?: string; email?: string } = {}): Promise<BillingCustomer[]> {
    const params = new URLSearchParams();
    if (filters.app) params.set('app', filters.app);
    if (filters.email) params.set('email', filters.email);
    const query = params.toString() ? `?${params}` : '';
    return unwrap(
      await firstValueFrom(this.http.get<BillingCustomer[]>(`${this.base}/customers/${query}`)),
    );
  }

  async entitlements(filters: { app?: string; user?: string } = {}): Promise<Entitlement[]> {
    const params = new URLSearchParams();
    if (filters.app) params.set('app', filters.app);
    if (filters.user) params.set('user', filters.user);
    const query = params.toString() ? `?${params}` : '';
    return unwrap(
      await firstValueFrom(this.http.get<Entitlement[]>(`${this.base}/entitlements/${query}`)),
    );
  }

  async deliveries(filters: { status?: string; app?: string } = {}): Promise<Delivery[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.app) params.set('app', filters.app);
    const query = params.toString() ? `?${params}` : '';
    return unwrap(await firstValueFrom(this.http.get<Delivery[]>(`${this.base}/deliveries/${query}`)));
  }

  replayDelivery(id: string) {
    return firstValueFrom(this.http.post<{ id: string; status: string }>(`${this.base}/deliveries/${id}/replay/`, {}));
  }

  grantEntitlement(id: number, quotas?: Record<string, number>) {
    return firstValueFrom(this.http.post<Entitlement>(`${this.base}/entitlements/${id}/grant/`, quotas ? { quotas } : {}));
  }

  pingApp(id: number) {
    return firstValueFrom(this.http.post<{ ok: boolean; detail: string }>(`${this.base}/apps/${id}/ping/`, {}));
  }

  async invoices(origin?: string): Promise<Invoice[]> {
    const query = origin ? `?origin=${encodeURIComponent(origin)}` : '';
    return unwrap(await firstValueFrom(this.http.get<Invoice[]>(`${this.base}/invoices/${query}`)));
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
