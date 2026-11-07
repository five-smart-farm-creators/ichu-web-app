import { Routes } from '@angular/router';
import { authGuard } from './application/guards/auth.guard';

export const iamRoutes: Routes = [
  { path: 'login', loadComponent: () => import('./presentation/pages/authentication/login-page').then(module => module.LoginPage) },
  { path: 'register', loadComponent: () => import('./presentation/pages/authentication/register-page').then(module => module.RegisterPage) },
  { path: 'recover', loadComponent: () => import('./presentation/pages/authentication/recovery-page').then(module => module.RecoveryPage) },
  { path: 'account', canActivate: [authGuard], loadComponent: () => import('./presentation/pages/account/account-workspace-page').then(module => module.AccountWorkspacePage) },
  { path: 'advisories', canActivate: [authGuard], loadComponent: () => import('./presentation/pages/account/account-workspace-page').then(module => module.AccountWorkspacePage) },
];
