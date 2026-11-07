import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthFacade } from '../services/auth.facade';

/** Allows navigation only after Firebase and the backend account have been verified. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const authentication = inject(AuthFacade);
  const router = inject(Router);
  await authentication.ready();
  return authentication.authenticated() && !authentication.loading() && !authentication.busy()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
