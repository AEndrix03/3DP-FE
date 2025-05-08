import { AuthEvent, AuthEventsService } from './auth-event.service';
import { TokenStorageService } from './token-storage.service';
import { Injectable } from '@angular/core';
import { TokenRefreshService } from './token-refresh.service';
import { Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TokenManagerService {
  private readonly events$: Observable<AuthEvent>;

  constructor(
    private readonly storage: TokenStorageService,
    private readonly events: AuthEventsService,
    private readonly refreshTimer: TokenRefreshService
  ) {
    this.events$ = this.events.events$.pipe(
      tap((event: AuthEvent) => {
        if (event.type === 'loginSuccess') {
          this.storage.saveTokens(
            event.payload.accessToken,
            event.payload.refreshToken
          );
          this.refreshTimer.start();
        }

        if (event.type === 'logout') {
          this.storage.clearTokens();
          this.refreshTimer.stop();
        }
      })
    );
  }

  public start(): void {
    this.events$.subscribe();
  }
}
