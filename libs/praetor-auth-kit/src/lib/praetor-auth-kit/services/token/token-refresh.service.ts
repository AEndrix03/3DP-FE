import { Injectable } from '@angular/core';
import { EMPTY, interval, Subscription } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthenticationService } from '@3-dp-fe/praetor-auth-kit';
import { TokenStorageService } from './token-storage.service';
import { AuthEventsService } from '../event/auth-event.service';

@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  private subscription?: Subscription;
  private readonly intervalMs = 10 * 60 * 1000;

  constructor(
    private readonly authService: AuthenticationService,
    private readonly tokenStorage: TokenStorageService,
    private readonly authEvents: AuthEventsService
  ) {}

  start(): void {
    if (this.subscription) return;
    this.subscription = interval(this.intervalMs)
      .pipe(
        switchMap(() => {
          const refreshToken = this.tokenStorage.getRefreshToken();
          if (!refreshToken) return EMPTY;
          return this.authService.refresh({ refreshToken });
        }),
        catchError((err, caught) => {
          console.error('Token refresh failed:', err);
          this.authEvents.emitLogout();
          return caught;
        })
      )
      .subscribe((res) => {
        if (!res) return;
        this.tokenStorage.saveTokens(res.accessToken, res.refreshToken);
      });
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }

  restart() {
    this.stop();
    this.start();
  }
}
