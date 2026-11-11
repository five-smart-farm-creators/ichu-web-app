import { Routes } from '@angular/router';

/** Animal pages render inside the app shell; `lots` is listed before the profile so it is not read as an animal ID. */
export const cattleInformationRoutes: Routes = [
  {
    path: 'cattle',
    loadComponent: () => import('./presentation/components/cattle-area-layout').then(module => module.CattleAreaLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.animals',
        loadComponent: () => import('./presentation/pages/cattle-inventory/cattle-inventory-page').then(module => module.CattleInventoryPage),
      },
      {
        path: 'lots',
        title: 'pages.lots',
        loadComponent: () => import('./presentation/pages/cattle-lots/cattle-lots-page').then(module => module.CattleLotsPage),
      },
    ],
  },
  {
    path: 'cattle/:cattleId',
    title: 'pages.animalProfile',
    loadComponent: () => import('./presentation/pages/cattle-profile/cattle-profile-page').then(module => module.CattleProfilePage),
  },
];
