import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { TokenStorageService } from '@3-dp-fe/praetor-auth-kit';

export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  const token = tokenStorage.getAccessToken();
  if (token) {
    return true;
  }

  return router.parseUrl('/login');
};
