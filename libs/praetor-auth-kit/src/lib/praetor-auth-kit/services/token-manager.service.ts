import { AuthEventsService } from './auth-event.service';
import { TokenStorageService } from './token-storage.service';
import { Injectable } from '@angular/core';
import { TokenRefreshService } from './token-refresh.service';
import { Subject, takeUntil, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TokenManagerService {
  private readonly unsubscribe$ = new Subject<void>();

  constructor(
    private readonly storage: TokenStorageService,
    private readonly authEventsService: AuthEventsService,
    private readonly refreshTimer: TokenRefreshService
  ) {}

  public start(): void {
    this.onLoginSuccess().subscribe();
    this.onLogout().subscribe();
  }

  public stop(): void {
    this.unsubscribe$.next();
  }

  private onLoginSuccess() {
    return this.authEventsService.loginSuccess$.pipe(
      takeUntil(this.unsubscribe$),
      tap((payload) => {
        this.storage.saveTokens(payload.accessToken, payload.refreshToken);
        this.refreshTimer.start();
      })
    );
  }

  private onLogout() {
    return this.authEventsService.logout$.pipe(
      takeUntil(this.unsubscribe$),
      tap(() => {
        this.storage.clearTokens();
        this.refreshTimer.stop();
      })
    );
  }
}
