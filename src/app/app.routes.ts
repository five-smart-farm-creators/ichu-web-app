import { Routes } from '@angular/router';
import { authGuard } from './features/iam/application/guards/auth.guard';
import { iamPublicRoutes, iamWorkspaceRoutes } from './features/iam/iam.routes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'account' },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/app-shell/app-shell').then(module => module.AppShell),
    children: [
      ...iamWorkspaceRoutes,
      {
        path: 'cattle',
        loadChildren: () => import('./features/cattle-information/cattle-information.routes').then(module => module.cattleInformationRoutes),
      },
      {
        path: 'devices',
        loadChildren: () => import('./features/iot-assets/iot-assets.routes').then(module => module.iotAssetsRoutes),
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./core/layout/public-layout').then(module => module.PublicLayout),
    children: [
      ...iamPublicRoutes,
      { path: 'terms', title: 'pages.terms', loadComponent: () => import('./core/layout/terms-page').then(module => module.TermsPage) },
      { path: '**', title: 'pages.notFound', loadComponent: () => import('./shared/presentation/not-found-page').then(module => module.NotFoundPage) },
    ],
  },
];
