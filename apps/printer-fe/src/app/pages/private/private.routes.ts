import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LayoutPrivateComponent } from '../../layout/private/layout-private.component';
import { ProfileComponent } from './profile/profile.component';
import { PrintersComponent } from './printers/printers.component';
import { JobsComponent } from './jobs/jobs.component';

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
        component: JobsComponent,
      },
      {
        path: 'profile',
        component: ProfileComponent,
      },
    ],
  },
];
