import { Routes } from '@angular/router';
import { provideCattleInformation } from '../cattle-information/infrastructure/configuration/cattle-information.providers';
import { provideOperationsMonitoring } from '../operations-monitoring/infrastructure/configuration/operations-monitoring.providers';
import { providePlanning } from './infrastructure/configuration/planning.providers';

/** Loaded lazily under `/planning`; the cattle and monitoring providers name animals and read the clinical interventions that applications link to. */
export const planningRoutes: Routes = [
  {
    path: '',
    providers: [provideCattleInformation(), providePlanning(), provideOperationsMonitoring()],
    children: [
      {
        path: '',
        loadComponent: () => import('./presentation/components/planning-area-layout').then(module => module.PlanningAreaLayout),
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'pages.planning',
            loadComponent: () => import('./presentation/pages/planning-calendar/planning-calendar-page')
              .then(module => module.PlanningCalendarPage),
          },
          {
            path: 'campaigns',
            title: 'pages.planningCampaigns',
            loadComponent: () => import('./presentation/pages/planning-campaigns/planning-campaigns-page')
              .then(module => module.PlanningCampaignsPage),
          },
          {
            path: 'withdrawal-periods',
            title: 'pages.withdrawalPeriods',
            loadComponent: () => import('./presentation/pages/withdrawal-periods/withdrawal-periods-page')
              .then(module => module.WithdrawalPeriodsPage),
          },
        ],
      },
    ],
  },
];
