import { Routes } from '@angular/router';
import { provideCattleInformation } from '../cattle-information/infrastructure/configuration/cattle-information.providers';
import { providePlanning } from '../planning/infrastructure/configuration/planning.providers';
import { provideDashboardAnalytics } from './infrastructure/configuration/dashboard-analytics.providers';

/** Loaded lazily under `/dashboard`; animal labels and upcoming work come through the ACL facades of their contexts. */
export const dashboardRoutes: Routes = [
  {
    path: '',
    providers: [provideCattleInformation(), providePlanning(), provideDashboardAnalytics()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.dashboard',
        loadComponent: () => import('./presentation/pages/herd-dashboard/herd-dashboard-page').then(module => module.HerdDashboardPage),
      },
    ],
  },
];

/** Loaded lazily under `/reports`; the trends screen names animals and lots through the cattle facade. */
export const reportRoutes: Routes = [
  {
    path: '',
    providers: [provideCattleInformation(), provideDashboardAnalytics()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.reports',
        loadComponent: () => import('./presentation/pages/reports/reports-page').then(module => module.ReportsPage),
      },
    ],
  },
];

/** Loaded lazily under `/portfolio`; ranch names come from the IAM facade that the shell already provides. */
export const portfolioRoutes: Routes = [
  {
    path: '',
    providers: [provideDashboardAnalytics()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.portfolio',
        loadComponent: () => import('./presentation/pages/portfolio/portfolio-page').then(module => module.PortfolioPage),
      },
    ],
  },
];
