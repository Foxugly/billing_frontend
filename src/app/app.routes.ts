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
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'apps',
        loadComponent: () =>
          import('./features/apps/apps-list.component').then((m) => m.AppsListComponent),
      },
      {
        path: 'plans',
        loadComponent: () =>
          import('./features/plans/plans-list.component').then((m) => m.PlansListComponent),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customers-list.component').then(
            (m) => m.CustomersListComponent,
          ),
      },
      {
        path: 'entitlements',
        loadComponent: () =>
          import('./features/entitlements/entitlements-list.component').then(
            (m) => m.EntitlementsListComponent,
          ),
      },
      {
        path: 'deliveries',
        loadComponent: () =>
          import('./features/deliveries/deliveries-list.component').then(
            (m) => m.DeliveriesListComponent,
          ),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./features/events/events-list.component').then((m) => m.EventsListComponent),
      },
      {
        path: 'invoices',
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
        loadComponent: () =>
          import('./features/auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'privacy',
        loadComponent: () =>
          import('./features/privacy/privacy.component').then((m) => m.PrivacyComponent),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
