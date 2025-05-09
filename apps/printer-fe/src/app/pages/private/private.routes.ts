import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';

export const privateRoutes: Routes = [
  {
    path: 'dashboard',
    component: DashboardComponent,
  },
];
