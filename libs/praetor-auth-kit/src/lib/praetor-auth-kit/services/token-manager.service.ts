import { AuthEventsService } from './auth-event.service';
import { TokenStorageService } from './token-storage.service';
import { inject, Injectable } from '@angular/core';
import { TokenRefreshService } from './token-refresh.service';
import { of, Subject, takeUntil, tap } from 'rxjs';
import { userStore } from '../stores/user/user.store';
import { catchError, filter, switchMap } from 'rxjs/operators';
import { UserService } from './user.service';
import { PraetorActionsService } from './praetor-actions.service';

@Injectable({ providedIn: 'root' })
export class TokenManagerService {
  private readonly unsubscribe$ = new Subject<void>();

  private readonly userStore = inject(userStore);

  constructor(
    private readonly storage: TokenStorageService,
    private readonly authEventsService: AuthEventsService,
    private readonly refreshTimer: TokenRefreshService,
    private readonly userService: UserService,
    private readonly praetorActionsService: PraetorActionsService
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
      }),
      switchMap(() =>
        this.userService.getMe().pipe(
          catchError((err) => {
            console.debug(err);
            return of(null);
          })
        )
      ),
      filter((res) => res != null),
      tap((user) => this.userStore.setUser(user)),
      tap(() => this.praetorActionsService.emitLoggedAction())
    );
  }

  private onLogout() {
    return this.authEventsService.logout$.pipe(
      takeUntil(this.unsubscribe$),
      tap(() => {
        this.storage.clearTokens();
        this.refreshTimer.stop();
        this.userStore.clear();
      })
    );
  }
}
