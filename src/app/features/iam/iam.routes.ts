import { Routes } from '@angular/router';

/** Sign-in, registration, and recovery render inside the public layout, without the app shell. */
export const iamPublicRoutes: Routes = [
  { path: 'login', title: 'pages.signIn', loadComponent: () => import('./presentation/pages/authentication/login-page').then(module => module.LoginPage) },
  { path: 'register', title: 'pages.register', loadComponent: () => import('./presentation/pages/authentication/register-page').then(module => module.RegisterPage) },
  { path: 'recover', title: 'pages.recover', loadComponent: () => import('./presentation/pages/authentication/recovery-page').then(module => module.RecoveryPage) },
];

/** Account and advisory pages render inside the app shell, which applies the auth guard. */
export const iamWorkspaceRoutes: Routes = [
  { path: 'account', title: 'pages.account', loadComponent: () => import('./presentation/pages/account/account-workspace-page').then(module => module.AccountWorkspacePage) },
  { path: 'advisories', title: 'pages.advisories', loadComponent: () => import('./presentation/pages/account/account-workspace-page').then(module => module.AccountWorkspacePage) },
];
