import { Route } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadChildren: () =>
      import('./pages/public/public.routes').then((m) => m.publicRoutes),
  },
  {
    path: '',
    loadChildren: () =>
      import('./pages/private/private.routes').then((m) => m.privateRoutes),
    canActivate: [authGuard],
  },
  {
    path: '',
    loadChildren: () =>
      import('@3-dp-fe/praetor-auth-kit').then((lib) => lib.authRoutes),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
