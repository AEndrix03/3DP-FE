import { inject, Injectable } from '@angular/core';
import { of, Subject, takeUntil, tap } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthEventsService } from '../event/auth-event.service';
import { TokenStorageService } from './token-storage.service';
import { TokenRefreshService } from './token-refresh.service';
import { AuthenticationService } from '../authentication.service';
import { UserService } from '../user.service';
import { UserDto } from '../../models/user.models';
import { userStore } from '../../stores/user/user.store';
import {
  PRAETOR_APPLICATION_NAME,
  PRAETOR_AUTH_APPLICATION_NAME,
} from '../../tokens/api.token';

@Injectable({ providedIn: 'root' })
export class TokenManagerService {
  private readonly unsubscribe$ = new Subject<void>();

  private readonly userStore = inject(userStore);
  private readonly applicationName = inject(PRAETOR_APPLICATION_NAME);
  private readonly authApplicationName = inject(PRAETOR_AUTH_APPLICATION_NAME);

  constructor(
    private readonly storage: TokenStorageService,
    private readonly authEventsService: AuthEventsService,
    private readonly refreshTimer: TokenRefreshService,
    private readonly userService: UserService,
    private readonly authenticationService: AuthenticationService
  ) {}

  public start(): void {
    this.subscribeToLogin();
    this.subscribeToLogout();
    this.subscribeToTokenRefresh();
    this.tryAutoRefreshOnInit();
  }

  public stop(): void {
    this.unsubscribe$.next();
  }

  private subscribeToLogin() {
    this.authEventsService.loginSuccess$
      .pipe(takeUntil(this.unsubscribe$))
      .pipe(this.handleTokensAndLoadUser())
      .subscribe();
  }

  private subscribeToLogout() {
    this.authEventsService.logout$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => this.resetAll());
  }

  private subscribeToTokenRefresh() {
    this.authEventsService.refreshToken$
      .pipe(takeUntil(this.unsubscribe$))
      .pipe(this.handleTokensAndLoadUser())
      .subscribe();
  }

  private tryAutoRefreshOnInit() {
    const refreshToken = this.storage.getRefreshToken();

    if (refreshToken) {
      this.authenticationService
        .refresh({ refreshToken })
        .pipe(take(1))
        .subscribe({
          next: (payload) => this.authEventsService.emitRefreshToken(payload),
          error: () => this.resetAll(),
        });
    } else {
      this.resetAll();
    }
  }

  private handleTokensAndLoadUser() {
    return (source$: any) =>
      source$.pipe(
        tap(({ payload: { accessToken, refreshToken } }) => {
          this.storage.saveTokens(accessToken, refreshToken);
          this.refreshTimer.restart();
        }),
        switchMap(() =>
          this.userService
            .getMe(this.applicationName, this.authApplicationName)
            .pipe(
              catchError((err) => {
                console.debug('Errore durante getMe:', err);
                return of(null);
              })
            )
        ),
        filter((user): user is UserDto => !!user),
        tap((user: UserDto) => this.userStore.setUser(user))
      );
  }

  private resetAll() {
    this.storage.clearTokens();
    this.refreshTimer.stop();
    this.userStore.clear();
  }
}
