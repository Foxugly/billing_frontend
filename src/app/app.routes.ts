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
        path: 'deliveries',
        loadComponent: () =>
          import('./features/deliveries/deliveries-list.component').then(
            (m) => m.DeliveriesListComponent,
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
