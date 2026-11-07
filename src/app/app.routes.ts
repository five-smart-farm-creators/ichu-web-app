import { Routes } from '@angular/router';
import { iamRoutes } from './features/iam/iam.routes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'account' },
  ...iamRoutes,
  { path: 'terms', loadComponent: () => import('./core/layout/terms-page').then(module => module.TermsPage) },
  { path: '**', loadComponent: () => import('./shared/presentation/not-found-page').then(module => module.NotFoundPage) },
];
