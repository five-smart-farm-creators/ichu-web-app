import { Routes } from '@angular/router';
import { provideCattleInformation } from '../cattle-information/infrastructure/configuration/cattle-information.providers';
import { providePlanning } from '../planning/infrastructure/configuration/planning.providers';
import { provideOperationsMonitoring } from './infrastructure/configuration/operations-monitoring.providers';

/** Loaded lazily under `/monitoring`; the cattle providers name animals and read their productive stage through the ACL facade. */
export const monitoringRoutes: Routes = [
  {
    path: '',
    providers: [provideCattleInformation(), provideOperationsMonitoring()],
    children: [
      {
        path: '',
        loadComponent: () => import('./presentation/components/monitoring-area-layout').then(module => module.MonitoringAreaLayout),
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'pages.monitoring',
            loadComponent: () => import('./presentation/pages/monitoring-overview/monitoring-overview-page')
              .then(module => module.MonitoringOverviewPage),
          },
          {
            path: 'thresholds',
            title: 'pages.thresholds',
            loadComponent: () => import('./presentation/pages/thresholds/thresholds-page').then(module => module.ThresholdsPage),
          },
        ],
      },
      {
        path: 'cattle/:cattleId',
        title: 'pages.monitoringCattle',
        loadComponent: () => import('./presentation/pages/cattle-telemetry/cattle-telemetry-page').then(module => module.CattleTelemetryPage),
      },
    ],
  },
];

/** Loaded lazily under `/alerts`. */
export const alertRoutes: Routes = [
  {
    path: '',
    providers: [provideCattleInformation(), provideOperationsMonitoring()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.alerts',
        loadComponent: () => import('./presentation/pages/alerts/alerts-page').then(module => module.AlertsPage),
      },
    ],
  },
];

/** Loaded lazily under `/locations`. */
export const locationRoutes: Routes = [
  {
    path: '',
    providers: [provideCattleInformation(), provideOperationsMonitoring()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.locations',
        loadComponent: () => import('./presentation/pages/locations/locations-page').then(module => module.LocationsPage),
      },
    ],
  },
];

/** Loaded lazily under `/health`; the animal picker and the `cattle/:cattleId` deep link open the same page. */
export const healthRoutes: Routes = [
  {
    path: '',
    providers: [provideCattleInformation(), providePlanning(), provideOperationsMonitoring()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.clinicalHistory',
        loadComponent: () => import('./presentation/pages/clinical-history/clinical-history-page').then(module => module.ClinicalHistoryPage),
      },
      {
        path: 'cattle/:cattleId',
        title: 'pages.clinicalHistory',
        loadComponent: () => import('./presentation/pages/clinical-history/clinical-history-page').then(module => module.ClinicalHistoryPage),
      },
    ],
  },
];

/** Loaded lazily under `/reproduction`; the females are named through the cattle facade and their history is read through this context. */
export const reproductionRoutes: Routes = [
  {
    path: '',
    providers: [provideCattleInformation(), provideOperationsMonitoring()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.reproduction',
        loadComponent: () => import('./presentation/pages/reproduction/reproduction-page').then(module => module.ReproductionPage),
      },
      {
        path: 'cattle/:cattleId',
        title: 'pages.reproduction',
        loadComponent: () => import('./presentation/pages/reproduction/reproduction-page').then(module => module.ReproductionPage),
      },
    ],
  },
];
