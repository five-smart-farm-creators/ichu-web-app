import { Routes } from '@angular/router';
import { provideCattleInformation } from '../cattle-information/infrastructure/configuration/cattle-information.providers';
import { provideIotAssets } from './infrastructure/configuration/iot-assets.providers';

/** Loaded lazily under `/devices`; the cattle providers back the ACL facade that labels assignment targets. */
export const iotAssetsRoutes: Routes = [
  {
    path: '',
    providers: [provideCattleInformation(), provideIotAssets()],
    loadComponent: () => import('./presentation/components/devices-area-layout').then(module => module.DevicesAreaLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.iotDevices',
        loadComponent: () => import('./presentation/pages/devices/devices-page').then(module => module.DevicesPage),
      },
      {
        path: 'water-troughs',
        title: 'pages.waterTroughs',
        loadComponent: () => import('./presentation/pages/water-troughs/water-troughs-page').then(module => module.WaterTroughsPage),
      },
      {
        path: 'gateways',
        title: 'pages.edgeGateways',
        loadComponent: () => import('./presentation/pages/edge-gateways/edge-gateways-page').then(module => module.EdgeGatewaysPage),
      },
    ],
  },
];
