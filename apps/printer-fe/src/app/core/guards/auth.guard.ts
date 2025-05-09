import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { userStore } from '@3-dp-fe/praetor-auth-kit';

export const authGuard: CanActivateFn = () => {
  const store = inject(userStore);
  const router = inject(Router);

  const user = store.user();

  if (user) {
    return true;
  }

  const currentUrl = router.url;
  router.navigate(['/login']).then();
  return false;
};
