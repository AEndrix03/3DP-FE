import { Route } from '@angular/router';

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
  },
  {
    path: '**',
    redirectTo: '',
  },
];
