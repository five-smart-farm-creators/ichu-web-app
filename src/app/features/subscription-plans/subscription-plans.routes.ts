import { Routes } from '@angular/router';
import { provideSubscriptionPlans } from './infrastructure/configuration/subscription-plans.providers';

/** Loaded lazily under `/plans`; the catalog and the subscription request share the same providers. */
export const plansRoutes: Routes = [
  {
    path: '',
    providers: [provideSubscriptionPlans()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.plans',
        loadComponent: () => import('./presentation/pages/plans/plans-page').then(module => module.PlansPage),
      },
    ],
  },
];

/** Loaded lazily under `/subscriptions`, including the pages where Stripe returns the visitor. */
export const subscriptionRoutes: Routes = [
  {
    path: '',
    providers: [provideSubscriptionPlans()],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'pages.mySubscription',
        loadComponent: () => import('./presentation/pages/my-plan/my-plan-page').then(module => module.MyPlanPage),
      },
      {
        path: 'payment/success',
        title: 'pages.paymentSuccess',
        loadComponent: () => import('./presentation/pages/payment/payment-success-page').then(module => module.PaymentSuccessPage),
      },
      {
        path: 'payment/cancel',
        title: 'pages.paymentCancel',
        loadComponent: () => import('./presentation/pages/payment/payment-cancel-page').then(module => module.PaymentCancelPage),
      },
    ],
  },
];
