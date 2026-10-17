import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { MainLayoutComponent } from './core/layout/main-layout/main-layout.component';
import { PublicLayoutComponent } from './core/layout/public-layout/public-layout.component';

export const routes: Routes = [
  // Console d'exploitation : reservee aux operateurs (authGuard + backend IsAdminUser).
  {
    path: '',
    canActivate: [authGuard],
    component: MainLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        data: { titleKey: 'dashboard.title' },
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'apps',
        data: { titleKey: 'apps.title' },
        loadComponent: () =>
          import('./features/apps/apps-list.component').then((m) => m.AppsListComponent),
      },
      {
        path: 'plans',
        data: { titleKey: 'plans.title' },
        loadComponent: () =>
          import('./features/plans/plans-list.component').then((m) => m.PlansListComponent),
      },
      {
        path: 'customers',
        data: { titleKey: 'customers.title' },
        loadComponent: () =>
          import('./features/customers/customers-list.component').then(
            (m) => m.CustomersListComponent,
          ),
      },
      {
        path: 'entitlements',
        data: { titleKey: 'entitlements.title' },
        loadComponent: () =>
          import('./features/entitlements/entitlements-list.component').then(
            (m) => m.EntitlementsListComponent,
          ),
      },
      {
        path: 'deliveries',
        data: { titleKey: 'deliveries.title' },
        loadComponent: () =>
          import('./features/deliveries/deliveries-list.component').then(
            (m) => m.DeliveriesListComponent,
          ),
      },
      {
        path: 'events',
        data: { titleKey: 'events.title' },
        loadComponent: () =>
          import('./features/events/events-list.component').then((m) => m.EventsListComponent),
      },
      {
        path: 'invoices',
        data: { titleKey: 'invoices.title' },
        loadComponent: () =>
          import('./features/invoices/invoices-list.component').then(
            (m) => m.InvoicesListComponent,
          ),
      },
    ],
  },

  // Pas d'inscription ni de mot de passe oublie : le backend refuse tout compte
  // non-staff, et les comptes sont crees par createsuperuser.
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: 'login',
        data: { titleKey: 'login.title' },
        loadComponent: () =>
          import('./features/auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'privacy',
        data: { titleKey: 'privacy.title' },
        loadComponent: () =>
          import('./features/privacy/privacy.component').then((m) => m.PrivacyComponent),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
