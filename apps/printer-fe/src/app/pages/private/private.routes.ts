import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LayoutPrivateComponent } from '../../layout/private/layout-private.component';
import { ProfileComponent } from './profile/profile.component';
import { PrintersComponent } from './printers/printers.component';

export const privateRoutes: Routes = [
  {
    path: '',
    component: LayoutPrivateComponent,
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
      },
      {
        path: 'printers',
        component: PrintersComponent,
      },
      {
        path: 'jobs',
        loadChildren: () => import('./jobs/jobs.routes').then((r) => r.routes),
      },
      {
        path: 'profile',
        component: ProfileComponent,
      },
    ],
  },
];
