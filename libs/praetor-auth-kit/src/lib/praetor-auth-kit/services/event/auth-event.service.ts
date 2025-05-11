import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { LoginResponseDto } from '../../models/login.models';
import { RefreshResponseDto } from '../../models/tokens.models';
import { filter } from 'rxjs/operators';

export type AuthEvent =
  | { type: 'loginSuccess'; payload: LoginResponseDto }
  | { type: 'refresh'; payload: RefreshResponseDto }
  | { type: 'logout' };

@Injectable({ providedIn: 'root' })
export class AuthEventsService {
  private readonly _events$ = new Subject<AuthEvent>();

  public readonly loginSuccess$ = this._events$
    .asObservable()
    .pipe(
      filter(
        (e): e is { type: 'loginSuccess'; payload: LoginResponseDto } =>
          e.type === 'loginSuccess'
      )
    );

  public readonly refreshToken$ = this._events$
    .asObservable()
    .pipe(
      filter(
        (e): e is { type: 'refresh'; payload: RefreshResponseDto } =>
          e.type === 'refresh'
      )
    );

  public readonly logout$ = this._events$
    .asObservable()
    .pipe(filter((e): e is { type: 'logout' } => e.type === 'logout'));

  emitLoginSuccess(payload: LoginResponseDto) {
    this._events$.next({ type: 'loginSuccess', payload });
  }

  emitRefreshToken(payload: RefreshResponseDto) {
    this._events$.next({ type: 'refresh', payload });
  }

  emitLogout() {
    this._events$.next({ type: 'logout' });
  }
}
