import { Injectable } from '@angular/core';
import { Subject, tap } from 'rxjs';
import { LoginResponseDto } from '../models/login.models';

export type AuthEvent =
  | { type: 'loginSuccess'; payload: LoginResponseDto }
  | { type: 'logout' };

@Injectable({ providedIn: 'root' })
export class AuthEventsService {
  private readonly authEvents$ = new Subject<AuthEvent>();
  public readonly loginSuccess$ = new Subject<LoginResponseDto>();
  public readonly logout$ = new Subject<void>();

  private readonly events$ = this.authEvents$.asObservable();

  constructor() {
    this.authEvents$
      .pipe(
        tap((event) => {
          if (event.type === 'loginSuccess') {
            this.loginSuccess$.next(event.payload);
          } else if (event.type === 'logout') {
            this.logout$.next();
          }
        })
      )
      .subscribe();
  }

  public loginSuccess(payload: LoginResponseDto) {
    this.authEvents$.next({ type: 'loginSuccess', payload });
  }

  public logout() {
    this.authEvents$.next({ type: 'logout' });
  }

  private emit(event: AuthEvent) {
    this.authEvents$.next(event);
  }
}
