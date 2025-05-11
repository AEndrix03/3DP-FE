import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AuthEventsService } from '@3-dp-fe/praetor-auth-kit'; // oppure il path reale se diverso
import { Router } from '@angular/router';
import { LogoutConfirmComponent } from './logout-confirm/logout-confirm.component';

@Component({
  selector: 'praetor-logout',
  standalone: true,
  imports: [CommonModule, ButtonModule, LogoutConfirmComponent],
  templateUrl: './logout.component.html',
})
export class LogoutComponent {
  constructor(
    private readonly authEventService: AuthEventsService,
    private readonly router: Router,
    private readonly location: Location
  ) {}

  confirmLogout(): void {
    this.authEventService.emitLogout();
    this.router.navigate(['']);
  }

  cancelLogout(): void {
    this.location.back();
  }
}
